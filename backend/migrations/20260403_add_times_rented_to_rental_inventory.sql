-- Add completed-rental usage counter to rental inventory
ALTER TABLE rental_inventory
ADD COLUMN IF NOT EXISTS times_rented INT NOT NULL DEFAULT 0 AFTER total_available;
