const OrderTracking = require('../model/OrderTrackingModel');
const Order = require('../model/OrderModel');
const Notification = require('../model/NotificationModel');
const db = require('../config/db');

exports.getUserOrderTracking = (req, res) => {
  const userId = req.user.id; 
  console.log('Fetching orders for user ID:', userId); 

  OrderTracking.getLatestStatusByUserId(userId, (err, results) => {
    if (err) {
      console.error('Database error in getUserOrderTracking:', err);
      return res.status(500).json({
        success: false,
        message: "Error fetching order tracking",
        error: err.message || err
      });
    }

    console.log('Raw results from database:', results);

    // Helper function to enrich rental data with measurements
    const enrichRentalWithMeasurements = (specificData, callback) => {
      if (!specificData) return callback(specificData);
      
      const isBundle = specificData.is_bundle === true || specificData.category === 'rental_bundle';
      const bundleItems = specificData.bundle_items || [];
      
      if (isBundle && bundleItems.length > 0) {
        let completed = 0;
        bundleItems.forEach((item, idx) => {
          const itemId = item.item_id || item.id;
          if (!itemId) {
            completed++;
            if (completed === bundleItems.length) callback(specificData);
            return;
          }
          
          db.query('SELECT size FROM rental_inventory WHERE id = ?', [itemId], (err, rows) => {
            if (!err && rows && rows.length > 0 && rows[0].size) {
              try {
                const sizeConfig = JSON.parse(rows[0].size);
                if (sizeConfig && sizeConfig.size_entries) {
                  const selectedSizes = item.selected_sizes || item.selectedSizes || [];
                  const enrichedSizes = selectedSizes.map(sel => {
                    const sizeEntry = sizeConfig.size_entries.find(s => s.sizeKey === sel.sizeKey || s.sizeKey === sel.size_key);
                    return {
                      ...sel,
                      measurements: sizeEntry?.measurements || sizeEntry?.measurement_profile || sel.measurements
                    };
                  });
                  bundleItems[idx].selected_sizes = enrichedSizes;
                  bundleItems[idx].selectedSizes = enrichedSizes;
                }
              } catch (e) {
                console.error('Error parsing size config:', e);
              }
            }
            completed++;
            if (completed === bundleItems.length) callback(specificData);
          });
        });
      } else {
        const itemId = specificData.service_id || specificData.item_id || specificData.id;
        if (!itemId) return callback(specificData);
        
        db.query('SELECT size FROM rental_inventory WHERE id = ?', [itemId], (err, rows) => {
          if (!err && rows && rows.length > 0 && rows[0].size) {
            try {
              const sizeConfig = JSON.parse(rows[0].size);
              if (sizeConfig && sizeConfig.size_entries) {
                const selectedSizes = specificData.selected_sizes || specificData.selectedSizes || [];
                const enrichedSizes = selectedSizes.map(sel => {
                  const sizeEntry = sizeConfig.size_entries.find(s => s.sizeKey === sel.sizeKey || s.sizeKey === sel.size_key);
                  return {
                    ...sel,
                    measurements: sizeEntry?.measurements || sizeEntry?.measurement_profile || sel.measurements
                  };
                });
                specificData.selected_sizes = enrichedSizes;
                specificData.selectedSizes = enrichedSizes;
              }
            } catch (e) {
              console.error('Error parsing size config:', e);
            }
          }
          callback(specificData);
        });
      }
    };

    const orders = {};
    const processedKeys = new Set(); 
    
    let itemsToProcess = results.length;
    let processedItems = 0;
    
    results.forEach(item => {
      console.log('Processing item:', item); 

      const itemKey = `${item.order_id}-${item.order_item_id}-${item.service_type}`;

      if (processedKeys.has(itemKey)) {
        console.log('Skipping duplicate item:', itemKey);
        processedItems++;
        if (processedItems === itemsToProcess) {
          const finalOrders = Object.values(orders).filter(order => order.items.length > 0);
          console.log('Final processed orders:', finalOrders);
          res.json({ success: true, data: finalOrders });
        }
        return;
      }

      processedKeys.add(itemKey);
      
      try {
        if (!orders[item.order_id]) {
          orders[item.order_id] = {
            order_id: item.order_id,
            parent_order_id: item.parent_order_id || item.order_id,
            order_date: item.order_date,
            total_price: item.total_price,
            items: []
          };
        }

        const statusInfo = OrderTracking.getStatusInfo(item.status, item.service_type);

        let specificData = {};
        if (item.specific_data) {
          try {
            specificData = typeof item.specific_data === 'string' 
              ? JSON.parse(item.specific_data) 
              : item.specific_data;
          } catch (parseErr) {
            console.warn('Failed to parse specific_data for item:', item.order_item_id, parseErr);
            specificData = {};
          }
        }

        let pricingFactors = {};
        if (item.pricing_factors) {
          try {
            pricingFactors = typeof item.pricing_factors === 'string' 
              ? JSON.parse(item.pricing_factors) 
              : item.pricing_factors;
          } catch (parseErr) {
            console.warn('Failed to parse pricing_factors for item:', item.order_item_id, parseErr);
            pricingFactors = {};
          }
        }

        // Enrich rental data with measurements
        if (item.service_type === 'rental') {
          enrichRentalWithMeasurements(specificData, (enrichedData) => {
            specificData = { ...enrichedData, ...pricingFactors };
            finalizeItem(item, specificData, pricingFactors, statusInfo);
          });
        } else {
          specificData = { ...specificData, ...pricingFactors };
          finalizeItem(item, specificData, pricingFactors, statusInfo);
        }
      } catch (itemErr) {
        console.error('Error processing order item:', item, itemErr);
        processedItems++;
        if (processedItems === itemsToProcess) {
          const finalOrders = Object.values(orders).filter(order => order.items.length > 0);
          console.log('Final processed orders:', finalOrders);
          res.json({ success: true, data: finalOrders });
        }
      }
    });
    
    function finalizeItem(item, specificData, pricingFactors, statusInfo) {
      let nextStatuses = [];
      try {
        if (OrderTracking.getNextStatuses && typeof OrderTracking.getNextStatuses === 'function') {
          nextStatuses = OrderTracking.getNextStatuses(item.service_type, item.status || 'pending');
          console.log(`Next statuses for item ${item.order_item_id} (${item.service_type}, ${item.status}):`, nextStatuses);
        } else {
          console.warn('getNextStatuses function not available, using empty array');
          nextStatuses = [];
        }
      } catch (statusErr) {
        console.warn('Failed to get next statuses for item:', item.order_item_id, statusErr);
        nextStatuses = [];
      }

      let paymentStatusDisplay = 'Unpaid';
      if (item.payment_status === 'paid') {
        paymentStatusDisplay = 'Paid';
      } else if (item.payment_status === 'down-payment') {
        paymentStatusDisplay = 'Down-payment';
      } else if (item.payment_status === 'fully_paid') {
        paymentStatusDisplay = 'Fully Paid';
      } else if (item.payment_status === 'cancelled') {
        paymentStatusDisplay = 'Cancelled';
      }

      orders[item.order_id].items.push({
        order_item_id: item.order_item_id,
      parent_order_id: item.parent_order_id || item.order_id,
      child_order_id: item.child_order_id || item.order_item_id,
        service_type: item.service_type,
        base_price: item.base_price,
        final_price: item.final_price,
        specific_data: specificData,
        status: item.status || 'pending',
        latest_tracking_note: item.notes || '',
        status_label: statusInfo.label,
        status_class: statusInfo.class,
        status_updated_at: item.status_updated_at,
        next_statuses: nextStatuses,
        rental_start_date: item.rental_start_date || null,
        rental_end_date: item.rental_end_date || null,
        rental_duration: item.rental_duration || pricingFactors.rental_duration || pricingFactors.duration || null,
        overdue_rate: item.overdue_rate || pricingFactors.overdue_rate || null,
        due_date: item.due_date || pricingFactors.due_date || item.rental_end_date || null,
        pricing_factors: pricingFactors,
        deposit_refunded: item.deposit_refunded || null,
        deposit_refund_date: item.deposit_refund_date || null,
        payment_status: item.payment_status || 'unpaid',
        payment_status_display: paymentStatusDisplay
      });
      
      processedItems++;
      if (processedItems === itemsToProcess) {
        const finalOrders = Object.values(orders).filter(order => order.items.length > 0);
        console.log('Final processed orders:', finalOrders);
        res.json({ success: true, data: finalOrders });
      }
    }
  });
};

exports.getOrderItemTrackingHistory = (req, res) => {
  const userId = req.user.id; 
  const orderItemId = req.params.id;

  Order.getOrderItemById(orderItemId, (err, orderItem) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Error fetching order item",
        error: err
      });
    }

    if (!orderItem) {
      return res.status(404).json({
        success: false,
        message: "Order item not found"
      });
    }

    Order.getOrderById(orderItem.order_id, (err, order) => {
      if (err || !order || order.user_id !== userId) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }

      OrderTracking.getTrackingHistory(orderItemId, (err, history) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: "Error fetching tracking history",
            error: err
          });
        }

        const formattedHistory = history.map(item => ({
          status: item.status,
          status_info: OrderTracking.getStatusInfo(item.status, orderItem.service_type),
          notes: item.notes,
          created_at: item.created_at,
          updated_by_name: item.updated_by_name || 'System'
        }));

        res.json({
          success: true,
          data: {
            order_item: orderItem,
            tracking_history: formattedHistory
          }
        });
      });
    });
  });
};

exports.updateTrackingStatus = (req, res) => {
  const adminId = req.user.id; 
  const { status, notes } = req.body;
  const orderItemId = req.params.id; 

  console.log('Received request to update tracking status');
  console.log('Request params:', req.params);
  console.log('Request body:', req.body);
  console.log('Order item ID from params:', orderItemId);
  console.log('Parsed order item ID type:', typeof orderItemId);
  console.log('Admin ID:', adminId);

  const orderItemID = parseInt(orderItemId);
  if (isNaN(orderItemID)) {
    console.log('Invalid order item ID provided:', orderItemId);
    return res.status(400).json({
      success: false,
      message: "Invalid order item ID provided"
    });
  }

  console.log('Updating tracking status for order item:', orderItemID, 'to status:', status);

  if (!status) {
    return res.status(400).json({
      success: false,
      message: "Status is required"
    });
  }

  Order.getOrderItemById(orderItemID, (err, orderItem) => {
    if (err) {
      console.error('Error fetching order item:', err);
      return res.status(500).json({
        success: false,
        message: "Error fetching order item",
        error: err
      });
    }

    if (!orderItem) {
      console.log('Order item not found:', orderItemID);
      return res.status(404).json({
        success: false,
        message: "Order item not found"
      });
    }

    console.log('Found order item:', orderItem);

    OrderTracking.getByOrderItemId(orderItemID, (err, currentTracking) => {
      if (err) {
        console.error('Error fetching current tracking:', err);
        return res.status(500).json({
          success: false,
          message: "Error fetching current tracking",
          error: err
        });
      }

      const currentStatus = currentTracking.length > 0 ? currentTracking[0].status : 'pending';
      const nextStatuses = OrderTracking.getNextStatuses(orderItem.service_type, currentStatus);

      console.log('Current status:', currentStatus, 'Next statuses:', nextStatuses);

      if (!nextStatuses.includes(status) && currentStatus !== status) {
        return res.status(400).json({
          success: false,
          message: `Invalid status transition. From '${currentStatus}' you can only go to: ${nextStatuses.join(', ')}`
        });
      }

      OrderTracking.updateStatus(orderItemID, status, notes || '', adminId, (err, result) => {
        if (err) {
          console.error('Error updating tracking status:', err);
          return res.status(500).json({
            success: false,
            message: "Error updating tracking status",
            error: err
          });
        }

        console.log('Tracking status updated successfully for order item:', orderItemID);

        let approvalStatus = status;
        const statusMapping = {
          'ready_to_pickup': 'ready_to_pickup',
          'ready_for_pickup': 'ready_to_pickup',
          'rented': 'rented',
          'returned': 'returned',
          'completed': 'completed',
          'in_progress': 'in_progress',
          'accepted': 'accepted',
          'price_confirmation': 'price_confirmation',
          'cancelled': 'cancelled'
        };
        
        if (statusMapping[status]) {
          approvalStatus = statusMapping[status];
        }

        const updateApprovalStatusSql = `UPDATE order_items SET approval_status = ? WHERE item_id = ?`;
        db.query(updateApprovalStatusSql, [approvalStatus, orderItemID], (updateErr, updateResult) => {
          if (updateErr) {
            console.error('Error updating approval_status:', updateErr);
            
          } else {
            console.log(`Updated approval_status to ${approvalStatus} for order item ${orderItemID}`);

            const billingHelper = require('../utils/billingHelper');
            const previousStatus = orderItem.approval_status || 'pending';
            
            if (approvalStatus !== previousStatus) {
              billingHelper.updateBillingStatus(
                orderItemID, 
                orderItem.service_type, 
                approvalStatus, 
                previousStatus, 
                (billingErr, billingResult) => {
                  if (billingErr) {
                    console.error('Error auto-updating billing status:', billingErr);
                  } else if (billingResult) {
                    console.log('Billing status auto-updated:', billingResult);
                  }
                }
              );
            }
          }
        });

        Order.getById(orderItem.order_id, (orderErr, order) => {
          if (orderErr) {
            console.error('Error fetching order:', orderErr);
          }
          
          if (!orderErr && order) {
            console.log('Found order for notification:', order);
            const userId = order.user_id;
            console.log('Creating notification for user:', userId, 'status:', status);

            if (status === 'accepted') {
              console.log('Creating accepted notification');
              Notification.createAcceptedNotification(userId, orderItemID, orderItem.service_type, (notifErr) => {
                if (notifErr) {
                  console.error('Failed to create accepted notification:', notifErr);
                } else {
                  console.log('Accepted notification created successfully');
                }
              });
            } else if (['in_progress', 'ready_to_pickup', 'completed', 'rented', 'returned'].includes(status)) {
              console.log('Creating status update notification');
              const serviceType = (orderItem.service_type || 'customize').toLowerCase().trim();
              Notification.createStatusUpdateNotification(userId, orderItemID, status, notes, serviceType, (notifErr) => {
                if (notifErr) {
                  console.error('Failed to create status update notification:', notifErr);
                } else {
                  console.log('Status update notification created successfully');
                }
              });
            }
          } else {
            console.log('Order not found or error fetching order for order item:', orderItem.order_id);
          }
        });

        res.json({
          success: true,
          message: "Tracking status updated successfully",
          data: {
            order_item_id: orderItemID,
            new_status: status,
            status_info: OrderTracking.getStatusInfo(status, orderItem.service_type)
          }
        });
      });
    });
  });
};

exports.confirmPickupByCustomer = (req, res) => {
  const userId = req.user.id;
  const orderItemId = parseInt(req.params.id, 10);

  if (Number.isNaN(orderItemId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid order item ID provided'
    });
  }

  Order.getOrderItemById(orderItemId, (itemErr, orderItem) => {
    if (itemErr) {
      return res.status(500).json({
        success: false,
        message: 'Error fetching order item',
        error: itemErr
      });
    }

    if (!orderItem) {
      return res.status(404).json({
        success: false,
        message: 'Order item not found'
      });
    }

    Order.getById(orderItem.order_id, (orderErr, orderRows) => {
      const order = Array.isArray(orderRows) ? orderRows[0] : orderRows;

      if (orderErr || !order) {
        return res.status(500).json({
          success: false,
          message: 'Error fetching order'
        });
      }

      if (order.user_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const serviceType = String(orderItem.service_type || '').toLowerCase();
      if (serviceType === 'rental') {
        return res.status(400).json({
          success: false,
          message: 'Pickup confirmation is not available for rental items via this action'
        });
      }

      OrderTracking.getByOrderItemId(orderItemId, (trackingErr, currentTracking) => {
        if (trackingErr) {
          return res.status(500).json({
            success: false,
            message: 'Error fetching current tracking',
            error: trackingErr
          });
        }

        const currentStatus = currentTracking.length > 0 ? currentTracking[0].status : (orderItem.approval_status || 'pending');
        const normalizedCurrentStatus = currentStatus === 'ready_for_pickup' ? 'ready_to_pickup' : currentStatus;

        if (normalizedCurrentStatus !== 'ready_to_pickup') {
          return res.status(400).json({
            success: false,
            message: 'Item is not yet ready for pickup confirmation'
          });
        }

        OrderTracking.updateStatus(orderItemId, 'picked_up', 'Picked up (confirmed by customer)', userId, (updateErr) => {
          if (updateErr) {
            return res.status(500).json({
              success: false,
              message: 'Error updating tracking status',
              error: updateErr
            });
          }

          db.query(
            'UPDATE order_items SET approval_status = ? WHERE item_id = ?',
            ['picked_up', orderItemId],
            (approvalErr) => {
              if (approvalErr) {
                console.error('Error updating approval_status after pickup confirmation:', approvalErr);
              }

              return res.json({
                success: true,
                message: 'Pickup confirmed successfully',
                data: {
                  order_item_id: orderItemId,
                  new_status: 'picked_up',
                  status_info: OrderTracking.getStatusInfo('picked_up', orderItem.service_type)
                }
              });
            }
          );
        });
      });
    });
  });
};

exports.requestEnhancement = (req, res) => {
  const userId = req.user.id;
  const orderItemId = req.params.id;
  const { notes, preferredCompletionDate, addAccessories } = req.body || {};

  const enhancementNotes = String(notes || '').trim();
  if (!enhancementNotes) {
    return res.status(400).json({
      success: false,
      message: 'Report / enhancement notes are required'
    });
  }

  const addAccessoriesFlag = addAccessories === true || addAccessories === 'true';
  const uploadedFiles = Array.isArray(req.files) ? req.files : [];
  const enhancementImageUrls = uploadedFiles.map(
    (f) => `/uploads/enhancement-requests/${f.filename}`
  );

  Order.getOrderItemById(orderItemId, (itemErr, orderItem) => {
    if (itemErr || !orderItem) {
      return res.status(404).json({
        success: false,
        message: 'Order item not found'
      });
    }

    Order.getById(orderItem.order_id, (orderErr, orderRows) => {
      const order = Array.isArray(orderRows) ? orderRows[0] : null;
      if (orderErr || !order || order.user_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const serviceType = String(orderItem.service_type || '').toLowerCase();
      const allowedServices = ['customization', 'customize', 'repair', 'dry_cleaning', 'drycleaning', 'dry-cleaning'];
      if (!allowedServices.includes(serviceType)) {
        return res.status(400).json({
          success: false,
          message: 'Enhancement is only available for customization, repair, and dry cleaning'
        });
      }

      const currentStatus = String(orderItem.approval_status || '').toLowerCase();
      if (currentStatus !== 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Enhancement request is only available for completed orders'
        });
      }

      const normalizedService = serviceType === 'customize' ? 'customization' : serviceType;
      const updateData = {
        approvalStatus: 'pending',
        adminNotes: `Customer requested report/enhancement: ${enhancementNotes}`,
        estimatedCompletionDate: preferredCompletionDate || null,
        pricingFactors: {
          enhancementRequest: true,
          enhancementPendingAdminReview: true,
          enhancementRequestedBy: 'customer',
          enhancementNotes,
          enhancementPreferredCompletionDate: preferredCompletionDate || null,
          enhancementUpdatedAt: new Date().toISOString(),
          addAccessories: addAccessoriesFlag,
          enhancementCancelledByAdmin: false,
          enhancementCancelledAt: null,
          enhancementImageUrls: enhancementImageUrls.length ? JSON.stringify(enhancementImageUrls) : '[]'
        }
      };

      const onUpdated = (updateErr) => {
        if (updateErr) {
          return res.status(500).json({
            success: false,
            message: 'Failed to request enhancement'
          });
        }
        return res.json({
          success: true,
          message: 'Enhancement request submitted. The admin will review and confirm the price.'
        });
      };

      if (normalizedService === 'customization') {
        const Customization = require('../model/CustomizationModel');
        return Customization.updateOrderItem(orderItemId, updateData, onUpdated);
      }

      const normalizedForOrderModel =
        normalizedService === 'drycleaning' || normalizedService === 'dry-cleaning'
          ? 'dry_cleaning'
          : normalizedService;

      if (normalizedForOrderModel === 'repair') {
        return Order.updateRepairOrderItem(orderItemId, updateData, onUpdated);
      }
      if (normalizedForOrderModel === 'dry_cleaning') {
        return Order.updateDryCleaningOrderItem(orderItemId, updateData, onUpdated);
      }

      return res.status(400).json({
        success: false,
        message: 'Unsupported service type for enhancement request'
      });
    });
  });
};

exports.initializeOrderTracking = (orderItems, callback) => {
  let completed = 0;
  const total = orderItems.length;
  const errors = [];

  if (total === 0) {
    return callback(null, { initialized: 0, errors: [] });
  }

  orderItems.forEach(item => {
    OrderTracking.initializeOrderTracking([item], (err, result) => {
      completed++;
      
      if (err) {
        errors.push({
          order_item_id: item.order_item_id,
          error: err.message
        });
      }

      if (completed === total) {
        callback(null, {
          initialized: total - errors.length,
          errors: errors
        });
      }
    });
  });
};

exports.getStatusTransitions = (req, res) => {
  const orderItemId = req.params.id;
  const orderItemID = parseInt(orderItemId);
  if (isNaN(orderItemID)) {
    return res.status(400).json({
      success: false,
      message: "Invalid order item ID provided"
    });
  }

  Order.getOrderItemById(orderItemID, (err, orderItem) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Error fetching order item",
        error: err
      });
    }

    if (!orderItem) {
      return res.status(404).json({
        success: false,
        message: "Order item not found"
      });
    }

    OrderTracking.getByOrderItemId(orderItemID, (err, tracking) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Error fetching tracking",
          error: err
        });
      }

      const currentStatus = tracking.length > 0 ? tracking[0].status : 'pending';
      const nextStatuses = OrderTracking.getNextStatuses(orderItem.service_type, currentStatus);

      const statusOptions = nextStatuses.map(status => ({
        value: status,
        label: OrderTracking.getStatusInfo(status, orderItem.service_type).label,
        class: OrderTracking.getStatusInfo(status, orderItem.service_type).class
      }));

      res.json({
        success: true,
        data: {
          current_status: currentStatus,
          current_status_info: OrderTracking.getStatusInfo(currentStatus, orderItem.service_type),
          next_statuses: statusOptions,
          service_type: orderItem.service_type
        }
      });
    });
  });
};
