import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import RentalClothes from './components/RentalClothes';
import '../styles/RentalPage.css';

const RentalPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Check if user came from guest page via navigation state
  const isGuest = location.state?.isGuest ?? (localStorage.getItem('token') === null);

  const handleHomeClick = () => {
    if (isGuest) {
      navigate('/');
    } else {
      navigate('/user-home');
    }
  };

  const openAuthModal = () => {
 
    console.log('Rental action triggered');
  };

  return (
    <div className="rental-page">
      <div className="home-button-container">
        <button className="btn-home" onClick={handleHomeClick}>
          <span className="home-arrow">←</span> HOME
        </button>
      </div>
      <div className="rental-container">
        <RentalClothes openAuthModal={openAuthModal} showAll={true} />
      </div>
    </div>
  );
};

export default RentalPage;
