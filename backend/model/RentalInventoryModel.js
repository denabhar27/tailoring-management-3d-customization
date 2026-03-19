const db = require('../config/db');

function parseJsonSafely(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getSizeEntriesTotal(sizeRaw) {
  const parsed = parseJsonSafely(sizeRaw);
  if (!parsed || typeof parsed !== 'object') return null;

  // v2 format: { format: 'rental_size_v2', size_entries: [{ quantity, sizeKey, ... }] }
  if (parsed.format === 'rental_size_v2' && Array.isArray(parsed.size_entries)) {
    return parsed.size_entries.reduce((sum, entry) => {
      const q = parseInt(entry?.quantity, 10);
      return sum + (Number.isNaN(q) ? 0 : Math.max(0, q));
    }, 0);
  }

  // v2-ish without format
  if (Array.isArray(parsed.size_entries)) {
    return parsed.size_entries.reduce((sum, entry) => {
      const q = parseInt(entry?.quantity, 10);
      return sum + (Number.isNaN(q) ? 0 : Math.max(0, q));
    }, 0);
  }

  // v1 format: { size_options / sizeOptions: { small: { quantity }, ... } }
  const options = parsed.size_options || parsed.sizeOptions || parsed.size_options_v1 || parsed.sizeOptionsV1;
  if (options && typeof options === 'object' && !Array.isArray(options)) {
    return Object.values(options).reduce((sum, opt) => {
      const q = parseInt(opt?.quantity, 10);
      return sum + (Number.isNaN(q) ? 0 : Math.max(0, q));
    }, 0);
  }

  return null;
}

const RentalInventory = {
  
  create: (itemData, callback) => {
    const sql = `
      INSERT INTO rental_inventory 
      (item_name, description, brand, size, color, category, price, downpayment, total_available, image_url, front_image, back_image, side_image, material, care_instructions, damage_notes) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      itemData.item_name,
      itemData.description || null,
      itemData.brand || null,
      itemData.size || null,
      itemData.color || null,
      itemData.category || null,
      itemData.price,
      itemData.downpayment || '0',
      itemData.total_available || 1,
      itemData.image_url || null,
      itemData.front_image || null,
      itemData.back_image || null,
      itemData.side_image || null,
      itemData.material || null,
      itemData.care_instructions || null,
      itemData.damage_notes || null
    ];
    db.query(sql, values, callback);
  },

  getAll: (callback) => {
    const sql = "SELECT * FROM rental_inventory ORDER BY created_at DESC";
    db.query(sql, callback);
  },

  getAvailableItems: (filters = {}, callback) => {
    let sql = "SELECT * FROM rental_inventory WHERE status = 'available' AND total_available > 0";
    const values = [];
    
    if (filters.category) {
      sql += " AND category = ?";
      values.push(filters.category);
    }
    
    if (filters.min_price) {
      sql += " AND price >= ?";
      values.push(filters.min_price);
    }
    
    if (filters.max_price) {
      sql += " AND price <= ?";
      values.push(filters.max_price);
    }
    
    if (filters.search) {
      sql += " AND (item_name LIKE ? OR description LIKE ? OR brand LIKE ?)";
      const searchTerm = `%${filters.search}%`;
      values.push(searchTerm, searchTerm, searchTerm);
    }
    
    sql += " ORDER BY created_at DESC";

    if (filters.limit) {
      sql += " LIMIT ?";
      values.push(filters.limit);
    }
    
    if (filters.offset) {
      sql += " OFFSET ?";
      values.push(filters.offset);
    }
    
    db.query(sql, values, (err, rows) => {
      if (err) return callback(err);
      const filtered = (rows || []).filter((row) => {
        const sizeTotal = getSizeEntriesTotal(row.size);
        if (sizeTotal === null) return true; // keep legacy/unparsed items
        return sizeTotal > 0;
      });
      callback(null, filtered);
    });
  },

  getAvailableItemsCount: (filters = {}, callback) => {
    let sql = "SELECT item_id, size, total_available FROM rental_inventory WHERE status = 'available' AND total_available > 0";
    const values = [];

    if (filters.category) {
      sql += " AND category = ?";
      values.push(filters.category);
    }

    if (filters.min_price) {
      sql += " AND price >= ?";
      values.push(filters.min_price);
    }

    if (filters.max_price) {
      sql += " AND price <= ?";
      values.push(filters.max_price);
    }

    if (filters.search) {
      sql += " AND (item_name LIKE ? OR description LIKE ? OR brand LIKE ?)";
      const searchTerm = `%${filters.search}%`;
      values.push(searchTerm, searchTerm, searchTerm);
    }

    db.query(sql, values, (err, rows) => {
      if (err) return callback(err);

      const filteredCount = (rows || []).filter((row) => {
        const sizeTotal = getSizeEntriesTotal(row.size);
        if (sizeTotal === null) return true;
        return sizeTotal > 0;
      }).length;

      callback(null, [{ total: filteredCount }]);
    });
  },

  findById: (item_id, callback) => {
    const sql = "SELECT * FROM rental_inventory WHERE item_id = ?";
    db.query(sql, [item_id], callback);
  },

  searchItems: (filters = {}, callback) => {
    let sql = "SELECT * FROM rental_inventory WHERE status = 'available' AND total_available > 0";
    const values = [];
    
    if (filters.query) {
      sql += " AND (item_name LIKE ? OR description LIKE ? OR brand LIKE ? OR category LIKE ?)";
      const searchTerm = `%${filters.query}%`;
      values.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    if (filters.category) {
      sql += " AND category = ?";
      values.push(filters.category);
    }
    
    if (filters.min_price) {
      sql += " AND price >= ?";
      values.push(filters.min_price);
    }
    
    if (filters.max_price) {
      sql += " AND price <= ?";
      values.push(filters.max_price);
    }
    
    sql += " ORDER BY created_at DESC";

    if (filters.limit) {
      sql += " LIMIT ?";
      values.push(filters.limit);
    }
    
    if (filters.offset) {
      sql += " OFFSET ?";
      values.push(filters.offset);
    }
    
    db.query(sql, values, callback);
  },

  getSearchCount: (filters = {}, callback) => {
    let sql = "SELECT COUNT(*) as total FROM rental_inventory WHERE status = 'available' AND total_available > 0";
    const values = [];
    
    if (filters.query) {
      sql += " AND (item_name LIKE ? OR description LIKE ? OR brand LIKE ? OR category LIKE ?)";
      const searchTerm = `%${filters.query}%`;
      values.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    if (filters.category) {
      sql += " AND category = ?";
      values.push(filters.category);
    }
    
    if (filters.min_price) {
      sql += " AND price >= ?";
      values.push(filters.min_price);
    }
    
    if (filters.max_price) {
      sql += " AND price <= ?";
      values.push(filters.max_price);
    }
    
    db.query(sql, values, callback);
  },

  getByCategoryPaginated: (category, limit, offset, callback) => {
    const sql = `
      SELECT * FROM rental_inventory 
      WHERE category = ? AND status = 'available' AND total_available > 0 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    db.query(sql, [category, limit, offset], callback);
  },

  getCategoryCount: (category, callback) => {
    const sql = "SELECT COUNT(*) as total FROM rental_inventory WHERE category = ? AND status = 'available' AND total_available > 0";
    db.query(sql, [category], callback);
  },

  getFeaturedItems: (limit, callback) => {
    const fetchLimit = Math.max(1, Math.ceil(limit * 5));
    const sql = `
      SELECT * FROM rental_inventory 
      WHERE status = 'available' AND total_available > 0 
      ORDER BY created_at DESC 
      LIMIT ?
    `;
    db.query(sql, [fetchLimit], (err, rows) => {
      if (err) return callback(err);
      const filtered = (rows || []).filter((row) => {
        const sizeTotal = getSizeEntriesTotal(row.size);
        if (sizeTotal === null) return true;
        return sizeTotal > 0;
      });
      callback(null, filtered.slice(0, limit));
    });
  },

  getSimilarItems: (category, excludeId, limit, callback) => {
    const sql = `
      SELECT * FROM rental_inventory 
      WHERE category = ? AND item_id != ? AND status = 'available' AND total_available > 0 
      ORDER BY RAND() 
      LIMIT ?
    `;
    db.query(sql, [category, excludeId, limit], callback);
  },

  getByCategory: (category, callback) => {
    const sql = "SELECT * FROM rental_inventory WHERE category = ? AND status = 'available' ORDER BY created_at DESC";
    db.query(sql, [category], callback);
  },

  update: (item_id, itemData, callback) => {
    const sql = `
      UPDATE rental_inventory 
      SET item_name = ?, description = ?, brand = ?, size = ?, color = ?, category = ?, 
          price = ?, downpayment = ?, total_available = ?, 
          image_url = ?, front_image = ?, back_image = ?, side_image = ?, 
          material = ?, care_instructions = ?, damage_notes = ?, status = ?
      WHERE item_id = ?
    `;
    const values = [
      itemData.item_name,
      itemData.description || null,
      itemData.brand || null,
      itemData.size || null,
      itemData.color || null,
      itemData.category || null,
      itemData.price,
      itemData.downpayment || '0',
      itemData.total_available,
      itemData.image_url || null,
      itemData.front_image || null,
      itemData.back_image || null,
      itemData.side_image || null,
      itemData.material || null,
      itemData.care_instructions || null,
      itemData.damage_notes || null,
      itemData.status || 'available',
      item_id
    ];
    db.query(sql, values, callback);
  },

  updateStatus: (item_id, status, callback) => {
    const sql = "UPDATE rental_inventory SET status = ? WHERE item_id = ?";
    db.query(sql, [status, item_id], callback);
  },

  updateStatusWithDamageNotes: (item_id, status, damage_notes, damaged_by, callback) => {
    
    if (typeof damaged_by === 'function') {
      
      callback = damaged_by;
      damaged_by = null;
    }
    
    if (damaged_by) {
      const sql = "UPDATE rental_inventory SET status = ?, damage_notes = ?, damaged_by = ? WHERE item_id = ?";
      db.query(sql, [status, damage_notes, damaged_by, item_id], callback);
    } else {
      const sql = "UPDATE rental_inventory SET status = ?, damage_notes = ? WHERE item_id = ?";
      db.query(sql, [status, damage_notes, item_id], callback);
    }
  },

  updateRentedCount: (item_id, change, callback) => {
    const sql = "UPDATE rental_inventory SET currently_rented = currently_rented + ? WHERE item_id = ?";
    db.query(sql, [change, item_id], callback);
  },

  delete: (item_id, callback) => {
    const sql = "DELETE FROM rental_inventory WHERE item_id = ?";
    db.query(sql, [item_id], callback);
  },

  search: (searchTerm, callback) => {
    const sql = `
      SELECT * FROM rental_inventory 
      WHERE (item_name LIKE ? OR description LIKE ? OR brand LIKE ? OR category LIKE ?) 
      AND status = 'available'
      ORDER BY created_at DESC
    `;
    const searchPattern = `%${searchTerm}%`;
    db.query(sql, [searchPattern, searchPattern, searchPattern, searchPattern], callback);
  },

  getCategories: (callback) => {
    const sql = "SELECT DISTINCT category FROM rental_inventory WHERE category IS NOT NULL ORDER BY category";
    db.query(sql, callback);
  }
};

module.exports = RentalInventory;