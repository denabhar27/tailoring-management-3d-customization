import React, { useState } from 'react';
import { forgotPassword, verifyResetCode, resetPassword, resendResetCode } from '../../api/AuthApi';
import './ForgotPassword.css';

const ForgotPassword = ({ onClose, onSuccess }) => {

  const [step, setStep] = useState('forgot');

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const validatePassword = (password) => {
    if (!password) {
      return { isValid: false, message: 'Password is required' };
    }
    if (password.length < 8) {
      return { isValid: false, message: `Password must be at least 8 characters long. You have ${password.length} character(s).` };
    }
    const specialCharRegex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/;
    if (!specialCharRegex.test(password)) {
      return { isValid: false, message: 'Password must contain at least one special character (!@#$%^&* etc.)' };
    }
    return { isValid: true };
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!usernameOrEmail.trim()) {
      setError('Please enter your username or email');
      return;
    }

    setIsLoading(true);
    try {
      const result = await forgotPassword(usernameOrEmail.trim());

      if (result.success) {
        setSuccessMessage('Security code sent! Check your email.');
        setStep('verify');

        startResendCooldown();
      } else {
        setError(result.message || 'Failed to send security code');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!code.trim()) {
      setError('Please enter the security code');
      return;
    }

    if (code.trim().length !== 6) {
      setError('Please enter the complete 6-character code');
      return;
    }

    setIsLoading(true);
    try {
      const result = await verifyResetCode(code.trim(), usernameOrEmail);

      if (result.success && result.resetToken) {
        setResetToken(result.resetToken);
        setSuccessMessage('Code verified! Enter your new password.');
        setStep('reset');
      } else {
        setError(result.message || 'Invalid code. Please try again.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!newPassword || !confirmPassword) {
      setError('Please enter and confirm your new password');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.message);
      return;
    }

    setIsLoading(true);
    try {
      const result = await resetPassword(resetToken, newPassword, confirmPassword);

      if (result.success) {
        setStep('success');
        setSuccessMessage(result.message || 'Password reset successful!');
      } else {
        setError(result.message || 'Failed to reset password');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const startResendCooldown = () => {
    setResendCooldown(60);
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;

    setError('');
    setIsLoading(true);
    try {
      const result = await resendResetCode(usernameOrEmail);

      if (result.success) {
        setSuccessMessage('New security code sent!');
        startResendCooldown();
      } else {
        setError(result.message || 'Failed to resend code');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setError('');
    setSuccessMessage('');
    if (step === 'verify') {
      setStep('forgot');
      setCode('');
    } else if (step === 'reset') {
      setStep('verify');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleCodeChange = (e) => {
    const value = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (value.length <= 6) {
      setCode(value);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 'forgot':
        return (
          <form onSubmit={handleForgotPassword} className="forgot-password-form">
            <div className="step-indicator">
              <div className="step active">1</div>
              <div className="step-line"></div>
              <div className="step">2</div>
              <div className="step-line"></div>
              <div className="step">3</div>
            </div>

            <h3>Forgot Password</h3>
            <p className="subtitle">Enter your username or email to receive a security code.</p>

            <div className="form-group">
              <label htmlFor="usernameOrEmail">Username or Email</label>
              <input
                type="text"
                id="usernameOrEmail"
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                placeholder="Enter your username or email"
                disabled={isLoading}
                autoFocus
              />
            </div>

            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send Security Code'}
            </button>
          </form>
        );

      case 'verify':
        return (
          <form onSubmit={handleVerifyCode} className="forgot-password-form">
            <div className="step-indicator">
              <div className="step completed">✓</div>
              <div className="step-line completed"></div>
              <div className="step active">2</div>
              <div className="step-line"></div>
              <div className="step">3</div>
            </div>

            <h3>Enter Security Code</h3>
            <p className="subtitle">
              We sent a 6-character code to your email. Enter it below to continue.
            </p>

            <div className="form-group">
              <label htmlFor="code">Security Code</label>
              <input
                type="text"
                id="code"
                value={code}
                onChange={handleCodeChange}
                placeholder="ENTER 6-CHARACTERS"
                className="code-input"
                maxLength={6}
                disabled={isLoading}
                autoFocus
              />
            </div>

            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? 'Verifying...' : 'Verify Code'}
            </button>

            <div className="resend-section">
              <p>Didn't receive the code?</p>
              <button
                type="button"
                className="btn-link"
                onClick={handleResendCode}
                disabled={resendCooldown > 0 || isLoading}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
              </button>
            </div>

            <button type="button" className="btn-back" onClick={handleBack}>
              ← Back
            </button>
          </form>
        );

      case 'reset':
        return (
          <form onSubmit={handleResetPassword} className="forgot-password-form">
            <div className="step-indicator">
              <div className="step completed">✓</div>
              <div className="step-line completed"></div>
              <div className="step completed">✓</div>
              <div className="step-line completed"></div>
              <div className="step active">3</div>
            </div>

            <h3>Reset Password</h3>
            <p className="subtitle">Create a new password for your account.</p>

            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  disabled={isLoading}
                  autoFocus
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              <small className="password-hint">
                Must be 8+ characters with at least one special character
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                disabled={isLoading}
              />
            </div>

            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? 'Resetting...' : 'Reset Password'}
            </button>

            <button type="button" className="btn-back" onClick={handleBack}>
              ← Back
            </button>
          </form>
        );

      case 'success':
        return (
          <div className="forgot-password-form success-state">
            <div className="success-icon">✓</div>
            <h3>Password Reset Successful!</h3>
            <p className="subtitle">
              Your password has been updated. You can now log in with your new password.
            </p>
            <button
              className="btn-primary"
              onClick={() => {
                if (onSuccess) onSuccess();
                if (onClose) onClose();
              }}
            >
              Back to Login
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="forgot-password-modal-overlay" onClick={onClose}>
      <div className="forgot-password-modal" onClick={(e) => e.stopPropagation()}>
        {error && <div className="error-message">{error}</div>}
        {successMessage && step !== 'success' && (
          <div className="success-message">{successMessage}</div>
        )}

        {renderStepContent()}
      </div>
    </div>
  );
};

export default ForgotPassword;
