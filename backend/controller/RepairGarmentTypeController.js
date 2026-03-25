const RepairGarmentType = require('../model/RepairGarmentTypeModel');

const ensureTableExists = (callback) => {
  RepairGarmentType.initializeDamageLevelSchema((err) => {
    if (err) {
      console.error('Error initializing repair garment + damage level schema:', err);
      return callback(err);
    }
    callback(null);
  });
};

const groupDenormalizedRows = (rows) => {
  const garmentMap = {};
  
  (rows || []).forEach((row) => {
    const garmentId = row.repair_garment_id;
    
    if (!garmentMap[garmentId]) {
      // First occurrence of this garment - extract base garment data
      garmentMap[garmentId] = {
        repair_garment_id: row.repair_garment_id,
        garment_name: row.garment_name,
        description: row.description || row.garment_description || null,
        base_price: row.base_price !== undefined && row.base_price !== null ? parseFloat(row.base_price) : null,
        estimate_hours: row.estimate_hours,
        is_active: Number(row.is_active) === 1 ? 1 : 0,
        has_damage_levels: Number(row.has_damage_levels) === 1 ? 1 : 0,
        default_damage_level_id: row.default_damage_level_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
        damage_levels: []
      };
    }
    
    // Add damage level if it exists in this row
    if (row.repair_damage_level_id) {
      garmentMap[garmentId].damage_levels.push({
        repair_damage_level_id: row.repair_damage_level_id,
        repair_garment_id: garmentId,
        level_name: row.level_name,
        level_description: row.level_description,
        base_price: row.base_price !== undefined && row.base_price !== null ? parseFloat(row.base_price) : 0,
        is_active: Number(row.damage_level_is_active) === 1 ? 1 : 0,
        sort_order: row.damage_level_sort_order !== undefined && row.damage_level_sort_order !== null
          ? parseInt(row.damage_level_sort_order, 10) || 0
          : 0
      });
    }
  });
  
  return Object.values(garmentMap);
};

const parseDamageLevelsJson = (garment) => {
  if (!garment) return garment;

  let parsedLevels = [];
  try {
    if (Array.isArray(garment.damage_levels)) {
      parsedLevels = garment.damage_levels;
    } else if (typeof garment.damage_levels === 'string') {
      parsedLevels = JSON.parse(garment.damage_levels || '[]');
    }
  } catch (err) {
    parsedLevels = [];
  }

  garment.damage_levels = (parsedLevels || []).filter((level) => level && level.repair_damage_level_id);
  return garment;
};

exports.initializeRepairDamageLevelSystem = () => {
  ensureTableExists((err) => {
    if (err) {
      return console.error('[REPAIR] Failed to initialize repair damage level system:', err.message);
    }
    console.log('[REPAIR] Repair garment type and damage level schema initialized');
  });
};

exports.getAllRepairGarmentTypes = (req, res) => {
  ensureTableExists((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Database error. Please contact administrator.'
      });
    }
    
    RepairGarmentType.getAllWithDamageLevels((err, rows) => {
      if (err) {
        console.error('Get repair garment types error:', err);
        return res.status(500).json({
          success: false,
          message: 'Error fetching repair garment types',
          error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      }
      
      const garments = groupDenormalizedRows(rows);

      res.json({
        success: true,
        garments: garments
      });
    });
  });
};

exports.getAllRepairGarmentTypesAdmin = (req, res) => {
  ensureTableExists((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Database error. Please contact administrator.'
      });
    }
    
    RepairGarmentType.getAllAdminWithDamageLevels((err, rows) => {
      if (err) {
        console.error('Get repair garment types (admin) error:', err);
        return res.status(500).json({
          success: false,
          message: 'Error fetching repair garment types',
          error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      }
      
      const garments = groupDenormalizedRows(rows);

      res.json({
        success: true,
        garments: garments
      });
    });
  });
};

exports.getRepairGarmentTypeById = (req, res) => {
  const garmentId = req.params.garmentId;
  
  RepairGarmentType.getByIdWithDamageLevels(garmentId, (err, rows) => {
    if (err) {
      console.error('Get repair garment type error:', err);
      return res.status(500).json({
        success: false,
        message: 'Error fetching repair garment type',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Repair garment type not found'
      });
    }
    
    const garments = groupDenormalizedRows(rows);
    const garment = garments[0];

    res.json({
      success: true,
      garment: garment
    });
  });
};

exports.createRepairGarmentType = (req, res) => {
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin only.'
    });
  }
  
  const { garment_name, description, is_active, has_damage_levels, default_damage_level_id, damage_levels } = req.body;
  
  if (!garment_name || !garment_name.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Garment name is required'
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
      description: description || null,
      has_damage_levels: has_damage_levels !== undefined ? has_damage_levels : 1,
      default_damage_level_id: default_damage_level_id || null,
      is_active: is_active !== undefined ? is_active : 1
    };
    
    RepairGarmentType.create(garmentData, (err, result) => {
      if (err) {
        console.error('Create repair garment type error:', err);
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({
            success: false,
            message: 'Repair garment type with this name already exists'
          });
        }
        return res.status(500).json({
          success: false,
          message: 'Error creating repair garment type',
          error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      }

      const createdGarmentId = result.insertId;

      const normalizedDamageLevels = Array.isArray(damage_levels)
        ? damage_levels.filter((level) => level && level.level_name && String(level.level_name).trim() !== '')
        : [];

      if (normalizedDamageLevels.length === 0) {
        return res.json({
          success: true,
          message: 'Repair garment type created successfully',
          garment: {
            repair_garment_id: createdGarmentId,
            ...garmentData,
            damage_levels: []
          }
        });
      }

      let createdCount = 0;
      let createFailed = false;

      normalizedDamageLevels.forEach((level) => {
        if (createFailed) return;
        RepairGarmentType.createDamageLevel({
          repair_garment_id: createdGarmentId,
          level_name: String(level.level_name).trim(),
          level_description: level.level_description || null,
          base_price: parseFloat(level.base_price || 0),
          is_active: level.is_active !== undefined ? level.is_active : 1,
          sort_order: level.sort_order !== undefined ? level.sort_order : 0
        }, (createErr) => {
          if (createErr && !createFailed) {
            createFailed = true;
            console.error('Create repair damage level error:', createErr);
            return res.status(500).json({
              success: false,
              message: 'Repair garment created but failed to add one or more damage levels',
              error: process.env.NODE_ENV === 'development' ? createErr.message : undefined
            });
          }

          createdCount += 1;
          if (createdCount === normalizedDamageLevels.length && !createFailed) {
            return RepairGarmentType.getByIdWithDamageLevels(createdGarmentId, (getErr, rows) => {
              if (getErr) {
                return res.json({
                  success: true,
                  message: 'Repair garment type created successfully',
                  garment: {
                    repair_garment_id: createdGarmentId,
                    ...garmentData
                  }
                });
              }

              const garments = groupDenormalizedRows(rows);
              return res.json({
                success: true,
                message: 'Repair garment type created successfully',
                garment: garments[0]
              });
            });
          }
        });
      });
    });
  });
};

exports.updateRepairGarmentType = (req, res) => {
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin only.'
    });
  }
  
  const garmentId = req.params.garmentId;
  const { garment_name, description, is_active, has_damage_levels, default_damage_level_id } = req.body;
  
  if (!garment_name || !garment_name.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Garment name is required'
    });
  }
  
  const garmentData = {
    garment_name: garment_name.trim(),
    description: description || null,
    has_damage_levels: has_damage_levels !== undefined ? has_damage_levels : 1,
    default_damage_level_id: default_damage_level_id || null,
    is_active: is_active !== undefined ? is_active : 1
  };
  
  RepairGarmentType.update(garmentId, garmentData, (err, result) => {
    if (err) {
      console.error('Update repair garment type error:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
          success: false,
          message: 'Repair garment type with this name already exists'
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Error updating repair garment type',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Repair garment type not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Repair garment type updated successfully'
    });
  });
};

exports.deleteRepairGarmentType = (req, res) => {
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin only.'
    });
  }
  
  const garmentId = req.params.garmentId;
  const permanent = req.query.permanent === 'true';
  
  if (permanent) {
    RepairGarmentType.permanentDelete(garmentId, (err, result) => {
      if (err) {
        console.error('Delete repair garment type error:', err);
        return res.status(500).json({
          success: false,
          message: 'Error deleting repair garment type',
          error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      }
      
      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Repair garment type not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Repair garment type permanently deleted'
      });
    });
  } else {
    RepairGarmentType.delete(garmentId, (err, result) => {
      if (err) {
        console.error('Delete repair garment type error:', err);
        return res.status(500).json({
          success: false,
          message: 'Error deleting repair garment type',
          error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      }
      
      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Repair garment type not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Repair garment type deleted (deactivated)'
      });
    });
  }
};

exports.getDamageLevelsByGarmentId = (req, res) => {
  const garmentId = req.params.garmentId;
  const includeInactive = req.query.includeInactive === 'true';

  ensureTableExists((initErr) => {
    if (initErr) {
      return res.status(500).json({
        success: false,
        message: 'Database error. Please contact administrator.'
      });
    }

    RepairGarmentType.getDamageLevelsByGarmentId(garmentId, includeInactive, (err, damageLevels) => {
      if (err) {
        console.error('Get repair damage levels error:', err);
        return res.status(500).json({
          success: false,
          message: 'Error fetching repair damage levels',
          error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      }

      return res.json({
        success: true,
        damage_levels: damageLevels || []
      });
    });
  });
};

exports.createDamageLevel = (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin only.'
    });
  }

  const garmentId = req.params.garmentId;
  const { level_name, level_description, base_price, is_active, sort_order } = req.body;

  if (!level_name || !String(level_name).trim()) {
    return res.status(400).json({
      success: false,
      message: 'Damage level name is required'
    });
  }

  if (base_price === undefined || isNaN(parseFloat(base_price))) {
    return res.status(400).json({
      success: false,
      message: 'Valid base price is required'
    });
  }

  RepairGarmentType.createDamageLevel({
    repair_garment_id: garmentId,
    level_name: String(level_name).trim(),
    level_description: level_description || null,
    base_price: parseFloat(base_price),
    is_active: is_active !== undefined ? is_active : 1,
    sort_order: sort_order !== undefined ? parseInt(sort_order, 10) || 0 : 0
  }, (err, result) => {
    if (err) {
      console.error('Create repair damage level error:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
          success: false,
          message: 'Damage level with this name already exists for this garment type'
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Error creating repair damage level',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }

    return res.json({
      success: true,
      message: 'Damage level created successfully',
      damage_level: {
        repair_damage_level_id: result.insertId,
        repair_garment_id: parseInt(garmentId, 10),
        level_name: String(level_name).trim(),
        level_description: level_description || null,
        base_price: parseFloat(base_price),
        is_active: is_active !== undefined ? is_active : 1,
        sort_order: sort_order !== undefined ? parseInt(sort_order, 10) || 0 : 0
      }
    });
  });
};

exports.updateDamageLevel = (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin only.'
    });
  }

  const damageLevelId = req.params.damageLevelId;
  const { level_name, level_description, base_price, is_active, sort_order } = req.body;

  if (!level_name || !String(level_name).trim()) {
    return res.status(400).json({
      success: false,
      message: 'Damage level name is required'
    });
  }

  if (base_price === undefined || isNaN(parseFloat(base_price))) {
    return res.status(400).json({
      success: false,
      message: 'Valid base price is required'
    });
  }

  RepairGarmentType.updateDamageLevel(damageLevelId, {
    level_name: String(level_name).trim(),
    level_description: level_description || null,
    base_price: parseFloat(base_price),
    is_active: is_active !== undefined ? is_active : 1,
    sort_order: sort_order !== undefined ? parseInt(sort_order, 10) || 0 : 0
  }, (err, result) => {
    if (err) {
      console.error('Update repair damage level error:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
          success: false,
          message: 'Damage level with this name already exists for this garment type'
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Error updating repair damage level',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Damage level not found'
      });
    }

    return res.json({
      success: true,
      message: 'Damage level updated successfully'
    });
  });
};

exports.deleteDamageLevel = (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin only.'
    });
  }

  const damageLevelId = req.params.damageLevelId;

  RepairGarmentType.deleteDamageLevel(damageLevelId, (err, result) => {
    if (err) {
      console.error('Delete repair damage level error:', err);
      return res.status(500).json({
        success: false,
        message: 'Error deleting repair damage level',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Damage level not found'
      });
    }

    return res.json({
      success: true,
      message: 'Damage level deleted successfully'
    });
  });
};

