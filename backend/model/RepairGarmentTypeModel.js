const db = require('../config/db');

const RepairGarmentType = {
  initializeDamageLevelSchema: (callback) => {
    const createGarmentTypesSQL = `
      CREATE TABLE IF NOT EXISTS repair_garment_types (
        repair_garment_id INT AUTO_INCREMENT PRIMARY KEY,
        garment_name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        has_damage_levels TINYINT(1) DEFAULT 1,
        default_damage_level_id INT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_garment_name (garment_name),
        INDEX idx_is_active (is_active),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;

    const createDamageLevelsSQL = `
      CREATE TABLE IF NOT EXISTS repair_damage_levels (
        repair_damage_level_id INT AUTO_INCREMENT PRIMARY KEY,
        repair_garment_id INT NOT NULL,
        level_name VARCHAR(120) NOT NULL,
        level_description TEXT,
        base_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        is_active TINYINT(1) DEFAULT 1,
        sort_order INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_repair_garment_id (repair_garment_id),
        INDEX idx_level_active_sort (is_active, sort_order),
        UNIQUE KEY uniq_garment_level_name (repair_garment_id, level_name),
        CONSTRAINT fk_repair_damage_levels_garment
          FOREIGN KEY (repair_garment_id) REFERENCES repair_garment_types(repair_garment_id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;

    const addHasDamageLevelsSQL = `
      ALTER TABLE repair_garment_types
      ADD COLUMN has_damage_levels TINYINT(1) DEFAULT 1 AFTER description
    `;

    const addDefaultDamageLevelIdSQL = `
      ALTER TABLE repair_garment_types
      ADD COLUMN default_damage_level_id INT NULL AFTER has_damage_levels
    `;

    const addDefaultDamageLevelFKSQL = `
      ALTER TABLE repair_garment_types
      ADD CONSTRAINT fk_repair_garment_default_damage_level
      FOREIGN KEY (default_damage_level_id) REFERENCES repair_damage_levels(repair_damage_level_id)
      ON DELETE SET NULL
    `;

    const isIgnorableFkError = (error) => {
      if (!error) return true;
      const ignorableCodes = [
        'ER_DUP_KEYNAME',
        'ER_DUP_KEY',
        'ER_FK_DUP_NAME',
        'ER_CANT_CREATE_TABLE',
        'ER_NO_SUCH_TABLE'
      ];
      if (ignorableCodes.includes(error.code)) return true;

      const message = String(error.message || '').toLowerCase();
      return message.includes('duplicate') || message.includes('already exists') || message.includes('foreign key');
    };

    db.query(createGarmentTypesSQL, (err) => {
      if (err) return callback(err);

      db.query(createDamageLevelsSQL, (damageErr) => {
        if (damageErr) return callback(damageErr);

        db.query(addHasDamageLevelsSQL, (alterErr1) => {
          if (alterErr1 && alterErr1.code !== 'ER_DUP_FIELDNAME') {
            return callback(alterErr1);
          }

          db.query(addDefaultDamageLevelIdSQL, (alterErr2) => {
            if (alterErr2 && alterErr2.code !== 'ER_DUP_FIELDNAME') {
              return callback(alterErr2);
            }

            db.query(addDefaultDamageLevelFKSQL, (alterErr3) => {
              if (alterErr3 && !isIgnorableFkError(alterErr3)) {
                return callback(alterErr3);
              }

              // Remove legacy seeded defaults so UI only shows admin-defined levels.
              const cleanupSeededSQL = `
                DELETE FROM repair_damage_levels
                WHERE level_name IN ('Minor', 'Moderate', 'Major', 'Severe')
              `;

              db.query(cleanupSeededSQL, (cleanupErr) => {
                if (cleanupErr) {
                  console.warn('Cleanup seeded damage levels warning:', cleanupErr.message);
                }

                const syncHasDamageLevelsSQL = `
                  UPDATE repair_garment_types g
                  SET g.has_damage_levels = CASE
                    WHEN EXISTS (
                      SELECT 1
                      FROM repair_damage_levels dl
                      WHERE dl.repair_garment_id = g.repair_garment_id
                    ) THEN 1
                    ELSE 0
                  END
                `;

                db.query(syncHasDamageLevelsSQL, (syncErr) => {
                  if (syncErr) return callback(syncErr);

                  const setDefaultDamageLevelSQL = `
                    UPDATE repair_garment_types g
                    SET g.default_damage_level_id = (
                      SELECT dl.repair_damage_level_id
                      FROM repair_damage_levels dl
                      WHERE dl.repair_garment_id = g.repair_garment_id
                      ORDER BY dl.sort_order ASC, dl.repair_damage_level_id ASC
                      LIMIT 1
                    )
                    WHERE g.default_damage_level_id IS NULL
                  `;

                  db.query(setDefaultDamageLevelSQL, callback);
                });
              });
            });
          });
        });
      });
    });
  },

  getAllWithDamageLevels: (callback) => {
    const sql = `
      SELECT
        g.*,
        d.repair_damage_level_id,
        d.level_name,
        d.level_description,
        d.base_price,
        d.is_active AS damage_level_is_active,
        d.sort_order AS damage_level_sort_order
      FROM repair_garment_types g
      LEFT JOIN repair_damage_levels d
        ON d.repair_garment_id = g.repair_garment_id
        AND d.is_active = 1
      WHERE g.is_active = 1
      ORDER BY g.garment_name ASC, d.sort_order ASC, d.level_name ASC
    `;
    db.query(sql, callback);
  },

  getAllAdminWithDamageLevels: (callback) => {
    const sql = `
      SELECT
        g.*,
        d.repair_damage_level_id,
        d.level_name,
        d.level_description,
        d.base_price,
        d.is_active AS damage_level_is_active,
        d.sort_order AS damage_level_sort_order
      FROM repair_garment_types g
      LEFT JOIN repair_damage_levels d
        ON d.repair_garment_id = g.repair_garment_id
      ORDER BY g.created_at DESC, d.sort_order ASC, d.level_name ASC
    `;
    db.query(sql, callback);
  },

  getByIdWithDamageLevels: (garmentId, callback) => {
    const sql = `
      SELECT
        g.*,
        d.repair_damage_level_id,
        d.level_name,
        d.level_description,
        d.base_price,
        d.is_active AS damage_level_is_active,
        d.sort_order AS damage_level_sort_order
      FROM repair_garment_types g
      LEFT JOIN repair_damage_levels d
        ON d.repair_garment_id = g.repair_garment_id
      WHERE g.repair_garment_id = ?
      ORDER BY d.sort_order ASC, d.level_name ASC
    `;
    db.query(sql, [garmentId], callback);
  },

  getDamageLevelsByGarmentId: (garmentId, includeInactive, callback) => {
    const sql = `
      SELECT *
      FROM repair_damage_levels
      WHERE repair_garment_id = ?
      ${includeInactive ? '' : 'AND is_active = 1'}
      ORDER BY sort_order ASC, level_name ASC
    `;
    db.query(sql, [garmentId], callback);
  },

  create: (garmentData, callback) => {
    const { garment_name, description, is_active, has_damage_levels, default_damage_level_id } = garmentData;
    const sql = `
      INSERT INTO repair_garment_types (garment_name, description, is_active, has_damage_levels, default_damage_level_id)
      VALUES (?, ?, ?, ?, ?)
    `;
    db.query(
      sql,
      [
        garment_name,
        description || null,
        is_active !== undefined ? is_active : 1,
        has_damage_levels !== undefined ? has_damage_levels : 1,
        default_damage_level_id || null
      ],
      callback
    );
  },

  update: (garmentId, garmentData, callback) => {
    const { garment_name, description, is_active, has_damage_levels, default_damage_level_id } = garmentData;
    const sql = `
      UPDATE repair_garment_types
      SET garment_name = ?, description = ?, is_active = ?, has_damage_levels = ?, default_damage_level_id = ?
      WHERE repair_garment_id = ?
    `;
    db.query(
      sql,
      [
        garment_name,
        description || null,
        is_active !== undefined ? is_active : 1,
        has_damage_levels !== undefined ? has_damage_levels : 1,
        default_damage_level_id || null,
        garmentId
      ],
      callback
    );
  },

  delete: (garmentId, callback) => {
    const sql = `UPDATE repair_garment_types SET is_active = 0 WHERE repair_garment_id = ?`;
    db.query(sql, [garmentId], callback);
  },

  permanentDelete: (garmentId, callback) => {
    const sql = `DELETE FROM repair_garment_types WHERE repair_garment_id = ?`;
    db.query(sql, [garmentId], callback);
  },

  createDamageLevel: (levelData, callback) => {
    const { repair_garment_id, level_name, level_description, base_price, is_active, sort_order } = levelData;
    const sql = `
      INSERT INTO repair_damage_levels
      (repair_garment_id, level_name, level_description, base_price, is_active, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    db.query(
      sql,
      [
        repair_garment_id,
        level_name,
        level_description || null,
        parseFloat(base_price || 0),
        is_active !== undefined ? is_active : 1,
        sort_order !== undefined ? sort_order : 0
      ],
      callback
    );
  },

  updateDamageLevel: (damageLevelId, levelData, callback) => {
    const { level_name, level_description, base_price, is_active, sort_order } = levelData;
    const sql = `
      UPDATE repair_damage_levels
      SET level_name = ?, level_description = ?, base_price = ?, is_active = ?, sort_order = ?
      WHERE repair_damage_level_id = ?
    `;
    db.query(
      sql,
      [
        level_name,
        level_description || null,
        parseFloat(base_price || 0),
        is_active !== undefined ? is_active : 1,
        sort_order !== undefined ? sort_order : 0,
        damageLevelId
      ],
      callback
    );
  },

  deleteDamageLevel: (damageLevelId, callback) => {
    const sql = `DELETE FROM repair_damage_levels WHERE repair_damage_level_id = ?`;
    db.query(sql, [damageLevelId], callback);
  }
};

module.exports = RepairGarmentType;
