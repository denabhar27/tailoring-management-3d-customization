-- Add clerk role and middle_name to user table
ALTER TABLE user
  ADD COLUMN middle_name VARCHAR(100) NULL AFTER first_name,
  MODIFY role ENUM('user','admin','clerk') DEFAULT 'user';
