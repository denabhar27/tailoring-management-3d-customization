const fs = require('fs');
const path = require('path');
const db = require('../config/db');

const runDepositMigration = () => {
  return new Promise((resolve, reject) => {
    const migrationPath = path.join(__dirname, 'add_rental_deposits.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.log('Migration file not found, skipping deposit migration');
      return resolve();
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by semicolon and filter empty statements
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    
    let completed = 0;
    let hasError = false;

    const executeNext = () => {
      if (completed >= statements.length) {
        if (!hasError) {
          console.log('✓ Rental deposit migration completed successfully');
        }
        return resolve();
      }

      const statement = statements[completed];
      completed++;

      db.query(statement, (err) => {
        if (err) {
          // Ignore "column already exists" errors - migration is idempotent
          if (err.message && err.message.includes('Duplicate column name')) {
            console.log(`  - Column already exists (skipped)`);
            return executeNext();
          }
          if (err.message && err.message.includes('already exists')) {
            console.log(`  - Index already exists (skipped)`);
            return executeNext();
          }
          console.error('Migration error:', err.message);
          hasError = true;
          return reject(err);
        }
        executeNext();
      });
    };

    executeNext();
  });
};

module.exports = { runDepositMigration };
