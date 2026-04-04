-- Add per-size historical rental count tracker
ALTER TABLE rental_inventory
ADD COLUMN IF NOT EXISTS size_rental_counts LONGTEXT NULL AFTER times_rented;
