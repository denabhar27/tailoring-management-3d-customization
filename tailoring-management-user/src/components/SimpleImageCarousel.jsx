import React, { useState } from 'react';

const SimpleImageCarousel = ({ images, itemName, height = '250px' }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const validImages = (images || []).filter(img => img && img.url);

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
      <div style={{ width: '100%', textAlign: 'center' }}>
        <img
          src={validImages[0].url}
          alt={itemName || 'Image'}
          style={{
            maxWidth: '100%',
            maxHeight: height,
            objectFit: 'contain',
            borderRadius: '8px'
          }}
        />
      </div>
    );
  }

  const goToPrev = () => {
    setCurrentIndex(prev => (prev === 0 ? validImages.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex(prev => (prev === validImages.length - 1 ? 0 : prev + 1));
  };

  return (
    <div style={{ width: '100%' }}>
      <div style={{
        position: 'relative',
        width: '100%',
        backgroundColor: '#f9f9f9',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: height
        }}>
          <img
            src={validImages[currentIndex].url}
            alt={`${itemName || 'Image'} - ${validImages[currentIndex].label || ''}`}
            style={{
              maxWidth: '100%',
              maxHeight: height,
              objectFit: 'contain'
            }}
          />
        </div>
        <div style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          backgroundColor: 'rgba(0,0,0,0.6)',
          color: 'white',
          padding: '4px 10px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: '500'
        }}>
          {validImages[currentIndex].label || `${currentIndex + 1}/${validImages.length}`}
        </div>
        <button
          onClick={goToPrev}
          style={{
            position: 'absolute',
            left: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: 'rgba(255,255,255,0.9)',
            color: '#333',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
        >
          ‹
        </button>
        <button
          onClick={goToNext}
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: 'rgba(255,255,255,0.9)',
            color: '#333',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
        >
          ›
        </button>
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '8px',
        marginTop: '10px'
      }}>
        {validImages.map((img, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            style={{
              width: '50px',
              height: '50px',
              padding: 0,
              border: index === currentIndex ? '2px solid #007bff' : '2px solid #ddd',
              borderRadius: '6px',
              overflow: 'hidden',
              cursor: 'pointer',
              opacity: index === currentIndex ? 1 : 0.6,
              transition: 'all 0.2s',
              backgroundColor: '#fff'
            }}
          >
            <img
              src={img.url}
              alt={img.label || `View ${index + 1}`}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          </button>
        ))}
      </div>
    </div>
  );
};

export default SimpleImageCarousel;
