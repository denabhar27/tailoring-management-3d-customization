-- Ensure rental size payload can store full v2 measurements JSON
-- Previous VARCHAR(255) truncates size_entries and measurements.
ALTER TABLE rental_inventory
  MODIFY COLUMN size LONGTEXT NULL;
