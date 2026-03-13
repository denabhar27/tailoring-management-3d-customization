import React, { useState, useEffect } from 'react';
import '../styles/SharedModal.css';

const ClerkModal = ({ isOpen, onClose, onSubmit, submitting, initialData = null, mode = 'create' }) => {
  const [form, setForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    username: '',
    password: ''
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setForm({
          first_name: initialData.first_name || '',
          middle_name: initialData.middle_name || '',
          last_name: initialData.last_name || '',
          email: initialData.email || '',
          phone_number: initialData.phone_number || '',
          username: initialData.username || '',
          password: ''
        });
      }
    } else {
      setForm({ first_name: '', middle_name: '', last_name: '', email: '', phone_number: '', username: '', password: '' });
      setErrors({});
    }
  }, [isOpen, initialData]);

  const validate = () => {
    const nextErrors = {};
    if (!form.first_name.trim()) nextErrors.first_name = 'First name is required';
    if (!form.last_name.trim()) nextErrors.last_name = 'Last name is required';
    if (!form.email.trim()) nextErrors.email = 'Email is required';
    else {
      const emailRegex = /[^@\s]+@[^@\s]+\.[^@\s]+/;
      if (!emailRegex.test(form.email.trim())) {
        nextErrors.email = 'Enter a valid email address';
      }
    }
    if (!form.phone_number.trim()) nextErrors.phone_number = 'Phone number is required';
    if (!form.username.trim()) nextErrors.username = 'Username is required';
    if (mode === 'create' && !form.password.trim()) nextErrors.password = 'Password is required';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit(form);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay-shared" onClick={onClose}>
      <div className="modal-container-shared" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-shared">
          <h3 className="modal-title-shared">{mode === 'edit' ? 'Edit Clerk' : 'Create New Clerk'}</h3>
          <button className="modal-close-shared" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-content-shared">
          <form onSubmit={handleSubmit}>
            <div className="form-group-shared">
              <label className="form-label-shared">First Name <span className="required-indicator">*</span></label>
              <input
                className="form-input-shared"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              />
              {errors.first_name && <p className="error-text-shared">{errors.first_name}</p>}
            </div>

            <div className="form-group-shared">
              <label className="form-label-shared">Middle Name</label>
              <input
                className="form-input-shared"
                value={form.middle_name}
                onChange={(e) => setForm({ ...form, middle_name: e.target.value })}
              />
            </div>

            <div className="form-group-shared">
              <label className="form-label-shared">Last Name <span className="required-indicator">*</span></label>
              <input
                className="form-input-shared"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              />
              {errors.last_name && <p className="error-text-shared">{errors.last_name}</p>}
            </div>

            <div className="form-group-shared">
              <label className="form-label-shared">Email <span className="required-indicator">*</span></label>
              <input
                type="email"
                className="form-input-shared"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              {errors.email && <p className="error-text-shared">{errors.email}</p>}
            </div>

            <div className="form-group-shared">
              <label className="form-label-shared">Phone Number <span className="required-indicator">*</span></label>
              <input
                className="form-input-shared"
                value={form.phone_number}
                onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
              />
              {errors.phone_number && <p className="error-text-shared">{errors.phone_number}</p>}
            </div>

            <div className="form-group-shared">
              <label className="form-label-shared">Username <span className="required-indicator">*</span></label>
              <input
                className="form-input-shared"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
              {errors.username && <p className="error-text-shared">{errors.username}</p>}
            </div>

            <div className="form-group-shared">
              <label className="form-label-shared">Password {mode === 'edit' ? '(leave blank to keep unchanged)' : <span className="required-indicator">*</span>}</label>
              <input
                type="password"
                className="form-input-shared"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              {errors.password && <p className="error-text-shared">{errors.password}</p>}
            </div>

            <div className="modal-actions-shared">
              <button type="button" className="btn-secondary-shared" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary-shared" disabled={submitting}>
                {submitting ? (mode === 'edit' ? 'Saving...' : 'Creating...') : (mode === 'edit' ? 'Save Changes' : 'Create Clerk')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ClerkModal;
