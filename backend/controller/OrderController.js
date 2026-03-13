const Order = require('../model/OrderModel');
const db = require('../config/db');

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

    const orders = results.map(item => ({
      ...item,
      pricing_factors: JSON.parse(item.pricing_factors || '{}'),
      specific_data: JSON.parse(item.specific_data || '{}')
    }));

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

    const orders = results.map(item => ({
      ...item,
      pricing_factors: JSON.parse(item.pricing_factors || '{}'),
      specific_data: JSON.parse(item.specific_data || '{}')
    }));

    res.json({
      success: true,
      message: `Repair orders with status '${status}' retrieved successfully`,
      orders: orders
    });
  });
};

exports.updateRepairOrderItem = (req, res) => {
  const itemId = req.params.id;
  const { finalPrice, approvalStatus, adminNotes } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'clerk') {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only."
    });
  }

  const updateData = {
    finalPrice: finalPrice || undefined,
    approvalStatus: approvalStatus || undefined,
    adminNotes: adminNotes || undefined
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
  const { finalPrice, approvalStatus, adminNotes } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'clerk') {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only."
    });
  }

  const updateData = {
    finalPrice: finalPrice || undefined,
    approvalStatus: approvalStatus || undefined,
    adminNotes: adminNotes || undefined
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
  const { approvalStatus, adminNotes, damageNotes } = req.body;

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
    damageNotes: damageNotes !== undefined ? damageNotes : undefined
  };

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

    let penaltyAmount = 0;
    let penaltyDays = 0;
    if (updateData.approvalStatus === 'returned' && previousStatus !== 'returned') {
      if (item.rental_end_date) {
        const endDate = new Date(item.rental_end_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0); 
        endDate.setHours(0, 0, 0, 0);

        if (today > endDate) {
          const diffTime = today - endDate;
          penaltyDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          penaltyAmount = penaltyDays * 100; 
          
          console.log(`[RENTAL PENALTY] Item ${itemId}: End date: ${item.rental_end_date}, Today: ${today.toISOString().split('T')[0]}, Days exceeded: ${penaltyDays}, Penalty: ₱${penaltyAmount}`);

          const currentPricingFactors = item.pricing_factors ? (typeof item.pricing_factors === 'string' ? JSON.parse(item.pricing_factors) : item.pricing_factors) : {};
          currentPricingFactors.penalty = penaltyAmount;
          currentPricingFactors.penaltyDays = penaltyDays;
          currentPricingFactors.penaltyAppliedDate = today.toISOString().split('T')[0];

          const originalPrice = parseFloat(item.final_price || 0);
          const newFinalPrice = originalPrice + penaltyAmount;
          
          updateData.finalPrice = newFinalPrice;
          updateData.penaltyData = currentPricingFactors;
          
          console.log(`[RENTAL PENALTY] Original price: ₱${originalPrice}, Penalty: ₱${penaltyAmount}, New final price: ₱${newFinalPrice}`);

          try {
            const emailService = require('../services/emailService');
            const db = require('../config/db');

            const getUserSql = `SELECT u.email, u.first_name, u.last_name FROM user u JOIN orders o ON u.user_id = o.user_id WHERE o.order_id = ?`;
            db.query(getUserSql, [item.order_id], async (userErr, userResults) => {
              if (!userErr && userResults.length > 0) {
                const user = userResults[0];
                const itemName = item.specific_data ? 
                  (typeof item.specific_data === 'string' ? JSON.parse(item.specific_data) : item.specific_data).item_name || 'Rental Item'
                  : 'Rental Item';
                
                await emailService.sendPenaltyChargeEmail({
                  userEmail: user.email,
                  userName: `${user.first_name} ${user.last_name}`,
                  itemName: itemName,
                  rentalEndDate: item.rental_end_date,
                  returnDate: new Date().toISOString().split('T')[0],
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
        
        if (isBundle && bundleItems.length > 0) {
          
          console.log(`Updating rental_inventory status to 'rented' for ${bundleItems.length} bundle items`);
          
          for (const bundleItem of bundleItems) {
            const bundleItemId = bundleItem.item_id || bundleItem.id;
            if (bundleItemId) {
              const updateSql = `UPDATE rental_inventory SET status = 'rented' WHERE item_id = ?`;
              db.query(updateSql, [bundleItemId], (rentalUpdateErr, rentalUpdateResult) => {
                if (rentalUpdateErr) {
                  console.error(`Error updating rental_inventory status for bundle item ${bundleItemId}:`, rentalUpdateErr);
                } else {
                  console.log(`Successfully updated rental_inventory status to 'rented' for bundle item: ${bundleItem.item_name} (id: ${bundleItemId})`);
                }
              });
            }
          }
        } else {
          
          const rentalItemId = item.service_id; 
          
          if (rentalItemId) {
            console.log(`Updating rental_inventory status to 'rented' for item_id: ${rentalItemId}`);

            const updateSql = `UPDATE rental_inventory SET status = 'rented' WHERE item_id = ?`;
            
            db.query(updateSql, [rentalItemId], (rentalUpdateErr, rentalUpdateResult) => {
              if (rentalUpdateErr) {
                console.error('Error updating rental_inventory status:', rentalUpdateErr);
              } else {
                console.log(`Successfully updated rental_inventory status to 'rented' for item_id: ${rentalItemId}`);
              }
            });
          } else {
            console.warn('Cannot update rental_inventory: service_id is missing from order item');
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
  const { paymentAmount } = req.body;

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
    const newAmountPaid = currentAmountPaid + amount;
    const remainingBalance = finalPrice - newAmountPaid;

    if (newAmountPaid > finalPrice) {
      return res.status(400).json({
        success: false,
        message: `Payment amount exceeds remaining balance. Total: ₱${finalPrice.toFixed(2)}, Already paid: ₱${currentAmountPaid.toFixed(2)}, Remaining: ₱${(finalPrice - currentAmountPaid).toFixed(2)}`
      });
    }

    pricingFactors.amount_paid = newAmountPaid.toString();
    pricingFactors.remaining_balance = remainingBalance.toString();

    let newPaymentStatus = item.payment_status || 'unpaid';
    const serviceType = (item.service_type || '').toLowerCase().trim();
    
    if (newAmountPaid >= finalPrice) {
      
      newPaymentStatus = serviceType === 'rental' ? 'fully_paid' : 'paid';
    } else if (newAmountPaid > 0) {
      
      if (serviceType === 'rental') {
        const downpaymentAmount = finalPrice * 0.5;
        if (newAmountPaid >= downpaymentAmount) {
          newPaymentStatus = 'down-payment';
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

      const getUserSql = `SELECT first_name, last_name FROM user WHERE user_id = ?`;
      db.query(getUserSql, [item.user_id], (userErr, userResults) => {
        const customerName = userResults && userResults.length > 0 
          ? `${userResults[0].first_name} ${userResults[0].last_name}`
          : 'Customer';

      const ActionLog = require('../model/ActionLogModel');
      const previousPaymentStatus = item.payment_status || 'unpaid';
      const actorId = req.user?.id || item.user_id;
      const actorRole = req.user?.role === 'clerk' ? 'clerk' : 'admin';
      ActionLog.create({
        order_item_id: itemId,
        user_id: actorId,
        action_type: 'payment',
        action_by: actorRole,
        previous_status: previousPaymentStatus,
        new_status: newPaymentStatus,
        reason: null,
        notes: `${actorRole === 'clerk' ? 'Clerk' : 'Admin'} recorded payment of ₱${amount.toFixed(2)}. Total paid: ₱${newAmountPaid.toFixed(2)}. Customer: ${customerName}`
      }, (actionLogErr) => {
        if (actionLogErr) {
          console.error('Error creating payment action log:', actionLogErr);
        } else {
          console.log('Payment action log created successfully');
        }
      });

      const TransactionLog = require('../model/TransactionLogModel');
      const transactionType = newPaymentStatus === 'down-payment' ? 'downpayment' : 
                              (newPaymentStatus === 'paid' || newPaymentStatus === 'fully_paid') ? 'final_payment' : 'partial_payment';
      
      TransactionLog.create({
        order_item_id: itemId,
        user_id: item.user_id,
        transaction_type: transactionType,
        amount: amount,
        previous_payment_status: previousPaymentStatus,
        new_payment_status: newPaymentStatus,
        payment_method: 'cash', 
        notes: `${actorRole === 'clerk' ? 'Clerk' : 'Admin'} recorded ${transactionType.replace('_', ' ')} of ₱${amount.toFixed(2)}. Total paid: ₱${newAmountPaid.toFixed(2)} of ₱${finalPrice.toFixed(2)}`,
        created_by: actorRole
      }, (transLogErr, transLogResult) => {
        if (transLogErr) {
          console.error('[TRANSACTION LOG] Error creating transaction log:', transLogErr);
        } else {
          console.log(`[TRANSACTION LOG] Created: ${transactionType} - ₱${amount.toFixed(2)} for item ${itemId}`);
        }
      });
      });

      if (item.user_id) {
        const Notification = require('../model/NotificationModel');
        const serviceType = (item.service_type || 'rental').toLowerCase().trim();
        Notification.createPaymentSuccessNotification(
          item.user_id,
          itemId,
          amount,
          'cash', 
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
          payment_status: newPaymentStatus,
          total_price: finalPrice
        }
      });
    });
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

  const checkQuery = `SELECT item_id, approval_status, service_type FROM order_items WHERE item_id = ?`;
  
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

    if (orderItem.approval_status !== 'completed' && orderItem.approval_status !== 'returned' && orderItem.approval_status !== 'cancelled') {
      return res.status(400).json({
        success: false,
        message: "Only completed, returned, or rejected orders can be deleted"
      });
    }

    const deleteQuery = `DELETE FROM order_items WHERE item_id = ?`;
    
    db.query(deleteQuery, [itemId], (err, result) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Error deleting order item",
          error: err
        });
      }

      res.json({
        success: true,
        message: "Order item deleted successfully"
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

