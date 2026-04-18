import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import '../styles/Guesthome.css';
import '../styles/UserHomePage.css';
import '../styles/Transitions.css';
import { FiScissors, FiDroplet, FiChevronRight, FiEye, FiEyeOff } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { PiTShirtBold } from 'react-icons/pi';
import { initScrollAnimations, initHeaderScroll } from '../utils/scrollAnimations';
import logo from "../assets/logo.png";
import dp from "../assets/dp.png";
import dryCleanBg from "../assets/dryclean.png";
import heroBg from "../assets/tailorbackground.jpg";
import appointmentBg from "../assets/background.jpg";
import suitSample from "../assets/suits.png";
import customizeBg from "../assets/background.jpg";
import repairBg from "../assets/repair.png";
import brown from "../assets/brown.png";
import full from "../assets/full.png";
import tuxedo from "../assets/tuxedo.png";
import { loginUser, registerUser, getGoogleAuthUrl, getToken, logoutUser } from '../api/AuthApi';
import { validateRegistrationBirthdate } from '../utils/ageValidation';
import { useAlert } from '../context/AlertContext';
import { notificationApi } from '../api/NotificationApi';
import { getCartSummary } from '../api/CartApi';
import RentalClothes from './components/RentalClothes';
import ForgotPassword from '../components/auth/ForgotPassword';
import Cart from './components/Cart';
import RepairFormModal from './components/RepairFormModal';
import DryCleaningFormModal from './components/DryCleaningFormModal';
import CustomizationFormModal from './components/CustomizationFormModal';
import OrderDetailsModal from './OrderDetailsModal';

const APPOINTMENT_STEPS = [
  'Choose a service that matches your needs.',
  'Select your preferred date and time slot.',
  'Visit our shop for fitting and consultation.'
];

const GuestHomePage = ({ setIsLoggedIn }) => {
  const { confirm } = useAlert();
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('top');
  const [hoveredService, setHoveredService] = useState(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [signupFirstName, setSignupFirstName] = useState('');
  const [signupMiddleName, setSignupMiddleName] = useState('');
  const [signupLastName, setSignupLastName] = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupBirthdate, setSignupBirthdate] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

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

  const navigate = useNavigate();
  const location = useLocation();

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

  useEffect(() => {
    const scrollObserver = initScrollAnimations();
    const headerCleanup = initHeaderScroll();

    return () => {
      if (scrollObserver) scrollObserver.disconnect();
      if (headerCleanup) headerCleanup();
    };
  }, []);

  useEffect(() => {
    const sectionMap = [
      { id: 'top', key: 'top' },
      { id: 'Appointment', key: 'Appointment' },
      { id: 'Rentals', key: 'Rentals' },
      { id: 'Customize', key: 'Customize' },
      { id: 'Repair', key: 'Repair' },
      { id: 'DryCleaning', key: 'DryCleaning' },
    ];

    const handleMouseMove = (event) => {
      setCursorPos({ x: event.clientX, y: event.clientY });
    };

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 18);

      // Keep "Home" highlighted immediately on first screen load.
      if (window.scrollY <= 40) {
        setActiveSection('top');
        return;
      }

      let currentSection = 'top';
      const headerOffset = 120;

      sectionMap.forEach(({ id, key }) => {
        const section = document.getElementById(id);
        if (!section) return;
        const top = section.offsetTop - headerOffset;
        const bottom = top + section.offsetHeight;
        if (window.scrollY >= top && window.scrollY < bottom) {
          currentSection = key;
        }
      });

      setActiveSection(currentSection);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    window.requestAnimationFrame(handleScroll);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

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
    if (!getToken()) return;
    const shouldReopen = sessionStorage.getItem('reopenCustomizationModal');
    if (shouldReopen === 'true') {
      sessionStorage.removeItem('reopenCustomizationModal');
      setTimeout(() => setCustomizationFormModalOpen(true), 100);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    fetchNotifications();
    fetchUnreadCount();
    fetchCartCount();
  }, []);

  useEffect(() => {
    if (cartOpen && getToken()) {
      fetchCartCount();
    }
  }, [cartOpen]);

  useEffect(() => {
    if (notificationsOpen && getToken()) {
      fetchNotifications();
    }
  }, [notificationsOpen]);

  const openAuthModal = () => {
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setShowLoginPassword(false);
    setShowSignupPassword(false);
  };

  const validatePassword = (password) => {
    if (!password) {
      return {
        isValid: false,
        message: 'Password is required'
      };
    }

    if (password.length < 8) {
      return {
        isValid: false,
        message: `Password must be at least 8 characters long. You have ${password.length} character(s).`
      };
    }

    const specialCharRegex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/;
    if (!specialCharRegex.test(password)) {
      return {
        isValid: false,
        message: 'Password must contain at least one special character (!@#$%^&* etc.)'
      };
    }

    return { isValid: true };
  };

  const sanitizePhilippinePhone = (phoneNumber) => {
    let digitsOnly = String(phoneNumber || '').replace(/\D/g, '');

    // Accept +63XXXXXXXXXX / 63XXXXXXXXXX / 09XXXXXXXXX / 9XXXXXXXXX and store as 9XXXXXXXXX for UI.
    if (digitsOnly.startsWith('63')) {
      digitsOnly = digitsOnly.slice(2);
    }
    if (digitsOnly.startsWith('0')) {
      digitsOnly = digitsOnly.slice(1);
    }

    return digitsOnly.slice(0, 10);
  };

  const toLocalPhilippinePhone = (phoneNumber) => {
    const mobileLocal = sanitizePhilippinePhone(phoneNumber);
    return mobileLocal ? `0${mobileLocal}` : '';
  };

  const validatePhoneNumber = (phoneNumber) => {
    const normalizedPhone = sanitizePhilippinePhone(phoneNumber);

    if (!/^9\d{9}$/.test(normalizedPhone)) {
      return {
        isValid: false,
        message: 'Phone number must be a valid PH mobile number (e.g. +63 9XXXXXXXXX).'
      };
    }

    return { isValid: true, sanitizedPhone: normalizedPhone };
  };

  const handleLogin = async () => {
    setAuthError('');

    if (isLogin) {
      if (!loginUsername || !loginPassword) {
        setAuthError('Please enter both username and password');
        return;
      }
    }

    setIsLoading(true);

    try {
      if (isLogin) {

        const result = await loginUser({
          username: loginUsername,
          password: loginPassword
        });

        if (result.message === 'Login successful' || result.message === 'Admin login successful') {
          if (typeof setIsLoggedIn === 'function') {
            setIsLoggedIn(true);
          }
          setIsAuthModalOpen(false);

          const userRole = localStorage.getItem('role');
          if (userRole === 'admin' || userRole === 'clerk') {
            navigate('/admin', { replace: true });
          } else {
            navigate('/user-home', { replace: true });
          }
        } else {
          const errorMessage = result.message || 'Login failed';
          setAuthError(errorMessage);
        }
      } else {

        const sanitizedSignupPhone = sanitizePhilippinePhone(signupPhone);

        if (!signupFirstName || !signupLastName || !signupUsername || !signupEmail || !signupPassword || !sanitizedSignupPhone || !signupBirthdate) {
          setAuthError('Please fill in all required fields');
          setIsLoading(false);
          return;
        }

        if (signupPassword !== signupConfirmPassword) {
          setAuthError('Passwords do not match');
          setIsLoading(false);
          return;
        }

        const phoneValidation = validatePhoneNumber(sanitizedSignupPhone);
        if (!phoneValidation.isValid) {
          setAuthError(phoneValidation.message);
          setIsLoading(false);
          return;
        }

        setSignupPhone(phoneValidation.sanitizedPhone);

        const passwordValidation = validatePassword(signupPassword);
        if (!passwordValidation.isValid) {
          setAuthError(passwordValidation.message);
          setIsLoading(false);
          return;
        }

        const birthdateCheck = validateRegistrationBirthdate(signupBirthdate, 18);
        if (!birthdateCheck.ok) {
          setAuthError(birthdateCheck.message);
          setIsLoading(false);
          return;
        }

        try {
          const result = await registerUser({
            first_name: signupFirstName.trim(),
            middle_name: signupMiddleName.trim() || null,
            last_name: signupLastName.trim(),
            username: signupUsername.trim(),
            email: signupEmail.trim(),
            password: signupPassword,
            phone_number: toLocalPhilippinePhone(phoneValidation.sanitizedPhone),
            birthdate: signupBirthdate
          });

          console.log('Registration result:', result);

          if (result.success || result.message === 'Registration successful' || result.token) {

            if (typeof setIsLoggedIn === 'function') {
              setIsLoggedIn(true);
            }
            setIsAuthModalOpen(false);

            setSignupFirstName('');
            setSignupMiddleName('');
            setSignupLastName('');
            setSignupUsername('');
            setSignupEmail('');
            setSignupPassword('');
            setSignupConfirmPassword('');
            setSignupPhone('');
            setSignupBirthdate('');
            navigate('/user-home', { replace: true });
          } else {
            const errorMessage = result.message || 'Registration failed';
            setAuthError(errorMessage);
          }
        } catch (regError) {
          console.error('Registration error:', regError);
          const errorMessage = regError.message || 'An error occurred during registration';
          setAuthError(errorMessage);
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'An unexpected error occurred. Please try again.';
      setAuthError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError('');
    setIsGoogleLoading(true);

    try {
      const authUrl = await getGoogleAuthUrl();
      if (!authUrl) {
        throw new Error('Google authorization URL was not returned by the server.');
      }

      window.location.assign(authUrl);
    } catch (error) {
      console.error('Google login error:', error);
      setAuthError(error.response?.data?.message || error.message || 'Unable to start Google sign-in. Please try again.');
      setIsGoogleLoading(false);
    }
  };

  const services = [
    {
      name: 'Customize',
      img: customizeBg,
      description: 'Personalized details and premium fittings for your signature look.'
    },
    {
      name: 'Repair',
      img: repairBg,
      description: 'Precision repair with careful restoration and finishing touches.'
    },
    {
      name: 'Dry Cleaning',
      img: dryCleanBg,
      description: 'Professional care to keep garments crisp, clean, and event ready.'
    },
  ];

  if (location.pathname === '/user-home' && !getToken()) {
    return <Navigate to="/" replace />;
  }

  const isGuest = !getToken();

  return (
    <>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Montserrat:wght@300;400;500;600;700&display=swap');

          @keyframes heroFadeIn {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }

          @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }

          @keyframes shimmer {
            0% { background-position: -200% center; }
            100% { background-position: 200% center; }
          }

          @keyframes marquee {
            from { transform: translateX(100%); }
            to { transform: translateX(-100%); }
          }
        `}
      </style>

      <div className="dj-custom-cursor" style={{ left: cursorPos.x, top: cursorPos.y }} aria-hidden="true" />

      <header className={`header dj-header ${isScrolled ? 'dj-header-scrolled' : ''}`}>
        <div className="logo">
          <img src={logo} alt="D'Jackman Tailor Deluxe logo" className="dj-logo-image" />
          <div className="dj-logo-content">
            <span className="logo-text">D&apos;JACKMAN</span>
            <span className="dj-logo-subtitle">Tailor Deluxe</span>
          </div>
        </div>

        <nav className="nav dj-nav">
          <a className={`dj-nav-link ${activeSection === 'top' ? 'active' : ''}`} href="#top">Home</a>
          <a className={`dj-nav-link ${activeSection === 'Appointment' ? 'active' : ''}`} href="#Appointment">Appointment</a>
          <a className={`dj-nav-link ${activeSection === 'Rentals' ? 'active' : ''}`} href="#Rentals">Rental</a>
          <a className={`dj-nav-link ${activeSection === 'Customize' ? 'active' : ''}`} href="#Customize">Customize</a>
          <a className={`dj-nav-link ${activeSection === 'Repair' ? 'active' : ''}`} href="#Repair">Repair</a>
          <a className={`dj-nav-link ${activeSection === 'DryCleaning' ? 'active' : ''}`} href="#DryCleaning">Dry Cleaning</a>
        </nav>

        {isGuest ? (
          <button type="button" className="login-btn dj-login-btn" onClick={openAuthModal}>
            Login
          </button>
        ) : (
          <div className="dj-header-user-actions" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <button className="notif-button icon-button" type="button" onClick={() => setNotificationsOpen(!notificationsOpen)} aria-label="Notifications">
              <svg width="24" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 3a6 6 0 0 1 6 6v4l2 2H4l2-2V9a6 6 0 0 1 6-6z" stroke="#8B4513" strokeWidth="2" fill="none"/><circle cx="12" cy="20" r="2" fill="#8B4513"/></svg>
              {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
            </button>
            {notificationsOpen && (
              <div className="notification-dropdown-overlay" onClick={() => setNotificationsOpen(false)}>
                <div className="notification-dropdown" onClick={(e) => e.stopPropagation()}>
                  <div className="notification-header">
                    <h3>Notifications</h3>
                    {unreadCount > 0 && (
                      <button type="button" className="mark-all-read-btn" onClick={handleMarkAllAsRead}>
                        Mark all as read
                      </button>
                    )}
                    <button type="button" className="notification-close-btn" onClick={() => setNotificationsOpen(false)}>×</button>
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
            <button className="cart-button icon-button" type="button" onClick={() => setCartOpen(true)} aria-label="Cart">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M6 6h14l-2 9H8L6 6z" stroke="#8B4513" strokeWidth="2" fill="none"/><circle cx="9" cy="20" r="2" fill="#8B4513"/><circle cx="17" cy="20" r="2" fill="#8B4513"/></svg>
              {cartItemCount > 0 && <span className="cart-badge">{cartItemCount}</span>}
            </button>
            <button className="profile-button icon-button" type="button" onClick={() => setProfileDropdownOpen(!profileDropdownOpen)} aria-label="Profile">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="#8B4513" strokeWidth="2" fill="none"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke="#8B4513" strokeWidth="2" fill="none"/></svg>
            </button>
            <div className="profile-dropdown">
              {profileDropdownOpen && (
                <div className="dropdown-menu">
                  <button type="button" className="dropdown-item" onClick={() => {
                    setProfileDropdownOpen(false);
                    navigate('/profile');
                  }}>
                    My Profile
                  </button>
                  <button type="button" className="dropdown-item" onClick={() => {
                    setProfileDropdownOpen(false);
                    setServiceModalOpen(true);
                  }}>
                    Book Services
                  </button>
                  <button type="button" className="dropdown-item logout-item" onClick={() => {
                    setProfileDropdownOpen(false);
                    handleLogout();
                  }}>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </header>
      <section className="hero dj-hero" id="top" style={{ backgroundImage: `url(${heroBg})` }}>
        <div className="hero-overlay dj-hero-overlay"></div>
        <div className="dj-hero-grain"></div>
        <span className="dj-hero-line left"></span>
        <span className="dj-hero-line right"></span>
        <div className="hero-content dj-hero-content">
          <p className="dj-hero-label">✦ ESTABLISHED IN EXCELLENCE ✦</p>
          <h1 className="dj-hero-title">Welcome to</h1>
          <h2 className="dj-hero-shimmer">D&apos;jackman Tailor Deluxe</h2>
          <p className="dj-hero-subtitle">Your Perfect Fit Awaits.</p>
          <div className="dj-hero-actions">
            <button className="dj-primary-btn" onClick={() => setServiceModalOpen(true)}>Book Appointment</button>
            <a className="dj-outline-btn" href="#jackman-s-services">Our Services</a>
          </div>
        </div>
        <div className="dj-scroll-indicator" aria-hidden="true">
          <span></span>
        </div>
      </section>

      <div className="dj-marquee">
        <div className="dj-marquee-track">
          <span>✦ BESPOKE TAILORING · PREMIUM RENTAL · DRY CLEANING · EXPERT REPAIR</span>
          <span>✦ BESPOKE TAILORING · PREMIUM RENTAL · DRY CLEANING · EXPERT REPAIR</span>
        </div>
      </div>

      <section className="services fade-in-up dj-services" id="jackman-s-services">
        <p className="dj-section-label">Our Expertise</p>
        <h2 className="fade-in-up">Jackman&apos;s Services</h2>
        <span className="dj-divider"></span>
        <div className="services-grid stagger-children">
          {services.map(({ name, img, description }, index) => (
            <div
              key={name}
              className="service-card glow-on-hover dj-service-card"
              onMouseEnter={() => setHoveredService(index)}
              onMouseLeave={() => setHoveredService(null)}
            >
              <div
                className="service-img"
                style={{ backgroundImage: `url(${img})` }}
              ></div>
              <div className="dj-service-gradient"></div>
              <div className="service-footer">
                <h3>{name}</h3>
                <span className={`dj-service-line ${hoveredService === index ? 'expand' : ''}`}></span>
                <p className={`dj-service-desc ${hoveredService === index ? 'show' : ''}`}>{description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="appointment fade-in-up dj-appointment" id="Appointment">
        <div className="dj-appointment-ring dj-appointment-ring-one"></div>
        <div className="dj-appointment-ring dj-appointment-ring-two"></div>

        <div className="dj-appointment-layout">
          <div className="dj-appointment-left">
            <p className="dj-section-label">Book a Session</p>
            <h2>Ready to experience our services?</h2>
            <span className="dj-divider"></span>
            <p>
              Book your appointment today and step into a world of precision craftsmanship and bespoke luxury.
            </p>
            <button className="dj-primary-btn" onClick={() => setServiceModalOpen(true)}>Book Appointment</button>
          </div>

          <div className="dj-appointment-right">
            <p className="dj-appointment-quote">&quot;Crafting perfection, one stitch at a time.&quot;</p>
            <ul>
              {APPOINTMENT_STEPS.map((step, index) => (
                <li key={step}>
                  <span>{index + 1}</span>
                  <p>{step}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <RentalClothes
        openAuthModal={isGuest ? openAuthModal : () => setServiceModalOpen(true)}
        isGuest={isGuest}
      />

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
              color: "#FFFFFF",
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
            <button className="custom-book glow-on-hover" onClick={() => (isGuest ? openAuthModal() : setCustomizationFormModalOpen(true))} style={{ 
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
            <button className="repair-book glow-on-hover" onClick={() => (isGuest ? openAuthModal() : setRepairFormModalOpen(true))}>Book Repair!</button>
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
            <button className="clean-book glow-on-hover" onClick={() => (isGuest ? openAuthModal() : setDryCleaningFormModalOpen(true))} style={{ 
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
          }}>dry cleaning service</h2>
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
            opacity: 0.95 
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
                <button className="service-card-btn service-card-customize" onClick={() => { setServiceModalOpen(false); isGuest ? openAuthModal() : addServiceToCart('Customize'); }}>
                  <div className="service-card-icon"><PiTShirtBold size={28} /></div>
                  <div className="service-card-text">
                    <span className="service-card-title">Customize Service</span>
                    <span className="service-card-desc">Tailor-made designs just for you</span>
                  </div>
                  <div className="service-card-chevron"><FiChevronRight size={22} /></div>
                </button>
                <button className="service-card-btn service-card-repair" onClick={() => { setServiceModalOpen(false); isGuest ? openAuthModal() : addServiceToCart('Repair'); }}>
                  <div className="service-card-icon"><FiScissors size={28} /></div>
                  <div className="service-card-text">
                    <span className="service-card-title">Repair Service</span>
                    <span className="service-card-desc">Expert restoration &amp; stitching</span>
                  </div>
                  <div className="service-card-chevron"><FiChevronRight size={22} /></div>
                </button>
                <button className="service-card-btn service-card-drycleaning" onClick={() => { setServiceModalOpen(false); isGuest ? openAuthModal() : addServiceToCart('Dry Cleaning'); }}>
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

{isGuest && isAuthModalOpen && (
  <div className="auth-modal-overlay" onClick={closeAuthModal}>
    <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
      <button className="auth-close" onClick={closeAuthModal}>
        x
      </button>

      <div className="auth-container">
        <div className="auth-header">
          <h2>{isLogin ? 'Welcome Back' : 'Create Your Account'}</h2>
          <p className="auth-subtitle">
            {isLogin
              ? 'Sign in to book appointments & rentals'
              : 'Join the Jackman Tailor Deluxe family'}
          </p>
        </div>
        <div className="auth-toggle">
          <button
            className={isLogin ? 'active' : ''}
            onClick={() => setIsLogin(true)}
          >
            Login
          </button>
          <button
            className={!isLogin ? 'active' : ''}
            onClick={() => setIsLogin(false)}
          >
            Sign Up
          </button>
        </div>
        <form className="auth-form" onSubmit={(e) => e.preventDefault()}>
          {!isLogin && (
            <>
              <div className="input-group">
                <label htmlFor="signup-first-name" className="input-label">First Name</label>
                <input
                  id="signup-first-name"
                  type="text"
                  placeholder="First Name"
                  required
                  autoComplete="given-name"
                  value={signupFirstName}
                  onChange={(e) => setSignupFirstName(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label htmlFor="signup-middle-name" className="input-label">Middle Name (Optional)</label>
                <input
                  id="signup-middle-name"
                  type="text"
                  placeholder="Middle Name (Optional)"
                  autoComplete="additional-name"
                  value={signupMiddleName}
                  onChange={(e) => setSignupMiddleName(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label htmlFor="signup-last-name" className="input-label">Last Name</label>
                <input
                  id="signup-last-name"
                  type="text"
                  placeholder="Last Name"
                  required
                  autoComplete="family-name"
                  value={signupLastName}
                  onChange={(e) => setSignupLastName(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label htmlFor="signup-username" className="input-label">Username</label>
                <input
                  id="signup-username"
                  type="text"
                  placeholder="Username"
                  required
                  autoComplete="username"
                  value={signupUsername}
                  onChange={(e) => setSignupUsername(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="input-group">
            {!isLogin && <label htmlFor="signup-email" className="input-label">Email Address</label>}
            <input
              id={isLogin ? undefined : 'signup-email'}
              type={isLogin ? "text" : "email"}
              placeholder={isLogin ? "Username" : "Email Address"}
              required
              autoComplete={isLogin ? "username" : "email"}
              value={isLogin ? loginUsername : signupEmail}
              onChange={(e) => (isLogin ? setLoginUsername(e.target.value) : setSignupEmail(e.target.value))}
            />
          </div>

          <div className="input-group">
            {!isLogin && <label htmlFor="signup-password" className="input-label">Password</label>}
            <div className="password-input-wrapper">
              <input
                id={isLogin ? undefined : 'signup-password'}
                type={isLogin ? (showLoginPassword ? 'text' : 'password') : (showSignupPassword ? 'text' : 'password')}
                className="has-password-toggle"
                placeholder="Password"
                required
                autoComplete={isLogin ? "current-password" : "new-password"}
                value={isLogin ? loginPassword : signupPassword}
                onChange={(e) => isLogin ? setLoginPassword(e.target.value) : setSignupPassword(e.target.value)}
              />
              {isLogin ? (
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowLoginPassword((prev) => !prev)}
                  aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                >
                  {showLoginPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              ) : (
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowSignupPassword((prev) => !prev)}
                  aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                >
                  {showSignupPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              )}
            </div>
            {!isLogin && signupPassword && (
              <div style={{
                fontSize: '11px',
                marginTop: '5px',
                padding: '8px',
                backgroundColor: '#f8f9fa',
                borderRadius: '4px',
                border: '1px solid #e0e0e0'
              }}>
                <strong>Password Requirements:</strong>
                <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px', listStyle: 'none' }}>
                  <li style={{ 
                    color: signupPassword.length >= 8 ? '#28a745' : signupPassword.length >= 6 ? '#fd7e14' : '#dc3545',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span style={{ fontSize: '14px' }}>
                      {signupPassword.length >= 8 ? 'OK' : signupPassword.length >= 6 ? '...' : 'x'}
                    </span>
                    Minimum 8 characters ({signupPassword.length}/8)
                  </li>
                  <li style={{ 
                    color: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(signupPassword) ? '#28a745' : '#dc3545',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span style={{ fontSize: '14px' }}>
                      {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(signupPassword) ? 'OK' : 'x'}
                    </span>
                    At least one special character (!@#$%^&* etc.)
                  </li>
                </ul>
              </div>
            )}
          </div>

          {!isLogin && (
            <>
              <div className="input-group">
                <label htmlFor="signup-confirm-password" className="input-label">Confirm Password</label>
                <input
                  id="signup-confirm-password"
                  type="password"
                  placeholder="Confirm Password"
                  required
                  autoComplete="new-password"
                  value={signupConfirmPassword}
                  onChange={(e) => setSignupConfirmPassword(e.target.value)}
                />
                {signupConfirmPassword && (
                  <div style={{
                    fontSize: '11px',
                    marginTop: '5px',
                    color: signupPassword === signupConfirmPassword ? '#28a745' : '#dc3545',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span style={{ fontSize: '14px' }}>
                      {signupPassword === signupConfirmPassword ? 'OK' : 'x'}
                    </span>
                    {signupPassword === signupConfirmPassword ? 'Passwords match' : 'Passwords do not match'}
                  </div>
                )}
              </div>
              <div className="input-group">
                <label htmlFor="signup-phone" className="input-label">Phone Number</label>
                <div className="phone-input-with-prefix">
                  <span className="phone-prefix">+63</span>
                  <input
                    id="signup-phone"
                    type="tel"
                    placeholder="9XXXXXXXXX"
                    required
                    autoComplete="tel"
                    inputMode="numeric"
                    maxLength={10}
                    pattern="9[0-9]{9}"
                    value={signupPhone}
                    onChange={(e) => setSignupPhone(sanitizePhilippinePhone(e.target.value))}
                  />
                </div>
                {signupPhone && !/^9\d{9}$/.test(sanitizePhilippinePhone(signupPhone)) && (
                  <div style={{
                    fontSize: '11px',
                    marginTop: '5px',
                    color: '#dc3545',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span style={{ fontSize: '14px' }}>x</span>
                    Use a valid PH mobile number (e.g. +63 9XXXXXXXXX).
                  </div>
                )}
              </div>
              <div className="input-group">
                <label htmlFor="signup-birthdate" className="input-label">Birthdate</label>
                <input
                  id="signup-birthdate"
                  type="date"
                  placeholder="Date of Birth"
                  required
                  value={signupBirthdate}
                  onChange={(e) => setSignupBirthdate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
            </>
          )}
          {isLogin && (
            <div className="auth-options">
              <label className="remember-me">
                <input type="checkbox" />
                <span>Remember me</span>
              </label>
              <a href="#" className="forgot-link" onClick={(e) => { e.preventDefault(); setIsAuthModalOpen(false); setIsForgotPasswordOpen(true); }}>Forgot Password?</a>
            </div>
          )}
          {authError && (
            <div className="auth-error" style={{ color: '#dc3545', fontSize: '14px', marginBottom: '16px', textAlign: 'center' }}>
              {authError}
            </div>
          )}
          {isLogin ? (
            <>
              <button
                type="submit"
                className="auth-submit auth-submit-login"
                onClick={handleLogin}
                disabled={isLoading || isGoogleLoading}
              >
                {isLoading ? 'Processing...' : 'Login Now'}
              </button>
              <div style={{ textAlign: 'center', color: '#888', margin: '10px 0 12px', fontSize: '13px' }}>or</div>
              <button
                type="button"
                className="auth-submit auth-google-btn"
                onClick={handleGoogleLogin}
                disabled={isLoading || isGoogleLoading}
              >
                <span className="auth-google-icon" aria-hidden="true">
                  <FcGoogle size={22} />
                </span>
                <span>{isGoogleLoading ? 'Redirecting to Google...' : 'Continue with Google'}</span>
              </button>
            </>
          ) : (
            <button
              type="submit"
              className="auth-submit"
              onClick={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : 'Create Account'}
            </button>
          )}
        </form>
        <div className={`auth-footer ${isLogin ? 'auth-footer-login' : ''}`}>
          <p>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <span onClick={() => setIsLogin(!isLogin)} className="toggle-link">
              {isLogin ? 'Sign Up Now' : 'Login Here'}
            </span>
          </p>
        </div>
      </div>
    </div>
  </div>
)}

{isGuest && isForgotPasswordOpen && (
  <ForgotPassword
    onClose={() => setIsForgotPasswordOpen(false)}
    onSuccess={() => {
      setIsForgotPasswordOpen(false);
      setIsAuthModalOpen(true);
      setIsLogin(true);
    }}
  />
)}

      <footer className="dj-footer">
        <div className="dj-footer-grain"></div>
        <div className="dj-footer-inner">
          <div>
            <div className="dj-footer-brand">
              <img src={logo} alt="D'Jackman Tailor Deluxe logo" className="dj-logo-image dj-logo-image-footer" />
              <div className="dj-logo-content">
                <span className="logo-text">D&apos;JACKMAN</span>
                <span className="dj-logo-subtitle">Tailor Deluxe</span>
              </div>
            </div>
            <p className="dj-footer-tagline">Crafting perfection with every stitch. Your trusted tailor for all occasions.</p>
          </div>

          <div>
            <h4>Our Store</h4>
            <p>D&apos;jackman Tailor Deluxe, 50 Rizal Street</p>
            <p>Mon - Sat</p>
            <p>8:30 AM - 4:30 PM</p>
          </div>

          <div>
            <h4>Customer Service</h4>
            <p>0917 7107959</p>
            <p>ronald_mares1981@gmail.com</p>
          </div>

          <div>
            <h4>Services</h4>
            <a href="#Customize">Customize</a>
            <a href="#Repair">Repair</a>
            <a href="#DryCleaning">Dry Cleaning</a>
            <a href="#Rentals">Rental</a>
          </div>
        </div>

        <div className="dj-footer-divider"></div>
        <div className="dj-footer-bottom">
          <p>© 2026 D&apos;Jackman Tailor Deluxe. All rights reserved.</p>
          <p>Your Perfect Fit Awaits.</p>
        </div>
      </footer>

    </>
  );
};

export default GuestHomePage;
