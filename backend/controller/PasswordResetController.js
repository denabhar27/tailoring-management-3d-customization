/**
 * Password Reset Controller
 * 
 * Handles forgot password flow including:
 * - Sending security codes via email
 * - Verifying security codes
 * - Resetting passwords
 */

const bcrypt = require('bcryptjs');
const User = require('../model/UserModel');
const emailService = require('../services/emailService');

// Configuration
const RESET_CODE_EXPIRY_MINUTES = 15;
const MAX_RESET_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MINUTES = 60;

/**
 * Generate a 6-character alphanumeric security code
 * @returns {string} Security code
 */
const generateSecurityCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * Check if user has exceeded rate limit
 * @param {number} attempts - Number of attempts
 * @param {Date} lastAttempt - Last attempt timestamp
 * @returns {boolean} True if rate limited
 */
const isRateLimited = (attempts, lastAttempt) => {
  if (!lastAttempt || attempts < MAX_RESET_ATTEMPTS) {
    return false;
  }
  
  const lastAttemptTime = new Date(lastAttempt);
  const now = new Date();
  const timeDiff = (now - lastAttemptTime) / (1000 * 60); // Difference in minutes
  
  return timeDiff < RATE_LIMIT_WINDOW_MINUTES;
};

/**
 * POST /api/forgot-password
 * Send security code to user's email
 */
exports.forgotPassword = async (req, res) => {
  const { usernameOrEmail } = req.body;

  if (!usernameOrEmail) {
    return res.status(400).json({ 
      success: false,
      message: 'Please provide your username or email' 
    });
  }

  try {
    // Find user by username or email
    User.findByUsernameOrEmail(usernameOrEmail, async (err, results) => {
      if (err) {
        console.error('[PASSWORD RESET] Database error:', err);
        return res.status(500).json({ 
          success: false,
          message: 'An error occurred. Please try again later.' 
        });
      }

      // Generic message to prevent user enumeration
      const successMessage = 'If an account exists with this username or email, a security code will be sent.';

      if (results.length === 0) {
        // Don't reveal that user doesn't exist
        console.log('[PASSWORD RESET] User not found:', usernameOrEmail);
        return res.json({ 
          success: true,
          message: successMessage 
        });
      }

      const user = results[0];

      // Check rate limiting
      if (isRateLimited(user.reset_attempts, user.reset_last_attempt)) {
        const retryAfter = RATE_LIMIT_WINDOW_MINUTES - 
          Math.floor((new Date() - new Date(user.reset_last_attempt)) / (1000 * 60));
        
        return res.status(429).json({ 
          success: false,
          message: `Too many attempts. Please try again in ${retryAfter} minutes.` 
        });
      }

      // Check if user has email
      if (!user.email) {
        console.log('[PASSWORD RESET] No email for user:', user.username);
        return res.json({ 
          success: true,
          message: successMessage 
        });
      }

      // Generate security code
      const securityCode = generateSecurityCode();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + RESET_CODE_EXPIRY_MINUTES);

      // Store reset code in database
      User.setResetCode(user.user_id, securityCode, expiresAt, async (err) => {
        if (err) {
          console.error('[PASSWORD RESET] Failed to store reset code:', err);
          return res.status(500).json({ 
            success: false,
            message: 'An error occurred. Please try again later.' 
          });
        }

        // Send email with security code
        const emailSent = await emailService.sendPasswordResetEmail({
          userEmail: user.email,
          userName: user.first_name || user.username,
          securityCode: securityCode,
          expiryMinutes: RESET_CODE_EXPIRY_MINUTES
        });

        if (emailSent) {
          console.log('[PASSWORD RESET] Code sent to:', user.email);
        } else {
          console.warn('[PASSWORD RESET] Email sending failed for:', user.email);
        }

        // Always return success to prevent user enumeration
        res.json({ 
          success: true,
          message: successMessage,
          // Only include email hint in development
          ...(process.env.NODE_ENV === 'development' && {
            debug: {
              emailSent,
              codeSentTo: user.email.replace(/^(.{2}).*(@.*)$/, '$1***$2')
            }
          })
        });
      });
    });
  } catch (error) {
    console.error('[PASSWORD RESET] Unexpected error:', error);
    res.status(500).json({ 
      success: false,
      message: 'An error occurred. Please try again later.' 
    });
  }
};

/**
 * POST /api/verify-reset-code
 * Verify the security code entered by user
 */
exports.verifyResetCode = (req, res) => {
  const { code, usernameOrEmail } = req.body;

  if (!code) {
    return res.status(400).json({ 
      success: false,
      message: 'Please enter the security code' 
    });
  }

  if (!usernameOrEmail) {
    return res.status(400).json({ 
      success: false,
      message: 'Session expired. Please start over.' 
    });
  }

  // Clean up code (remove spaces, convert to uppercase)
  const cleanCode = code.toString().replace(/\s/g, '').toUpperCase();

  if (cleanCode.length !== 6) {
    return res.status(400).json({ 
      success: false,
      message: 'Invalid code format. Please enter the 6-character code.' 
    });
  }

  // Find user first
  User.findByUsernameOrEmail(usernameOrEmail, (err, userResults) => {
    if (err) {
      console.error('[PASSWORD RESET] Database error:', err);
      return res.status(500).json({ 
        success: false,
        message: 'An error occurred. Please try again.' 
      });
    }

    if (userResults.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid request. Please start over.' 
      });
    }

    const user = userResults[0];

    // Find by reset code
    User.findByResetCode(cleanCode, (err, results) => {
      if (err) {
        console.error('[PASSWORD RESET] Database error:', err);
        return res.status(500).json({ 
          success: false,
          message: 'An error occurred. Please try again.' 
        });
      }

      if (results.length === 0) {
        // Increment failed attempts
        User.incrementResetAttempts(user.user_id, () => {});
        
        return res.status(400).json({ 
          success: false,
          message: 'Invalid or expired code. Please try again or request a new code.' 
        });
      }

      const resetUser = results[0];

      // Verify code belongs to correct user
      if (resetUser.user_id !== user.user_id) {
        User.incrementResetAttempts(user.user_id, () => {});
        return res.status(400).json({ 
          success: false,
          message: 'Invalid code. Please try again.' 
        });
      }

      // Check if code is expired
      const now = new Date();
      const expiresAt = new Date(resetUser.reset_code_expires);
      
      if (now > expiresAt) {
        return res.status(400).json({ 
          success: false,
          message: 'Code has expired. Please request a new code.' 
        });
      }

      // Code is valid - generate a reset token for the next step
      const resetToken = Buffer.from(`${resetUser.user_id}:${cleanCode}:${Date.now()}`).toString('base64');

      console.log('[PASSWORD RESET] Code verified for user:', resetUser.username);

      res.json({ 
        success: true,
        message: 'Code verified successfully',
        resetToken: resetToken
      });
    });
  });
};

/**
 * POST /api/reset-password
 * Reset password with verified security code
 */
exports.resetPassword = (req, res) => {
  const { resetToken, newPassword, confirmPassword } = req.body;

  // Validate inputs
  if (!resetToken) {
    return res.status(400).json({ 
      success: false,
      message: 'Invalid request. Please start over.' 
    });
  }

  if (!newPassword || !confirmPassword) {
    return res.status(400).json({ 
      success: false,
      message: 'Please enter and confirm your new password' 
    });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ 
      success: false,
      message: 'Passwords do not match' 
    });
  }

  // Password validation
  if (newPassword.length < 8) {
    return res.status(400).json({ 
      success: false,
      message: 'Password must be at least 8 characters long' 
    });
  }

  const specialCharRegex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/;
  if (!specialCharRegex.test(newPassword)) {
    return res.status(400).json({ 
      success: false,
      message: 'Password must contain at least one special character' 
    });
  }

  // Decode and validate reset token
  let tokenData;
  try {
    const decoded = Buffer.from(resetToken, 'base64').toString('utf8');
    const parts = decoded.split(':');
    tokenData = {
      userId: parseInt(parts[0]),
      code: parts[1],
      timestamp: parseInt(parts[2])
    };
  } catch (error) {
    return res.status(400).json({ 
      success: false,
      message: 'Invalid reset token. Please start over.' 
    });
  }

  // Check token age (5 minutes max for password entry)
  const tokenAge = (Date.now() - tokenData.timestamp) / (1000 * 60);
  if (tokenAge > 5) {
    return res.status(400).json({ 
      success: false,
      message: 'Session expired. Please verify your code again.' 
    });
  }

  // Verify code is still valid in database
  User.findByResetCode(tokenData.code, (err, results) => {
    if (err) {
      console.error('[PASSWORD RESET] Database error:', err);
      return res.status(500).json({ 
        success: false,
        message: 'An error occurred. Please try again.' 
      });
    }

    if (results.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Reset session expired. Please start over.' 
      });
    }

    const user = results[0];

    // Verify user ID matches
    if (user.user_id !== tokenData.userId) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid request. Please start over.' 
      });
    }

    // Hash new password
    const hashedPassword = bcrypt.hashSync(newPassword, 10);

    // Update password
    User.updatePassword(user.user_id, hashedPassword, (err) => {
      if (err) {
        console.error('[PASSWORD RESET] Failed to update password:', err);
        return res.status(500).json({ 
          success: false,
          message: 'Failed to update password. Please try again.' 
        });
      }

      // Clear reset code
      User.clearResetCode(user.user_id, (err) => {
        if (err) {
          console.warn('[PASSWORD RESET] Failed to clear reset code:', err);
        }
      });

      console.log('[PASSWORD RESET] Password updated for user:', user.username);

      res.json({ 
        success: true,
        message: 'Password reset successful! You can now login with your new password.' 
      });
    });
  });
};

/**
 * POST /api/resend-reset-code
 * Resend security code to user's email
 */
exports.resendResetCode = async (req, res) => {
  const { usernameOrEmail } = req.body;

  if (!usernameOrEmail) {
    return res.status(400).json({ 
      success: false,
      message: 'Session expired. Please start over.' 
    });
  }

  // Use the same logic as forgotPassword
  return exports.forgotPassword(req, res);
};
