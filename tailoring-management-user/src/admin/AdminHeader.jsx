import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAlert } from '../context/AlertContext'
import "../adminStyle/appointments.css"

function AdminHeader() {
    const navigate = useNavigate();
  const location = useLocation();
    const { confirm } = useAlert();

  const routeMetaMap = {
    '/admin': { section: 'Main', page: 'Dashboard' },
    '/customize': { section: 'Operations', page: 'Customization' },
    '/drycleaning': { section: 'Operations', page: 'Dry Cleaning' },
    '/rental': { section: 'Operations', page: 'Rental' },
    '/Post': { section: 'Operations', page: 'Post Rent' },
    '/repair': { section: 'Operations', page: 'Repair' },
    '/orders-inventory': { section: 'Commerce', page: 'Orders & Inventory' },
    '/billing': { section: 'Commerce', page: 'Billing' },
    '/walk-in-orders': { section: 'Commerce', page: 'Walk-In Orders' },
    '/customers': { section: 'People', page: 'Customer List' },
    '/clerk-management': { section: 'People', page: 'Clerk Management' },
    '/shop-schedule': { section: 'Settings / Admin', page: 'Shop Schedule' }
  };

  const currentMeta = routeMetaMap[location.pathname] || { section: 'Admin', page: 'Dashboard' };

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
        <nav className="navbar admin-header-bar">
          <div className="admin-header-breadcrumb" aria-label="Current section and action">
            <span className="admin-header-section">{currentMeta.section}</span>
            <span className="admin-header-separator"> / </span>
            <span className="admin-header-page">{currentMeta.page}</span>
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            className="admin-header-logout"
          >
            <i className="fa-solid fa-right-from-bracket"></i>
          </button>
        </nav>
    );
}

export default AdminHeader;