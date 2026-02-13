/**
 * Migration Runner: Add Password Reset Columns
 * 
 * Adds reset_code, reset_code_expires, reset_attempts, and reset_last_attempt
 * columns to the user table for forgot password functionality.
 * 
 * Usage: node run-password-reset-migration.js
 */

const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

const config = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'pet_management',
  multipleStatements: true
};

console.log('Connecting to database:', config.database);
const connection = mysql.createConnection(config);

// SQL statements to add password reset columns
const migrationSQL = `
-- Add reset_code column to store the 6-digit security code
ALTER TABLE user ADD COLUMN reset_code VARCHAR(10) NULL;

-- Add reset_code_expires column to store expiration timestamp
ALTER TABLE user ADD COLUMN reset_code_expires TIMESTAMP NULL;

-- Add reset_attempts column to track failed attempts for rate limiting
ALTER TABLE user ADD COLUMN reset_attempts INT DEFAULT 0;

-- Add reset_last_attempt column to track when last reset was attempted
ALTER TABLE user ADD COLUMN reset_last_attempt TIMESTAMP NULL;
`;

console.log('\n========================================');
console.log('Starting Password Reset Migration');
console.log('========================================\n');

// First, check which columns already exist
const checkColumnsSQL = `
  SELECT COLUMN_NAME 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = ? 
  AND TABLE_NAME = 'user' 
  AND COLUMN_NAME IN ('reset_code', 'reset_code_expires', 'reset_attempts', 'reset_last_attempt')
`;

connection.query(checkColumnsSQL, [config.database], (err, existingColumns) => {
  if (err) {
    console.error('❌ Failed to check existing columns!');
    console.error('Error:', err.message);
    connection.end();
    process.exit(1);
  }

  const existingColumnNames = existingColumns.map(col => col.COLUMN_NAME);
  console.log('Existing columns:', existingColumnNames.length > 0 ? existingColumnNames.join(', ') : 'None');

  const columnsToAdd = [];
  
  if (!existingColumnNames.includes('reset_code')) {
    columnsToAdd.push('ALTER TABLE user ADD COLUMN reset_code VARCHAR(10) NULL');
  }
  if (!existingColumnNames.includes('reset_code_expires')) {
    columnsToAdd.push('ALTER TABLE user ADD COLUMN reset_code_expires TIMESTAMP NULL');
  }
  if (!existingColumnNames.includes('reset_attempts')) {
    columnsToAdd.push('ALTER TABLE user ADD COLUMN reset_attempts INT DEFAULT 0');
  }
  if (!existingColumnNames.includes('reset_last_attempt')) {
    columnsToAdd.push('ALTER TABLE user ADD COLUMN reset_last_attempt TIMESTAMP NULL');
  }

  if (columnsToAdd.length === 0) {
    console.log('\n✅ All password reset columns already exist!');
    console.log('No migration needed.');
    connection.end();
    process.exit(0);
  }

  console.log(`\nAdding ${columnsToAdd.length} column(s)...`);

  // Execute each ALTER statement
  let completedCount = 0;
  let errorOccurred = false;

  columnsToAdd.forEach((sql, index) => {
    connection.query(sql, (err) => {
      completedCount++;
      
      if (err) {
        console.error(`❌ Failed: ${sql}`);
        console.error('   Error:', err.message);
        errorOccurred = true;
      } else {
        console.log(`✅ Success: ${sql.replace('ALTER TABLE user ADD COLUMN ', 'Added ')}`);
      }

      if (completedCount === columnsToAdd.length) {
        console.log('\n========================================');
        if (errorOccurred) {
          console.log('Migration completed with some errors');
        } else {
          console.log('Migration completed successfully!');
          console.log('========================================');
          console.log('\nPassword reset columns added:');
          console.log('  - reset_code: Stores 6-digit security code');
          console.log('  - reset_code_expires: Expiration timestamp');
          console.log('  - reset_attempts: Failed attempt counter');
          console.log('  - reset_last_attempt: Last attempt timestamp');
        }
        console.log('========================================\n');
        connection.end();
        process.exit(errorOccurred ? 1 : 0);
      }
    });
  });
});
