import React, { createContext, useContext, useState } from 'react';
import AlertModal from '../components/AlertModal';
import ConfirmModal from '../components/ConfirmModal';
import InputModal from '../components/InputModal';

const AlertContext = createContext();

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within AlertProvider');
  }
  return context;
};

export const AlertProvider = ({ children }) => {
  const [alertState, setAlertState] = useState({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
    onClose: null
  });

  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    type: 'warning',
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    onConfirm: null,
    onCancel: null
  });

  const [inputState, setInputState] = useState({
    isOpen: false,
    title: '',
    message: '',
    placeholder: '',
    defaultValue: '',
    confirmText: 'OK',
    cancelText: 'Cancel',
    onConfirm: null,
    onCancel: null
  });

  const alert = (message, title = null, type = 'info') => {
    return new Promise((resolve) => {
      setAlertState({
        isOpen: true,
        type,
        title: title || (type === 'success' ? 'Success' : type === 'error' ? 'Error' : type === 'warning' ? 'Warning' : 'Information'),
        message,
        onClose: () => {
          setAlertState(prev => ({ ...prev, isOpen: false }));

          setTimeout(() => {
            document.body.style.overflow = 'auto';
          }, 100);
          resolve();
        }
      });
    });
  };

  const confirm = (message, title = 'Confirm Action', type = 'warning', options = {}) => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        type,
        title,
        message,
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        onConfirm: () => {
          setConfirmState(prev => ({ ...prev, isOpen: false }));

          setTimeout(() => {
            document.body.style.overflow = 'auto';
          }, 100);
          resolve(true);
        },
        onCancel: () => {
          setConfirmState(prev => ({ ...prev, isOpen: false }));

          setTimeout(() => {
            document.body.style.overflow = 'auto';
          }, 100);
          resolve(false);
        }
      });
    });
  };

  const prompt = (message, title = 'Input Required', placeholder = '', defaultValue = '') => {
    return new Promise((resolve) => {
      setInputState({
        isOpen: true,
        title,
        message,
        placeholder,
        defaultValue,
        onConfirm: (value) => {
          setInputState(prev => ({ ...prev, isOpen: false }));

          setTimeout(() => {
            document.body.style.overflow = 'auto';
          }, 100);
          resolve(value);
        },
        onCancel: () => {
          setInputState(prev => ({ ...prev, isOpen: false }));

          setTimeout(() => {
            document.body.style.overflow = 'auto';
          }, 100);
          resolve(null);
        }
      });
    });
  };

  const value = {
    alert,
    confirm,
    prompt
  };

  return (
    <AlertContext.Provider value={value}>
      {children}
      <AlertModal
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
        onClose={alertState.onClose}
      />
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        type={confirmState.type}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        onConfirm={confirmState.onConfirm}
        onCancel={confirmState.onCancel}
      />
      <InputModal
        isOpen={inputState.isOpen}
        title={inputState.title}
        message={inputState.message}
        placeholder={inputState.placeholder}
        defaultValue={inputState.defaultValue}
        confirmText={inputState.confirmText}
        cancelText={inputState.cancelText}
        onConfirm={inputState.onConfirm}
        onCancel={inputState.onCancel}
      />
    </AlertContext.Provider>
  );
};

