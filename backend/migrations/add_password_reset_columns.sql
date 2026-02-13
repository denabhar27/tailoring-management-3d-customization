-- Migration: Add password reset columns to user table
-- Created: 2026-02-11
-- Purpose: Support forgot password functionality with security codes

-- Add reset_code column to store the 6-digit security code
ALTER TABLE user ADD COLUMN IF NOT EXISTS reset_code VARCHAR(10) NULL;

-- Add reset_code_expires column to store expiration timestamp
ALTER TABLE user ADD COLUMN IF NOT EXISTS reset_code_expires TIMESTAMP NULL;

-- Add reset_attempts column to track failed attempts for rate limiting
ALTER TABLE user ADD COLUMN IF NOT EXISTS reset_attempts INT DEFAULT 0;

-- Add reset_last_attempt column to track when last reset was attempted (for rate limiting)
ALTER TABLE user ADD COLUMN IF NOT EXISTS reset_last_attempt TIMESTAMP NULL;

-- Create index for faster lookup by reset_code
CREATE INDEX IF NOT EXISTS idx_user_reset_code ON user(reset_code);

-- Success message
SELECT 'Password reset columns added successfully!' AS migration_result;
