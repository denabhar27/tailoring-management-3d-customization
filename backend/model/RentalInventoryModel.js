const db = require('../config/db');
const DamageRecord = require('./DamageRecordModel');
const ActionLog = require('./ActionLogModel');

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

function toNullablePositiveInt(value) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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

function mapSizeInputToKey(sizeInput = '', entries = []) {
  const raw = String(sizeInput || '').trim().toLowerCase();
  if (!raw) return '';

  const aliasMap = {
    s: 'small',
    small: 'small',
    m: 'medium',
    medium: 'medium',
    l: 'large',
    large: 'large',
    xl: 'extra_large',
    'extra large': 'extra_large',
    extra_large: 'extra_large'
  };

  if (aliasMap[raw]) return aliasMap[raw];

  const byExact = entries.find((e) => String(e?.sizeKey || '').toLowerCase() === raw);
  if (byExact) return byExact.sizeKey;

  const byLabel = entries.find((e) => String(e?.label || '').toLowerCase() === raw);
  if (byLabel) return byLabel.sizeKey;

  return raw;
}

function collectSelectedSizesFromSpecificData(specificData = {}, fallbackItemId = null) {
  const selections = [];

  const appendSelection = (itemId, selectedSizes = []) => {
    if (!itemId || !Array.isArray(selectedSizes)) return;
    selectedSizes.forEach((s) => {
      const key = String(s?.sizeKey ?? s?.size_key ?? '').trim();
      const qty = Math.max(0, parseInt(s?.quantity, 10) || 0);
      if (!key || qty <= 0) return;
      selections.push({ itemId: Number(itemId), sizeKey: key, quantity: qty });
    });
  };

  if (specificData?.is_bundle && Array.isArray(specificData.bundle_items)) {
    specificData.bundle_items.forEach((bundleItem) => {
      const itemId = parseInt(bundleItem?.item_id ?? bundleItem?.id ?? bundleItem?.service_id, 10);
      const selectedSizes =
        Array.isArray(bundleItem?.selected_sizes) ? bundleItem.selected_sizes :
        (Array.isArray(bundleItem?.selectedSizes) ? bundleItem.selectedSizes : []);
      appendSelection(itemId, selectedSizes);
    });
    return selections;
  }

  const selectedSizes = Array.isArray(specificData?.selected_sizes) ? specificData.selected_sizes : [];
  appendSelection(fallbackItemId, selectedSizes);
  return selections;
}

const DAMAGE_NOTE_META_PREFIX = '[[DAMAGE_META:';
const DAMAGE_NOTE_META_SUFFIX = ']]';

function normalizeIssueType(rawType = '') {
  const type = String(rawType || '').trim().toLowerCase();
  return ['damage', 'lost', 'replaced'].includes(type) ? type : 'damage';
}

function normalizePaymentStatus(rawStatus = '') {
  const status = String(rawStatus || '').trim().toLowerCase();
  return status === 'paid' ? 'paid' : 'unpaid';
}

function parseDamageNoteMeta(rawNote) {
  const text = String(rawNote || '');
  if (!text.startsWith(DAMAGE_NOTE_META_PREFIX)) {
    return { note: text.trim(), meta: {} };
  }

  const metaEndIdx = text.indexOf(DAMAGE_NOTE_META_SUFFIX, DAMAGE_NOTE_META_PREFIX.length);
  if (metaEndIdx === -1) {
    return { note: text.trim(), meta: {} };
  }

  const metaText = text.slice(DAMAGE_NOTE_META_PREFIX.length, metaEndIdx);
  let meta = null;
  try {
    meta = JSON.parse(metaText);
  } catch {
    return { note: text.trim(), meta: {} };
  }

  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return { note: text.trim(), meta: {} };
  }

  const note = text.slice(metaEndIdx + DAMAGE_NOTE_META_SUFFIX.length).trim();
  return { note, meta };
}

function buildDamageNoteWithMeta(rawNote = '', rawMeta = {}) {
  const note = String(rawNote || '').trim();
  const compensation = parseFloat(rawMeta?.compensation_amount);
  const compensationAmount = Number.isFinite(compensation) ? Math.max(0, compensation) : 0;
  const paymentStatus = normalizePaymentStatus(rawMeta?.payment_status || 'unpaid');
  const orderItemId = toNullablePositiveInt(rawMeta?.order_item_id);
  const compensationIncidentId = toNullablePositiveInt(rawMeta?.compensation_incident_id);
  const handledBy = String(rawMeta?.handled_by || '').trim() || null;

  const meta = {
    issue_type: normalizeIssueType(rawMeta?.issue_type || 'damage'),
    compensation_amount: compensationAmount,
    payment_status: paymentStatus,
    order_item_id: orderItemId,
    compensation_incident_id: compensationIncidentId,
    handled_by: handledBy,
    paid_at: paymentStatus === 'paid'
      ? (rawMeta?.paid_at || new Date().toISOString())
      : null
  };

  const serializedMeta = JSON.stringify(meta);
  return `${DAMAGE_NOTE_META_PREFIX}${serializedMeta}${DAMAGE_NOTE_META_SUFFIX}${note ? ` ${note}` : ''}`;
}

function extractDamageNotePresentation(rawNote, fallbackDamageLevel = null) {
  const parsed = parseDamageNoteMeta(rawNote);
  const issueType = normalizeIssueType(parsed?.meta?.issue_type || 'damage');
  const compensation = parseFloat(parsed?.meta?.compensation_amount);
  const compensationAmount = Number.isFinite(compensation) ? Math.max(0, compensation) : 0;
  const paymentStatus = normalizePaymentStatus(parsed?.meta?.payment_status || 'unpaid');
  const orderItemId = toNullablePositiveInt(parsed?.meta?.order_item_id);
  const compensationIncidentId = toNullablePositiveInt(parsed?.meta?.compensation_incident_id);
  const handledBy = String(parsed?.meta?.handled_by || '').trim() || null;

  return {
    issue_type: issueType,
    compensation_amount: compensationAmount,
    payment_status: paymentStatus,
    order_item_id: orderItemId,
    compensation_incident_id: compensationIncidentId,
    handled_by: handledBy,
    damage_level: issueType === 'damage' ? (fallbackDamageLevel || null) : null,
    damage_note: parsed?.note ? String(parsed.note).trim() : null
  };
}

const RentalInventory = {
  
  create: (itemData, callback) => {
    const sql = `
      INSERT INTO rental_inventory 
      (item_name, description, brand, size, color, category, price, deposit, downpayment, total_available, image_url, front_image, back_image, side_image, material, care_instructions, damage_notes) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      itemData.item_name,
      itemData.description || null,
      itemData.brand || null,
      itemData.size || null,
      itemData.color || null,
      itemData.category || null,
      itemData.price,
      itemData.deposit || '0',
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
    db.query(sql, (err, rows) => {
      if (err) return callback(err);

      const items = rows || [];
      if (items.length === 0) return callback(null, []);

      const rentedSql = `
        SELECT item_id, service_id, specific_data
        FROM order_items
        WHERE service_type = 'rental'
          AND approval_status IN ('rented', 'picked_up')
      `;

      db.query(rentedSql, (rentedErr, rentedRows) => {
        if (rentedErr) return callback(rentedErr);

        const damageSql = `
          SELECT inventory_item_id, size_key, SUM(quantity) AS qty
          FROM damage_logs
          WHERE status = 'active'
          GROUP BY inventory_item_id, size_key
        `;

        db.query(damageSql, (damageErr, damageRows) => {
          if (damageErr) {
            // Migration-safe fallback while damage_logs may not yet exist.
            if (!String(damageErr.message || '').toLowerCase().includes('doesn\'t exist')) {
              return callback(damageErr);
            }
            damageRows = [];
          }

          const rentedMap = new Map();
          (rentedRows || []).forEach((row) => {
            const specific = parseJsonSafely(row.specific_data) || {};
            const serviceId = parseInt(row.service_id, 10);
            const selections = collectSelectedSizesFromSpecificData(specific, serviceId);
            selections.forEach((sel) => {
              const key = `${sel.itemId}:${sel.sizeKey}`;
              rentedMap.set(key, (rentedMap.get(key) || 0) + sel.quantity);
            });
          });

          const damagedMap = new Map();
          (damageRows || []).forEach((row) => {
            const itemId = parseInt(row.inventory_item_id, 10);
            const key = `${itemId}:${row.size_key}`;
            damagedMap.set(key, parseInt(row.qty, 10) || 0);
          });

          const enriched = items.map((item) => {
            const sizePayload = parseJsonSafely(item.size);
            const sizeEntries = Array.isArray(sizePayload?.size_entries) ? sizePayload.size_entries : [];
            const reasonCounts = {};
            sizeEntries.forEach((entry) => {
              const sizeKey = String(entry?.sizeKey || '').trim();
              if (!sizeKey) return;
              const mapKey = `${item.item_id}:${sizeKey}`;
              reasonCounts[sizeKey] = {
                rented: rentedMap.get(mapKey) || 0,
                maintenance: damagedMap.get(mapKey) || 0
              };
            });

            return {
              ...item,
              size_reason_counts: reasonCounts
            };
          });

          callback(null, enriched);
        });
      });
    });
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
          price = ?, deposit = ?, downpayment = ?, total_available = ?, 
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
      itemData.deposit || '0',
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

  incrementTimesRented: (item_id, incrementBy = 1, callback) => {
    const numericItemId = parseInt(item_id, 10);
    const qty = Math.max(1, parseInt(incrementBy, 10) || 1);

    if (!numericItemId) {
      const err = new Error('Invalid rental item id for times_rented increment');
      if (typeof callback === 'function') return callback(err);
      return;
    }

    const sql = `
      UPDATE rental_inventory
      SET times_rented = COALESCE(times_rented, 0) + ?
      WHERE item_id = ?
    `;
    db.query(sql, [qty, numericItemId], callback);
  },

  incrementSizeRentalCounts: (item_id, selectedSizes = [], callback) => {
    const numericItemId = parseInt(item_id, 10);

    if (!numericItemId || !Array.isArray(selectedSizes) || selectedSizes.length === 0) {
      if (typeof callback === 'function') callback(null, { updated: false });
      return;
    }

    const getSql = `SELECT item_id, size, size_rental_counts FROM rental_inventory WHERE item_id = ? LIMIT 1`;
    db.query(getSql, [numericItemId], (getErr, rows) => {
      if (getErr) return callback(getErr);
      if (!rows || rows.length === 0) {
        const err = new Error('Rental item not found.');
        err.statusCode = 404;
        return callback(err);
      }

      const sizePayload = parseJsonSafely(rows[0].size);
      const sizeEntries = Array.isArray(sizePayload?.size_entries) ? sizePayload.size_entries : [];

      const normalizeSelectionKey = (entry = {}) => {
        const direct = String(entry?.sizeKey || entry?.size_key || entry?.size || entry?.size_label || '').trim();
        if (direct) return mapSizeInputToKey(direct, sizeEntries);

        const rawLabel = String(entry?.label || '').trim();
        if (!rawLabel) return '';
        return mapSizeInputToKey(rawLabel, sizeEntries);
      };

      const normalizedSelections = selectedSizes
        .map((entry) => ({
          sizeKey: normalizeSelectionKey(entry),
          quantity: Math.max(1, parseInt(entry?.quantity, 10) || 1)
        }))
        .filter((entry) => !!entry.sizeKey);

      if (normalizedSelections.length === 0) {
        if (typeof callback === 'function') callback(null, { updated: false });
        return;
      }

      let currentCounts = {};
      const raw = rows[0].size_rental_counts;
      if (raw) {
        try {
          currentCounts = typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch {
          currentCounts = {};
        }
      }
      if (!currentCounts || typeof currentCounts !== 'object' || Array.isArray(currentCounts)) {
        currentCounts = {};
      }

      normalizedSelections.forEach((entry) => {
        currentCounts[entry.sizeKey] = Math.max(0, parseInt(currentCounts[entry.sizeKey], 10) || 0) + entry.quantity;
      });

      const updateSql = `UPDATE rental_inventory SET size_rental_counts = ? WHERE item_id = ?`;
      db.query(updateSql, [JSON.stringify(currentCounts), numericItemId], callback);
    });
  },

  restockReturnedSizes: (itemId, selectedSizes = [], callback) => {
    const numericItemId = parseInt(itemId, 10);
    const normalizedSelections = Array.isArray(selectedSizes)
      ? selectedSizes.map((entry) => ({
          sizeKey: String(entry?.sizeKey || entry?.size_key || '').trim(),
          quantity: Math.max(0, parseInt(entry?.quantity, 10) || 0)
        })).filter((entry) => entry.sizeKey && entry.quantity > 0)
      : [];

    if (normalizedSelections.length === 0) {
      return callback(null, {
        item_id: numericItemId,
        total_available: null,
        restocked: 0
      });
    }

    const getSql = `SELECT item_id, size, total_available FROM rental_inventory WHERE item_id = ? LIMIT 1`;
    db.query(getSql, [numericItemId], (getErr, rows) => {
      if (getErr) return callback(getErr);
      if (!rows || rows.length === 0) {
        const err = new Error('Rental item not found.');
        err.statusCode = 404;
        return callback(err);
      }

      const item = rows[0];
      const parsed = parseJsonSafely(item.size);
      if (!parsed || !Array.isArray(parsed.size_entries)) {
        const err = new Error('Item size profile is missing. Please re-save the rental item in Post Rent.');
        err.statusCode = 400;
        return callback(err);
      }

      let restocked = 0;
      normalizedSelections.forEach((sel) => {
        const normalizedKey = mapSizeInputToKey(sel.sizeKey, parsed.size_entries);
        const idx = parsed.size_entries.findIndex((entry) => String(entry?.sizeKey || '') === normalizedKey);
        if (idx === -1) return;
        const currentQty = Math.max(0, parseInt(parsed.size_entries[idx].quantity, 10) || 0);
        parsed.size_entries[idx].quantity = currentQty + sel.quantity;
        restocked += sel.quantity;
      });

      const nextTotal = parsed.size_entries.reduce((sum, entry) => sum + (Math.max(0, parseInt(entry?.quantity, 10) || 0)), 0);
      const updateSql = `
        UPDATE rental_inventory
        SET size = ?, total_available = ?, status = ?
        WHERE item_id = ?
      `;
      db.query(updateSql, [JSON.stringify(parsed), nextTotal, nextTotal > 0 ? 'available' : 'maintenance', numericItemId], (updateErr) => {
        if (updateErr) return callback(updateErr);
        callback(null, {
          item_id: numericItemId,
          total_available: nextTotal,
          restocked
        });
      });
    });
  },

  markSizeDamaged: (itemId, damageData, callback) => {
    const numericItemId = parseInt(itemId, 10);
    const qty = Math.max(1, parseInt(damageData?.quantity, 10) || 1);
    const damageType = normalizeIssueType(damageData?.damage_type || 'damage');
    const damageLevelInput = String(damageData?.damage_level || '').trim().toLowerCase();
    const damageNote = String(damageData?.damage_note || '').trim();
    const orderItemId = toNullablePositiveInt(damageData?.order_item_id);

    const validLevels = ['minor', 'moderate', 'severe'];
    if (damageType === 'damage' && !validLevels.includes(damageLevelInput)) {
      const err = new Error('Invalid damage level. Allowed: minor, moderate, severe.');
      err.statusCode = 400;
      return callback(err);
    }

    // Non-damage issue types still require a DB enum value, so keep a neutral default.
    const damageLevel = damageType === 'damage' ? damageLevelInput : 'minor';

    const getSql = `SELECT item_id, item_name, size, total_available, status FROM rental_inventory WHERE item_id = ? LIMIT 1`;
    db.query(getSql, [numericItemId], (getErr, rows) => {
      if (getErr) return callback(getErr);
      if (!rows || rows.length === 0) {
        const err = new Error('Rental item not found.');
        err.statusCode = 404;
        return callback(err);
      }

      const item = rows[0];
      const parsed = parseJsonSafely(item.size);
      if (!parsed || !Array.isArray(parsed.size_entries)) {
        const err = new Error('Item size profile is missing. Please re-save the rental item in Post Rent.');
        err.statusCode = 400;
        return callback(err);
      }

      const normalizedKey = mapSizeInputToKey(damageData?.size_key || damageData?.size || damageData?.size_label, parsed.size_entries);
      const idx = parsed.size_entries.findIndex((entry) => String(entry?.sizeKey || '') === normalizedKey);
      if (idx === -1) {
        const err = new Error(`Size "${damageData?.size_key || damageData?.size || ''}" not found on this item.`);
        err.statusCode = 400;
        return callback(err);
      }

      const currentSizeQty = Math.max(0, parseInt(parsed.size_entries[idx].quantity, 10) || 0);
      if (currentSizeQty < qty) {
        const err = new Error(`Not enough available quantity for ${parsed.size_entries[idx].label || normalizedKey}. Available: ${currentSizeQty}, requested: ${qty}.`);
        err.statusCode = 400;
        return callback(err);
      }

      parsed.size_entries[idx].quantity = currentSizeQty - qty;
      const nextTotalBySizes = parsed.size_entries.reduce((sum, entry) => sum + (Math.max(0, parseInt(entry?.quantity, 10) || 0)), 0);
      const nextTotal = Math.max(0, nextTotalBySizes);
      const nextStatus = nextTotal <= 0 ? 'maintenance' : (item.status || 'available');
      const updatedSizeJson = JSON.stringify(parsed);

      const updateSql = `
        UPDATE rental_inventory
        SET size = ?, total_available = ?, status = ?
        WHERE item_id = ?
      `;
      db.query(updateSql, [updatedSizeJson, nextTotal, nextStatus, numericItemId], (updateErr) => {
        if (updateErr) return callback(updateErr);

        const insertLogSql = `
          INSERT INTO damage_logs
          (inventory_item_id, item_name, size_key, size_label, quantity, damage_level, damage_note, damaged_customer_name, processed_by_user_id, processed_by_role, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
        `;
        const processedByUserId = damageData?.processed_by_user_id || null;
        const processedByRole = damageData?.processed_by_role || 'admin';
        const processedByName = String(damageData?.processed_by_name || '').trim() || processedByRole || 'admin';
        const damagedCustomerName = String(damageData?.damaged_customer_name || '').trim() || null;
        const sizeLabel = parsed.size_entries[idx].label || normalizedKey;
        const serializedDamageNote = buildDamageNoteWithMeta(damageNote, {
          issue_type: damageType,
          compensation_amount: 0,
          payment_status: 'unpaid',
          order_item_id: orderItemId,
          handled_by: processedByName
        });

        db.query(
          insertLogSql,
          [numericItemId, item.item_name, normalizedKey, sizeLabel, qty, damageLevel, serializedDamageNote || null, damagedCustomerName, processedByUserId, processedByRole],
          (logErr, logResult) => {
            if (logErr) return callback(logErr);

            const damageLogId = logResult?.insertId || null;
            const finish = (compensationIncidentId = null) => callback(null, {
              item_id: numericItemId,
              item_name: item.item_name,
              size_key: normalizedKey,
              size_label: sizeLabel,
              damaged_quantity: qty,
              damage_type: damageType,
              damage_level: damageType === 'damage' ? damageLevel : null,
              compensation_amount: 0,
              payment_status: 'unpaid',
              status: nextStatus,
              total_available: nextTotal,
              damage_log_id: damageLogId,
              compensation_incident_id: compensationIncidentId
            });

            if (!orderItemId) {
              finish(null);
              return;
            }

            const noteLines = [
              `Customer: ${damagedCustomerName || 'Customer'}`,
              `Handled by: ${processedByName}`,
              `Damage type: ${damageType}`,
              `Size: ${sizeLabel}`
            ];
            if (damageNote) noteLines.push(`Comment: ${damageNote}`);

            DamageRecord.createCompensationRecord({
              order_item_id: orderItemId,
              order_id: null,
              service_type: 'rental',
              customer_name: damagedCustomerName || 'Customer',
              reported_by_user_id: processedByUserId,
              reported_by_role: processedByRole,
              responsible_party: processedByName,
              damage_type: damageType,
              damage_description: damageNote || `${damageType} issue on ${sizeLabel}`,
              liability_status: 'approved',
              compensation_amount: 0,
              compensation_status: 'unpaid',
              notes: noteLines.join('\n')
            }, (incidentErr, incidentResult) => {
              if (incidentErr || !incidentResult?.id || !damageLogId) {
                if (incidentErr) {
                  console.error('Failed to create rental compensation incident during damage logging:', incidentErr);
                }
                finish(null);
                return;
              }

              const noteWithIncident = buildDamageNoteWithMeta(damageNote, {
                issue_type: damageType,
                compensation_amount: 0,
                payment_status: 'unpaid',
                order_item_id: orderItemId,
                compensation_incident_id: incidentResult.id,
                handled_by: processedByName
              });

              const syncSql = `
                UPDATE damage_logs
                SET damage_note = ?, updated_at = CURRENT_TIMESTAMP
                WHERE log_id = ?
              `;

              db.query(syncSql, [noteWithIncident, damageLogId], (syncErr) => {
                if (syncErr) {
                  console.error('Failed to sync compensation incident id to damage note metadata:', syncErr);
                }
                finish(incidentResult.id);
              });
            });
          }
        );
      });
    });
  },

  resolveMaintenance: (itemId, damageLogId, resolveData, callback) => {
    const numericItemId = parseInt(itemId, 10);
    const numericLogId = parseInt(damageLogId, 10);
    const qtyToResolve = Math.max(1, parseInt(resolveData?.quantity, 10) || 1);
    const resolutionNote = String(resolveData?.resolution_note || '').trim() || 'Fixed and returned to available';

    // Get the damage log entry
    const getLogSql = `
      SELECT log_id, inventory_item_id, size_key, size_label, quantity, damage_level, damage_note
      FROM damage_logs
      WHERE log_id = ? AND inventory_item_id = ? AND status = 'active'
      LIMIT 1
    `;

    db.query(getLogSql, [numericLogId, numericItemId], (logErr, logRows) => {
      if (logErr) return callback(logErr);
      if (!logRows || logRows.length === 0) {
        const err = new Error('Damage log not found or already resolved.');
        err.statusCode = 404;
        return callback(err);
      }

      const damageLog = logRows[0];
      const currentDamageQty = Math.max(0, parseInt(damageLog.quantity, 10) || 0);

      if (qtyToResolve > currentDamageQty) {
        const err = new Error(`Cannot resolve ${qtyToResolve} items. Only ${currentDamageQty} items in maintenance.`);
        err.statusCode = 400;
        return callback(err);
      }

      // Get the rental item
      const getItemSql = `SELECT item_id, item_name, size, total_available, status FROM rental_inventory WHERE item_id = ? LIMIT 1`;
      db.query(getItemSql, [numericItemId], (itemErr, itemRows) => {
        if (itemErr) return callback(itemErr);
        if (!itemRows || itemRows.length === 0) {
          const err = new Error('Rental item not found.');
          err.statusCode = 404;
          return callback(err);
        }

        const item = itemRows[0];
        const parsed = parseJsonSafely(item.size);
        if (!parsed || !Array.isArray(parsed.size_entries)) {
          const err = new Error('Item size profile is missing.');
          err.statusCode = 400;
          return callback(err);
        }

        // Find the size entry
        const idx = parsed.size_entries.findIndex((entry) => String(entry?.sizeKey || '') === damageLog.size_key);
        if (idx === -1) {
          const err = new Error(`Size "${damageLog.size_key}" not found on this item.`);
          err.statusCode = 400;
          return callback(err);
        }

        // Add the resolved quantity back to available
        const currentSizeQty = Math.max(0, parseInt(parsed.size_entries[idx].quantity, 10) || 0);
        parsed.size_entries[idx].quantity = currentSizeQty + qtyToResolve;

        // Recalculate total
        const nextTotal = parsed.size_entries.reduce((sum, entry) => sum + (Math.max(0, parseInt(entry?.quantity, 10) || 0)), 0);
        const nextStatus = nextTotal > 0 ? 'available' : 'maintenance';
        const updatedSizeJson = JSON.stringify(parsed);

        // Update the rental item
        const updateItemSql = `
          UPDATE rental_inventory
          SET size = ?, total_available = ?, status = ?
          WHERE item_id = ?
        `;

        db.query(updateItemSql, [updatedSizeJson, nextTotal, nextStatus, numericItemId], (updateErr) => {
          if (updateErr) return callback(updateErr);

          // Update or delete the damage log
          const remainingDamageQty = currentDamageQty - qtyToResolve;

          if (remainingDamageQty <= 0) {
            // Mark as resolved
            const resolveLogSql = `
              UPDATE damage_logs
              SET status = 'resolved', updated_at = CURRENT_TIMESTAMP
              WHERE log_id = ?
            `;
            db.query(resolveLogSql, [numericLogId], (resolveErr) => {
              if (resolveErr) return callback(resolveErr);

              callback(null, {
                item_id: numericItemId,
                item_name: item.item_name,
                size_key: damageLog.size_key,
                size_label: damageLog.size_label,
                resolved_quantity: qtyToResolve,
                remaining_damage_quantity: 0,
                status: nextStatus,
                total_available: nextTotal,
                resolution_note: resolutionNote
              });
            });
          } else {
            // Update quantity in damage log
            const updateLogSql = `
              UPDATE damage_logs
              SET quantity = ?, updated_at = CURRENT_TIMESTAMP
              WHERE log_id = ?
            `;
            db.query(updateLogSql, [remainingDamageQty, numericLogId], (updateLogErr) => {
              if (updateLogErr) return callback(updateLogErr);

              callback(null, {
                item_id: numericItemId,
                item_name: item.item_name,
                size_key: damageLog.size_key,
                size_label: damageLog.size_label,
                resolved_quantity: qtyToResolve,
                remaining_damage_quantity: remainingDamageQty,
                status: nextStatus,
                total_available: nextTotal,
                resolution_note: resolutionNote
              });
            });
          }
        });
      });
    });
  },

  updateDamageCompensation: (itemId, damageLogId, compensationData, callback) => {
    const numericItemId = parseInt(itemId, 10);
    const numericLogId = parseInt(damageLogId, 10);
    const parsedAmount = parseFloat(compensationData?.compensation_amount);
    const updatedByUserId = toNullablePositiveInt(compensationData?.updated_by_user_id);
    const updatedByRoleRaw = String(compensationData?.updated_by_role || '').trim().toLowerCase();
    const actionByRole = updatedByRoleRaw === 'user' ? 'user' : 'admin';
    const updatedByNameInput = String(compensationData?.updated_by_name || '').trim();

    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      const err = new Error('Compensation amount must be a valid non-negative number.');
      err.statusCode = 400;
      return callback(err);
    }

    const compensationAmount = Math.max(0, parsedAmount);
    let paymentStatus = normalizePaymentStatus(compensationData?.payment_status || 'unpaid');
    if (compensationAmount <= 0) paymentStatus = 'unpaid';

    const getLogSql = `
      SELECT dl.log_id, dl.inventory_item_id, dl.size_key, dl.size_label, dl.damage_level,
             dl.damage_note, dl.damaged_customer_name, dl.processed_by_user_id, dl.processed_by_role,
             CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS processed_name
      FROM damage_logs dl
      LEFT JOIN user u ON u.user_id = dl.processed_by_user_id
      WHERE dl.log_id = ? AND dl.inventory_item_id = ? AND dl.status = 'active'
      LIMIT 1
    `;

    db.query(getLogSql, [numericLogId, numericItemId], (logErr, logRows) => {
      if (logErr) return callback(logErr);
      if (!logRows || logRows.length === 0) {
        const err = new Error('Damage log not found or already resolved.');
        err.statusCode = 404;
        return callback(err);
      }

      const existing = logRows[0];
      const parsed = parseDamageNoteMeta(existing.damage_note);
      const issueType = normalizeIssueType(parsed?.meta?.issue_type || 'damage');
      const plainNote = parsed?.note || '';
      const customerName = String(existing.damaged_customer_name || '').trim() || 'Customer';
      const handledBy = updatedByNameInput
        || String(parsed?.meta?.handled_by || '').trim()
        || String(existing.processed_name || '').trim()
        || String(existing.processed_by_role || '').trim()
        || 'admin';
      const orderItemId = toNullablePositiveInt(parsed?.meta?.order_item_id);
      let compensationIncidentId = toNullablePositiveInt(parsed?.meta?.compensation_incident_id);
      const previousPaymentStatus = normalizePaymentStatus(parsed?.meta?.payment_status || 'unpaid');
      const sizeLabel = String(existing.size_label || existing.size_key || '').trim() || 'N/A';
      const paidAtIso = paymentStatus === 'paid' ? new Date().toISOString() : null;

      const detailLines = [
        `Customer: ${customerName}`,
        `Handled by: ${handledBy}`,
        `Damage type: ${issueType}`,
        `Size: ${sizeLabel}`,
        `Amount to pay: ₱${compensationAmount.toFixed(2)}`,
        `Payment status: ${paymentStatus}`
      ];
      if (plainNote) detailLines.push(`Comment: ${plainNote}`);

      const syncCompensationIncident = (done) => {
        const updatePayload = {
          compensation_amount: compensationAmount,
          compensation_status: paymentStatus,
          compensation_paid_at: paymentStatus === 'paid' ? new Date() : null,
          responsible_party: handledBy,
          notes: detailLines.join('\n')
        };

        if (compensationIncidentId) {
          DamageRecord.updateCompensationRecord(compensationIncidentId, updatePayload, (incidentErr) => {
            if (incidentErr) {
              console.error('Failed to update linked compensation incident:', incidentErr);
            }
            done();
          });
          return;
        }

        if (!orderItemId) {
          done();
          return;
        }

        DamageRecord.createCompensationRecord({
          order_item_id: orderItemId,
          order_id: null,
          service_type: 'rental',
          customer_name: customerName,
          reported_by_user_id: existing.processed_by_user_id || updatedByUserId || null,
          reported_by_role: existing.processed_by_role || actionByRole,
          responsible_party: handledBy,
          damage_type: issueType,
          damage_description: plainNote || `${issueType} issue on ${sizeLabel}`,
          liability_status: 'approved',
          compensation_amount: compensationAmount,
          compensation_status: paymentStatus,
          notes: detailLines.join('\n')
        }, (incidentErr, incidentResult) => {
          if (incidentErr) {
            console.error('Failed to create linked compensation incident:', incidentErr);
            done();
            return;
          }
          compensationIncidentId = incidentResult?.id ? parseInt(incidentResult.id, 10) : null;
          done();
        });
      };

      syncCompensationIncident(() => {
        const updatedDamageNote = buildDamageNoteWithMeta(plainNote, {
          issue_type: issueType,
          compensation_amount: compensationAmount,
          payment_status: paymentStatus,
          paid_at: paidAtIso,
          order_item_id: orderItemId,
          compensation_incident_id: compensationIncidentId,
          handled_by: handledBy
        });

        const updateSql = `
          UPDATE damage_logs
          SET damage_note = ?, updated_at = CURRENT_TIMESTAMP
          WHERE log_id = ? AND inventory_item_id = ?
        `;

        db.query(updateSql, [updatedDamageNote, numericLogId, numericItemId], (updateErr) => {
          if (updateErr) return callback(updateErr);

          const finishResponse = () => callback(null, {
            log_id: numericLogId,
            inventory_item_id: numericItemId,
            order_item_id: orderItemId,
            compensation_incident_id: compensationIncidentId,
            customer_name: customerName,
            handled_by: handledBy,
            damage_type: issueType,
            compensation_amount: compensationAmount,
            payment_status: paymentStatus
          });

          if (!updatedByUserId) {
            finishResponse();
            return;
          }

          const actionNotes = [
            'Service: Rental',
            `Customer: ${customerName}`,
            `Handled by: ${handledBy}`,
            `Damage type: ${issueType}`,
            `Size: ${sizeLabel}`,
            `Amount to pay: ₱${compensationAmount.toFixed(2)}`,
            `Payment status: ${paymentStatus}`
          ];
          if (plainNote) actionNotes.push(`Comment: ${plainNote}`);

          ActionLog.create({
            order_item_id: orderItemId || null,
            user_id: updatedByUserId,
            action_type: 'rental_damage_compensation',
            action_by: actionByRole,
            previous_status: previousPaymentStatus,
            new_status: paymentStatus,
            reason: null,
            notes: actionNotes.join('\n')
          }, (actionErr) => {
            if (actionErr) {
              console.error('Failed to write action log for rental damage compensation update:', actionErr);
            }
            finishResponse();
          });
        });
      });
    });
  },

  getSizeActivity: (itemId, sizeKey, callback) => {
    const numericItemId = parseInt(itemId, 10);
    const normalizedSizeKey = mapSizeInputToKey(sizeKey || '');
    if (!normalizedSizeKey) {
      const err = new Error('size_key is required');
      err.statusCode = 400;
      return callback(err);
    }

    const rentalSql = `
      SELECT oi.order_id, oi.service_id, oi.approval_status, oi.specific_data,
             CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS customer_name
      FROM order_items oi
      LEFT JOIN orders o ON o.order_id = oi.order_id
      LEFT JOIN user u ON u.user_id = o.user_id
      WHERE oi.service_type = 'rental'
        AND oi.approval_status IN ('pending','ready_to_pickup','picked_up','rented','returned')
    `;

    db.query(rentalSql, (rentedErr, rentedRows) => {
      if (rentedErr) {
        console.error('getSizeActivity rental query error:', rentedErr);
        return callback(null, { item_id: numericItemId, size_key: normalizedSizeKey, activities: [] });
      }

      const rentedActivities = [];
      (rentedRows || []).forEach((row) => {
        const specific = parseJsonSafely(row.specific_data) || {};
        const selections = collectSelectedSizesFromSpecificData(specific, row.service_id);
        selections
          .filter((sel) => {
            const selKey = mapSizeInputToKey(sel.sizeKey || sel.size_key || '');
            return Number(sel.itemId) === numericItemId && selKey === normalizedSizeKey;
          })
          .forEach((sel) => {
            const customerName =
              String(row.customer_name || '').trim() ||
              `Order #${row.order_id}`;
            const activityType = String(row.approval_status || 'rented').toLowerCase();
            rentedActivities.push({
              activity_type: activityType,
              quantity: sel.quantity,
              person_name: customerName,
              damage_level: null,
              damage_note: null,
              processed_by: null,
              created_at: null
            });
          });
      });

      const damageSql = `
        SELECT dl.log_id, dl.quantity, dl.damage_level, dl.damage_note, dl.damaged_customer_name, dl.created_at,
               CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS processed_name,
               dl.processed_by_role
        FROM damage_logs dl
        LEFT JOIN user u ON u.user_id = dl.processed_by_user_id
        WHERE dl.inventory_item_id = ?
          AND dl.size_key = ?
          AND dl.status = 'active'
        ORDER BY dl.created_at DESC
      `;

      db.query(damageSql, [numericItemId, normalizedSizeKey], (damageErr, damageRows) => {
        if (damageErr) {
          const msg = String(damageErr.message || '').toLowerCase();
          const tableMissing = msg.includes("doesn't exist") || msg.includes('no such table') || msg.includes('unknown table');
          if (!tableMissing) {
            console.error('getSizeActivity damage query error:', damageErr);
            return callback(null, { item_id: numericItemId, size_key: normalizedSizeKey, activities: rentedActivities });
          }
          damageRows = [];
        }

        const maintenanceActivities = (damageRows || []).map((row) => {
          const processedName = String(row.processed_name || '').trim();
          const processedBy = String(row.damaged_customer_name || '').trim() || processedName || row.processed_by_role || 'admin';
          const presentation = extractDamageNotePresentation(row.damage_note, row.damage_level);
          return {
            log_id: row.log_id || null,
            activity_type: 'maintenance',
            quantity: Math.max(0, parseInt(row.quantity, 10) || 0),
            person_name: null,
            damage_type: presentation.issue_type,
            damage_level: presentation.damage_level,
            damage_note: presentation.damage_note,
            compensation_amount: presentation.compensation_amount,
            payment_status: presentation.payment_status,
            order_item_id: presentation.order_item_id,
            compensation_incident_id: presentation.compensation_incident_id,
            handled_by: presentation.handled_by || processedBy,
            processed_by: processedBy,
            created_at: row.created_at || null
          };
        });

        callback(null, {
          item_id: numericItemId,
          size_key: normalizedSizeKey,
          activities: [...rentedActivities, ...maintenanceActivities]
        });
      });
    });
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