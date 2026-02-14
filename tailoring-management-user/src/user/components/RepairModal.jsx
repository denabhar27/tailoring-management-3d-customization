import React, { useState, useEffect } from 'react';
import { 
  getAllRepairServices, 
  getRepairServicesByDamageLevel, 
  getPriceEstimate,
  uploadRepairImage,
  addRepairToCart
} from '../../api/RepairApi';
import '../../styles/RepairModal.css';

const RepairModal = ({ isOpen, onClose, onCartUpdate }) => {
  const [step, setStep] = useState(1); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [damageLevel, setDamageLevel] = useState('');
  const [selectedService, setSelectedService] = useState(null);
  const [damageDescription, setDamageDescription] = useState('');
  const [garmentType, setGarmentType] = useState('');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [estimatedPrice, setEstimatedPrice] = useState(0);

  const [services, setServices] = useState([]);
  const [priceEstimates, setPriceEstimates] = useState([]);

  const damageLevels = [
    { value: 'minor', label: 'Minor', description: 'Small tears, loose buttons, minor stains' },
    { value: 'moderate', label: 'Moderate', description: 'Medium tears, broken zippers, multiple issues' },
    { value: 'major', label: 'Major', description: 'Large tears, structural damage, extensive repairs' },
    { value: 'severe', label: 'Severe', description: 'Severe damage, complete reconstruction needed' }
  ];

  const garmentTypes = [
    'Shirt', 'Pants', 'Jacket', 'Coat', 'Dress', 'Skirt', 'Suit', 'Blouse', 'Sweater', 'Other'
  ];

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setStep(1);
    setDamageLevel('');
    setSelectedService(null);
    setDamageDescription('');
    setGarmentType('');
    setUploadedImage(null);
    setEstimatedPrice(0);
    setError('');
    setSuccess('');
  };

  const handleDamageLevelSelect = async (level) => {
    setLoading(true);
    setError('');
    
    try {
      
      const servicesResult = await getRepairServicesByDamageLevel(level);
      if (servicesResult.success) {
        setServices(servicesResult.data);
      }

      const priceResult = await getPriceEstimate(level);
      if (priceResult.success) {
        setPriceEstimates(priceResult.data);
        
        if (priceResult.data.length > 0) {
          setEstimatedPrice(parseFloat(priceResult.data[0].base_price));
        }
      }
      
      setDamageLevel(level);
      setStep(2);
    } catch (err) {
      setError('Failed to load repair services');
    } finally {
      setLoading(false);
    }
  };

  const handleServiceSelect = (service) => {
    setSelectedService(service);
    
    const basePrice = parseFloat(service.base_price);
    const adjustment = parseFloat(service.price_adjustment);
    const finalPrice = basePrice + adjustment;
    setEstimatedPrice(finalPrice);
    setStep(3);
  };

  const handleImageUpload = async (file) => {
    if (!file) return;

    setLoading(true);
    setError('');
    
    try {
      const result = await uploadRepairImage(file);
      if (result.success) {
        setUploadedImage(result.data);
        setSuccess('Image uploaded successfully');
      } else {
        setError(result.message || 'Failed to upload image');
      }
    } catch (err) {
      setError('Failed to upload image');
    } finally {
      setLoading(false);
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  const handleSubmitToCart = async () => {
    if (!selectedService || !damageDescription || !garmentType) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const repairData = {
        serviceId: selectedService.service_id,
        serviceName: selectedService.service_name,
        basePrice: selectedService.base_price,
        estimatedPrice: estimatedPrice.toString(),
        damageLevel: damageLevel,
        estimatedTime: selectedService.estimated_time,
        requiresImage: selectedService.requires_image,
        damageDescription: damageDescription,
        garmentType: garmentType,
        imageUrl: uploadedImage?.url || ''
      };

      const result = await addRepairToCart(repairData);
      
      if (result.success) {
        setSuccess('Repair service added to cart!');
        setTimeout(() => {
          onClose();
          if (onCartUpdate) onCartUpdate();
        }, 1500);
      } else {
        setError(result.message || 'Failed to add repair service to cart');
      }
    } catch (err) {
      setError('Failed to add repair service to cart');
    } finally {
      setLoading(false);
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  const formatPrice = (price) => {
    return `₱${parseFloat(price || 0).toFixed(2)}`;
  };

  if (!isOpen) return null;

  return (
    <div className="repair-modal-overlay" onClick={onClose}>
      <div className="repair-modal" onClick={(e) => e.stopPropagation()}>
        <div className="repair-modal-header">
          <h2>Repair Service</h2>
          <button className="repair-modal-close" onClick={onClose}>×</button>
        </div>

        {error && <div className="repair-error">{error}</div>}
        {success && <div className="repair-success">{success}</div>}

        <div className="repair-modal-content">
          {step === 1 && (
            <div className="repair-step">
              <h3>What's the damage level?</h3>
              <div className="damage-levels">
                {damageLevels.map((level) => (
                  <div
                    key={level.value}
                    className="damage-level-card"
                    onClick={() => handleDamageLevelSelect(level.value)}
                  >
                    <h4>{level.label}</h4>
                    <p>{level.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="repair-step">
              <h3>Select Repair Service</h3>
              <div className="services-list">
                {services.map((service) => (
                  <div
                    key={service.service_id}
                    className="service-card"
                    onClick={() => handleServiceSelect(service)}
                  >
                    <h4>{service.service_name}</h4>
                    <p>{service.description}</p>
                    <div className="service-info">
                      <span>Base: {formatPrice(service.base_price)}</span>
                      <span>Est. Time: {service.estimated_time || 'N/A'}</span>
                    </div>
                  </div>
                ))}
              </div>
              <button className="repair-back-btn" onClick={() => setStep(1)}>
                ← Back
              </button>
            </div>
          )}
          {step === 3 && (
            <div className="repair-step">
              <h3>Repair Details</h3>
              <div className="repair-form">
                <div className="form-group">
                  <label>Garment Type *</label>
                  <select
                    value={garmentType}
                    onChange={(e) => setGarmentType(e.target.value)}
                    required
                  >
                    <option value="">Select garment type</option>
                    {garmentTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Damage Description *</label>
                  <textarea
                    value={damageDescription}
                    onChange={(e) => setDamageDescription(e.target.value)}
                    placeholder="Please describe the damage in detail..."
                    rows={4}
                    required
                  />
                </div>

                {selectedService?.requires_image && (
                  <div className="form-group">
                    <label>Upload Photo of Damage *</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e.target.files[0])}
                    />
                    {uploadedImage && (
                      <div className="uploaded-preview">
                        <img src={`http://localhost:5000${uploadedImage.url}`} alt="Preview" />
                      </div>
                    )}
                  </div>
                )}

                <div className="repair-form-actions">
                  <button className="repair-back-btn" onClick={() => setStep(2)}>
                    ← Back
                  </button>
                  <button
                    className="repair-next-btn"
                    onClick={() => setStep(4)}
                    disabled={!garmentType || !damageDescription}
                  >
                    Review Request →
                  </button>
                </div>
              </div>
            </div>
          )}
          {step === 4 && (
            <div className="repair-step">
              <h3>Review Your Repair Request</h3>
              <div className="repair-summary">
                <div className="summary-item">
                  <label>Service:</label>
                  <span>{selectedService?.service_name}</span>
                </div>
                <div className="summary-item">
                  <label>Damage Level:</label>
                  <span>{damageLevel}</span>
                </div>
                <div className="summary-item">
                  <label>Garment Type:</label>
                  <span>{garmentType}</span>
                </div>
                <div className="summary-item">
                  <label>Damage Description:</label>
                  <span>{damageDescription}</span>
                </div>
                {uploadedImage && (
                  <div className="summary-item">
                    <label>Damage Photo:</label>
                    <img src={`http://localhost:5000${uploadedImage.url}`} alt="Damage" className="summary-image" />
                  </div>
                )}
                <div className="summary-item price">
                  <label>Estimated Price:</label>
                  <span>{formatPrice(estimatedPrice)}</span>
                </div>
              </div>

              <div className="repair-form-actions">
                <button className="repair-back-btn" onClick={() => setStep(3)}>
                  ← Back
                </button>
                <button
                  className="repair-submit-btn"
                  onClick={handleSubmitToCart}
                  disabled={loading}
                >
                  {loading ? 'Adding to Cart...' : 'Add to Cart'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RepairModal;
