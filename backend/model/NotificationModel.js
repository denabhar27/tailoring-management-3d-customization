const db = require('../config/db');

const Notification = {
  
  create: (userId, orderItemId, type, title, message, callback) => {
    const sql = `
      INSERT INTO notifications (user_id, order_item_id, type, title, message)
      VALUES (?, ?, ?, ?, ?)
    `;
    console.log('[NOTIFICATION] Creating notification:', { userId, orderItemId, type, title, message: message.substring(0, 50) + '...' });
    db.query(sql, [userId, orderItemId, type, title, message], (err, result) => {
      if (err) {
        console.error('[NOTIFICATION] Error creating notification:', err);
        console.error('[NOTIFICATION] SQL:', sql);
        console.error('[NOTIFICATION] Params:', [userId, orderItemId, type, title, message]);
      } else {
        console.log('[NOTIFICATION] Notification created successfully, ID:', result.insertId);
      }
      if (callback) callback(err, result);
    });
  },

  getByUserId: (userId, callback) => {
    const sql = `
      SELECT 
        n.*,
        oi.service_type,
        oi.specific_data,
        DATE_FORMAT(n.created_at, '%Y-%m-%d %H:%i:%s') as created_at
      FROM notifications n
      LEFT JOIN order_items oi ON n.order_item_id = oi.item_id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
    `;
    db.query(sql, [userId], callback);
  },

  getUnreadCount: (userId, callback) => {
    const sql = `
      SELECT COUNT(*) as unread_count
      FROM notifications
      WHERE user_id = ? AND is_read = FALSE
    `;
    db.query(sql, [userId], callback);
  },

  markAsRead: (notificationId, userId, callback) => {
    const sql = `
      UPDATE notifications
      SET is_read = TRUE
      WHERE notification_id = ? AND user_id = ?
    `;
    db.query(sql, [notificationId, userId], callback);
  },

  markAllAsRead: (userId, callback) => {
    const sql = `
      UPDATE notifications
      SET is_read = TRUE
      WHERE user_id = ? AND is_read = FALSE
    `;
    db.query(sql, [userId], callback);
  },

  delete: (notificationId, userId, callback) => {
    const sql = `
      DELETE FROM notifications
      WHERE notification_id = ? AND user_id = ?
    `;
    db.query(sql, [notificationId, userId], callback);
  },

  deleteAll: (userId, callback) => {
    const sql = `
      DELETE FROM notifications
      WHERE user_id = ?
    `;
    db.query(sql, [userId], callback);
  },

  createAcceptedNotification: (userId, orderItemId, serviceType, callback) => {
    const serviceTypeLabels = {
      'repair': 'Repair',
      'dry_cleaning': 'Dry Cleaning',
      'rental': 'Rental',
      'customize': 'Customization'
    };
    
    const serviceLabel = serviceTypeLabels[serviceType] || 'Service';
    const title = `✅ ${serviceLabel} Request Accepted!`;
    
    let message;
    if (serviceType === 'rental') {
      message = `Great news! Your rental request has been accepted. Please visit our store to pick up your rental item.`;
    } else if (serviceType === 'dry_cleaning') {
      message = `Your dry cleaning request has been accepted! Please drop off your items at our store so we can begin processing.`;
    } else if (serviceType === 'repair') {
      message = `Your repair request has been accepted! Please drop off your item at our store so we can assess and fix it.`;
    } else if (serviceType === 'customize') {
      message = `Your customization request has been accepted! Please drop off your item at our store so we can begin the customization process.`;
    } else {
      message = `Your ${serviceLabel.toLowerCase()} request has been accepted. Please drop the item in the store.`;
    }
    
    console.log('[NOTIFICATION] Creating accepted notification:', { userId, orderItemId, serviceType, title, message });
    Notification.create(userId, orderItemId, 'accepted', title, message, callback);
  },

  createStatusUpdateNotification: (userId, orderItemId, status, notes, serviceType, callback) => {
    
    if (notes) {
      const title = `Order Status Updated`;
      Notification.create(userId, orderItemId, 'status_update', title, notes, callback);
      return;
    }

    const serviceTypeLabels = {
      'repair': 'Repair',
      'dry_cleaning': 'Dry Cleaning',
      'rental': 'Rental',
      'customize': 'Customization'
    };
    
    const serviceLabel = serviceTypeLabels[serviceType] || 'Service';
    let title, message;

    switch (status) {
      case 'in_progress':
        title = `${serviceLabel} In Progress`;
        if (serviceType === 'rental') {
          message = `Your rental item is now being prepared. We'll notify you once it's ready for pickup!`;
        } else if (serviceType === 'dry_cleaning') {
          message = `Your dry cleaning service is now in progress. We're taking care of your items!`;
        } else if (serviceType === 'repair') {
          message = `Your repair service is now in progress. Our team is working on your item!`;
        } else {
          message = `Your ${serviceLabel.toLowerCase()} is now being processed. We'll keep you updated on the progress!`;
        }
        break;
      
      case 'ready_to_pickup':
        if (serviceType === 'rental') {
          title = `🎉 Your Rental Clothes Are Ready!`;
          message = `Your rental clothes are ready for pickup! Please visit our store to collect your items.`;
        } else if (serviceType === 'dry_cleaning') {
          title = `✅ Your Dry Cleaning Is Ready!`;
          message = `Your dry cleaning service is complete and ready for pickup! Please visit our store to collect your items.`;
        } else if (serviceType === 'repair') {
          title = `✅ Your Repair Is Complete!`;
          message = `Your repair service is complete and ready for pickup! Please visit our store to collect your item.`;
        } else {
          title = `✅ Ready for Pickup`;
          message = `Your ${serviceLabel.toLowerCase()} is ready for pickup! Please visit our store to collect your item.`;
        }
        break;
      
      case 'picked_up':
        if (serviceType === 'rental') {
          title = `Rental Item Picked Up`;
          message = `You've successfully picked up your rental item. Enjoy your rental period!`;
        } else {
          title = `Item Picked Up`;
          message = `Thank you for picking up your ${serviceLabel.toLowerCase()}! We hope you're satisfied with our service.`;
        }
        break;
      
      case 'rented':
        title = `Rental Started`;
        message = `Your rental period has begun! Please return the item by the due date.`;
        break;
      
      case 'returned':
        title = `Rental Item Returned`;
        message = `Thank you for returning the rental item! Your rental service is now complete.`;
        break;
      
      case 'completed':
        if (serviceType === 'rental') {
          title = `✅ Rental Service Completed`;
          message = `Your rental service has been completed successfully! Thank you for choosing our services.`;
        } else if (serviceType === 'dry_cleaning') {
          title = `✅ Dry Cleaning Completed`;
          message = `Your dry cleaning service has been completed successfully! Thank you for choosing our services.`;
        } else if (serviceType === 'repair') {
          title = `✅ Repair Completed`;
          message = `Your repair service has been completed successfully! Thank you for choosing our services.`;
        } else {
          title = `✅ Service Completed`;
          message = `Your ${serviceLabel.toLowerCase()} has been completed successfully! Thank you for choosing our services.`;
        }
        break;
      
      case 'cancelled':
        title = `Order Cancelled`;
        message = `Your ${serviceLabel.toLowerCase()} order has been cancelled. If you have any questions, please contact us.`;
        break;
      
      default:
        title = `Order Status Updated`;
        message = `Your ${serviceLabel.toLowerCase()} order status has been updated to: ${status}.`;
    }
    
    Notification.create(userId, orderItemId, 'status_update', title, message, callback);
  },

  createPriceConfirmationNotification: (userId, orderItemId, finalPrice, callback) => {
    const title = 'Price Confirmation Required';
    const message = `The final price for your service has been updated to ₱${parseFloat(finalPrice).toLocaleString()}. Please review and confirm.`;
    Notification.create(userId, orderItemId, 'price_confirmation', title, message, callback);
  },

  createEstimatedCompletionDateNotification: (userId, orderItemId, estimatedCompletionDate, serviceType, callback) => {
    const serviceTypeLabels = {
      'repair': 'Repair',
      'dry_cleaning': 'Dry Cleaning',
      'rental': 'Rental',
      'customize': 'Customization',
      'customization': 'Customization'
    };

    const normalizedServiceType = String(serviceType || '').toLowerCase();
    const serviceLabel = serviceTypeLabels[normalizedServiceType] || 'Service';
    const formattedDate = estimatedCompletionDate
      ? new Date(estimatedCompletionDate).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        })
      : 'soon';

    const title = `Estimated Completion Date Updated`;
    const message = `Your ${serviceLabel.toLowerCase()} order now has an estimated completion date of ${formattedDate}.`;
    Notification.create(userId, orderItemId, 'date_reminder', title, message, callback);
  },

  createEnhancementNotification: (userId, orderItemId, serviceType, enhancementNotes, additionalCost, callback) => {
    const serviceTypeLabels = {
      'repair': 'Repair',
      'dry_cleaning': 'Dry Cleaning',
      'rental': 'Rental',
      'customize': 'Customization',
      'customization': 'Customization'
    };

    const normalizedServiceType = String(serviceType || '').toLowerCase();
    const serviceLabel = serviceTypeLabels[normalizedServiceType] || 'Service';
    const parsedAdditionalCost = parseFloat(additionalCost || 0);
    const hasAdditionalCost = Number.isFinite(parsedAdditionalCost) && parsedAdditionalCost > 0;
    const title = `Enhancement In Progress`;
    const message = hasAdditionalCost
      ? `Your ${serviceLabel.toLowerCase()} request has been enhanced and is now in progress. Additional cost: ₱${parsedAdditionalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.${enhancementNotes ? ` Notes: ${enhancementNotes}` : ''}`
      : `Your ${serviceLabel.toLowerCase()} request has been enhanced and is now in progress.${enhancementNotes ? ` Notes: ${enhancementNotes}` : ''}`;

    Notification.create(userId, orderItemId, 'status_update', title, message, callback);
  },

  createAppointmentReminderNotification: (userId, orderItemId, appointmentDate, callback) => {
    const title = 'Appointment Reminder';
    const message = `Reminder: Your appointment is tomorrow (${appointmentDate}). Please don't forget!`;
    Notification.create(userId, orderItemId, 'appointment_reminder', title, message, callback);
  },

  createPaymentSuccessNotification: (userId, orderItemId, amount, paymentMethod, serviceType, callback) => {
    const serviceTypeLabels = {
      'repair': 'Repair',
      'dry_cleaning': 'Dry Cleaning',
      'rental': 'Rental',
      'customize': 'Customization'
    };
    
    const serviceLabel = serviceTypeLabels[serviceType] || 'Service';
    const formattedAmount = parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const paymentMethodLabel = paymentMethod === 'cash' ? 'Cash' : 
                               paymentMethod === 'card' ? 'Card' : 
                               paymentMethod === 'online' ? 'Online' : 
                               paymentMethod || 'Payment';
    
    const title = `💳 Payment Successful!`;
    let message;
    
    if (serviceType === 'rental') {
      message = `Your payment of ₱${formattedAmount} via ${paymentMethodLabel} for your rental service has been successfully processed. Thank you for your payment!`;
    } else {
      message = `Your payment of ₱${formattedAmount} via ${paymentMethodLabel} for your ${serviceLabel.toLowerCase()} service has been successfully processed. Thank you for your payment!`;
    }
    
    Notification.create(userId, orderItemId, 'payment_success', title, message, callback);
  },

  createPreferredDateReminderNotification: (userId, orderItemId, date, dateType, serviceType, callback) => {
    const serviceTypeLabels = {
      'repair': 'Repair',
      'dry_cleaning': 'Dry Cleaning',
      'rental': 'Rental',
      'customize': 'Customization'
    };
    
    const serviceLabel = serviceTypeLabels[serviceType] || 'Service';
    const formattedDate = new Date(date).toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    let title, message;
    
    switch (dateType) {
      case 'sizing':
        title = `📏 Sizing Appointment Reminder`;
        message = `Reminder: Your sizing appointment for ${serviceLabel.toLowerCase()} is scheduled for ${formattedDate}. Please arrive on time!`;
        break;
      case 'drop_off':
        title = `📦 Drop-Off Reminder`;
        if (serviceType === 'rental') {
          message = `Reminder: Please drop off your rental item on ${formattedDate}. We'll prepare it for you!`;
        } else if (serviceType === 'dry_cleaning') {
          message = `Reminder: Please drop off your items for dry cleaning on ${formattedDate}. We'll take care of them!`;
        } else if (serviceType === 'repair') {
          message = `Reminder: Please drop off your item for repair on ${formattedDate}. Our team will assess it!`;
        } else {
          message = `Reminder: Please drop off your item for ${serviceLabel.toLowerCase()} on ${formattedDate}.`;
        }
        break;
      case 'pickup':
        title = `🎉 Pickup Reminder`;
        if (serviceType === 'rental') {
          message = `Reminder: Your rental items will be ready for pickup on ${formattedDate}. Please visit our store to collect them!`;
        } else if (serviceType === 'dry_cleaning') {
          message = `Reminder: Your dry cleaning will be ready for pickup on ${formattedDate}. Please visit our store to collect your items!`;
        } else if (serviceType === 'repair') {
          message = `Reminder: Your repaired item will be ready for pickup on ${formattedDate}. Please visit our store to collect it!`;
        } else {
          message = `Reminder: Your ${serviceLabel.toLowerCase()} will be ready for pickup on ${formattedDate}. Please visit our store!`;
        }
        break;
      default:
        title = `📅 Appointment Reminder`;
        message = `Reminder: You have an appointment scheduled for ${formattedDate}. Please don't forget!`;
    }
    
    Notification.create(userId, orderItemId, 'date_reminder', title, message, callback);
  },

  createMeasurementUpdateNotification: (userId, isUpdate, callback) => {
    const title = isUpdate ? `📏 Measurements Updated` : `📏 Measurements Added`;
    const message = isUpdate 
      ? `Your measurements have been updated by our team. These will be used for your future orders.`
      : `Your measurements have been added by our team. These will be used for your future orders.`;

    Notification.create(userId, null, 'measurement_update', title, message, callback);
  }
};

module.exports = Notification;
