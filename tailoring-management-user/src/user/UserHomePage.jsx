import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/UserHomePage.css';
import '../styles/Guesthome.css';
import '../styles/Transitions.css';
import { FiScissors, FiDroplet, FiChevronRight } from 'react-icons/fi';
import { PiTShirtBold } from 'react-icons/pi';
import { initScrollAnimations, initHeaderScroll } from '../utils/scrollAnimations';
import logo from "../assets/logo.png";
import appointmentBg from "../assets/background.jpg";
import heroBg from "../assets/tailorbackground.jpg";
import customizeBg from "../assets/background.jpg";
import repairBg from "../assets/repair.png";
import dryCleanBg from "../assets/dryclean.png";
import { logoutUser } from '../api/AuthApi';
import { useAlert } from '../context/AlertContext';
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
  const { confirm } = useAlert();
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

  const handleLogout = async () => {
    const confirmed = await confirm(
      'Are you sure you want to logout?',
      'Confirm Logout',
      'warning',
      { confirmText: 'Logout', cancelText: 'Cancel' }
    );
    
    if (confirmed) {
      logoutUser();
      if (typeof setIsLoggedIn === 'function') {
        setIsLoggedIn(false);
      }
      navigate('/', { replace: true });
    }
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
        <button className="notif-button icon-button" onClick={() => setNotificationsOpen(!notificationsOpen)} aria-label="Notifications">
          <svg width="24" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 3a6 6 0 0 1 6 6v4l2 2H4l2-2V9a6 6 0 0 1 6-6z" stroke="#8B4513" strokeWidth="2" fill="none"/><circle cx="12" cy="20" r="2" fill="#8B4513"/></svg>
          {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
        </button>
        {/* Notification Dropdown Panel */}
        {notificationsOpen && (
          <div className="notification-dropdown-overlay" onClick={() => setNotificationsOpen(false)}>
            <div className="notification-dropdown" onClick={(e) => e.stopPropagation()}>
              <div className="notification-header">
                <h3>Notifications</h3>
                {unreadCount > 0 && (
                  <button className="mark-all-read-btn" onClick={handleMarkAllAsRead}>
                    Mark all as read
                  </button>
                )}
                <button className="notification-close-btn" onClick={() => setNotificationsOpen(false)}>×</button>
              </div>
              <div className="notification-list">
                {notifications.length === 0 ? (
                  <div className="notification-empty">
                    <p>No notifications yet</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div 
                      key={notif.notification_id}
                      className={`notification-item ${!notif.is_read ? 'unread' : ''}`}
                      onClick={() => handleNotificationClick(notif)}
                    >
                      <div className="notification-content">
                        <p className="notification-message">
                          {notif.message
                            .replace(/price_confirmation/gi, 'Price Confirmation')
                            .replace(/in_progress/gi, 'In Progress')
                            .replace(/ready_to_pickup/gi, 'Ready to Pickup')
                            .replace(/_/g, ' ')}
                        </p>
                        <span className="notification-time">
                          {new Date(notif.created_at).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      {!notif.is_read && <span className="notification-dot"></span>}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
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

      <section className="customization fade-in-up"
          id="Customize"
          style={{
            background: "linear-gradient(to bottom, #fffff5 0%, #f0e9e2 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "100px 5%",
            gap: "60px",      
            flexWrap: "wrap", 
          }}
        >
        <div className="custom-text fade-in-left" style={{ maxWidth: "600px", textAlign: "left" }}>
          <h2 style={{ 
            fontFamily: "'Playfair Display', serif", 
            fontSize: "3.5rem", 
            fontWeight: 800, 
            color: "#8B4513", 
            marginBottom: "30px", 
            letterSpacing: "1px",
            textDecoration: "none",
            borderBottom: "none"
          }}>Customization Service</h2>
          <p style={{ 
            fontSize: "1.4rem", 
            color: "#5D4037", 
            margin: "20px 0", 
            lineHeight: 1.6, 
            opacity: 0.95 
          }}>Got a style in mind?</p>
          <p style={{ 
            fontSize: "1.4rem", 
            color: "#5D4037", 
            margin: "20px 0", 
            lineHeight: 1.6, 
            opacity: 0.95 
          }}>Personalize it and turn your vision into reality!</p>
        </div>
        <div className="custom-image fade-in-right scale-in" style={{ 
          backgroundImage: `url(${customizeBg})`, 
          backgroundSize: "cover", 
          backgroundPosition: "center", 
          borderRadius: "32px", 
          height: "500px", 
          position: "relative",
          width: "600px",
        }}>
          <div className="custom-overlay" style={{ 
            position: "absolute", 
            inset: 0, 
            background: "linear-gradient(135deg, rgba(139, 69, 19, 0.4) 0%, rgba(101, 67, 33, 0.6) 100%)", 
            borderRadius: "32px" ,
          }}></div>
          <div className="custom-content" style={{ 
            position: "absolute", 
            top: "50%", 
            left: "50%", 
            transform: "translate(-50%, -50%)", 
            textAlign: "center", 
            zIndex: 2, 
            color: "white" 
          }}>
            <h3 style={{ 
              fontFamily: "'Playfair Display', serif", 
              fontSize: "2.5rem", 
              fontWeight: 800, 
              textShadow: "2px 2px 4px rgba(0,0,0,0.3)",
              marginBottom: "20px"
            }}>Customize your vision</h3>
            <p style={{ 
              fontSize: "1.3rem", 
              opacity: 0.96, 
              fontWeight: 400, 
              textShadow: "1px 1px 2px rgba(0,0,0,0.3)", 
              maxWidth: "500px",
              marginBottom: "30px"
            }}>Turn style ideas into reality</p>
            <button className="custom-book glow-on-hover" onClick={() => setCustomizationFormModalOpen(true)} style={{ 
              padding: "18px 50px", 
              background: "white", 
              color: "#8B4513", 
              border: "none", 
              borderRadius: "50px", 
              fontSize: "1.2rem", 
              fontWeight: 700, 
              cursor: "pointer", 
              boxShadow: "0 10px 30px rgba(139, 69, 19, 0.3)",
              transition: "all 0.3s"
            }}>Customize now!</button>
          </div>
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

      <section className="clean fade-in-up" id="DryCleaning"
          style={{
            background: "linear-gradient(to bottom, #fffff5 0%, #f0e9e2 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "100px 5%"
          }}
        >
        <div className="clean-image fade-in-left scale-in" style={{ 
          backgroundImage: `url(${dryCleanBg})`, 
          backgroundSize: "cover", 
          backgroundPosition: "center", 
          borderRadius: "32px", 
          height: "500px", 
          width: "600px", 
          position: "relative",
          marginRight: "60px"
        }}>
          <div className="clean-overlay" style={{ 
            position: "absolute", 
            inset: 0, 
            background: "linear-gradient(135deg, rgba(139, 69, 19, 0.4) 0%, rgba(101, 67, 33, 0.6) 100%)", 
            borderRadius: "32px" 
          }}></div>
          <div className="clean-content" style={{ 
            position: "absolute", 
            top: "50%", 
            left: "50%", 
            transform: "translate(-50%, -50%)", 
            textAlign: "center", 
            zIndex: 2, 
            color: "white" 
          }}>
            <h3 style={{ 
              fontFamily: "'Playfair Display', serif", 
              fontSize: "2.5rem", 
              fontWeight: 800, 
              textShadow: "2px 2px 4px rgba(0,0,0,0.3)",
              marginBottom: "20px"
            }}>Keep your garments fresh and spotless</h3>
            <p style={{ 
              fontSize: "1.3rem", 
              opacity: 0.96, 
              fontWeight: 400, 
              textShadow: "1px 1px 2px rgba(0,0,0,0.3)", 
              maxWidth: "500px",
              marginBottom: "30px"
            }}>Premium care for suits, gowns, and more</p>
            <button className="clean-book glow-on-hover" onClick={() => setDryCleaningFormModalOpen(true)} style={{ 
              padding: "18px 50px", 
              background: "white", 
              color: "#8B4513", 
              border: "none", 
              borderRadius: "50px", 
              fontSize: "1.2rem", 
              fontWeight: 700, 
              cursor: "pointer", 
              boxShadow: "0 10px 30px rgba(139, 69, 19, 0.3)",
              transition: "all 0.3s"
            }}>Book Dry Cleaning</button>
          </div>
        </div>
        <div className="clean-text fade-in-right" style={{ maxWidth: "600px", textAlign: "right" }}>
          <h2 style={{ 
            fontFamily: "'Playfair Display', serif", 
            fontSize: "3.5rem", 
            fontWeight: 800, 
            color: "#8B4513", 
            marginBottom: "30px", 
            letterSpacing: "1px",
            textDecoration: "none",
            position: "relative",
            paddingRight: "20px"
          }}>Dry Cleaning Service</h2>
          <p style={{ 
            fontSize: "1.4rem", 
            color: "#5D4037", 
            margin: "20px 0", 
            lineHeight: 1.6, 
            opacity: 0.95 
          }}>Professional dry cleaning for all your garments</p>
          <p style={{ 
            fontSize: "1.4rem", 
            color: "#5D4037", 
            margin: "20px 0", 
            lineHeight: 1.6, 
          }}>Expert care for delicate fabrics and special occasions</p>
        </div>
      </section>

      {serviceModalOpen && (
        <div className="auth-modal-overlay" onClick={() => setServiceModalOpen(false)}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <div className="auth-container">
              <div className="service-hero-card">
                <h2 className="service-hero-title">Select Service</h2>
                <p className="service-hero-subtitle">Choose the service you want to book</p>
                <div className="service-decorative-line" />
              </div>
              <div className="service-cards-list">
                <button className="service-card-btn service-card-repair" onClick={() => { setServiceModalOpen(false); addServiceToCart('Repair'); }}>
                  <div className="service-card-icon"><FiScissors size={28} /></div>
                  <div className="service-card-text">
                    <span className="service-card-title">Repair Service</span>
                    <span className="service-card-desc">Expert restoration &amp; stitching</span>
                  </div>
                  <div className="service-card-chevron"><FiChevronRight size={22} /></div>
                </button>
                <button className="service-card-btn service-card-customize" onClick={() => { setServiceModalOpen(false); addServiceToCart('Customize'); }}>
                  <div className="service-card-icon"><PiTShirtBold size={28} /></div>
                  <div className="service-card-text">
                    <span className="service-card-title">Customize Service</span>
                    <span className="service-card-desc">Tailor-made designs just for you</span>
                  </div>
                  <div className="service-card-chevron"><FiChevronRight size={22} /></div>
                </button>
                <button className="service-card-btn service-card-drycleaning" onClick={() => { setServiceModalOpen(false); addServiceToCart('Dry Cleaning'); }}>
                  <div className="service-card-icon"><FiDroplet size={28} /></div>
                  <div className="service-card-text">
                    <span className="service-card-title">Dry Cleaning</span>
                    <span className="service-card-desc">Premium care &amp; deep clean</span>
                  </div>
                  <div className="service-card-chevron"><FiChevronRight size={22} /></div>
                </button>
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

      <footer style={{
        backgroundColor: "#a76648ff",
        color: "#f0e9e2",
        padding: "15px 20px 10px",
      }}>
        <div style={{
          maxWidth: "1200px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "40px",
          textAlign: "center",
          marginTop: "20px",
          alignItems: "start"
        }}>
          <div>
            <h3 style={{
              fontSize: "1.1rem",
              fontWeight: 700,
              marginBottom: "12px",
              color: "#f0e9e2"
            }}>Our store:</h3>
            <p style={{
              fontSize: "0.9rem",
              lineHeight: 1.5,
              marginBottom: "8px",
              color: "#d4c5b9"
            }}>Location: Ground floor of Zamboanga A.E. Colleges, 41 Rizal Street, Zamboanga City, Philippines</p>
            <p style={{
              fontSize: "0.9rem",
              lineHeight: 1.5,
              color: "#d4c5b9"
            }}>Monday-Saturday: 8 AM - 6 PM</p>
          </div>
          
          <div>
            <h3 style={{
              fontSize: "1.1rem",
              fontWeight: 700,
              marginBottom: "15px",
              color: "#f0e9e2"
            }}>Customer Service</h3>
            <p style={{
              fontSize: "1rem",
              lineHeight: 1.6,
              marginBottom: "8px",
              color: "#d4c5b9"
            }}>Tel: 0917 7107959</p>
            <p style={{
              fontSize: "1rem",
              lineHeight: 1.6,
              color: "#d4c5b9"
            }}>Email: Ronald@gmail.com</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h3 style={{
              fontSize: "1.1rem",
              fontWeight: 700,
              marginBottom: "12px",
              color: "#f0e9e2"
            }}>Download the App</h3>
            <div style={{
              width: '80px',
              height: '80px',
              backgroundColor: '#fff',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '5px',
              marginBottom: '8px'
            }}>
              {/* QR Code pointing to Expo build page */}
              <img 
                src="https://api.qrserver.com/v1/create-qr-code/?size=70x70&data=https://expo.dev/accounts/tocka27/projects/my-tailoring-app/builds/d8d5b650-6b41-462b-ae77-ff3eee27d2c1" 
                alt="Download App QR Code"
                style={{ width: '70px', height: '70px' }}
              />
            </div>
            <p style={{
              fontSize: "0.8rem",
              color: "#d4c5b9",
              margin: 0
            }}>Scan to download</p>
         </div>
        </div>
        
        <div style={{
          textAlign: "center",
          marginTop: "30px",
          paddingTop: "20px",
          borderTop: "1px solid #4a3426"
        }}>
          <p style={{
            fontSize: "0.9rem",
            color: "#d4c5b9",
            margin: 0
          }}>Copyright 2026 by BridgeIT</p>
        </div>
      </footer>


    </>
  );
};

export default UserHomePage;