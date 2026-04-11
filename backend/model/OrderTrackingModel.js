const db = require('../config/db');

const OrderTracking = {
  
  getByOrderItemId: (orderItemId, callback) => {
    const sql = `
      SELECT * FROM order_tracking 
      WHERE order_item_id = ? 
      ORDER BY created_at DESC
    `;
    console.log("Getting tracking entries for item:", orderItemId);
    db.query(sql, [orderItemId], (err, results) => {
      console.log("Tracking entries found:", err, results);
      callback(err, results);
    });
  },

  getByUserId: (userId, callback) => {
    const sql = `
      SELECT 
        oi.item_id as order_item_id,
        o.order_id as parent_order_id,
        oi.item_id as child_order_id,
        oi.order_id,
        oi.service_type,
        oi.final_price,
        oi.specific_data,
        ot.status,
        ot.notes,
        ot.created_at as status_updated_at,
        o.order_date,
        o.total_price
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      LEFT JOIN order_tracking ot ON oi.item_id = ot.order_item_id
      WHERE o.user_id = ?
      ORDER BY o.order_date DESC, oi.item_id DESC, ot.created_at DESC
    `;
    db.query(sql, [userId], callback);
  },

  getLatestStatusByUserId: (userId, callback) => {
    const sql = `
      SELECT 
        oi.item_id as order_item_id,
        o.order_id as parent_order_id,
        oi.item_id as child_order_id,
        oi.order_id,
        oi.service_type,
        oi.base_price,
        oi.final_price,
        oi.specific_data,
        oi.pricing_factors,
        oi.payment_status,
        oi.deposit_refunded,
        oi.deposit_refund_date,
        DATE_FORMAT(oi.rental_start_date, '%Y-%m-%d') as rental_start_date,
        DATE_FORMAT(oi.rental_end_date, '%Y-%m-%d') as rental_end_date,
        oi.rental_duration,
        oi.overdue_rate,
        DATE_FORMAT(oi.due_date, '%Y-%m-%d') as due_date,
        DATEDIFF(COALESCE(oi.due_date, oi.rental_end_date), oi.rental_start_date) as rental_period,
        COALESCE(
          (SELECT ot.status 
           FROM order_tracking ot 
           WHERE ot.order_item_id = oi.item_id 
           ORDER BY ot.created_at DESC 
           LIMIT 1), 
          'pending'
        ) as status,
        COALESCE(
          (SELECT ot.notes 
           FROM order_tracking ot 
           WHERE ot.order_item_id = oi.item_id 
           ORDER BY ot.created_at DESC 
           LIMIT 1), 
          'Order created'
        ) as notes,
        COALESCE(
          (SELECT ot.created_at 
           FROM order_tracking ot 
           WHERE ot.order_item_id = oi.item_id 
           ORDER BY ot.created_at DESC 
           LIMIT 1), 
          o.order_date
        ) as tracking_status_updated_at,
        GREATEST(
          COALESCE((
            SELECT MAX(ot.created_at)
            FROM order_tracking ot
            WHERE ot.order_item_id = oi.item_id
          ), '1970-01-01 00:00:00'),
          COALESCE((
            SELECT MAX(al.created_at)
            FROM action_logs al
            WHERE al.order_item_id = oi.item_id
          ), '1970-01-01 00:00:00'),
          COALESCE((
            SELECT MAX(tl.created_at)
            FROM transaction_logs tl
            WHERE tl.order_item_id = oi.item_id
          ), '1970-01-01 00:00:00'),
          COALESCE(o.order_date, '1970-01-01 00:00:00')
        ) as status_updated_at,
        o.order_date,
        o.total_price
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      WHERE o.user_id = ?
      ORDER BY status_updated_at DESC, oi.item_id DESC
    `;
    db.query(sql, [userId], callback);
  },

  addTracking: (orderItemId, status, notes, adminId, callback) => {
    const sql = `
      INSERT INTO order_tracking (order_item_id, status, notes, updated_by)
      VALUES (?, ?, ?, ?)
    `;
    console.log("Adding tracking entry:", { orderItemId, status, notes, adminId });
    db.query(sql, [orderItemId, status, notes, adminId], (err, result) => {
      console.log("Tracking add result:", err, result);
      callback(err, result);
    });
  },

  updateStatus: (orderItemId, status, notes, adminId, callback) => {
    const sql = `
      INSERT INTO order_tracking (order_item_id, status, notes, updated_by)
      VALUES (?, ?, ?, ?)
    `;
    console.log("Inserting tracking entry:", { orderItemId, status, notes, adminId });
    db.query(sql, [orderItemId, status, notes, adminId], (err, result) => {
      console.log("Tracking insert result:", err, result);
      callback(err, result);
    });
  },

  getTrackingHistory: (orderItemId, callback) => {
    const sql = `
      SELECT 
        ot.status,
        ot.notes,
        ot.created_at,
        u.name as updated_by_name
      FROM order_tracking ot
      LEFT JOIN users u ON ot.updated_by = u.user_id
      WHERE ot.order_item_id = ?
      ORDER BY ot.created_at DESC
    `;
    db.query(sql, [orderItemId], callback);
  },

  initializeOrderTracking: (orderItems, callback) => {
    if (!orderItems || orderItems.length === 0) {
      return callback(null, 'No order items to initialize');
    }

    let completed = 0;
    const errors = [];

    orderItems.forEach((item, index) => {
      const initialStatus = OrderTracking.getInitialStatus(item.service_type);
      const sql = `
        INSERT INTO order_tracking (order_item_id, status, notes, updated_by)
        VALUES (?, ?, ?, NULL)
      `;

      db.query(sql, [item.order_item_id || item.item_id, initialStatus, 'Order created'], (err, result) => {
        completed++;

        if (err) {
          errors.push(`Item ${index + 1}: ${err.message}`);
        }

        if (completed === orderItems.length) {
          if (errors.length > 0) {
            console.warn('Some tracking items failed to initialize:', errors);
          }
          callback(errors.length > 0 ? new Error(errors.join('; ')) : null,
            { success: true, errors: errors });
        }
      });
    });
  },

  getInitialStatus: (serviceType) => {
    switch (serviceType) {
      case 'repair':
      case 'customize':
      case 'dry_cleaning':
        return 'pending';
      case 'rental':
        return 'pending';
      default:
        return 'pending';
    }
  },

  getStatusTransitions: (serviceType, currentStatus) => {
    
    const flows = {
      'repair': {
        'pending': ['accepted', 'cancelled'],
        'accepted': ['in_progress', 'cancelled'],
        'price_confirmation': ['accepted', 'cancelled'],
        'in_progress': ['ready_to_pickup', 'cancelled'],
        'ready_to_pickup': ['picked_up', 'cancelled'],
        'picked_up': ['completed'],
        'completed': [],
        'cancelled': [],
        'price_declined': []
      },
      'dry_cleaning': {
        'pending': ['accepted', 'cancelled'],
        'accepted': ['in_progress', 'cancelled'],
        'price_confirmation': ['accepted', 'cancelled'],
        'in_progress': ['ready_to_pickup', 'cancelled'],
        'ready_to_pickup': ['picked_up', 'cancelled'],
        'picked_up': ['completed'],
        'completed': [],
        'cancelled': [],
        'price_declined': []
      },
      'rental': {
        'pending': ['rented', 'cancelled'],
        'ready_to_pickup': ['rented', 'returned', 'completed', 'cancelled'],
        'picked_up': ['rented'],
        'rented': ['returned', 'completed'],
        'returned': ['completed'],
        'completed': [],
        'cancelled': []
      }
    };

    const flow = flows[serviceType] || flows['repair'];
    return flow[currentStatus] || [];
  },

  getNextStatuses: (serviceType, currentStatus) => {
    const statusFlow = {
      'repair': {
        'pending': ['accepted', 'cancelled'],
        'accepted': ['in_progress', 'cancelled'],
        'price_confirmation': ['accepted', 'cancelled'],
        'in_progress': ['ready_to_pickup', 'cancelled'],
        'ready_to_pickup': ['picked_up', 'cancelled'],
        'picked_up': ['completed'],
        'completed': [],
        'cancelled': [],
        'price_declined': []
      },
      'dry_cleaning': {
        'pending': ['accepted', 'cancelled'],
        'accepted': ['in_progress', 'cancelled'],
        'price_confirmation': ['accepted', 'cancelled'],
        'in_progress': ['ready_to_pickup', 'cancelled'],
        'ready_to_pickup': ['picked_up', 'cancelled'],
        'picked_up': ['completed'],
        'completed': [],
        'cancelled': [],
        'price_declined': []
      },
      'rental': {
        'pending': ['rented', 'cancelled'],
        'ready_to_pickup': ['rented', 'returned', 'completed', 'cancelled'],
        'picked_up': ['rented'],
        'rented': ['returned', 'completed'],
        'returned': ['completed'],
        'completed': [],
        'cancelled': []
      }
    };

    const flow = statusFlow[serviceType] || statusFlow['repair'];
    return flow[currentStatus] || [];
  },

  getStatusInfo: (status, serviceType) => {
    const statusMap = {
      'pending': { label: 'Pending', class: 'pending' },
      'accepted': { label: 'Accepted', class: 'accepted' },
      'price_confirmation': { label: 'Price Confirmation', class: 'price-confirmation' },
      'in_progress': { label: 'In Progress', class: 'in-progress' },
      'ready_to_pickup': { label: 'Ready to Pickup', class: 'ready' },
      'picked_up': { label: 'Picked Up', class: 'picked-up' },
      'rented': { label: 'Rented', class: 'rented' },
      'returned': { label: 'Returned', class: 'returned' },
      'completed': { label: 'Completed', class: 'completed' },
      'cancelled': { label: 'Cancelled', class: 'cancelled' },
      'price_declined': { label: 'Price Declined', class: 'cancelled' }
    };

    return statusMap[status] || { label: status, class: 'unknown' };
  }
};

module.exports = OrderTracking;
