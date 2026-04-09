const db = require('../config/db');

const Custom3DModel = {

  _parseJSON: (value) => {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch (e) {
      return null;
    }
  },
  
  getAll: (callback) => {
    const sql = `
      SELECT * FROM custom_3d_models 
      WHERE is_active = 1 
      ORDER BY created_at DESC
    `;
    db.query(sql, (err, results) => {
      if (err) return callback(err);
      const parsed = (results || []).map((r) => ({
        ...r,
        measurement_fields: Custom3DModel._parseJSON(r.measurement_fields),
        size_chart: Custom3DModel._parseJSON(r.size_chart)
      }));
      callback(null, parsed);
    });
  },

  getByType: (modelType, callback) => {
    const sql = `
      SELECT * FROM custom_3d_models 
      WHERE model_type = ? AND is_active = 1 
      ORDER BY created_at DESC
    `;
    db.query(sql, [modelType], (err, results) => {
      if (err) return callback(err);
      const parsed = (results || []).map((r) => ({
        ...r,
        measurement_fields: Custom3DModel._parseJSON(r.measurement_fields),
        size_chart: Custom3DModel._parseJSON(r.size_chart)
      }));
      callback(null, parsed);
    });
  },

  getByCategory: (category, callback) => {
    const sql = `
      SELECT * FROM custom_3d_models 
      WHERE garment_category = ? AND is_active = 1 
      ORDER BY created_at DESC
    `;
    db.query(sql, [category], (err, results) => {
      if (err) return callback(err);
      const parsed = (results || []).map((r) => ({
        ...r,
        measurement_fields: Custom3DModel._parseJSON(r.measurement_fields),
        size_chart: Custom3DModel._parseJSON(r.size_chart)
      }));
      callback(null, parsed);
    });
  },

  getById: (modelId, callback) => {
    const sql = `
      SELECT * FROM custom_3d_models 
      WHERE model_id = ?
    `;
    db.query(sql, [modelId], (err, results) => {
      if (err) return callback(err, null);
      if (results.length === 0) return callback(null, null);
      const row = results[0];
      callback(null, {
        ...row,
        measurement_fields: Custom3DModel._parseJSON(row.measurement_fields),
        size_chart: Custom3DModel._parseJSON(row.size_chart)
      });
    });
  },

  create: (modelData, callback) => {
    const { model_name, model_type, file_path, file_url, garment_category, description, created_by } = modelData;
    const sql = `
      INSERT INTO custom_3d_models 
      (model_name, model_type, file_path, file_url, garment_category, description, created_by) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(sql, [model_name, model_type, file_path, file_url, garment_category, description, created_by], callback);
  },

  update: (modelId, updateData, callback) => {
    const { model_name, model_type, file_path, file_url, garment_category, description, is_active, measurement_fields, size_chart } = updateData;
    const updates = [];
    const values = [];

    if (model_name !== undefined) {
      updates.push('model_name = ?');
      values.push(model_name);
    }
    if (model_type !== undefined) {
      updates.push('model_type = ?');
      values.push(model_type);
    }
    if (file_path !== undefined) {
      updates.push('file_path = ?');
      values.push(file_path);
    }
    if (file_url !== undefined) {
      updates.push('file_url = ?');
      values.push(file_url);
    }
    if (garment_category !== undefined) {
      updates.push('garment_category = ?');
      values.push(garment_category);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active);
    }
    if (measurement_fields !== undefined) {
      updates.push('measurement_fields = ?');
      values.push(measurement_fields ? JSON.stringify(measurement_fields) : null);
    }
    if (size_chart !== undefined) {
      updates.push('size_chart = ?');
      values.push(size_chart ? JSON.stringify(size_chart) : null);
    }

    if (updates.length === 0) {
      return callback(new Error('No fields to update'), null);
    }

    values.push(modelId);
    const sql = `UPDATE custom_3d_models SET ${updates.join(', ')} WHERE model_id = ?`;
    db.query(sql, values, callback);
  },

  delete: (modelId, callback) => {
    const sql = `UPDATE custom_3d_models SET is_active = 0 WHERE model_id = ?`;
    db.query(sql, [modelId], callback);
  }
};

module.exports = Custom3DModel;

