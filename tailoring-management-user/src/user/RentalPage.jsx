import React from 'react';
import { useNavigate } from 'react-router-dom';
import RentalClothes from './components/RentalClothes';
import '../styles/RentalPage.css';

const RentalPage = () => {
  const navigate = useNavigate();
  
  const isLoggedIn = () => {
    return localStorage.getItem('token') !== null;
  };

  const handleHomeClick = () => {
    if (isLoggedIn()) {
      navigate('/user-home');
    } else {
      navigate('/');
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
