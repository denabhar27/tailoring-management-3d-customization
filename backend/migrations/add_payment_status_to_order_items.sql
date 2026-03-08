-- Add payment_status column to order_items table
-- With all possible status values for different service types
ALTER TABLE order_items 
ADD COLUMN payment_status ENUM('unpaid', 'paid', 'cancelled', 'fully_paid', 'down-payment', 'partial_payment') DEFAULT 'unpaid' AFTER approval_status;

-- Update existing records based on current status
-- Mark completed orders as paid
UPDATE order_items 
SET payment_status = 'paid' 
WHERE approval_status = 'completed' OR order_id IN (
    SELECT order_id FROM orders WHERE status = 'completed'
);

-- Mark cancelled orders as cancelled
UPDATE order_items 
SET payment_status = 'cancelled' 
WHERE approval_status = 'cancelled' OR order_id IN (
    SELECT order_id FROM orders WHERE status = 'cancelled'
);