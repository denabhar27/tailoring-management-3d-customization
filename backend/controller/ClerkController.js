const bcrypt = require('bcryptjs');
const User = require('../model/UserModel');

const generateTempPassword = (length = 10) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789@$!%*?&';
  let pwd = '';
  for (let i = 0; i < length; i += 1) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
};

const buildUsernameFromEmail = (email) => {
  const base = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') || 'clerk';
  return `${base}_${Date.now().toString().slice(-5)}`;
};

exports.listClerks = (req, res) => {
  User.listClerks((err, results) => {
    if (err) {
      console.error('[CLERK] list error:', err);
      return res.status(500).json({ success: false, message: 'Failed to load clerks' });
    }
    return res.json({ success: true, clerks: results });
  });
};

exports.createClerk = (req, res) => {
  const { first_name, middle_name = null, last_name, email, phone_number, username, password } = req.body;

  if (!first_name || !last_name || !email || !phone_number || !username || !password) {
    return res.status(400).json({ success: false, message: 'First name, last name, email, phone number, username, and password are required' });
  }

  User.findByEmail(email, (err, existingEmail) => {
    if (err) {
      console.error('[CLERK] email check error:', err);
      return res.status(500).json({ success: false, message: 'Database error while checking email' });
    }

    if (existingEmail.length > 0) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }

    User.findByUsername(username, (usernameErr, existingUser) => {
      if (usernameErr) {
        console.error('[CLERK] username check error:', usernameErr);
        return res.status(500).json({ success: false, message: 'Database error while checking username' });
      }

      if (existingUser.length > 0) {
        return res.status(400).json({ success: false, message: 'Username already in use' });
      }

      const hashedPassword = bcrypt.hashSync(password, 10);

      User.createClerk({
        first_name,
        middle_name,
        last_name,
        username,
        email,
        password: hashedPassword,
        phone_number
      }, (createErr, result) => {
        if (createErr) {
          console.error('[CLERK] create error:', createErr);
          return res.status(500).json({ success: false, message: 'Failed to create clerk' });
        }

        return res.status(201).json({
          success: true,
          message: 'Clerk created successfully',
          clerk: {
            id: result.insertId,
            user_id: result.insertId,
            first_name,
            middle_name,
            last_name,
            email,
            phone_number,
            username,
            status: 'active',
            created_at: new Date().toISOString()
          }
        });
      });
    });
  });
};

exports.updateClerk = (req, res) => {
  const { id } = req.params;
  const { first_name, middle_name = null, last_name, email, phone_number, status = 'active', username, password } = req.body;

  if (!first_name || !last_name || !email || !phone_number || !username) {
    return res.status(400).json({ success: false, message: 'First name, last name, email, phone number, and username are required' });
  }

  const userId = parseInt(id, 10);

  User.findByEmail(email, (err, existing) => {
    if (err) {
      console.error('[CLERK] email check error:', err);
      return res.status(500).json({ success: false, message: 'Database error while checking email' });
    }

    const emailTaken = existing.length > 0 && existing[0].user_id !== userId;
    if (emailTaken) {
      return res.status(400).json({ success: false, message: 'Email already in use by another user' });
    }

    User.findByUsername(username, (userErr, usernameRows) => {
      if (userErr) {
        console.error('[CLERK] username check error:', userErr);
        return res.status(500).json({ success: false, message: 'Database error while checking username' });
      }

      const usernameTaken = usernameRows.length > 0 && usernameRows[0].user_id !== userId;
      if (usernameTaken) {
        return res.status(400).json({ success: false, message: 'Username already in use by another user' });
      }

      const passwordHash = password ? bcrypt.hashSync(password, 10) : null;

      User.updateClerk(userId, { first_name, middle_name, last_name, email, phone_number, status, username, passwordHash }, (updateErr) => {
        if (updateErr) {
          console.error('[CLERK] update error:', updateErr);
          return res.status(500).json({ success: false, message: 'Failed to update clerk' });
        }

        return res.json({ success: true, message: 'Clerk updated successfully' });
      });
    });
  });
};

exports.deactivateClerk = (req, res) => {
  const { id } = req.params;

  User.deactivateClerk(id, (err, result) => {
    if (err) {
      console.error('[CLERK] deactivate error:', err);
      return res.status(500).json({ success: false, message: 'Failed to deactivate clerk' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Clerk not found' });
    }
    return res.json({ success: true, message: 'Clerk deactivated successfully' });
  });
};

exports.activateClerk = (req, res) => {
  const { id } = req.params;

  User.activateClerk(id, (err, result) => {
    if (err) {
      console.error('[CLERK] activate error:', err);
      return res.status(500).json({ success: false, message: 'Failed to activate clerk' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Clerk not found' });
    }
    return res.json({ success: true, message: 'Clerk activated successfully' });
  });
};

exports.resetClerkPassword = (req, res) => {
  const { id } = req.params;
  const newPassword = generateTempPassword();
  const hashedPassword = bcrypt.hashSync(newPassword, 10);

  User.updatePassword(id, hashedPassword, (err, result) => {
    if (err) {
      console.error('[CLERK] reset password error:', err);
      return res.status(500).json({ success: false, message: 'Failed to reset password' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Clerk not found' });
    }

    return res.json({
      success: true,
      message: 'Password reset successfully',
      // TODO: send via email; for now return for admin to share
      tempPassword: newPassword
    });
  });
};
