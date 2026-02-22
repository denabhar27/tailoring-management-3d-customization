import React from 'react';
import './ImagePreviewModal.css';

const ImagePreviewModal = ({ isOpen, imageUrl, altText, onClose }) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="image-preview-modal-overlay" onClick={handleBackdropClick}>
      <div className="image-preview-modal-content">
        <button className="image-preview-close-btn" onClick={onClose}>
          <span>&times;</span>
        </button>
        <div className="image-preview-container">
          <img
            src={imageUrl}
            alt={altText || 'Preview'}
            className="image-preview-full"
            onError={(e) => {
              e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="%23f0f0f0" width="400" height="300"/><text fill="%23999" font-family="Arial" font-size="16" x="50%" y="50%" text-anchor="middle" dy=".3em">Image not available</text></svg>';
            }}
          />
        </div>
        <p className="image-preview-caption">{altText || 'Image Preview'}</p>
      </div>
    </div>
  );
};

export default ImagePreviewModal;
