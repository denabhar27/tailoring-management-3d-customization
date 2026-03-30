-- Add price change tracking columns to order_items table
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS last_price_change TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS price_change_count INT DEFAULT 0;

-- Add index for better performance on price change queries
CREATE INDEX IF NOT EXISTS idx_last_price_change ON order_items(last_price_change);
