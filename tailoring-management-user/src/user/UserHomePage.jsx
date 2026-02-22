import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/UserHomePage.css';
import '../styles/Guesthome.css';
import '../styles/Transitions.css';
import { initScrollAnimations, initHeaderScroll } from '../utils/scrollAnimations';
import logo from "../assets/logo.png";
import appointmentBg from "../assets/background.jpg";
import heroBg from "../assets/tailorbackground.jpg";
import customizeBg from "../assets/background.jpg";
import repairBg from "../assets/repair.png";
import dryCleanBg from "../assets/dryclean.png";
import { logoutUser } from '../api/AuthApi';
import { notificationApi } from '../api/NotificationApi';
import { getCartSummary } from '../api/CartApi';
import RentalClothes from './components/RentalClothes';
import Cart from './components/Cart';
import RepairFormModal from './components/RepairFormModal';
import DryCleaningFormModal from './components/DryCleaningFormModal';
import CustomizationFormModal from './components/CustomizationFormModal';
import OrderDetailsModal from './OrderDetailsModal';

const UserHomePage = ({ setIsLoggedIn }) => {
  const navigate = useNavigate();
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [repairFormModalOpen, setRepairFormModalOpen] = useState(false);
  const [dryCleaningFormModalOpen, setDryCleaningFormModalOpen] = useState(false);
  const [customizationFormModalOpen, setCustomizationFormModalOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [cartItemCount, setCartItemCount] = useState(0);
  const [orderDetailsModalOpen, setOrderDetailsModalOpen] = useState(false);
  const [selectedOrderItemId, setSelectedOrderItemId] = useState(null);

  const fetchCartCount = async () => {
    try {
      const result = await getCartSummary();
      if (result.success) {
        setCartItemCount(result.itemCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch cart count:', err);
      setCartItemCount(0);
    }
  };

  const fetchNotifications = async () => {
    try {
      const result = await notificationApi.getNotifications();
      if (result.success) {
        setNotifications(result.data || []);
      } else {
        setNotifications([]);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setNotifications([]);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const count = await notificationApi.getUnreadCount();
      setUnreadCount(count);
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileDropdownOpen && !event.target.closest('.profile-dropdown')) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileDropdownOpen]);

  useEffect(() => {
    const shouldReopen = sessionStorage.getItem('reopenCustomizationModal');
    if (shouldReopen === 'true') {
      sessionStorage.removeItem('reopenCustomizationModal');

      setTimeout(() => {
        setCustomizationFormModalOpen(true);
      }, 100);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
    fetchCartCount();
  }, []);

  useEffect(() => {
    const scrollObserver = initScrollAnimations();
    const headerCleanup = initHeaderScroll();

    return () => {
      if (scrollObserver) scrollObserver.disconnect();
      if (headerCleanup) headerCleanup();
    };
  }, []);

  useEffect(() => {
    if (cartOpen) {
      fetchCartCount();
    }
  }, [cartOpen]);

  useEffect(() => {
    if (notificationsOpen) {
      fetchNotifications();
    }
  }, [notificationsOpen]);

  const handleMarkAsRead = async (notificationId) => {
    try {
      await notificationApi.markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) =>
          n.notification_id === notificationId ? { ...n, is_read: 1 } : n
        )
      );
      setUnreadCount((prev) => Math.max(prev - 1, 0));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleNotificationClick = (notif) => {
    if (!notif.is_read) {
      handleMarkAsRead(notif.notification_id);
    }
    if (notif.order_item_id) {
      setSelectedOrderItemId(notif.order_item_id);
      setOrderDetailsModalOpen(true);
    }
  };

  const serviceOptions = [
    { type: 'Repair', description: 'Fix and enhance your clothes' },
    { type: 'Customize', description: 'Personalize and customize' },
    { type: 'Dry Cleaning', description: 'Impeccable clean on your suit' },
  ];

  const handleLogout = () => {
    logoutUser();
    if (typeof setIsLoggedIn === 'function') {
      setIsLoggedIn(false);
    }
    navigate('/', { replace: true });
  };

  const handleCartUpdate = () => {
    fetchCartCount();
    console.log('Cart was updated from repair modal!');

  };

  const addServiceToCart = (type) => {
    if (type === 'Repair') {

      setServiceModalOpen(false);
      setRepairFormModalOpen(true);
      return;
    }

    if (type === 'Customize') {

      setServiceModalOpen(false);
      setCustomizationFormModalOpen(true);
      return;
    }

    if (type === 'Dry Cleaning') {

      setServiceModalOpen(false);
      setDryCleaningFormModalOpen(true);
      return;
    }

    setServiceModalOpen(false);
    setCartOpen(true);
  };

  const services = [
    { name: 'Rental', img: heroBg },
    { name: 'Customize', img: customizeBg },
    { name: 'Repair', img: repairBg },
    { name: 'Dry Cleaning', img: dryCleanBg },
  ];

  return (
    <>
      <header className="header">
        <div className="logo">
          <img src={logo} alt="Logo" className="logo-img" />
          <span className="logo-text">D’jackman Tailor Deluxe</span>
        </div>

        <nav className="nav">
          <a href="#top">Home</a>
          <a href="#Appointment">Appointment</a>
          <a href="#Rentals">Rental</a>
          <a href="#Customize">Customize</a>
          <a href="#Repair">Repair</a>
          <a href="#DryCleaning">Dry Cleaning</a>
        </nav>
        <button className="notif-button icon-button" onClick={() => setNotificationsOpen(true)} aria-label="Notifications">
          <svg width="24" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 3a6 6 0 0 1 6 6v4l2 2H4l2-2V9a6 6 0 0 1 6-6z" stroke="#8B4513" strokeWidth="2" fill="none"/><circle cx="12" cy="20" r="2" fill="#8B4513"/></svg>
          {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
        </button>
        <button className="cart-button icon-button" onClick={() => setCartOpen(true)} aria-label="Cart">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M6 6h14l-2 9H8L6 6z" stroke="#8B4513" strokeWidth="2" fill="none"/><circle cx="9" cy="20" r="2" fill="#8B4513"/><circle cx="17" cy="20" r="2" fill="#8B4513"/></svg>
          {cartItemCount > 0 && <span className="cart-badge">{cartItemCount}</span>}
        </button>
        <button className="profile-button icon-button" onClick={() => setProfileDropdownOpen(!profileDropdownOpen)} aria-label="Profile">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="#8B4513" strokeWidth="2" fill="none"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke="#8B4513" strokeWidth="2" fill="none"/></svg>
        </button>
        <div className="profile-dropdown">
          {profileDropdownOpen && (
            <div className="dropdown-menu">
              <button className="dropdown-item" onClick={() => {
                setProfileDropdownOpen(false);
                navigate('/profile');
              }}>
                My Profile
              </button>
              <button className="dropdown-item" onClick={() => {
                setProfileDropdownOpen(false);
                setServiceModalOpen(true);
              }}>
                Book Services
              </button>
              <button className="dropdown-item logout-item" onClick={() => {
                setProfileDropdownOpen(false);
                handleLogout();
              }}>
                Logout
              </button>
            </div>
          )}
        </div>
      </header>
            <section className="hero" id="top" style={{ backgroundImage: `url(${heroBg})` }}>
              <div className="hero-overlay"></div>
              <div className="hero-content">
                <h1>Welcome to Jackman <br />Tailor Deluxe!</h1>
                <p>Your Perfect Fit Awaits.</p>
              </div>
            </section>
      <section className="services fade-in-up">
        <h2 className="fade-in-up">Jackman's Services</h2>
        <div className="services-grid stagger-children">
          {services.map(({ name, img }) => (
            <div key={name} className="service-card glow-on-hover">
              <div
                className="service-img"
                style={{ backgroundImage: `url(${img})` }}
              ></div>
              <div className="service-footer">
                <h3>{name}</h3>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="appointment" id="Appointment">
        <h2>Book a Service</h2>
        <div className="appointment-content">
          <img src={appointmentBg} alt="Tailor" className="appointment-img" />
          <div className="appointment-overlay">
            <p>Ready for a fitting or consultation?</p>
            <p>We’re excited to serve you again!</p>
            <button className="btn-book" onClick={() => setServiceModalOpen(true)}>Book Service</button>
          </div>
        </div>
      </section>
      <RentalClothes openAuthModal={() => setServiceModalOpen(true)} />

      <section className="customization fade-in-up" id="Customize">
        <div className="custom-text fade-in-left">
          <h2>Customization</h2>
          <p>Got a style in mind?</p>
          <p>Personalize it and turn your vision into reality!</p>
        </div>
        <div className="custom-image fade-in-right scale-in" style={{ backgroundImage: `url('/src/assets/background.jpg'), url(${customizeBg})` }}>
          <button className="btn-customize glow-on-hover" onClick={() => setCustomizationFormModalOpen(true)}>Customize now!</button>
        </div>
      </section>

      <section className="repair fade-in-up" id="Repair">
        <h2 className="fade-in-up">Repair Service</h2>
        <div className="repair-bg scale-in" style={{ backgroundImage: `url(${repairBg})` }}>
          <div className="repair-overlay"></div>
          <div className="repair-content">
            <h3 className="fade-in-up">Need reliable repair services?</h3>
            <p className="fade-in-up">Get in touch with us today!</p>
            <button className="repair-book glow-on-hover" onClick={() => setRepairFormModalOpen(true)}>Book Repair!</button>
          </div>
        </div>
      </section>

      <section className="clean fade-in-up" id="DryCleaning">
        <h2 className="fade-in-up">Dry Cleaning Service</h2>
        <div className="clean-bg scale-in" style={{ backgroundImage: `url(${dryCleanBg})` }}>
          <div className="clean-overlay"></div>
          <div className="clean-content">
            <h3 className="fade-in-up">Keep your garments fresh and spotless</h3>
            <p className="fade-in-up">Premium care for suits, gowns, and more</p>
            <button className="clean-book glow-on-hover" onClick={() => setDryCleaningFormModalOpen(true)}>Book Dry Cleaning</button>
          </div>
        </div>
      </section>

      {serviceModalOpen && (
        <div className="auth-modal-overlay" onClick={() => setServiceModalOpen(false)}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <div className="auth-container">
              <div className="auth-header">
                <h2>Select Service</h2>
                <p className="auth-subtitle">Choose the service you want to book</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {serviceOptions.map((s) => (
                  <button key={s.type} className="auth-submit" onClick={() => addServiceToCart(s.type)}>{s.type}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {notificationsOpen && (
        <div className="auth-modal-overlay" onClick={() => setNotificationsOpen(false)}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <div className="auth-container">
              <div className="auth-header">
                <h2>Notifications</h2>
                <p className="auth-subtitle">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
                </p>
                {notifications.length > 0 && (
                  <button
                    className="btn-secondary"
                    onClick={handleMarkAllAsRead}
                    style={{ fontSize: '13px', padding: '6px 12px', marginTop: '8px' }}
                  >
                    Mark all as read
                  </button>
                )}
              </div>
              <div style={{ padding: '14px', display: 'grid', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
                {notifications.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>
                    No notifications yet
                  </div>
                )}
                {notifications.map((notif) => (
                  <div
                    key={notif.notification_id}
                    onClick={() => handleNotificationClick(notif)}
                    style={{
                      border: '1px solid #eee',
                      borderRadius: '10px',
                      padding: '12px',
                      backgroundColor: notif.is_read ? '#f9f9f9' : '#fff',
                      cursor: notif.is_read ? 'default' : 'pointer',
                      opacity: notif.is_read ? 0.7 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, marginBottom: '4px' }}>{notif.title}</div>
                        <div style={{ fontSize: '14px', color: '#555', lineHeight: 1.4 }}>{notif.message}</div>
                        <div style={{ fontSize: '12px', color: '#999', marginTop: '6px' }}>
                          {new Date(notif.created_at).toLocaleString()}
                        </div>
                      </div>
                      {!notif.is_read && (
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: '#8B4513',
                            marginTop: 4,
                            marginLeft: 8,
                          }}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <Cart
        isOpen={cartOpen}
        onClose={() => {
          setCartOpen(false);
          fetchCartCount();
        }}
        onCartUpdate={handleCartUpdate}
      />
      <RepairFormModal
        isOpen={repairFormModalOpen}
        onClose={() => setRepairFormModalOpen(false)}
        onCartUpdate={handleCartUpdate}
      />
      <DryCleaningFormModal
        isOpen={dryCleaningFormModalOpen}
        onClose={() => setDryCleaningFormModalOpen(false)}
        onCartUpdate={handleCartUpdate}
      />
      <CustomizationFormModal
        isOpen={customizationFormModalOpen}
        onClose={() => setCustomizationFormModalOpen(false)}
        onCartUpdate={handleCartUpdate}
      />
      <OrderDetailsModal
        isOpen={orderDetailsModalOpen}
        onClose={() => setOrderDetailsModalOpen(false)}
        orderItemId={selectedOrderItemId}
      />

    </>
  );
};

export default UserHomePage;