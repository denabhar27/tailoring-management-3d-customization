import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import RentalClothes from './components/RentalClothes';
import '../styles/RentalPage.css';

const RentalPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const openAuthModal = () => {

    console.log('Rental action triggered');
  };

  return (
    <div className="rental-page">
      <div className="home-button-container">
        <button
          onClick={() => navigate('/user-home')}
          className="btn-home"
        >
          <span className="home-arrow">←</span>
          <span>Home</span>
        </button>
      </div>
      <div className="rental-container">
        <RentalClothes openAuthModal={openAuthModal} showAll={true} />
      </div>
    </div>
  );
};

export default RentalPage;
