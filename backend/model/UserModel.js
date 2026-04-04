const db = require('../config/db');

const User = {
  create: (first_name, middle_name, last_name, username, email, password, phone_number, role = 'user', callback) => {
    const sql = "INSERT INTO user (first_name, middle_name, last_name, username, email, password, phone_number, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
    db.query(sql, [first_name, middle_name, last_name, username, email, password, phone_number, role], callback);
  },
  
  findByUsername: (username, callback) =>{
  const sql = "SELECT * FROM user WHERE username = ?";
  db.query(sql, [username], callback);
},
  
  findByEmail: (email, callback) => {
    const sql = "SELECT * FROM user WHERE email = ?";
    db.query(sql, [email], callback);
  },

  findById: (user_id, callback) => {
    const sql = "SELECT user_id, first_name, middle_name, last_name, username, email, phone_number, profile_picture, role, status, created_at, updated_at FROM user WHERE user_id = ?";
    db.query(sql, [user_id], callback);
  },
  
  createGoogleUser: (first_name, last_name, email, google_id, callback) => {
    
    const username = email.split('@')[0] + '_' + Date.now().toString().slice(-6);
   
    const sql = "INSERT INTO user (first_name, middle_name, last_name, username, email, password, phone_number, google_id, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
    db.query(sql, [first_name, null, last_name, username, email, null, null, google_id, 'user'], callback);
  },

  updateProfilePicture: (user_id, profile_picture_path, callback) => {
    const sql = "UPDATE user SET profile_picture = ? WHERE user_id = ?";
    db.query(sql, [profile_picture_path, user_id], callback);
  },

  update: (user_id, first_name, middle_name, last_name, email, phone_number, profile_picture, callback) => {
    if (profile_picture) {
      const sql = "UPDATE user SET first_name = ?, middle_name = ?, last_name = ?, email = ?, phone_number = ?, profile_picture = ? WHERE user_id = ?";
      db.query(sql, [first_name, middle_name, last_name, email, phone_number, profile_picture, user_id], callback);
    } else {
      const sql = "UPDATE user SET first_name = ?, middle_name = ?, last_name = ?, email = ?, phone_number = ? WHERE user_id = ?";
      db.query(sql, [first_name, middle_name, last_name, email, phone_number, user_id], callback);
    }
  },

  getAllCustomers: (callback) => {
    const sql = `
      SELECT 
        u.user_id as customer_id,
        u.first_name,
        u.middle_name,
        u.last_name,
        TRIM(CONCAT(u.first_name, ' ', COALESCE(u.middle_name, ''), ' ', u.last_name)) as full_name,
        u.email,
        u.phone_number,
        COALESCE(u.status, 'active') as status,
        COALESCE(u.created_at, NOW()) as created_at,
        COUNT(DISTINCT o.order_id) as total_orders,
        'online' as customer_type
      FROM user u
      LEFT JOIN orders o ON u.user_id = o.user_id
      WHERE u.role = 'user'
      GROUP BY u.user_id, u.first_name, u.middle_name, u.last_name, u.email, u.phone_number, u.status, u.created_at
      
      UNION ALL
      
      SELECT 
        wc.id as customer_id,
        SUBSTRING_INDEX(wc.name, ' ', 1) as first_name,
        NULL as middle_name,
        IF(LOCATE(' ', wc.name) > 0, SUBSTRING(wc.name, LOCATE(' ', wc.name) + 1), '') as last_name,
        wc.name as full_name,
        wc.email,
        wc.phone as phone_number,
        'active' as status,
        COALESCE(wc.created_at, NOW()) as created_at,
        COUNT(DISTINCT o.order_id) as total_orders,
        'walk_in' as customer_type
      FROM walk_in_customers wc
      LEFT JOIN orders o ON wc.id = o.walk_in_customer_id
      GROUP BY wc.id, wc.name, wc.email, wc.phone, wc.created_at
      
      ORDER BY created_at DESC
    `;
    db.query(sql, callback);
  },

  getCustomerById: (userId, callback) => {
    const sql = `
      SELECT 
        u.*,
        COUNT(DISTINCT o.order_id) as total_orders
      FROM user u
      LEFT JOIN orders o ON u.user_id = o.user_id
      WHERE u.user_id = ?
      GROUP BY u.user_id
    `;
    db.query(sql, [userId], callback);
  },

  updateStatus: (userId, status, callback) => {
    const sql = "UPDATE user SET status = ? WHERE user_id = ?";
    db.query(sql, [status, userId], callback);
  },

  updateCustomer: (userId, first_name, middle_name, last_name, email, phone_number, status, callback) => {
    const sql = `
      UPDATE user 
      SET first_name = ?, middle_name = ?, last_name = ?, email = ?, phone_number = ?, status = ?
      WHERE user_id = ?
    `;
    db.query(sql, [first_name, middle_name, last_name, email, phone_number, status, userId], callback);
  },

  // Password Reset Methods
  
  /**
   * Store reset code for a user
   * @param {number} userId - User ID
   * @param {string} resetCode - 6-character security code
   * @param {number} expiryMinutes - Minutes until code expires
   * @param {function} callback - Callback function
   */
  setResetCode: (userId, resetCode, expiryMinutes, callback) => {
    const sql = `
      UPDATE user 
      SET reset_code = ?, 
          reset_code_expires = DATE_ADD(NOW(), INTERVAL ? MINUTE), 
          reset_attempts = 0,
          reset_last_attempt = NOW()
      WHERE user_id = ?
    `;
    db.query(sql, [resetCode, expiryMinutes, userId], callback);
  },

  /**
   * Find user by reset code
   * @param {string} resetCode - Security code
   * @param {function} callback - Callback function
   */
  findByResetCode: (resetCode, callback) => {
    const sql = `
      SELECT user_id, username, email, first_name, last_name, 
             reset_code, reset_code_expires, reset_attempts 
      FROM user 
      WHERE reset_code = ? AND reset_code_expires > NOW()
    `;
    db.query(sql, [resetCode], callback);
  },

  /**
   * Increment reset attempts counter
   * @param {number} userId - User ID
   * @param {function} callback - Callback function
   */
  incrementResetAttempts: (userId, callback) => {
    const sql = `
      UPDATE user 
      SET reset_attempts = reset_attempts + 1,
          reset_last_attempt = NOW()
      WHERE user_id = ?
    `;
    db.query(sql, [userId], callback);
  },

  /**
   * Clear reset code after successful password reset
   * @param {number} userId - User ID
   * @param {function} callback - Callback function
   */
  clearResetCode: (userId, callback) => {
    const sql = `
      UPDATE user 
      SET reset_code = NULL, 
          reset_code_expires = NULL, 
          reset_attempts = 0,
          reset_last_attempt = NULL
      WHERE user_id = ?
    `;
    db.query(sql, [userId], callback);
  },

  /**
   * Update user password
   * @param {number} userId - User ID
   * @param {string} hashedPassword - Bcrypt hashed password
   * @param {function} callback - Callback function
   */
  updatePassword: (userId, hashedPassword, callback) => {
    const sql = `UPDATE user SET password = ? WHERE user_id = ?`;
    db.query(sql, [hashedPassword, userId], callback);
  },

  /**
   * Check if user has exceeded rate limit for password resets
   * @param {number} userId - User ID
   * @param {function} callback - Callback function
   */
  checkResetRateLimit: (userId, callback) => {
    const sql = `
      SELECT reset_attempts, reset_last_attempt 
      FROM user 
      WHERE user_id = ?
    `;
    db.query(sql, [userId], callback);
  },

  /**
   * Find user by username or email for password reset
   * @param {string} usernameOrEmail - Username or email
   * @param {function} callback - Callback function
   */
  findByUsernameOrEmail: (usernameOrEmail, callback) => {
    const sql = `
      SELECT user_id, username, email, first_name, last_name, 
             reset_attempts, reset_last_attempt
      FROM user 
      WHERE username = ? OR email = ?
    `;
    db.query(sql, [usernameOrEmail, usernameOrEmail], callback);
  },

  // Clerk role helpers
  createClerk: (data, callback) => {
    const {
      first_name,
      middle_name = null,
      last_name,
      username,
      email,
      password,
      phone_number
    } = data;

    const sql = `
      INSERT INTO user (first_name, middle_name, last_name, username, email, password, phone_number, role, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'clerk', 'active')
    `;
    db.query(sql, [first_name, middle_name, last_name, username, email, password, phone_number], callback);
  },

  listClerks: (callback) => {
    const sql = `
      SELECT user_id, first_name, middle_name, last_name, email, phone_number, status, created_at, updated_at
      FROM user
      WHERE role = 'clerk'
      ORDER BY created_at DESC
    `;
    db.query(sql, callback);
  },

  updateClerk: (userId, data, callback) => {
    const { first_name, middle_name = null, last_name, email, phone_number, status = 'active', username, passwordHash } = data;

    const fields = [first_name, middle_name, last_name, email, phone_number, status];
    let sql = `
      UPDATE user
      SET first_name = ?, middle_name = ?, last_name = ?, email = ?, phone_number = ?, status = ?
    `;

    if (username) {
      sql += ', username = ?';
      fields.push(username);
    }

    if (passwordHash) {
      sql += ', password = ?';
      fields.push(passwordHash);
    }

    sql += ' WHERE user_id = ? AND role = "clerk"';
    fields.push(userId);

    db.query(sql, fields, callback);
  },

  deactivateClerk: (userId, callback) => {
    const sql = `UPDATE user SET status = 'inactive' WHERE user_id = ? AND role = 'clerk'`;
    db.query(sql, [userId], callback);
  },

  activateClerk: (userId, callback) => {
    const sql = `UPDATE user SET status = 'active' WHERE user_id = ? AND role = 'clerk'`;
    db.query(sql, [userId], callback);
  }

};
module.exports = User;