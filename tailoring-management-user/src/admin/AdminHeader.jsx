import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAlert } from '../context/AlertContext'
import "../adminStyle/appointments.css"

function AdminHeader() {
    const navigate = useNavigate();
    const { confirm } = useAlert();

    const handleLogout = async () => {
        const confirmed = await confirm(
            'Are you sure you want to logout?',
            'Confirm Logout',
            'warning',
            { confirmText: 'Logout', cancelText: 'Cancel' }
        );
        
        if (confirmed) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('role');
            navigate('/', { replace: true });
        }
    };

    return (
        <nav className="navbar">
          <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button
              onClick={handleLogout}
              title="Logout"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '18px',
                color: '#dc3545',
                padding: '8px',
                borderRadius: '5px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = 'rgba(220, 53, 69, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
              }}
            >
              <i className="fa-solid fa-right-from-bracket"></i>
            </button>
            Welcome back, Admin!
          </div>
        </nav>
    );
}

export default AdminHeader;