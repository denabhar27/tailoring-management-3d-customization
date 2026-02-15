import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllRepairServices, getPriceEstimate, uploadRepairImage, addRepairToCart } from '../../api/RepairApi';
import { API_BASE_URL } from '../../api/config';
import repairBg from "../../assets/repair.png";

const RepairService = ({ openAuthModal, showAll = false }) => {
  const [repairServices, setRepairServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [damageLevel, setDamageLevel] = useState('');
  const [damageDescription, setDamageDescription] = useState('');
  const [damageLocation, setDamageLocation] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [estimatedPrice, setEstimatedPrice] = useState(0);
  const [cartMessage, setCartMessage] = useState('');
  const [addingToCart, setAddingToCart] = useState(false);
  const navigate = useNavigate();

  const fallbackServices = [
    { 
      service_id: 1, 
      service_name: 'Minor Stitch Repair', 
      description: 'Fix small tears and loose threads',
      base_price: '300.00',
      damage_level: 'minor',
      estimated_time: '2-3 days'
    },
    { 
      service_id: 2, 
      service_name: 'Zipper Repair', 
      description: 'Fix broken or stuck zippers',
      base_price: '500.00',
      damage_level: 'moderate',
      estimated_time: '3-4 days'
    },
    { 
      service_id: 3, 
      service_name: 'Major Tear Repair', 
      description: 'Fix large tears and structural damage',
      base_price: '800.00',
      damage_level: 'major',
      estimated_time: '5-7 days'
    },
  ];

  useEffect(() => {
    fetchRepairServices();
  }, []);

  const fetchRepairServices = async () => {
    try {
      const result = await getAllRepairServices();
      if (result.success && result.data.length > 0) {
        setRepairServices(result.data);
      } else {
        
        setRepairServices(fallbackServices);
        console.log('Using fallback repair services');
      }
    } catch (error) {
      console.error('Error fetching repair services:', error);
      
      setRepairServices(fallbackServices);
    } finally {
      setLoading(false);
    }
  };

  const calculateEstimatedPrice = (level, service) => {
    if (!level || !service) return 0;
    
    const basePrice = parseFloat(service.base_price || '0');
    let priceMultiplier = 1;

    switch (level) {
      case 'minor':
        priceMultiplier = 1.0;
        break;
      case 'moderate':
        priceMultiplier = 1.5;
        break;
      case 'major':
        priceMultiplier = 2.0;
        break;
      case 'severe':
        priceMultiplier = 3.0;
        break;
      default:
        priceMultiplier = 1.0;
    }
    
    return basePrice * priceMultiplier;
  };

  const openModal = (service) => {
    setSelectedService(service);
    setDamageLevel('');
    setDamageDescription('');
    setDamageLocation('');
    setPickupDate('');
    setUploadedImage(null);
    setEstimatedPrice(0);
    setCartMessage('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedService(null);
  };

  const handleImageUpload = async (file) => {
    if (!file) return;

    try {
      const result = await uploadRepairImage(file);
      if (result.success) {
        setUploadedImage(result.data);
        setCartMessage('✅ Image uploaded successfully');
      } else {
        setCartMessage(`❌ Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setCartMessage('❌ Failed to upload image');
    }
    
    setTimeout(() => setCartMessage(''), 3000);
  };

  const handleDamageLevelChange = (level) => {
    setDamageLevel(level);
    if (selectedService) {
      const price = calculateEstimatedPrice(level, selectedService);
      setEstimatedPrice(price);
    }
  };

  const handleAddToCart = async () => {
    if (!selectedService || !damageLevel || !damageDescription || !pickupDate) {
      setCartMessage('Please fill in all required fields');
      return;
    }

    setAddingToCart(true);
    setCartMessage('');

    try {
      const repairData = {
        serviceId: selectedService.service_id,
        serviceName: selectedService.service_name,
        basePrice: selectedService.base_price,
        estimatedPrice: estimatedPrice.toString(),
        damageLevel: damageLevel,
        damageDescription: damageDescription,
        damageLocation: damageLocation,
        pickupDate: pickupDate,
        imageUrl: uploadedImage?.url || '',
        estimatedTime: selectedService.estimated_time
      };

      const result = await addRepairToCart(repairData);
      
      if (result.success) {
        setCartMessage(`✅ ${selectedService.service_name} added to cart!`);
        
        setTimeout(() => {
          setIsModalOpen(false);
          setSelectedService(null);
          setDamageLevel('');
          setDamageDescription('');
          setDamageLocation('');
          setPickupDate('');
          setUploadedImage(null);
          setEstimatedPrice(0);
        }, 1500);
      } else {
        setCartMessage(`❌ Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Add to cart error:', error);
      setCartMessage('❌ Failed to add repair service to cart');
    } finally {
      setAddingToCart(false);
      setTimeout(() => setCartMessage(''), 3000);
    }
  };

  const formatPrice = (price) => {
    return `₱${parseFloat(price || 0).toFixed(2)}`;
  };

  if (loading) {
    return (
      <section className="repair" id="Repair">
        <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Repair Services</h2>
        </div>
        <div className="repair-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="repair-card loading">
              <div className="loading-placeholder"></div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const displayServices = showAll ? repairServices : repairServices.slice(0, 3);

  return (
    <>
      <section className="repair" id="Repair">
        <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Repair Services</h2>
        </div>
        
        <div className="repair-grid">
          {displayServices.map((service) => (
            <div key={service.service_id} className="repair-card">
              <div className="repair-image">
                <img src={repairBg} alt={service.service_name} />
              </div>
              <div className="repair-info">
                <h3>{service.service_name}</h3>
                <p>{service.description}</p>
                <div className="repair-details">
                  <span className="repair-time">⏱️ {service.estimated_time || '2-3 days'}</span>
                  <span className="repair-price">From {formatPrice(service.base_price)}</span>
                </div>
                <button 
                  className="btn-repair" 
                  onClick={() => openModal(service)}
                >
                  Get Repair Quote
                </button>
              </div>
            </div>
          ))}
        </div>
        {!showAll && repairServices.length > 3 && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            marginTop: '20px',
            marginBottom: '10px'
          }}>
            <span 
              onClick={() => navigate('/repairs')} 
              style={{ 
                color: '#888', 
                cursor: 'pointer', 
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.2s ease',
                padding: '10px 20px',
                borderRadius: '20px',
                backgroundColor: '#f5f5f5'
              }}
              onMouseEnter={(e) => {
                e.target.style.color = '#666';
                e.target.style.backgroundColor = '#e8e8e8';
              }}
              onMouseLeave={(e) => {
                e.target.style.color = '#888';
                e.target.style.backgroundColor = '#f5f5f5';
              }}
            >
              See more →
            </span>
          </div>
        )}
      </section>
      {isModalOpen && selectedService && (
        <div className="repair-modal-overlay" onClick={closeModal}>
          <div className="repair-modal" onClick={(e) => e.stopPropagation()}>
            <div className="repair-modal-header">
              <h2>Repair Service</h2>
              <button className="repair-modal-close" onClick={closeModal}>×</button>
            </div>

            <div className="repair-modal-content">
              <div className="service-summary">
                <h3>{selectedService.service_name}</h3>
                <p>{selectedService.description}</p>
                <span className="service-time">⏱️ {selectedService.estimated_time || '2-3 days'}</span>
              </div>

              <div className="repair-form">
                <div className="form-group">
                  <label>Damage Level *</label>
                  <select
                    value={damageLevel}
                    onChange={(e) => handleDamageLevelChange(e.target.value)}
                    required
                  >
                    <option value="">Select damage level</option>
                    <option value="minor">Minor - Small tears, loose threads</option>
                    <option value="moderate">Moderate - Broken zippers, medium tears</option>
                    <option value="major">Major - Large tears, structural damage</option>
                    <option value="severe">Severe - Complete reconstruction needed</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Damage Description *</label>
                  <textarea
                    value={damageDescription}
                    onChange={(e) => setDamageDescription(e.target.value)}
                    placeholder="Describe the damage (e.g., hole in sleeve, broken zipper, torn seam)..."
                    rows={3}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Damage Location *</label>
                  <input
                    type="text"
                    value={damageLocation}
                    onChange={(e) => setDamageLocation(e.target.value)}
                    placeholder="Where is the damage located? (e.g., left sleeve, back, collar)"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Upload Damage Photo *</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files[0]) {
                        handleImageUpload(e.target.files[0]);
                      }
                    }}
                    required
                  />
                  {uploadedImage && (
                    <div className="uploaded-image-preview">
                      <img src={`${API_BASE_URL}${uploadedImage.url}`} alt="Damage" />
                      <p>✅ Photo uploaded</p>
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label>Pickup Date *</label>
                  <input
                    type="date"
                    value={pickupDate}
                    onChange={(e) => setPickupDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
                {damageLevel && (
                  <div className="price-estimate">
                    <h4>Estimated Price: {formatPrice(estimatedPrice)}</h4>
                    <p>Final price will be confirmed after admin review</p>
                  </div>
                )}
              </div>
              {cartMessage && (
                <div className={`cart-message ${cartMessage.includes('✅') ? 'success' : 'error'}`}>
                  {cartMessage}
                </div>
              )}

              <div className="repair-modal-actions">
                <button className="btn-cancel" onClick={closeModal}>
                  Cancel
                </button>
                <button 
                  className="btn-add-cart" 
                  onClick={handleAddToCart}
                  disabled={!damageLevel || !damageDescription || !damageLocation || !pickupDate || !uploadedImage || addingToCart}
                >
                  {addingToCart ? 'Adding to Cart...' : `Add to Cart - ${formatPrice(estimatedPrice)}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RepairService;
