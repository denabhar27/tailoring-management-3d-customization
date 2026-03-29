const GarmentType = require('../model/GarmentTypeModel');
const db = require('../config/db');

const ensureTableExists = (callback) => {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS garment_types (
      garment_id INT AUTO_INCREMENT PRIMARY KEY,
      garment_name VARCHAR(100) NOT NULL UNIQUE,
      garment_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
      garment_code VARCHAR(50) DEFAULT NULL,
      description TEXT,
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_garment_name (garment_name),
      INDEX idx_garment_code (garment_code),
      INDEX idx_is_active (is_active),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;
  
  db.query(createTableSQL, (err) => {
    if (err) {
      console.error('Error creating garment_types table:', err);
      return callback(err);
    }

    const schemaUpdates = [
      `ALTER TABLE garment_types ADD COLUMN garment_code VARCHAR(50) DEFAULT NULL AFTER garment_price`,
      `ALTER TABLE garment_types ADD COLUMN measurement_fields JSON NULL AFTER is_active`,
      `ALTER TABLE garment_types ADD COLUMN size_chart JSON NULL AFTER measurement_fields`
    ];

    let index = 0;
    const applyNext = () => {
      if (index >= schemaUpdates.length) {
        callback(null);
        return;
      }
      db.query(schemaUpdates[index], (alterErr) => {
        index += 1;
        if (alterErr && !String(alterErr.message).includes('Duplicate column')) {
          console.warn('Garment table schema update note:', alterErr.message);
        }
        applyNext();
      });
    };
    applyNext();
  });
};

exports.getAllGarmentTypes = (req, res) => {
  ensureTableExists((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Database error. Please contact administrator.'
      });
    }
    
    GarmentType.getAll((err, garments) => {
      if (err) {
        console.error('Get garment types error:', err);
        return res.status(500).json({
          success: false,
          message: 'Error fetching garment types',
          error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      }
      
      res.json({
        success: true,
        garments: garments || []
      });
    });
  });
};

exports.getAllGarmentTypesAdmin = (req, res) => {
  ensureTableExists((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Database error. Please contact administrator.'
      });
    }
    
    GarmentType.getAllAdmin((err, garments) => {
      if (err) {
        console.error('Get garment types (admin) error:', err);
        return res.status(500).json({
          success: false,
          message: 'Error fetching garment types',
          error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      }
      
      res.json({
        success: true,
        garments: garments || []
      });
    });
  });
};

exports.getGarmentTypeById = (req, res) => {
  const garmentId = req.params.garmentId;
  
  GarmentType.getById(garmentId, (err, garment) => {
    if (err) {
      console.error('Get garment type error:', err);
      return res.status(500).json({
        success: false,
        message: 'Error fetching garment type',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    if (!garment || garment.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Garment type not found'
      });
    }
    
    res.json({
      success: true,
      garment: garment[0]
    });
  });
};

exports.createGarmentType = (req, res) => {
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin only.'
    });
  }
  
  const { garment_name, garment_price, garment_code, description, is_active, measurement_fields, size_chart } = req.body;
  
  if (!garment_name || !garment_name.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Garment name is required'
    });
  }
  
  if (garment_price === undefined || garment_price === null || isNaN(parseFloat(garment_price))) {
    return res.status(400).json({
      success: false,
      message: 'Valid garment price is required'
    });
  }
  
  ensureTableExists((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Database error. Please contact administrator.'
      });
    }
    
    const garmentData = {
      garment_name: garment_name.trim(),
      garment_price: parseFloat(garment_price),
      garment_code: garment_code ? garment_code.trim().toLowerCase() : null,
      description: description || null,
      is_active: is_active !== undefined ? is_active : 1,
      measurement_fields: Array.isArray(measurement_fields) ? measurement_fields : null,
      size_chart: size_chart && typeof size_chart === 'object' ? size_chart : null
    };
    
    GarmentType.create(garmentData, (err, result) => {
      if (err) {
        console.error('Create garment type error:', err);
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({
            success: false,
            message: 'Garment type with this name already exists'
          });
        }
        return res.status(500).json({
          success: false,
          message: 'Error creating garment type',
          error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      }
      
      res.json({
        success: true,
        message: 'Garment type created successfully',
        garment: {
          garment_id: result.insertId,
          ...garmentData
        }
      });
    });
  });
};

exports.updateGarmentType = (req, res) => {
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin only.'
    });
  }
  
  const garmentId = req.params.garmentId;
  const { garment_name, garment_price, garment_code, description, is_active, measurement_fields, size_chart } = req.body;
  
  if (!garment_name || !garment_name.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Garment name is required'
    });
  }
  
  if (garment_price === undefined || garment_price === null || isNaN(parseFloat(garment_price))) {
    return res.status(400).json({
      success: false,
      message: 'Valid garment price is required'
    });
  }
  
  const garmentData = {
    garment_name: garment_name.trim(),
    garment_price: parseFloat(garment_price),
    garment_code: garment_code ? garment_code.trim().toLowerCase() : null,
    description: description || null,
    is_active: is_active !== undefined ? is_active : 1,
    measurement_fields: Array.isArray(measurement_fields) ? measurement_fields : null,
    size_chart: size_chart && typeof size_chart === 'object' ? size_chart : null
  };
  
  GarmentType.update(garmentId, garmentData, (err, result) => {
    if (err) {
      console.error('Update garment type error:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
          success: false,
          message: 'Garment type with this name already exists'
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Error updating garment type',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Garment type not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Garment type updated successfully'
    });
  });
};

exports.deleteGarmentType = (req, res) => {
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin only.'
    });
  }
  
  const garmentId = req.params.garmentId;
  const permanent = req.query.permanent === 'true';
  
  if (permanent) {
    GarmentType.permanentDelete(garmentId, (err, result) => {
      if (err) {
        console.error('Delete garment type error:', err);
        return res.status(500).json({
          success: false,
          message: 'Error deleting garment type',
          error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      }
      
      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Garment type not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Garment type permanently deleted'
      });
    });
  } else {
    GarmentType.delete(garmentId, (err, result) => {
      if (err) {
        console.error('Delete garment type error:', err);
        return res.status(500).json({
          success: false,
          message: 'Error deleting garment type',
          error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      }
      
      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Garment type not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Garment type deleted (deactivated)'
      });
    });
  }
};

