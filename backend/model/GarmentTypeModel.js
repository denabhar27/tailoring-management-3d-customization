const db = require('../config/db');

const GarmentType = {
  
  getAll: (callback) => {
    const sql = `SELECT * FROM garment_types WHERE is_active = 1 ORDER BY garment_name ASC`;
    db.query(sql, (err, results) => {
      if (err) return callback(err);
      const parsed = (results || []).map(r => ({
        ...r,
        measurement_fields: GarmentType._parseJSON(r.measurement_fields),
        size_chart: GarmentType._parseJSON(r.size_chart)
      }));
      callback(null, parsed);
    });
  },

  getAllAdmin: (callback) => {
    const sql = `SELECT * FROM garment_types ORDER BY created_at DESC`;
    db.query(sql, (err, results) => {
      if (err) return callback(err);
      const parsed = (results || []).map(r => ({
        ...r,
        measurement_fields: GarmentType._parseJSON(r.measurement_fields),
        size_chart: GarmentType._parseJSON(r.size_chart)
      }));
      callback(null, parsed);
    });
  },

  getById: (garmentId, callback) => {
    const sql = `SELECT * FROM garment_types WHERE garment_id = ?`;
    db.query(sql, [garmentId], (err, results) => {
      if (err) return callback(err);
      const parsed = (results || []).map(r => ({
        ...r,
        measurement_fields: GarmentType._parseJSON(r.measurement_fields),
        size_chart: GarmentType._parseJSON(r.size_chart)
      }));
      callback(null, parsed);
    });
  },

  create: (garmentData, callback) => {
    const { garment_name, garment_price, garment_code, description, is_active, measurement_fields, size_chart } = garmentData;
    const sql = `
      INSERT INTO garment_types (garment_name, garment_price, garment_code, description, is_active, measurement_fields, size_chart)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(
      sql,
      [
        garment_name,
        garment_price || 0.00,
        garment_code || null,
        description || null,
        is_active !== undefined ? is_active : 1,
        measurement_fields ? JSON.stringify(measurement_fields) : null,
        size_chart ? JSON.stringify(size_chart) : null
      ],
      callback
    );
  },

  update: (garmentId, garmentData, callback) => {
    const { garment_name, garment_price, garment_code, description, is_active, measurement_fields, size_chart } = garmentData;
    const sql = `
      UPDATE garment_types 
      SET garment_name = ?, garment_price = ?, garment_code = ?, description = ?, is_active = ?, measurement_fields = ?, size_chart = ?
      WHERE garment_id = ?
    `;
    db.query(
      sql,
      [
        garment_name,
        garment_price,
        garment_code || null,
        description || null,
        is_active !== undefined ? is_active : 1,
        measurement_fields ? JSON.stringify(measurement_fields) : null,
        size_chart ? JSON.stringify(size_chart) : null,
        garmentId
      ],
      callback
    );
  },

  delete: (garmentId, callback) => {
    const sql = `UPDATE garment_types SET is_active = 0 WHERE garment_id = ?`;
    db.query(sql, [garmentId], callback);
  },

  permanentDelete: (garmentId, callback) => {
    const sql = `DELETE FROM garment_types WHERE garment_id = ?`;
    db.query(sql, [garmentId], callback);
  },

  _parseJSON: (value) => {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch (e) {
      return null;
    }
  }
};

module.exports = GarmentType;

