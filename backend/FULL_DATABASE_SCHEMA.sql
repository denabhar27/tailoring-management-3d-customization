
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS transaction_logs;
DROP TABLE IF EXISTS action_logs;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS order_tracking;
DROP TABLE IF EXISTS appointment_slots;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS cart;
DROP TABLE IF EXISTS customer_measurements;
DROP TABLE IF EXISTS rental_inventory;
DROP TABLE IF EXISTS custom_3d_models;
DROP TABLE IF EXISTS dry_cleaning_services;
DROP TABLE IF EXISTS repair_garment_types;
DROP TABLE IF EXISTS garment_types;
DROP TABLE IF EXISTS fabric_types;
DROP TABLE IF EXISTS time_slots;
DROP TABLE IF EXISTS shop_schedule;
DROP TABLE IF EXISTS admin;
DROP TABLE IF EXISTS user;

SET FOREIGN_KEY_CHECKS = 1;

-- ================================================================
-- 1. USER TABLE (must be created first - referenced by other tables)
-- ================================================================
CREATE TABLE user (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100) NULL,
  last_name VARCHAR(100) NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20),
  profile_picture VARCHAR(255),
  google_id VARCHAR(255),
  role ENUM('user', 'admin', 'clerk') DEFAULT 'user',
  status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_email (email),
  INDEX idx_username (username),
  INDEX idx_role (role),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 2. ADMIN TABLE (separate table for admin users)
-- ================================================================
CREATE TABLE admin (
  admin_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default admins (password: admin123 for both)
-- Password hash is bcrypt for 'admin123'
INSERT INTO admin (username, password) VALUES
('admin', '$2b$10$pwfe34phr/k.JLz2ec6z0uwmpWJm6inC4bwMZYxZaXTOvx5JOX5X2'),
('admin_den', '$2b$10$pwfe34phr/k.JLz2ec6z0uwmpWJm6inC4bwMZYxZaXTOvx5JOX5X2');

-- ================================================================
-- 2. ORDERS TABLE
-- ================================================================
CREATE TABLE orders (
  order_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  total_price DECIMAL(10,2) DEFAULT 0.00,
  status ENUM('pending', 'processing', 'completed', 'cancelled') DEFAULT 'pending',
  order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_order_date (order_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 3. ORDER_ITEMS TABLE
-- ================================================================
CREATE TABLE order_items (
  item_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  service_type ENUM('tailoring', 'dry_cleaning', 'repair', 'rental', 'customization') NOT NULL,
  service_id INT,
  garment_type_id INT,
  fabric_type_id INT,
  quantity INT DEFAULT 1,
  special_instructions TEXT,
  measurements JSON,
  measurement_image VARCHAR(255),
  reference_image VARCHAR(255),
  price DECIMAL(10,2),
  base_price DECIMAL(10,2),
  final_price DECIMAL(10,2),
  pricing_factors JSON,
  specific_data JSON,
  approval_status ENUM('auto_confirmed','pending_review','price_confirmation','confirmed','cancelled','ready_for_pickup','completed','price_declined','accepted') DEFAULT 'pending_review',
  appointment_date DATETIME,
  payment_status ENUM('pending','partial','paid','refunded') DEFAULT 'pending',
  completed_item_image VARCHAR(255),
  rental_start_date DATE,
  rental_end_date DATE,
  rental_item_id INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  INDEX idx_order_id (order_id),
  INDEX idx_service_type (service_type),
  INDEX idx_approval_status (approval_status),
  INDEX idx_payment_status (payment_status),
  INDEX idx_appointment_date (appointment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 4. CART TABLE
-- ================================================================
CREATE TABLE cart (
  cart_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  service_type ENUM('tailoring', 'dry_cleaning', 'repair', 'rental', 'customization') NOT NULL,
  service_id INT,
  quantity INT DEFAULT 1,
  base_price DECIMAL(10,2),
  final_price DECIMAL(10,2),
  pricing_factors JSON,
  specific_data JSON,
  appointment_date DATETIME,
  rental_start_date DATE,
  rental_end_date DATE,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_service_type (service_type),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 5. ORDER_TRACKING TABLE
-- ================================================================
CREATE TABLE order_tracking (
  tracking_id INT AUTO_INCREMENT PRIMARY KEY,
  order_item_id INT NOT NULL,
  status ENUM('pending','accepted','price_confirmation','in_progress','ready_to_pickup','picked_up','rented','returned','completed','cancelled','price_declined') DEFAULT 'pending',
  notes TEXT,
  updated_by INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (order_item_id) REFERENCES order_items(item_id) ON DELETE CASCADE,
  INDEX idx_order_item_id (order_item_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 6. NOTIFICATIONS TABLE
-- ================================================================
CREATE TABLE notifications (
  notification_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  order_item_id INT,
  type VARCHAR(50) NOT NULL COMMENT 'accepted, status_update, price_confirmation, appointment_reminder',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE,
  FOREIGN KEY (order_item_id) REFERENCES order_items(item_id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_is_read (is_read),
  INDEX idx_created_at (created_at),
  INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 7. ACTION_LOGS TABLE
-- ================================================================
CREATE TABLE action_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  order_item_id INT NULL COMMENT 'NULL for non-order actions like measurements',
  user_id INT NOT NULL,
  action_type VARCHAR(50) NOT NULL COMMENT 'cancel, accept, decline, status_update, price_update, add_measurements, etc.',
  action_by ENUM('user', 'admin') NOT NULL,
  previous_status VARCHAR(50) NULL,
  new_status VARCHAR(50) NULL,
  reason TEXT NULL COMMENT 'Reason for cancellation or other actions',
  notes TEXT NULL COMMENT 'Additional notes or details',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (order_item_id) REFERENCES order_items(item_id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE,
  INDEX idx_order_item_id (order_item_id),
  INDEX idx_user_id (user_id),
  INDEX idx_action_type (action_type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 8. TRANSACTION_LOGS TABLE
-- ================================================================
CREATE TABLE transaction_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  order_item_id INT NOT NULL,
  user_id INT NOT NULL,
  transaction_type VARCHAR(50) NOT NULL COMMENT 'payment, refund, adjustment, etc.',
  amount DECIMAL(10,2) NOT NULL,
  previous_payment_status VARCHAR(50) NULL,
  new_payment_status VARCHAR(50) NOT NULL,
  payment_method VARCHAR(50) NULL COMMENT 'cash, card, online, etc.',
  notes TEXT NULL,
  created_by VARCHAR(50) NOT NULL DEFAULT 'admin' COMMENT 'admin, system, user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (order_item_id) REFERENCES order_items(item_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE,
  INDEX idx_order_item (order_item_id),
  INDEX idx_user (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 9. CUSTOMER_MEASUREMENTS TABLE
-- ================================================================
CREATE TABLE customer_measurements (
  measurement_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  top_measurements JSON,
  bottom_measurements JSON,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 10. GARMENT_TYPES TABLE
-- ================================================================
CREATE TABLE garment_types (
  garment_id INT AUTO_INCREMENT PRIMARY KEY,
  garment_name VARCHAR(100) NOT NULL,
  garment_price DECIMAL(10,2) DEFAULT 0.00,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_garment_name (garment_name),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default garment types
INSERT INTO garment_types (garment_name, garment_price, description, is_active) VALUES
('Barong Tagalog', 2500.00, 'Traditional Filipino formal wear', 1),
('Polo', 800.00, 'Casual polo shirt', 1),
('Dress', 1500.00, 'Ladies formal/casual dress', 1),
('Pants', 1000.00, 'Formal/casual pants', 1),
('Skirt', 800.00, 'Ladies skirt', 1),
('Blazer', 2000.00, 'Formal blazer/coat', 1),
('Gown', 3500.00, 'Formal gown/evening wear', 1);

-- ================================================================
-- 11. FABRIC_TYPES TABLE
-- ================================================================
CREATE TABLE fabric_types (
  fabric_id INT AUTO_INCREMENT PRIMARY KEY,
  fabric_name VARCHAR(100) NOT NULL UNIQUE,
  fabric_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_fabric_name (fabric_name),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default fabric types
INSERT INTO fabric_types (fabric_name, fabric_price, description, is_active) VALUES
('Silk', 500.00, 'Premium silk fabric - smooth and luxurious', 1),
('Linen', 350.00, 'Natural linen fabric - breathable and durable', 1),
('Cotton', 300.00, 'High-quality cotton fabric - comfortable and versatile', 1),
('Wool', 450.00, 'Premium wool fabric - warm and elegant', 1),
('Jusi', 400.00, 'Traditional jusi fabric - smooth and semi-transparent', 1),
('Piña', 600.00, 'Premium piña fabric - very smooth and elegant', 1);

-- ================================================================
-- 12. REPAIR_GARMENT_TYPES TABLE
-- ================================================================
CREATE TABLE repair_garment_types (
  repair_garment_id INT AUTO_INCREMENT PRIMARY KEY,
  garment_name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_garment_name (garment_name),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default repair garment types
INSERT INTO repair_garment_types (garment_name, description, is_active) VALUES
('Pants', 'Pants repair service', 1),
('Shirt', 'Shirt repair service', 1),
('Dress', 'Dress repair service', 1),
('Jacket', 'Jacket repair service', 1),
('Skirt', 'Skirt repair service', 1);

-- ================================================================
-- 13. DRY_CLEANING_SERVICES TABLE
-- ================================================================
CREATE TABLE dry_cleaning_services (
  service_id INT AUTO_INCREMENT PRIMARY KEY,
  service_name VARCHAR(255) NOT NULL,
  description TEXT,
  base_price VARCHAR(20) NOT NULL,
  price_per_item VARCHAR(20) NOT NULL,
  min_items INT DEFAULT 1,
  max_items INT DEFAULT 50,
  estimated_time VARCHAR(100),
  requires_image TINYINT(1) DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_service_name (service_name),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default dry cleaning services
INSERT INTO dry_cleaning_services (service_name, description, base_price, price_per_item, min_items, max_items, estimated_time, requires_image) VALUES
('Basic Dry Cleaning', 'Standard dry cleaning for everyday garments', '200', '150', 1, 50, '2-3 days', 0),
('Premium Dry Cleaning', 'High-quality dry cleaning for delicate fabrics', '350', '250', 1, 30, '3-4 days', 1),
('Delicate Items', 'Specialized care for silk, wool, and other delicate fabrics', '450', '350', 1, 20, '4-5 days', 1),
('Express Service', 'Same-day or next-day dry cleaning service', '500', '400', 1, 10, '1-2 days', 0),
('Wedding Dress Cleaning', 'Professional cleaning and preservation for wedding dresses', '800', '600', 1, 5, '1-2 weeks', 1),
('Suit Cleaning', 'Complete suit cleaning and pressing', '300', '200', 1, 20, '2-3 days', 0),
('Winter Coat Cleaning', 'Heavy coat and jacket cleaning service', '400', '300', 1, 15, '3-4 days', 0),
('Curtain Cleaning', 'Professional curtain and drapery cleaning', '250', '180', 1, 25, '3-5 days', 0);

-- ================================================================
-- 14. RENTAL_INVENTORY TABLE
-- ================================================================
CREATE TABLE rental_inventory (
  item_id INT AUTO_INCREMENT PRIMARY KEY,
  item_name VARCHAR(255) NOT NULL,
  description TEXT,
  brand VARCHAR(100),
  size LONGTEXT,
  color VARCHAR(100),
  category VARCHAR(100),
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  downpayment VARCHAR(50) DEFAULT '0',
  total_available INT DEFAULT 1,
  times_rented INT NOT NULL DEFAULT 0,
  size_rental_counts LONGTEXT,
  image_url VARCHAR(500),
  material VARCHAR(100),
  care_instructions TEXT,
  damage_notes TEXT,
  status ENUM('available', 'rented', 'unavailable', 'maintenance') DEFAULT 'available',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_category (category),
  INDEX idx_status (status),
  INDEX idx_price (price)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 15. TIME_SLOTS TABLE
-- ================================================================
CREATE TABLE time_slots (
  slot_id INT AUTO_INCREMENT PRIMARY KEY,
  time_slot VARCHAR(20) NOT NULL UNIQUE,
  capacity INT DEFAULT 5,
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_time_slot (time_slot),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default time slots
INSERT INTO time_slots (time_slot, capacity, is_active) VALUES
('09:00', 5, 1),
('10:00', 5, 1),
('11:00', 5, 1),
('13:00', 5, 1),
('14:00', 5, 1),
('15:00', 5, 1),
('16:00', 5, 1),
('17:00', 5, 1);

-- ================================================================
-- 16. APPOINTMENT_SLOTS TABLE
-- ================================================================
CREATE TABLE appointment_slots (
  slot_id INT AUTO_INCREMENT PRIMARY KEY,
  service_type ENUM('dry_cleaning', 'repair', 'customization', 'tailoring') NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  user_id INT NOT NULL,
  order_item_id INT NULL COMMENT 'Reference to the order item when order is created',
  cart_item_id INT NULL COMMENT 'Reference to cart item if still in cart',
  status ENUM('booked', 'completed', 'cancelled') DEFAULT 'booked',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE,
  INDEX idx_service_date (service_type, appointment_date),
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_appointment_datetime (appointment_date, appointment_time),
  INDEX idx_service_date_time (service_type, appointment_date, appointment_time, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 17. SHOP_SCHEDULE TABLE
-- ================================================================
CREATE TABLE shop_schedule (
  id INT AUTO_INCREMENT PRIMARY KEY,
  day_of_week TINYINT NOT NULL UNIQUE COMMENT '0=Sunday, 1=Monday, ..., 6=Saturday',
  is_open TINYINT(1) DEFAULT 1,
  open_time TIME DEFAULT '09:00:00',
  close_time TIME DEFAULT '18:00:00',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_day_of_week (day_of_week)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default shop schedule (Sunday=0 is closed, Monday-Saturday open)
INSERT INTO shop_schedule (day_of_week, is_open, open_time, close_time) VALUES
(0, 0, '09:00:00', '17:00:00'),  -- Sunday - CLOSED
(1, 1, '09:00:00', '18:00:00'),  -- Monday
(2, 1, '09:00:00', '18:00:00'),  -- Tuesday
(3, 1, '09:00:00', '18:00:00'),  -- Wednesday
(4, 1, '09:00:00', '18:00:00'),  -- Thursday
(5, 1, '09:00:00', '18:00:00'),  -- Friday
(6, 1, '09:00:00', '17:00:00'); -- Saturday

-- ================================================================
-- 18. CUSTOM_3D_MODELS TABLE
-- ================================================================
CREATE TABLE custom_3d_models (
  model_id INT AUTO_INCREMENT PRIMARY KEY,
  model_name VARCHAR(255) NOT NULL,
  model_type ENUM('garment', 'button', 'accessory') DEFAULT 'garment',
  file_path VARCHAR(500) NOT NULL COMMENT 'Path to GLB file in uploads directory',
  file_url VARCHAR(500) NOT NULL COMMENT 'URL to access the GLB file',
  garment_category VARCHAR(100) COMMENT 'Category like coat-men, barong, suit, pants, etc.',
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_by INT COMMENT 'Admin user_id who uploaded the model',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_model_type (model_type),
  INDEX idx_garment_category (garment_category),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

