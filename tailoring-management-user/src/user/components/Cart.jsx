import React, { useState, useEffect } from 'react';
import '../../styles/Cart.css';
import { 
  getUserCart, 
  addToCart, 
  updateCartItem, 
  removeFromCart, 
  clearCart, 
  submitCart,
  getCartSummary
} from '../../api/CartApi';
import ImagePreviewModal from '../../components/ImagePreviewModal';
import { useAlert } from '../../context/AlertContext';
import { getRentalImageUrl } from '../../api/RentalApi';
import SimpleImageCarousel from '../../components/SimpleImageCarousel';
import { API_BASE_URL } from '../../api/config';

const Cart = ({ isOpen, onClose, onCartUpdate }) => {
  const { confirm } = useAlert();
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [summary, setSummary] = useState({ itemCount: 0, totalAmount: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [expandedDetails, setExpandedDetails] = useState(new Set()); 

  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [previewImageAlt, setPreviewImageAlt] = useState('');

  const [bundleModalOpen, setBundleModalOpen] = useState(false);
  const [bundleItems, setBundleItems] = useState([]);

  const [rentalDetailModalOpen, setRentalDetailModalOpen] = useState(false);
  const [selectedRentalItem, setSelectedRentalItem] = useState(null);

  const [bundleItemDetailOpen, setBundleItemDetailOpen] = useState(false);
  const [selectedBundleItem, setSelectedBundleItem] = useState(null);
  const [parentBundleData, setParentBundleData] = useState(null);

  const openImagePreview = (imageUrl, altText) => {
    setPreviewImageUrl(imageUrl);
    setPreviewImageAlt(altText || 'Cart Item Image');
    setImagePreviewOpen(true);
  };

  const closeImagePreview = () => {
    setImagePreviewOpen(false);
    setPreviewImageUrl('');
    setPreviewImageAlt('');
  };

  const openBundleModal = (items) => {
    setBundleItems(items);
    setBundleModalOpen(true);
  };

  const closeBundleModal = () => {
    setBundleModalOpen(false);
    setBundleItems([]);
    setParentBundleData(null);
  };

  const openRentalDetailModal = (item) => {
    setSelectedRentalItem(item);
    setRentalDetailModalOpen(true);
  };

  const closeRentalDetailModal = () => {
    setRentalDetailModalOpen(false);
    setSelectedRentalItem(null);
  };

  const openBundleModalWithData = (items, parentItem) => {
    setBundleItems(items);
    setParentBundleData(parentItem);
    setBundleModalOpen(true);
  };

  const openBundleItemDetail = (bundleItem) => {
    setSelectedBundleItem(bundleItem);
    setBundleItemDetailOpen(true);
  };

  const closeBundleItemDetail = () => {
    setBundleItemDetailOpen(false);
    setSelectedBundleItem(null);
  };

  useEffect(() => {
    if (isOpen) {
      loadCart();
      loadSummary();
      
      setSelectedItems([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (cartItems.length > 0 && selectedItems.length === 0) {
      
      setSelectedItems(cartItems.map(item => item.cart_id));
    }
  }, [cartItems]);

  const toggleItemSelection = (cartId) => {
    setSelectedItems(prev => 
      prev.includes(cartId) 
        ? prev.filter(id => id !== cartId)
        : [...prev, cartId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === cartItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(cartItems.map(item => item.cart_id));
    }
  };

  const toggleDetailsExpansion = (cartId) => {
    setExpandedDetails(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cartId)) {
        newSet.delete(cartId);
      } else {
        newSet.add(cartId);
      }
      return newSet;
    });
  };

  const loadCart = async () => {
    setLoading(true);
    setError('');
    
    try {
      const result = await getUserCart();
      if (result.success) {
        setCartItems(result.items || []);
      } else {
        setError(result.message || 'Error loading cart');
      }
    } catch (err) {
      setError('Failed to load cart');
      console.error('Load cart error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const result = await getCartSummary();
      if (result.success) {
        setSummary({
          itemCount: result.itemCount || 0,
          totalAmount: result.totalAmount || 0
        });
      }
    } catch (err) {
      console.error('Load summary error:', err);
    }
  };

  const handleRemoveItem = async (cartId) => {
    const confirmed = await confirm('Are you sure you want to remove this item?', 'Remove Item', 'warning');
    if (!confirmed) {
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const result = await removeFromCart(cartId);
      if (result.success) {
        setSuccess('Item removed from cart');
        await loadCart();
        await loadSummary();
        if (onCartUpdate) onCartUpdate();
      } else {
        setError(result.message || 'Error removing item');
      }
    } catch (err) {
      setError('Failed to remove item');
      console.error('Remove item error:', err);
    } finally {
      setLoading(false);
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  const handleUpdateQuantity = async (cartId, newQuantity) => {
    if (newQuantity < 1) return;

    setLoading(true);
    setError('');
    
    try {
      const result = await updateCartItem(cartId, { quantity: newQuantity });
      if (result.success) {
        await loadCart();
        await loadSummary();
        if (onCartUpdate) onCartUpdate();
      } else {
        setError(result.message || 'Error updating item');
      }
    } catch (err) {
      setError('Failed to update item');
      console.error('Update item error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitOrder = async () => {
    if (selectedItems.length === 0) {
      setError('Please select at least one item to submit');
      return;
    }

    const confirmed = await confirm(`Are you sure you want to submit ${selectedItems.length} selected item(s)?`, 'Submit Order', 'warning');
    if (!confirmed) {
      return;
    }

    setSubmitting(true);
    setError('');
    
    try {
      
      const result = await submitCart(orderNotes, selectedItems);
      if (result.success) {
        setSuccess('Order submitted successfully!');
        
        setCartItems(prev => prev.filter(item => !selectedItems.includes(item.cart_id)));
        setSelectedItems([]);
        await loadSummary();
        if (onCartUpdate) onCartUpdate();

        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setError(result.message || 'Error submitting order');
      }
    } catch (err) {
      setError('Failed to submit order');
      console.error('Submit order error:', err);
    } finally {
      setSubmitting(false);
      setTimeout(() => setSuccess(''), 5000);
    }
  };

  const handleClearCart = async () => {
    const confirmed = await confirm('Are you sure you want to clear your entire cart?', 'Clear Cart', 'warning');
    if (!confirmed) {
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const result = await clearCart();
      if (result.success) {
        setSuccess('Cart cleared successfully');
        setCartItems([]);
        setSummary({ itemCount: 0, totalAmount: 0 });
        if (onCartUpdate) onCartUpdate();
      } else {
        setError(result.message || 'Error clearing cart');
      }
    } catch (err) {
      setError('Failed to clear cart');
      console.error('Clear cart error:', err);
    } finally {
      setLoading(false);
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  const formatPrice = (price) => {
    return `â‚±${parseFloat(price || 0).toFixed(2)}`;
  };

  const formatDateTo12Hour = (dateString) => {
    if (!dateString || dateString === 'N/A') return dateString;
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return dateString;
    }
  };

  const getColorName = (hex) => {
    if (!hex) return 'Not specified';

    if (typeof hex === 'string' && !hex.startsWith('#') && !hex.match(/^[0-9a-fA-F]{3,6}$/)) {
      return hex.charAt(0).toUpperCase() + hex.slice(1);
    }

    let normalizedHex = String(hex).toLowerCase().trim();
    if (!normalizedHex.startsWith('#')) {
      normalizedHex = `#${normalizedHex}`;
    }

    const colorMap = {
      '#1a1a1a': 'Classic Black',
      '#1e3a5f': 'Navy Blue',
      '#6b1e3d': 'Burgundy',
      '#2d5a3d': 'Forest Green',
      '#4a4a4a': 'Charcoal Gray',
      '#c9a66b': 'Camel Tan',
      '#f5e6d3': 'Cream White',
      '#5d4037': 'Chocolate Brown',
      '#2a4d8f': 'Royal Blue',
      '#722f37': 'Wine Red',
      '#ffffff': 'White',
      '#000000': 'Black',
      '#ff0000': 'Red',
      '#00ff00': 'Green',
      '#0000ff': 'Blue',
      '#ffff00': 'Yellow',
      '#ff00ff': 'Magenta',
      '#00ffff': 'Cyan',
      '#808080': 'Gray',
      '#800000': 'Maroon',
      '#008000': 'Dark Green',
      '#000080': 'Navy',
      '#800080': 'Purple',
      '#ffa500': 'Orange',
      '#a52a2a': 'Brown',
      '#ffc0cb': 'Pink',
      '#ffd700': 'Gold',
      '#c0c0c0': 'Silver',
    };
    
    if (colorMap[normalizedHex]) {
      return colorMap[normalizedHex];
    }

    try {
      const r = parseInt(normalizedHex.slice(1, 3), 16);
      const g = parseInt(normalizedHex.slice(3, 5), 16);
      const b = parseInt(normalizedHex.slice(5, 7), 16);
      
      if (r > 200 && g > 200 && b > 200) return 'Light';
      if (r < 50 && g < 50 && b < 50) return 'Dark';
      if (r > g && r > b) return 'Reddish';
      if (g > r && g > b) return 'Greenish';
      if (b > r && b > g) return 'Bluish';
      if (r === g && g === b) return 'Gray';
    } catch (e) {
      
    }
    
    return normalizedHex;
  };

  const getButtonType = (modelPath) => {
    if (!modelPath) return '';
    const buttonMap = {
      '/orange button 3d model.glb': 'Orange Button',
      '/four hole button 3d model (1).glb': 'Four Hole Button',
    };
    return buttonMap[modelPath] || modelPath.split('/').pop().replace('.glb', '').replace(/\d+/g, '').trim();
  };

  const getAccessoryName = (modelPath) => {
    if (!modelPath) return '';
    const accessoryMap = {
      '/accessories/gold lion pendant 3d model.glb': 'Pendant',
      '/accessories/flower brooch 3d model.glb': 'Brooch',
      '/accessories/fabric rose 3d model.glb': 'Flower',
    };
    return accessoryMap[modelPath] || modelPath.split('/').pop().replace('.glb', '').replace(/\d+/g, '').trim();
  };

  const getServiceTypeDisplay = (serviceType) => {
    const types = {
      'rental': 'Rental',
      'dry_cleaning': 'Dry Cleaning',
      'repair': 'Repair',
      'customization': 'Customization'
    };
    return types[serviceType] || serviceType;
  };

  const renderSizeMeasurements = (sizeData) => {
    if (!sizeData) return null;

    let measurements = sizeData;
    if (typeof sizeData === 'string') {
      try {
        measurements = JSON.parse(sizeData);
      } catch (e) {
        
        return (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
            <span style={{ fontWeight: '500', color: '#666' }}>Size</span>
            <span style={{ fontWeight: '600', color: '#333' }}>{sizeData}</span>
          </div>
        );
      }
    }

    if (typeof measurements !== 'object' || measurements === null) {
      if (measurements && measurements !== 'Standard') {
        return (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
            <span style={{ fontWeight: '500', color: '#666' }}>Size</span>
            <span style={{ fontWeight: '600', color: '#333' }}>{measurements}</span>
          </div>
        );
      }
      return null;
    }

    const measurementLabels = {
      chest: 'Chest',
      shoulders: 'Shoulders',
      sleeveLength: 'Sleeve',
      sleeve_length: 'Sleeve',
      neck: 'Neck',
      waist: 'Waist',
      length: 'Length',
      hips: 'Hips',
      inseam: 'Inseam',
      thigh: 'Thigh',
      outseam: 'Outseam'
    };

    const measurementRows = [];
    for (const [key, value] of Object.entries(measurements)) {
      const label = measurementLabels[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
      
      if (value && typeof value === 'object') {
        
        const inch = value.inch || value.in || '0';
        const cm = value.cm || (parseFloat(inch) * 2.54).toFixed(2);
        measurementRows.push({ label, inch, cm });
      } else if (value && value !== '0' && value !== '') {
        
        const inch = value;
        const cm = (parseFloat(value) * 2.54).toFixed(2);
        measurementRows.push({ label, inch, cm });
      }
    }
    
    if (measurementRows.length === 0) return null;
    
    return (
      <div style={{ marginTop: '10px' }}>
        <p style={{ fontWeight: '600', color: '#333', marginBottom: '10px', textAlign: 'center' }}>Size:</p>
        <div style={{ 
          border: '1px solid #e0e0e0', 
          borderRadius: '8px', 
          overflow: 'hidden',
          backgroundColor: '#fff'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {measurementRows.map((row, index) => (
                <tr key={index} style={{ borderBottom: index < measurementRows.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                  <td style={{ 
                    padding: '10px 15px', 
                    fontWeight: '500', 
                    color: '#666',
                    width: '40%'
                  }}>
                    {row.label}:
                  </td>
                  <td style={{ 
                    padding: '10px 15px', 
                    color: '#8B4513',
                    textAlign: 'right'
                  }}>
                    {row.inch} in / {row.cm} cm
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="cart-overlay">
      <div className="cart-container">
        <div className="cart-header">
          <h2>Shopping Cart</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '14px' }}>
              <input
                type="checkbox"
                checked={selectedItems.length === cartItems.length && cartItems.length > 0}
                onChange={toggleSelectAll}
                style={{ cursor: 'pointer' }}
              />
              Select All
            </label>
            <button className="cart-close-btn" onClick={onClose}>Ã—</button>
          </div>
        </div>

        {error && <div className="cart-error">{error}</div>}
        {success && <div className="cart-success">{success}</div>}

        <div className="cart-content">
          {loading ? (
            <div className="cart-loading">Loading cart...</div>
          ) : cartItems.length === 0 ? (
            <div className="cart-empty">
              <p>Your cart is empty</p>
              <button className="cart-continue-btn" onClick={onClose}>
               Book a service
              </button>
            </div>
          ) : (
            <>
              <div className="cart-items">
                {cartItems.map((item) => {
                  
                  const isBundle = item.specific_data?.is_bundle || item.pricing_factors?.is_bundle;
                  const bundleItems = item.specific_data?.bundle_items || [];

                  const rentalImageUrl = item.service_type === 'rental' 
                    ? (item.specific_data?.image_url || (bundleItems.length > 0 ? bundleItems[0]?.image_url : null))
                    : null;

                  return (
                  <div 
                    key={item.cart_id} 
                    className="cart-item" 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      gap: '10px',
                      cursor: item.service_type === 'rental' ? 'pointer' : 'default'
                    }}
                    onClick={
                      item.service_type === 'rental' 
                        ? (isBundle ? () => openBundleModalWithData(bundleItems, item) : () => openRentalDetailModal(item))
                        : undefined
                    }
                  >
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(item.cart_id)}
                      onChange={() => toggleItemSelection(item.cart_id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ marginTop: '5px', cursor: 'pointer', width: '18px', height: '18px' }}
                    />
                    {item.service_type === 'rental' && rentalImageUrl && (
                      <div style={{ width: '80px', height: '80px', flexShrink: 0 }}>
                        <img 
                          src={rentalImageUrl} 
                          alt={item.specific_data?.item_name || 'Rental Item'}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            border: '1px solid #e0e0e0'
                          }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    
                    <div className="cart-item-info" style={{ flex: 1 }}>
                      <h4>{getServiceTypeDisplay(item.service_type)}</h4>
                      {isBundle && (
                        <p style={{ color: '#007bff', fontWeight: '500', marginBottom: '5px' }}>
                          Bundle ({bundleItems.length} items) - Click to view
                        </p>
                      )}
                      {item.service_type === 'rental' && !isBundle && (
                        <p style={{ color: '#007bff', fontWeight: '500', marginBottom: '5px' }}>
                          Click to view details
                        </p>
                      )}
                      <p>Service ID: {item.service_id}</p>
                      {item.service_type === 'rental' ? (
                        <>
                          <p>Rental Price: {formatPrice(item.final_price)}</p>
                          <p>Downpayment: {formatPrice(item.pricing_factors?.downpayment || item.specific_data?.downpayment || 0)}</p>
                        </>
                      ) : item.service_type === 'dry_cleaning' && item.specific_data?.isEstimatedPrice ? (
                        <p>Estimated Price: {formatPrice(item.final_price)}</p>
                      ) : item.service_type === 'dry_cleaning' ? (
                        <p>Final Price: {formatPrice(item.final_price)}</p>
                      ) : (
                        <p>Estimated Price: {formatPrice(item.final_price)}</p>
                      )}
                      {item.service_type === 'repair' && item.specific_data && (
                        <div className="repair-details">
                          {/* Check for multiple garments */}
                          {item.specific_data.garments && item.specific_data.garments.length > 0 ? (
                            <>
                              <p className="garments-header-cart">
                                <strong>{item.specific_data.garments.length} Garment{item.specific_data.garments.length > 1 ? 's' : ''}</strong>
                              </p>
                              {item.specific_data.garments.map((garment, idx) => (
                                <div key={idx} className="garment-item-cart">
                                  <p>â€¢ {garment.garmentType} ({garment.damageLevel}): â‚±{garment.basePrice}</p>
                                  {garment.notes && <p className="garment-notes">  Notes: {garment.notes}</p>}
                                </div>
                              ))}
                            </>
                          ) : (
                            <>
                              <p>Damage Level: {item.specific_data.damageLevel || 'N/A'}</p>
                              <p>Garment: {item.specific_data.garmentType || 'N/A'}</p>
                              <p>Description: {item.specific_data.damageDescription || 'N/A'}</p>
                            </>
                          )}
                          <p>Drop off preferred date: {formatDateTo12Hour(item.specific_data.pickupDate) || 'N/A'}</p>
                          {item.specific_data.imageUrl && item.specific_data.imageUrl !== 'no-image' && (
                            <div className="cart-item-image">
                              <img 
                                src={`${API_BASE_URL}${item.specific_data.imageUrl}`} 
                                alt="Damage preview" 
                                className="cart-damage-photo clickable-image"
                                onClick={() => openImagePreview(`${API_BASE_URL}${item.specific_data.imageUrl}`, 'Damage Photo')}
                                title="Click to enlarge"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                              <small>Damage photo uploaded</small>
                            </div>
                          )}
                        </div>
                      )}
                      {item.service_type === 'dry_cleaning' && item.specific_data && (
                        <div className="drycleaning-details">
                          {/* Check for multiple garments */}
                          {item.specific_data.garments && item.specific_data.garments.length > 0 ? (
                            <>
                              <p className="garments-header-cart">
                                <strong>{item.specific_data.garments.length} Garment{item.specific_data.garments.length > 1 ? 's' : ''}</strong>
                              </p>
                              {item.specific_data.garments.map((garment, idx) => (
                                <div key={idx} className="garment-item-cart">
                                  <p>â€¢ {garment.garmentType} ({garment.brand}) Ã— {garment.quantity}: â‚±{garment.pricePerItem * garment.quantity}</p>
                                </div>
                              ))}
                            </>
                          ) : (
                            <>
                              {item.specific_data.garmentType && (
                                <p>Garment Type: {item.specific_data.garmentType.charAt(0).toUpperCase() + item.specific_data.garmentType.slice(1)}</p>
                              )}
                              <p>Brand: {item.specific_data.brand || 'N/A'}</p>
                              <p>Quantity: {item.specific_data.quantity || 'N/A'} items</p>
                              {item.specific_data.pricePerItem && (
                                <p>Price per item: â‚±{parseFloat(item.specific_data.pricePerItem).toFixed(2)}</p>
                              )}
                            </>
                          )}
                          <p>Drop off date: {formatDateTo12Hour(item.specific_data.pickupDate) || 'N/A'}</p>
                          {item.specific_data.imageUrl && item.specific_data.imageUrl !== 'no-image' && (
                            <div className="cart-item-image">
                              <img 
                                src={`${API_BASE_URL}${item.specific_data.imageUrl}`} 
                                alt="Clothing preview" 
                                className="cart-damage-photo clickable-image"
                                onClick={() => openImagePreview(`${API_BASE_URL}${item.specific_data.imageUrl}`, 'Clothing Photo')}
                                title="Click to enlarge"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                              <small>Clothing photo uploaded</small>
                            </div>
                          )}
                        </div>
                      )}
                      {item.service_type === 'customization' && item.specific_data && (
                        <div className="customization-details">
                          <p>Garment Type: {item.specific_data.garmentType || 'N/A'}</p>
                          <p>Fabric Type: {item.specific_data.fabricType || 'N/A'}</p>
                          <p>Preferred Date & Time: {
                            item.specific_data.preferredDate && item.specific_data.preferredTime
                              ? formatDateTo12Hour(`${item.specific_data.preferredDate}T${item.specific_data.preferredTime}`)
                              : item.specific_data.preferredDate || 'N/A'
                          }</p>
                          {item.specific_data.notes && (
                            <p>Notes: {item.specific_data.notes}</p>
                          )}
                          {item.specific_data.designData?.angleImages && (
                            <div style={{ marginTop: '10px', marginBottom: '10px' }}>
                              <strong style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Design Views:</strong>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                                {['front', 'back', 'right', 'left'].map((angle) => (
                                  item.specific_data.designData.angleImages[angle] && (
                                    <div key={angle} style={{ position: 'relative' }}>
                                      <img 
                                        src={item.specific_data.designData.angleImages[angle]} 
                                        alt={`${angle} view`}
                                        className="clickable-image"
                                        onClick={() => openImagePreview(item.specific_data.designData.angleImages[angle], `${angle} view`)}
                                        style={{ 
                                          width: '100%', 
                                          height: 'auto', 
                                          borderRadius: '6px', 
                                          border: '2px solid #e0e0e0',
                                          cursor: 'pointer'
                                        }}
                                        onError={(e) => {
                                          e.target.style.display = 'none';
                                        }}
                                      />
                                      <div style={{ 
                                        position: 'absolute', 
                                        bottom: '4px', 
                                        left: '4px', 
                                        background: 'rgba(0,0,0,0.7)', 
                                        color: 'white', 
                                        padding: '2px 6px', 
                                        borderRadius: '3px',
                                        fontSize: '10px',
                                        textTransform: 'capitalize',
                                        fontWeight: 'bold'
                                      }}>
                                        {angle}
                                      </div>
                                    </div>
                                  )
                                ))}
                              </div>
                              <small style={{ display: 'block', fontSize: '11px', color: '#888', marginTop: '4px' }}>Click any image to enlarge</small>
                            </div>
                          )}
                          {!item.specific_data.designData?.angleImages && item.specific_data.imageUrl && item.specific_data.imageUrl !== 'no-image' && (
                            <div className="cart-item-image" style={{ marginTop: '10px' }}>
                              <img 
                                src={`${API_BASE_URL}${item.specific_data.imageUrl}`} 
                                alt="Design preview" 
                                className="cart-damage-photo clickable-image"
                                onClick={() => openImagePreview(`${API_BASE_URL}${item.specific_data.imageUrl}`, 'Design Preview')}
                                title="Click to enlarge"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                              <small>Design preview</small>
                            </div>
                          )}
                          {item.specific_data.designData && (
                            <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: expandedDetails.has(item.cart_id) ? '10px' : '0' }}>
                                <strong>3D Customization Details:</strong>
                                <button
                                  onClick={() => toggleDetailsExpansion(item.cart_id)}
                                  style={{
                                    padding: '3px 8px',
                                    fontSize: '11px',
                                    backgroundColor: '#007bff',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '3px',
                                    cursor: 'pointer',
                                    fontWeight: '400'
                                  }}
                                >
                                  {expandedDetails.has(item.cart_id) ? 'â–¼ Hide' : 'â–¶ Show'}
                                </button>
                              </div>
                              
                              {expandedDetails.has(item.cart_id) ? (
                                <div>
                                  {item.specific_data.designData.size && (
                                    <p style={{ margin: '5px 0', fontSize: '14px' }}>Size: {item.specific_data.designData.size.charAt(0).toUpperCase() + item.specific_data.designData.size.slice(1)}</p>
                                  )}
                                  {item.specific_data.designData.fit && (
                                    <p style={{ margin: '5px 0', fontSize: '14px' }}>Fit: {item.specific_data.designData.fit.charAt(0).toUpperCase() + item.specific_data.designData.fit.slice(1)}</p>
                                  )}
                                  {item.specific_data.designData.colors && item.specific_data.designData.colors.fabric && (
                                    <p style={{ margin: '5px 0', fontSize: '14px' }}>
                                      Color: {getColorName(item.specific_data.designData.colors.fabric)}
                                    </p>
                                  )}
                                  {item.specific_data.designData.pattern && item.specific_data.designData.pattern !== 'none' && (
                                    <p style={{ margin: '5px 0', fontSize: '14px' }}>Pattern: {item.specific_data.designData.pattern.charAt(0).toUpperCase() + item.specific_data.designData.pattern.slice(1)}</p>
                                  )}
                                  {item.specific_data.designData.personalization && item.specific_data.designData.personalization.initials && (
                                    <p style={{ margin: '5px 0', fontSize: '14px' }}>
                                      Personalization: {item.specific_data.designData.personalization.initials}
                                      {item.specific_data.designData.personalization.font && ` (${item.specific_data.designData.personalization.font} font)`}
                                    </p>
                                  )}
                                  {item.specific_data.designData.buttons && item.specific_data.designData.buttons.length > 0 && (
                                    <div style={{ marginTop: '5px' }}>
                                      <p style={{ margin: '5px 0', fontSize: '14px', fontWeight: 'bold' }}>Button Types:</p>
                                      {item.specific_data.designData.buttons.map((btn, index) => (
                                        <p key={btn.id || index} style={{ margin: '2px 0 2px 15px', fontSize: '13px' }}>
                                          Button {index + 1}: {getButtonType(btn.modelPath)}
                                        </p>
                                      ))}
                                    </div>
                                  )}
                                  {item.specific_data.designData.accessories && item.specific_data.designData.accessories.length > 0 && (
                                    <div style={{ marginTop: '5px' }}>
                                      <p style={{ margin: '5px 0', fontSize: '14px', fontWeight: 'bold' }}>Accessories:</p>
                                      {item.specific_data.designData.accessories.map((acc, index) => (
                                        <p key={acc.id || index} style={{ margin: '2px 0 2px 15px', fontSize: '13px' }}>
                                          {getAccessoryName(acc.modelPath)}
                                        </p>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p style={{ margin: '0', fontSize: '13px', color: '#666', fontStyle: 'italic' }}>
                                  Click "Show Details" to view all 3D customization choices
                                </p>
                              )}
                            </div>
                          )}
                          {item.specific_data.imageUrl && item.specific_data.imageUrl !== 'no-image' && !item.specific_data.designData?.angleImages && (
                            <div className="cart-item-image">
                              <img 
                                src={`${API_BASE_URL}${item.specific_data.imageUrl}`} 
                                alt="Design preview" 
                                className="cart-damage-photo clickable-image"
                                onClick={() => openImagePreview(`${API_BASE_URL}${item.specific_data.imageUrl}`, 'Design Preview')}
                                title="Click to enlarge"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                              <small>Design preview uploaded</small>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {item.appointment_date && (
                        <p>Appointment: {new Date(item.appointment_date).toLocaleDateString()}</p>
                      )}
                      
                      {item.rental_start_date && item.rental_end_date && (
                        <p style={{ color: '#000' }}>
                          Rental: <span style={{ color: '#000', fontWeight: '600' }}>{new Date(item.rental_start_date).toLocaleDateString()}</span> - {' '}
                          <span style={{ color: '#000', fontWeight: '600' }}>{new Date(item.rental_end_date).toLocaleDateString()}</span>
                        </p>
                      )}
                    </div>

                    <div className="cart-item-actions" onClick={(e) => e.stopPropagation()}>
                      <div className="cart-quantity">
                        <label>Qty:</label>
                        <span className="quantity-display">{item.quantity || 1}</span>
                      </div>

                      <button 
                        className="cart-remove-btn"
                        onClick={() => handleRemoveItem(item.cart_id)}
                        disabled={loading}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              })}
              </div>

              <div className="cart-summary">
                <div className="cart-summary-row">
                  <span>Selected Items ({selectedItems.length}):</span>
                  <span>{formatPrice(
                    cartItems
                      .filter(item => selectedItems.includes(item.cart_id))
                      .reduce((total, item) => {
                        
                        const isBundleRental = item.service_type === 'rental' && 
                          (item.specific_data?.is_bundle || item.pricing_factors?.is_bundle);
                        if (isBundleRental) {
                          return total + parseFloat(item.final_price || 0);
                        }
                        return total + (parseFloat(item.final_price || 0) * (item.quantity || 1));
                      }, 0)
                  )}</span>
                </div>
                
                <div className="cart-notes">
                  <label>Order Notes (optional):</label>
                  <textarea
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Add any special instructions..."
                    rows={3}
                  />
                </div>

                <div className="cart-actions">
                  <button 
                    className="cart-clear-btn"
                    onClick={handleClearCart}
                    disabled={loading || submitting}
                  >
                    Clear Cart
                  </button>
                  
                  <button 
                    className="cart-submit-btn"
                    onClick={handleSubmitOrder}
                    disabled={loading || submitting || selectedItems.length === 0}
                  >
                    {submitting ? 'Submitting...' : `Submit Order (${selectedItems.length})`}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <ImagePreviewModal
        isOpen={imagePreviewOpen}
        imageUrl={previewImageUrl}
        altText={previewImageAlt}
        onClose={closeImagePreview}
      />
      {bundleModalOpen && (
        <div className="cart-overlay" style={{ zIndex: 2000 }} onClick={closeBundleModal}>
          <div 
            className="bundle-modal" 
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '700px',
              width: '90%',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              zIndex: 2001
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#333' }}>Rental Bundle ({bundleItems.length} items)</h2>
              <button
                onClick={closeBundleModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666',
                  padding: '0',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                Ã—
              </button>
            </div>
            {parentBundleData && (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '10px', 
                marginBottom: '20px',
                padding: '15px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px'
              }}>
                <div>
                  <span style={{ color: '#666', fontSize: '13px' }}>Rental Duration</span>
                  <p style={{ margin: '4px 0 0', fontWeight: '600', color: '#333' }}>
                    {parentBundleData.pricing_factors?.duration || 'N/A'} days
                  </p>
                </div>
                <div>
                  <span style={{ color: '#666', fontSize: '13px' }}>Start Date</span>
                  <p style={{ margin: '4px 0 0', fontWeight: '600', color: '#333' }}>
                    {parentBundleData.rental_start_date ? new Date(parentBundleData.rental_start_date).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <span style={{ color: '#666', fontSize: '13px' }}>End Date</span>
                  <p style={{ margin: '4px 0 0', fontWeight: '600', color: '#333' }}>
                    {parentBundleData.rental_end_date ? new Date(parentBundleData.rental_end_date).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <span style={{ color: '#666', fontSize: '13px' }}>Total Price</span>
                  <p style={{ margin: '4px 0 0', fontWeight: '700', color: '#2d5a3d', fontSize: '16px' }}>
                    {formatPrice(parentBundleData.final_price)}
                  </p>
                </div>
              </div>
            )}

            <p style={{ color: '#666', marginBottom: '15px', fontSize: '14px' }}>Click on an item to view details</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
              {bundleItems.map((bundleItem, index) => (
                <div 
                  key={index}
                  style={{
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    backgroundColor: '#fff'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  onClick={() => openBundleItemDetail(bundleItem)}
                >
                  {bundleItem.image_url ? (
                    <img
                      src={bundleItem.image_url}
                      alt={bundleItem.item_name || 'Rental Item'}
                      style={{
                        width: '100%',
                        height: '150px',
                        objectFit: 'cover'
                      }}
                      onError={(e) => {
                        e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE2IiBmaWxsPSIjOTk5Ij5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '150px',
                      backgroundColor: '#f0f0f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#999'
                    }}>
                      No Image
                    </div>
                  )}
                  <div style={{ padding: '12px' }}>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#333' }}>
                      {bundleItem.item_name || 'Rental Item'}
                    </p>
                    {bundleItem.brand && bundleItem.brand !== 'Unknown' && (
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#666' }}>
                        {bundleItem.brand}
                      </p>
                    )}
                    {bundleItem.color && (
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#888' }}>
                        Color: {bundleItem.color}
                      </p>
                    )}
                    <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#007bff' }}>
                      Click to view details â†’
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {parentBundleData && (
              <div style={{ 
                marginTop: '20px', 
                padding: '15px', 
                backgroundColor: '#fff3cd', 
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontWeight: '500', color: '#856404' }}>Downpayment (50%)</span>
                <span style={{ fontWeight: '700', color: '#856404', fontSize: '18px' }}>
                  {formatPrice(parentBundleData.pricing_factors?.downpayment || 0)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
      {bundleItemDetailOpen && selectedBundleItem && (
        <div className="cart-overlay" style={{ zIndex: 2100 }} onClick={closeBundleItemDetail}>
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '450px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              zIndex: 2101
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#333', fontSize: '18px' }}>Item Details</h2>
              <button
                onClick={closeBundleItemDetail}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666',
                  padding: '0',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                Ã—
              </button>
            </div>
            {selectedBundleItem.image_url && (
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <img
                  src={selectedBundleItem.image_url}
                  alt={selectedBundleItem.item_name || 'Rental Item'}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '200px',
                    objectFit: 'contain',
                    borderRadius: '8px',
                    border: '1px solid #e0e0e0',
                    cursor: 'pointer'
                  }}
                  onClick={() => openImagePreview(selectedBundleItem.image_url, selectedBundleItem.item_name || 'Rental Item')}
                />
              </div>
            )}
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                <span style={{ fontWeight: '500', color: '#666' }}>Item Name</span>
                <span style={{ fontWeight: '600', color: '#333' }}>{selectedBundleItem.item_name || 'N/A'}</span>
              </div>
              
              {selectedBundleItem.brand && selectedBundleItem.brand !== 'Unknown' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                  <span style={{ fontWeight: '500', color: '#666' }}>Brand</span>
                  <span style={{ fontWeight: '600', color: '#333' }}>{selectedBundleItem.brand}</span>
                </div>
              )}
              
              {selectedBundleItem.color && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                  <span style={{ fontWeight: '500', color: '#666' }}>Color</span>
                  <span style={{ fontWeight: '600', color: '#333' }}>{selectedBundleItem.color}</span>
                </div>
              )}
              
              {selectedBundleItem.material && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                  <span style={{ fontWeight: '500', color: '#666' }}>Material</span>
                  <span style={{ fontWeight: '600', color: '#333' }}>{selectedBundleItem.material}</span>
                </div>
              )}
              {selectedBundleItem.size && renderSizeMeasurements(selectedBundleItem.size)}
              
              {selectedBundleItem.price && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: '#e8f4e8', borderRadius: '6px', marginTop: '10px' }}>
                  <span style={{ fontWeight: '500', color: '#2d5a3d' }}>Base Price (per 3 days)</span>
                  <span style={{ fontWeight: '700', color: '#2d5a3d' }}>{formatPrice(selectedBundleItem.price)}</span>
                </div>
              )}
            </div>
            
            <button
              onClick={closeBundleItemDetail}
              style={{
                marginTop: '20px',
                width: '100%',
                padding: '12px',
                backgroundColor: '#8B4513',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Back to Bundle
            </button>
          </div>
        </div>
      )}
      {rentalDetailModalOpen && selectedRentalItem && (
        <div className="cart-overlay" style={{ zIndex: 2000 }} onClick={closeRentalDetailModal}>
          <div 
            className="rental-detail-modal" 
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              zIndex: 2001
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#333' }}>Rental Details</h2>
              <button
                onClick={closeRentalDetailModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666',
                  padding: '0',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                Ã—
              </button>
            </div>
            {(() => {
              const rentalImages = [
                selectedRentalItem.specific_data?.front_image && { url: selectedRentalItem.specific_data.front_image, label: 'Front' },
                selectedRentalItem.specific_data?.back_image && { url: selectedRentalItem.specific_data.back_image, label: 'Back' },
                selectedRentalItem.specific_data?.side_image && { url: selectedRentalItem.specific_data.side_image, label: 'Side' },
                selectedRentalItem.specific_data?.image_url && { url: selectedRentalItem.specific_data.image_url, label: 'Main' }
              ].filter(Boolean);
              
              if (rentalImages.length > 0) {
                return (
                  <div style={{ marginBottom: '20px' }}>
                    <SimpleImageCarousel 
                      images={rentalImages}
                      itemName={selectedRentalItem.specific_data?.item_name || 'Rental Item'}
                      height="220px"
                    />
                  </div>
                );
              }
              return null;
            })()}
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                <span style={{ fontWeight: '500', color: '#666' }}>Item Name</span>
                <span style={{ fontWeight: '600', color: '#333' }}>{selectedRentalItem.specific_data?.item_name || 'N/A'}</span>
              </div>
              
              {selectedRentalItem.specific_data?.brand && selectedRentalItem.specific_data.brand !== 'Unknown' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                  <span style={{ fontWeight: '500', color: '#666' }}>Brand</span>
                  <span style={{ fontWeight: '600', color: '#333' }}>{selectedRentalItem.specific_data.brand}</span>
                </div>
              )}
              
              {selectedRentalItem.specific_data?.color && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                  <span style={{ fontWeight: '500', color: '#666' }}>Color</span>
                  <span style={{ fontWeight: '600', color: '#333' }}>{selectedRentalItem.specific_data.color}</span>
                </div>
              )}
              
              {selectedRentalItem.specific_data?.material && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                  <span style={{ fontWeight: '500', color: '#666' }}>Material</span>
                  <span style={{ fontWeight: '600', color: '#333' }}>{selectedRentalItem.specific_data.material}</span>
                </div>
              )}
              {selectedRentalItem.specific_data?.size && renderSizeMeasurements(selectedRentalItem.specific_data.size)}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                <span style={{ fontWeight: '500', color: '#666' }}>Rental Duration</span>
                <span style={{ fontWeight: '600', color: '#333' }}>{selectedRentalItem.pricing_factors?.duration || selectedRentalItem.pricing_factors?.rental_days || 'N/A'} days</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                <span style={{ fontWeight: '500', color: '#666' }}>Start Date</span>
                <span style={{ fontWeight: '600', color: '#333' }}>{selectedRentalItem.rental_start_date ? new Date(selectedRentalItem.rental_start_date).toLocaleDateString() : 'N/A'}</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                <span style={{ fontWeight: '500', color: '#666' }}>End Date</span>
                <span style={{ fontWeight: '600', color: '#333' }}>{selectedRentalItem.rental_end_date ? new Date(selectedRentalItem.rental_end_date).toLocaleDateString() : 'N/A'}</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: '#e8f4e8', borderRadius: '6px' }}>
                <span style={{ fontWeight: '500', color: '#2d5a3d' }}>Rental Price</span>
                <span style={{ fontWeight: '700', color: '#2d5a3d', fontSize: '18px' }}>{formatPrice(selectedRentalItem.final_price)}</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '6px' }}>
                <span style={{ fontWeight: '500', color: '#856404' }}>Downpayment (50%)</span>
                <span style={{ fontWeight: '700', color: '#856404', fontSize: '18px' }}>{formatPrice(selectedRentalItem.pricing_factors?.downpayment || selectedRentalItem.specific_data?.downpayment || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cart;
