-- Add dynamic rental configuration columns to order_items.
-- The rental inventory size profile already stores size entries in JSON;
-- this migration adds order-level snapshots for duration/rate and due date tracking.

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS rental_duration INT DEFAULT 3 AFTER rental_end_date,
ADD COLUMN IF NOT EXISTS overdue_rate DECIMAL(10,2) DEFAULT 50.00 AFTER rental_duration,
ADD COLUMN IF NOT EXISTS due_date DATE NULL AFTER overdue_rate;

UPDATE order_items
SET rental_duration = 3
WHERE rental_duration IS NULL OR rental_duration <= 0;

UPDATE order_items
SET overdue_rate = 50.00
WHERE overdue_rate IS NULL OR overdue_rate < 0;

UPDATE order_items
SET due_date = COALESCE(due_date, rental_end_date)
WHERE service_type = 'rental';
