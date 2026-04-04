const db = require('../config/db');

let compensationTableReady = false;

const ensureCompensationTable = (callback) => {
  if (compensationTableReady) {
    callback(null);
    return;
  }

  const sql = `
    CREATE TABLE IF NOT EXISTS damage_compensation_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_item_id INT NOT NULL,
      order_id INT NULL,
      service_type VARCHAR(50) NOT NULL,
      customer_name VARCHAR(255) NOT NULL,
      reported_by_user_id INT NULL,
      reported_by_role VARCHAR(50) NULL,
      responsible_party VARCHAR(255) NULL,
      damage_type VARCHAR(100) NOT NULL,
      damage_description TEXT NULL,
      liability_status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
      compensation_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      compensation_status ENUM('unpaid', 'paid') NOT NULL DEFAULT 'unpaid',
      compensation_paid_at DATETIME NULL,
      payment_reference VARCHAR(120) NULL,
      notes TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_damage_comp_order_item (order_item_id),
      INDEX idx_damage_comp_service (service_type),
      INDEX idx_damage_comp_liability (liability_status),
      INDEX idx_damage_comp_status (compensation_status),
      INDEX idx_damage_comp_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;

  db.query(sql, (err) => {
    if (!err) {
      compensationTableReady = true;
    }
    callback(err || null);
  });
};

const DamageRecord = {
  
  create: (damageData, callback) => {
    const sql = `
      INSERT INTO damage_records 
      (inventory_item_id, customer_name, walk_in_customer_id, user_id, damage_type, damage_description, repair_cost, repair_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      damageData.inventory_item_id,
      damageData.customer_name,
      damageData.walk_in_customer_id || null,
      damageData.user_id || null,
      damageData.damage_type,
      damageData.damage_description || null,
      damageData.repair_cost || 0,
      damageData.repair_status || 'pending'
    ];
    
    db.query(sql, values, (err, result) => {
      if (err) {
        return callback(err, null);
      }
      callback(null, { id: result.insertId, ...damageData });
    });
  },

  getAll: (callback) => {
    const sql = `
      SELECT 
        dr.*,
        ri.item_name,
        ri.brand,
        ri.category,
        wc.name as walk_in_customer_name,
        wc.phone as walk_in_customer_phone,
        u.first_name as user_first_name,
        u.last_name as user_last_name
      FROM damage_records dr
      LEFT JOIN rental_inventory ri ON dr.inventory_item_id = ri.item_id
      LEFT JOIN walk_in_customers wc ON dr.walk_in_customer_id = wc.id
      LEFT JOIN user u ON dr.user_id = u.user_id
      ORDER BY dr.reported_date DESC
    `;
    db.query(sql, callback);
  },

  getByInventoryItem: (itemId, callback) => {
    const sql = `
      SELECT 
        dr.*,
        wc.name as walk_in_customer_name,
        u.first_name as user_first_name,
        u.last_name as user_last_name
      FROM damage_records dr
      LEFT JOIN walk_in_customers wc ON dr.walk_in_customer_id = wc.id
      LEFT JOIN user u ON dr.user_id = u.user_id
      WHERE dr.inventory_item_id = ?
      ORDER BY dr.reported_date DESC
    `;
    db.query(sql, [itemId], callback);
  },

  getById: (id, callback) => {
    const sql = `
      SELECT 
        dr.*,
        ri.item_name,
        ri.brand,
        ri.category,
        wc.name as walk_in_customer_name,
        wc.phone as walk_in_customer_phone,
        u.first_name as user_first_name,
        u.last_name as user_last_name
      FROM damage_records dr
      LEFT JOIN rental_inventory ri ON dr.inventory_item_id = ri.item_id
      LEFT JOIN walk_in_customers wc ON dr.walk_in_customer_id = wc.id
      LEFT JOIN user u ON dr.user_id = u.user_id
      WHERE dr.id = ?
    `;
    db.query(sql, [id], (err, results) => {
      if (err) {
        return callback(err, null);
      }
      callback(null, results[0] || null);
    });
  },

  update: (id, updateData, callback) => {
    const fields = [];
    const values = [];

    if (updateData.damage_type !== undefined) {
      fields.push('damage_type = ?');
      values.push(updateData.damage_type);
    }
    if (updateData.damage_description !== undefined) {
      fields.push('damage_description = ?');
      values.push(updateData.damage_description);
    }
    if (updateData.repair_cost !== undefined) {
      fields.push('repair_cost = ?');
      values.push(updateData.repair_cost);
    }
    if (updateData.repair_status !== undefined) {
      fields.push('repair_status = ?');
      values.push(updateData.repair_status);
    }

    if (fields.length === 0) {
      return callback(null, { message: 'No fields to update' });
    }

    values.push(id);
    const sql = `UPDATE damage_records SET ${fields.join(', ')} WHERE id = ?`;
    
    db.query(sql, values, (err, result) => {
      if (err) {
        return callback(err, null);
      }
      callback(null, result);
    });
  },

  delete: (id, callback) => {
    const sql = `DELETE FROM damage_records WHERE id = ?`;
    db.query(sql, [id], callback);
  },

  createCompensationRecord: (payload, callback) => {
    ensureCompensationTable((ensureErr) => {
      if (ensureErr) {
        callback(ensureErr, null);
        return;
      }

      const sql = `
        INSERT INTO damage_compensation_records
        (order_item_id, order_id, service_type, customer_name, reported_by_user_id, reported_by_role, responsible_party, damage_type, damage_description, liability_status, compensation_amount, compensation_status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const values = [
        payload.order_item_id,
        payload.order_id || null,
        payload.service_type,
        payload.customer_name,
        payload.reported_by_user_id || null,
        payload.reported_by_role || null,
        payload.responsible_party || null,
        payload.damage_type,
        payload.damage_description || null,
        payload.liability_status || 'pending',
        payload.compensation_amount || 0,
        payload.compensation_status || 'unpaid',
        payload.notes || null
      ];

      db.query(sql, values, (err, result) => {
        if (err) {
          callback(err, null);
          return;
        }
        callback(null, { id: result.insertId, ...payload });
      });
    });
  },

  getCompensationById: (id, callback) => {
    ensureCompensationTable((ensureErr) => {
      if (ensureErr) {
        callback(ensureErr, null);
        return;
      }

      const sql = `SELECT * FROM damage_compensation_records WHERE id = ?`;
      db.query(sql, [id], (err, rows) => {
        if (err) {
          callback(err, null);
          return;
        }
        callback(null, rows[0] || null);
      });
    });
  },

  getCompensationByIdForUser: (id, userId, callback) => {
    ensureCompensationTable((ensureErr) => {
      if (ensureErr) {
        callback(ensureErr, null);
        return;
      }

      const sql = `
        SELECT dcr.*
        FROM damage_compensation_records dcr
        JOIN order_items oi ON oi.item_id = dcr.order_item_id
        JOIN orders o ON o.order_id = oi.order_id
        WHERE dcr.id = ? AND o.user_id = ?
        LIMIT 1
      `;

      db.query(sql, [id, userId], (err, rows) => {
        if (err) {
          callback(err, null);
          return;
        }
        callback(null, rows[0] || null);
      });
    });
  },

  updateCompensationRecord: (id, updateData, callback) => {
    ensureCompensationTable((ensureErr) => {
      if (ensureErr) {
        callback(ensureErr, null);
        return;
      }

      const fields = [];
      const values = [];

      if (updateData.liability_status !== undefined) {
        fields.push('liability_status = ?');
        values.push(updateData.liability_status);
      }
      if (updateData.compensation_amount !== undefined) {
        fields.push('compensation_amount = ?');
        values.push(updateData.compensation_amount);
      }
      if (updateData.compensation_status !== undefined) {
        fields.push('compensation_status = ?');
        values.push(updateData.compensation_status);
      }
      if (updateData.compensation_paid_at !== undefined) {
        fields.push('compensation_paid_at = ?');
        values.push(updateData.compensation_paid_at);
      }
      if (updateData.payment_reference !== undefined) {
        fields.push('payment_reference = ?');
        values.push(updateData.payment_reference);
      }
      if (updateData.responsible_party !== undefined) {
        fields.push('responsible_party = ?');
        values.push(updateData.responsible_party);
      }
      if (updateData.notes !== undefined) {
        fields.push('notes = ?');
        values.push(updateData.notes);
      }

      if (fields.length === 0) {
        callback(null, { message: 'No fields to update' });
        return;
      }

      values.push(id);
      const sql = `UPDATE damage_compensation_records SET ${fields.join(', ')} WHERE id = ?`;
      db.query(sql, values, callback);
    });
  },

  getCompensationRecords: (filters, callback) => {
    ensureCompensationTable((ensureErr) => {
      if (ensureErr) {
        callback(ensureErr, null);
        return;
      }

      const where = [];
      const values = [];

      if (filters.service_type) {
        where.push('service_type = ?');
        values.push(filters.service_type);
      }
      if (filters.liability_status) {
        where.push('liability_status = ?');
        values.push(filters.liability_status);
      }
      if (filters.compensation_status) {
        where.push('compensation_status = ?');
        values.push(filters.compensation_status);
      }

      if (filters.order_item_id) {
        where.push('dcr.order_item_id = ?');
        values.push(filters.order_item_id);
      }

      let joins = '';
      if (filters.customer_user_id) {
        joins += '\nJOIN order_items oi ON oi.item_id = dcr.order_item_id\nJOIN orders o ON o.order_id = oi.order_id';
        where.push('o.user_id = ?');
        values.push(filters.customer_user_id);
      }

      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
      const sql = `
        SELECT dcr.*
        FROM damage_compensation_records dcr
        ${joins}
        ${whereClause}
        ORDER BY dcr.created_at DESC
      `;

      db.query(sql, values, callback);
    });
  },

  getCompensationStats: (callback) => {
    ensureCompensationTable((ensureErr) => {
      if (ensureErr) {
        callback(ensureErr, null);
        return;
      }

      const sql = `
        SELECT
          COUNT(*) AS total_incidents,
          SUM(CASE WHEN liability_status = 'approved' THEN 1 ELSE 0 END) AS approved_incidents,
          SUM(CASE WHEN liability_status = 'pending' THEN 1 ELSE 0 END) AS pending_incidents,
          SUM(CASE WHEN compensation_status = 'paid' THEN 1 ELSE 0 END) AS paid_incidents,
          SUM(CASE WHEN liability_status = 'approved' AND compensation_status = 'unpaid' THEN 1 ELSE 0 END) AS unpaid_incidents,
          COALESCE(SUM(CASE WHEN liability_status = 'approved' THEN compensation_amount ELSE 0 END), 0) AS approved_compensation,
          COALESCE(SUM(CASE WHEN compensation_status = 'paid' THEN compensation_amount ELSE 0 END), 0) AS paid_compensation,
          COALESCE(SUM(CASE WHEN liability_status = 'approved' AND compensation_status = 'unpaid' THEN compensation_amount ELSE 0 END), 0) AS outstanding_compensation
        FROM damage_compensation_records
      `;

      db.query(sql, (err, rows) => {
        if (err) {
          callback(err, null);
          return;
        }
        callback(null, rows[0] || {});
      });
    });
  }
};

module.exports = DamageRecord;

