import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Guesthome.css';
import '../styles/Transitions.css';
import { FiScissors, FiDroplet, FiChevronRight } from 'react-icons/fi';
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
import { loginUser, registerUser } from '../api/AuthApi';
import RentalClothes from './components/RentalClothes';
import ForgotPassword from '../components/auth/ForgotPassword';

const App = ({ setIsLoggedIn }) => {
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupFirstName, setSignupFirstName] = useState('');
  const [signupLastName, setSignupLastName] = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const scrollObserver = initScrollAnimations();
    const headerCleanup = initHeaderScroll();

    return () => {
      if (scrollObserver) scrollObserver.disconnect();
      if (headerCleanup) headerCleanup();
    };
  }, []);

  const openAuthModal = () => {
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const navigate = useNavigate();

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
          if (userRole === 'admin') {
            navigate('/admin', { replace: true });
          } else {
            navigate('/user-home', { replace: true });
          }
        } else {
          const errorMessage = result.message || 'Login failed';
          setAuthError(errorMessage);
        }
      } else {

        if (!signupFirstName || !signupLastName || !signupUsername || !signupEmail || !signupPassword) {
          setAuthError('Please fill in all required fields');
          setIsLoading(false);
          return;
        }

        if (signupPassword !== signupConfirmPassword) {
          setAuthError('Passwords do not match');
          setIsLoading(false);
          return;
        }

        const passwordValidation = validatePassword(signupPassword);
        if (!passwordValidation.isValid) {
          setAuthError(passwordValidation.message);
          setIsLoading(false);
          return;
        }

        try {
          const result = await registerUser({
            first_name: signupFirstName.trim(),
            last_name: signupLastName.trim(),
            username: signupUsername.trim(),
            email: signupEmail.trim(),
            password: signupPassword,
            phone_number: signupPhone ? signupPhone.trim() : ''
          });

          console.log('Registration result:', result);

          if (result.success || result.message === 'Registration successful' || result.token) {

            if (typeof setIsLoggedIn === 'function') {
              setIsLoggedIn(true);
            }
            setIsAuthModalOpen(false);

            setSignupFirstName('');
            setSignupLastName('');
            setSignupUsername('');
            setSignupEmail('');
            setSignupPassword('');
            setSignupConfirmPassword('');
            setSignupPhone('');
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

  const services = [
    { name: 'Customize', img: customizeBg },
    { name: 'Repair', img: repairBg },
    { name: 'Dry Cleaning', img: dryCleanBg },
  ];

  return (
    <>
      <header className="header">
        <div className="logo">
          <img
            src={logo}
            alt="Logo - Click to Login"
            className="logo-img clickable"
            onClick={openAuthModal}
            style={{ cursor: 'pointer' }}
            title="Click to Login/Sign Up"
          />
          <span className="logo-text">D'jackman Tailor Deluxe</span>
        </div>

        <nav className="nav">
          <a href="#top">Home</a>
          <a href="#Appointment">Appointment</a>
          <a href="#Rentals">Rental</a>
          <a href="#Customize">Customize</a>
          <a href="#Repair">Repair</a>
          <a href="#DryCleaning">Dry Cleaning</a>
        </nav>
          <button className="login-btn" onClick={openAuthModal}>
          Login
        </button>

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
      <section className="appointment fade-in-up" id="Appointment">
        <h2 className="fade-in-up">Appointment</h2>
        <div className="appointment-content scale-in">
          <img src={appointmentBg} alt="Tailor" className="appointment-img" />
          <div className="appointment-overlay">
            <h3 className="fade-in-up">Ready to experience our services?</h3>
            <p className="fade-in-up">Book your appointment now!</p>
            <button className="btn-book glow-on-hover" onClick={() => setServiceModalOpen(true)}>Book Appointment</button>
          </div>
        </div>
      </section>
      <RentalClothes openAuthModal={openAuthModal} isGuest={true} />

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
            <button className="custom-book glow-on-hover" onClick={openAuthModal} style={{ 
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
            <button className="repair-book glow-on-hover" onClick={openAuthModal}>Book Repair!</button>
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
            <button className="clean-book glow-on-hover" onClick={openAuthModal} style={{ 
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
          <style jsx>{`
            .clean-text h2::after {
              content: '';
              position: absolute;
              right: 0;
              bottom: -10px;
              width: 60px;
              height: 3px;
              background: linear-gradient(90deg, #8B4513 0%, #f0e9e2 100%);
              border-radius: 2px;
            }
          `}</style>
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
                <button className="service-card-btn service-card-customize" onClick={() => { setServiceModalOpen(false); openAuthModal(); }}>
                  <div className="service-card-icon"><PiTShirtBold size={28} /></div>
                  <div className="service-card-text">
                    <span className="service-card-title">Customize Service</span>
                    <span className="service-card-desc">Tailor-made designs just for you</span>
                  </div>
                  <div className="service-card-chevron"><FiChevronRight size={22} /></div>
                </button>
                <button className="service-card-btn service-card-repair" onClick={() => { setServiceModalOpen(false); openAuthModal(); }}>
                  <div className="service-card-icon"><FiScissors size={28} /></div>
                  <div className="service-card-text">
                    <span className="service-card-title">Repair Service</span>
                    <span className="service-card-desc">Expert restoration &amp; stitching</span>
                  </div>
                  <div className="service-card-chevron"><FiChevronRight size={22} /></div>
                </button>
                <button className="service-card-btn service-card-drycleaning" onClick={() => { setServiceModalOpen(false); openAuthModal(); }}>
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
{isAuthModalOpen && (
  <div className="auth-modal-overlay" onClick={closeAuthModal}>
    <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
      <button className="auth-close" onClick={closeAuthModal}>
        ×
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
                <input
                  type="text"
                  placeholder="First Name"
                  required
                  autoComplete="given-name"
                  value={signupFirstName}
                  onChange={(e) => setSignupFirstName(e.target.value)}
                />
              </div>
              <div className="input-group">
                <input
                  type="text"
                  placeholder="Last Name"
                  required
                  autoComplete="family-name"
                  value={signupLastName}
                  onChange={(e) => setSignupLastName(e.target.value)}
                />
              </div>
              <div className="input-group">
                <input
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
            <input
              type={isLogin ? "text" : "email"}
              placeholder={isLogin ? "Username" : "Email Address"}
              required
              autoComplete={isLogin ? "username" : "email"}
              value={isLogin ? loginUsername : signupEmail}
              onChange={(e) => (isLogin ? setLoginUsername(e.target.value) : setSignupEmail(e.target.value))}
            />
          </div>

          <div className="input-group">
            <input
              type="password"
              placeholder="Password"
              required
              autoComplete={isLogin ? "current-password" : "new-password"}
              value={isLogin ? loginPassword : signupPassword}
              onChange={(e) => isLogin ? setLoginPassword(e.target.value) : setSignupPassword(e.target.value)}
            />
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
                      {signupPassword.length >= 8 ? '✓' : signupPassword.length >= 6 ? '◐' : '✗'}
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
                      {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(signupPassword) ? '✓' : '✗'}
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
                <input
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
                      {signupPassword === signupConfirmPassword ? '✓' : '✗'}
                    </span>
                    {signupPassword === signupConfirmPassword ? 'Passwords match' : 'Passwords do not match'}
                  </div>
                )}
              </div>
              <div className="input-group">
                <input
                  type="tel"
                  placeholder="Phone Number (Optional)"
                  autoComplete="tel"
                  value={signupPhone}
                  onChange={(e) => setSignupPhone(e.target.value)}
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
          <button type="submit" className="auth-submit" onClick={handleLogin} disabled={isLoading}>
            {isLoading ? 'Processing...' : (isLogin ? 'Login Now' : 'Create Account')}
          </button>
        </form>
        <div className="auth-footer">
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

{isForgotPasswordOpen && (
  <ForgotPassword
    onClose={() => setIsForgotPasswordOpen(false)}
    onSuccess={() => {
      setIsForgotPasswordOpen(false);
      setIsAuthModalOpen(true);
      setIsLogin(true);
    }}
  />
)}

      <footer style={{
        backgroundColor: "#a76648ff",
        color: "#f0e9e2",
        padding: "15px 20px 10px",
      }}>
        <div style={{
          maxWidth: "1200px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "40px",
          textAlign: "center",
          marginTop: "20px"
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

export default App;