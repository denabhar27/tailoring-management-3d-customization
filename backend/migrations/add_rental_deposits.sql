-- Add deposit column to rental_inventory table
ALTER TABLE rental_inventory 
ADD COLUMN IF NOT EXISTS deposit DECIMAL(10,2) DEFAULT 0.00 AFTER price,
ADD COLUMN IF NOT EXISTS front_image VARCHAR(500) AFTER image_url,
ADD COLUMN IF NOT EXISTS back_image VARCHAR(500) AFTER front_image,
ADD COLUMN IF NOT EXISTS side_image VARCHAR(500) AFTER back_image,
ADD COLUMN IF NOT EXISTS damaged_by VARCHAR(255) AFTER damage_notes;

-- Add deposit tracking columns to order_items table
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS rental_deposit DECIMAL(10,2) DEFAULT 0.00 AFTER rental_end_date,
ADD COLUMN IF NOT EXISTS deposit_refunded DECIMAL(10,2) DEFAULT 0.00 AFTER rental_deposit,
ADD COLUMN IF NOT EXISTS deposit_refund_date DATETIME NULL AFTER deposit_refunded;

-- Create index for better performance on deposit queries
CREATE INDEX IF NOT EXISTS idx_rental_deposit ON order_items(rental_deposit);
CREATE INDEX IF NOT EXISTS idx_deposit_refund_date ON order_items(deposit_refund_date);
