const db = require('../config/db');

const Customization = {
  
  getAllOrders: (callback) => {
    const sql = `
      SELECT 
        oi.*,
        o.order_id,
        o.user_id,
        o.order_type,
        o.walk_in_customer_id,
        o.status as order_status,
        o.notes as order_notes,
        u.first_name,
        u.last_name,
        u.email,
        u.phone_number,
        wc.name as walk_in_customer_name,
        wc.email as walk_in_customer_email,
        wc.phone as walk_in_customer_phone,
        DATE_FORMAT(o.order_date, '%Y-%m-%d %H:%i:%s') as order_date,
        DATE_FORMAT(oi.appointment_date, '%Y-%m-%d %H:%i:%s') as appointment_date
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      LEFT JOIN user u ON o.user_id = u.user_id
      LEFT JOIN walk_in_customers wc ON o.walk_in_customer_id = wc.id
      WHERE oi.service_type = 'customization'
      ORDER BY o.order_date DESC
    `;
    
    db.query(sql, (err, results) => {
      if (err) return callback(err, null);

      const orders = results.map(order => ({
        ...order,
        pricing_factors: JSON.parse(order.pricing_factors || '{}'),
        specific_data: JSON.parse(order.specific_data || '{}')
      }));
      
      callback(null, orders);
    });
  },

  getByUserId: (userId, callback) => {
    const sql = `
      SELECT 
        oi.*,
        o.order_id,
        o.user_id,
        o.status as order_status,
        o.notes as order_notes,
        DATE_FORMAT(o.order_date, '%Y-%m-%d %H:%i:%s') as order_date,
        DATE_FORMAT(oi.appointment_date, '%Y-%m-%d %H:%i:%s') as appointment_date
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      WHERE o.user_id = ? AND oi.service_type = 'customization'
      ORDER BY o.order_date DESC
    `;
    
    db.query(sql, [userId], (err, results) => {
      if (err) return callback(err, null);

      const orders = results.map(order => ({
        ...order,
        pricing_factors: JSON.parse(order.pricing_factors || '{}'),
        specific_data: JSON.parse(order.specific_data || '{}')
      }));
      
      callback(null, orders);
    });
  },

  getOrderItemById: (itemId, callback) => {
    const sql = `
      SELECT 
        oi.*,
        o.user_id,
        o.order_date,
        o.status as order_status,
        u.first_name,
        u.last_name,
        u.email,
        u.phone_number
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      JOIN user u ON o.user_id = u.user_id
      WHERE oi.item_id = ? AND oi.service_type = 'customization'
    `;
    
    db.query(sql, [itemId], (err, results) => {
      if (err) return callback(err, null);
      if (results.length === 0) return callback(null, null);
      
      const order = {
        ...results[0],
        pricing_factors: JSON.parse(results[0].pricing_factors || '{}'),
        specific_data: JSON.parse(results[0].specific_data || '{}')
      };
      
      callback(null, order);
    });
  },

  updateOrderItem: (itemId, updateData, callback) => {
    const { finalPrice, approvalStatus, adminNotes, pricingFactors } = updateData;
    const estimatedCompletionDate =
      updateData?.estimatedCompletionDate ||
      pricingFactors?.estimatedCompletionDate ||
      pricingFactors?.estimated_completion_date ||
      null;
    
    console.log("Customization Model - Updating item:", itemId, updateData);

    let updates = [];
    let values = [];
    
    if (finalPrice !== undefined) {
      updates.push('final_price = ?');
      values.push(finalPrice);
      console.log("Adding final_price update:", finalPrice);
    }
    
    if (approvalStatus !== undefined) {
      updates.push('approval_status = ?');
      values.push(approvalStatus);
      console.log("Adding approval_status update:", approvalStatus);
    }
    
    if (adminNotes !== undefined) {
      updates.push('pricing_factors = JSON_SET(COALESCE(pricing_factors, \'{}\'), \'$.adminNotes\', ?)');
      values.push(adminNotes || '');
      console.log("Adding adminNotes update:", adminNotes);
    }

    if (finalPrice !== undefined) {
      updates.push('pricing_factors = JSON_SET(COALESCE(pricing_factors, \'{}\'), \'$.adminPriceUpdated\', true)');
      console.log("Setting adminPriceUpdated flag");
    }
    
    if (pricingFactors) {
      
      Object.keys(pricingFactors).forEach(key => {
        updates.push(`pricing_factors = JSON_SET(COALESCE(pricing_factors, '{}'), '$.${key}', ?)`);
        values.push(pricingFactors[key]);
      });
    }
    
    if (updates.length === 0) {
      return callback(new Error('No fields to update'));
    }
    
    values.push(itemId);
    
    const sql = `UPDATE order_items SET ${updates.join(', ')} WHERE item_id = ?`;
    console.log("Customization Model - SQL:", sql);
    console.log("Customization Model - Values:", values);
    
    db.query(sql, values, (err, result) => {
      console.log("Customization Model - Query result:", err, result);
      
      if (err) {
        return callback(err, null);
      }

      const getOrderSql = `
        SELECT oi.*, o.user_id 
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.order_id
        WHERE oi.item_id = ?
      `;
      
      db.query(getOrderSql, [itemId], (orderErr, orderResults) => {
        if (!orderErr && orderResults && orderResults.length > 0) {
          const orderItem = orderResults[0];
          const userId = orderItem.user_id;
          const Notification = require('./NotificationModel');

          if (finalPrice !== undefined && approvalStatus === 'price_confirmation') {
            Notification.createPriceConfirmationNotification(userId, itemId, finalPrice, (notifErr) => {
              if (notifErr) console.error('Failed to create price confirmation notification:', notifErr);
            });
          }

          if (approvalStatus === 'accepted') {
            Notification.createAcceptedNotification(userId, itemId, orderItem.service_type, (notifErr) => {
              if (notifErr) console.error('Failed to create accepted notification:', notifErr);
            });
          }

          if (estimatedCompletionDate) {
            Notification.createEstimatedCompletionDateNotification(
              userId,
              itemId,
              estimatedCompletionDate,
              orderItem.service_type,
              (notifErr) => {
                if (notifErr) console.error('Failed to create estimated completion date notification:', notifErr);
              }
            );
          }

          if (pricingFactors?.enhancementUpdatedAt) {
            Notification.createEnhancementNotification(
              userId,
              itemId,
              orderItem.service_type,
              pricingFactors?.enhancementNotes || '',
              pricingFactors?.enhancementAdditionalCost || 0,
              (notifErr) => {
                if (notifErr) console.error('Failed to create enhancement notification:', notifErr);
              }
            );
          }
        }

        continueWithTracking();
      });
      
      function continueWithTracking() {
        
        if (approvalStatus !== undefined) {
          console.log("Approval status was updated, syncing to tracking table...");
          const OrderTracking = require('./OrderTrackingModel');

          const statusMap = {
            'pending_review': 'pending',
            'pending': 'pending',
            'accepted': 'accepted',
            'price_confirmation': 'price_confirmation',
            'confirmed': 'in_progress',
            'in_progress': 'in_progress',
            'ready_for_pickup': 'ready_to_pickup',
            'ready_to_pickup': 'ready_to_pickup',
            'completed': 'completed',
            'cancelled': 'cancelled',
            'price_declined': 'price_declined'
          };
          
          const trackingStatus = statusMap[approvalStatus] || 'pending';

          let notes = 'Order status updated';
          if (approvalStatus === 'price_confirmation' && finalPrice !== undefined) {
            const priceValue = typeof finalPrice === 'number' ? finalPrice : parseFloat(finalPrice) || 0;
            notes = `Price updated to ₱${priceValue.toFixed(2)}. Awaiting customer confirmation.`;
          } else if (adminNotes) {
            notes = adminNotes;
          }
          
          console.log("Syncing to tracking table:", itemId, "from", approvalStatus, "to", trackingStatus);

          OrderTracking.getByOrderItemId(itemId, (trackErr, existingTracking) => {
            if (trackErr) {
              console.error("Error checking existing tracking:", trackErr);
              return callback(null, result);
            }
            
            console.log("Existing tracking:", existingTracking);
            
            if (existingTracking && existingTracking.length > 0) {
              
              console.log("Updating existing tracking entry...");
              OrderTracking.updateStatus(itemId, trackingStatus, notes, null, (updateErr) => {
                if (updateErr) {
                  console.error("Failed to update tracking table:", updateErr);
                } else {
                  console.log("Successfully updated tracking table");
                }
                callback(null, result);
              });
            } else {
              
              console.log("Creating new tracking entry...");
              OrderTracking.addTracking(itemId, trackingStatus, notes, null, (addErr) => {
                if (addErr) {
                  console.error("Failed to create tracking entry:", addErr);
                } else {
                  console.log("Successfully created tracking entry");
                }
                callback(null, result);
              });
            }
          });
        } else {
          
          callback(null, result);
        }
      }
    });
  },

  updateApprovalStatus: (itemId, status, callback) => {
    const sql = `UPDATE order_items SET approval_status = ? WHERE item_id = ?`;
    db.query(sql, [status, itemId], (err, result) => {
      if (err) {
        return callback(err, null);
      }

      const OrderTracking = require('./OrderTrackingModel');

      const trackingStatus = status === 'price_confirmation' ? 'price_confirmation' :
                             status === 'accepted' ? 'accepted' :
                             status === 'in_progress' ? 'in_progress' :
                             status === 'ready_to_pickup' ? 'ready_to_pickup' :
                             status === 'completed' ? 'completed' :
                             status === 'cancelled' ? 'cancelled' :
                             status === 'price_declined' ? 'price_declined' :
                             status;
      
      const notes = `Order status updated to ${status}`;

      OrderTracking.getByOrderItemId(itemId, (trackErr, existingTracking) => {
        if (trackErr) {
          console.error('Error checking existing tracking:', trackErr);
          return callback(null, result);
        }
        
        if (existingTracking && existingTracking.length > 0) {
          
          OrderTracking.updateStatus(itemId, trackingStatus, notes, null, (updateErr) => {
            if (updateErr) {
              console.error('Failed to update tracking table:', updateErr);
            } else {
              console.log('Successfully updated tracking table');
            }
            callback(null, result);
          });
        } else {
          
          OrderTracking.addTracking(itemId, trackingStatus, notes, null, (addErr) => {
            if (addErr) {
              console.error('Failed to create tracking entry:', addErr);
            } else {
              console.log('Successfully created tracking entry');
            }
            callback(null, result);
          });
        }
      });
    });
  },

  getStats: (callback) => {
    const sql = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN approval_status IS NULL OR approval_status = 'pending' OR approval_status = 'pending_review' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN approval_status = 'accepted' THEN 1 ELSE 0 END) as accepted,
        SUM(CASE WHEN approval_status = 'confirmed' THEN 1 ELSE 0 END) as inProgress,
        SUM(CASE WHEN approval_status = 'ready_for_pickup' THEN 1 ELSE 0 END) as toPickup,
        SUM(CASE WHEN approval_status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN approval_status = 'cancelled' THEN 1 ELSE 0 END) as rejected
      FROM order_items
      WHERE service_type = 'customization'
    `;
    
    db.query(sql, callback);
  }
};

module.exports = Customization;
