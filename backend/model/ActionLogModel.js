const db = require('../config/db');

const ActionLog = {
  
  create: (logData, callback) => {
    const sql = `
      INSERT INTO action_logs 
      (order_item_id, user_id, action_type, action_by, previous_status, new_status, reason, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      logData.order_item_id,
      logData.user_id,
      logData.action_type,
      logData.action_by,
      logData.previous_status || null,
      logData.new_status || null,
      logData.reason || null,
      logData.notes || null
    ];
    db.query(sql, values, callback);
  },

  getByOrderItemId: (orderItemId, callback) => {
    const sql = `
      SELECT 
        al.*,
        u.first_name,
        u.last_name,
        u.email
      FROM action_logs al
      JOIN user u ON al.user_id = u.user_id
      WHERE al.order_item_id = ?
      ORDER BY al.created_at DESC
    `;
    db.query(sql, [orderItemId], callback);
  },

  getAll: (limit = 50, callback) => {
    const sql = `
      SELECT 
        al.*,
        u.first_name AS actor_first_name,
        u.last_name AS actor_last_name,
        u.email AS actor_email,
        cu.first_name AS customer_first_name,
        cu.last_name AS customer_last_name,
        cu.email AS customer_email,
        wc.name AS walk_in_customer_name,
        o.order_type,
        oi.service_type,
        oi.item_id,
        o.order_id
      FROM action_logs al
      JOIN user u ON al.user_id = u.user_id
      LEFT JOIN order_items oi ON al.order_item_id = oi.item_id
      LEFT JOIN orders o ON oi.order_id = o.order_id
      LEFT JOIN user cu ON o.user_id = cu.user_id
      LEFT JOIN walk_in_customers wc ON o.walk_in_customer_id = wc.id
      ORDER BY al.created_at DESC
      LIMIT ?
    `;
    db.query(sql, [limit], callback);
  },

  getCancellationReasons: (callback) => {
    const sql = `
      SELECT 
        al.*,
        u.first_name,
        u.last_name,
        oi.service_type,
        o.order_id
      FROM action_logs al
      JOIN user u ON al.user_id = u.user_id
      JOIN order_items oi ON al.order_item_id = oi.item_id
      JOIN orders o ON oi.order_id = o.order_id
      WHERE al.action_type = 'cancel'
      ORDER BY al.created_at DESC
    `;
    db.query(sql, callback);
  }
};

module.exports = ActionLog;

