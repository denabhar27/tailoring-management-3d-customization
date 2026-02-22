import React, { useState, useEffect } from 'react';
import { addDryCleaningToCart, uploadDryCleaningImage } from '../../api/DryCleaningApi';
import { getAvailableSlots, bookSlot, getAllSlotsWithAvailability } from '../../api/AppointmentSlotApi';
import { getAllDCGarmentTypes } from '../../api/DryCleaningGarmentTypeApi';
import '../../styles/DryCleaningFormModal.css';
import '../../styles/SharedModal.css';

const DryCleaningFormModal = ({ isOpen, onClose, onCartUpdate }) => {

  const [garmentTypes, setGarmentTypes] = useState({});
  const [garmentTypesList, setGarmentTypesList] = useState([]);
  const [loadingGarments, setLoadingGarments] = useState(false);

  const [garments, setGarments] = useState([
    { id: 1, garmentType: '', customGarmentType: '', brand: '', quantity: 1 }
  ]);

  const [formData, setFormData] = useState({
    serviceName: '',
    notes: '',
    date: '',
    time: ''
  });
  const [allTimeSlots, setAllTimeSlots] = useState([]);
  const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(true);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState({});
  const [estimatedPrice, setEstimatedPrice] = useState(0);
  const [isEstimatedPrice, setIsEstimatedPrice] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [services, setServices] = useState([]);

  useEffect(() => {
    loadGarmentTypes();
  }, []);

  useEffect(() => {
    if (isOpen && garmentTypesList.length === 0) {
      console.log('[DryCleaningFormModal] Modal opened with empty garment list, reloading...');
      loadGarmentTypes();
    }
  }, [isOpen]);

  const loadGarmentTypes = async () => {
    setLoadingGarments(true);
    try {
      console.log('[DryCleaningFormModal] Loading garment types...');
      const result = await getAllDCGarmentTypes();
      console.log('[DryCleaningFormModal] API result:', result);
      if (result.success && result.data) {
        console.log('[DryCleaningFormModal] Found', result.data.length, 'garment types');
        const typesObj = {};
        const activeGarments = result.data.filter(g => g.is_active === 1 || g.is_active === true);
        activeGarments.forEach(garment => {
          typesObj[garment.garment_name.toLowerCase()] = parseFloat(garment.garment_price);
        });
        setGarmentTypes(typesObj);
        setGarmentTypesList(activeGarments);
        console.log('[DryCleaningFormModal] Garment types loaded successfully:', activeGarments.length, 'active items');
      } else {
        console.log('[DryCleaningFormModal] API returned no data or failed:', result);
      }
    } catch (err) {
      console.error("[DryCleaningFormModal] Load garment types error:", err);
    } finally {
      setLoadingGarments(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDryCleaningServices();

      setFormData({
        serviceName: '',
        notes: '',
        date: '',
        time: ''
      });
      setGarments([
        { id: 1, garmentType: '', customGarmentType: '', brand: '', quantity: 1 }
      ]);
      setAvailableTimeSlots([]);
      setErrors({});
    }
  }, [isOpen]);

  useEffect(() => {
    if (formData.date) {
      loadAvailableSlots(formData.date);

      const refreshInterval = setInterval(() => {
        if (formData.date) {

          getAllSlotsWithAvailability('dry_cleaning', formData.date)
            .then((result) => {
              if (result.success && result.slots) {

                const currentSlots = JSON.stringify(allTimeSlots.map(s => ({ time: s.time_slot, available: s.available })));
                const newSlots = JSON.stringify(result.slots.map(s => ({ time: s.time_slot, available: s.available })));
                if (currentSlots !== newSlots) {
                  console.log('[POLLING] Slots changed, updating...');
                  if (!result.isShopOpen) {
                    setIsShopOpen(false);
                    setAllTimeSlots([]);
                    setAvailableTimeSlots([]);
                  } else {
                    setIsShopOpen(true);
                    setAllTimeSlots(result.slots || []);
                    const available = (result.slots || [])
                      .filter(slot => slot.isClickable)
                      .map(slot => ({
                        value: slot.time_slot,
                        display: slot.display_time
                      }));
                    setAvailableTimeSlots(available);
                  }
                }
              }
            })
            .catch((error) => {
              console.error('[POLLING] Error refreshing slots:', error);
            });
        }
      }, 5000);

      return () => clearInterval(refreshInterval);
    } else {
      setAllTimeSlots([]);
      setAvailableTimeSlots([]);
      setIsShopOpen(true);
      setFormData(prev => ({ ...prev, time: '' }));
    }
  }, [formData.date]);

  const loadDryCleaningServices = async () => {
    try {

      const { getDryCleaningServices } = await import('../../api/DryCleaningApi');
      const result = await getDryCleaningServices();
      if (result.success && result.data) {
        setServices(result.data);
      }
    } catch (error) {
      console.error('Error loading dry cleaning services:', error);
    }
  };

  const loadAvailableSlots = async (date) => {
    if (!date) return;

    setLoadingSlots(true);
    setMessage('');

    try {

      const result = await getAllSlotsWithAvailability('dry_cleaning', date);

      if (result.success) {
        if (!result.isShopOpen) {
          setIsShopOpen(false);
          setAllTimeSlots([]);
          setAvailableTimeSlots([]);
          setMessage('The shop is closed on this date. Please select another date.');
          return;
        }

        setIsShopOpen(true);
        setAllTimeSlots(result.slots || []);

        const available = (result.slots || [])
          .filter(slot => slot.isClickable)
          .map(slot => ({
            value: slot.time_slot,
            display: slot.display_time
          }));
        setAvailableTimeSlots(available);
      } else {
        setMessage(result.message || 'Error loading time slots');
        setAllTimeSlots([]);
        setAvailableTimeSlots([]);
      }
    } catch (error) {
      console.error('Error loading available slots:', error);
      setMessage('Error loading available time slots');
      setAllTimeSlots([]);
      setAvailableTimeSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const getMinDate = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();

    if (dayOfWeek === 0) {
      today.setDate(today.getDate() + 1);
    }

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleDateChange = async (e) => {
    const selectedDate = e.target.value;
    if (selectedDate) {
      try {
        const { checkDateOpen } = await import('../../api/ShopScheduleApi');
        const result = await checkDateOpen(selectedDate);
        if (!result.success || !result.is_open) {
          setMessage('Appointments are not available on this date. Please select another date.');
          setFormData(prev => ({ ...prev, date: '', time: '' }));
          setErrors(prev => ({ ...prev, date: 'Appointments are not available on this date. Please select another date.' }));
          return;
        }
      } catch (error) {
        console.error('Error checking date availability:', error);

        const date = new Date(selectedDate);
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0) {
          setMessage('Appointments are not available on this date. Please select another date.');
          setFormData(prev => ({ ...prev, date: '', time: '' }));
          setErrors(prev => ({ ...prev, date: 'Appointments are not available on this date. Please select another date.' }));
          return;
        }
      }
    }

    setFormData(prev => ({ ...prev, date: selectedDate, time: '' }));
    setMessage('');

    if (errors.date) {
      setErrors(prev => ({ ...prev, date: '' }));
    }
  };

  useEffect(() => {
    if (garments.length > 0) {
      calculatePrice();
    } else {
      setEstimatedPrice(0);
      setIsEstimatedPrice(false);
    }
  }, [garments, garmentTypesList]);

  const calculatePrice = () => {
    if (garments.length === 0) {
      setEstimatedPrice(0);
      setIsEstimatedPrice(false);
      return;
    }

    let totalPrice = 0;
    let hasEstimatedItem = false;

    garments.forEach(garment => {
      if (!garment.garmentType) return;

      const quantity = parseInt(garment.quantity) || 1;

      if (garment.garmentType === 'others') {
        const estimatedPricePerItem = 350;
        totalPrice += estimatedPricePerItem * quantity;
        hasEstimatedItem = true;
      } else {
        const selectedGarment = garmentTypesList.find(g => g.garment_name.toLowerCase() === garment.garmentType);
        const pricePerItem = selectedGarment ? parseFloat(selectedGarment.garment_price) : (garmentTypes[garment.garmentType] || 200);
        totalPrice += pricePerItem * quantity;
      }
    });

    setEstimatedPrice(totalPrice);
    setIsEstimatedPrice(hasEstimatedItem);
  };

  const addGarment = () => {
    const newId = Math.max(...garments.map(g => g.id)) + 1;
    setGarments([...garments, { id: newId, garmentType: '', customGarmentType: '', brand: '', quantity: 1 }]);
  };

  const removeGarment = (id) => {
    if (garments.length > 1) {
      setGarments(garments.filter(g => g.id !== id));
    }
  };

  const updateGarment = (id, field, value) => {
    setGarments(garments.map(g =>
      g.id === id ? { ...g, [field]: value } : g
    ));

    if (errors[`garment_${id}_${field}`]) {
      setErrors(prev => ({ ...prev, [`garment_${id}_${field}`]: '' }));
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setImageFile(file);

    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setImagePreview('');
    }
  };

  const validateForm = () => {
    const newErrors = {};

    garments.forEach((garment, index) => {
      if (!garment.garmentType) {
        newErrors[`garment_${garment.id}_garmentType`] = 'Please select a garment type';
      }
      if (garment.garmentType === 'others' && !garment.customGarmentType.trim()) {
        newErrors[`garment_${garment.id}_customGarmentType`] = 'Please specify the garment type';
      }
      if (!garment.brand || garment.brand.trim() === '') {
        newErrors[`garment_${garment.id}_brand`] = 'Please enter the clothing brand';
      }
    });

    if (!formData.date) {
      newErrors.date = 'Please select a drop off date';
    }
    if (!formData.time) {
      newErrors.time = 'Please select a time slot';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setMessage('');

    try {

      let slotResult = null;
      try {
        slotResult = await bookSlot('dry_cleaning', formData.date, formData.time);
        if (!slotResult || !slotResult.success) {
          const errorMsg = slotResult?.message || 'Failed to book appointment slot. This time may already be taken.';
          console.error('Slot booking failed:', slotResult);
          setMessage(errorMsg);
          setLoading(false);
          return;
        }
        console.log('Slot booked successfully:', slotResult);
      } catch (slotError) {
        console.error('Slot booking error:', slotError);
        const errorMsg = slotError.response?.data?.message || slotError.message || 'Failed to book appointment slot. Please try again.';
        setMessage(errorMsg);
        setLoading(false);
        return;
      }

      let imageUrl = '';

      if (imageFile) {
        console.log('Uploading image file:', imageFile);
        console.log('File details:', {
          name: imageFile.name,
          size: imageFile.size,
          type: imageFile.type
        });

        const uploadResult = await uploadDryCleaningImage(imageFile);
        console.log('Upload result:', uploadResult);

        if (uploadResult.success) {
          imageUrl = uploadResult.data.url || uploadResult.data.filename || '';
          console.log('Image uploaded successfully, URL:', imageUrl);
        } else {
          console.warn('Image upload failed, continuing without image:', uploadResult.message);
          setMessage(`⚠️ Image upload failed: ${uploadResult.message}. Continuing without image.`);
        }
      } else {
        console.log('No image file provided');
      }

      const defaultService = services && services.length > 0
        ? (services.find(service => service.service_name === 'Basic Dry Cleaning') || services[0])
        : null;

      const pickupDateTime = `${formData.date}T${formData.time}`;

      const garmentsData = garments.map(garment => {
        const actualGarmentType = garment.garmentType === 'others'
          ? garment.customGarmentType.trim()
          : garment.garmentType;

        let pricePerItem = 350;
        if (garment.garmentType !== 'others') {
          const selectedGarment = garmentTypesList.find(g => g.garment_name.toLowerCase() === garment.garmentType);
          pricePerItem = selectedGarment ? parseFloat(selectedGarment.garment_price) : (garmentTypes[garment.garmentType] || 200);
        }

        return {
          garmentType: actualGarmentType,
          brand: garment.brand,
          quantity: garment.quantity,
          pricePerItem: pricePerItem,
          isEstimated: garment.garmentType === 'others'
        };
      });

      const dryCleaningData = {
        serviceId: defaultService?.service_id || 1,
        serviceName: 'Basic Dry Cleaning',
        basePrice: '0',
        finalPrice: estimatedPrice.toString(),
        quantity: garments.reduce((sum, g) => sum + parseInt(g.quantity), 0),
        notes: formData.notes,
        pickupDate: pickupDateTime,
        imageUrl: imageUrl || 'no-image',
        isEstimatedPrice: isEstimatedPrice,
        garments: garmentsData,
        isMultipleGarments: garments.length > 1
      };

      console.log('Dry cleaning data to send:', dryCleaningData);
      console.log('Estimated price:', estimatedPrice);
      console.log('Garments:', garmentsData);

      const result = await addDryCleaningToCart(dryCleaningData);
      console.log('Add to cart result:', result);
      console.log('Result success:', result?.success);
      console.log('Result message:', result?.message);

      if (result && result.success) {

        const priceLabel = isEstimatedPrice ? 'Estimated price' : 'Final price';
        setMessage(`✅ Dry cleaning service added to cart! ${priceLabel}: ₱${estimatedPrice}${imageUrl ? ' (Image uploaded)' : ''}`);
        setTimeout(() => {
          onClose();
          if (onCartUpdate) onCartUpdate();
        }, 1500);
      } else {

        console.error('Cart addition failed:', result);
        const errorMessage = result?.message || result?.error || 'Failed to add to cart. Please check console for details.';
        setMessage(`❌ Error: ${errorMessage}`);
        setLoading(false);
      }
    } catch (error) {
      console.error('Submit error:', error);
      console.error('Error details:', error.response?.data);
      setMessage(`❌ Failed to add dry cleaning service: ${error.message || 'Unknown error'}`);
      setLoading(false);
    }
  };

  const handleClose = () => {

    setFormData({
      serviceName: '',
      notes: '',
      date: '',
      time: ''
    });
    setGarments([
      { id: 1, garmentType: '', customGarmentType: '', brand: '', quantity: 1 }
    ]);
    setImageFile(null);
    setImagePreview('');
    setEstimatedPrice(0);
    setIsEstimatedPrice(false);
    setMessage('');
    setErrors({});
    setAvailableTimeSlots([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay-shared" onClick={handleClose}>
      <div className="modal-container-shared" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-shared">
          <h2 className="modal-title-shared">Dry Cleaning Service</h2>
          <button className="modal-close-shared" onClick={handleClose} aria-label="Close modal">
            ×
          </button>
        </div>

        <div className="modal-content-shared">
          <form onSubmit={handleSubmit}>
            {/* Garments - Simple repeated inputs like original design */}
            {garments.map((garment, index) => (
              <div key={garment.id} className="garment-inputs-group">
                {index > 0 && <hr className="garment-divider" />}

                <div className="garment-row-header">
                  {garments.length > 1 && (
                    <span className="garment-label">Garment #{index + 1}</span>
                  )}
                  {garments.length > 1 && (
                    <button
                      type="button"
                      className="remove-garment-link"
                      onClick={() => removeGarment(garment.id)}
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="form-group-shared">
                  <label className="form-label-shared">
                    <i className="fas fa-tshirt"></i> Garment Type <span className="required-indicator">*</span>
                  </label>
                  <select
                    value={garment.garmentType}
                    onChange={(e) => updateGarment(garment.id, 'garmentType', e.target.value)}
                    className={`form-select-shared ${errors[`garment_${garment.id}_garmentType`] ? 'error' : ''}`}
                    disabled={loadingGarments}
                  >
                    <option value="">{loadingGarments ? 'Loading...' : 'Select garment type...'}</option>
                    {garmentTypesList.map(g => (
                      <option key={g.dc_garment_id} value={g.garment_name.toLowerCase()}>
                        {g.garment_name} - ₱{parseFloat(g.garment_price).toFixed(2)}
                      </option>
                    ))}
                    <option value="others">Others</option>
                  </select>
                  {errors[`garment_${garment.id}_garmentType`] && (
                    <span className="error-message-shared">{errors[`garment_${garment.id}_garmentType`]}</span>
                  )}
                </div>

                {garment.garmentType === 'others' && (
                  <div className="form-group-shared">
                    <label className="form-label-shared">
                      Specify Garment Type <span className="required-indicator">*</span>
                    </label>
                    <input
                      type="text"
                      value={garment.customGarmentType}
                      onChange={(e) => updateGarment(garment.id, 'customGarmentType', e.target.value)}
                      placeholder="Enter garment type..."
                      className={`form-input-shared ${errors[`garment_${garment.id}_customGarmentType`] ? 'error' : ''}`}
                    />
                    {errors[`garment_${garment.id}_customGarmentType`] && (
                      <span className="error-message-shared">{errors[`garment_${garment.id}_customGarmentType`]}</span>
                    )}
                  </div>
                )}

                <div className="form-group-shared">
                  <label className="form-label-shared"><i className="fas fa-sort-numeric-up"></i> Quantity</label>
                  <input
                    type="number"
                    value={garment.quantity}
                    onChange={(e) => updateGarment(garment.id, 'quantity', parseInt(e.target.value) || 1)}
                    min="1"
                    max="50"
                    className="form-input-shared"
                  />
                </div>

                <div className="form-group-shared">
                  <label className="form-label-shared">
                    <i className="fas fa-tag"></i> Brand <span className="required-indicator">*</span>
                  </label>
                  <input
                    type="text"
                    value={garment.brand}
                    onChange={(e) => updateGarment(garment.id, 'brand', e.target.value)}
                    placeholder="e.g., Gucci, Armani, Zara"
                    className={`form-input-shared ${errors[`garment_${garment.id}_brand`] ? 'error' : ''}`}
                  />
                  {errors[`garment_${garment.id}_brand`] && (
                    <span className="error-message-shared">{errors[`garment_${garment.id}_brand`]}</span>
                  )}
                </div>
              </div>
            ))}

            <button
              type="button"
              className="add-garment-link"
              onClick={addGarment}
            >
              + Add Another Garment
            </button>

            <div className="form-group-shared">
              <label htmlFor="notes" className="form-label-shared"><i className="fas fa-pen"></i> Special Instructions</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="e.g., Remove specific stains, handle with care, etc."
                rows="3"
                className="form-textarea-shared"
              />
            </div>
            <div className="form-group-shared">
              <label htmlFor="date" className="form-label-shared">
                <i className="fas fa-calendar"></i> Drop off item date <span className="required-indicator">*</span>
              </label>
              <input
                type="date"
                id="date"
                name="date"
                value={formData.date}
                onChange={handleDateChange}
                min={getMinDate()}
                className={`form-input-shared ${errors.date ? 'error' : ''}`}
                required
              />
              <span className="help-text-shared">Select a date when the shop is open</span>
              {errors.date && (
                <span className="error-message-shared">{errors.date}</span>
              )}
            </div>
            {formData.date && (
              <div className="form-group-shared">
                <label className="form-label-shared">
                  <i className="fas fa-clock"></i> Select Time Slot <span className="required-indicator">*</span>
                </label>
                <div className="time-slot-legend">
                  <div className="legend-item">
                    <span className="legend-dot available"></span>
                    <span>Available</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot limited"></span>
                    <span>Limited</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot full"></span>
                    <span>Full</span>
                  </div>
                </div>

                {loadingSlots ? (
                  <div className="time-slots-loading">
                    <div className="loading-spinner"></div>
                    <span>Loading available time slots...</span>
                  </div>
                ) : !isShopOpen ? (
                  <div className="shop-closed-message">
                    <span className="closed-icon"><i className="fas fa-ban"></i></span>
                    <p>The shop is closed on this date. Please select another date.</p>
                  </div>
                ) : allTimeSlots.length > 0 ? (
                  <div className="time-slots-grid">
                    {(() => {

                      const seenTimes = new Set();
                      const uniqueSlots = allTimeSlots.filter(slot => {
                        if (seenTimes.has(slot.time_slot)) {
                          return false;
                        }
                        seenTimes.add(slot.time_slot);
                        return true;
                      });

                      return uniqueSlots.map(slot => (
                        <button
                          key={slot.slot_id || slot.time_slot}
                          type="button"
                          className={`time-slot-btn ${slot.status} ${formData.time === slot.time_slot ? 'selected' : ''}`}
                          onClick={() => {
                            if (slot.isClickable) {
                              setFormData(prev => ({ ...prev, time: slot.time_slot }));
                              if (errors.time) {
                                setErrors(prev => ({ ...prev, time: '' }));
                              }
                            }
                          }}
                          disabled={!slot.isClickable}
                          title={slot.statusLabel}
                        >
                          <span className="slot-time">{slot.display_time}</span>
                          <span className="slot-status">
                            {slot.status === 'full' ? 'Fully Booked' :
                             slot.status === 'limited' ? `${slot.available} left` :
                             slot.status === 'available' ? `${slot.available} spots` : 'Unavailable'}
                          </span>
                        </button>
                      ));
                    })()}
                  </div>
                ) : (
                  <div className="no-slots-message">
                    <span className="no-slots-icon"><i className="fas fa-calendar"></i></span>
                    <p>No time slots available for this date. Please select another date.</p>
                  </div>
                )}
                <input
                  type="hidden"
                  name="time"
                  value={formData.time}
                  required
                />

                {formData.time && (
                  <div className="selected-slot-info">
                    <i className="fas fa-check"></i> Selected: <strong>{allTimeSlots.find(s => s.time_slot === formData.time)?.display_time}</strong>
                  </div>
                )}
                {errors.time && (
                  <span className="error-message-shared">{errors.time}</span>
                )}
              </div>
            )}
            <div className="form-group-shared">
              <label htmlFor="image" className="form-label-shared"><i className="fas fa-camera"></i> Upload Clothing Photo (Optional)</label>
              <div className="image-upload-wrapper-shared">
                <input
                  type="file"
                  id="image"
                  name="image"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="file-input-shared"
                />
                <label htmlFor="image" className="upload-button-shared">
                  <i className="fas fa-camera"></i> Choose Photo
                </label>
              </div>
              {imagePreview && (
                <div className="image-preview-shared">
                  <img src={imagePreview} alt="Clothing preview" />
                  <button
                    type="button"
                    className="remove-image-btn-shared"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview('');
                      document.getElementById('image').value = '';
                    }}
                  >
                    ✕ Remove
                  </button>
                </div>
              )}

              {imageFile && !imagePreview && (
                <div className="help-text-shared" style={{ marginTop: '8px' }}>
                  <i className="fas fa-paperclip"></i> {imageFile.name}
                </div>
              )}
              <span className="help-text-shared">Photos help us provide better service and accurate pricing</span>
            </div>
            {estimatedPrice > 0 && garments.some(g => g.garmentType) && (
              <div className="price-estimate-shared">
                <h4>{isEstimatedPrice ? 'Estimated Price' : 'Final Price'}</h4>
                <div className="price-breakdown">
                  {garments.filter(g => g.garmentType).map((garment, index) => {
                    const selectedGarment = garmentTypesList.find(g => g.garment_name.toLowerCase() === garment.garmentType);
                    const pricePerItem = garment.garmentType === 'others'
                      ? 350
                      : (selectedGarment ? parseFloat(selectedGarment.garment_price) : (garmentTypes[garment.garmentType] || 200));
                    const garmentName = garment.garmentType === 'others'
                      ? (garment.customGarmentType || 'Custom')
                      : garment.garmentType.charAt(0).toUpperCase() + garment.garmentType.slice(1);
                    return (
                      <p key={garment.id}>
                        {garmentName}: {garment.quantity} × ₱{pricePerItem} = ₱{pricePerItem * garment.quantity}
                        {garment.garmentType === 'others' && ' (estimated)'}
                      </p>
                    );
                  })}
                </div>
                <p><strong>Total: ₱{estimatedPrice}{isEstimatedPrice ? ' (Estimated)' : ''}</strong></p>
                <p className="estimated-pickup">Drop off item date: {formData.date && formData.time ? `${formData.date} ${formData.time.substring(0, 5)}` : 'Not set'}</p>
              </div>
            )}
            {message && (
              <div className={`message-shared ${message.includes('✅') ? 'success' : 'error'}`}>
                {message}
              </div>
            )}
            <div className="modal-footer-shared">
              <button
                type="button"
                className="btn-shared btn-cancel-shared"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-shared btn-primary-shared"
                disabled={loading}
              >
                {loading ? 'Adding...' : 'Add to Cart'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default DryCleaningFormModal;
