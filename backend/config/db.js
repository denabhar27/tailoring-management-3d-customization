const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',  
  port: process.env.DB_PORT || 3306,         
  user: process.env.DB_USER || 'root',    
  password: process.env.DB_PASSWORD || '',            
  database: process.env.DB_NAME || 'pet_management',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0
});

pool.getConnection((err, connection) => {
  if (err) {
    console.error("Database connection failed:", err);
  } else {
    console.log("Connected to MySQL database:", process.env.DB_HOST || 'localhost');
    connection.release();
  }
});

module.exports = pool;