import React, { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom';
import "../adminStyle/appointments.css"
import logo from '../assets/logo.png';

function Sidebar() {
  const location = useLocation();
  const isRentalActive = location.pathname === '/rental' || location.pathname === '/Post';
  const [rentalSubmenuOpen, setRentalSubmenuOpen] = useState(isRentalActive);

  useEffect(() => {
    if (isRentalActive) {
      setRentalSubmenuOpen(true);
    }
  }, [isRentalActive]);

  return (
    <aside className='sidebar'>
      <div className='profile'>
  <div className="profile-header">
    <img
  src={logo}
  alt="D'jackman Tailor Deluxe Logo"
  className="profile-logo"
    />
    <h3 className="p" style={{ color: 'rgb(139, 69, 19)' }}>D'jackman Tailor Deluxe</h3>
  </div>
</div>

      <nav>
        <NavLink to="/admin" className={({ isActive }) => isActive ? 'active' : ''}>
          <i className="fas fa-home nav-icon"></i>
          Dashboard
        </NavLink>
        <NavLink to="/customize" className={({ isActive }) => isActive ? 'active' : ''}>
          <i className="fas fa-tshirt nav-icon"></i>
          Customization
        </NavLink>
        <NavLink to="/drycleaning" className={({ isActive }) => isActive ? 'active' : ''}>
          <i className="fas fa-tint nav-icon"></i>
          Dry Cleaning
        </NavLink>
        <div className="menu-item-with-submenu">
          <div
            onClick={() => setRentalSubmenuOpen(!rentalSubmenuOpen)}
            className={isRentalActive ? 'menu-parent active' : 'menu-parent'}
          >
            <i className="fas fa-box nav-icon"></i>
            <span>Rental</span>
            <span className="submenu-arrow">{rentalSubmenuOpen ? '▲' : '▼'}</span>
          </div>
          {rentalSubmenuOpen && (
            <div className="submenu-container">
              <NavLink
                to="/rental"
                className={({ isActive }) => isActive ? 'submenu-item active' : 'submenu-item'}
              >
                <i className="fas fa-box nav-icon"></i>
                Rental
              </NavLink>
              <NavLink
                to="/Post"
                className={({ isActive }) => isActive ? 'submenu-item active' : 'submenu-item'}
              >
                <i className="fas fa-add nav-icon"></i>
                Post rent
              </NavLink>
            </div>
          )}
        </div>
        <NavLink to="/repair" className={({ isActive }) => isActive ? 'active' : ''}>
          <i className="fas fa-cut nav-icon"></i>
          Repair
        </NavLink>
        <NavLink to="/orders-inventory" className={({ isActive }) => isActive ? 'active' : ''}>
          <i className="fas fa-clipboard-list nav-icon"></i>
          Orders & Inventory
        </NavLink>
        <NavLink to="/billing" className={({ isActive }) => isActive ? 'active' : ''}>
          <i className="fas fa-file-invoice-dollar nav-icon"></i>
          Billing
        </NavLink>
        <NavLink to="/inventory" className={({ isActive }) => isActive ? 'active' : ''}>
          <i className="fas fa-boxes nav-icon"></i>
          Inventory
        </NavLink>
        <NavLink to="/customers" className={({ isActive }) => isActive ? 'active' : ''}>
          <i className="fas fa-users nav-icon"></i>
          Customer List
        </NavLink>
        <NavLink to="/shop-schedule" className={({ isActive }) => isActive ? 'active' : ''}>
          <i className="fas fa-store nav-icon"></i>
          Shop Schedule
        </NavLink>
        <NavLink to="/walk-in-orders" className={({ isActive }) => isActive ? 'active' : ''}>
          <i className="fas fa-walking nav-icon"></i>
          Walk-In Orders
        </NavLink>
      </nav>
    </aside>
  );
}

export default Sidebar;