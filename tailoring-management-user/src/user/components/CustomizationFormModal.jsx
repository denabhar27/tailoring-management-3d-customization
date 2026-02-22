import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/CustomizationFormModal.css';
import '../../styles/SharedModal.css';
import { uploadCustomizationImage, addCustomizationToCart } from '../../api/CustomizationApi';
import { getAllFabricTypes } from '../../api/FabricTypeApi';
import { getAllGarmentTypes } from '../../api/GarmentTypeApi';
import { getAllSlotsWithAvailability, bookSlot } from '../../api/AppointmentSlotApi';

const CustomizationFormModal = ({ isOpen, onClose, onCartUpdate }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    uploadedImage: null,
    fabricType: '',
    garmentType: '',
    preferredDate: '',
    preferredTime: '',
    notes: '',
  });
  const [allTimeSlots, setAllTimeSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(true);
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState({});
  const [estimatedPrice, setEstimatedPrice] = useState(0);
  const [designDetails, setDesignDetails] = useState(null);

  const defaultFabricTypes = {
    'Cotton': 200,
    'Silk': 300,
    'Linen': 400,
    'Wool': 200
  };

  const [fabricTypes, setFabricTypes] = useState(defaultFabricTypes);

  const [garmentTypes, setGarmentTypes] = useState({});

  const [garmentCodeToName, setGarmentCodeToName] = useState({});

  const presetColors = [
    { name: 'Classic Black', value: '#1a1a1a' },
    { name: 'Navy Blue', value: '#1e3a5f' },
    { name: 'Burgundy', value: '#6b1e3d' },
    { name: 'Forest Green', value: '#2d5a3d' },
    { name: 'Charcoal Gray', value: '#4a4a4a' },
    { name: 'Camel Tan', value: '#c9a66b' },
    { name: 'Cream White', value: '#f5e6d3' },
    { name: 'Chocolate Brown', value: '#5D4037' },
    { name: 'Royal Blue', value: '#2a4d8f' },
    { name: 'Wine Red', value: '#722F37' },
  ];

  const getColorName = (hex) => {
    if (!hex) return 'Not specified';

    if (typeof hex === 'string' && !hex.startsWith('#') && !hex.match(/^[0-9a-fA-F]{3,6}$/)) {
      return hex.charAt(0).toUpperCase() + hex.slice(1);
    }

    let normalizedHex = String(hex).toLowerCase().trim();
    if (!normalizedHex.startsWith('#')) {
      normalizedHex = `#${normalizedHex}`;
    }

    const presetMatch = presetColors.find(color => color.value.toLowerCase() === normalizedHex);
    if (presetMatch) {
      return presetMatch.name;
    }

    const additionalColorMap = {
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

    if (additionalColorMap[normalizedHex]) {
      return additionalColorMap[normalizedHex];
    }

    if (normalizedHex.match(/^#[0-9a-f]{6}$/)) {

      const r = parseInt(normalizedHex.slice(1, 3), 16);
      const g = parseInt(normalizedHex.slice(3, 5), 16);
      const b = parseInt(normalizedHex.slice(5, 7), 16);

      let closestColor = presetColors[0];
      let minDistance = Infinity;

      presetColors.forEach(preset => {
        const presetR = parseInt(preset.value.slice(1, 3), 16);
        const presetG = parseInt(preset.value.slice(3, 5), 16);
        const presetB = parseInt(preset.value.slice(5, 7), 16);

        const distance = Math.sqrt(
          Math.pow(r - presetR, 2) +
          Math.pow(g - presetG, 2) +
          Math.pow(b - presetB, 2)
        );

        if (distance < minDistance) {
          minDistance = distance;
          closestColor = preset;
        }
      });

      if (minDistance < 30) {
        return closestColor.name;
      }

      if (r > 200 && g > 200 && b > 200) return 'Light Color';
      if (r < 50 && g < 50 && b < 50) return 'Dark Color';
      if (r > g && r > b) return 'Reddish';
      if (g > r && g > b) return 'Greenish';
      if (b > r && b > g) return 'Bluish';
      if (r === g && g === b) return 'Gray';

      return 'Custom Color';
    }

    return 'Custom Color';
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

  useEffect(() => {
    if (isOpen) {
      const loadFabricTypes = async () => {
        try {
          console.log('🔄 Loading fabric types from API...');
          const result = await getAllFabricTypes();
          console.log('✅ Fabric types API result:', result);

          const fabricTypesObj = { ...defaultFabricTypes };

          if (result.success && result.fabrics && result.fabrics.length > 0) {

            result.fabrics.forEach(fabric => {
              fabricTypesObj[fabric.fabric_name] = parseFloat(fabric.fabric_price);
            });
            console.log('✅ Merged fabric types (defaults + API):', fabricTypesObj);
            console.log('✅ Total fabric types:', Object.keys(fabricTypesObj).length);
            setFabricTypes(fabricTypesObj);
          } else {
            console.warn('⚠️ No fabric types found from API, using defaults only');

            setFabricTypes(defaultFabricTypes);
          }
        } catch (error) {
          console.error('❌ Error loading fabric types:', error);

          setFabricTypes(defaultFabricTypes);
        }
      };

      const loadGarmentTypes = async () => {
        try {
          console.log('🔄 Loading garment types from API...');
          const result = await getAllGarmentTypes();
          console.log('✅ Garment types API result:', result);

          if (result.success && result.garments && result.garments.length > 0) {

            const garmentTypesObj = {};
            const codeToNameMap = {};
            result.garments.forEach(garment => {
              garmentTypesObj[garment.garment_name] = parseFloat(garment.garment_price);

              if (garment.garment_code) {
                codeToNameMap[garment.garment_code.toLowerCase()] = garment.garment_name;
              }

              codeToNameMap[garment.garment_name.toLowerCase()] = garment.garment_name;
            });
            console.log('✅ Garment types from API:', garmentTypesObj);
            console.log('✅ Garment code to name mapping:', codeToNameMap);
            console.log('✅ Total garment types:', Object.keys(garmentTypesObj).length);
            setGarmentTypes(garmentTypesObj);
            setGarmentCodeToName(codeToNameMap);
          } else {
            console.warn('⚠️ No garment types found from API');
            setGarmentTypes({});
            setGarmentCodeToName({});
          }
        } catch (error) {
          console.error('❌ Error loading garment types:', error);
          setGarmentTypes({});
          setGarmentCodeToName({});
        }
      };

      const timer = setTimeout(() => {
        loadFabricTypes();
        loadGarmentTypes();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (formData.preferredDate) {
      loadAvailableSlots(formData.preferredDate);
    } else {
      setAllTimeSlots([]);
      setIsShopOpen(true);
      setFormData(prev => ({ ...prev, preferredTime: '' }));
    }
  }, [formData.preferredDate]);

  const loadAvailableSlots = async (date) => {
    if (!date) return;

    setLoadingSlots(true);

    try {

      const result = await getAllSlotsWithAvailability('customization', date);

      if (result.success) {
        if (!result.isShopOpen) {
          setIsShopOpen(false);
          setAllTimeSlots([]);
          setErrors(prev => ({ ...prev, preferredDate: 'The shop is closed on this date. Please select another date.' }));
          return;
        }

        setIsShopOpen(true);
        setAllTimeSlots(result.slots || []);
        setErrors(prev => ({ ...prev, preferredDate: null }));
      } else {
        setErrors(prev => ({ ...prev, preferredDate: result.message || 'Error loading time slots' }));
        setAllTimeSlots([]);
      }
    } catch (error) {
      console.error('Error loading available slots:', error);
      setErrors(prev => ({ ...prev, preferredDate: 'Error loading available time slots' }));
      setAllTimeSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  useEffect(() => {
    if (designDetails?._pendingGarmentAutoFill && Object.keys(garmentCodeToName).length > 0) {
      console.log('🎯 Processing pending garment auto-fill...');
      console.log('🎯 Design details:', designDetails);
      console.log('🎯 Available garment code mapping:', garmentCodeToName);

      let mappedGarment = '';

      if (designDetails.garment) {
        const garmentCode = designDetails.garment.toLowerCase();
        console.log('🎯 Trying to match garment code:', garmentCode);

        if (garmentCodeToName[garmentCode]) {
          mappedGarment = garmentCodeToName[garmentCode];
        } else {

          for (const [code, name] of Object.entries(garmentCodeToName)) {
            if (garmentCode.includes(code) || code.includes(garmentCode)) {
              mappedGarment = name;
              break;
            }
          }
        }
      }

      if (!mappedGarment && designDetails.garmentType) {
        const garmentTypeLower = designDetails.garmentType.toLowerCase();
        console.log('🎯 Trying to match garment type name:', garmentTypeLower);

        if (garmentCodeToName[garmentTypeLower]) {
          mappedGarment = garmentCodeToName[garmentTypeLower];
        } else {

          for (const [code, name] of Object.entries(garmentCodeToName)) {
            const nameLower = name.toLowerCase();
            if (garmentTypeLower.includes(nameLower) || nameLower.includes(garmentTypeLower) ||
                garmentTypeLower.includes(code) || code.includes(garmentTypeLower)) {
              mappedGarment = name;
              break;
            }
          }
        }
      }

      console.log('🎯 Final mapped garment:', mappedGarment || '(no match found)');

      if (mappedGarment) {
        setFormData(prev => ({
          ...prev,
          garmentType: mappedGarment
        }));
      }

      setDesignDetails(prev => ({
        ...prev,
        _pendingGarmentAutoFill: false
      }));
    }
  }, [garmentCodeToName, designDetails]);

  useEffect(() => {
    if (isOpen) {
      const finalDesignData = sessionStorage.getItem('finalDesignData');
      if (finalDesignData) {
        try {
          const design = JSON.parse(finalDesignData);
          console.log('Loading 3D customization data:', design);

          let angleImages = design.design?.angleImages || null;
          let designImage = design.design?.designImage || design.designImage || null;

          if (angleImages && angleImages.front) {
            designImage = angleImages.front;
          }

          if (design.design) {
            setDesignDetails({
              ...design.design,
              _pendingGarmentAutoFill: true
            });
          }

          if (designImage) {

            let imageData = designImage;
            if (designImage.startsWith('data:image')) {
              setImagePreview(designImage);
              imageData = designImage.split(',')[1];
            } else {

              setImagePreview(`data:image/png;base64,${designImage}`);
            }

            try {
              const byteCharacters = atob(imageData);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray], { type: 'image/png' });
              const file = new File([blob], '3d-design.png', { type: 'image/png' });
              setFormData(prev => ({
                ...prev,
                uploadedImage: file
              }));
            } catch (err) {
              console.error('Error converting image:', err);
            }
          }

          if (design.design?.fabric) {

            const fabricMap = {
              'wool': 'Wool',
              'cotton': 'Cotton',
              'silk': 'Silk',
              'linen': 'Linen'
            };
            const fabricName = fabricMap[design.design.fabric.toLowerCase()] ||
                              (design.design.fabric.charAt(0).toUpperCase() + design.design.fabric.slice(1));
            setFormData(prev => ({
              ...prev,
              fabricType: fabricName in fabricTypes ? fabricName : fabricName
            }));
          }

          if (design.notes || design.design?.notes) {
            setFormData(prev => ({
              ...prev,
              notes: design.notes || design.design?.notes || ''
            }));
          }

          sessionStorage.removeItem('finalDesignData');
        } catch (error) {
          console.error('Error loading 3D customization data:', error);
        }
      }
    }
  }, [isOpen]);

  const isUniformSelected = formData.garmentType === 'Uniform';

  useEffect(() => {
    if (formData.garmentType === 'Uniform') {

      setEstimatedPrice(0);
    } else if (formData.fabricType && formData.garmentType) {
      const fabricPrice = fabricTypes[formData.fabricType] || 0;
      const garmentPrice = garmentTypes[formData.garmentType] || 0;
      const total = fabricPrice + garmentPrice;
      setEstimatedPrice(total);
    } else {
      setEstimatedPrice(0);
    }
  }, [formData.fabricType, formData.garmentType]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {

      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, image: 'Please upload a valid image file' }));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, image: 'Image size must be less than 5MB' }));
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData(prev => ({
          ...prev,
          uploadedImage: file,
        }));
        setImagePreview(event.target.result);
        setErrors(prev => ({ ...prev, image: '' }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = async (e) => {
    const { name, value } = e.target;

    if (name === 'preferredDate' && value) {
      try {
        const { checkDateOpen } = await import('../../api/ShopScheduleApi');
        const result = await checkDateOpen(value);
        if (!result.success || !result.is_open) {
          setErrors(prev => ({ ...prev, preferredDate: 'Appointments are not available on this date. Please select another date.' }));
          setFormData(prev => ({
            ...prev,
            [name]: '',
          }));
          return;
        }
      } catch (error) {
        console.error('Error checking date availability:', error);

      }
    }

    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.uploadedImage && !imagePreview) {
      newErrors.image = 'Please upload a reference image';
    }
    if (!formData.fabricType) {
      newErrors.fabricType = 'Please select a fabric type';
    }
    if (!formData.garmentType) {
      newErrors.garmentType = 'Please select a garment type';
    }
    if (!formData.preferredDate) {
      newErrors.preferredDate = 'Please select a preferred date';
    }
    if (!formData.preferredTime) {
      newErrors.preferredTime = 'Please select a time slot';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddToCart = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      let imageUrl = 'no-image';

      if (formData.uploadedImage) {
        const uploadResult = await uploadCustomizationImage(formData.uploadedImage);
        if (uploadResult.success) {
          imageUrl = uploadResult.imageUrl;
        } else {
          throw new Error(uploadResult.message || 'Failed to upload image');
        }
      }

      let cleanDesignData = null;
      if (designDetails) {

        cleanDesignData = JSON.parse(JSON.stringify(designDetails));

        if (cleanDesignData.designImage) {
          delete cleanDesignData.designImage;
        }

        if (cleanDesignData.design && cleanDesignData.design.designImage) {
          delete cleanDesignData.design.designImage;
        }

      }

      const isUniform = formData.garmentType === 'Uniform';
      const priceToSubmit = isUniform ? 0 : (estimatedPrice || 500);

      let slotResult = null;
      try {
        slotResult = await bookSlot('customization', formData.preferredDate, formData.preferredTime);
        if (!slotResult?.success) {
          const errorMsg = slotResult?.message || 'Failed to book appointment slot. This time may already be taken.';
          console.error('Slot booking failed:', slotResult);
          throw new Error(errorMsg);
        }
        console.log('Slot booked successfully:', slotResult);
      } catch (slotError) {
        console.error('Slot booking error:', slotError);
        const errorMsg = slotError.response?.data?.message || slotError.message || 'Failed to book appointment slot. Please try again.';
        throw new Error(errorMsg);
      }

      const cartResult = await addCustomizationToCart({
        fabricType: formData.fabricType,
        garmentType: formData.garmentType,
        preferredDate: formData.preferredDate,
        preferredTime: formData.preferredTime,
        notes: formData.notes,
        imageUrl: imageUrl,
        estimatedPrice: priceToSubmit,
        isUniform: isUniform,
        designData: cleanDesignData || {},
      });

      if (cartResult.success) {

        setMessage('Added to cart successfully!');

        if (onCartUpdate) {
          onCartUpdate();
        }

        setTimeout(() => {
          resetForm();
          onClose();
        }, 1000);
      } else {
        throw new Error(cartResult.message || 'Failed to add to cart');
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
      setMessage(error.message || 'Failed to add to cart. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen3DCustomizer = () => {

    sessionStorage.setItem('customizationFormData', JSON.stringify({
      fabricType: formData.fabricType,
      garmentType: formData.garmentType,
      preferredDate: formData.preferredDate,
      notes: formData.notes,
      imagePreview: imagePreview,
    }));

    sessionStorage.setItem('reopenCustomizationModal', 'true');

    onClose();
    navigate('/3d-customizer');
  };

  const resetForm = () => {
    setFormData({
      uploadedImage: null,
      fabricType: '',
      garmentType: '',
      preferredDate: '',
      preferredTime: '',
      notes: '',
    });
    setAllTimeSlots([]);
    setIsShopOpen(true);
    setImagePreview('');
    setErrors({});
    setEstimatedPrice(0);
    setDesignDetails(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay-shared" onClick={handleClose}>
      <div className="modal-container-shared" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-shared">
          <h2 className="modal-title-shared">Customization Service</h2>
          <button className="modal-close-shared" onClick={handleClose} aria-label="Close modal">
            ×
          </button>
        </div>
        <div className="modal-content-shared">
          {message && (
            <div className={`message-shared ${loading ? 'info' : 'success'}`}>
              {message}
            </div>
          )}
          <div className="form-group-shared">
            <label className="form-label-shared">
              <i className="fas fa-camera"></i> Upload Reference Image
              <span className="required-indicator">*</span>
            </label>
            {isUniformSelected && (
              <div style={{
                backgroundColor: '#fff3e0',
                padding: '10px 15px',
                borderRadius: '8px',
                marginBottom: '10px',
                border: '1px solid #ffb74d',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <span style={{ fontSize: '20px' }}><i className="fas fa-tshirt"></i></span>
                <div>
                  <strong style={{ color: '#e65100' }}>Uniform Selected</strong>
                  <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#666' }}>
                    Please upload a clear picture of your uniform for accurate pricing. Final price will be determined based on uniform type and complexity.
                  </p>
                </div>
              </div>
            )}
            <div className="image-upload-wrapper-shared">
              <input
                type="file"
                id="imageUpload"
                accept="image/*"
                onChange={handleImageUpload}
                className="file-input-shared"
                disabled={loading}
              />
              <label htmlFor="imageUpload" className="upload-button-shared">
                {imagePreview ? <><i className="fas fa-camera"></i> Change Image</> : <><i className="fas fa-folder-open"></i> Choose Image</>}
              </label>
            </div>

            {imagePreview && (
              <div className="image-preview-shared">
                {designDetails?.angleImages ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '10px' }}>
                    {['front', 'back', 'right', 'left'].map((angle) => (
                      designDetails.angleImages[angle] && (
                        <div key={angle} style={{ position: 'relative' }}>
                          <img
                            src={designDetails.angleImages[angle]}
                            alt={`${angle} view`}
                            style={{ width: '100%', height: 'auto', borderRadius: '8px', border: '2px solid #e0e0e0' }}
                          />
                          <div style={{
                            position: 'absolute',
                            bottom: '5px',
                            left: '5px',
                            background: 'rgba(0,0,0,0.7)',
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            textTransform: 'capitalize',
                            fontWeight: 'bold'
                          }}>
                            {angle}
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                ) : (
                  <img src={imagePreview} alt="Preview" />
                )}
                <button
                  type="button"
                  className="remove-image-btn-shared"
                  onClick={() => {
                    setFormData(prev => ({
                      ...prev,
                      uploadedImage: null,
                    }));
                    setImagePreview('');
                    setDesignDetails(prev => prev ? { ...prev, angleImages: null } : null);
                  }}
                  disabled={loading}
                >
                  Remove
                </button>
              </div>
            )}
            {errors.image && (
              <span className="error-message-shared">{errors.image}</span>
            )}
          </div>
          <div className="form-group-shared">
            <label htmlFor="fabricType" className="form-label-shared">
              <i className="fas fa-scroll"></i> Fabric Type
              <span className="required-indicator">*</span>
            </label>
            <select
              id="fabricType"
              name="fabricType"
              value={formData.fabricType}
              onChange={handleInputChange}
              className={`form-select-shared ${errors.fabricType ? 'error' : ''}`}
              disabled={loading}
            >
              <option value="">-- Select Fabric Type --</option>
              {Object.keys(fabricTypes).length > 0 ? (
                Object.keys(fabricTypes).sort().map(fabric => (
                  <option key={fabric} value={fabric}>
                    {fabric} - ₱{fabricTypes[fabric].toFixed(2)}
                  </option>
                ))
              ) : (
                <option value="" disabled>Loading fabric types...</option>
              )}
            </select>
            {errors.fabricType && (
              <span className="error-message-shared">{errors.fabricType}</span>
            )}
          </div>
          <div className="form-group-shared">
            <label htmlFor="garmentType" className="form-label-shared">
              <i className="fas fa-tshirt"></i> Garment Type
              <span className="required-indicator">*</span>
            </label>
            <select
              id="garmentType"
              name="garmentType"
              value={formData.garmentType}
              onChange={handleInputChange}
              className={`form-select-shared ${errors.garmentType ? 'error' : ''}`}
              disabled={loading}
            >
              <option value="">-- Select Garment Type --</option>
              {Object.keys(garmentTypes).map(garment => (
                <option key={garment} value={garment}>
                  {garment} - ₱{garmentTypes[garment]}
                </option>
              ))}
              <option value="Uniform" style={{ fontWeight: 'bold' }}><i className="fas fa-tshirt"></i> Uniform (Price varies)</option>
            </select>
            {errors.garmentType && (
              <span className="error-message-shared">{errors.garmentType}</span>
            )}
          </div>
          <div className="form-group-shared">
            <label htmlFor="preferredDate" className="form-label-shared">
              <i className="fas fa-calendar"></i> Preferred Date for Sizing in Store
              <span className="required-indicator">*</span>
            </label>
            <input
              type="date"
              id="preferredDate"
              name="preferredDate"
              value={formData.preferredDate}
              onChange={handleInputChange}
              min={(() => {
                const today = new Date();
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
              })()}
              className={`form-input-shared ${errors.preferredDate ? 'error' : ''}`}
              disabled={loading}
            />
            {errors.preferredDate && (
              <span className="error-message-shared">{errors.preferredDate}</span>
            )}
          </div>
          {formData.preferredDate && (
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
                        className={`time-slot-btn ${slot.status} ${formData.preferredTime === slot.time_slot ? 'selected' : ''}`}
                        onClick={() => slot.isClickable && setFormData(prev => ({ ...prev, preferredTime: slot.time_slot }))}
                        disabled={!slot.isClickable || loading}
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

              {formData.preferredTime && (
                <div className="selected-slot-info">
                  <i className="fas fa-check"></i> Selected: <strong>{allTimeSlots.find(s => s.time_slot === formData.preferredTime)?.display_time}</strong>
                </div>
              )}
            </div>
          )}
          {designDetails && (
            <div className="form-group" style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #e0e0e0', marginTop: '10px' }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#333', fontSize: '16px', fontWeight: '600' }}>
                <i className="fas fa-palette"></i> 3D Customization Choices
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '14px' }}>
                {designDetails.size && (
                  <div>
                    <strong>Size:</strong> {designDetails.size.charAt(0).toUpperCase() + designDetails.size.slice(1)}
                  </div>
                )}
                {designDetails.fit && (
                  <div>
                    <strong>Fit:</strong> {designDetails.fit.charAt(0).toUpperCase() + designDetails.fit.slice(1)}
                  </div>
                )}
                {designDetails.colors && designDetails.colors.fabric && (
                  <div>
                    <strong>Color:</strong> {getColorName(designDetails.colors.fabric)}
                  </div>
                )}
                {designDetails.pattern && designDetails.pattern !== 'none' && (
                  <div>
                    <strong>Pattern:</strong> {designDetails.pattern.charAt(0).toUpperCase() + designDetails.pattern.slice(1)}
                  </div>
                )}
                {designDetails.personalization && designDetails.personalization.initials && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <strong>Personalization:</strong> {designDetails.personalization.initials}
                    {designDetails.personalization.font && ` (${designDetails.personalization.font} font)`}
                  </div>
                )}
                {designDetails.buttons && designDetails.buttons.length > 0 && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <strong>Button Type:</strong>
                    <div style={{ marginLeft: '10px', marginTop: '5px', fontSize: '13px' }}>
                      {designDetails.buttons.map((btn, index) => (
                        <div key={btn.id || index}>
                          Button {index + 1}: {getButtonType(btn.modelPath)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {designDetails.accessories && designDetails.accessories.length > 0 && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <strong>Accessories:</strong>
                    <div style={{ marginLeft: '10px', marginTop: '5px', fontSize: '13px' }}>
                      {designDetails.accessories.map((acc, index) => (
                        <div key={acc.id || index}>
                          {getAccessoryName(acc.modelPath)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="form-group-shared">
            <label htmlFor="notes" className="form-label-shared">
              <i className="fas fa-pen"></i> Additional Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              placeholder="Add any special requests or notes..."
              rows="3"
              className="form-textarea-shared"
              disabled={loading}
            />
          </div>
          {isUniformSelected ? (
            <div className="price-estimate-shared" style={{ backgroundColor: '#fff3e0', borderColor: '#ffb74d' }}>
              <h4 style={{ color: '#e65100' }}>💰 Price: Varies by uniform type</h4>
              <p style={{ color: '#666' }}>
                Uniform pricing depends on the type, fabric, complexity, and quantity. Our team will provide an accurate quote after reviewing your uploaded image.
              </p>
              <p className="help-text-shared" style={{ marginTop: '12px', fontStyle: 'italic' }}>
                Note: Please ensure you upload a clear picture of the uniform for accurate pricing.
              </p>
            </div>
          ) : estimatedPrice > 0 && formData.fabricType && formData.garmentType && (
            <div className="price-estimate-shared">
              <h4>Estimated Price: ₱{estimatedPrice}</h4>
              <p>
                Fabric: {formData.fabricType} (₱{fabricTypes[formData.fabricType]}) +
                Garment: {formData.garmentType} (₱{garmentTypes[formData.garmentType]})
              </p>
              <p className="help-text-shared" style={{ marginTop: '12px', fontStyle: 'italic' }}>
                Note: Estimated price is based on the selected garment and fabric type. Final price may vary depending on sizes and other accessories.
              </p>
            </div>
          )}
        </div>
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
            type="button"
            className="btn-shared btn-secondary-shared"
            onClick={handleOpen3DCustomizer}
            disabled={loading}
            style={{ fontSize: '14px' }}
          >
            <i className="fas fa-tshirt" style={{ marginRight: '8px' }}></i> 3D Customize
          </button>
          <button
            type="button"
            className="btn-shared btn-primary-shared"
            onClick={handleAddToCart}
            disabled={loading}
          >
            {loading ? 'Adding...' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomizationFormModal;
