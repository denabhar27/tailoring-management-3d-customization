ALTER TABLE damage_logs
ADD COLUMN IF NOT EXISTS damaged_customer_name VARCHAR(255) NULL AFTER damage_note;
