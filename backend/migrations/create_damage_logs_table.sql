-- Migration: Create damage_logs table for tracking rental item damage
-- This table stores damage reports for rental items with size-specific tracking

CREATE TABLE IF NOT EXISTS damage_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  inventory_item_id INT NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  size_key VARCHAR(50) NOT NULL,
  size_label VARCHAR(100) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  damage_level ENUM('minor', 'moderate', 'severe') NOT NULL,
  damage_note TEXT,
  damaged_customer_name VARCHAR(255),
  processed_by_user_id INT,
  processed_by_role VARCHAR(50) DEFAULT 'admin',
  status ENUM('active', 'resolved', 'archived') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_inventory_item (inventory_item_id),
  INDEX idx_size_key (size_key),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (inventory_item_id) REFERENCES rental_inventory(item_id) ON DELETE CASCADE,
  FOREIGN KEY (processed_by_user_id) REFERENCES user(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
