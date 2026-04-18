const Order = require('../model/OrderModel');
const db = require('../config/db');

const DEFAULT_OVERDUE_RATE = 50;

const parseMaybeJson = (value, fallback = {}) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const toDateOnly = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
};

const addRentalDays = (startDate, duration) => {
  const start = toDateOnly(startDate);
  if (!start) return null;
  const d = new Date(`${start}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const safeDuration = Math.max(1, parseInt(duration, 10) || 1);
  d.setDate(d.getDate() + safeDuration - 1);
  return d.toISOString().split('T')[0];
};

const dateDiffDays = (fromDate, toDate) => {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
};

const normalizeDuration = (value) => {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 3;
  return Math.max(1, Math.min(30, parsed));
};

const normalizeOverdueRate = (value) => {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) return DEFAULT_OVERDUE_RATE;
  return Math.max(0, parsed);
};

const ensureDeletedOrdersArchiveTable = (callback) => {
  const createTableSql = `
    CREATE TABLE IF NOT EXISTS deleted_orders_archive (
      archive_id INT AUTO_INCREMENT PRIMARY KEY,
      original_item_id INT NOT NULL,
      order_id INT NULL,
      user_id INT NULL,
      service_type VARCHAR(50) NULL,
      approval_status VARCHAR(50) NULL,
      payment_status VARCHAR(50) NULL,
      price DECIMAL(10,2) NULL,
      final_price DECIMAL(10,2) NULL,
      customer_name VARCHAR(255) NULL,
      order_date DATETIME NULL,
      deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_by_user_id INT NULL,
      deleted_by_name VARCHAR(255) NULL,
      snapshot LONGTEXT NULL,
      INDEX idx_service_type (service_type),
      INDEX idx_deleted_at (deleted_at),
      INDEX idx_customer_name (customer_name),
      INDEX idx_original_item_id (original_item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;

  db.query(createTableSql, callback);
};

const collectRentalSizeTerms = (orderItem) => {
  const pricingFactors = parseMaybeJson(orderItem?.pricing_factors, {});
  const specificData = parseMaybeJson(orderItem?.specific_data, {});
  const fallbackStart = toDateOnly(orderItem?.rental_start_date || specificData?.rental_start_date);
  const fallbackDuration = normalizeDuration(orderItem?.rental_duration ?? pricingFactors?.rental_duration ?? pricingFactors?.duration ?? 3);
  const fallbackRate = normalizeOverdueRate(orderItem?.overdue_rate ?? pricingFactors?.overdue_rate ?? DEFAULT_OVERDUE_RATE);
  const fallbackDue =
    toDateOnly(orderItem?.due_date)
    || toDateOnly(pricingFactors?.due_date)
    || toDateOnly(orderItem?.rental_end_date)
    || addRentalDays(fallbackStart, fallbackDuration);

  const rows = [];

  const pushTerms = (selectedSizes, startDate, fallbackLabel = 'Rental Size') => {
    if (!Array.isArray(selectedSizes)) return;

    selectedSizes.forEach((sizeEntry = {}) => {
      const quantity = Math.max(1, parseInt(sizeEntry.quantity, 10) || 1);
      const duration = normalizeDuration(sizeEntry.rental_duration ?? sizeEntry.duration ?? fallbackDuration);
      const overdueRate = normalizeOverdueRate(sizeEntry.overdue_amount ?? sizeEntry.overdue_rate ?? fallbackRate);
      const dueDate =
        toDateOnly(sizeEntry.due_date)
        || addRentalDays(startDate || fallbackStart, duration)
        || fallbackDue;

      rows.push({
        label: sizeEntry.label || sizeEntry.sizeKey || sizeEntry.size_key || fallbackLabel,
        quantity,
        duration,
        overdueRate,
        dueDate
      });
    });
  };

  if (specificData?.is_bundle && Array.isArray(specificData.bundle_items)) {
    specificData.bundle_items.forEach((bundleItem = {}) => {
      const selectedSizes = bundleItem.selected_sizes || bundleItem.selectedSizes || [];
      pushTerms(selectedSizes, bundleItem.rental_start_date || fallbackStart, bundleItem.item_name || 'Bundle Item');
    });
  } else {
    const selectedSizes = specificData?.selected_sizes || specificData?.selectedSizes || [];
    pushTerms(selectedSizes, fallbackStart, specificData?.item_name || 'Rental Size');
  }

  if (rows.length === 0 && fallbackDue) {
    rows.push({
      label: 'Rental',
      quantity: 1,
      duration: fallbackDuration,
      overdueRate: fallbackRate,
      dueDate: fallbackDue
    });
  }

  return rows;
};

const calculateDynamicPenalty = (orderItem, referenceDate = new Date()) => {
  const asOf = referenceDate.toISOString().split('T')[0];
  const termRows = collectRentalSizeTerms(orderItem);

  let penaltyAmount = 0;
  let maxDaysOverdue = 0;
  let primaryDueDate = null;

  termRows.forEach((row) => {
    const dueDate = toDateOnly(row.dueDate);
    if (!dueDate) return;
    const daysOverdue = Math.max(0, dateDiffDays(dueDate, asOf));
    const linePenalty = daysOverdue * row.overdueRate * row.quantity;

    penaltyAmount += linePenalty;
    if (daysOverdue > maxDaysOverdue) {
      maxDaysOverdue = daysOverdue;
      primaryDueDate = dueDate;
    }
  });

  return {
    penaltyAmount: Math.max(0, parseFloat(penaltyAmount.toFixed(2))),
    penaltyDays: maxDaysOverdue,
    primaryDueDate: primaryDueDate || toDateOnly(orderItem?.due_date) || toDateOnly(orderItem?.rental_end_date) || null,
    termRows
  };
};

exports.getUserOrders = (req, res) => {
  const userId = req.user.id;

  Order.getByUser(userId, (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Database error",
        error: err
      });
    }

    res.json({
      success: true,
      message: "Orders retrieved successfully",
      orders: results
    });
  });
};

exports.getAllOrders = (req, res) => {
  Order.getAll((err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Database error",
        error: err
      });
    }

    res.json({
      success: true,
      message: "All orders retrieved successfully",
      orders: results
    });
  });
};

exports.getOrderById = (req, res) => {
  const orderId = req.params.id;
  const userId = req.user.id;

  Order.getFullOrderById(orderId, (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Database error",
        error: err
      });
    }

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    if (req.user.role !== 'admin' && result.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    res.json({
      success: true,
      message: "Order retrieved successfully",
      order: result
    });
  });
};

exports.updateOrderStatus = (req, res) => {
  const orderId = req.params.id;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({
      success: false,
      message: "Status is required"
    });
  }

  Order.getById(orderId, (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Database error",
        error: err
      });
    }

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const order = result[0];

    if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    Order.updateStatus(orderId, status, (err, updateResult) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Error updating order",
          error: err
        });
      }

      res.json({
        success: true,
        message: "Order status updated successfully"
      });
    });
  });
};

exports.cancelOrder = (req, res) => {
  const orderId = req.params.id;
  const { reason } = req.body;

  Order.getById(orderId, (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Database error",
        error: err
      });
    }

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const order = result[0];

    if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    Order.cancelOrder(orderId, reason || 'Cancelled by user', (err, cancelResult) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Error cancelling order",
          error: err
        });
      }

      res.json({
        success: true,
        message: "Order cancelled successfully"
      });
    });
  });
};

exports.cancelOrderItem = (req, res) => {
  const itemId = req.params.id;
  const { reason } = req.body;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  if (!reason || reason.trim() === '') {
    return res.status(400).json({
      success: false,
      message: "Cancellation reason is required"
    });
  }

  Order.getOrderItemById(itemId, (err, item) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Database error",
        error: err
      });
    }

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Order item not found"
      });
    }

    Order.getById(item.order_id, (orderErr, orderResult) => {
      if (orderErr || !orderResult || orderResult.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Order not found"
        });
      }

      const order = orderResult[0];

      if (!isAdmin && order.user_id !== userId) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only cancel your own orders."
        });
      }

      if (item.approval_status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: "This order item is already cancelled"
        });
      }

      const previousStatus = item.approval_status || 'pending';

      Order.cancelOrderItem(itemId, reason, (cancelErr, cancelResult) => {
        if (cancelErr) {
          return res.status(500).json({
            success: false,
            message: "Error cancelling order item",
            error: cancelErr
          });
        }

        const ActionLog = require('../model/ActionLogModel');
        ActionLog.create({
          order_item_id: itemId,
          user_id: userId,
          action_type: 'cancel',
          action_by: isAdmin ? 'admin' : 'user',
          previous_status: previousStatus,
          new_status: 'cancelled',
          reason: reason,
          notes: `Order item cancelled by ${isAdmin ? 'admin' : 'user'}`
        }, (logErr) => {
          if (logErr) {
            console.error('Error logging action:', logErr);
          }
        });

        const OrderTracking = require('../model/OrderTrackingModel');
        OrderTracking.updateStatus(itemId, 'cancelled', `Cancelled: ${reason}`, userId, (trackErr) => {
          if (trackErr) {
            console.error('Error updating order tracking:', trackErr);
          }
        });

        const AppointmentSlot = require('../model/AppointmentSlotModel');
        AppointmentSlot.cancelSlotByOrderItem(itemId, (slotErr) => {
          if (slotErr) {
            console.error('Error cancelling appointment slot:', slotErr);
            
          } else {
            console.log(`Appointment slot cancelled for order item ${itemId}`);
          }
        });

        res.json({
          success: true,
          message: "Order item cancelled successfully"
        });
      });
    });
  });
};

exports.updateItemApprovalStatus = (req, res) => {
  const itemId = req.params.id;
  const { status } = req.body;
  const userId = req.user.id;

  if (!status) {
    return res.status(400).json({
      success: false,
      message: "Status is required"
    });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'clerk') {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only."
    });
  }

  Order.getOrderItemById(itemId, (getErr, item) => {
    if (getErr || !item) {
      return res.status(500).json({
        success: false,
        message: "Error fetching order item",
        error: getErr
      });
    }

    const previousStatus = item.approval_status || 'pending';

    Order.updateItemApprovalStatus(itemId, status, (err, result) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Error updating item approval status",
          error: err
        });
      }

      const ActionLog = require('../model/ActionLogModel');
      
      const actorUserId = req.user?.id || item.user_id || null;
      const actorRole = req.user?.role === 'clerk' ? 'clerk' : 'admin';
      const actorLabel = req.user?.username || actorRole;
      
      if (!actorUserId) {
        console.error('Cannot log action: user_id is missing. req.user:', req.user, 'item.user_id:', item.user_id);
      }

      if (actorUserId) {
        ActionLog.create({
          order_item_id: itemId,
          user_id: actorUserId,
          action_type: 'status_update',
          action_by: actorRole,
          previous_status: previousStatus,
          new_status: status,
          reason: null,
          notes: `${actorLabel} updated order item status from ${previousStatus} to ${status}`
        }, (logErr, logResult) => {
          if (logErr) {
            console.error('Error logging order item status update:', logErr);
            console.error('Log data:', {
              order_item_id: itemId,
              user_id: actorUserId,
              action_type: 'status_update',
              previous_status: previousStatus,
              new_status: status
            });
          } else {
            console.log('Successfully logged order item status update:', logResult?.insertId);
          }
        });
      } else {
        console.error('Skipping action log: user_id is null or undefined');
      }

      res.json({
        success: true,
        message: "Item approval status updated successfully"
      });
    });
  });
};

exports.getOrdersByStatus = (req, res) => {
  const { status } = req.query;

  if (!status) {
    return res.status(400).json({
      success: false,
      message: "Status is required"
    });
  }

  Order.getByStatus(status, (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Database error",
        error: err
      });
    }

    res.json({
      success: true,
      message: `Orders with status '${status}' retrieved successfully`,
      orders: results
    });
  });
};

exports.getPendingApprovalItems = (req, res) => {
  
  if (req.user.role !== 'admin' && req.user.role !== 'clerk') {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only."
    });
  }

  Order.getPendingApprovalItems((err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Database error",
        error: err
      });
    }

    const items = results.map(item => ({
      ...item,
      pricing_factors: JSON.parse(item.pricing_factors || '{}'),
      specific_data: JSON.parse(item.specific_data || '{}')
    }));

    res.json({
      success: true,
      message: "Pending approval items retrieved successfully",
      items: items
    });
  });
};

exports.getRepairOrders = (req, res) => {
  
  if (req.user.role !== 'admin' && req.user.role !== 'clerk') {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only."
    });
  }

  Order.getRepairOrders((err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Database error",
        error: err
      });
    }

    const orders = results.map(item => {
      const pricingFactors = parseMaybeJson(item.pricing_factors, {});
      const specificData = parseMaybeJson(item.specific_data, {});
      return {
        ...item,
        pricing_factors: pricingFactors,
        specific_data: specificData,
        rental_duration: item.rental_duration || pricingFactors.rental_duration || pricingFactors.duration || null,
        overdue_rate: item.overdue_rate || pricingFactors.overdue_rate || null,
        due_date: item.due_date || pricingFactors.due_date || item.rental_end_date || null
      };
    });

    res.json({
      success: true,
      message: "Repair orders retrieved successfully",
      orders: orders
    });
  });
};

exports.getRepairOrdersByStatus = (req, res) => {
  const { status } = req.params;

  if (!status) {
    return res.status(400).json({
      success: false,
      message: "Status is required"
    });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'clerk') {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only."
    });
  }

  Order.getRepairOrdersByStatus(status, (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Database error",
        error: err
      });
    }

    const orders = results.map(item => {
      const pricingFactors = parseMaybeJson(item.pricing_factors, {});
      const specificData = parseMaybeJson(item.specific_data, {});
      return {
        ...item,
        pricing_factors: pricingFactors,
        specific_data: specificData,
        rental_duration: item.rental_duration || pricingFactors.rental_duration || pricingFactors.duration || null,
        overdue_rate: item.overdue_rate || pricingFactors.overdue_rate || null,
        due_date: item.due_date || pricingFactors.due_date || item.rental_end_date || null
      };
    });

    res.json({
      success: true,
      message: `Repair orders with status '${status}' retrieved successfully`,
      orders: orders
    });
  });
};

exports.updateRepairOrderItem = (req, res) => {
  const itemId = req.params.id;
  const { finalPrice, approvalStatus, adminNotes, estimatedCompletionDate, pricingFactors } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'clerk') {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only."
    });
  }

  const updateData = {
    finalPrice: finalPrice || undefined,
    approvalStatus: approvalStatus || undefined,
    adminNotes: adminNotes || undefined,
    estimatedCompletionDate: estimatedCompletionDate !== undefined ? (estimatedCompletionDate || null) : undefined,
    pricingFactors: pricingFactors || undefined
  };

  console.log("Controller - Received update data for item:", itemId, req.body);
  console.log("Controller - Processed updateData:", updateData);

  Object.keys(updateData).forEach(key => {
    if (updateData[key] === undefined) {
      delete updateData[key];
    }
  });

  console.log("Controller - Final updateData after cleanup:", updateData);

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({
      success: false,
      message: "At least one field to update is required"
    });
  }

  Order.getOrderItemById(itemId, (getErr, item) => {
    if (getErr || !item) {
      return res.status(500).json({
        success: false,
        message: "Error fetching order item",
        error: getErr
      });
    }

    const previousStatus = item.approval_status || 'pending';
    const previousPrice = item.final_price || null;

    const db = require('../config/db');
    const checkOrderSql = `SELECT order_type FROM orders WHERE order_id = ?`;
    db.query(checkOrderSql, [item.order_id], (orderErr, orderResults) => {
      if (!orderErr && orderResults && orderResults.length > 0) {
        const isWalkIn = orderResults[0].order_type === 'walk_in';

        if (isWalkIn && updateData.finalPrice && !updateData.approvalStatus) {
          
          if (previousStatus === 'pending' || previousStatus === 'pending_review' || previousStatus === 'price_confirmation') {
            updateData.approvalStatus = 'accepted';
          }
        }

        if (isWalkIn && updateData.approvalStatus === 'price_confirmation') {
          updateData.approvalStatus = 'accepted';
        }
      }

      const hasIncomingFinalPrice = updateData.finalPrice !== undefined && updateData.finalPrice !== null && updateData.finalPrice !== '';
      if (hasIncomingFinalPrice) {
        const nextPrice = parseFloat(updateData.finalPrice);
        const prevPrice = parseFloat(previousPrice || 0);
        const isPriceChanged = !Number.isNaN(nextPrice) && Math.abs(nextPrice - prevPrice) > 0.01;
        const hasReason = String(updateData.adminNotes || '').trim().length > 0;

        const isCancellingEnhancement = updateData.pricingFactors && updateData.pricingFactors.enhancementRequest === false;
        if (isPriceChanged && !hasReason && !isCancellingEnhancement) {
          return res.status(400).json({
            success: false,
            message: "A reason is required when changing the repair price"
          });
        }
      }

      const isPendingState = previousStatus === 'pending' || previousStatus === 'pending_review' || !previousStatus;
      const isDecliningPendingRequest = updateData.approvalStatus === 'cancelled' && isPendingState;
      if (isDecliningPendingRequest) {
        const declineReason = String(updateData.adminNotes || updateData.pricingFactors?.adminDeclineReason || '').trim();
        if (!declineReason) {
          return res.status(400).json({
            success: false,
            message: 'Decline reason is required when rejecting a pending repair request'
          });
        }

        updateData.adminNotes = declineReason;
        updateData.pricingFactors = {
          ...(updateData.pricingFactors || {}),
          adminDeclineReason: declineReason,
          adminDeclinedAt: updateData.pricingFactors?.adminDeclinedAt || new Date().toISOString()
        };
      }
      
      Order.updateRepairOrderItem(itemId, updateData, (err, result) => {
        console.log("Controller - Update result:", err, result);
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Error updating repair order item",
          error: err
        });
      }

      const ActionLog = require('../model/ActionLogModel');
      
      const userId = req.user?.id || item.user_id || null;
      const actorRole = req.user?.role === 'clerk' ? 'clerk' : 'admin';
      const actorLabel = req.user?.username || actorRole;
      
      if (!userId) {
        console.error('Cannot log action: user_id is missing. req.user:', req.user, 'item.user_id:', item.user_id);
      }

      const formatStatus = (status) => {
        const statusMap = {
          'pending_review': 'Pending Review',
          'pending': 'Pending',
          'accepted': 'Accepted',
          'price_confirmation': 'Price Confirmation',
          'confirmed': 'In Progress',
          'ready_for_pickup': 'Ready for Pickup',
          'completed': 'Completed',
          'cancelled': 'Cancelled'
        };
        return statusMap[status] || status;
      };
      
      let actionNotes = [];
      
      if (updateData.approvalStatus && updateData.approvalStatus !== previousStatus) {
        actionNotes.push(formatStatus(updateData.approvalStatus));
      }
      if (updateData.finalPrice && updateData.finalPrice !== previousPrice) {
        actionNotes.push(`Price: ₱${parseFloat(previousPrice || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} → ₱${parseFloat(updateData.finalPrice).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
      }
      if (updateData.adminNotes) {
        actionNotes.push(`Notes: ${updateData.adminNotes}`);
      }

      const newStatus = updateData.approvalStatus || previousStatus;

      if (userId) {
        ActionLog.create({
          order_item_id: itemId,
          user_id: userId,
          action_type: 'status_update',
          action_by: actorRole,
          previous_status: previousStatus,
          new_status: newStatus,
          reason: null,
          notes: actionNotes.length > 0 
            ? `Repair: ${actionNotes.join(' | ')} (by ${actorLabel})`
            : `Repair: Updated (by ${actorLabel})`
        }, (logErr, logResult) => {
          if (logErr) {
            console.error('Error logging repair order action:', logErr);
            console.error('Log data:', {
              order_item_id: itemId,
              user_id: userId,
              action_type: 'status_update',
              previous_status: previousStatus,
              new_status: newStatus
            });
          } else {
            console.log('Successfully logged repair order action:', logResult?.insertId);
          }
        });
      } else {
        console.error('Skipping action log: user_id is null or undefined');
      }

      if (updateData.approvalStatus && (updateData.approvalStatus === 'cancelled' || updateData.approvalStatus === 'rejected')) {
        console.log(`[REPAIR] Cancelling appointment slot for order item ${itemId} with status: ${updateData.approvalStatus}`);
        const AppointmentSlot = require('../model/AppointmentSlotModel');
        AppointmentSlot.cancelSlotByOrderItem(itemId, (slotErr, cancelResult) => {
          if (slotErr) {
            console.error('[REPAIR] Error cancelling appointment slot:', slotErr);
          } else {
            console.log(`[REPAIR] Appointment slot cancellation result for item ${itemId}:`, cancelResult?.affectedRows || 0, 'slots cancelled');
          }
        });
      }

      const billingHelper = require('../utils/billingHelper');
      if (updateData.approvalStatus && updateData.approvalStatus !== previousStatus) {
        const serviceType = (item.service_type || 'repair').toLowerCase().trim();
        console.log(`[BILLING] ===== STARTING BILLING UPDATE FOR REPAIR =====`);
        console.log(`[BILLING] Item ID: ${itemId}`);
        console.log(`[BILLING] Service Type: "${serviceType}" (from DB: "${item.service_type}")`);
        console.log(`[BILLING] New Status: "${updateData.approvalStatus}"`);
        console.log(`[BILLING] Previous Status: "${previousStatus}"`);
        
        billingHelper.updateBillingStatus(itemId, serviceType, updateData.approvalStatus, previousStatus, (billingErr, billingResult) => {
          if (billingErr) {
            console.error('[BILLING] ===== ERROR UPDATING BILLING STATUS FOR REPAIR =====');
            console.error('[BILLING] Error details:', billingErr);
          } else if (billingResult) {
            console.log('[BILLING] ===== BILLING UPDATE SUCCESS FOR REPAIR =====');
            console.log('[BILLING] Result:', JSON.stringify(billingResult, null, 2));
          } else {
            console.log('[BILLING] ===== NO BILLING UPDATE NEEDED FOR REPAIR =====');
          }
        });
      }

      if (updateData.approvalStatus && updateData.approvalStatus !== previousStatus) {
        const Notification = require('../model/NotificationModel');
        const customerUserId = item.user_id; 
        
        if (customerUserId) {
          const serviceType = (item.service_type || 'repair').toLowerCase().trim();

          if (updateData.approvalStatus === 'accepted') {
            Notification.createAcceptedNotification(customerUserId, itemId, serviceType, (notifErr) => {
              if (notifErr) {
                console.error('[NOTIFICATION] Failed to create accepted notification:', notifErr);
              } else {
                console.log('[NOTIFICATION] Accepted notification created successfully');
              }
            });

            try {
              const emailService = require('../services/emailService');
              const dbConn = require('../config/db');
              
              const getUserSql = `SELECT u.email, u.first_name, u.last_name FROM user u WHERE u.user_id = ?`;
              dbConn.query(getUserSql, [customerUserId], async (userErr, userResults) => {
                if (!userErr && userResults.length > 0) {
                  const user = userResults[0];
                  const specificData = item.specific_data ? 
                    (typeof item.specific_data === 'string' ? JSON.parse(item.specific_data) : item.specific_data) : {};
                  const itemName = specificData.garment_type || specificData.item_name || 'Repair Item';
                  
                  await emailService.sendServiceStatusEmail({
                    userEmail: user.email,
                    userName: `${user.first_name} ${user.last_name}`,
                    serviceName: itemName,
                    serviceType: serviceType,
                    status: 'accepted',
                    orderId: itemId,
                    appointmentDate: item.appointment_date || null
                  });
                  console.log(`[EMAIL] Service status email sent to ${user.email} for status: accepted`);
                }
              });
            } catch (emailErr) {
              console.error('[EMAIL] Error sending service status email:', emailErr);
            }
          }

          if (updateData.approvalStatus === 'price_confirmation') {
            Notification.createStatusUpdateNotification(
              customerUserId,
              itemId,
              'price_confirmation',
              null,
              serviceType,
              (notifErr) => {
                if (notifErr) {
                  console.error('[NOTIFICATION] Failed to create price confirmation notification:', notifErr);
                } else {
                  console.log('[NOTIFICATION] Price confirmation notification created successfully');
                }
              }
            );

            try {
              const emailService = require('../services/emailService');
              const dbConn = require('../config/db');
              
              const getUserSql = `SELECT u.email, u.first_name, u.last_name FROM user u WHERE u.user_id = ?`;
              dbConn.query(getUserSql, [customerUserId], async (userErr, userResults) => {
                if (!userErr && userResults.length > 0) {
                  const user = userResults[0];
                  const specificData = item.specific_data ? 
                    (typeof item.specific_data === 'string' ? JSON.parse(item.specific_data) : item.specific_data) : {};
                  const itemName = specificData.garment_type || specificData.item_name || 'Repair Item';
                  
                  await emailService.sendServiceStatusEmail({
                    userEmail: user.email,
                    userName: `${user.first_name} ${user.last_name}`,
                    serviceName: itemName,
                    serviceType: serviceType,
                    status: 'price_confirmation',
                    orderId: itemId,
                    message: updateData.adminNotes || null,
                    appointmentDate: item.appointment_date || null
                  });
                  console.log(`[EMAIL] Service status email sent to ${user.email} for status: price_confirmation`);
                }
              });
            } catch (emailErr) {
              console.error('[EMAIL] Error sending service status email:', emailErr);
            }
          }

          const statusNotificationStatuses = [
            'confirmed',
            'in_progress',
            'ready_for_pickup',
            'ready_to_pickup',
            'completed',
            'cancelled'
          ];
          
          if (statusNotificationStatuses.includes(updateData.approvalStatus)) {
            const statusForNotification = 
              updateData.approvalStatus === 'confirmed' ? 'in_progress' :
              updateData.approvalStatus === 'ready_for_pickup' ? 'ready_to_pickup' :
              updateData.approvalStatus === 'ready_to_pickup' ? 'ready_to_pickup' :
              updateData.approvalStatus;
            
            Notification.createStatusUpdateNotification(
              customerUserId,
              itemId,
              statusForNotification,
              null,
              serviceType,
              (notifErr) => {
                if (notifErr) {
                  console.error('[NOTIFICATION] Failed to create status update notification:', notifErr);
                } else {
                  console.log('[NOTIFICATION] Status update notification created successfully');
                }
              }
            );

            try {
              const emailService = require('../services/emailService');
              const dbConn = require('../config/db');
              
              const getUserSql = `SELECT u.email, u.first_name, u.last_name FROM user u WHERE u.user_id = ?`;
              dbConn.query(getUserSql, [customerUserId], async (userErr, userResults) => {
                if (!userErr && userResults.length > 0) {
                  const user = userResults[0];
                  const specificData = item.specific_data ? 
                    (typeof item.specific_data === 'string' ? JSON.parse(item.specific_data) : item.specific_data) : {};
                  const itemName = specificData.garment_type || specificData.item_name || 'Repair Item';
                  
                  await emailService.sendServiceStatusEmail({
                    userEmail: user.email,
                    userName: `${user.first_name} ${user.last_name}`,
                    serviceName: itemName,
                    serviceType: serviceType,
                    status: statusForNotification,
                    orderId: itemId,
                    message: updateData.adminNotes || null,
                    appointmentDate: item.appointment_date || null
                  });
                  console.log(`[EMAIL] Service status email sent to ${user.email} for status: ${statusForNotification}`);
                }
              });
            } catch (emailErr) {
              console.error('[EMAIL] Error sending service status email:', emailErr);
            }
          }
        } else {
          console.error('[NOTIFICATION] Cannot create notification: customer user_id is missing');
        }
      }

      console.log("Controller - Update successful, affected rows:", result?.affectedRows);
      res.json({
        success: true,
        message: "Repair order item updated successfully"
      });
      });
    });
  });
};

exports.getDryCleaningOrders = (req, res) => {
  
  if (req.user.role !== 'admin' && req.user.role !== 'clerk') {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only."
    });
  }

  Order.getDryCleaningOrders((err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Database error",
        error: err
      });
    }

    const orders = results.map(item => ({
      ...item,
      pricing_factors: JSON.parse(item.pricing_factors || '{}'),
      specific_data: JSON.parse(item.specific_data || '{}')
    }));

    res.json({
      success: true,
      message: "Dry cleaning orders retrieved successfully",
      orders: orders
    });
  });
};

exports.getDryCleaningOrdersByStatus = (req, res) => {
  const { status } = req.params;

  if (!status) {
    return res.status(400).json({
      success: false,
      message: "Status is required"
    });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'clerk') {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only."
    });
  }

  Order.getDryCleaningOrdersByStatus(status, (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Database error",
        error: err
      });
    }

    const orders = results.map(item => ({
      ...item,
      pricing_factors: JSON.parse(item.pricing_factors || '{}'),
      specific_data: JSON.parse(item.specific_data || '{}')
    }));

    res.json({
      success: true,
      message: `Dry cleaning orders with status '${status}' retrieved successfully`,
      orders: orders
    });
  });
};

exports.updateDryCleaningOrderItem = (req, res) => {
  const itemId = req.params.id;
  const { finalPrice, approvalStatus, adminNotes, estimatedCompletionDate, pricingFactors } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'clerk') {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only."
    });
  }

  const updateData = {
    finalPrice: finalPrice || undefined,
    approvalStatus: approvalStatus || undefined,
    adminNotes: adminNotes || undefined,
    estimatedCompletionDate: estimatedCompletionDate !== undefined ? (estimatedCompletionDate || null) : undefined,
    pricingFactors: pricingFactors || undefined
  };

  Object.keys(updateData).forEach(key => {
    if (updateData[key] === undefined) {
      delete updateData[key];
    }
  });

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({
      success: false,
      message: "At least one field to update is required"
    });
  }

  Order.getOrderItemById(itemId, (getErr, item) => {
    if (getErr || !item) {
      return res.status(500).json({
        success: false,
        message: "Error fetching order item",
        error: getErr
      });
    }

    const previousStatus = item.approval_status || 'pending';
    const previousPrice = item.final_price || null;

    // Check if garment type is "Others" - only then allow price editing with confirmation
    const hasIncomingFinalPrice = updateData.finalPrice !== undefined && updateData.finalPrice !== null && updateData.finalPrice !== '';
    if (hasIncomingFinalPrice) {
      const specificData = typeof item.specific_data === 'string' ? JSON.parse(item.specific_data || '{}') : (item.specific_data || {});
      
      // Check if any garment is "Others"
      let isOthersGarment = false;
      if (Array.isArray(specificData.garments) && specificData.garments.length > 0) {
        isOthersGarment = specificData.garments.some(g => (g.garmentType || '').toLowerCase() === 'others');
      } else {
        isOthersGarment = (specificData.garmentType || '').toLowerCase() === 'others';
      }

      // Only allow price confirmation for "Others" garment type
      if (isOthersGarment) {
        const nextPrice = parseFloat(updateData.finalPrice);
        const prevPrice = parseFloat(previousPrice || 0);
        const isPriceChanged = !Number.isNaN(nextPrice) && Math.abs(nextPrice - prevPrice) > 0.01;
        const hasReason = String(updateData.adminNotes || '').trim().length > 0;

        // For "Others" garment, if price changed and no walk-in, send price confirmation
        if (isPriceChanged) {
          const db = require('../config/db');
          const checkOrderSql = `SELECT order_type FROM orders WHERE order_id = ?`;
          db.query(checkOrderSql, [item.order_id], (orderErr, orderResults) => {
            if (!orderErr && orderResults && orderResults.length > 0) {
              const isWalkIn = orderResults[0].order_type === 'walk_in';
              
              if (!isWalkIn && !hasReason) {
                return res.status(400).json({
                  success: false,
                  message: "A reason is required when changing the price for 'Others' garment type"
                });
              }

              // For online orders with "Others" garment, send price confirmation
              if (!isWalkIn && (previousStatus === 'pending' || previousStatus === 'pending_review')) {
                updateData.approvalStatus = 'price_confirmation';
              }
            }
          });
        }
      }
    }

    const db = require('../config/db');
    const checkOrderSql = `SELECT order_type FROM orders WHERE order_id = ?`;
    db.query(checkOrderSql, [item.order_id], (orderErr, orderResults) => {
      if (!orderErr && orderResults && orderResults.length > 0) {
        const isWalkIn = orderResults[0].order_type === 'walk_in';

        if (isWalkIn && updateData.finalPrice && !updateData.approvalStatus) {
          
          if (previousStatus === 'pending' || previousStatus === 'pending_review' || previousStatus === 'price_confirmation') {
            updateData.approvalStatus = 'accepted';
          }
        }

        if (isWalkIn && updateData.approvalStatus === 'price_confirmation') {
          updateData.approvalStatus = 'accepted';
        }
      }

      const isPendingState = previousStatus === 'pending' || previousStatus === 'pending_review' || !previousStatus;
      const isDecliningPendingRequest = updateData.approvalStatus === 'cancelled' && isPendingState;
      if (isDecliningPendingRequest) {
        const declineReason = String(updateData.adminNotes || updateData.pricingFactors?.adminDeclineReason || '').trim();
        if (!declineReason) {
          return res.status(400).json({
            success: false,
            message: 'Decline reason is required when rejecting a pending dry cleaning request'
          });
        }

        updateData.adminNotes = declineReason;
        updateData.pricingFactors = {
          ...(updateData.pricingFactors || {}),
          adminDeclineReason: declineReason,
          adminDeclinedAt: updateData.pricingFactors?.adminDeclinedAt || new Date().toISOString()
        };
      }
      
      Order.updateDryCleaningOrderItem(itemId, updateData, (err, result) => {
        if (err) {
          return res.status(500).json({
          success: false,
          message: "Error updating dry cleaning order item",
          error: err
        });
      }

      const ActionLog = require('../model/ActionLogModel');
      
      const userId = req.user?.id || item.user_id || null;
      const actorRole = req.user?.role === 'clerk' ? 'clerk' : 'admin';
      const actorLabel = req.user?.username || actorRole;
      
      if (!userId) {
        console.error('Cannot log action: user_id is missing. req.user:', req.user, 'item.user_id:', item.user_id);
      }

      const formatStatus = (status) => {
        const statusMap = {
          'pending_review': 'Pending Review',
          'pending': 'Pending',
          'accepted': 'Accepted',
          'price_confirmation': 'Price Confirmation',
          'confirmed': 'In Progress',
          'ready_for_pickup': 'Ready for Pickup',
          'completed': 'Completed',
          'cancelled': 'Cancelled'
        };
        return statusMap[status] || status;
      };
      
      let actionNotes = [];
      
      if (updateData.approvalStatus && updateData.approvalStatus !== previousStatus) {
        actionNotes.push(formatStatus(updateData.approvalStatus));
      }
      if (updateData.finalPrice && updateData.finalPrice !== previousPrice) {
        actionNotes.push(`Price: ₱${parseFloat(previousPrice || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} → ₱${parseFloat(updateData.finalPrice).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
      }
      if (updateData.adminNotes) {
        actionNotes.push(`Notes: ${updateData.adminNotes}`);
      }

      const newStatus = updateData.approvalStatus || previousStatus;

      if (userId) {
        ActionLog.create({
          order_item_id: itemId,
          user_id: userId,
          action_type: 'status_update',
          action_by: actorRole,
          previous_status: previousStatus,
          new_status: newStatus,
          reason: null,
          notes: actionNotes.length > 0 
            ? `Dry Cleaning: ${actionNotes.join(' | ')} (by ${actorLabel})`
            : `Dry Cleaning: Updated (by ${actorLabel})`
        }, (logErr, logResult) => {
          if (logErr) {
            console.error('Error logging dry cleaning order action:', logErr);
            console.error('Log data:', {
              order_item_id: itemId,
              user_id: userId,
              action_type: 'status_update',
              previous_status: previousStatus,
              new_status: newStatus
            });
          } else {
            console.log('Successfully logged dry cleaning order action:', logResult?.insertId);
          }
        });
      } else {
        console.error('Skipping action log: user_id is null or undefined');
      }

      if (updateData.approvalStatus && (updateData.approvalStatus === 'cancelled' || updateData.approvalStatus === 'rejected')) {
        console.log(`[DRY CLEANING] Cancelling appointment slot for order item ${itemId} with status: ${updateData.approvalStatus}`);
        const AppointmentSlot = require('../model/AppointmentSlotModel');
        AppointmentSlot.cancelSlotByOrderItem(itemId, (slotErr, cancelResult) => {
          if (slotErr) {
            console.error('[DRY CLEANING] Error cancelling appointment slot:', slotErr);
          } else {
            console.log(`[DRY CLEANING] Appointment slot cancellation result for item ${itemId}:`, cancelResult?.affectedRows || 0, 'slots cancelled');
          }
        });
      }

      const billingHelper = require('../utils/billingHelper');
      if (updateData.approvalStatus && updateData.approvalStatus !== previousStatus) {
        const serviceType = (item.service_type || 'dry_cleaning').toLowerCase().trim();
        console.log(`[BILLING] ===== STARTING BILLING UPDATE FOR DRY CLEANING =====`);
        console.log(`[BILLING] Item ID: ${itemId}`);
        console.log(`[BILLING] Service Type: "${serviceType}" (from DB: "${item.service_type}")`);
        console.log(`[BILLING] New Status: "${updateData.approvalStatus}"`);
        console.log(`[BILLING] Previous Status: "${previousStatus}"`);
        
        billingHelper.updateBillingStatus(itemId, serviceType, updateData.approvalStatus, previousStatus, (billingErr, billingResult) => {
          if (billingErr) {
            console.error('[BILLING] ===== ERROR UPDATING BILLING STATUS FOR DRY CLEANING =====');
            console.error('[BILLING] Error details:', billingErr);
          } else if (billingResult) {
            console.log('[BILLING] ===== BILLING UPDATE SUCCESS FOR DRY CLEANING =====');
            console.log('[BILLING] Result:', JSON.stringify(billingResult, null, 2));
          } else {
            console.log('[BILLING] ===== NO BILLING UPDATE NEEDED FOR DRY CLEANING =====');
          }
        });
      }

      if (updateData.approvalStatus && updateData.approvalStatus !== previousStatus) {
        const Notification = require('../model/NotificationModel');
        const customerUserId = item.user_id; 
        
        if (customerUserId) {
          const serviceType = (item.service_type || 'dry_cleaning').toLowerCase().trim();

          if (updateData.approvalStatus === 'accepted') {
            Notification.createAcceptedNotification(customerUserId, itemId, serviceType, (notifErr) => {
              if (notifErr) {
                console.error('[NOTIFICATION] Failed to create accepted notification:', notifErr);
              } else {
                console.log('[NOTIFICATION] Accepted notification created successfully');
              }
            });

            try {
              const emailService = require('../services/emailService');
              const dbConn = require('../config/db');
              
              const getUserSql = `SELECT u.email, u.first_name, u.last_name FROM user u WHERE u.user_id = ?`;
              dbConn.query(getUserSql, [customerUserId], async (userErr, userResults) => {
                if (!userErr && userResults.length > 0) {
                  const user = userResults[0];
                  const specificData = item.specific_data ? 
                    (typeof item.specific_data === 'string' ? JSON.parse(item.specific_data) : item.specific_data) : {};
                  const itemName = specificData.garment_type || specificData.item_name || 'Dry Cleaning Item';
                  
                  await emailService.sendServiceStatusEmail({
                    userEmail: user.email,
                    userName: `${user.first_name} ${user.last_name}`,
                    serviceName: itemName,
                    serviceType: serviceType,
                    status: 'accepted',
                    orderId: itemId,
                    appointmentDate: item.appointment_date || null
                  });
                  console.log(`[EMAIL] Service status email sent to ${user.email} for status: accepted`);
                }
              });
            } catch (emailErr) {
              console.error('[EMAIL] Error sending service status email:', emailErr);
            }
          }

          if (updateData.approvalStatus === 'price_confirmation') {
            Notification.createStatusUpdateNotification(
              customerUserId,
              itemId,
              'price_confirmation',
              null,
              serviceType,
              (notifErr) => {
                if (notifErr) {
                  console.error('[NOTIFICATION] Failed to create price confirmation notification:', notifErr);
                } else {
                  console.log('[NOTIFICATION] Price confirmation notification created successfully');
                }
              }
            );

            try {
              const emailService = require('../services/emailService');
              const dbConn = require('../config/db');
              
              const getUserSql = `SELECT u.email, u.first_name, u.last_name FROM user u WHERE u.user_id = ?`;
              dbConn.query(getUserSql, [customerUserId], async (userErr, userResults) => {
                if (!userErr && userResults.length > 0) {
                  const user = userResults[0];
                  const specificData = item.specific_data ? 
                    (typeof item.specific_data === 'string' ? JSON.parse(item.specific_data) : item.specific_data) : {};
                  const itemName = specificData.garment_type || specificData.item_name || 'Dry Cleaning Item';
                  
                  await emailService.sendServiceStatusEmail({
                    userEmail: user.email,
                    userName: `${user.first_name} ${user.last_name}`,
                    serviceName: itemName,
                    serviceType: serviceType,
                    status: 'price_confirmation',
                    orderId: itemId,
                    message: updateData.adminNotes || null,
                    appointmentDate: item.appointment_date || null
                  });
                  console.log(`[EMAIL] Service status email sent to ${user.email} for status: price_confirmation`);
                }
              });
            } catch (emailErr) {
              console.error('[EMAIL] Error sending service status email:', emailErr);
            }
          }

          const statusNotificationStatuses = [
            'confirmed',
            'in_progress',
            'ready_for_pickup',
            'ready_to_pickup',
            'completed',
            'cancelled'
          ];
          
          if (statusNotificationStatuses.includes(updateData.approvalStatus)) {
            const statusForNotification = 
              updateData.approvalStatus === 'confirmed' ? 'in_progress' :
              updateData.approvalStatus === 'ready_for_pickup' ? 'ready_to_pickup' :
              updateData.approvalStatus === 'ready_to_pickup' ? 'ready_to_pickup' :
              updateData.approvalStatus;
            
            Notification.createStatusUpdateNotification(
              customerUserId,
              itemId,
              statusForNotification,
              null,
              serviceType,
              (notifErr) => {
                if (notifErr) {
                  console.error('[NOTIFICATION] Failed to create status update notification:', notifErr);
                } else {
                  console.log('[NOTIFICATION] Status update notification created successfully');
                }
              }
            );

            try {
              const emailService = require('../services/emailService');
              const dbConn = require('../config/db');
              
              const getUserSql = `SELECT u.email, u.first_name, u.last_name FROM user u WHERE u.user_id = ?`;
              dbConn.query(getUserSql, [customerUserId], async (userErr, userResults) => {
                if (!userErr && userResults.length > 0) {
                  const user = userResults[0];
                  const specificData = item.specific_data ? 
                    (typeof item.specific_data === 'string' ? JSON.parse(item.specific_data) : item.specific_data) : {};
                  const itemName = specificData.garment_type || specificData.item_name || 'Dry Cleaning Item';
                  
                  await emailService.sendServiceStatusEmail({
                    userEmail: user.email,
                    userName: `${user.first_name} ${user.last_name}`,
                    serviceName: itemName,
                    serviceType: serviceType,
                    status: statusForNotification,
                    orderId: itemId,
                    message: updateData.adminNotes || null,
                    appointmentDate: item.appointment_date || null
                  });
                  console.log(`[EMAIL] Service status email sent to ${user.email} for status: ${statusForNotification}`);
                }
              });
            } catch (emailErr) {
              console.error('[EMAIL] Error sending service status email:', emailErr);
            }
          }
        } else {
          console.error('[NOTIFICATION] Cannot create notification: customer user_id is missing');
        }
      }

      res.json({
        success: true,
        message: "Dry cleaning order item updated successfully"
      });
      });
    });
  });
};

exports.getRentalOrders = (req, res) => {
  
  if (req.user.role !== 'admin' && req.user.role !== 'clerk') {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only."
    });
  }

  Order.getRentalOrders((err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Database error",
        error: err
      });
    }

    const orders = results.map(item => ({
      ...item,
      pricing_factors: JSON.parse(item.pricing_factors || '{}'),
      specific_data: JSON.parse(item.specific_data || '{}')
    }));

    res.json({
      success: true,
      message: "Rental orders retrieved successfully",
      orders: orders
    });
  });
};

exports.getRentalOrdersByStatus = (req, res) => {
  const { status } = req.params;

  if (!status) {
    return res.status(400).json({
      success: false,
      message: "Status is required"
    });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'clerk') {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only."
    });
  }

  Order.getRentalOrdersByStatus(status, (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Database error",
        error: err
      });
    }

    const orders = results.map(item => ({
      ...item,
      pricing_factors: JSON.parse(item.pricing_factors || '{}'),
      specific_data: JSON.parse(item.specific_data || '{}')
    }));

    res.json({
      success: true,
      message: `Rental orders with status '${status}' retrieved successfully`,
      orders: orders
    });
  });
};

exports.updateRentalOrderItem = (req, res) => {
  const itemId = req.params.id;
  const { approvalStatus, adminNotes, damageNotes, finalPrice, paymentMode, flatRateUntilDate } = req.body;

  console.log("Controller - Updating rental order item:", itemId, req.body);

  if (req.user.role !== 'admin' && req.user.role !== 'clerk') {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only."
    });
  }

  const updateData = {
    approvalStatus: approvalStatus || undefined,
    adminNotes: adminNotes || undefined,
    damageNotes: damageNotes !== undefined ? damageNotes : undefined,
    finalPrice: finalPrice !== undefined && finalPrice !== null && finalPrice !== '' ? parseFloat(finalPrice) : undefined,
    paymentMode: paymentMode || undefined,
    flatRateUntilDate: flatRateUntilDate || undefined
  };

  if (updateData.finalPrice !== undefined && (Number.isNaN(updateData.finalPrice) || updateData.finalPrice <= 0)) {
    return res.status(400).json({
      success: false,
      message: "Final price must be a valid amount greater than 0"
    });
  }

  if (updateData.paymentMode !== undefined && !['regular', 'flat_rate'].includes(updateData.paymentMode)) {
    return res.status(400).json({
      success: false,
      message: "Invalid payment mode. Allowed values: regular, flat_rate"
    });
  }

  if (updateData.paymentMode === 'flat_rate') {
    if (!updateData.flatRateUntilDate) {
      return res.status(400).json({
        success: false,
        message: "Flat rate until date is required when payment mode is flat_rate"
      });
    }

    const parsed = new Date(updateData.flatRateUntilDate);
    const dateOnly = String(updateData.flatRateUntilDate);
    if (Number.isNaN(parsed.getTime()) || !/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
      return res.status(400).json({
        success: false,
        message: "Flat rate until date must be a valid calendar date"
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    parsed.setHours(0, 0, 0, 0);
    if (parsed < today) {
      return res.status(400).json({
        success: false,
        message: "Flat rate until date cannot be in the past"
      });
    }
  }

  if (updateData.paymentMode === 'regular') {
    updateData.flatRateUntilDate = null;
  }

  console.log("Controller - Processed updateData:", updateData);

  Object.keys(updateData).forEach(key => {
    if (updateData[key] === undefined) {
      delete updateData[key];
    }
  });

  console.log("Controller - Final updateData after cleanup:", updateData);

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({
      success: false,
      message: "At least one field to update is required"
    });
  }

  Order.getOrderItemById(itemId, (getErr, item) => {
    if (getErr || !item) {
      return res.status(500).json({
        success: false,
        message: "Error fetching order item",
        error: getErr
      });
    }

    const previousStatus = item.approval_status || 'pending';
    const previousPrice = parseFloat(item.final_price || 0);
    let previousPricingFactors = {};
    try {
      previousPricingFactors = item.pricing_factors
        ? (typeof item.pricing_factors === 'string' ? JSON.parse(item.pricing_factors) : item.pricing_factors)
        : {};
    } catch (e) {
      previousPricingFactors = {};
    }
    const previousPaymentMode = String(previousPricingFactors.rental_payment_mode || 'regular').toLowerCase();
    const previousFlatRateUntilDate = previousPricingFactors.flat_rate_until_date || null;

    let penaltyAmount = 0;
    let penaltyDays = 0;
    let penaltyDueDate = null;
    if (updateData.approvalStatus === 'returned' && previousStatus !== 'returned') {
      const penaltySnapshot = calculateDynamicPenalty(item, new Date());
      penaltyAmount = penaltySnapshot.penaltyAmount;
      penaltyDays = penaltySnapshot.penaltyDays;
      penaltyDueDate = penaltySnapshot.primaryDueDate || item.due_date || item.rental_end_date || null;

      if (penaltyAmount > 0 && penaltyDays > 0) {
        const today = new Date();
        const todayDate = today.toISOString().split('T')[0];
        console.log(
          `[RENTAL PENALTY] Item ${itemId}: Due date: ${penaltyDueDate || 'N/A'}, Today: ${todayDate}, Days exceeded: ${penaltyDays}, Penalty: ₱${penaltyAmount}`
        );

        const currentPricingFactors = item.pricing_factors
          ? (typeof item.pricing_factors === 'string' ? JSON.parse(item.pricing_factors) : item.pricing_factors)
          : {};
        currentPricingFactors.penalty = penaltyAmount;
        currentPricingFactors.penaltyDays = penaltyDays;
        currentPricingFactors.penaltyAppliedDate = todayDate;
        currentPricingFactors.overdue_rate = currentPricingFactors.overdue_rate || item.overdue_rate || null;
        if (penaltyDueDate) {
          currentPricingFactors.due_date = penaltyDueDate;
        }

        const originalPrice = parseFloat(item.final_price || 0);
        const newFinalPrice = originalPrice + penaltyAmount;

        updateData.finalPrice = newFinalPrice;
        updateData.penaltyData = currentPricingFactors;

        console.log(
          `[RENTAL PENALTY] Original price: ₱${originalPrice}, Penalty: ₱${penaltyAmount}, New final price: ₱${newFinalPrice}`
        );

        try {
          const emailService = require('../services/emailService');
          const db = require('../config/db');

          const getUserSql = `SELECT u.email, u.first_name, u.last_name FROM user u JOIN orders o ON u.user_id = o.user_id WHERE o.order_id = ?`;
          db.query(getUserSql, [item.order_id], async (userErr, userResults) => {
            if (!userErr && userResults.length > 0) {
              const user = userResults[0];
              const itemName = item.specific_data
                ? (typeof item.specific_data === 'string' ? JSON.parse(item.specific_data) : item.specific_data).item_name || 'Rental Item'
                : 'Rental Item';

              await emailService.sendPenaltyChargeEmail({
                userEmail: user.email,
                userName: `${user.first_name} ${user.last_name}`,
                itemName: itemName,
                rentalEndDate: penaltyDueDate,
                returnDate: todayDate,
                daysOverdue: penaltyDays,
                penaltyAmount: penaltyAmount,
                originalPrice: originalPrice,
                totalAmount: newFinalPrice,
                itemId: itemId
              });
              console.log(`[RENTAL PENALTY] Penalty email sent to ${user.email}`);
            }
          });
        } catch (emailErr) {
          console.error('[RENTAL PENALTY] Error sending penalty email:', emailErr);
        }
      } else {
        console.log(`[RENTAL PENALTY] Item ${itemId}: Returned on time, no penalty applied`);
      }
    }

    Order.updateRentalOrderItem(itemId, updateData, (err, result) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Error updating rental order item",
          error: err
        });
      }

      console.log(`[RENTAL UPDATE] Database update completed for item ${itemId}, affectedRows: ${result?.affectedRows}`);

      const ActionLog = require('../model/ActionLogModel');
      
      const userId = req.user?.id || item.user_id || null;
      const actorRole = req.user?.role === 'clerk' ? 'clerk' : 'admin';
      const actorLabel = req.user?.username || actorRole;
      
      if (!userId) {
        console.error('Cannot log action: user_id is missing. req.user:', req.user, 'item.user_id:', item.user_id);
      }

      const formatStatus = (status) => {
        const statusMap = {
          'pending_review': 'Pending Review',
          'pending': 'Pending',
          'accepted': 'Accepted',
          'price_confirmation': 'Price Confirmation',
          'confirmed': 'In Progress',
          'ready_for_pickup': 'Ready for Pickup',
          'completed': 'Completed',
          'cancelled': 'Cancelled',
          'rented': 'Rented',
          'returned': 'Returned'
        };
        return statusMap[status] || status;
      };
      
      let actionNotes = [];
      
      if (updateData.approvalStatus && updateData.approvalStatus !== previousStatus) {
        actionNotes.push(formatStatus(updateData.approvalStatus));
      }
      if (updateData.finalPrice !== undefined && Math.abs(updateData.finalPrice - previousPrice) > 0.01) {
        actionNotes.push(`Price: ₱${previousPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} → ₱${updateData.finalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      }
      if (updateData.paymentMode && updateData.paymentMode !== previousPaymentMode) {
        actionNotes.push(`Payment Mode: ${updateData.paymentMode === 'flat_rate' ? 'Flat Rate' : 'Regular'}`);
      }
      if (updateData.flatRateUntilDate !== undefined && updateData.flatRateUntilDate !== previousFlatRateUntilDate) {
        actionNotes.push(`Flat Rate Until: ${updateData.flatRateUntilDate || 'Cleared'}`);
      }
      if (penaltyAmount > 0 && penaltyDays > 0) {
        actionNotes.push(`Penalty: ₱${penaltyAmount} (${penaltyDays} day${penaltyDays > 1 ? 's' : ''})`);
      }
      if (updateData.adminNotes) {
        actionNotes.push(`Notes: ${updateData.adminNotes}`);
      }

      const newStatus = updateData.approvalStatus || previousStatus;

      if (userId) {
        ActionLog.create({
          order_item_id: itemId,
          user_id: userId,
          action_type: 'status_update',
          action_by: actorRole,
          previous_status: previousStatus,
          new_status: newStatus,
          reason: null,
          notes: actionNotes.length > 0 
            ? `Rental: ${actionNotes.join(' | ')} (by ${actorLabel})`
            : `Rental: Updated (by ${actorLabel})`
        }, (logErr, logResult) => {
          if (logErr) {
            console.error('Error logging rental order action:', logErr);
            console.error('Log data:', {
              order_item_id: itemId,
              user_id: userId,
              action_type: 'status_update',
              previous_status: previousStatus,
              new_status: newStatus
            });
          } else {
            console.log('Successfully logged rental order action:', logResult?.insertId);
          }
        });
      } else {
        console.error('Skipping action log: user_id is null or undefined');
      }

      const billingHelper = require('../utils/billingHelper');
      if (updateData.approvalStatus && updateData.approvalStatus !== previousStatus) {
        const serviceType = (item.service_type || 'rental').toLowerCase().trim();
        console.log(`[BILLING] ===== STARTING BILLING UPDATE =====`);
        console.log(`[BILLING] Item ID: ${itemId}`);
        console.log(`[BILLING] Service Type: "${serviceType}" (from DB: "${item.service_type}")`);
        console.log(`[BILLING] New Status: "${updateData.approvalStatus}"`);
        console.log(`[BILLING] Previous Status: "${previousStatus}"`);
        console.log(`[BILLING] Status Changed: ${updateData.approvalStatus !== previousStatus}`);
        
        billingHelper.updateBillingStatus(itemId, serviceType, updateData.approvalStatus, previousStatus, (billingErr, billingResult) => {
          if (billingErr) {
            console.error('[BILLING] ===== ERROR UPDATING BILLING STATUS =====');
            console.error('[BILLING] Error details:', billingErr);
            console.error('[BILLING] Error message:', billingErr.message);
            console.error('[BILLING] Error stack:', billingErr.stack);
          } else if (billingResult) {
            console.log('[BILLING] ===== BILLING UPDATE SUCCESS =====');
            console.log('[BILLING] Result:', JSON.stringify(billingResult, null, 2));
          } else {
            console.log('[BILLING] ===== NO BILLING UPDATE NEEDED =====');
            console.log('[BILLING] Status change did not require payment update');
          }
        });
      } else {
        console.log(`[BILLING] ===== SKIPPING BILLING UPDATE =====`);
        console.log(`[BILLING] approvalStatus: ${updateData.approvalStatus}`);
        console.log(`[BILLING] previousStatus: ${previousStatus}`);
        console.log(`[BILLING] statusChanged: ${updateData.approvalStatus && updateData.approvalStatus !== previousStatus}`);
      }

      // Restore inventory when rental is cancelled/rejected
      if (updateData.approvalStatus === 'cancelled' && updateData.approvalStatus !== previousStatus) {
        const RentalInventory = require('../model/RentalInventoryModel');
        const db = require('../config/db');

        let specificData = {};
        try {
          specificData = item.specific_data ? (typeof item.specific_data === 'string' ? JSON.parse(item.specific_data) : item.specific_data) : {};
        } catch (e) {
          console.warn('Error parsing specific_data for cancelled rental:', e);
        }

        const selectedSizes = specificData.selected_sizes || specificData.selectedSizes || [];
        const isBundle = specificData.is_bundle === true || specificData.category === 'rental_bundle';
        const bundleItems = specificData.bundle_items || [];

        if (isBundle && bundleItems.length > 0) {
          console.log(`[INVENTORY RESTORE] Restoring inventory for cancelled bundle rental, item ${itemId}`);
          bundleItems.forEach(bundleItem => {
            const itemId = bundleItem.item_id || bundleItem.id;
            const itemSelectedSizes = bundleItem.selected_sizes || bundleItem.selectedSizes || [];
            if (itemId && itemSelectedSizes.length > 0) {
              RentalInventory.restockReturnedSizes(itemId, itemSelectedSizes, (restockErr) => {
                if (restockErr) {
                  console.error(`[INVENTORY RESTORE] Error restocking bundle item ${itemId}:`, restockErr);
                } else {
                  console.log(`[INVENTORY RESTORE] Successfully restocked bundle item ${itemId}`);
                }
              });
            }
          });
        } else if (selectedSizes.length > 0) {
          const rentalItemId = item.service_id || specificData.rental_item_id;
          if (rentalItemId) {
            console.log(`[INVENTORY RESTORE] Restoring inventory for cancelled rental, item ${rentalItemId}`);
            RentalInventory.restockReturnedSizes(rentalItemId, selectedSizes, (restockErr) => {
              if (restockErr) {
                console.error(`[INVENTORY RESTORE] Error restocking rental item ${rentalItemId}:`, restockErr);
              } else {
                console.log(`[INVENTORY RESTORE] Successfully restocked rental item ${rentalItemId}`);
              }
            });
          }
        }
      }

      if (updateData.approvalStatus === 'rented' && updateData.approvalStatus !== previousStatus) {
        const RentalInventory = require('../model/RentalInventoryModel');
        const db = require('../config/db');

        let specificData = {};
        try {
          specificData = item.specific_data ? (typeof item.specific_data === 'string' ? JSON.parse(item.specific_data) : item.specific_data) : {};
        } catch (e) {
          console.warn('Error parsing specific_data:', e);
        }
        
        const isBundle = specificData.is_bundle === true || specificData.category === 'rental_bundle';
        const bundleItems = specificData.bundle_items || [];
        
        const updateInventoryStatusSmart = (rentalItemId, itemName) => {
          // Get all active order reservations for this item
          const reservedSql = `
            SELECT specific_data FROM order_items
            WHERE service_type = 'rental'
              AND service_id = ?
              AND approval_status IN ('pending','ready_to_pickup','picked_up','rented')
          `;
          db.query(reservedSql, [rentalItemId], (resErr, resRows) => {
            const reservedBySizeKey = {};
            if (!resErr) {
              (resRows || []).forEach(row => {
                try {
                  const sd = typeof row.specific_data === 'string' ? JSON.parse(row.specific_data) : row.specific_data;
                  (sd?.selected_sizes || []).forEach(s => {
                    const k = s.sizeKey || s.size_key;
                    if (k) reservedBySizeKey[k] = (reservedBySizeKey[k] || 0) + (parseInt(s.quantity, 10) || 0);
                  });
                } catch (e) {}
              });
            }

            db.query(`SELECT size FROM rental_inventory WHERE item_id = ? LIMIT 1`, [rentalItemId], (fetchErr, fetchRows) => {
              if (fetchErr || !fetchRows || fetchRows.length === 0) return;
              let newStatus = 'rented';
              try {
                const parsed = typeof fetchRows[0].size === 'string' ? JSON.parse(fetchRows[0].size) : fetchRows[0].size;
                if (parsed && Array.isArray(parsed.size_entries)) {
                  const hasStock = parsed.size_entries.some(entry => {
                    const total = Math.max(0, parseInt(entry.quantity, 10) || 0);
                    const reserved = reservedBySizeKey[entry.sizeKey] || 0;
                    return (total - reserved) > 0;
                  });
                  newStatus = hasStock ? 'available' : 'rented';
                }
              } catch (e) {}
              db.query(`UPDATE rental_inventory SET status = ? WHERE item_id = ?`, [newStatus, rentalItemId], (updateErr) => {
                if (updateErr) console.error(`Error updating rental_inventory status for item ${rentalItemId}:`, updateErr);
                else console.log(`Updated rental_inventory status to '${newStatus}' for item ${itemName || rentalItemId}`);
              });
            });
          });
        };

        if (isBundle && bundleItems.length > 0) {
          console.log(`Updating rental_inventory status for ${bundleItems.length} bundle items`);
          for (const bundleItem of bundleItems) {
            const bundleItemId = bundleItem.item_id || bundleItem.id;
            if (bundleItemId) updateInventoryStatusSmart(bundleItemId, bundleItem.item_name);
          }
        } else {
          const rentalItemId = item.service_id;
          if (rentalItemId) {
            updateInventoryStatusSmart(rentalItemId, null);
          } else {
            console.warn('Cannot update rental_inventory: service_id is missing from order item');
          }
        }
      }

      const shouldIncrementRentalCounts = updateData.approvalStatus === 'returned' && updateData.approvalStatus !== previousStatus;

      if (shouldIncrementRentalCounts) {
        const RentalInventory = require('../model/RentalInventoryModel');
        const rentalItemId = item.service_id;

        let specificData = {};
        try {
          specificData = item.specific_data ? (typeof item.specific_data === 'string' ? JSON.parse(item.specific_data) : item.specific_data) : {};
        } catch (e) {
          console.warn('Error parsing specific_data:', e);
        }

        const isBundle = specificData.is_bundle === true || specificData.category === 'rental_bundle';

        const getSelectionQty = (selectedSizes, fallbackQty = 1) => {
          const normalized = Array.isArray(selectedSizes) ? selectedSizes : [];
          const fromSizes = normalized.reduce((sum, entry) => {
            return sum + Math.max(0, parseInt(entry?.quantity, 10) || 0);
          }, 0);
          return fromSizes > 0 ? fromSizes : Math.max(1, parseInt(fallbackQty, 10) || 1);
        };

        const normalizeSelectionKey = (entry = {}) => {
          const directKey = String(entry?.sizeKey || entry?.size_key || entry?.size || entry?.size_label || '').trim();
          if (directKey) return directKey;

          const rawLabel = String(entry?.label || '').trim().toLowerCase();
          if (!rawLabel) return '';
          if (rawLabel === 's' || rawLabel.includes('small')) return 'small';
          if (rawLabel === 'm' || rawLabel.includes('medium')) return 'medium';
          if (rawLabel === 'l' || rawLabel.includes('large')) return 'large';
          if (rawLabel === 'xl' || rawLabel.includes('extra')) return 'extra_large';
          return rawLabel;
        };

        const getNormalizedSelectedSizes = (selectedSizes) => {
          const normalized = Array.isArray(selectedSizes) ? selectedSizes : [];
          return normalized
            .map((entry) => ({
              sizeKey: normalizeSelectionKey(entry),
              quantity: Math.max(1, parseInt(entry?.quantity, 10) || 1)
            }))
            .filter((entry) => !!entry.sizeKey);
        };

        if (isBundle) {
          const bundleItems = Array.isArray(specificData.bundle_items) ? specificData.bundle_items : [];
          bundleItems.forEach((bundleItem) => {
            const bundleItemId = parseInt(bundleItem?.item_id || bundleItem?.id, 10);
            if (!bundleItemId) return;

            const qty = getSelectionQty(
              bundleItem?.selected_sizes || bundleItem?.selectedSizes,
              bundleItem?.quantity
            );

            RentalInventory.incrementTimesRented(bundleItemId, qty, (countErr) => {
              if (countErr) {
                console.error(`[RENTAL COUNT] Failed to increment times_rented for bundle item ${bundleItemId}:`, countErr);
              } else {
                console.log(`[RENTAL COUNT] Incremented times_rented by ${qty} for bundle item ${bundleItemId}`);
              }
            });

            const selectedSizes = getNormalizedSelectedSizes(bundleItem?.selected_sizes || bundleItem?.selectedSizes);
            if (selectedSizes.length > 0) {
              RentalInventory.incrementSizeRentalCounts(bundleItemId, selectedSizes, (sizeCountErr) => {
                if (sizeCountErr) {
                  console.error(`[RENTAL COUNT] Failed to increment size_rental_counts for bundle item ${bundleItemId}:`, sizeCountErr);
                } else {
                  console.log(`[RENTAL COUNT] Incremented size_rental_counts for bundle item ${bundleItemId}`);
                }
              });
            }
          });
        } else if (rentalItemId) {
          const qty = getSelectionQty(
            specificData?.selected_sizes || specificData?.selectedSizes,
            item.quantity
          );

          RentalInventory.incrementTimesRented(rentalItemId, qty, (countErr) => {
            if (countErr) {
              console.error(`[RENTAL COUNT] Failed to increment times_rented for item ${rentalItemId}:`, countErr);
            } else {
              console.log(`[RENTAL COUNT] Incremented times_rented by ${qty} for item ${rentalItemId}`);
            }
          });

          const selectedSizes = getNormalizedSelectedSizes(specificData?.selected_sizes || specificData?.selectedSizes);
          if (selectedSizes.length > 0) {
            RentalInventory.incrementSizeRentalCounts(rentalItemId, selectedSizes, (sizeCountErr) => {
              if (sizeCountErr) {
                console.error(`[RENTAL COUNT] Failed to increment size_rental_counts for item ${rentalItemId}:`, sizeCountErr);
              } else {
                console.log(`[RENTAL COUNT] Incremented size_rental_counts for item ${rentalItemId}`);
              }
            });
          }
        }
      }

      const isStatusChangedToReturned = updateData.approvalStatus === 'returned' && updateData.approvalStatus !== previousStatus;
      const isReturnedAndDamageNotesUpdated = previousStatus === 'returned' && damageNotes !== undefined;
      
      if (isStatusChangedToReturned || isReturnedAndDamageNotesUpdated) {
        const RentalInventory = require('../model/RentalInventoryModel');
        const rentalItemId = item.service_id; 

        let specificData = {};
        try {
          specificData = item.specific_data ? (typeof item.specific_data === 'string' ? JSON.parse(item.specific_data) : item.specific_data) : {};
        } catch (e) {
          console.warn('Error parsing specific_data:', e);
        }
        
        const isBundle = specificData.is_bundle === true || specificData.category === 'rental_bundle';

        if (isStatusChangedToReturned) {
          console.log(`[RENTAL REFUND] Item ${itemId} marked as returned. Deposit return must be recorded manually from Rental Orders.`);
        }
        
        if (isBundle) {
          console.log('Skipping rental_inventory update for bundled rental - frontend will handle individual items');
        } else if (rentalItemId) {

          const hasDamage = damageNotes && typeof damageNotes === 'string' && damageNotes.trim().length > 0;
          const newInventoryStatus = hasDamage ? 'maintenance' : 'available';
          const customerName = item.first_name && item.last_name ? `${item.first_name} ${item.last_name}` : null;
          console.log(`Updating rental_inventory status to '${newInventoryStatus}' for item_id: ${rentalItemId}${hasDamage ? ` (damaged by: ${customerName})` : ' (no damage)'}`);

          const db = require('../config/db');
          const updateSql = hasDamage 
            ? `UPDATE rental_inventory SET status = ?, damage_notes = ?, damaged_by = ? WHERE item_id = ?`
            : `UPDATE rental_inventory SET status = ?, damage_notes = NULL, damaged_by = NULL WHERE item_id = ?`;
          
          const updateParams = hasDamage 
            ? [newInventoryStatus, damageNotes.trim(), customerName, rentalItemId]
            : [newInventoryStatus, rentalItemId];
          
          db.query(updateSql, updateParams, (rentalUpdateErr, rentalUpdateResult) => {
            if (rentalUpdateErr) {
              console.error('Error updating rental_inventory status:', rentalUpdateErr);
            } else {
              console.log(`Successfully updated rental_inventory status to '${newInventoryStatus}' for item_id: ${rentalItemId}${hasDamage ? ` with damage notes: "${damageNotes.trim()}" (damaged by: ${customerName})` : ''}`);
            }
          });
        } else {
          console.warn('Cannot update rental_inventory: service_id is missing from order item');
        }
      }

      if (updateData.approvalStatus && updateData.approvalStatus !== previousStatus) {
        const Notification = require('../model/NotificationModel');
        const customerUserId = item.user_id; 
        
        if (customerUserId) {
          const serviceType = (item.service_type || 'rental').toLowerCase().trim();

          if (updateData.approvalStatus === 'accepted') {
            Notification.createAcceptedNotification(customerUserId, itemId, serviceType, (notifErr) => {
              if (notifErr) {
                console.error('[NOTIFICATION] Failed to create accepted notification:', notifErr);
              } else {
                console.log('[NOTIFICATION] Accepted notification created successfully');
              }
            });

            try {
              const emailService = require('../services/emailService');
              const dbConn = require('../config/db');
              
              const getUserSql = `SELECT u.email, u.first_name, u.last_name FROM user u WHERE u.user_id = ?`;
              dbConn.query(getUserSql, [customerUserId], async (userErr, userResults) => {
                if (!userErr && userResults.length > 0) {
                  const user = userResults[0];
                  const specificData = item.specific_data ? 
                    (typeof item.specific_data === 'string' ? JSON.parse(item.specific_data) : item.specific_data) : {};
                  const itemName = specificData.item_name || 'Rental Item';
                  
                  await emailService.sendServiceStatusEmail({
                    userEmail: user.email,
                    userName: `${user.first_name} ${user.last_name}`,
                    serviceName: itemName,
                    serviceType: serviceType,
                    status: 'accepted',
                    orderId: itemId,
                    appointmentDate: item.rental_start_date || null
                  });
                  console.log(`[EMAIL] Service status email sent to ${user.email} for status: accepted`);
                }
              });
            } catch (emailErr) {
              console.error('[EMAIL] Error sending service status email:', emailErr);
            }
          }

          const statusNotificationStatuses = [
            'confirmed',
            'in_progress',
            'ready_for_pickup',
            'ready_to_pickup',
            'rented',
            'picked_up',
            'returned',
            'completed',
            'cancelled'
          ];
          
          if (statusNotificationStatuses.includes(updateData.approvalStatus)) {
            const statusForNotification = 
              updateData.approvalStatus === 'confirmed' ? 'in_progress' :
              updateData.approvalStatus === 'ready_for_pickup' ? 'ready_to_pickup' :
              updateData.approvalStatus === 'ready_to_pickup' ? 'ready_to_pickup' :
              updateData.approvalStatus;
            
            Notification.createStatusUpdateNotification(
              customerUserId,
              itemId,
              statusForNotification,
              null,
              serviceType,
              (notifErr) => {
                if (notifErr) {
                  console.error('[NOTIFICATION] Failed to create status update notification:', notifErr);
                } else {
                  console.log('[NOTIFICATION] Status update notification created successfully');
                }
              }
            );

            try {
              const emailService = require('../services/emailService');
              const dbConn = require('../config/db');

              const getUserSql = `SELECT u.email, u.first_name, u.last_name FROM user u WHERE u.user_id = ?`;
              dbConn.query(getUserSql, [customerUserId], async (userErr, userResults) => {
                if (!userErr && userResults.length > 0) {
                  const user = userResults[0];
                  const specificData = item.specific_data ? 
                    (typeof item.specific_data === 'string' ? JSON.parse(item.specific_data) : item.specific_data) : {};
                  const itemName = specificData.item_name || 'Rental Item';
                  
                  await emailService.sendServiceStatusEmail({
                    userEmail: user.email,
                    userName: `${user.first_name} ${user.last_name}`,
                    serviceName: itemName,
                    serviceType: serviceType,
                    status: statusForNotification,
                    orderId: itemId,
                    message: updateData.adminNotes || null,
                    appointmentDate: item.rental_start_date || null
                  });
                  console.log(`[EMAIL] Service status email sent to ${user.email} for status: ${statusForNotification}`);
                }
              });
            } catch (emailErr) {
              console.error('[EMAIL] Error sending service status email:', emailErr);
            }
          }
        } else {
          console.error('[NOTIFICATION] Cannot create notification: customer user_id is missing');
        }
      }

      res.json({
        success: true,
        message: "Rental order item updated successfully"
      });
    });
  });
};

exports.recordRentalPayment = (req, res) => {
  const itemId = req.params.id;
  const { paymentAmount, cashReceived, paymentMethod, paymentKind } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'clerk') {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only."
    });
  }

  const amount = parseFloat(paymentAmount);
  if (!amount || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid payment amount. Amount must be greater than 0."
    });
  }

  const cashTenderedRaw = cashReceived !== undefined && cashReceived !== null && cashReceived !== ''
    ? cashReceived
    : paymentAmount;
  const cashTendered = parseFloat(cashTenderedRaw);

  if (!cashTendered || cashTendered <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid cash received. Cash received must be greater than 0."
    });
  }

  if (cashTendered < amount) {
    return res.status(400).json({
      success: false,
      message: `Cash received (₱${cashTendered.toFixed(2)}) cannot be less than payment amount (₱${amount.toFixed(2)}).`
    });
  }

  Order.getOrderItemById(itemId, (getErr, item) => {
    if (getErr || !item) {
      return res.status(404).json({
        success: false,
        message: "Order item not found"
      });
    }

    let pricingFactors = {};
    try {
      pricingFactors = item.pricing_factors ? JSON.parse(item.pricing_factors) : {};
    } catch (e) {
      console.error('Error parsing pricing_factors:', e);
    }

    const currentAmountPaid = parseFloat(pricingFactors.amount_paid || 0);
    const finalPrice = parseFloat(item.final_price || 0);
    
    // Calculate deposit from selected_sizes
    let specificData = {};
    try {
      specificData = item.specific_data ? JSON.parse(item.specific_data) : {};
    } catch (e) {
      console.error('Error parsing specific_data:', e);
    }
    const selectedSizes = specificData.selected_sizes || specificData.selectedSizes || [];
    const depositFromSizes = selectedSizes.reduce((total, size) => {
      const quantity = parseInt(size.quantity || 0, 10);
      const deposit = parseFloat(size.deposit || 0);
      return total + (quantity * deposit);
    }, 0);
    const depositAmount = depositFromSizes > 0 ? depositFromSizes : parseFloat(pricingFactors.downpayment || specificData.downpayment || 0);

    const basePaymentRequired = finalPrice + depositAmount;
    const serviceType = (item.service_type || '').toLowerCase().trim();
    const penaltySnapshot = serviceType === 'rental' ? calculateDynamicPenalty(item, new Date()) : { penaltyAmount: 0 };
    const totalOverdueDueNow = Math.max(0, parseFloat(penaltySnapshot.penaltyAmount || 0));
    const overduePaidSoFar = Math.max(0, parseFloat(pricingFactors.overdue_paid || 0));
    const paymentRecordedAtIso = new Date().toISOString();
    const isOverduePayment = String(paymentKind || '').toLowerCase().trim() === 'overdue';

    let effectiveOverdueTotalDue = totalOverdueDueNow;
    if (serviceType === 'rental' && isOverduePayment && effectiveOverdueTotalDue <= 0) {
      const persistedOverdueDue = Math.max(0, parseFloat(pricingFactors.overdue_total_due || 0));
      // Manual overdue payments (including demo-assisted flows) should still be traceable for customer tracking.
      effectiveOverdueTotalDue = Math.max(persistedOverdueDue, overduePaidSoFar + amount, amount);
    }

    const outstandingOverdue = Math.max(0, effectiveOverdueTotalDue - overduePaidSoFar);
    const totalPaymentRequired = basePaymentRequired + outstandingOverdue;

    const newAmountPaid = currentAmountPaid + amount;
    const baseOutstandingBeforePayment = Math.max(0, basePaymentRequired - currentAmountPaid);
    const paymentTowardOverdue = isOverduePayment
      ? amount
      : Math.max(0, amount - baseOutstandingBeforePayment);
    const updatedOverduePaid = Math.min(effectiveOverdueTotalDue, overduePaidSoFar + paymentTowardOverdue);
    const overdueRemaining = Math.max(0, effectiveOverdueTotalDue - updatedOverduePaid);
    const remainingBalance = totalPaymentRequired - newAmountPaid;
    const changeAmount = cashTendered - amount;

    if (!isOverduePayment && newAmountPaid > totalPaymentRequired) {
      return res.status(400).json({
        success: false,
        message: `Payment amount exceeds total payment required. Rental: ₱${finalPrice.toFixed(2)}, Deposit: ₱${depositAmount.toFixed(2)}, Overdue Due: ₱${outstandingOverdue.toFixed(2)}, Total: ₱${totalPaymentRequired.toFixed(2)}, Already paid: ₱${currentAmountPaid.toFixed(2)}, Remaining: ₱${(totalPaymentRequired - currentAmountPaid).toFixed(2)}`
      });
    }

    pricingFactors.amount_paid = newAmountPaid.toString();
    pricingFactors.remaining_balance = Math.max(0, remainingBalance).toString();
    if (serviceType === 'rental') {
      pricingFactors.overdue_total_due = effectiveOverdueTotalDue.toString();
      pricingFactors.overdue_paid = updatedOverduePaid.toString();
      pricingFactors.overdue_remaining = overdueRemaining.toString();
      pricingFactors.penalty = effectiveOverdueTotalDue;
      pricingFactors.penaltyDays = penaltySnapshot.penaltyDays || (isOverduePayment ? 1 : 0);
      pricingFactors.penaltyDueDate = penaltySnapshot.primaryDueDate || null;
      pricingFactors.penaltyLastUpdatedAt = paymentRecordedAtIso;
      if (isOverduePayment) {
        pricingFactors.overdue_last_payment_amount = amount.toFixed(2);
        pricingFactors.overdue_last_payment_at = paymentRecordedAtIso;
        pricingFactors.overdue_last_payment_method = paymentMethod || 'cash';
        const paymentEvents = Array.isArray(pricingFactors.overdue_payment_events)
          ? pricingFactors.overdue_payment_events
          : [];
        paymentEvents.push({
          amount: parseFloat(amount.toFixed(2)),
          recorded_at: paymentRecordedAtIso,
          method: paymentMethod || 'cash'
        });
        pricingFactors.overdue_payment_events = paymentEvents.slice(-10);
      }
    }

    let newPaymentStatus = item.payment_status || 'unpaid';
    
    if (newAmountPaid >= totalPaymentRequired || isOverduePayment) {
      newPaymentStatus = serviceType === 'rental' ? 'fully_paid' : 'paid';
    } else if (newAmountPaid > 0) {
      if (serviceType === 'rental') {
        const totalRequired = finalPrice + depositAmount;
        if (newAmountPaid >= totalRequired) {
          newPaymentStatus = 'fully_paid';
        } else {
          newPaymentStatus = 'partial_payment';
        }
      } else {
        newPaymentStatus = 'partial_payment';
      }
    }

    const db = require('../config/db');
    const updateSql = `
      UPDATE order_items 
      SET 
        pricing_factors = ?,
        payment_status = ?
      WHERE item_id = ?
    `;

    db.query(updateSql, [JSON.stringify(pricingFactors), newPaymentStatus, itemId], (updateErr, updateResult) => {
      if (updateErr) {
        return res.status(500).json({
          success: false,
          message: "Error recording payment",
          error: updateErr
        });
      }

      const getCustomerSql = `
        SELECT 
          COALESCE(
            NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''),
            wc.name,
            'Customer'
          ) AS customer_name
        FROM orders o
        LEFT JOIN user u ON o.user_id = u.user_id
        LEFT JOIN walk_in_customers wc ON o.walk_in_customer_id = wc.id
        WHERE o.order_id = ?
        LIMIT 1
      `;
      db.query(getCustomerSql, [item.order_id], (userErr, userResults) => {
        const customerName = userResults && userResults.length > 0 && userResults[0].customer_name
          ? userResults[0].customer_name
          : 'Customer';
        const logUserId = item.user_id || req.user?.id || null;

        if (!logUserId) {
          console.error('[TRANSACTION LOG] Cannot create payment logs: both customer user_id and actor user_id are missing');
        }

      const ActionLog = require('../model/ActionLogModel');
      const previousPaymentStatus = item.payment_status || 'unpaid';
      const actorName = req.user?.username || `${req.user?.first_name || ''} ${req.user?.last_name || ''}`.trim() || req.user?.role || 'admin';
      if (logUserId) {
        ActionLog.create({
          order_item_id: itemId,
          user_id: logUserId,
          action_type: 'payment',
          action_by: actorName,
          previous_status: previousPaymentStatus,
          new_status: newPaymentStatus,
          reason: null,
          notes: `${actorName} recorded payment of ₱${amount.toFixed(2)}. Total paid: ₱${newAmountPaid.toFixed(2)} of ₱${finalPrice.toFixed(2)}.`
        }, (actionLogErr) => {
          if (actionLogErr) {
            console.error('Error creating payment action log:', actionLogErr);
          } else {
            console.log('Payment action log created successfully');
          }
        });
      }

      const TransactionLog = require('../model/TransactionLogModel');
      const transactionType = isOverduePayment
              ? 'overdue_payment'
              : newPaymentStatus === 'down-payment' ? 'downpayment' : 
                              (newPaymentStatus === 'paid' || newPaymentStatus === 'fully_paid') ? 'final_payment' : 'partial_payment';
      
      if (logUserId) {
        TransactionLog.create({
          order_item_id: itemId,
          user_id: logUserId,
          transaction_type: transactionType,
          amount: amount,
          previous_payment_status: previousPaymentStatus,
          new_payment_status: newPaymentStatus,
          payment_method: paymentMethod || 'cash',
          notes: `${actorName} recorded ${isOverduePayment ? 'overdue payment' : 'payment'} of ₱${amount.toFixed(2)}. Total paid: ₱${newAmountPaid.toFixed(2)} of ₱${finalPrice.toFixed(2)}. Cash received: ₱${cashTendered.toFixed(2)}. Change: ₱${changeAmount.toFixed(2)}. Method: ${paymentMethod || 'cash'}. Customer: ${customerName}`,
          created_by: actorName
        }, (transLogErr, transLogResult) => {
          if (transLogErr) {
            console.error('[TRANSACTION LOG] Error creating transaction log:', transLogErr);
          } else {
            console.log(`[TRANSACTION LOG] Created: ${transactionType} - ₱${amount.toFixed(2)} for item ${itemId}`);
          }
        });
      }
      });

      if (item.user_id) {
        const Notification = require('../model/NotificationModel');
        const serviceType = (item.service_type || 'rental').toLowerCase().trim();
        Notification.createPaymentSuccessNotification(
          item.user_id,
          itemId,
          amount,
          paymentMethod || 'cash',
          serviceType,
          (notifErr) => {
            if (notifErr) {
              console.error('[NOTIFICATION] Failed to create payment success notification:', notifErr);
            } else {
              console.log('[NOTIFICATION] Payment success notification created');
            }
          }
        );
      }

      res.json({
        success: true,
        message: "Payment recorded successfully",
        payment: {
          amount_paid: newAmountPaid,
          remaining_balance: Math.max(0, remainingBalance),
          cash_received: cashTendered,
          change_amount: Math.max(0, changeAmount),
          payment_status: newPaymentStatus,
          total_price: finalPrice
        }
      });
    });
  });
};

exports.recordRentalDepositReturn = (req, res) => {
  const itemId = req.params.id;
  const { refundAmount, damagedSizes } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'clerk') {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only."
    });
  }

  const amount = parseFloat(refundAmount);
  if (!amount || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid refund amount. Amount must be greater than 0."
    });
  }

  Order.getOrderItemById(itemId, (getErr, item) => {
    if (getErr || !item) {
      return res.status(404).json({
        success: false,
        message: "Order item not found"
      });
    }

    if ((item.service_type || '').toLowerCase().trim() !== 'rental') {
      return res.status(400).json({
        success: false,
        message: "Deposit return can only be recorded for rental orders."
      });
    }

    let pricingFactors = {};
    let specificData = {};
    try {
      pricingFactors = item.pricing_factors ? JSON.parse(item.pricing_factors) : {};
    } catch (e) {
      console.error('Error parsing pricing_factors:', e);
      pricingFactors = {};
    }

    try {
      specificData = item.specific_data ? JSON.parse(item.specific_data) : {};
    } catch (e) {
      console.error('Error parsing specific_data:', e);
      specificData = {};
    }

    // Calculate deposit from selected_sizes
    const selectedSizes = specificData.selected_sizes || specificData.selectedSizes || [];
    const depositFromSizes = selectedSizes.reduce((total, size) => {
      const quantity = parseInt(size.quantity || 0, 10);
      const deposit = parseFloat(size.deposit || 0);
      return total + (quantity * deposit);
    }, 0);
    const depositAmount = Math.max(0, depositFromSizes > 0 ? depositFromSizes : parseFloat(
      pricingFactors.downpayment || pricingFactors.deposit_amount || specificData.downpayment || 0
    ));
    const currentAmountPaid = Math.max(0, parseFloat(pricingFactors.amount_paid || 0));
    const currentRefunded = Math.max(0, parseFloat(item.deposit_refunded || pricingFactors.deposit_refunded_amount || 0));
    const maxRefundable = Math.max(0, depositAmount - currentRefunded);

    if (depositAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "No refundable deposit found for this rental order."
      });
    }

    if (maxRefundable <= 0) {
      return res.status(400).json({
        success: false,
        message: "Deposit has already been fully refunded for this rental order."
      });
    }

    if (amount > maxRefundable) {
      return res.status(400).json({
        success: false,
        message: `Refund amount exceeds refundable deposit. Remaining refundable amount: ₱${maxRefundable.toFixed(2)}.`
      });
    }

    // Handle partial deposit return for damaged sizes
    let depositReturnDetails = [];
    let damagedDepositAmount = 0;
    
    if (Array.isArray(damagedSizes) && damagedSizes.length > 0) {
      // Calculate damaged deposit amount
      damagedSizes.forEach(damagedSize => {
        const sizeKey = damagedSize.sizeKey || damagedSize.size_key;
        const damagedQty = parseInt(damagedSize.quantity || 0, 10);
        
        const matchingSize = selectedSizes.find(s => 
          (s.sizeKey || s.size_key || s.label?.toLowerCase()) === sizeKey
        );
        
        if (matchingSize && damagedQty > 0) {
          const depositPerUnit = parseFloat(matchingSize.deposit || 0);
          const damagedAmount = depositPerUnit * damagedQty;
          damagedDepositAmount += damagedAmount;
          
          depositReturnDetails.push({
            sizeKey: sizeKey,
            label: matchingSize.label || damagedSize.label,
            quantity: damagedQty,
            depositPerUnit: depositPerUnit,
            totalDamaged: damagedAmount
          });
        }
      });
      
      console.log(`[DEPOSIT RETURN] Item ${itemId}: Total deposit: ₱${depositAmount}, Damaged deposit: ₱${damagedDepositAmount}, Refundable: ₱${amount}`);
    }

    const finalPriceAmount = Math.max(0, parseFloat(item.final_price || 0));
    const updatedRefundedTotal = currentRefunded + amount;
    
    // Store deposit return details in pricing_factors
    pricingFactors.deposit_refunded = updatedRefundedTotal >= depositAmount;
    pricingFactors.deposit_refunded_amount = updatedRefundedTotal.toFixed(2);
    pricingFactors.deposit_refunded_at = new Date().toISOString().split('T')[0];
    
    if (damagedDepositAmount > 0) {
      pricingFactors.deposit_damaged_amount = damagedDepositAmount.toFixed(2);
      pricingFactors.deposit_return_details = depositReturnDetails;
    }

    // Payment status remains unchanged - deposit refund doesn't affect rental payment
    const previousPaymentStatus = item.payment_status || 'unpaid';
    const recalculatedPaymentStatus = previousPaymentStatus;

    const refundTimestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const actorName = req.user?.username || `${req.user?.first_name || ''} ${req.user?.last_name || ''}`.trim() || req.user?.role || 'admin';
    const logUserId = item.user_id || req.user?.id || null;
    const dbConn = require('../config/db');

    const applyLogs = () => {
      const TransactionLog = require('../model/TransactionLogModel');

      if (logUserId) {
        let refundNotes = `${actorName} recorded rental deposit return of ₱${amount.toFixed(2)}.`;
        if (damagedDepositAmount > 0) {
          refundNotes += ` Damaged deposit withheld: ₱${damagedDepositAmount.toFixed(2)}.`;
          if (depositReturnDetails.length > 0) {
            const detailsStr = depositReturnDetails.map(d => 
              `${d.label || d.sizeKey} (${d.quantity}x₱${d.depositPerUnit})`
            ).join(', ');
            refundNotes += ` Details: ${detailsStr}.`;
          }
        }
        
        TransactionLog.create({
          order_item_id: itemId,
          user_id: logUserId,
          transaction_type: 'refund',
          amount: amount,
          previous_payment_status: previousPaymentStatus,
          new_payment_status: recalculatedPaymentStatus,
          payment_method: 'manual_refund',
          notes: refundNotes,
          created_by: actorName
        }, (refundLogErr) => {
          if (refundLogErr) {
            console.error(`[RENTAL REFUND] Failed to create refund transaction log for item ${itemId}:`, refundLogErr);
          }
        });
        
        // Record withheld damaged deposit as revenue
        if (damagedDepositAmount > 0) {
          TransactionLog.create({
            order_item_id: itemId,
            user_id: logUserId,
            transaction_type: 'revenue',
            amount: damagedDepositAmount,
            previous_payment_status: previousPaymentStatus,
            new_payment_status: recalculatedPaymentStatus,
            payment_method: 'deposit_withheld',
            notes: `Deposit withheld for damage: ₱${damagedDepositAmount.toFixed(2)}. ${depositReturnDetails.map(d => `${d.label || d.sizeKey} (${d.quantity}x₱${d.depositPerUnit})`).join(', ')}`,
            created_by: actorName
          }, (revenueLogErr) => {
            if (revenueLogErr) {
              console.error(`[RENTAL REFUND] Failed to create revenue transaction log for withheld deposit:`, revenueLogErr);
            } else {
              console.log(`[RENTAL REFUND] Recorded ₱${damagedDepositAmount.toFixed(2)} as revenue from withheld damaged deposit`);
            }
          });
        }
      }

      return res.json({
        success: true,
        message: 'Deposit return recorded successfully',
        refund: {
          refunded_amount: amount,
          total_refunded: updatedRefundedTotal,
          damaged_deposit_withheld: damagedDepositAmount,
          refundable_remaining: Math.max(0, depositAmount - updatedRefundedTotal - damagedDepositAmount),
          refund_date: refundTimestamp,
          payment_status: recalculatedPaymentStatus,
          deposit_return_details: depositReturnDetails
        }
      });
    };

    const updateSql = `
      UPDATE order_items
      SET pricing_factors = ?, payment_status = ?, deposit_refunded = ?, deposit_refund_date = ?
      WHERE item_id = ?
    `;

    dbConn.query(
      updateSql,
      [JSON.stringify(pricingFactors), recalculatedPaymentStatus, updatedRefundedTotal, refundTimestamp, itemId],
      (updateErr) => {
        if (updateErr && updateErr.code === 'ER_BAD_FIELD_ERROR') {
          const fallbackSql = `
            UPDATE order_items
            SET pricing_factors = ?, payment_status = ?
            WHERE item_id = ?
          `;
          dbConn.query(fallbackSql, [JSON.stringify(pricingFactors), recalculatedPaymentStatus, itemId], (fallbackErr) => {
            if (fallbackErr) {
              return res.status(500).json({
                success: false,
                message: 'Error recording deposit return',
                error: fallbackErr
              });
            }
            applyLogs();
          });
          return;
        }

        if (updateErr) {
          return res.status(500).json({
            success: false,
            message: 'Error recording deposit return',
            error: updateErr
          });
        }

        applyLogs();
      }
    );
  });
};

exports.confirmRentalDepositReceipt = (req, res) => {
  const itemId = req.params.id;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized user.'
    });
  }

  if (req.user.role === 'admin' || req.user.role === 'clerk') {
    return res.status(403).json({
      success: false,
      message: 'Only customers can confirm deposit receipt.'
    });
  }

  Order.getOrderItemById(itemId, (getErr, item) => {
    if (getErr || !item) {
      return res.status(404).json({
        success: false,
        message: 'Order item not found'
      });
    }

    if ((item.service_type || '').toLowerCase().trim() !== 'rental') {
      return res.status(400).json({
        success: false,
        message: 'Deposit receipt confirmation is only available for rental orders.'
      });
    }

    if (Number(item.user_id) !== Number(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

      let pricingFactors = {};
      try {
        pricingFactors = item.pricing_factors ? JSON.parse(item.pricing_factors) : {};
      } catch {
        pricingFactors = {};
      }

      const refundedAmount = Math.max(
        0,
        parseFloat(item.deposit_refunded || pricingFactors.deposit_refunded_amount || 0)
      );

      if (refundedAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'No recorded deposit return found for this order item yet.'
        });
      }

      const alreadyConfirmed =
        pricingFactors.deposit_refund_received === true
        || String(pricingFactors.deposit_refund_received).toLowerCase() === 'true';

      if (alreadyConfirmed) {
        return res.json({
          success: true,
          message: 'Deposit receipt already confirmed.',
          confirmation: {
            received: true,
            confirmed_at: pricingFactors.deposit_refund_received_at || null,
            refunded_amount: refundedAmount
          }
        });
      }

      const confirmedAt = new Date().toISOString();
      pricingFactors.deposit_refund_received = true;
      pricingFactors.deposit_refund_received_at = confirmedAt;
      pricingFactors.deposit_refund_received_by = userId;

    db.query(
      'UPDATE order_items SET pricing_factors = ? WHERE item_id = ?',
      [JSON.stringify(pricingFactors), itemId],
      (updateErr) => {
        if (updateErr) {
          return res.status(500).json({
            success: false,
            message: 'Error confirming deposit receipt',
            error: updateErr
          });
        }

        return res.json({
          success: true,
          message: 'Deposit receipt confirmed successfully.',
          confirmation: {
            received: true,
            confirmed_at: confirmedAt,
            refunded_amount: refundedAmount
          }
        });
      }
    );
  });
};

exports.deleteOrderItem = (req, res) => {
  const itemId = req.params.itemId;
  const userId = req.user.id;

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only."
    });
  }

  const checkQuery = `
    SELECT
      oi.item_id,
      oi.order_id,
      oi.price,
      oi.final_price,
      oi.approval_status,
      oi.payment_status,
      oi.service_type,
      oi.specific_data,
      o.order_date,
      o.user_id AS order_user_id,
      CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS db_customer_name,
      EXISTS (
        SELECT 1
        FROM damage_compensation_records dcr
        WHERE dcr.order_item_id = oi.item_id
          AND dcr.liability_status = 'approved'
          AND dcr.compensation_status = 'paid'
      ) AS has_paid_compensation
    FROM order_items oi
    LEFT JOIN orders o ON o.order_id = oi.order_id
    LEFT JOIN user u ON u.user_id = o.user_id
    WHERE oi.item_id = ?
  `;
  
  db.query(checkQuery, [itemId], (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Database error",
        error: err
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order item not found"
      });
    }

    const orderItem = results[0];

    const hasPaidCompensation = Number(orderItem.has_paid_compensation) === 1;

    if (
      orderItem.approval_status !== 'completed' &&
      orderItem.approval_status !== 'returned' &&
      orderItem.approval_status !== 'cancelled' &&
      orderItem.approval_status !== 'price_declined' &&
      !hasPaidCompensation
    ) {
      return res.status(400).json({
        success: false,
        message: "Only completed/returned/cancelled/price declined or compensated orders can be deleted"
      });
    }

    const parsedSpecificData = parseMaybeJson(orderItem.specific_data, {});
    const fallbackCustomerName = parsedSpecificData.walk_in_customer_name || parsedSpecificData.customerName || 'N/A';
    const dbCustomerName = String(orderItem.db_customer_name || '').trim();
    const customerName = dbCustomerName || fallbackCustomerName;
    const deletedByName = String(req.user?.first_name || req.user?.username || 'admin').trim() || 'admin';

    const archivePayload = {
      original_item_id: orderItem.item_id,
      order_id: orderItem.order_id,
      user_id: orderItem.order_user_id,
      service_type: orderItem.service_type,
      approval_status: orderItem.approval_status,
      payment_status: orderItem.payment_status,
      price: parseFloat(orderItem.price || 0) || 0,
      final_price: parseFloat(orderItem.final_price || 0) || 0,
      customer_name: customerName,
      order_date: orderItem.order_date,
      deleted_by_user_id: userId,
      deleted_by_name: deletedByName,
      snapshot: JSON.stringify(orderItem)
    };

    ensureDeletedOrdersArchiveTable((tableErr) => {
      if (tableErr) {
        return res.status(500).json({
          success: false,
          message: "Error preparing deleted orders archive",
          error: tableErr
        });
      }

      const insertArchiveQuery = `
        INSERT INTO deleted_orders_archive
        (original_item_id, order_id, user_id, service_type, approval_status, payment_status, price, final_price, customer_name, order_date, deleted_by_user_id, deleted_by_name, snapshot)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const archiveValues = [
        archivePayload.original_item_id,
        archivePayload.order_id,
        archivePayload.user_id,
        archivePayload.service_type,
        archivePayload.approval_status,
        archivePayload.payment_status,
        archivePayload.price,
        archivePayload.final_price,
        archivePayload.customer_name,
        archivePayload.order_date,
        archivePayload.deleted_by_user_id,
        archivePayload.deleted_by_name,
        archivePayload.snapshot
      ];

      db.query(insertArchiveQuery, archiveValues, (archiveErr) => {
        if (archiveErr) {
          return res.status(500).json({
            success: false,
            message: "Error archiving deleted order item",
            error: archiveErr
          });
        }

        const deleteQuery = `DELETE FROM order_items WHERE item_id = ?`;
        db.query(deleteQuery, [itemId], (deleteErr) => {
          if (deleteErr) {
            return res.status(500).json({
              success: false,
              message: "Error deleting order item",
              error: deleteErr
            });
          }

          res.json({
            success: true,
            message: "Order item deleted successfully"
          });
        });
      });
    });
  });
};

exports.getDeletedOrdersArchive = (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'clerk') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin or clerk only.'
    });
  }

  ensureDeletedOrdersArchiveTable((tableErr) => {
    if (tableErr) {
      return res.status(500).json({
        success: false,
        message: 'Error preparing deleted orders archive',
        error: tableErr
      });
    }

    const { serviceType, search, startDate, endDate } = req.query;
    let query = `
      SELECT
        archive_id,
        original_item_id AS item_id,
        order_id,
        customer_name,
        service_type,
        approval_status,
        payment_status,
        price,
        final_price,
        order_date,
        deleted_at,
        deleted_by_name
      FROM deleted_orders_archive
      WHERE 1=1
    `;

    const params = [];

    if (serviceType && String(serviceType).trim() !== '') {
      query += ' AND service_type = ?';
      params.push(String(serviceType).trim());
    }

    if (search && String(search).trim() !== '') {
      const q = `%${String(search).trim()}%`;
      query += ' AND (CAST(order_id AS CHAR) LIKE ? OR CAST(original_item_id AS CHAR) LIKE ? OR customer_name LIKE ?)';
      params.push(q, q, q);
    }

    if (startDate && String(startDate).trim() !== '') {
      query += ' AND DATE(deleted_at) >= ?';
      params.push(String(startDate).trim());
    }

    if (endDate && String(endDate).trim() !== '') {
      query += ' AND DATE(deleted_at) <= ?';
      params.push(String(endDate).trim());
    }

    query += ' ORDER BY deleted_at DESC, archive_id DESC';

    db.query(query, params, (err, rows) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Error fetching deleted orders archive',
          error: err
        });
      }

      res.json({
        success: true,
        orders: rows || []
      });
    });
  });
};

exports.getOrderItemDetails = (req, res) => {
  const itemId = req.params.itemId;
  const userId = req.user.id;

  Order.getOrderItemById(itemId, (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Database error",
        error: err
      });
    }

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Order item not found"
      });
    }

    if (req.user.role !== 'admin' && result.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    const orderItem = {
      ...result,
      pricing_factors: JSON.parse(result.pricing_factors || '{}'),
      specific_data: JSON.parse(result.specific_data || '{}')
    };

    res.json({
      success: true,
      message: "Order item details retrieved successfully",
      order_item: orderItem
    });
  });
};


exports.updateOrderItemPrice = (req, res) => {
  const itemId = req.params.id;
  const { newPrice, reason } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'clerk') {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only."
    });
  }

  if (!newPrice || isNaN(parseFloat(newPrice)) || parseFloat(newPrice) <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid price. Price must be greater than 0."
    });
  }

  const price = parseFloat(newPrice);
  const MAX_PRICE = 100000;
  if (price > MAX_PRICE) {
    return res.status(400).json({
      success: false,
      message: `Price cannot exceed ₱${MAX_PRICE.toLocaleString()}`
    });
  }

  Order.getOrderItemById(itemId, (getErr, item) => {
    if (getErr || !item) {
      return res.status(404).json({
        success: false,
        message: "Order item not found"
      });
    }

    const serviceType = (item.service_type || '').toLowerCase().trim();
    const allowedServices = ['customization', 'repair', 'dry_cleaning'];
    
    if (!allowedServices.includes(serviceType)) {
      return res.status(400).json({
        success: false,
        message: `Price changes are only allowed for customization, repair, and dry cleaning services. Current service: ${item.service_type}`
      });
    }

    const restrictedStatuses = ['cancelled', 'refunded'];
    if (restrictedStatuses.includes(item.approval_status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change price for ${item.approval_status} orders`
      });
    }

    const oldPrice = parseFloat(item.final_price || 0);
    
    if (Math.abs(price - oldPrice) < 0.01) {
      return res.status(400).json({
        success: false,
        message: "New price must be different from current price"
      });
    }

    const normalizedReason = typeof reason === 'string' ? reason.trim() : '';
    const updateSql = `
      UPDATE order_items
      SET
        final_price = ?,
        approval_status = 'price_confirmation',
        pricing_factors = JSON_SET(
          COALESCE(pricing_factors, '{}'),
          '$.adminPriceUpdated', true,
          '$.adminNotes', ?
        )
      WHERE item_id = ?
    `;

    db.query(updateSql, [price, normalizedReason, itemId], (updateErr, updateResult) => {
      if (updateErr) {
        return res.status(500).json({
          success: false,
          message: "Error updating price",
          error: updateErr
        });
      }

      // Insert price_confirmation into order_tracking so user sees updated status
      const trackingNotes = reason
        ? `Price updated to ${price.toFixed(2)}. Reason: ${reason}. Please confirm the new price to proceed.`
        : `Price updated to ${price.toFixed(2)}. Please confirm the new price to proceed.`;
      db.query(
        `INSERT INTO order_tracking (order_item_id, status, notes, updated_by) VALUES (?, 'price_confirmation', ?, ?)`,
        [itemId, trackingNotes, req.user?.id || null],
        (trackErr) => { if (trackErr) console.error('Error inserting tracking entry:', trackErr); }
      );

      const getCustomerSql = `
        SELECT 
          COALESCE(
            NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''),
            wc.name,
            'Customer'
          ) AS customer_name,
          u.user_id,
          u.email,
          u.first_name,
          u.last_name
        FROM orders o
        LEFT JOIN user u ON o.user_id = u.user_id
        LEFT JOIN walk_in_customers wc ON o.walk_in_customer_id = wc.id
        WHERE o.order_id = ?
        LIMIT 1
      `;
      
      db.query(getCustomerSql, [item.order_id], (userErr, userResults) => {
        const customerName = userResults && userResults.length > 0 && userResults[0].customer_name
          ? userResults[0].customer_name
          : 'Customer';
        const customerUserId = userResults && userResults.length > 0 ? userResults[0].user_id : null;
        const customerEmail = userResults && userResults.length > 0 ? userResults[0].email : null;
        const customerFirstName = userResults && userResults.length > 0 ? userResults[0].first_name : null;
        const customerLastName = userResults && userResults.length > 0 ? userResults[0].last_name : null;
        
        const logUserId = customerUserId || req.user?.id || null;
        const actorName = req.user?.username || `${req.user?.first_name || ''} ${req.user?.last_name || ''}`.trim() || req.user?.role || 'admin';
        const priceDifference = price - oldPrice;

        if (logUserId) {
          const ActionLog = require('../model/ActionLogModel');
          const reasonText = reason ? `Reason: ${reason}` : 'No reason provided';
          
          ActionLog.create({
            order_item_id: itemId,
            user_id: logUserId,
            action_type: 'price_change',
            action_by: req.user?.role === 'clerk' ? 'clerk' : 'admin',
            previous_status: null,
            new_status: null,
            reason: reason || null,
            notes: `Price Change: ₱${oldPrice.toFixed(2)} → ₱${price.toFixed(2)} | Changed by: ${actorName} | ${reasonText} | Customer: ${customerName} | Order ID: ORD-${item.order_id}`
          }, (logErr) => {
            if (logErr) {
              console.error('Error logging price change:', logErr);
            }
          });

          const TransactionLog = require('../model/TransactionLogModel');
          TransactionLog.create({
            order_item_id: itemId,
            user_id: logUserId,
            transaction_type: 'price_change',
            amount: priceDifference,
            previous_payment_status: item.payment_status || 'pending',
            new_payment_status: item.payment_status || 'pending',
            payment_method: null,
            notes: `Price Change: ₱${oldPrice.toFixed(2)} → ₱${price.toFixed(2)} | Changed by: ${actorName} | ${reasonText} | Customer: ${customerName} | Order ID: ORD-${item.order_id}`,
            created_by: actorName
          }, (transErr) => {
            if (transErr) {
              console.error('Error creating transaction log:', transErr);
            }
          });
        }

        if (customerUserId && customerEmail) {
          const Notification = require('../model/NotificationModel');
          Notification.createStatusUpdateNotification(
            customerUserId,
            itemId,
            'price_change',
            `Your order price has been updated from ₱${oldPrice.toFixed(2)} to ₱${price.toFixed(2)}. ${reason ? 'Reason: ' + reason : ''}`,
            serviceType,
            (notifErr) => {
              if (notifErr) {
                console.error('Error creating price change notification:', notifErr);
              }
            }
          );

          try {
            const emailService = require('../services/emailService');
            if (emailService && emailService.sendPriceChangeEmail) {
              emailService.sendPriceChangeEmail({
                userEmail: customerEmail,
                userName: `${customerFirstName || ''} ${customerLastName || ''}`.trim() || customerName,
                serviceName: serviceType.replace('_', ' '),
                oldPrice: oldPrice,
                newPrice: price,
                reason: reason || 'Price adjustment',
                orderId: itemId
              }).catch(emailErr => {
                console.error('Error sending price change email:', emailErr);
              });
            }
          } catch (emailErr) {
            console.error('Error sending price change email:', emailErr);
          }
        }

        res.json({
          success: true,
          message: "Price updated successfully",
          order: {
            item_id: itemId,
            old_price: oldPrice,
            new_price: price,
            price_difference: priceDifference
          }
        });
      });
    });
  });
};

exports.getOrderItemPriceHistory = (req, res) => {
  const itemId = req.params.id;

  if (req.user.role !== 'admin' && req.user.role !== 'clerk') {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only."
    });
  }

  const historySql = `
    SELECT 
      tl.log_id as id,
      tl.transaction_type,
      tl.amount,
      tl.notes as details,
      tl.created_at,
      tl.user_id,
      tl.created_by
    FROM transaction_logs tl
    WHERE tl.order_item_id = ? AND tl.transaction_type = 'price_change'
    ORDER BY tl.created_at DESC
  `;

  db.query(historySql, [itemId], (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Error fetching price history",
        error: err
      });
    }

    res.json({
      success: true,
      message: "Price history retrieved successfully",
      history: results
    });
  });
};


exports.cancelEnhancement = (req, res) => {
  const { itemId } = req.params;
  const rawReason = String(req.body?.reason || '').trim();
  if (!rawReason) {
    return res.status(400).json({ success: false, message: 'Cancellation reason is required.' });
  }
  const cancellationReason = rawReason;
  if (req.user.role !== 'admin' && req.user.role !== 'clerk') {
    return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
  }
  Order.getOrderItemById(itemId, (getErr, item) => {
    if (getErr || !item) return res.status(404).json({ success: false, message: 'Order item not found' });
    let pricingFactors = {};
    try { pricingFactors = item.pricing_factors ? (typeof item.pricing_factors === 'string' ? JSON.parse(item.pricing_factors) : item.pricing_factors) : {}; } catch (e) {}
    const originalPrice = parseFloat(pricingFactors.accessoriesBasePrice || item.final_price || 0);
    const actualAmountPaid = String(pricingFactors.amount_paid || '0');
    const updatedPf = {
      ...pricingFactors,
      enhancementRequest: false,
      enhancementPendingAdminReview: false,
      addAccessories: false,
      accessoriesPrice: null,
      accessoriesDeclineReason: null,
      amount_paid: actualAmountPaid,
      enhancementCancelledByAdmin: true,
      enhancementCancelledAt: new Date().toISOString(),
      enhancementCancelReason: cancellationReason
    };
    const sql = `UPDATE order_items SET final_price = ?, approval_status = 'completed', pricing_factors = ? WHERE item_id = ?`;
    db.query(sql, [originalPrice, JSON.stringify(updatedPf), itemId], (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Error cancelling enhancement', error: err });
      // Also sync the order_tracking table back to 'completed'
      const OrderTracking = require('../model/OrderTrackingModel');
      OrderTracking.getByOrderItemId(itemId, (trackErr, existingTracking) => {
        const trackingNote = `Enhancement cancelled by admin. Reason: ${cancellationReason}. Order restored to completed.`;
        if (!trackErr && existingTracking && existingTracking.length > 0) {
          OrderTracking.updateStatus(itemId, 'completed', trackingNote, null, () => {});
        } else {
          OrderTracking.addTracking(itemId, 'completed', trackingNote, null, () => {});
        }
      });
      res.json({ success: true, message: 'Enhancement cancelled. Price restored.' });
    });
  });
};
