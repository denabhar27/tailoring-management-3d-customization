import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { completeGoogleLogin } from '../../api/AuthApi';

const GoogleAuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [statusMessage, setStatusMessage] = useState('Processing Google sign-in...');

  useEffect(() => {
    const token = searchParams.get('token');
    const roleParam = searchParams.get('role');
    const error = searchParams.get('error');

    if (error) {
      setStatusMessage(error);
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 2500);
      return;
    }

    if (!token) {
      setStatusMessage('Authentication token is missing. Please try again.');
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 2500);
      return;
    }

    const loginResult = completeGoogleLogin(token, roleParam || undefined);
    if (!loginResult.success) {
      setStatusMessage(loginResult.message || 'Google sign-in failed. Please try again.');
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 2500);
      return;
    }

    setStatusMessage('Google sign-in successful. Redirecting...');
    const role = loginResult.role;
    if (role === 'admin' || role === 'clerk') {
      navigate('/admin', { replace: true });
    } else {
      navigate('/user-home', { replace: true });
    }
  }, [navigate, searchParams]);

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8f3ee', padding: '24px' }}>
      <div style={{ background: '#fff', padding: '28px', borderRadius: '14px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', maxWidth: '460px', width: '100%', textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 12px', color: '#5a3e2f' }}>Google Authentication</h2>
        <p style={{ margin: 0, color: '#6c5b51' }}>{statusMessage}</p>
      </div>
    </div>
  );
};

export default GoogleAuthCallback;
