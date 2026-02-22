import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Guesthome.css';
import '../styles/Transitions.css';
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
          alert('Please fill in all required fields (First Name, Last Name, Username, Email, Password)');
          setIsLoading(false);
          return;
        }

        if (signupPassword !== signupConfirmPassword) {
          setAuthError('Passwords do not match');
          alert('Passwords do not match\n\nPassword Requirements:\n• Must be at least 8 characters (can be letters or numbers)\n• Must contain at least one special character (!@#$%^&* etc.)');
          setIsLoading(false);
          return;
        }

        const passwordValidation = validatePassword(signupPassword);
        if (!passwordValidation.isValid) {
          setAuthError(passwordValidation.message);
          alert(`Password Error: ${passwordValidation.message}\n\nPassword Requirements:\n• Must be at least 8 characters (can be letters or numbers)\n• Must contain at least one special character (!@#$%^&* etc.)`);
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
            alert(`Registration Failed: ${errorMessage}`);
          }
        } catch (regError) {
          console.error('Registration error:', regError);
          const errorMessage = regError.message || 'An error occurred during registration';
          setAuthError(errorMessage);
          alert(`Registration Error: ${errorMessage}`);
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'An unexpected error occurred. Please try again.';
      setAuthError(errorMessage);
      alert(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
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
      <RentalClothes openAuthModal={openAuthModal} />
      <section className="customization fade-in-up"
          id="Customize"
          style={{
            background: "(background: linear-gradient(to bottom, #fffff5 0%, #f0e9e2 100%))"
          }}
        >
        <div className="custom-text fade-in-left">
          <h2>Customization</h2>
          <p>Got a style in mind?</p>
          <p>Personalize it and turn your vision into reality!</p>
        </div>
        <div className="custom-image fade-in-right scale-in" style={{ backgroundImage: `url('/src/assets/background.jpg'), url(${customizeBg})` }}>
          <button className="btn-customize glow-on-hover" onClick={openAuthModal}>Customize now!</button>
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
      <section className="clean fade-in-up" id="DryCleaning">
        <h2 className="fade-in-up">Dry Cleaning Service</h2>
        <div className="clean-bg scale-in" style={{ backgroundImage: `url(${dryCleanBg})` }}>
          <div className="clean-overlay"></div>
          <div className="clean-content">
            <h3 className="fade-in-up">Keep your garments fresh and spotless</h3>
            <p className="fade-in-up">Premium care for suits, gowns, and more</p>
            <button className="clean-book glow-on-hover" onClick={openAuthModal}>Book Dry Cleaning</button>
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
                {services.map((s) => (
                  <button key={s.name} className="auth-submit" onClick={openAuthModal}>{s.name}</button>
                ))}
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
            {!isLogin && (
              <div style={{
                fontSize: '11px',
                color: '#666',
                marginTop: '5px',
                padding: '8px',
                backgroundColor: '#f8f9fa',
                borderRadius: '4px',
                border: '1px solid #e0e0e0'
              }}>
                <strong>Password Requirements:</strong>
                <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px' }}>
                  <li>Minimum 8 characters (can be letters or numbers)</li>
                  <li>At least one special character (!@#$%^&* etc.)</li>
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

    </>
  );
};

export default App;