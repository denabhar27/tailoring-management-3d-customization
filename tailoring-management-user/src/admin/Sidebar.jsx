import React, { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom';
import "../adminStyle/appointments.css"
import logo from '../assets/logo.png';
import { getUserRole } from '../api/AuthApi';

function Sidebar() {
  const location = useLocation();
  const isRentalActive = location.pathname === '/rental' || location.pathname === '/Post';
  const [rentalSubmenuOpen, setRentalSubmenuOpen] = useState(isRentalActive);
  const [role, setRole] = useState(getUserRole() || 'admin');

  useEffect(() => {
    if (isRentalActive) {
      setRentalSubmenuOpen(true);
    }
  }, [isRentalActive]);

  useEffect(() => {
    setRole(getUserRole() || 'admin');
  }, []);

  const navLinkClass = ({ isActive }) => isActive ? 'sidebar-nav-link active' : 'sidebar-nav-link';

  return (
    <aside className='sidebar sidebar-modern'>
      <div className='profile'>
        <div className="profile-header">
          <img
            src={logo}
            alt="D'jackman Tailor Deluxe Logo"
            className="profile-logo"
          />
          <div className="sidebar-brand-meta">
            <h3 className="p" style={{ color: 'rgb(139, 69, 19)' }}>D'jackman Tailor Deluxe</h3>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav-groups">
        <div className="sidebar-group">
          <p className="sidebar-group-title">Main</p>
          {role === 'admin' && (
            <NavLink to="/admin" className={navLinkClass}>
              <i className="fas fa-th-large nav-icon"></i>
              <span>Dashboard</span>
            </NavLink>
          )}
        </div>

        <div className="sidebar-group">
          <p className="sidebar-group-title">Operations</p>
          <NavLink to="/customize" className={navLinkClass}>
            <i className="fas fa-tshirt nav-icon"></i>
            <span>Customization</span>
          </NavLink>
          <NavLink to="/drycleaning" className={navLinkClass}>
            <i className="fas fa-box-open nav-icon"></i>
            <span>Dry Cleaning</span>
          </NavLink>

          <div className="menu-item-with-submenu sidebar-submenu-block">
            <div
              onClick={() => setRentalSubmenuOpen(!rentalSubmenuOpen)}
              className={isRentalActive ? 'menu-parent sidebar-nav-link active' : 'menu-parent sidebar-nav-link'}
            >
              <i className="fas fa-box nav-icon"></i>
              <span>Rental</span>
              <span className="submenu-arrow">{rentalSubmenuOpen ? '▾' : '▸'}</span>
            </div>
            {rentalSubmenuOpen && (
              <div className="submenu-container">
                <NavLink to="/rental" className={({ isActive }) => isActive ? 'submenu-item active' : 'submenu-item'}>
                  <i className="fas fa-box nav-icon"></i>
                  <span>Rental</span>
                </NavLink>
                <NavLink to="/Post" className={({ isActive }) => isActive ? 'submenu-item active' : 'submenu-item'}>
                  <i className="fas fa-plus nav-icon"></i>
                  <span>Post rent</span>
                </NavLink>
              </div>
            )}
          </div>

          <NavLink to="/repair" className={navLinkClass}>
            <i className="fas fa-cut nav-icon"></i>
            <span>Repair</span>
          </NavLink>
        </div>

        <div className="sidebar-group">
          <p className="sidebar-group-title">Commerce</p>
          {role === 'admin' && (
            <NavLink to="/orders-inventory" className={navLinkClass}>
              <i className="fas fa-clipboard-list nav-icon"></i>
              <span>Orders & Inventory</span>
            </NavLink>
          )}
          {role === 'admin' && (
            <NavLink to="/billing" className={navLinkClass}>
              <i className="fas fa-credit-card nav-icon"></i>
              <span>Billing</span>
            </NavLink>
          )}
          <NavLink to="/walk-in-orders" className={navLinkClass}>
            <i className="fas fa-walking nav-icon"></i>
            <span>Walk-In Orders</span>
          </NavLink>
        </div>

        <div className="sidebar-group">
          <p className="sidebar-group-title">People</p>
          <NavLink to="/customers" className={navLinkClass}>
            <i className="fas fa-users nav-icon"></i>
            <span>Customer List</span>
          </NavLink>
          {role === 'admin' && (
            <NavLink to="/clerk-management" className={navLinkClass}>
              <i className="fas fa-user-tie nav-icon"></i>
              <span>Clerk Management</span>
            </NavLink>
          )}
        </div>

        <div className="sidebar-group sidebar-group-last">
          <p className="sidebar-group-title">Settings / Admin</p>
          {role === 'admin' && (
            <NavLink to="/shop-schedule" className={navLinkClass}>
              <i className="fas fa-calendar-alt nav-icon"></i>
              <span>Shop Schedule</span>
            </NavLink>
          )}
        </div>
      </nav>
    </aside>
  );
}

export default Sidebar;