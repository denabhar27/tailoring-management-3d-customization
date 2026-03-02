import React, { useState } from 'react';
import './SimpleImageCarousel.css';

const SimpleImageCarousel = ({ images, itemName, height = '280px' }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);

  const validImages = (images || []).filter(img => img && img.url);

  const openModal = () => setShowModal(true);
  const closeModal = () => setShowModal(false);

  const handleModalPrev = (e) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev === 0 ? validImages.length - 1 : prev - 1));
  };

  const handleModalNext = (e) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev === validImages.length - 1 ? 0 : prev + 1));
  };

  if (validImages.length === 0) {
    return (
      <div style={{
        width: '100%',
        height: height,
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#999'
      }}>
        <span>No Image Available</span>
      </div>
    );
  }

  if (validImages.length === 1) {
    return (
      <>
        <div 
          className="carousel-main-container carousel-clickable" 
          style={{ height: height }}
          onClick={openModal}
        >
          <img
            src={validImages[0].url}
            alt={itemName || 'Image'}
            className="carousel-main-image"
          />
          <div className="carousel-zoom-hint">Click to zoom</div>
        </div>

        {showModal && (
          <div className="carousel-modal-overlay" onClick={closeModal}>
            <div className="carousel-modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="carousel-modal-close" onClick={closeModal} type="button">×</button>
              <img
                src={validImages[0].url}
                alt={itemName || 'Image'}
                className="carousel-modal-image"
              />
            </div>
          </div>
        )}
      </>
    );
  }

  const goToPrev = (e) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev === 0 ? validImages.length - 1 : prev - 1));
  };

  const goToNext = (e) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev === validImages.length - 1 ? 0 : prev + 1));
  };

  return (
    <>
      <div className="simple-image-carousel">
        <div 
          className="carousel-main-container carousel-clickable" 
          style={{ height: height }}
          onClick={openModal}
        >
          <img
            src={validImages[currentIndex].url}
            alt={`${itemName || 'Image'} - ${validImages[currentIndex].label || ''}`}
            className="carousel-main-image"
          />
          <div className="carousel-zoom-hint">Click to zoom</div>
          <button
            onClick={goToPrev}
            type="button"
            className="carousel-nav-btn carousel-nav-prev"
          >
            ‹
          </button>
          <button
            onClick={goToNext}
            type="button"
            className="carousel-nav-btn carousel-nav-next"
          >
            ›
          </button>
        </div>
        <div className="carousel-thumbnails">
          {validImages.map((img, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              type="button"
              className={`carousel-thumbnail-btn ${index === currentIndex ? 'active' : ''}`}
            >
              <img
                src={img.url}
                alt={img.label || `View ${index + 1}`}
                className="carousel-thumbnail-img"
              />
            </button>
          ))}
        </div>
      </div>

      {showModal && (
        <div className="carousel-modal-overlay" onClick={closeModal}>
          <div className="carousel-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="carousel-modal-close" onClick={closeModal} type="button">×</button>
            <img
              src={validImages[currentIndex].url}
              alt={`${itemName || 'Image'} - ${validImages[currentIndex].label || ''}`}
              className="carousel-modal-image"
            />
            {validImages.length > 1 && (
              <>
                <button
                  onClick={handleModalPrev}
                  type="button"
                  className="carousel-modal-nav carousel-modal-prev"
                >
                  ‹
                </button>
                <button
                  onClick={handleModalNext}
                  type="button"
                  className="carousel-modal-nav carousel-modal-next"
                >
                  ›
                </button>
                <div className="carousel-modal-counter">
                  {currentIndex + 1} / {validImages.length}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default SimpleImageCarousel;
