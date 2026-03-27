const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tailoring_db',
  multipleStatements: true
});

connection.connect((err) => {
  if (err) {
    console.error('❌ Error connecting to database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to database');

  const migrationFile = path.join(__dirname, 'migrations', 'create_damage_logs_table.sql');
  const sql = fs.readFileSync(migrationFile, 'utf8');

  console.log('📝 Running damage_logs table migration...');

  connection.query(sql, (error, results) => {
    if (error) {
      console.error('❌ Migration failed:', error.message);
      connection.end();
      process.exit(1);
    }

    console.log('✅ Migration completed successfully!');
    console.log('📊 damage_logs table created');
    
    connection.end();
    process.exit(0);
  });
});
