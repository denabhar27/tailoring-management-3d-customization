import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/UserHomePage.css';
import '../styles/Profile.css';
import logo from "../assets/logo.png";
import dp from "../assets/dp.png";
import { getUser, updateProfile, uploadProfilePicture } from '../api/AuthApi';
import { getUserOrderTracking, getStatusBadgeClass, getStatusLabel, cancelOrderItem, requestEnhancement } from '../api/OrderTrackingApi';
import ImagePreviewModal from '../components/ImagePreviewModal';
import TransactionLogModal from './components/TransactionLogModal';
import { useAlert } from '../context/AlertContext';
import { getMyMeasurements } from '../api/CustomerApi';
import SimpleImageCarousel from '../components/SimpleImageCarousel';
import { API_BASE_URL, API_URL } from '../api/config';

const Profile = () => {
  const { alert, confirm } = useAlert();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');

  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [previewImageAlt, setPreviewImageAlt] = useState('');

  const [measurementsModalOpen, setMeasurementsModalOpen] = useState(false);
  const [measurements, setMeasurements] = useState(null);
  const [loadingMeasurements, setLoadingMeasurements] = useState(false);

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [itemToCancel, setItemToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [enhanceModalOpen, setEnhanceModalOpen] = useState(false);
  const [itemToEnhance, setItemToEnhance] = useState(null);
  const [enhanceNotes, setEnhanceNotes] = useState('');
  const [enhancePreferredDate, setEnhancePreferredDate] = useState('');
  const [submittingEnhancement, setSubmittingEnhancement] = useState(false);

  const [transactionLogModalOpen, setTransactionLogModalOpen] = useState(false);
  const [selectedOrderItemId, setSelectedOrderItemId] = useState(null);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: ''
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profilePicUrl, setProfilePicUrl] = useState('');
  const [uploadingPic, setUploadingPic] = useState(false);
  const [pendingPicFile, setPendingPicFile] = useState(null);
  const [pendingPicPreview, setPendingPicPreview] = useState(null);

  const openImagePreview = (imageUrl, altText) => {
    setPreviewImageUrl(imageUrl);
    setPreviewImageAlt(altText || 'Order Image');
    setImagePreviewOpen(true);
  };

  const [user, setUser] = useState(() => {
    const userData = getUser();
    return userData || {
      name: 'Guest',
      email: 'guest@example.com',
    };
  });

  useEffect(() => {
    const userData = getUser();
    if (userData) {
      setUser(userData);
      setProfileData({
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        email: userData.email || '',
        phone_number: userData.phone_number || ''
      });
      if (userData.profile_picture) {
        const picUrl = userData.profile_picture.startsWith('http')
          ? userData.profile_picture
          : `${API_BASE_URL}${userData.profile_picture}`;
        setProfilePicUrl(picUrl);
      }
    }
  }, []);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const result = await getUserOrderTracking();
        console.log("Orders fetched:", result);
        if (result.success) {
          setOrders(result.data);
          console.log("Orders data:", result.data);
        } else {
          setError(result.message || 'Failed to fetch orders');
        }
      } catch (err) {
        console.error('Error fetching orders:', err);
        setError('Error loading orders');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  useEffect(() => {
    const checkPriceConfirmation = async () => {
      if (orders.length > 0) {
        const priceConfirmationOrders = orders.filter(order =>
          order.items && order.items.some(item => {
            const serviceType = String(item.service_type || '').toLowerCase();
            const isDryCleaning = serviceType === 'dry_cleaning' || serviceType === 'dry-cleaning' || serviceType === 'drycleaning';
            return item.status === 'price_confirmation' && !isDryCleaning;
          })
        );

        if (priceConfirmationOrders.length > 0) {

          const notificationMessage = `You have ${priceConfirmationOrders.length} order(s) awaiting price confirmation!`;
          await alert(notificationMessage, 'Price Confirmation Required', 'info');
        }
      }
    };

    checkPriceConfirmation();
  }, [orders]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDateTo12Hour = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';

      const dateStr = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      const timeStr = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      return `${dateStr} at ${timeStr}`;
    } catch (e) {
      return 'N/A';
    }
  };

  const renderEnhancementInfo = (specificData) => {
    const hasEnhancement = Boolean(
      specificData?.enhancementRequest ||
      specificData?.enhancementNotes ||
      specificData?.enhancementUpdatedAt
    );

    if (!hasEnhancement) return null;

    const additionalCost = parseFloat(specificData?.enhancementAdditionalCost || 0);
    const hasCost = Number.isFinite(additionalCost) && additionalCost > 0;

    return (
      <div style={{ marginTop: '10px', padding: '10px', border: '1px solid #e0d4ff', backgroundColor: '#faf7ff', borderRadius: '8px' }}>
        <div className="detail-row">
          <span className="detail-label">Enhancement:</span>
          <span className="detail-value">{specificData?.enhancementNotes || 'Additional enhancement requested in-shop.'}</span>
        </div>
        {hasCost && (
          <div className="detail-row">
            <span className="detail-label">Additional Cost:</span>
            <span className="detail-value">{formatCurrencyPHP(additionalCost)}</span>
          </div>
        )}
      </div>
    );
  };

  const formatSize = (size) => {
    if (!size) return null;

    if (typeof size === 'string' && !size.trim().startsWith('{')) {
      return [{ label: 'Size', value: size }];
    }

    try {

      let measurements = typeof size === 'string' ? JSON.parse(size) : size;

      if (!measurements || typeof measurements !== 'object' || Array.isArray(measurements)) {
        return [{ label: 'Size', value: typeof size === 'string' ? size : JSON.stringify(size) }];
      }

      const labelMap = {
        'chest': 'Chest',
        'shoulders': 'Shoulders',
        'sleeveLength': 'Sleeve',
        'neck': 'Neck',
        'waist': 'Waist',
        'length': 'Length'
      };

      const parts = Object.entries(measurements)
        .filter(([key, value]) => value !== null && value !== undefined && value !== '' && value !== '0')
        .map(([key, value]) => {
          const label = labelMap[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim();

          let displayValue;
          if (typeof value === 'object' && value !== null) {

            if (value.inch !== undefined && value.cm !== undefined) {
              displayValue = `${value.inch} in / ${value.cm} cm`;
            } else if (value.inch !== undefined) {
              displayValue = `${value.inch} in`;
            } else if (value.cm !== undefined) {
              displayValue = `${value.cm} cm`;
            } else if (value.value !== undefined) {
              displayValue = `${value.value} in`;
            } else {
              displayValue = JSON.stringify(value);
            }
          } else {
            displayValue = `${value} in`;
          }
          return { label, value: displayValue };
        });

      return parts.length > 0 ? parts : null;
    } catch (e) {

      return [{ label: 'Size', value: typeof size === 'string' ? size : 'N/A' }];
    }
  };

  const getStatusBadgeClass = (status) => {
    if (!status) return 'unknown';

    const statusMap = {
      'pending': 'pending',
      'pending_review': 'pending',
      'accepted': 'accepted',
      'rejected': 'rejected',
      'cancelled': 'rejected',
      'price_declined': 'rejected',
      'price_confirmation': 'price-confirmation',
      'in_progress': 'in-progress',
      'ready_to_pickup': 'ready-to-pickup',
      'ready_for_pickup': 'ready-to-pickup',
      'picked_up': 'picked-up',
      'rented': 'rented',
      'returned': 'returned',
      'completed': 'completed'
    };

    const normalizedStatus = (status || '').toLowerCase().trim();
    return statusMap[normalizedStatus] || 'unknown';
  };

  const getStatusLabel = (status) => {
    const statusMap = {
      'pending': 'Pending',
      'price_confirmation': 'Price Confirmation',
      'accepted': 'Accepted',
      'in_progress': 'In Progress',
      'ready_to_pickup': 'Ready to Pickup',
      'picked_up': 'Picked Up',
      'rented': 'Rented',
      'returned': 'Returned',
      'completed': 'Completed'
    };
    return statusMap[status] || status;
  };

  const formatServiceType = (serviceType) => {
    if (!serviceType) return '';
    return serviceType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const formatServiceName = (serviceName) => {
    if (!serviceName) return '';

    let formatted = serviceName.replace(/^[\s\-–—]+/, '');

    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  const formatCurrencyPHP = (value) => {
    const numeric = Number.parseFloat(value);
    const safeValue = Number.isFinite(numeric) ? numeric : 0;
    return `₱${safeValue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  const getDisplayImageUrl = (url) => {
    if (!url || typeof url !== 'string') return '';
    if (url.startsWith('data:image') || url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `${API_BASE_URL}${url}`;
  };

  const parseDesignData = (value) => {
    if (!value) return null;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }
    return null;
  };

  const handleViewDetails = (item) => {
    setSelectedItem(item);
    setDetailsModalOpen(true);
  };

  const handleAcceptPrice = async (item) => {
    try {
      const isConfirmed = await confirm(
        `Accept the updated price of ${formatCurrencyPHP(item.final_price)} for this order?`,
        'Confirm Price Acceptance',
        'question',
        {
          confirmText: 'Accept Price',
          cancelText: 'Not Now'
        }
      );

      if (!isConfirmed) {
        return;
      }

      const response = await fetch(`${API_URL}/orders/${item.order_item_id}/accept-price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const result = await response.json();

      if (result.success) {
        await alert('Price accepted! Your order is now accepted.', 'Success', 'success');

        const ordersResult = await getUserOrderTracking();
        if (ordersResult.success) {
          setOrders(ordersResult.data);
        }
      } else {
        await alert(result.message || 'Failed to accept price', 'Error', 'error');
        console.error('Failed to accept price:', result);
      }
    } catch (error) {
      await alert('Error accepting price. Please try again.', 'Error', 'error');
      console.error('Error accepting price:', error);
    }
  };

  const handleDeclinePrice = async (item) => {
    try {
      const isConfirmed = await confirm(
        'Declining the updated price will cancel this order. Do you want to continue?',
        'Confirm Price Decline',
        'warning',
        {
          confirmText: 'Decline Price',
          cancelText: 'Keep Order'
        }
      );

      if (!isConfirmed) {
        return;
      }

      const response = await fetch(`${API_URL}/orders/${item.order_item_id}/decline-price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const result = await response.json();

      if (result.success) {
        await alert('Price declined. Your order has been cancelled.', 'Success', 'success');

        const ordersResult = await getUserOrderTracking();
        if (ordersResult.success) {
          setOrders(ordersResult.data);
        }
      } else {
        await alert(result.message || 'Failed to decline price', 'Error', 'error');
        console.error('Failed to decline price:', result);
      }
    } catch (error) {
      await alert('Error declining price. Please try again.', 'Error', 'error');
      console.error('Error declining price:', error);
    }
  };

  const closeDetailsModal = () => {
    setSelectedItem(null);
    setDetailsModalOpen(false);
  };

  const openEnhancementModal = (item) => {
    const serviceType = String(item?.service_type || '').toLowerCase();
    const isEnhanceableService = ['repair', 'customization', 'customize', 'dry_cleaning', 'drycleaning', 'dry-cleaning'].includes(serviceType);
    if (!isEnhanceableService || item?.status !== 'completed') {
      alert('Enhancement request is only available for completed customization, repair, or dry cleaning orders.', 'Not Available', 'warning');
      return;
    }
    setItemToEnhance(item);
    setEnhanceNotes('');
    setEnhancePreferredDate('');
    setEnhanceModalOpen(true);
  };

  const handleSubmitEnhancement = async () => {
    if (!itemToEnhance) return;
    const notes = String(enhanceNotes || '').trim();
    if (!notes) {
      await alert('Please describe the issue or enhancement you want.', 'Notes Required', 'warning');
      return;
    }

    try {
      setSubmittingEnhancement(true);
      const result = await requestEnhancement(itemToEnhance.order_item_id, notes, enhancePreferredDate || null);
      if (result.success) {
        await alert('Enhancement request submitted. Your order is now in progress.', 'Success', 'success');
        const ordersResult = await getUserOrderTracking();
        if (ordersResult.success) {
          setOrders(ordersResult.data || []);
        }
        setEnhanceModalOpen(false);
        setItemToEnhance(null);
      } else {
        await alert(result.message || 'Failed to submit enhancement request', 'Error', 'error');
      }
    } catch (error) {
      await alert('Failed to submit enhancement request', 'Error', 'error');
    } finally {
      setSubmittingEnhancement(false);
    }
  };

  const renderServiceDetails = (item) => {
    const { service_type, specific_data, rental_start_date, rental_end_date } = item;

    console.log('Rendering service details for:', { service_type, specific_data, rental_start_date, rental_end_date, item });
    console.log('Service type type:', typeof service_type);
    console.log('Service type value:', `"${service_type}"`);

    switch (service_type) {
      case 'rental':
        console.log('Matched rental case');
        const isBundle = specific_data?.is_bundle === true || specific_data?.category === 'rental_bundle';
        const bundleItems = specific_data?.bundle_items || [];

        return (
          <div className="service-details rental-details">
            <h4>Rental Details</h4>
            {isBundle && bundleItems.length > 0 ? (
              <div className="detail-row" style={{ marginBottom: '20px' }}>
                <span className="detail-label">Rental Items:</span>
                <div className="detail-value" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {bundleItems.map((bundleItem, idx) => {

                    const itemImages = [
                      bundleItem.front_image && { url: bundleItem.front_image, label: 'Front' },
                      bundleItem.back_image && { url: bundleItem.back_image, label: 'Back' },
                      bundleItem.side_image && { url: bundleItem.side_image, label: 'Side' },
                      bundleItem.image_url && bundleItem.image_url !== 'no-image' && { url: bundleItem.image_url, label: 'Main' }
                    ].filter(Boolean);

                    return (
                      <div key={idx} style={{
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        padding: '15px',
                        backgroundColor: '#f9f9f9'
                      }}>
                        <strong style={{ display: 'block', marginBottom: '10px', color: '#333' }}>
                          {bundleItem.item_name || `Item ${idx + 1}`}
                        </strong>
                        {itemImages.length > 0 && (
                          <SimpleImageCarousel
                            images={itemImages}
                            itemName={bundleItem.item_name}
                            height="180px"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (

              (() => {
                const singleItemImages = [
                  specific_data.front_image && { url: specific_data.front_image, label: 'Front' },
                  specific_data.back_image && { url: specific_data.back_image, label: 'Back' },
                  specific_data.side_image && { url: specific_data.side_image, label: 'Side' },
                  specific_data.image_url && specific_data.image_url !== 'no-image' && { url: specific_data.image_url, label: 'Main' }
                ].filter(Boolean);

                if (singleItemImages.length > 0) {
                  return (
                    <div className="detail-row" style={{ marginBottom: '15px' }}>
                      <span className="detail-label">Item Photos:</span>
                      <div className="detail-value">
                        <SimpleImageCarousel
                          images={singleItemImages}
                          itemName={specific_data.item_name}
                          height="200px"
                        />
                      </div>
                    </div>
                  );
                }
                return null;
              })()
            )}

            <div className="detail-row">
              <span className="detail-label">Item Name:</span>
              <span className="detail-value">
                {isBundle && bundleItems.length > 0
                  ? bundleItems.map(item => item.item_name).join(', ')
                  : (specific_data.item_name || 'N/A')}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Category:</span>
              <span className="detail-value">
                {isBundle && bundleItems.length > 0
                  ? [...new Set(bundleItems.map(item => item.category || 'rental'))].join(', ')
                  : (specific_data.category || 'N/A')}
              </span>
            </div>
            <div className="detail-row" style={{ alignItems: 'flex-start', flexDirection: 'column' }}>
              <span className="detail-label" style={{ marginBottom: '10px', textAlign: 'center', display: 'block', width: '100%' }}>Size:</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', alignItems: 'center' }}>
                {isBundle && bundleItems.length > 0
                  ? bundleItems.map((item, idx) => {
                      const selectedSizes = item.selected_sizes || item.selectedSizes || [];
                      const sizeOptions = item.size_options || {};
                      return (
                        <div key={idx} style={{
                          fontSize: '0.9rem',
                          lineHeight: '1.8',
                          padding: '12px 16px',
                          backgroundColor: '#f5f5f5',
                          borderRadius: '6px',
                          border: '1px solid #e0e0e0',
                          width: '100%',
                          maxWidth: '350px'
                        }}>
                          <strong style={{ color: '#333', display: 'block', marginBottom: '10px', borderBottom: '1px solid #ddd', paddingBottom: '8px', textAlign: 'center' }}>
                            {item.item_name || `Item ${idx + 1}`}:
                          </strong>
                          {selectedSizes.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              {selectedSizes.map((sizeEntry, mIdx) => {
                                const sizeKey = sizeEntry.sizeKey || sizeEntry.size_key || sizeEntry.label?.toLowerCase();
                                const measurements = sizeEntry.measurements || sizeEntry.measurement_profile || sizeEntry.measurementProfile || (sizeOptions[sizeKey]?.measurements);
                                const hasMeasurements = measurements && typeof measurements === 'object' && Object.keys(measurements).length > 0;
                                return (
                                  <div key={mIdx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 16px', color: '#666' }}>
                                      <span style={{ fontWeight: '500', textAlign: 'left' }}>{sizeEntry.label || sizeEntry.sizeKey}</span>
                                      <span style={{ textAlign: 'right' }}>x{sizeEntry.quantity}</span>
                                    </div>
                                    {hasMeasurements && (
                                      <div style={{ paddingLeft: '16px', fontSize: '0.85rem', color: '#888', lineHeight: '1.6', marginTop: '4px' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                          <thead>
                                            <tr style={{ borderBottom: '1px solid #e0e0e0', backgroundColor: '#fff !important' }}>
                                              <th style={{ textAlign: 'left', padding: '4px 8px 4px 0', fontWeight: '600', color: '#666', backgroundColor: '#fff !important' }}>Measurement</th>
                                              <th style={{ textAlign: 'right', padding: '4px 0 4px 8px', fontWeight: '600', color: '#666', backgroundColor: '#fff !important' }}>Inches</th>
                                              <th style={{ textAlign: 'right', padding: '4px 0 4px 8px', fontWeight: '600', color: '#666', backgroundColor: '#fff !important' }}>Centimeters</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {Object.entries(measurements).map(([key, value]) => {
                                              if (!value) return null;
                                              const isObject = typeof value === 'object' && value !== null;
                                              if (isObject && !value.inch && !value.cm) return null;
                                              const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
                                              const inchValue = isObject ? (value.inch || '-') : (value || '-');
                                              const cmValue = isObject ? (value.cm || '-') : '-';
                                              return (
                                                <tr key={key} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                                  <td style={{ padding: '4px 8px 4px 0', color: '#555' }}>{label}</td>
                                                  <td style={{ textAlign: 'right', padding: '4px 0 4px 8px', color: '#555' }}>{inchValue}</td>
                                                  <td style={{ textAlign: 'right', padding: '4px 0 4px 8px', color: '#555' }}>{cmValue}</td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span style={{ color: '#666', textAlign: 'center', display: 'block' }}>N/A</span>
                          )}
                        </div>
                      );
                    })
                  : (
                      <div style={{
                        fontSize: '0.9rem',
                        lineHeight: '1.8',
                        padding: '12px 16px',
                        backgroundColor: '#f5f5f5',
                        borderRadius: '6px',
                        border: '1px solid #e0e0e0',
                        width: '100%',
                        maxWidth: '350px'
                      }}>
                        {(() => {
                          const selectedSizes = specific_data.selected_sizes || specific_data.selectedSizes || [];
                          const sizeOptions = specific_data.size_options || {};
                          if (selectedSizes.length > 0) {
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {selectedSizes.map((sizeEntry, mIdx) => {
                                  const sizeKey = sizeEntry.sizeKey || sizeEntry.size_key || sizeEntry.label?.toLowerCase();
                                  const measurements = sizeEntry.measurements || sizeEntry.measurement_profile || sizeEntry.measurementProfile || (sizeOptions[sizeKey]?.measurements);
                                  const hasMeasurements = measurements && typeof measurements === 'object' && Object.keys(measurements).length > 0;
                                  return (
                                    <div key={mIdx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 16px', color: '#666' }}>
                                        <span style={{ fontWeight: '500', textAlign: 'left' }}>{sizeEntry.label || sizeEntry.sizeKey}</span>
                                        <span style={{ textAlign: 'right' }}>x{sizeEntry.quantity}</span>
                                      </div>
                                      {hasMeasurements && (
                                        <div style={{ paddingLeft: '16px', fontSize: '0.85rem', color: '#888', lineHeight: '1.6', marginTop: '4px' }}>
                                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                            <thead>
                                              <tr style={{ borderBottom: '1px solid #e0e0e0', backgroundColor: '#fff !important' }}>
                                                <th style={{ textAlign: 'left', padding: '4px 8px 4px 0', fontWeight: '600', color: '#666', backgroundColor: '#fff !important' }}>Measurement</th>
                                                <th style={{ textAlign: 'right', padding: '4px 0 4px 8px', fontWeight: '600', color: '#666', backgroundColor: '#fff !important' }}>Inches</th>
                                                <th style={{ textAlign: 'right', padding: '4px 0 4px 8px', fontWeight: '600', color: '#666', backgroundColor: '#fff !important' }}>Centimeters</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {Object.entries(measurements).map(([key, value]) => {
                                                if (!value || (typeof value === 'object' && !value.inch && !value.cm)) return null;
                                                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
                                                const inchValue = typeof value === 'object' ? (value.inch || '-') : value;
                                                const cmValue = typeof value === 'object' ? (value.cm || '-') : '-';
                                                return (
                                                  <tr key={key} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                                    <td style={{ padding: '4px 8px 4px 0', color: '#555' }}>{label}</td>
                                                    <td style={{ textAlign: 'right', padding: '4px 0 4px 8px', color: '#555' }}>{inchValue}</td>
                                                    <td style={{ textAlign: 'right', padding: '4px 0 4px 8px', color: '#555' }}>{cmValue}</td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }
                          return <span style={{ color: '#666', textAlign: 'center', display: 'block' }}>N/A</span>;
                        })()}
                      </div>
                    )}
              </div>
            </div>
            <div className="detail-row">
              <span className="detail-label">Rental Period:</span>
              <span className="detail-value">
                {(() => {

                  const startDate = rental_start_date || item?.rental_start_date || specific_data?.rental_start_date || specific_data?.rentalDates?.startDate;
                  const endDate = rental_end_date || item?.rental_end_date || specific_data?.rental_end_date || specific_data?.rentalDates?.endDate;

                  console.log('Rental dates check:', { rental_start_date, rental_end_date, item_rental_start: item?.rental_start_date, item_rental_end: item?.rental_end_date, startDate, endDate });

                  if (startDate && endDate) {
                    try {
                      return `${formatDate(startDate)} to ${formatDate(endDate)}`;
                    } catch (e) {
                      return `${startDate} to ${endDate}`;
                    }
                  } else if (startDate) {
                    try {
                      return `${formatDate(startDate)} to N/A`;
                    } catch (e) {
                      return `${startDate} to N/A`;
                    }
                  } else if (endDate) {
                    try {
                      return `N/A to ${formatDate(endDate)}`;
                    } catch (e) {
                      return `N/A to ${endDate}`;
                    }
                  }
                  return 'N/A to N/A';
                })()}
              </span>
            </div>
            {(() => {
              const pricingFactors = typeof item.pricing_factors === 'string'
                ? JSON.parse(item.pricing_factors || '{}')
                : (item.pricing_factors || {});
              const penalty = parseFloat(pricingFactors.penalty || 0);
              const penaltyDays = parseInt(pricingFactors.penaltyDays || 0);

              if (penalty > 0 && penaltyDays > 0) {
                return (
                  <div className="detail-row" style={{
                    backgroundColor: '#fff3cd',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid #ffc107',
                    marginTop: '10px'
                  }}>
                    <span className="detail-label" style={{ color: '#856404', fontWeight: '600' }}>⚠️ Late Return Penalty:</span>
                    <span className="detail-value" style={{ color: '#856404', fontWeight: '600' }}>
                      ₱{penalty.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ({penaltyDays} day{penaltyDays > 1 ? 's' : ''} exceeded)
                    </span>
                  </div>
                );
              }
              return null;
            })()}
            {specific_data.notes && (
              <div className="detail-row">
                <span className="detail-label">Notes:</span>
                <span className="detail-value">{specific_data.notes}</span>
              </div>
            )}
          </div>
        );

      case 'repair':

        const getEstimatedTimeFromLevel = (damageLevel) => {
          const times = {
            'minor': '2-3 days',
            'moderate': '3-5 days',
            'major': '5-7 days',
            'severe': '1-2 weeks'
          };
          return times[damageLevel] || 'N/A';
        };

        const damageLevel = specific_data.garments?.[0]?.damageLevel || specific_data.damageLevel || 'N/A';
        const estimatedFromGarments = Array.isArray(specific_data.garments)
          ? specific_data.garments.reduce((sum, garment) => {
              const garmentPrice = Number.parseFloat(garment?.basePrice ?? garment?.base_price ?? 0);
              return sum + (Number.isFinite(garmentPrice) ? garmentPrice : 0);
            }, 0)
          : 0;

        const estimatedPrice = Number.parseFloat(specific_data.estimatedPrice);
        const safeEstimatedPrice = Number.isFinite(estimatedPrice)
          ? estimatedPrice
          : estimatedFromGarments;
        const estimatedTime = specific_data.estimatedTime || getEstimatedTimeFromLevel(damageLevel);

        return (
          <div className="service-details repair-details">
            <h4>Repair Details</h4>
            {/* Support multiple images */}
            {specific_data.imageUrls && specific_data.imageUrls.length > 0 ? (
              <div className="detail-row">
                <span className="detail-label">Damage Photos:</span>
                <div className="detail-value">
                  <SimpleImageCarousel
                    images={specific_data.imageUrls.map((url, idx) => ({ url: `${API_BASE_URL}${url}`, label: `Photo ${idx + 1}/${specific_data.imageUrls.length}` }))}
                    itemName="Damage Photo"
                    height="280px"
                  />
                </div>
              </div>
            ) : specific_data.imageUrl && specific_data.imageUrl !== 'no-image' && (
              <div className="detail-row">
                <span className="detail-label">Damage Photo:</span>
                <div className="detail-value">
                  <img
                    src={`${API_BASE_URL}${specific_data.imageUrl}`}
                    alt="Damage"
                    className="damage-photo clickable-image"
                    onClick={() => openImagePreview(`${API_BASE_URL}${specific_data.imageUrl}`, 'Damage Photo')}
                    title="Click to enlarge"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      console.log('Image failed to load:', specific_data.imageUrl);
                    }}
                  />
                </div>
              </div>
            )}
            <div className="detail-row">
              <span className="detail-label">Service Name:</span>
              <span className="detail-value">{String(formatServiceName(specific_data.serviceName) || 'N/A').trim()}</span>
            </div>

            {/* Multiple garments support */}
            {specific_data.garments && specific_data.garments.length > 0 ? (
              <>
                <div className="detail-row">
                  <span className="detail-label">Garments:</span>
                  <span className="detail-value"><strong>{`${specific_data.garments.length} item${specific_data.garments.length > 1 ? 's' : ''}`.trim()}</strong></span>
                </div>
                {specific_data.garments.map((garment, idx) => (
                  <div key={idx} className="garment-card" style={{
                    marginTop: '10px',
                    padding: '12px 16px',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '8px',
                    border: '1px solid #e0e0e0',
                    textAlign: 'left',
                    marginLeft: '0',
                    width: '100%'
                  }}>
                    <div style={{ marginBottom: '6px' }}><strong>Garment #{idx + 1}:</strong> {garment.garmentType || 'N/A'}</div>
                    <div style={{ marginBottom: '6px' }}><strong>Damage Level:</strong> {garment.damageLevel ? garment.damageLevel.charAt(0).toUpperCase() + garment.damageLevel.slice(1) : 'N/A'}</div>
                    <div style={{ marginBottom: '6px' }}><strong>Damage Level Description:</strong> {garment.damageLevelDescription || 'N/A'}</div>
                    <div style={{ marginBottom: '6px' }}><strong>Description:</strong> {garment.notes || 'N/A'}</div>
                    <div><strong>Price:</strong> ₱{garment.basePrice || 'N/A'}</div>
                  </div>
                ))}
              </>
            ) : (
              <>
                <div className="detail-row">
                  <span className="detail-label">Damage Level:</span>
                  <span className="detail-value">{damageLevel ? damageLevel.charAt(0).toUpperCase() + damageLevel.slice(1) : 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Damage Level Description:</span>
                  <span className="detail-value">{specific_data.damageLevelDescription || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Garment Type:</span>
                  <span className="detail-value">{specific_data.damageLocation || specific_data.garmentType || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Description:</span>
                  <span className="detail-value">{specific_data.damageDescription || 'N/A'}</span>
                </div>
              </>
            )}

            <div className="detail-row">
              <span className="detail-label">Drop Off Item Date:</span>
              <span className="detail-value">{formatDateTo12Hour(specific_data.pickupDate)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Estimated Completion Date:</span>
              <span className="detail-value">
                {specific_data.estimatedCompletionDate || specific_data.estimated_completion_date
                  ? formatDate(specific_data.estimatedCompletionDate || specific_data.estimated_completion_date)
                  : 'N/A'}
              </span>
            </div>
            {item.status === 'price_confirmation' ? (
              (() => {
                const bp = parseFloat(item.base_price ?? item.basePrice ?? 0);
                const prev = Number.isFinite(bp) && bp > 0 ? bp : safeEstimatedPrice;
                return (
                  <>
                    <div className="detail-row">
                      <span className="detail-label">Previous Price:</span>
                      <span className="detail-value">{prev > 0 ? formatCurrencyPHP(prev) : 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Final Price:</span>
                      <span className="detail-value">{formatCurrencyPHP(item.final_price)}</span>
                    </div>
                  </>
                );
              })()
            ) : (
              <div className="detail-row">
                <span className="detail-label">{item.status === 'pending' ? 'Estimated Price:' : 'Final Price:'}</span>
                <span className="detail-value">{formatCurrencyPHP(item.status === 'pending' ? safeEstimatedPrice : item.final_price)}</span>
              </div>
            )}
            {renderEnhancementInfo(specific_data)}
          </div>
        );

      case 'customize':
      case 'customization':
        {
        const garments = Array.isArray(specific_data.garments) ? specific_data.garments : [];
        const topLevelDesignData = parseDesignData(specific_data.designData);
        const topLevelAngleImages = topLevelDesignData?.angleImageUrls || topLevelDesignData?.angleImages;

        return (
          <div className="service-details customize-details">
            <h4>Customization Details</h4>

            <div className="detail-row">
              <span className="detail-label">Preferred Date & Time:</span>
              <span className="detail-value">
                {specific_data.preferredDate && specific_data.preferredTime
                  ? formatDateTo12Hour(`${specific_data.preferredDate}T${specific_data.preferredTime}`)
                  : specific_data.preferredDate || 'N/A'}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Estimated Completion Date:</span>
              <span className="detail-value">
                {specific_data.estimatedCompletionDate || specific_data.estimated_completion_date
                  ? formatDate(specific_data.estimatedCompletionDate || specific_data.estimated_completion_date)
                  : 'N/A'}
              </span>
            </div>
            {specific_data.notes && (
              <div className="detail-row">
                <span className="detail-label">Notes:</span>
                <span className="detail-value">{specific_data.notes}</span>
              </div>
            )}
            {renderEnhancementInfo(specific_data)}

            {garments.length > 0 ? (
              <>
                <div className="detail-row">
                  <span className="detail-label">Garments:</span>
                  <span className="detail-value"><strong>{garments.length} item{garments.length > 1 ? 's' : ''}</strong></span>
                </div>

                {garments.map((garment, idx) => {
                  const garmentDesignData = parseDesignData(garment.designData);
                  const garmentAngleImages = garmentDesignData?.angleImageUrls || garmentDesignData?.angleImages;

                  return (
                    <div key={idx} className="garment-card" style={{
                      marginTop: '12px',
                      padding: '12px 14px',
                      backgroundColor: '#f9f9f9',
                      borderRadius: '8px',
                      border: '1px solid #e0e0e0',
                      textAlign: 'left'
                    }}>
                      <div style={{ marginBottom: '6px', fontWeight: '700' }}>Garment #{idx + 1}</div>
                      <div style={{ marginBottom: '6px' }}><strong>Garment Type:</strong> {garment.garmentType || 'N/A'}</div>
                      <div style={{ marginBottom: '6px' }}><strong>Fabric Type:</strong> {garment.fabricType || 'N/A'}</div>

                      {garmentAngleImages && (
                        <div style={{ marginTop: '10px' }}>
                          <strong style={{ display: 'block', marginBottom: '8px' }}>Design Views:</strong>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                            {['front', 'back', 'right', 'left'].map((angle) => {
                              const angleUrl = getDisplayImageUrl(garmentAngleImages[angle]);
                              if (!angleUrl) return null;
                              return (
                                <div key={angle} style={{ position: 'relative' }}>
                                  <img
                                    src={angleUrl}
                                    alt={`${angle} view`}
                                    className="damage-photo clickable-image"
                                    onClick={() => openImagePreview(angleUrl, `${angle} view`)}
                                    title="Click to enlarge"
                                    style={{ width: '100%', height: 'auto', borderRadius: '8px', border: '2px solid #e0e0e0', cursor: 'pointer' }}
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                    }}
                                  />
                                  <div style={{ position: 'absolute', bottom: '5px', left: '5px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', textTransform: 'capitalize', fontWeight: 'bold' }}>
                                    {angle}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {!garmentAngleImages && garment.imageUrl && garment.imageUrl !== 'no-image' && (
                        <div style={{ marginTop: '10px' }}>
                          <strong>Design Preview:</strong>
                          <img
                            src={getDisplayImageUrl(garment.imageUrl)}
                            alt={`Garment #${idx + 1} preview`}
                            className="damage-photo clickable-image"
                            onClick={() => openImagePreview(getDisplayImageUrl(garment.imageUrl), `Garment #${idx + 1} preview`)}
                            title="Click to enlarge"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                      )}

                      {garmentDesignData && (
                        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                          <h5 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '600' }}>3D Customization Choices</h5>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '13px' }}>
                            {garmentDesignData.size && <div><strong>Size:</strong> {garmentDesignData.size.charAt(0).toUpperCase() + garmentDesignData.size.slice(1)}</div>}
                            {garmentDesignData.fit && <div><strong>Fit:</strong> {garmentDesignData.fit.charAt(0).toUpperCase() + garmentDesignData.fit.slice(1)}</div>}
                            {garmentDesignData.colors?.fabric && <div><strong>Color:</strong> {getColorName(garmentDesignData.colors.fabric)}</div>}
                            {garmentDesignData.pattern && garmentDesignData.pattern !== 'none' && <div><strong>Pattern:</strong> {garmentDesignData.pattern.charAt(0).toUpperCase() + garmentDesignData.pattern.slice(1)}</div>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            ) : topLevelAngleImages ? (
              <div className="detail-row">
                <span className="detail-label">Design Views:</span>
                <div className="detail-value">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginTop: '10px' }}>
                    {['front', 'back', 'right', 'left'].map((angle) => (
                      topLevelAngleImages[angle] && (
                        <div key={angle} style={{ position: 'relative' }}>
                          <img
                            src={getDisplayImageUrl(topLevelAngleImages[angle])}
                            alt={`${angle} view`}
                            className="damage-photo clickable-image"
                            onClick={() => openImagePreview(getDisplayImageUrl(topLevelAngleImages[angle]), `${angle} view`)}
                            title="Click to enlarge"
                            style={{
                              width: '100%',
                              height: 'auto',
                              borderRadius: '8px',
                              border: '2px solid #e0e0e0',
                              cursor: 'pointer'
                            }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              console.log(`${angle} view image failed to load`);
                            }}
                          />
                          <div style={{
                            position: 'absolute',
                            bottom: '5px',
                            left: '5px',
                            background: 'rgba(0,0,0,0.7)',
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            textTransform: 'capitalize',
                            fontWeight: 'bold'
                          }}>
                            {angle}
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                  <small style={{ display: 'block', fontSize: '11px', color: '#888', marginTop: '8px' }}>Click any image to enlarge</small>
                </div>
              </div>
            ) : specific_data.imageUrl && specific_data.imageUrl !== 'no-image' ? (
              <div className="detail-row">
                <span className="detail-label">Design Preview:</span>
                <div className="detail-value">
                  <img
                    src={getDisplayImageUrl(specific_data.imageUrl)}
                    alt="Design preview"
                    className="damage-photo clickable-image"
                    onClick={() => openImagePreview(getDisplayImageUrl(specific_data.imageUrl), 'Design Preview')}
                    title="Click to enlarge"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      console.log('Design preview image failed to load:', specific_data.imageUrl);
                    }}
                  />
                </div>
              </div>
            ) : null}

            {garments.length === 0 && (
              <>
                <div className="detail-row">
                  <span className="detail-label">Garment Type:</span>
                  <span className="detail-value">{specific_data.garmentType || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Fabric Type:</span>
                  <span className="detail-value">{specific_data.fabricType || 'N/A'}</span>
                </div>
              </>
            )}
            {specific_data.measurements && (
              <div className="detail-row">
                <span className="detail-label">Measurements:</span>
                <span className="detail-value">{specific_data.measurements}</span>
              </div>
            )}
            {garments.length === 0 && topLevelDesignData && (
              <div className="detail-row" style={{ marginTop: '15px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                <div style={{ width: '100%' }}>
                  <h5 style={{ margin: '0 0 15px 0', color: '#333', fontSize: '16px', fontWeight: '600' }}>
                    🎨 3D Customization Choices
                  </h5>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '14px' }}>
                    {topLevelDesignData.size && (
                      <div className="detail-row">
                        <span className="detail-label">Size:</span>
                        <span className="detail-value">{topLevelDesignData.size.charAt(0).toUpperCase() + topLevelDesignData.size.slice(1)}</span>
                      </div>
                    )}
                    {topLevelDesignData.fit && (
                      <div className="detail-row">
                        <span className="detail-label">Fit:</span>
                        <span className="detail-value">{topLevelDesignData.fit.charAt(0).toUpperCase() + topLevelDesignData.fit.slice(1)}</span>
                      </div>
                    )}
                    {topLevelDesignData.colors && topLevelDesignData.colors.fabric && (
                      <div className="detail-row">
                        <span className="detail-label">Color:</span>
                        <span className="detail-value">{getColorName(topLevelDesignData.colors.fabric)}</span>
                      </div>
                    )}
                    {topLevelDesignData.pattern && topLevelDesignData.pattern !== 'none' && (
                      <div className="detail-row">
                        <span className="detail-label">Pattern:</span>
                        <span className="detail-value">{topLevelDesignData.pattern.charAt(0).toUpperCase() + topLevelDesignData.pattern.slice(1)}</span>
                      </div>
                    )}
                    {topLevelDesignData.personalization && topLevelDesignData.personalization.initials && (
                      <div className="detail-row" style={{ gridColumn: '1 / -1' }}>
                        <span className="detail-label">Personalization:</span>
                        <span className="detail-value">
                          {topLevelDesignData.personalization.initials}
                          {topLevelDesignData.personalization.font && ` (${topLevelDesignData.personalization.font} font)`}
                        </span>
                      </div>
                    )}
                    {topLevelDesignData.buttons && topLevelDesignData.buttons.length > 0 && (
                      <div className="detail-row" style={{ gridColumn: '1 / -1' }}>
                        <span className="detail-label">Button Types:</span>
                        <div style={{ marginLeft: '10px', marginTop: '5px', fontSize: '13px' }}>
                          {topLevelDesignData.buttons.map((btn, index) => (
                            <div key={btn.id || index} style={{ margin: '5px 0' }}>
                              Button {index + 1}: {getButtonType(btn.modelPath)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {topLevelDesignData.accessories && topLevelDesignData.accessories.length > 0 && (
                      <div className="detail-row" style={{ gridColumn: '1 / -1' }}>
                        <span className="detail-label">Accessories:</span>
                        <div style={{ marginLeft: '10px', marginTop: '5px', fontSize: '13px' }}>
                          {topLevelDesignData.accessories.map((acc, index) => (
                            <div key={acc.id || index} style={{ margin: '5px 0' }}>
                              {getAccessoryName(acc.modelPath)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
        }

      case 'dry_cleaning':
      case 'drycleaning':
      case 'dry-cleaning':
      case 'dry cleaning':
        console.log('Matched dry cleaning case');

        console.log('Processing dry cleaning service');
        const getDryCleaningEstimatedPrice = (serviceName, quantity) => {

          const basePrices = {
            'Basic Dry Cleaning': 200,
            'Premium Dry Cleaning': 350,
            'Delicate Items': 450,
            'Express Service': 500
          };
          const pricePerItem = {
            'Basic Dry Cleaning': 150,
            'Premium Dry Cleaning': 250,
            'Delicate Items': 350,
            'Express Service': 400
          };

          const basePrice = basePrices[serviceName] || 200;
          const perItemPrice = pricePerItem[serviceName] || 150;
          const qty = parseInt(quantity) || 1;

          return basePrice + (perItemPrice * qty);
        };

        const getDryCleaningEstimatedTime = (serviceName) => {
          const times = {
            'Basic Dry Cleaning': '2-3 days',
            'Premium Dry Cleaning': '3-4 days',
            'Delicate Items': '4-5 days',
            'Express Service': '1-2 days'
          };
          return times[serviceName] || '2-3 days';
        };

        const cleaningServiceName = specific_data.serviceName || 'N/A';
        const cleaningQuantity = specific_data.quantity || 1;

        // Price confirmation flow:
        // - previousDryCleaningPrice = customer's old/estimated price (pre-admin update)
        // - finalDryCleaningPrice = admin-updated price (stored in `item.final_price` when available)
        const previousDryCleaningPrice = (() => {
          const bp = parseFloat(item.base_price ?? item.basePrice ?? 0);
          if (Number.isFinite(bp) && bp > 0) return bp;

          const fromSpecific = (
            specific_data?.estimatedPrice !== undefined
              ? parseFloat(specific_data.estimatedPrice) || 0
              : (specific_data?.pricePerItem
                ? (parseFloat(specific_data.pricePerItem) || 0) * (parseInt(cleaningQuantity) || 1)
                : getDryCleaningEstimatedPrice(cleaningServiceName, cleaningQuantity))
          );

          if (fromSpecific > 0) return fromSpecific;

          // Dry cleaning might store the pre-admin price in pricing_factors instead of specific_data.
          const pf = item.pricing_factors || {};
          const pricePerItem = parseFloat(pf.pricePerItem ?? pf.price_per_item ?? 0);
          const qty = parseInt(pf.quantity ?? cleaningQuantity ?? 1, 10) || 1;
          const computed = Number.isFinite(pricePerItem) && pricePerItem > 0 ? (pricePerItem * qty) : 0;
          return computed > 0 ? computed : fromSpecific;
        })();

        const finalDryCleaningPrice = (
          parseFloat(item.final_price) > 0
            ? parseFloat(item.final_price)
            : (specific_data?.finalPrice !== undefined
              ? parseFloat(specific_data.finalPrice) || previousDryCleaningPrice
              : previousDryCleaningPrice)
        );
        const dryCleaningEstimatedTime = specific_data.estimatedTime || getDryCleaningEstimatedTime(cleaningServiceName);

        return (
          <div className="service-details drycleaning-details">
            <h4>Dry Cleaning Details</h4>
            {/* Support multiple images */}
            {specific_data.imageUrls && specific_data.imageUrls.length > 0 ? (
              <div className="detail-row">
                <span className="detail-label">Clothing Photos:</span>
                <div className="detail-value">
                  <SimpleImageCarousel
                    images={specific_data.imageUrls.map((url, idx) => ({ url: `${API_BASE_URL}${url}`, label: `Photo ${idx + 1}/${specific_data.imageUrls.length}` }))}
                    itemName="Clothing Photo"
                    height="280px"
                  />
                </div>
              </div>
            ) : specific_data.imageUrl && specific_data.imageUrl !== 'no-image' && (
              <div className="detail-row">
                <span className="detail-label">Clothing Photo:</span>
                <div className="detail-value">
                  <img
                    src={`${API_BASE_URL}${specific_data.imageUrl}`}
                    alt="Clothing"
                    className="damage-photo clickable-image"
                    onClick={() => openImagePreview(`${API_BASE_URL}${specific_data.imageUrl}`, 'Clothing Photo')}
                    title="Click to enlarge"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              </div>
            )}

            <div className="detail-row">
              <span className="detail-label">Service Name:</span>
              <span className="detail-value">{formatServiceName(cleaningServiceName)}</span>
            </div>

            {/* Multiple garments support */}
            {specific_data.garments && specific_data.garments.length > 0 ? (
              <>
                <div className="detail-row">
                  <span className="detail-label">Garments:</span>
                  <span className="detail-value"><strong>{specific_data.garments.length} item{specific_data.garments.length > 1 ? 's' : ''}</strong></span>
                </div>
                {specific_data.garments.map((garment, idx) => (
                  <div key={idx} className="garment-card" style={{
                    marginTop: '10px',
                    padding: '12px 16px',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '8px',
                    border: '1px solid #e0e0e0',
                    textAlign: 'left'
                  }}>
                    <div style={{ marginBottom: '6px' }}><strong>Garment #{idx + 1}:</strong> {garment.garmentType ? (garment.garmentType.charAt(0).toUpperCase() + garment.garmentType.slice(1)) : 'N/A'}</div>
                    <div style={{ marginBottom: '6px' }}><strong>Brand:</strong> {garment.brand || 'N/A'}</div>
                    <div style={{ marginBottom: '6px' }}><strong>Quantity:</strong> {garment.quantity || 1}</div>
                    <div><strong>Price:</strong> ₱{(garment.pricePerItem * (garment.quantity || 1)).toFixed(2)}</div>
                  </div>
                ))}
              </>
            ) : (
              <>
                <div className="detail-row">
                  <span className="detail-label">Garment Type:</span>
                  <span className="detail-value">{specific_data.garmentType ? (specific_data.garmentType.charAt(0).toUpperCase() + specific_data.garmentType.slice(1)) : 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Brand:</span>
                  <span className="detail-value">{specific_data.brand || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Quantity:</span>
                  <span className="detail-value">{cleaningQuantity} items</span>
                </div>
              </>
            )}

            <div className="detail-row">
              <span className="detail-label">Special Instructions:</span>
              <span className="detail-value">{specific_data.notes || 'None'}</span>
            </div>
            {renderEnhancementInfo(specific_data)}
            <div className="detail-row">
              <span className="detail-label">Drop Off Item Date:</span>
              <span className="detail-value">{formatDateTo12Hour(specific_data.pickupDate)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Estimated Completion Date:</span>
              <span className="detail-value">
                {specific_data.estimatedCompletionDate || specific_data.estimated_completion_date
                  ? formatDate(specific_data.estimatedCompletionDate || specific_data.estimated_completion_date)
                  : 'N/A'}
              </span>
            </div>
            {item.status === 'price_confirmation' ? (
              <>
                <div className="detail-row">
                  <span className="detail-label">Previous Price:</span>
                  <span className="detail-value">₱{previousDryCleaningPrice.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Final Price:</span>
                  <span className="detail-value">₱{finalDryCleaningPrice.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
              </>
            ) : (
              <div className="detail-row">
                <span className="detail-label">{item.status === 'pending' ? 'Estimated Price:' : 'Final Price:'}</span>
                <span className="detail-value">
                  ₱{(item.status === 'pending' ? previousDryCleaningPrice : finalDryCleaningPrice).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </span>
              </div>
            )}
          </div>
        );

      default:
        console.log('No case matched, falling to default');
        return (
          <div className="service-details">
            <h4>Service Details</h4>
            <div className="detail-row">
              <span className="detail-label">Service Type:</span>
              <span className="detail-value">{formatServiceType(service_type)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Details:</span>
              <span className="detail-value">{JSON.stringify(specific_data, null, 2)}</span>
            </div>
          </div>
        );
    }
  };

  const getStatusDotClass = (currentStatus, stepStatus, serviceType = null) => {

    const rentalFlow = ['pending', 'ready_to_pickup', 'ready_for_pickup', 'rented', 'returned'];

    const defaultFlow = ['pending', 'price_confirmation', 'accepted', 'in_progress', 'ready_to_pickup', 'completed'];

    const statusFlow = serviceType === 'rental' ? rentalFlow : defaultFlow;

    const normalizedCurrent = currentStatus === 'ready_for_pickup' ? 'ready_to_pickup' : currentStatus;
    const normalizedStep = stepStatus === 'ready_for_pickup' ? 'ready_to_pickup' : stepStatus;

    const currentIndex = statusFlow.indexOf(normalizedCurrent);
    const stepIndex = statusFlow.indexOf(normalizedStep);

    if (stepStatus === 'price_confirmation' && currentIndex > 0) {

      return 'completed';
    }

    if (currentIndex >= stepIndex) {
      return 'completed';
    } else {
      return 'pending';
    }
  };

  const getTimelineDate = (updatedAt, currentStatus, stepStatus, serviceType = null) => {

    const rentalFlow = ['pending', 'ready_to_pickup', 'ready_for_pickup', 'rented', 'returned'];

    const defaultFlow = ['pending', 'price_confirmation', 'accepted', 'in_progress', 'ready_to_pickup', 'completed'];

    const statusFlow = serviceType === 'rental' ? rentalFlow : defaultFlow;

    const normalizedCurrent = currentStatus === 'ready_for_pickup' ? 'ready_to_pickup' : currentStatus;
    const normalizedStep = stepStatus === 'ready_for_pickup' ? 'ready_to_pickup' : stepStatus;

    const currentIndex = statusFlow.indexOf(normalizedCurrent);
    const stepIndex = statusFlow.indexOf(normalizedStep);

    if (stepStatus === 'price_confirmation' && currentIndex > 1 && currentIndex !== 1) {

      return formatDate(updatedAt);
    }

    if (currentIndex >= stepIndex) {
      if (stepIndex === 0) {
        return formatDate(updatedAt);
      } else if (currentIndex === stepIndex) {
        return formatDate(updatedAt);
      } else {
        return formatDate(updatedAt);
      }
    } else {
      return 'Pending';
    }
  };

  const getTimelineItemClass = (currentStatus, stepStatus, serviceType = null) => {

    const rentalFlow = ['pending', 'ready_to_pickup', 'ready_for_pickup', 'rented', 'returned'];

    const defaultFlow = ['pending', 'price_confirmation', 'accepted', 'in_progress', 'ready_to_pickup', 'completed'];

    const statusFlow = serviceType === 'rental' ? rentalFlow : defaultFlow;

    const normalizedCurrent = currentStatus === 'ready_for_pickup' ? 'ready_to_pickup' : currentStatus;
    const normalizedStep = stepStatus === 'ready_for_pickup' ? 'ready_to_pickup' : stepStatus;

    const currentIndex = statusFlow.indexOf(normalizedCurrent);
    const stepIndex = statusFlow.indexOf(normalizedStep);

    if (stepStatus === 'price_confirmation' && currentIndex > 0) {
      return 'completed';
    }

    return currentIndex >= stepIndex ? 'completed' : '';
  };

  const getPaymentStatusBadgeClass = (paymentStatus) => {
    const statusMap = {
      'unpaid': 'unpaid',
      'paid': 'paid',
      'down-payment': 'down-payment',
      'fully_paid': 'fully-paid',
      'cancelled': 'cancelled'
    };
    return statusMap[paymentStatus] || 'unknown';
  };

  const getEstimatedPrice = (specificData, serviceType) => {
    const normalizedService = String(serviceType || '')
      .toLowerCase()
      .replace(/-/g, '_')
      .trim();

    if (!specificData) return 0;

    if (normalizedService === 'repair') {
      // Repair "previous price" may be stored as `estimatedPrice`,
      // or derived from garments' base prices if `estimatedPrice` is missing.
      const estimated = parseFloat(specificData.estimatedPrice ?? specificData.estimated_price ?? 0);
      if (Number.isFinite(estimated) && estimated > 0) return estimated;

      const garments = Array.isArray(specificData.garments) ? specificData.garments : [];
      if (garments.length > 0) {
        return garments.reduce((sum, garment) => {
          const gp = parseFloat(garment?.basePrice ?? garment?.base_price ?? 0);
          return sum + (Number.isFinite(gp) ? gp : 0);
        }, 0);
      }

      const basePrice = parseFloat(specificData.basePrice ?? specificData.base_price ?? 0);
      return Number.isFinite(basePrice) ? basePrice : 0;
    }

    if (
      normalizedService === 'dry_cleaning' ||
      normalizedService === 'drycleaning' ||
      normalizedService === 'dry_cleaning' ||
      normalizedService === 'dry_cleaning'
    ) {
      // For dry cleaning, the pre-admin/update price is typically stored as `finalPrice`
      // inside `specific_data`, while the admin-updated value is in `item.final_price`.
      const prePrice = parseFloat(specificData.finalPrice ?? specificData.final_price ?? 0);
      if (Number.isFinite(prePrice) && prePrice > 0) return prePrice;

      const pricePerItem = parseFloat(specificData.pricePerItem ?? specificData.price_per_item ?? 0);
      const quantity = parseInt(specificData?.quantity ?? 1, 10) || 1;
      if (Number.isFinite(pricePerItem) && pricePerItem > 0) return pricePerItem * quantity;

      // Fallback to service name pricing (if stored).
      const serviceName = specificData?.serviceName || '';
      const quantityFallback = parseInt(specificData?.quantity ?? 1, 10) || 1;
      const basePrices = {
        'Basic Dry Cleaning': 200,
        'Premium Dry Cleaning': 350,
        'Delicate Items': 450,
        'Express Service': 500
      };
      const perItemPrices = {
        'Basic Dry Cleaning': 150,
        'Premium Dry Cleaning': 250,
        'Delicate Items': 350,
        'Express Service': 400
      };
      const basePrice = basePrices[serviceName] || 200;
      const perItemPrice = perItemPrices[serviceName] || 150;
      return basePrice + (perItemPrice * quantityFallback);
    }

    if (normalizedService === 'customization' || normalizedService === 'customize') {
      const estimated = parseFloat(specificData.estimatedPrice ?? specificData.estimated_price ?? 0);
      if (Number.isFinite(estimated) && estimated > 0) return estimated;

      const maybeFinal = parseFloat(specificData.finalPrice ?? specificData.final_price ?? 0);
      if (Number.isFinite(maybeFinal) && maybeFinal > 0) return maybeFinal;

      // Try summing garments if present.
      const garments = Array.isArray(specificData.garments) ? specificData.garments : [];
      if (garments.length > 0) {
        const sum = garments.reduce((acc, garment) => {
          const gp = parseFloat(garment?.basePrice ?? garment?.base_price ?? 0);
          return acc + (Number.isFinite(gp) ? gp : 0);
        }, 0);
        if (sum > 0) return sum;
      }

      return 0;
    }

    return 0;
  };

  const hasPriceChanged = (specificData, finalPrice, serviceType, pricingFactors = null) => {
    console.log('=== DEBUG hasPriceChanged ===');
    console.log('specificData:', specificData);
    console.log('finalPrice:', finalPrice);
    console.log('serviceType:', serviceType);
    console.log('pricingFactors:', pricingFactors);

    if (pricingFactors?.adminPriceUpdated === true || specificData?.adminPriceUpdated === true) {
      console.log('Admin price updated flag is TRUE');
      return true;
    }

    console.log('adminPriceUpdated flag in pricing_factors:', pricingFactors?.adminPriceUpdated);
    console.log('adminPriceUpdated flag in specific_data:', specificData?.adminPriceUpdated);

    const estimatedPrice = getEstimatedPrice(specificData, serviceType);
    console.log('Estimated price:', estimatedPrice);

    const adminNotes = pricingFactors?.adminNotes || specificData?.adminNotes;
    if (estimatedPrice > 0 && adminNotes) {
      const difference = Math.abs(finalPrice - estimatedPrice);
      console.log('Price difference:', difference);
      console.log('Difference > 0.01:', difference > 0.01);
      return difference > 0.01;
    }

    console.log('No price change detected');
    return false;
  };

  const shouldShowPriceConfirmation = (item) => {
    console.log('=== DEBUG shouldShowPriceConfirmation ===');
    console.log('Item status:', item.status);
    console.log('Item final_price:', item.final_price);
    console.log('Item specific_data:', item.specific_data);
    console.log('Item service_type:', item.service_type);

    const isPriceConfirmationStatus = item.status === 'price_confirmation';
    console.log('Is price confirmation status:', isPriceConfirmationStatus);

    if (isPriceConfirmationStatus) {
      console.log('Price confirmation status detected - showing buttons');
      return true;
    }

    return false;
  };

  const getFilteredOrders = () => {
    if (statusFilter === 'all') {
      return orders;
    }
    return orders.filter(order =>
      order.items.some(item => item.status === statusFilter || (statusFilter === 'cancelled' && (item.status === 'rejected' || item.status === 'price_declined')))
    );
  };

  const getAllOrderItems = () => {
    const allItems = [];

    orders.forEach(order => {
      order.items.forEach(item => {

        const matchesStatus = statusFilter === 'all' || item.status === statusFilter || (statusFilter === 'cancelled' && (item.status === 'rejected' || item.status === 'price_declined'));

        let matchesService = false;
        if (serviceFilter === 'all') {
          matchesService = true;
        } else {
          const itemServiceType = item.service_type?.toLowerCase();
          const filterServiceType = serviceFilter.toLowerCase();

          if (filterServiceType === 'customize') {
            matchesService = itemServiceType === 'customization' || itemServiceType === 'customize';
          } else if (filterServiceType === 'dry_cleaning') {
            matchesService = itemServiceType === 'dry_cleaning' || itemServiceType === 'drycleaning' || itemServiceType === 'dry-cleaning';
          } else {
            matchesService = itemServiceType === filterServiceType;
          }
        }

        if (matchesStatus && matchesService) {
          allItems.push({
            order_id: order.order_id,
            order_item_id: item.order_item_id,
            service_type: item.service_type,
            status: item.status,
            status_label: item.status_label,
            status_class: item.status_class,
            base_price: item.base_price,
            final_price: item.final_price,
            order_date: order.order_date,
            status_updated_at: item.status_updated_at,
            specific_data: item.specific_data,
            pricing_factors: item.pricing_factors,
            rental_start_date: item.rental_start_date,
            rental_end_date: item.rental_end_date
          });
        }
      });
    });

    allItems.sort((a, b) => {

      const dateA = a.status_updated_at ? new Date(a.status_updated_at) : new Date(a.order_date);
      const dateB = b.status_updated_at ? new Date(b.status_updated_at) : new Date(b.order_date);

      return dateB - dateA;
    });

    return allItems;
  };

  const getStatusCounts = (forService = serviceFilter) => {
    const counts = {
      all: 0,
      pending: 0,
      accepted: 0,
      price_confirmation: 0,
      in_progress: 0,
      ready_to_pickup: 0,
      rented: 0,
      returned: 0,
      completed: 0,
      cancelled: 0,
      price_declined: 0
    };

    orders.forEach(order => {
      order.items.forEach(item => {
        // Apply service filter to counts
        let matchesService = true;
        if (forService !== 'all') {
          const itemServiceType = item.service_type?.toLowerCase();
          const filterServiceType = forService.toLowerCase();
          if (filterServiceType === 'customize') {
            matchesService = itemServiceType === 'customization' || itemServiceType === 'customize';
          } else if (filterServiceType === 'dry_cleaning') {
            matchesService = itemServiceType === 'dry_cleaning' || itemServiceType === 'drycleaning' || itemServiceType === 'dry-cleaning';
          } else {
            matchesService = itemServiceType === filterServiceType;
          }
        }
        if (!matchesService) return;

        if (item.status === 'rejected' || item.status === 'price_declined') {
          counts.cancelled++;
        } else if (counts[item.status] !== undefined) {
          counts[item.status]++;
        }
        counts.all++;
      });
    });

    return counts;
  };

  const getServiceCounts = () => {
    const counts = {
      all: 0,
      repair: 0,
      customize: 0,
      dry_cleaning: 0,
      rental: 0
    };

    orders.forEach(order => {
      order.items.forEach(item => {

        let serviceKey = item.service_type;

        if (serviceKey === 'customization' || serviceKey === 'customize') {
          serviceKey = 'customize';
        } else if (serviceKey === 'drycleaning' || serviceKey === 'dry-cleaning') {
          serviceKey = 'dry_cleaning';
        }

        if (counts[serviceKey] !== undefined) {
          counts[serviceKey]++;
        }

        counts.all++;
      });
    });

    return counts;
  };

  return (
    <div className="profile-page">
      <div className="top-btn-wrapper">
        <button
          className="back-to-home-btn"
          onClick={() => navigate('/user-home')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Back to Home</span>
        </button>
      </div>
      <header className="header">
        <div className="logo">
          <img src={logo} alt="Logo" className="logo-img" />
          <span className="logo-text">D’jackman Tailor Deluxe</span>
        </div>

        <div className="user-info">
          <button className="profile-button icon-button" aria-label="Profile">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="#8B4513" strokeWidth="2" fill="none"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke="#8B4513" strokeWidth="2" fill="none"/></svg>
          </button>
        </div>
      </header>
      <main className="profile-main">
        <h2 className="section-title">User Information</h2>

        <div className="user-info-card">
          <div className="user-card-row">
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {profilePicUrl ? (
                <img
                  src={profilePicUrl}
                  alt="User"
                  className="user-avatar"
                  style={{ objectFit: 'cover', borderRadius: '50%' }}
                />
              ) : (
                <img src={dp} alt="User" className="user-avatar" />
              )}
            </div>
            <div style={{ flex: 1, width: '100%' }}>
              <>
                <div className="user-name">
                  {(user && (user.first_name || user.name)) ? `${user.first_name || user.name || ''} ${user.last_name || ''}`.trim() : 'User'}
                </div>
                <div style={{ marginTop: '12px', fontSize: '14px', color: '#666' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Email:</strong> {(user && user.email) ? user.email : 'Not provided'}
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Contact Number:</strong> {(user && user.phone_number) ? user.phone_number : 'Not provided'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '15px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Edit Profile button clicked, current isEditingProfile:', isEditingProfile);
                      setIsEditingProfile(true);
                    }}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#8B4513',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      transition: 'background 0.3s ease',
                      zIndex: 10,
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#6B3410'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#8B4513'}
                  >
                    Edit Profile
                  </button>
                  <button
                    onClick={async () => {
                      setLoadingMeasurements(true);
                      setMeasurementsModalOpen(true);
                      const result = await getMyMeasurements();
                      if (result.success && result.measurements) {
                        setMeasurements(result.measurements);
                      } else {
                        setMeasurements(null);
                      }
                      setLoadingMeasurements(false);
                    }}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#8B4513',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      transition: 'background 0.3s ease'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#6B3410'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#8B4513'}
                  >
                    View Measurements
                  </button>
                </div>
              </>
            </div>
          </div>
        </div>

        <h2 className="section-title">Order Tracking</h2>
        <div style={{ marginBottom: '30px' }}>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ marginBottom: '10px', fontWeight: 'bold', color: '#333', fontSize: '14px' }}>Service Type:</div>
            <div className="status-filters">
              <button
                className={`filter-btn ${serviceFilter === 'all' ? 'active' : ''}`}
                onClick={() => { setServiceFilter('all'); setStatusFilter('all'); }}
              >
                All ({getServiceCounts().all})
              </button>
              <button
                className={`filter-btn ${serviceFilter === 'repair' ? 'active' : ''}`}
                onClick={() => { setServiceFilter('repair'); setStatusFilter('all'); }}
              >
                Repair ({getServiceCounts().repair})
              </button>
              <button
                className={`filter-btn ${serviceFilter === 'customize' ? 'active' : ''}`}
                onClick={() => { setServiceFilter('customize'); setStatusFilter('all'); }}
              >
                Customize ({getServiceCounts().customize})
              </button>
              <button
                className={`filter-btn ${serviceFilter === 'dry_cleaning' ? 'active' : ''}`}
                onClick={() => { setServiceFilter('dry_cleaning'); setStatusFilter('all'); }}
              >
                Dry Cleaning ({getServiceCounts().dry_cleaning})
              </button>
              <button
                className={`filter-btn ${serviceFilter === 'rental' ? 'active' : ''}`}
                onClick={() => { setServiceFilter('rental'); setStatusFilter('all'); }}
              >
                Rental ({getServiceCounts().rental})
              </button>
            </div>
          </div>
          <div>
            <div style={{ marginBottom: '10px', fontWeight: 'bold', color: '#333', fontSize: '14px' }}>Status:</div>
            <div className="status-filters">
              <button
                className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                All ({getStatusCounts().all})
              </button>
              {serviceFilter === 'rental' ? (
                <>
                  <button
                    className={`filter-btn ${statusFilter === 'pending' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('pending')}
                  >
                    Order Placed ({getStatusCounts().pending})
                  </button>
                  <button
                    className={`filter-btn ${statusFilter === 'ready_to_pickup' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('ready_to_pickup')}
                  >
                    Ready to Pick Up ({getStatusCounts().ready_to_pickup})
                  </button>
                  <button
                    className={`filter-btn ${statusFilter === 'rented' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('rented')}
                  >
                    Rented ({getStatusCounts().rented})
                  </button>
                  <button
                    className={`filter-btn ${statusFilter === 'returned' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('returned')}
                  >
                    Returned ({getStatusCounts().returned})
                  </button>
                </>
              ) : (
                <>
                  <button
                    className={`filter-btn ${statusFilter === 'pending' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('pending')}
                  >
                    Pending ({getStatusCounts().pending})
                  </button>
                  {serviceFilter !== 'dry_cleaning' && (
                    <button
                      className={`filter-btn ${statusFilter === 'price_confirmation' ? 'active' : ''}`}
                      onClick={() => setStatusFilter('price_confirmation')}
                    >
                      Price Confirmation ({getStatusCounts().price_confirmation})
                    </button>
                  )}
                  <button
                    className={`filter-btn ${statusFilter === 'in_progress' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('in_progress')}
                  >
                    In Progress ({getStatusCounts().in_progress})
                  </button>
                  <button
                    className={`filter-btn ${statusFilter === 'ready_to_pickup' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('ready_to_pickup')}
                  >
                    Ready to Pickup ({getStatusCounts().ready_to_pickup})
                  </button>
                  <button
                    className={`filter-btn ${statusFilter === 'rented' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('rented')}
                  >
                    Rented ({getStatusCounts().rented})
                  </button>
                  <button
                    className={`filter-btn ${statusFilter === 'returned' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('returned')}
                  >
                    Returned ({getStatusCounts().returned})
                  </button>
                  <button
                    className={`filter-btn ${statusFilter === 'completed' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('completed')}
                  >
                    Completed ({getStatusCounts().completed})
                  </button>
                  <button
                    className={`filter-btn ${statusFilter === 'cancelled' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('cancelled')}
                  >
                    Cancelled ({getStatusCounts().cancelled})
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="order-section">
          {loading ? (
            <div className="loading-message">Loading orders...</div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : getAllOrderItems().length === 0 ? (
            <div className="no-orders">No orders found</div>
          ) : (
            <div className="order-cards">
              {getAllOrderItems().map((item) => {
                const estimatedPrice = getEstimatedPrice(item.specific_data, item.service_type);
                const priceChanged = hasPriceChanged(item.specific_data, item.final_price, item.service_type, item.pricing_factors);

                const isRental = item.service_type === 'rental';
                const isRepair = item.service_type === 'repair';
                const isDryCleaning = item.service_type === 'dry_cleaning' || item.service_type === 'drycleaning';
                const isCustomization = item.service_type === 'customization' || item.service_type === 'customize';

                const pricingFactors = typeof item.pricing_factors === 'string'
                  ? JSON.parse(item.pricing_factors || '{}')
                  : (item.pricing_factors || {});
                const amountPaid = parseFloat(pricingFactors.amount_paid || 0);
                const downpayment = parseFloat(pricingFactors.downpayment || item.specific_data?.downpayment || 0);
                const finalPrice = parseFloat(item.final_price || 0);

                const totalPaid = amountPaid;
                const remainingAmount = Math.max(0, finalPrice - totalPaid);
                const hasPayment = totalPaid > 0 && (isRental || isRepair || isDryCleaning || isCustomization);
                const adminPriceReason = (pricingFactors?.adminNotes || item.specific_data?.adminNotes || '').toString().trim();

                const isUniform = isCustomization && (
                  item.specific_data?.garmentType?.toLowerCase() === 'uniform' ||
                  item.specific_data?.isUniform === true ||
                  item.pricing_factors?.isUniform === true
                );

                return (
                  <div key={`${item.order_id}-${item.order_item_id}-${item.service_type}-${item.status_updated_at || Date.now()}`} className="order-card">
                    <div className="order-header">
                      <div className="order-info">
                        <h3 className="order-id">ORD-{item.order_id}</h3>
                        <span className="service-type">
                          {formatServiceType(item.service_type)}
                          {item.specific_data?.serviceName && (
                            <span className="service-name">
                              {" " + formatServiceName(item.specific_data.serviceName)}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="order-status" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className={`status-badge ${getStatusBadgeClass(item.status)}`}>
                        {getStatusLabel(item.status)}
                      </span>
                      {item.payment_status_display && (
                        <span className={`status-badge ${getPaymentStatusBadgeClass(item.payment_status)}`}>
                          💳 {item.payment_status_display}
                        </span>
                      )}
                    </div>
                    {isRental && (item.status === 'rented' || item.status === 'picked_up') && item.rental_end_date && (() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const endDate = new Date(item.rental_end_date);
                      endDate.setHours(0, 0, 0, 0);
                      const diffTime = endDate - today;
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                      if (diffDays < 0) {
                        const daysOverdue = Math.abs(diffDays);
                        const penaltyAmount = daysOverdue * 100;
                        return (
                          <div style={{
                            backgroundColor: '#f8d7da',
                            border: '1px solid #f5c6cb',
                            borderRadius: '8px',
                            padding: '12px 16px',
                            marginTop: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                          }}>
                            <span style={{ fontSize: '24px' }}>🚨</span>
                            <div>
                              <div style={{ color: '#721c24', fontWeight: '600', fontSize: '14px' }}>
                                OVERDUE: {daysOverdue} day{daysOverdue > 1 ? 's' : ''} past due date!
                              </div>
                              <div style={{ color: '#721c24', fontSize: '13px', marginTop: '4px' }}>
                                Current penalty: <strong>₱{penaltyAmount.toLocaleString()}</strong> (₱100/day)
                              </div>
                              <div style={{ color: '#856404', fontSize: '12px', marginTop: '4px' }}>
                                Please return immediately to avoid additional charges.
                              </div>
                            </div>
                          </div>
                        );
                      }

                      else if (diffDays === 0) {
                        return (
                          <div style={{
                            backgroundColor: '#fff3cd',
                            border: '1px solid #ffc107',
                            borderRadius: '8px',
                            padding: '12px 16px',
                            marginTop: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                          }}>
                            <span style={{ fontSize: '24px' }}>⏰</span>
                            <div>
                              <div style={{ color: '#856404', fontWeight: '600', fontSize: '14px' }}>
                                DUE TODAY! Please return the item today.
                              </div>
                              <div style={{ color: '#856404', fontSize: '12px', marginTop: '4px' }}>
                                Late returns will incur a penalty of ₱100 per day.
                              </div>
                            </div>
                          </div>
                        );
                      }

                      else if (diffDays <= 3) {
                        return (
                          <div style={{
                            backgroundColor: '#e7f3ff',
                            border: '1px solid #b3d7ff',
                            borderRadius: '8px',
                            padding: '12px 16px',
                            marginTop: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                          }}>
                            <span style={{ fontSize: '24px' }}>📅</span>
                            <div>
                              <div style={{ color: '#004085', fontWeight: '600', fontSize: '14px' }}>
                                Return in {diffDays} day{diffDays > 1 ? 's' : ''} ({new Date(item.rental_end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})
                              </div>
                              <div style={{ color: '#004085', fontSize: '12px', marginTop: '4px' }}>
                                Late returns will incur a penalty of ₱100 per day.
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    {(estimatedPrice > 0 || item.final_price > 0) && (
                      <div className="price-comparison">
                        {isRental && item.status === 'rented' ? (
                          <>
                            <div className="price-row">
                              <span className="price-label">Rental Price:</span>
                              <span className="price-value final">₱{finalPrice.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                            </div>
                            <div className="price-row">
                              <span className="price-label">Deposit (Refundable):</span>
                              <span className="price-value" style={{ color: '#ff9800' }}>₱{downpayment.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                            </div>
                            <div className="price-row" style={{ borderTop: '2px solid #e0e0e0', paddingTop: '8px', marginTop: '8px' }}>
                              <span className="price-label" style={{ fontWeight: 'bold', fontSize: '16px' }}>Total Payment:</span>
                              <span className="price-value" style={{ fontWeight: 'bold', fontSize: '18px', color: '#2d5a3d' }}>
                                ₱{(finalPrice + downpayment).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                              </span>
                            </div>
                            <div className="price-row">
                              <span className="price-label">Amount Paid:</span>
                              <span className="price-value" style={{ color: '#4caf50' }}>₱{totalPaid.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                            </div>
                            <div className="price-row" style={{ borderTop: '2px solid #e0e0e0', paddingTop: '8px', marginTop: '8px' }}>
                              <span className="price-label" style={{ fontWeight: 'bold', fontSize: '16px' }}>Remaining Amount:</span>
                              <span className="price-value" style={{ fontWeight: 'bold', fontSize: '18px', color: '#ff9800' }}>
                                ₱{remainingAmount.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                              </span>
                            </div>
                            <div style={{ marginTop: '8px', padding: '10px', backgroundColor: '#fff3e0', borderRadius: '6px', fontSize: '13px', color: '#666' }}>
                              💡 Pay the remaining amount when you return the rental item.
                            </div>
                          </>
                        ) : item.status === 'pending' ? (

                          (() => {
                            const isRentalService = item.service_type === 'rental';
                            const isDryCleaning = item.service_type === 'dry_cleaning' || item.service_type === 'drycleaning';
                            const isEstimated = item.specific_data?.isEstimatedPrice === true;

                            if (isRentalService) {
                              return (
                                <>
                                  <div className="price-row">
                                    <span className="price-label">Rental Price:</span>
                                    <span className="price-value final">₱{parseFloat(item.final_price || 0).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                  </div>
                                  <div className="price-row">
                                    <span className="price-label">Deposit (Refundable):</span>
                                    <span className="price-value" style={{ color: '#ff9800' }}>₱{downpayment.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                  </div>
                                  <div className="price-row" style={{ borderTop: '2px solid #e0e0e0', paddingTop: '8px', marginTop: '8px' }}>
                                    <span className="price-label" style={{ fontWeight: 'bold', fontSize: '16px' }}>Total Payment:</span>
                                    <span className="price-value" style={{ fontWeight: 'bold', fontSize: '18px', color: '#2d5a3d' }}>
                                      ₱{(parseFloat(item.final_price || 0) + downpayment).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                    </span>
                                  </div>
                                </>
                              );
                            }

                            if (isDryCleaning) {
                              if (isEstimated) {
                                return (
                                  <div className="price-row">
                                    <span className="price-label">Estimated Price:</span>
                                    <span className="price-value estimated">₱{estimatedPrice.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                  </div>
                                );
                              } else {
                                return (
                                  <div className="price-row">
                                    <span className="price-label">Final Price:</span>
                                    <span className="price-value final">₱{parseFloat(item.final_price).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                  </div>
                                );
                              }
                            }

                            return estimatedPrice > 0 ? (
                              <div className="price-row">
                                <span className="price-label">Estimated Price:</span>
                                <span className="price-value estimated">₱{estimatedPrice.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                              </div>
                            ) : null;
                          })()
                        ) : item.status === 'price_confirmation' ? (

                          <>
                            <div className="price-row">
                              <span className="price-label">Previous Price:</span>
                              <span className="price-value estimated">
                                ₱{(() => {
                                  const bp = parseFloat(item.base_price ?? item.basePrice ?? 0);
                                  const fallback = estimatedPrice;
                                  let prev = Number.isFinite(bp) && bp > 0 ? bp : fallback;

                                  // Dry cleaning may have `base_price = 0`, so fall back to pricing_factors.
                                  if ((!Number.isFinite(prev) || prev <= 0) && (item.service_type === 'dry_cleaning' || item.service_type === 'drycleaning' || item.service_type === 'dry-cleaning')) {
                                    const pf = item.pricing_factors || {};
                                    const pricePerItem = parseFloat(pf.pricePerItem ?? pf.price_per_item ?? 0);
                                    const qty = parseInt(pf.quantity ?? item.specific_data?.quantity ?? 1, 10) || 1;
                                    const computed = Number.isFinite(pricePerItem) && pricePerItem > 0 ? (pricePerItem * qty) : 0;
                                    if (computed > 0) prev = computed;
                                  }

                                  return prev > 0
                                    ? prev.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                    : 'N/A';
                                })()}
                              </span>
                            </div>
                            <div className="price-row">
                              <span className="price-label">Final Price:</span>
                              <span className={`price-value ${priceChanged ? 'changed' : 'same'}`}>
                                ₱{parseFloat(item.final_price).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                {priceChanged && <span className="price-change-indicator">⚠️ Updated by Admin</span>}
                              </span>
                            </div>
                            {priceChanged && adminPriceReason && (
                              <div className="admin-notes">
                                <span className="notes-label">Price Change Reason:</span>
                                <span className="notes-text">{adminPriceReason}</span>
                              </div>
                            )}
                            {hasPayment && (
                              <>
                                <div className="price-row">
                                  <span className="price-label">Amount Paid:</span>
                                  <span className="price-value" style={{ color: '#4caf50' }}>₱{totalPaid.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                </div>
                                {remainingAmount > 0 && (
                                  <div className="price-row" style={{ borderTop: '2px solid #e0e0e0', paddingTop: '8px', marginTop: '8px' }}>
                                    <span className="price-label" style={{ fontWeight: 'bold', fontSize: '16px' }}>Remaining Amount:</span>
                                    <span className="price-value" style={{ fontWeight: 'bold', fontSize: '18px', color: '#ff9800' }}>
                                      ₱{remainingAmount.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                    </span>
                                  </div>
                                )}
                              </>
                            )}
                          </>
                        ) : (

                          (() => {
                            const isDryCleaning = item.service_type === 'dry_cleaning' || item.service_type === 'drycleaning';
                            const isEstimated = item.specific_data?.isEstimatedPrice === true;

                            if (isDryCleaning && isEstimated) {
                              return (
                                <>
                                  <div className="price-row">
                                    <span className="price-label">Estimated Price:</span>
                                    <span className="price-value estimated">₱{parseFloat(item.final_price).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                  </div>
                                  {hasPayment && (
                                    <>
                                      <div className="price-row">
                                        <span className="price-label">Amount Paid:</span>
                                        <span className="price-value" style={{ color: '#4caf50' }}>₱{totalPaid.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                      </div>
                                      {remainingAmount > 0 && (
                                        <div className="price-row" style={{ borderTop: '2px solid #e0e0e0', paddingTop: '8px', marginTop: '8px' }}>
                                          <span className="price-label" style={{ fontWeight: 'bold', fontSize: '16px' }}>Remaining Amount:</span>
                                          <span className="price-value" style={{ fontWeight: 'bold', fontSize: '18px', color: '#ff9800' }}>
                                            ₱{remainingAmount.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                          </span>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </>
                              );
                            }

                            return (
                              <>
                                <div className="price-row">
                                  <span className="price-label">Final Price:</span>
                                  <span className="price-value final">₱{parseFloat(item.final_price).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                </div>
                                {priceChanged && adminPriceReason && (
                                  <div className="admin-notes">
                                    <span className="notes-label">Price Change Reason:</span>
                                    <span className="notes-text">{adminPriceReason}</span>
                                  </div>
                                )}
                                {hasPayment && (
                                  <>
                                    <div className="price-row">
                                      <span className="price-label">Amount Paid:</span>
                                      <span className="price-value" style={{ color: '#4caf50' }}>₱{totalPaid.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                    </div>
                                    {remainingAmount > 0 && (
                                      <div className="price-row" style={{ borderTop: '2px solid #e0e0e0', paddingTop: '8px', marginTop: '8px' }}>
                                        <span className="price-label" style={{ fontWeight: 'bold', fontSize: '16px' }}>Remaining Amount:</span>
                                        <span className="price-value" style={{ fontWeight: 'bold', fontSize: '18px', color: '#ff9800' }}>
                                          ₱{remainingAmount.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                        </span>
                                      </div>
                                    )}
                                  </>
                                )}
                              </>
                            );
                          })()
                        )}
                      </div>
                    )}
                    {item.service_type === 'rental' && (item.status === 'ready_to_pickup' || item.status === 'ready_for_pickup') && (
                      <div className="downpayment-info" style={{
                        background: '#fff3e0',
                        border: '2px solid #ff9800',
                        borderRadius: '8px',
                        padding: '15px',
                        marginBottom: '20px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '24px' }}>💰</span>
                          <strong style={{ color: '#e65100', fontSize: '16px' }}>Deposit Payment Required</strong>
                        </div>
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                          Please pay the deposit amount when picking up your rental item from the store.
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ff9800' }}>
                          Deposit Amount: ₱{parseFloat(item.pricing_factors?.downpayment || item.specific_data?.downpayment || 0).toLocaleString()}
                        </div>
                      </div>
                    )}

                    <div className="order-timeline">
                      <div className="timeline-container">
                        {item.service_type === 'rental' ? (
                          <>
                            <div className={`timeline-item ${getTimelineItemClass(item.status, 'pending', 'rental')}`}>
                              <div className={`timeline-dot ${getStatusDotClass(item.status, 'pending', 'rental')}`}></div>
                              <div className="timeline-content">
                                <div className="timeline-title">Order Placed</div>
                                <div className="timeline-date">{formatDate(item.order_date)}</div>
                              </div>
                            </div>

                            <div className={`timeline-item ${getTimelineItemClass(item.status, 'ready_to_pickup', 'rental')}`}>
                              <div className={`timeline-dot ${getStatusDotClass(item.status, 'ready_to_pickup', 'rental')}`}></div>
                              <div className="timeline-content">
                                <div className="timeline-title">Ready to Pick Up</div>
                                <div className="timeline-date">{getTimelineDate(item.status_updated_at, item.status, 'ready_to_pickup', 'rental')}</div>
                              </div>
                            </div>

                            <div className={`timeline-item ${getTimelineItemClass(item.status, 'rented', 'rental')}`}>
                              <div className={`timeline-dot ${getStatusDotClass(item.status, 'rented', 'rental')}`}></div>
                              <div className="timeline-content">
                                <div className="timeline-title">Rented</div>
                                <div className="timeline-date">{getTimelineDate(item.status_updated_at, item.status, 'rented', 'rental')}</div>
                              </div>
                            </div>

                            <div className={`timeline-item ${getTimelineItemClass(item.status, 'returned', 'rental')}`}>
                              <div className={`timeline-dot ${getStatusDotClass(item.status, 'returned', 'rental')}`}></div>
                              <div className="timeline-content">
                                <div className="timeline-title">Returned</div>
                                <div className="timeline-date">{getTimelineDate(item.status_updated_at, item.status, 'returned', 'rental')}</div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className={`timeline-item ${getTimelineItemClass(item.status, 'pending')}`}>
                              <div className={`timeline-dot ${getStatusDotClass(item.status, 'pending')}`}></div>
                              <div className="timeline-content">
                                <div className="timeline-title">Order Placed</div>
                                <div className="timeline-date">{formatDate(item.order_date)}</div>
                              </div>
                            </div>
                            {!(String(item.service_type || '').toLowerCase() === 'dry_cleaning' || String(item.service_type || '').toLowerCase() === 'dry-cleaning' || String(item.service_type || '').toLowerCase() === 'drycleaning') && (
                              <div className={`timeline-item ${getTimelineItemClass(item.status, 'price_confirmation', item.service_type)}`}>
                                <div className={`timeline-dot ${getStatusDotClass(item.status, 'price_confirmation', item.service_type)}`}></div>
                                <div className="timeline-content">
                                  <div className="timeline-title">Price Confirmation</div>
                                  <div className="timeline-date">{getTimelineDate(item.status_updated_at, item.status, 'price_confirmation', item.service_type)}</div>
                                </div>
                              </div>
                            )}
                            <div className={`timeline-item ${getTimelineItemClass(item.status, 'accepted', item.service_type)}`}>
                              <div className={`timeline-dot ${getStatusDotClass(item.status, 'accepted', item.service_type)}`}></div>
                              <div className="timeline-content">
                                <div className="timeline-title">Accepted</div>
                                <div className="timeline-date">{getTimelineDate(item.status_updated_at, item.status, 'accepted', item.service_type)}</div>
                              </div>
                            </div>

                            <div className={`timeline-item ${getTimelineItemClass(item.status, 'in_progress')}`}>
                              <div className={`timeline-dot ${getStatusDotClass(item.status, 'in_progress')}`}></div>
                              <div className="timeline-content">
                                <div className="timeline-title">In Progress</div>
                                <div className="timeline-date">{getTimelineDate(item.status_updated_at, item.status, 'in_progress')}</div>
                              </div>
                            </div>

                            <div className={`timeline-item ${getTimelineItemClass(item.status, 'ready_to_pickup')}`}>
                              <div className={`timeline-dot ${getStatusDotClass(item.status, 'ready_to_pickup')}`}></div>
                              <div className="timeline-content">
                                <div className="timeline-title">Ready to Pick Up</div>
                                <div className="timeline-date">{getTimelineDate(item.status_updated_at, item.status, 'ready_to_pickup')}</div>
                              </div>
                            </div>

                            <div className={`timeline-item ${getTimelineItemClass(item.status, 'completed')}`}>
                              <div className={`timeline-dot ${getStatusDotClass(item.status, 'completed')}`}></div>
                              <div className="timeline-content">
                                <div className="timeline-title">Completed</div>
                                <div className="timeline-date">{getTimelineDate(item.status_updated_at, item.status, 'completed')}</div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    {(() => {
                      const showConfirmation = shouldShowPriceConfirmation(item);
                      console.log('=== RENDERING PRICE CONFIRMATION ACTIONS ===');
                      console.log('Item:', item);
                      console.log('Show confirmation:', showConfirmation);
                      console.log('Item status:', item.status);
                      console.log('Item specific_data:', item.specific_data);
                      console.log('Item final_price:', item.final_price);
                      console.log('Has price changed result:', hasPriceChanged(item.specific_data, parseFloat(item.final_price), item.service_type, item.pricing_factors));
                      return showConfirmation ? (
                        <div className="price-confirmation-actions">
                          <div className="confirmation-message">
                            <strong>Price Update Required</strong>
                            <p>Please review the updated pricing and confirm to proceed.</p>
                          </div>
                          <div className="action-buttons">
                            <button className="btn-accept-price" onClick={() => handleAcceptPrice(item)}>
                              Accept Price - Continue
                            </button>
                            <button className="btn-decline-price" onClick={() => handleDeclinePrice(item)}>
                              Decline Price
                            </button>
                          </div>
                        </div>
                      ) : null;
                    })()}

                    <div className="order-footer">
                      <div className="order-dates">
                        <span className="date-info">Requested: {formatDate(item.order_date)}</span>
                        <span className="date-info">Updated: {formatDate(item.status_updated_at)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                          className="btn-view-details"
                          onClick={() => handleViewDetails(item)}
                        >
                          View Details
                        </button>
                        <button
                          className="btn-view-transactions"
                          onClick={() => {
                            setSelectedOrderItemId(item.order_item_id);
                            setTransactionLogModalOpen(true);
                          }}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#8B4513',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: '500',
                            transition: 'background 0.3s ease'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#6B3410'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = '#8B4513'}
                        >
                          💳 Transaction Log
                        </button>
                        {item.status === 'pending' && (
                          <button
                            className="btn-cancel"
                            onClick={() => {
                              setItemToCancel(item);
                              setCancelReason('');
                              setCancelModalOpen(true);
                            }}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: '#f44336',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                              fontWeight: '500',
                              transition: 'background 0.3s ease'
                            }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = '#da190b'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = '#f44336'}
                          >
                            Cancel
                          </button>
                        )}
                        {item.status === 'completed' && ['repair', 'customization', 'customize', 'dry_cleaning', 'drycleaning', 'dry-cleaning'].includes(String(item.service_type || '').toLowerCase()) && (
                          <button
                            onClick={() => openEnhancementModal(item)}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: '#673ab7',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                              fontWeight: '500'
                            }}
                          >
                            ✨ Request Enhancement
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
          }
        </div >
      </main >

      {
        detailsModalOpen && selectedItem && (
          <div className="details-modal-overlay" onClick={closeDetailsModal}>
            <div className="details-modal" onClick={(e) => e.stopPropagation()}>
              <div className="details-modal-header">
                <h3 className="modal-title-black">Order Details - ORD-{selectedItem.order_id}</h3>
                <button className="details-modal-close" onClick={closeDetailsModal}>×</button>
              </div>

              <div className="details-modal-content">
                <div className="order-summary">
                  <div className="summary-item">
                    <span className="summary-label">Service Type:</span>
                    <span className="summary-value">
                      {formatServiceType(selectedItem.service_type)}
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Status:</span>
                    <span className={`status-badge ${getStatusBadgeClass(selectedItem.status)}`}>
                      {getStatusLabel(selectedItem.status)}
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Price:</span>
                  <span className="order-price" style={{ textAlign: 'right', display: 'block' }}>
                      {(() => {
                        const isRental = selectedItem.service_type === 'rental';
                        const isRepair = selectedItem.service_type === 'repair';
                        const isDryCleaning = selectedItem.service_type === 'dry_cleaning' || selectedItem.service_type === 'drycleaning';
                        const isCustomization = selectedItem.service_type === 'customization' || selectedItem.service_type === 'customize';

                        const pricingFactors = typeof selectedItem.pricing_factors === 'string'
                          ? JSON.parse(selectedItem.pricing_factors || '{}')
                          : (selectedItem.pricing_factors || {});
                        const amountPaid = parseFloat(pricingFactors.amount_paid || 0);
                        const downpayment = parseFloat(pricingFactors.downpayment || selectedItem.specific_data?.downpayment || 0);
                        const finalPrice = parseFloat(selectedItem.final_price || 0);

                        const totalPaid = amountPaid;
                        const remainingAmount = Math.max(0, finalPrice - totalPaid);
                        const hasPayment = totalPaid > 0 && (isRental || isRepair || isDryCleaning || isCustomization);

                        if (isRental) {
                          return (
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ marginBottom: '8px' }}>
                                <div style={{ fontSize: '13px', color: '#666' }}>Rental Price:</div>
                                <div style={{ fontSize: '16px', fontWeight: '600', color: '#333' }}>₱{finalPrice.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                              </div>
                              <div style={{ marginBottom: '8px' }}>
                                <div style={{ fontSize: '13px', color: '#666' }}>Deposit (Refundable):</div>
                                <div style={{ fontSize: '16px', fontWeight: '600', color: '#ff9800' }}>₱{downpayment.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                              </div>
                              <div style={{ borderTop: '2px solid #e0e0e0', paddingTop: '8px', marginTop: '8px' }}>
                                <div style={{ fontSize: '13px', color: '#666' }}>Total Payment:</div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2d5a3d' }}>₱{(finalPrice + downpayment).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                              </div>
                            </div>
                          );
                        }

                        if (hasPayment && remainingAmount > 0) {
                          return (
                            <div>
                              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ff9800' }}>
                                ₱{remainingAmount.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                              </div>
                              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                                (Remaining after payment)
                              </div>
                            </div>
                          );
                        }

                        if (selectedItem.status === 'pending') {
                          const estimatedPrice = getEstimatedPrice(selectedItem.specific_data, selectedItem.service_type);

                          // For dry cleaning: only show "(Estimated)" if user selected "others" in garment dropdown
                          if (isDryCleaning) {
                            const isEstimated = selectedItem.specific_data?.isEstimatedPrice === true;
                            if (isEstimated) {
                              return `₱${estimatedPrice.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})} (Estimated)`;
                            } else {
                              // User selected a specific garment from dropdown - show final price
                              return `₱${finalPrice.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                            }
                          }

                          // For other services, show estimated if price > 0
                          if (estimatedPrice > 0) {
                            return `₱${estimatedPrice.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})} (Estimated)`;
                          }
                        }

                        return `₱${finalPrice.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                      })()}
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Order Date:</span>
                    <span className="summary-value">{formatDate(selectedItem.order_date)}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Last Updated:</span>
                    <span className="summary-value">{formatDate(selectedItem.status_updated_at)}</span>
                  </div>
                </div>

                {renderServiceDetails(selectedItem)}
              </div>

              <div className="details-modal-footer">
                {shouldShowPriceConfirmation(selectedItem) && (
                  <div className="price-confirmation-actions" style={{ marginBottom: '15px', padding: '15px', backgroundColor: '#fff3cd', borderRadius: '8px', border: '1px solid #ffc107' }}>
                    <div className="confirmation-message">
                      <strong>Price Update Required</strong>
                      <p>Please review the updated pricing and confirm to proceed.</p>
                    </div>
                    <div className="action-buttons" style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      <button className="btn-accept-price" onClick={() => {
                        handleAcceptPrice(selectedItem);
                        closeDetailsModal();
                      }}>
                        Accept Price - Continue
                      </button>
                      <button className="btn-decline-price" onClick={() => {
                        handleDeclinePrice(selectedItem);
                        closeDetailsModal();
                      }}>
                        Decline Price
                      </button>
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  {selectedItem.status === 'pending' && (
                    <button
                      onClick={() => {
                        setItemToCancel(selectedItem);
                        setCancelReason('');
                        setCancelModalOpen(true);
                        closeDetailsModal();
                      }}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: '500',
                        transition: 'background 0.3s ease'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#da190b'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = '#f44336'}
                    >
                      Cancel Order
                    </button>
                )}
                  {selectedItem.status === 'completed' && ['repair', 'customization', 'customize', 'dry_cleaning', 'drycleaning', 'dry-cleaning'].includes(String(selectedItem.service_type || '').toLowerCase()) && (
                    <button
                      onClick={() => openEnhancementModal(selectedItem)}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: '#673ab7',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: '500'
                      }}
                    >
                      ✨ Request Enhancement
                    </button>
                  )}
                <button className="btn-secondary" onClick={closeDetailsModal}>
                  Close
                </button>
                </div>
              </div>
            </div>
          </div>
        )
      }
      <ImagePreviewModal
        isOpen={imagePreviewOpen}
        imageUrl={previewImageUrl}
        altText={previewImageAlt}
        onClose={() => setImagePreviewOpen(false)}
      />
      <TransactionLogModal
        isOpen={transactionLogModalOpen}
        onClose={() => {
          setTransactionLogModalOpen(false);
          setSelectedOrderItemId(null);
        }}
        orderItemId={selectedOrderItemId}
      />
      {measurementsModalOpen && (
        <div
          className="details-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setMeasurementsModalOpen(false);
            }
          }}
        >
          <div className="details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="details-modal-header">
              <h3 className="modal-title-black">My Measurements</h3>
              <button className="details-modal-close" onClick={() => setMeasurementsModalOpen(false)}>×</button>
            </div>
            <div className="details-modal-content">
              {loadingMeasurements ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>Loading measurements...</div>
              ) : measurements ? (
                <div>
                  {measurements.top && Object.keys(measurements.top).length > 0 && (
                    <div style={{ marginBottom: '30px' }}>
                      <h4 style={{ marginBottom: '15px', color: '#333', fontSize: '1.1rem', fontWeight: '600', borderBottom: '2px solid #8B4513', paddingBottom: '8px' }}>Top Measurements</h4>
                      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f5e6d3' }}>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: '600', color: '#fff' }}>Measurement</th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: '600', color: '#fff' }}>Value (Inches / CM)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(measurements.top).map(([key, value], idx) => {
                            if (!value || value === '' || value === '0') return null;

                            const labelMap = {
                              'chest': 'Chest',
                              'shoulders': 'Shoulders',
                              'sleeveLength': 'Sleeve Length',
                              'sleeve_length': 'Sleeve Length',
                              'neck': 'Neck',
                              'waist': 'Waist',
                              'length': 'Length'
                            };
                            const label = labelMap[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
                            const cmValue = (parseFloat(value) * 2.54).toFixed(1);
                            return (
                              <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                                <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0', fontWeight: '500', color: '#000' }}>{label}</td>
                                <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0', color: '#000' }}>{value}" / {cmValue} cm</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {measurements.bottom && Object.keys(measurements.bottom).length > 0 && (
                    <div style={{ marginBottom: '30px' }}>
                      <h4 style={{ marginBottom: '15px', color: '#333', fontSize: '1.1rem', fontWeight: '600', borderBottom: '2px solid #8B4513', paddingBottom: '8px' }}>Bottom Measurements</h4>
                      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f5e6d3' }}>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: '600', color: '#fff' }}>Measurement</th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: '600', color: '#fff' }}>Value (Inches / CM)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(measurements.bottom).map(([key, value], idx) => {
                            if (!value || value === '' || value === '0') return null;

                            const labelMap = {
                              'waist': 'Waist',
                              'hips': 'Hips',
                              'inseam': 'Inseam',
                              'length': 'Length',
                              'thigh': 'Thigh',
                              'outseam': 'Outseam'
                            };
                            const label = labelMap[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
                            const cmValue = (parseFloat(value) * 2.54).toFixed(1);
                            return (
                              <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                                <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0', fontWeight: '500', color: '#000' }}>{label}</td>
                                <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0', color: '#000' }}>{value}" / {cmValue} cm</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {measurements.notes && (
                    <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#FFF8F0', borderRadius: '12px', border: '1px solid #E8C9A0', width: '100%', textAlign: 'left' }}>
                      <strong style={{ display: 'block', marginBottom: '10px', color: '#333', fontSize: '16px' }}>Notes</strong>
                      <div style={{ backgroundColor: '#fff', border: '1px solid #E8C9A0', borderRadius: '8px', padding: '12px 14px', color: '#333', fontSize: '14px', lineHeight: '1.5', minHeight: '80px' }}>{measurements.notes}</div>
                    </div>
                  )}

                  {(!measurements.top || Object.keys(measurements.top).length === 0) &&
                   (!measurements.bottom || Object.keys(measurements.bottom).length === 0) && (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                      No measurements have been recorded yet. Please contact the admin to add your measurements.
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  No measurements have been recorded yet. Please contact the admin to add your measurements.
                </div>
              )}
            </div>
            <div className="details-modal-footer">
              <button className="btn-secondary" onClick={() => setMeasurementsModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {isEditingProfile && (
        <div
          className="details-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsEditingProfile(false);
              setPendingPicFile(null);
              setPendingPicPreview(null);

              const currentUser = getUser();
              if (currentUser) {
                setProfileData({
                  first_name: currentUser.first_name || '',
                  last_name: currentUser.last_name || '',
                  email: currentUser.email || '',
                  phone_number: currentUser.phone_number || ''
                });
              }
            }
          }}
        >
          <div className="details-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="details-modal-header" style={{ borderBottom: '2px solid #F3F4F6', paddingBottom: '16px' }}>
              <h3 className="modal-title-black" style={{ fontSize: '20px', fontWeight: '700' }}>Edit Profile</h3>
              <button className="details-modal-close" onClick={() => {
                setIsEditingProfile(false);
                setPendingPicFile(null);
                setPendingPicPreview(null);

                const currentUser = getUser();
                if (currentUser) {
                  setProfileData({
                    first_name: currentUser.first_name || '',
                    last_name: currentUser.last_name || '',
                    email: currentUser.email || '',
                    phone_number: currentUser.phone_number || ''
                  });
                }
              }}>×</button>
            </div>
            <div className="details-modal-content">
              {/* Profile Picture Section */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid #F3F4F6' }}>
                <div style={{ position: 'relative', marginBottom: '12px' }}>
                  {(pendingPicPreview || profilePicUrl) ? (
                    <img
                      src={pendingPicPreview || profilePicUrl}
                      alt="Profile"
                      style={{
                        width: '100px',
                        height: '100px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '3px solid #8B4513'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '100px',
                      height: '100px',
                      borderRadius: '50%',
                      backgroundColor: '#F5ECE3',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '3px solid #8B4513'
                    }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="8" r="4" stroke="#8B4513" strokeWidth="2" fill="none"/>
                        <path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke="#8B4513" strokeWidth="2" fill="none"/>
                      </svg>
                    </div>
                  )}
                  {/* Camera badge overlay */}
                  <label
                    htmlFor="profile-pic-upload"
                    style={{
                      position: 'absolute',
                      bottom: '0',
                      right: '0',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: '#8B4513',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      border: '2px solid #fff',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="#fff" strokeWidth="2" fill="none"/>
                      <circle cx="12" cy="13" r="4" stroke="#fff" strokeWidth="2" fill="none"/>
                    </svg>
                  </label>
                </div>
                <span style={{ color: '#6B7280', fontSize: '13px' }}>
                  {pendingPicPreview ? 'New photo selected — click Save to apply' : 'Click camera icon to change photo'}
                </span>
                <input
                  id="profile-pic-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  style={{ display: 'none' }}
                  disabled={savingProfile}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    if (file.size > 5 * 1024 * 1024) {
                      alert('File size must be less than 5MB');
                      e.target.value = '';
                      return;
                    }

                    // Just preview, don't upload yet
                    setPendingPicFile(file);
                    const previewUrl = URL.createObjectURL(file);
                    setPendingPicPreview(previewUrl);
                    e.target.value = '';
                  }}
                />
              </div>

              {/* Personal Information */}
              <div style={{ marginBottom: '8px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#1F2937', marginBottom: '16px' }}>Personal Information</h4>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: '#374151', fontSize: '14px' }}>
                    First Name <span style={{ color: '#dc3545' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={profileData.first_name}
                    onChange={(e) => setProfileData({ ...profileData, first_name: e.target.value })}
                    placeholder="Enter your first name"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: '#1F2937',
                      backgroundColor: '#F9FAFB',
                      outline: 'none',
                      transition: 'border-color 0.2s ease'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#8B4513'}
                    onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                  />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: '#374151', fontSize: '14px' }}>
                    Last Name <span style={{ color: '#dc3545' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={profileData.last_name}
                    onChange={(e) => setProfileData({ ...profileData, last_name: e.target.value })}
                    placeholder="Enter your last name"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: '#1F2937',
                      backgroundColor: '#F9FAFB',
                      outline: 'none',
                      transition: 'border-color 0.2s ease'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#8B4513'}
                    onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                  />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: '#374151', fontSize: '14px' }}>
                    Email <span style={{ color: '#dc3545' }}>*</span>
                  </label>
                  <input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    placeholder="Enter your email"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: '#1F2937',
                      backgroundColor: '#F9FAFB',
                      outline: 'none',
                      transition: 'border-color 0.2s ease'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#8B4513'}
                    onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                    required
                  />
                </div>
              </div>

              {/* Contact Information */}
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#1F2937', marginBottom: '16px' }}>Contact Information</h4>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: '#374151', fontSize: '14px' }}>
                    Contact Number
                  </label>
                  <input
                    type="tel"
                    value={profileData.phone_number}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '');
                      setProfileData({ ...profileData, phone_number: digits });
                    }}
                    maxLength={11}
                    placeholder="e.g., 09123456789"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: `1px solid ${profileData.phone_number && profileData.phone_number.replace(/\D/g, '').length !== 11 ? '#f44336' : '#E5E7EB'}`,
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: '#1F2937',
                      backgroundColor: '#F9FAFB',
                      outline: 'none',
                      transition: 'border-color 0.2s ease'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#8B4513'}
                    onBlur={(e) => e.target.style.borderColor = profileData.phone_number && profileData.phone_number.replace(/\D/g, '').length !== 11 ? '#f44336' : '#E5E7EB'}
                  />
                  {profileData.phone_number && profileData.phone_number.replace(/\D/g, '').length !== 11 && (
                    <span style={{ color: '#f44336', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                      Contact number must be exactly 11 digits ({profileData.phone_number.replace(/\D/g, '').length}/11)
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="details-modal-footer" style={{ display: 'flex', flexDirection: 'row', gap: '10px', padding: '16px 24px', borderTop: '2px solid #F3F4F6' }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  setIsEditingProfile(false);
                  setPendingPicFile(null);
                  setPendingPicPreview(null);

                  const currentUser = getUser();
                  if (currentUser) {
                    setProfileData({
                      first_name: currentUser.first_name || '',
                      last_name: currentUser.last_name || '',
                      email: currentUser.email || '',
                      phone_number: currentUser.phone_number || ''
                    });
                  }
                }}
                disabled={savingProfile}
                style={{
                  flex: 1,
                  opacity: savingProfile ? 0.6 : 1,
                  cursor: savingProfile ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!profileData.first_name || !profileData.last_name || !profileData.email) {
                    await alert('Please fill in all required fields (First Name, Last Name, Email)', 'Validation Error', 'error');
                    return;
                  }

                  if (profileData.phone_number && profileData.phone_number.replace(/\D/g, '').length !== 11) {
                    await alert('Contact number must be exactly 11 digits', 'Validation Error', 'error');
                    return;
                  }

                  const currentUser = getUser();
                  const hasProfileChanges = currentUser && (
                    profileData.first_name !== (currentUser.first_name || '') ||
                    profileData.last_name !== (currentUser.last_name || '') ||
                    profileData.email !== (currentUser.email || '') ||
                    profileData.phone_number !== (currentUser.phone_number || '')
                  );
                  const hasPictureChange = !!pendingPicFile;

                  if (!hasProfileChanges && !hasPictureChange) {
                    setIsEditingProfile(false);
                    return;
                  }

                  setSavingProfile(true);
                  try {
                    // Upload pending picture if any
                    if (hasPictureChange) {
                      const picResult = await uploadProfilePicture(pendingPicFile);
                      if (picResult.success && picResult.user) {
                        setUser(picResult.user);
                        const newPicUrl = picResult.user.profile_picture
                          ? (picResult.user.profile_picture.startsWith('http')
                            ? picResult.user.profile_picture
                            : `${API_BASE_URL}${picResult.user.profile_picture}`)
                          : '';
                        setProfilePicUrl(newPicUrl);
                      } else {
                        await alert(picResult.message || 'Failed to upload picture', 'Error', 'error');
                        return;
                      }
                    }

                    // Update profile info if changed
                    if (hasProfileChanges) {
                      const result = await updateProfile({
                        first_name: profileData.first_name,
                        last_name: profileData.last_name,
                        email: profileData.email,
                        phone_number: profileData.phone_number || null
                      });

                      if (result.success) {
                        if (result.user) {
                          setUser(result.user);
                          localStorage.setItem("user", JSON.stringify(result.user));
                        }
                      } else {
                        await alert(result.message || 'Failed to update profile', 'Error', 'error');
                        return;
                      }
                    }

                    setPendingPicFile(null);
                    setPendingPicPreview(null);
                    await alert('Profile updated successfully!', 'Success', 'success');
                    setIsEditingProfile(false);
                  } catch (error) {
                    console.error('Error updating profile:', error);
                    await alert('Failed to update profile. Please try again.', 'Error', 'error');
                  } finally {
                    setSavingProfile(false);
                  }
                }}
                disabled={savingProfile}
                style={{
                  flex: 1,
                  padding: '8px 16px',
                  backgroundColor: '#8B4513',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: savingProfile ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  opacity: savingProfile ? 0.6 : 1,
                  transition: 'background 0.3s ease'
                }}
                onMouseEnter={(e) => !savingProfile && (e.target.style.backgroundColor = '#6B3410')}
                onMouseLeave={(e) => !savingProfile && (e.target.style.backgroundColor = '#8B4513')}
              >
                {savingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
      {enhanceModalOpen && itemToEnhance && (
        <div
          className="details-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setEnhanceModalOpen(false);
              setItemToEnhance(null);
              setEnhanceNotes('');
              setEnhancePreferredDate('');
            }
          }}
        >
          <div className="details-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="details-modal-header">
              <h3>Request Enhancement</h3>
              <button className="details-modal-close" onClick={() => {
                setEnhanceModalOpen(false);
                setItemToEnhance(null);
                setEnhanceNotes('');
                setEnhancePreferredDate('');
              }}>×</button>
            </div>
            <div className="details-modal-content">
              <p style={{ marginBottom: '16px', color: '#666' }}>
                Tell us what issue you found and how you want the order improved.
              </p>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#333' }}>
                  Enhancement Notes <span style={{ color: '#f44336' }}>*</span>
                </label>
                <textarea
                  value={enhanceNotes}
                  onChange={(e) => setEnhanceNotes(e.target.value)}
                  placeholder="Describe the issue/enhancement request..."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#333' }}>
                  Preferred Completion Date (Optional)
                </label>
                <input
                  type="date"
                  value={enhancePreferredDate}
                  onChange={(e) => setEnhancePreferredDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>
            <div className="details-modal-footer" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  setEnhanceModalOpen(false);
                  setItemToEnhance(null);
                  setEnhanceNotes('');
                  setEnhancePreferredDate('');
                }}
                disabled={submittingEnhancement}
              >
                Close
              </button>
              <button
                onClick={handleSubmitEnhancement}
                disabled={submittingEnhancement}
                style={{
                  padding: '10px 18px',
                  backgroundColor: '#673ab7',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: submittingEnhancement ? 'not-allowed' : 'pointer',
                  opacity: submittingEnhancement ? 0.7 : 1
                }}
              >
                {submittingEnhancement ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
      {cancelModalOpen && itemToCancel && (
        <div
          className="details-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setCancelModalOpen(false);
              setItemToCancel(null);
              setCancelReason('');
            }
          }}
        >
          <div className="details-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="details-modal-header">
              <h3>Cancel Service</h3>
              <button className="details-modal-close" onClick={() => {
                setCancelModalOpen(false);
                setItemToCancel(null);
                setCancelReason('');
              }}>×</button>
            </div>
            <div className="details-modal-content">
              <p style={{ marginBottom: '20px', color: '#666' }}>
                Are you sure you want to cancel this service? Please provide a reason for cancellation.
              </p>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#333' }}>
                  Cancellation Reason <span style={{ color: '#f44336' }}>*</span>
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Please provide a reason for cancellation..."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                  required
                />
              </div>
            </div>
            <div className="details-modal-footer" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  setCancelModalOpen(false);
                  setItemToCancel(null);
                  setCancelReason('');
                }}
                disabled={cancelling}
              >
                Close
              </button>
              <button
                onClick={async () => {
                  if (!cancelReason.trim()) {
                    await alert('Please provide a cancellation reason', 'Required', 'warning');
                    return;
                  }

                  setCancelling(true);
                  const result = await cancelOrderItem(itemToCancel.order_item_id, cancelReason.trim());

                  if (result.success) {
                    await alert('Service cancelled successfully', 'Success', 'success');
                    setCancelModalOpen(false);
                    setItemToCancel(null);
                    setCancelReason('');

                    const ordersResult = await getUserOrderTracking();
                    if (ordersResult.success) {
                      setOrders(ordersResult.data);
                      setStatusFilter('cancelled');
                    }
                  } else {
                    await alert(result.message || 'Failed to cancel service', 'Error', 'error');
                  }
                  setCancelling(false);
                }}
                disabled={cancelling || !cancelReason.trim()}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: cancelling || !cancelReason.trim() ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  opacity: cancelling || !cancelReason.trim() ? 0.6 : 1
                }}
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
};

export default Profile;