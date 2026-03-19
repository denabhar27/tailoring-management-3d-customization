CREATE TABLE IF NOT EXISTS damage_logs (
  damage_log_id INT AUTO_INCREMENT PRIMARY KEY,
  inventory_item_id INT NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  size_key VARCHAR(100) NOT NULL,
  size_label VARCHAR(150) NULL,
  quantity INT NOT NULL DEFAULT 1,
  damage_level ENUM('minor', 'moderate', 'severe') NOT NULL,
  damage_note TEXT NULL,
  processed_by_user_id INT NULL,
  processed_by_role VARCHAR(50) NOT NULL DEFAULT 'admin',
  status ENUM('active', 'resolved') NOT NULL DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_damage_inventory_item (inventory_item_id),
  INDEX idx_damage_size (size_key),
  INDEX idx_damage_status (status),
  INDEX idx_damage_created_at (created_at),
  INDEX idx_damage_processed_by (processed_by_user_id),
  CONSTRAINT fk_damage_logs_inventory_item
    FOREIGN KEY (inventory_item_id) REFERENCES rental_inventory(item_id) ON DELETE CASCADE,
  CONSTRAINT fk_damage_logs_processed_user
    FOREIGN KEY (processed_by_user_id) REFERENCES user(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
