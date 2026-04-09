import React, { useState, useEffect } from 'react';
import { addRepairToCart, uploadRepairImage } from '../../api/RepairApi';
import { getAvailableSlots, bookSlot, getAllSlotsWithAvailability } from '../../api/AppointmentSlotApi';
import { getAllRepairGarmentTypes } from '../../api/RepairGarmentTypeApi';
import '../../styles/RepairFormModal.css';
import '../../styles/SharedModal.css';

const USER_ALLOWED_SLOT_TIMES = new Set([
  '08:30', '09:30', '10:30', '11:30', '12:30', '13:30', '14:30', '15:30', '16:30'
]);

const isUserAllowedSlotTime = (timeValue) => {
  const normalized = String(timeValue || '').trim().substring(0, 5);
  return USER_ALLOWED_SLOT_TIMES.has(normalized);
};

const filterUserAllowedSlots = (slots) => {
  return (Array.isArray(slots) ? slots : []).filter((slot) => {
    return isUserAllowedSlotTime(slot?.time_slot);
  });
};

const RepairFormModal = ({ isOpen, onClose, onCartUpdate }) => {

  const defaultDamageLevels = [];
  const sizeOptions = [
    { value: 'Small', label: 'Small' },
    { value: 'Medium', label: 'Medium' },
    { value: 'Large', label: 'Large' },
    { value: 'Others', label: 'Others' }
  ];

  const [garments, setGarments] = useState([
    { id: 1, garmentType: '', damageLevel: '', damageLevelId: '', size: '', customSize: '', notes: '' }
  ]);

  const [addAccessories, setAddAccessories] = useState(false);

  const [formData, setFormData] = useState({
    date: '',
    time: ''
  });
  const [allTimeSlots, setAllTimeSlots] = useState([]);
  const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(true);
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState({});
  const [estimatedPrice, setEstimatedPrice] = useState(0);
  const [priceLoading, setPriceLoading] = useState(false);
  const [repairGarmentTypes, setRepairGarmentTypes] = useState([]);

  const getDamageLevelsForGarment = (garmentTypeName) => {
    const selectedGarment = repairGarmentTypes.find((g) => g.garment_name === garmentTypeName);
    const activeLevels = (selectedGarment?.damage_levels || [])
      .filter((level) => level && (Number(level.is_active) === 1 || level.is_active === true))
      .sort((a, b) => (parseInt(a.sort_order, 10) || 0) - (parseInt(b.sort_order, 10) || 0));

    return activeLevels.length > 0 ? activeLevels : defaultDamageLevels;
  };

  const getSelectedDamageLevel = (garment) => {
    if (!garment?.garmentType || !garment?.damageLevel) return null;
    const availableLevels = getDamageLevelsForGarment(garment.garmentType);

    return availableLevels.find((level) =>
      String(level.repair_damage_level_id) === String(garment.damageLevelId) ||
      String(level.level_name) === String(garment.damageLevel)
    ) || null;
  };

  useEffect(() => {
    loadRepairGarmentTypes();
  }, []);

  const loadRepairGarmentTypes = async () => {
    try {
      const result = await getAllRepairGarmentTypes();
      if (result.success && result.garments) {
        setRepairGarmentTypes(result.garments.filter(g => Number(g.is_active) === 1));
      } else {

        setRepairGarmentTypes([
          { repair_garment_id: 1, garment_name: 'Shirt', damage_levels: defaultDamageLevels },
          { repair_garment_id: 2, garment_name: 'Pants', damage_levels: defaultDamageLevels },
          { repair_garment_id: 3, garment_name: 'Jacket', damage_levels: defaultDamageLevels },
          { repair_garment_id: 4, garment_name: 'Coat', damage_levels: defaultDamageLevels },
          { repair_garment_id: 5, garment_name: 'Dress', damage_levels: defaultDamageLevels },
          { repair_garment_id: 6, garment_name: 'Skirt', damage_levels: defaultDamageLevels },
          { repair_garment_id: 7, garment_name: 'Suit', damage_levels: defaultDamageLevels },
          { repair_garment_id: 8, garment_name: 'Blouse', damage_levels: defaultDamageLevels },
          { repair_garment_id: 9, garment_name: 'Sweater', damage_levels: defaultDamageLevels },
          { repair_garment_id: 10, garment_name: 'Other', damage_levels: defaultDamageLevels }
        ]);
      }
    } catch (err) {
      console.error("Load repair garment types error:", err);

      setRepairGarmentTypes([
        { repair_garment_id: 1, garment_name: 'Shirt', damage_levels: defaultDamageLevels },
        { repair_garment_id: 2, garment_name: 'Pants', damage_levels: defaultDamageLevels },
        { repair_garment_id: 3, garment_name: 'Jacket', damage_levels: defaultDamageLevels },
        { repair_garment_id: 4, garment_name: 'Coat', damage_levels: defaultDamageLevels },
        { repair_garment_id: 5, garment_name: 'Dress', damage_levels: defaultDamageLevels },
        { repair_garment_id: 6, garment_name: 'Skirt', damage_levels: defaultDamageLevels },
        { repair_garment_id: 7, garment_name: 'Suit', damage_levels: defaultDamageLevels },
        { repair_garment_id: 8, garment_name: 'Blouse', damage_levels: defaultDamageLevels },
        { repair_garment_id: 9, garment_name: 'Sweater', damage_levels: defaultDamageLevels },
        { repair_garment_id: 10, garment_name: 'Other', damage_levels: defaultDamageLevels }
      ]);
    }
  };

  useEffect(() => {
    if (garments.some(g => g.damageLevel)) {
      calculateEstimatedPrice();
    } else {
      setEstimatedPrice(0);
    }
  }, [garments, repairGarmentTypes]);

  useEffect(() => {
    if (formData.date) {
      loadAvailableSlots(formData.date);

      const refreshInterval = setInterval(() => {
        if (formData.date) {

          getAllSlotsWithAvailability('repair', formData.date)
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
                    const filteredSlots = filterUserAllowedSlots(result.slots);
                    setAllTimeSlots(filteredSlots);
                    const available = filteredSlots
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

  useEffect(() => {
    if (!isOpen) {
      setFormData({
        date: '',
        time: ''
      });
      setGarments([
        { id: 1, garmentType: '', damageLevel: '', damageLevelId: '', size: '', customSize: '', notes: '' }
      ]);
      setAddAccessories(false);
      setAllTimeSlots([]);
      setAvailableTimeSlots([]);
      setIsShopOpen(true);
      setImageFiles([]);
      setImagePreviews([]);
      setCurrentImageIndex(0);
      setEstimatedPrice(0);
      setMessage('');
      setErrors({});
    }
  }, [isOpen]);

  const calculateEstimatedPrice = async () => {
    if (!garments.some(g => g.damageLevel)) {
      setEstimatedPrice(0);
      return;
    }

    setPriceLoading(true);

    try {
      let totalPrice = 0;

      garments.forEach(garment => {
        if (garment.damageLevel) {
          const damageLevel = getSelectedDamageLevel(garment);
          const basePrice = damageLevel ? parseFloat(damageLevel.base_price || 0) : 500;
          totalPrice += basePrice;
        }
      });

      setEstimatedPrice(totalPrice);
    } catch (error) {
      console.error('Price calculation error:', error);
    } finally {
      setPriceLoading(false);
    }
  };

  const addGarment = () => {
    const newId = Math.max(...garments.map(g => g.id)) + 1;
    setGarments([...garments, { id: newId, garmentType: '', damageLevel: '', damageLevelId: '', size: '', customSize: '', notes: '' }]);
  };

  const removeGarment = (id) => {
    if (garments.length > 1) {
      setGarments(garments.filter(g => g.id !== id));
    }
  };

  const updateGarment = (id, field, value) => {
    setGarments(garments.map(g => {
      if (g.id !== id) return g;

      if (field === 'garmentType') {
        return { ...g, garmentType: value, damageLevel: '', damageLevelId: '' };
      }

      if (field === 'size') {
        return {
          ...g,
          size: value,
          customSize: value === 'Others' ? g.customSize : ''
        };
      }

      return { ...g, [field]: value };
    }));

    if (errors[`garment_${id}_${field}`]) {
      setErrors(prev => ({ ...prev, [`garment_${id}_${field}`]: '' }));
    }
  };

  const updateGarmentDamageLevel = (id, damageLevelId, damageLevelName) => {
    setGarments(garments.map((g) =>
      g.id === id
        ? { ...g, damageLevelId: damageLevelId || '', damageLevel: damageLevelName || '' }
        : g
    ));

    if (errors[`garment_${id}_damageLevel`]) {
      setErrors(prev => ({ ...prev, [`garment_${id}_damageLevel`]: '' }));
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

  const loadAvailableSlots = async (date) => {
    if (!date) return;

    setLoadingSlots(true);
    setMessage('');

    try {

      const result = await getAllSlotsWithAvailability('repair', date);

      if (result.success) {
        if (!result.isShopOpen) {
          setIsShopOpen(false);
          setAllTimeSlots([]);
          setAvailableTimeSlots([]);
          setMessage('The shop is closed on this date. Please select another date.');
          return;
        }

        setIsShopOpen(true);
        const filteredSlots = filterUserAllowedSlots(result.slots);
        setAllTimeSlots(filteredSlots);

        const available = filteredSlots
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

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageFiles(prev => [...prev, file]);
        setImagePreviews(prev => [...prev, reader.result]);
        setCurrentImageIndex(prev => prev === 0 && imagePreviews.length === 0 ? 0 : imagePreviews.length);
      };
      reader.readAsDataURL(file);
    });
    
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const removeCurrentImage = () => {
    if (imagePreviews.length === 0) return;
    
    setImageFiles(prev => prev.filter((_, i) => i !== currentImageIndex));
    setImagePreviews(prev => prev.filter((_, i) => i !== currentImageIndex));
    setCurrentImageIndex(prev => {
      if (prev >= imagePreviews.length - 1) {
        return Math.max(0, imagePreviews.length - 2);
      }
      return prev;
    });
  };

  const goToPreviousImage = () => {
    setCurrentImageIndex(prev => (prev > 0 ? prev - 1 : imagePreviews.length - 1));
  };

  const goToNextImage = () => {
    setCurrentImageIndex(prev => (prev < imagePreviews.length - 1 ? prev + 1 : 0));
  };

  const validateForm = () => {
    const newErrors = {};

    garments.forEach((garment, index) => {
      if (!garment.damageLevel) {
        newErrors[`garment_${garment.id}_damageLevel`] = 'Please select a damage level';
      }
      if (!garment.garmentType) {
        newErrors[`garment_${garment.id}_garmentType`] = 'Please select a garment type';
      }
      if (!garment.size) {
        newErrors[`garment_${garment.id}_size`] = 'Please select a size';
      }
      if (garment.size === 'Others' && !String(garment.customSize || '').trim()) {
        newErrors[`garment_${garment.id}_customSize`] = 'Please input your size';
      }
      if (!garment.notes || garment.notes.trim() === '') {
        newErrors[`garment_${garment.id}_notes`] = 'Please provide a detailed description';
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
        slotResult = await bookSlot('repair', formData.date, formData.time);
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

      // Upload all images
      const imageUrls = [];
      
      for (const file of imageFiles) {
        console.log('Uploading image file:', file.name);
        const uploadResult = await uploadRepairImage(file);
        console.log('Upload result:', uploadResult);

        if (uploadResult.success) {
          const url = uploadResult.data.url || uploadResult.data.filename || '';
          if (url) imageUrls.push(url);
          console.log('Image uploaded successfully, URL:', url);
        } else {
          console.warn('Image upload failed:', uploadResult.message);
        }
      }

      const pickupDateTime = `${formData.date}T${formData.time}`;

      const garmentsData = garments.map(garment => {
        const damageLevel = getSelectedDamageLevel(garment);
        const basePrice = damageLevel ? parseFloat(damageLevel.base_price || 0) : 500;

        return {
          damageLevel: garment.damageLevel,
          damageLevelId: garment.damageLevelId || null,
          damageLevelDescription: damageLevel?.level_description || '',
          garmentType: garment.garmentType,
          size: garment.size === 'Others' ? String(garment.customSize || '').trim() : garment.size,
          notes: garment.notes,
          basePrice: basePrice
        };
      });

      const repairData = {
        serviceId: 1,
        serviceName: `Repair Service`,
        basePrice: estimatedPrice.toString(),
        estimatedPrice: estimatedPrice.toString(),
        pickupDate: pickupDateTime,
        imageUrl: imageUrls.length > 0 ? imageUrls[0] : 'no-image',
        imageUrls: imageUrls.length > 0 ? imageUrls : [],
        garments: garmentsData,
        isMultipleGarments: garments.length > 1,
        addAccessories: addAccessories
      };

      console.log('Repair data to send:', repairData);
      console.log('Garments:', garmentsData);

      const result = await addRepairToCart(repairData);
      console.log('Add to cart result:', result);

      if (result.success) {

        setMessage(`✅ Repair service added to cart! Estimated price: ₱${estimatedPrice}${imageUrls.length > 0 ? ` (${imageUrls.length} image${imageUrls.length > 1 ? 's' : ''} uploaded)` : ''}`);
        setTimeout(() => {
          onClose();
          if (onCartUpdate) onCartUpdate();
        }, 1500);
      } else {
        console.error('Cart addition failed:', result);
        setMessage(`❌ Error: ${result.message || 'Failed to add to cart. Please try again.'}`);
      }
    } catch (error) {
      console.error('Submit error:', error);
      setMessage('❌ Failed to add repair service');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const formatDropOffDate = (dateString) => {
    if (!dateString) return 'Not set';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return dateString;
    }
  };

  const handleClose = () => {
    setFormData({
      date: '',
      time: ''
    });
    setGarments([
      { id: 1, garmentType: '', damageLevel: '', damageLevelId: '', size: '', customSize: '', notes: '' }
    ]);
    setAddAccessories(false);
    setImageFiles([]);
    setImagePreviews([]);
    setCurrentImageIndex(0);
    setMessage('');
    setEstimatedPrice(0);
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay-shared" onClick={handleClose}>
      <div className="modal-container-shared" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-shared">
          <h2 className="modal-title-shared">Repair Service</h2>
          <button className="modal-close-shared" onClick={handleClose} aria-label="Close modal">×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-content-shared" noValidate>
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
                >
                  <option value="">Select garment type</option>
                  {repairGarmentTypes.map(g => (
                    <option key={g.repair_garment_id} value={g.garment_name}>
                      {g.garment_name}
                    </option>
                  ))}
                </select>
                {errors[`garment_${garment.id}_garmentType`] && (
                  <span className="error-message-shared">{errors[`garment_${garment.id}_garmentType`]}</span>
                )}
              </div>

              <div className="form-group-shared">
                <label className="form-label-shared">
                  <i className="fas fa-exclamation-triangle"></i> Damage Level <span className="required-indicator">*</span>
                </label>
                <select
                  value={garment.damageLevelId || ''}
                  onChange={(e) => {
                    const selectedLevel = getDamageLevelsForGarment(garment.garmentType)
                      .find((level) => String(level.repair_damage_level_id) === String(e.target.value));
                    updateGarmentDamageLevel(garment.id, e.target.value, selectedLevel?.level_name || '');
                  }}
                  className={`form-select-shared ${errors[`garment_${garment.id}_damageLevel`] ? 'error' : ''}`}
                  disabled={!garment.garmentType}
                >
                  <option value="">{garment.garmentType ? 'Select damage level' : 'Select garment type first'}</option>
                  {getDamageLevelsForGarment(garment.garmentType).map(level => (
                    <option key={level.repair_damage_level_id} value={level.repair_damage_level_id}>
                      {level.level_name} - ₱{parseFloat(level.base_price || 0)}
                    </option>
                  ))}
                </select>
                {garment.damageLevel && (
                  <div className="help-text-shared" style={{ marginTop: '8px' }}>
                    {getSelectedDamageLevel(garment)?.level_description || ''}
                  </div>
                )}
                {errors[`garment_${garment.id}_damageLevel`] && (
                  <span className="error-message-shared">{errors[`garment_${garment.id}_damageLevel`]}</span>
                )}
              </div>

              <div className="form-group-shared">
                <label className="form-label-shared">
                  <i className="fas fa-ruler"></i> Size <span className="required-indicator">*</span>
                </label>
                <select
                  value={garment.size || ''}
                  onChange={(e) => updateGarment(garment.id, 'size', e.target.value)}
                  className={`form-select-shared ${errors[`garment_${garment.id}_size`] ? 'error' : ''}`}
                >
                  <option value="">Select size</option>
                  {sizeOptions.map((size) => (
                    <option key={size.value} value={size.value}>
                      {size.label}
                    </option>
                  ))}
                </select>
                {errors[`garment_${garment.id}_size`] && (
                  <span className="error-message-shared">{errors[`garment_${garment.id}_size`]}</span>
                )}
                {garment.size === 'Others' && (
                  <div style={{ marginTop: '10px' }}>
                    <input
                      type="text"
                      value={garment.customSize || ''}
                      onChange={(e) => updateGarment(garment.id, 'customSize', e.target.value)}
                      placeholder="Enter your size"
                      className={`form-input-shared ${errors[`garment_${garment.id}_customSize`] ? 'error' : ''}`}
                    />
                    {errors[`garment_${garment.id}_customSize`] && (
                      <span className="error-message-shared">{errors[`garment_${garment.id}_customSize`]}</span>
                    )}
                  </div>
                )}
              </div>

              <div className="form-group-shared">
                <label className="form-label-shared">
                  <i className="fas fa-pen"></i> Description <span className="required-indicator">*</span>
                </label>
                <textarea
                  value={garment.notes}
                  onChange={(e) => updateGarment(garment.id, 'notes', e.target.value)}
                  placeholder="Describe the damage in detail..."
                  rows={3}
                  className={`form-textarea-shared ${errors[`garment_${garment.id}_notes`] ? 'error' : ''}`}
                />
                {errors[`garment_${garment.id}_notes`] && (
                  <span className="error-message-shared">{errors[`garment_${garment.id}_notes`]}</span>
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

          <div className="form-group-shared" style={{ marginTop: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '500' }}>
              <input
                type="checkbox"
                checked={addAccessories}
                onChange={(e) => setAddAccessories(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              Add Accessories (optional)
            </label>
            {addAccessories && (
              <p className="help-text-shared" style={{ marginTop: '4px', color: '#e65100' }}>
                ⚠️ Adding accessories requires additional payment. The admin will provide the price for your confirmation.
              </p>
            )}
          </div>

          <div className="form-group-shared">
            <label htmlFor="image" className="form-label-shared"><i className="fas fa-camera"></i> Upload Damage Photos (Recommended)</label>
            <div className="image-upload-wrapper-shared">
              <input
                type="file"
                id="image"
                name="image"
                accept="image/*"
                onChange={handleImageChange}
                className="file-input-shared"
                multiple
              />
              <label htmlFor="image" className="upload-button-shared">
                <i className="fas fa-camera"></i> Add Photo{imagePreviews.length > 0 ? ` (${imagePreviews.length})` : ''}
              </label>
            </div>
            {imagePreviews.length > 0 && (
              <div className="image-preview-shared" style={{ position: 'relative' }}>
                <img src={imagePreviews[currentImageIndex]} alt={`Damage preview ${currentImageIndex + 1}`} />
                {imagePreviews.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={goToPreviousImage}
                      style={{
                        position: 'absolute',
                        left: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'rgba(0,0,0,0.5)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        cursor: 'pointer',
                        fontSize: '18px'
                      }}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={goToNextImage}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'rgba(0,0,0,0.5)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        cursor: 'pointer',
                        fontSize: '18px'
                      }}
                    >
                      ›
                    </button>
                    <div style={{
                      position: 'absolute',
                      bottom: '10px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'rgba(0,0,0,0.5)',
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px'
                    }}>
                      {currentImageIndex + 1} / {imagePreviews.length}
                    </div>
                  </>
                )}
                <button
                  type="button"
                  className="remove-image-btn-shared"
                  onClick={removeCurrentImage}
                >
                  ✕ Remove
                </button>
              </div>
            )}

            <span className="help-text-shared">Photos help us provide accurate pricing and better service</span>
          </div>
          <div className="form-group-shared">
            <label htmlFor="date" className="form-label-shared">
              <i className="fas fa-calendar"></i> Drop off date <span className="required-indicator">*</span>
            </label>
            <input
              type="date"
              id="date"
              name="date"
              value={formData.date}
              onChange={handleDateChange}
              min={getMinDate()}
              className={`form-input-shared ${errors.date ? 'error' : ''}`}
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
          {estimatedPrice > 0 && garments.some(g => g.damageLevel) && (
            <div className="price-estimate-shared">
              <h4>Estimated Price: ₱{estimatedPrice}</h4>
              <div className="price-breakdown">
                {garments.filter(g => g.damageLevel).map((garment, index) => {
                  const damageLevel = getSelectedDamageLevel(garment);
                  return (
                    <p key={garment.id}>
                      {garment.garmentType || 'Garment'} ({damageLevel?.level_name || garment.damageLevel}): ₱{parseFloat(damageLevel?.base_price || 500)}
                    </p>
                  );
                })}
              </div>
              <p className="estimated-pickup">Drop off item date: {formData.date && formData.time ? formatDropOffDate(`${formData.date}T${formData.time}`) : 'Not set'}</p>
              <p>Final price will be confirmed after admin review</p>
            </div>
          )}

          {message && (
            <div className={`message-shared ${message.includes('✅') ? 'success' : 'error'}`}>
              {message}
            </div>
          )}

          <div className="modal-footer-shared">
            <button type="button" className="btn-shared btn-cancel-shared" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="btn-shared btn-primary-shared" disabled={loading}>
              {loading ? 'Adding...' : 'Add to Cart'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RepairFormModal;
