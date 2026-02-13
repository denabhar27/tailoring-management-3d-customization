/**
 * Password Reset Routes
 * 
 * Handles forgot password, code verification, and password reset endpoints.
 */

const express = require('express');
const router = express.Router();
const passwordResetController = require('../controller/PasswordResetController');

/**
 * POST /api/forgot-password
 * Request a password reset code
 * Body: { usernameOrEmail: string }
 */
router.post('/forgot-password', passwordResetController.forgotPassword);

/**
 * POST /api/verify-reset-code
 * Verify the security code
 * Body: { code: string, usernameOrEmail: string }
 */
router.post('/verify-reset-code', passwordResetController.verifyResetCode);

/**
 * POST /api/reset-password
 * Reset password with verified token
 * Body: { resetToken: string, newPassword: string, confirmPassword: string }
 */
router.post('/reset-password', passwordResetController.resetPassword);

/**
 * POST /api/resend-reset-code
 * Resend security code
 * Body: { usernameOrEmail: string }
 */
router.post('/resend-reset-code', passwordResetController.resendResetCode);

module.exports = router;
