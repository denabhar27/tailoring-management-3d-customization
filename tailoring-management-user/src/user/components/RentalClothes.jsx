import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllRentals, getRentalImageUrl } from '../../api/RentalApi';
import { addToCart } from '../../api/CartApi';
import suitSample from "../../assets/suits.png";
import { useAlert } from '../../context/AlertContext';
import '../../components/SimpleImageCarousel.css';
import '../../styles/RentalClothes.css';

const SIZE_LABELS = {
  small: 'Small (S)',
  medium: 'Medium (M)',
  large: 'Large (L)',
  extra_large: 'Extra Large (XL)'
};

const normalizeMeasurementValue = (value) => {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'object' && value !== null) {
    return {
      inch: value.inch ?? '',
      cm: value.cm ?? ''
    };
  }

  const asString = String(value).trim();
  if (!asString) return null;
  return { inch: asString, cm: '' };
};

const normalizeMeasurementsObject = (raw) => {
  if (!raw || typeof raw !== 'object') return null;

  const source = typeof raw === 'string' ? (() => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  })() : raw;

  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;

  const normalized = {};
  const mergeSection = (section) => {
    if (!section || typeof section !== 'object') return;
    Object.entries(section).forEach(([key, value]) => {
      const parsed = normalizeMeasurementValue(value);
      if (parsed) normalized[key] = parsed;
    });
  };

  if (source.top || source.bottom) {
    mergeSection(source.top);
    mergeSection(source.bottom);
  }

  mergeSection(source);
  return Object.keys(normalized).length > 0 ? normalized : null;
};

const parseRentalSizeConfig = (rawSize) => {
  const fallback = { sizeOptions: {}, measurementProfile: null };

  if (!rawSize) return fallback;

  try {
    const parsed = typeof rawSize === 'string' ? JSON.parse(rawSize) : rawSize;
    if (!parsed || typeof parsed !== 'object') return fallback;

    // v2 format: per-size entries
    if (parsed.format === 'rental_size_v2' && Array.isArray(parsed.size_entries)) {
      const sizeOptions = {};
      let measurementProfile = null;
      parsed.size_entries.forEach((entry, idx) => {
        const key = entry.sizeKey !== 'custom'
          ? entry.sizeKey
          : (entry.customLabel || `Custom ${idx + 1}`);
        const qty = parseInt(entry.quantity, 10);
        const price = parseFloat(entry.price) || 0;
        const normalizedMeasurements = normalizeMeasurementsObject(
          entry.measurements || entry.measurement_profile || entry.measurementProfile
        );
        sizeOptions[key] = {
          quantity: isNaN(qty) ? null : Math.max(0, qty),
          price,
          measurements: normalizedMeasurements,
          label: SIZE_LABELS[key] || entry.customLabel || key
        };
        if (!measurementProfile && normalizedMeasurements) {
          measurementProfile = normalizedMeasurements;
        }
      });

      if (!measurementProfile) {
        measurementProfile = normalizeMeasurementsObject(parsed.measurement_profile || parsed.measurementProfile);
      }

      return { sizeOptions, measurementProfile };
    }

    // v1 format
    const hasStructuredOptions = parsed.size_options || parsed.sizeOptions;
    if (hasStructuredOptions) {
      const optionsSource = parsed.size_options || parsed.sizeOptions;
      const normalizedOptions = {};

      Object.keys(SIZE_LABELS).forEach((key) => {
        const option = optionsSource?.[key];
        if (!option || typeof option !== 'object') return;

        const quantity = parseInt(option.quantity, 10);
        normalizedOptions[key] = {
          inch: option.inch || '',
          cm: option.cm || '',
          quantity: Number.isNaN(quantity) ? null : Math.max(0, quantity),
          measurements: normalizeMeasurementsObject(option.measurements)
        };
      });

      return {
        sizeOptions: normalizedOptions,
        measurementProfile: normalizeMeasurementsObject(parsed.measurement_profile || parsed.measurementProfile)
      };
    }

    return {
      sizeOptions: {},
      measurementProfile: normalizeMeasurementsObject(parsed)
    };
  } catch (e) {
    return fallback;
  }
};

const getAvailableSizeKeys = (sizeOptions = {}) => {
  return Object.keys(sizeOptions).filter((key) => {
    const qty = sizeOptions?.[key]?.quantity;
    if (qty === null || qty === undefined || qty === '') return true;
    const parsedQty = parseInt(qty, 10);
    return !Number.isNaN(parsedQty) && parsedQty > 0;
  });
};

const RentalImageCarousel = ({ images, itemName }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageErrors, setImageErrors] = useState({});

  const validImages = images.filter(img => img && img.url);

  const handleImageError = (index) => {
    setImageErrors(prev => ({ ...prev, [index]: true }));
  };

  const getImageSrc = (img, index) => {
    if (imageErrors[index]) {
      return suitSample;
    }
    return img.url;
  };

  if (validImages.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderRadius: '10px' }}>
        <img
          src={suitSample}
          alt={itemName}
          style={{ maxWidth: '100%', maxHeight: '560px', objectFit: 'contain', borderRadius: '10px' }}
        />
      </div>
    );
  }

  if (validImages.length === 1) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderRadius: '10px' }}>
        <img
          src={getImageSrc(validImages[0], 0)}
          alt={itemName}
          onError={() => handleImageError(0)}
          style={{ maxWidth: '100%', maxHeight: '560px', objectFit: 'contain', borderRadius: '10px' }}
        />
      </div>
    );
  }

  const goToPrev = () => setCurrentIndex(prev => (prev === 0 ? validImages.length - 1 : prev - 1));
  const goToNext = () => setCurrentIndex(prev => (prev === validImages.length - 1 ? 0 : prev + 1));

  return (
    <div className="simple-image-carousel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{
        position: 'relative',
        backgroundColor: '#ffffff',
        borderRadius: '10px',
        overflow: 'hidden',
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '520px'
      }}>
        <img
          src={getImageSrc(validImages[currentIndex], currentIndex)}
          alt={`${itemName} - ${validImages[currentIndex].label}`}
          onError={() => handleImageError(currentIndex)}
          style={{ maxWidth: '100%', maxHeight: '560px', objectFit: 'contain' }}
        />
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
          {validImages[currentIndex].label}
        </div>
        <button 
          onClick={goToPrev} 
          type="button"
          className="carousel-nav-btn carousel-nav-prev"
        >‹</button>
        <button 
          onClick={goToNext} 
          type="button"
          className="carousel-nav-btn carousel-nav-next"
        >›</button>
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
              src={getImageSrc(img, index)} 
              alt={img.label} 
              onError={() => handleImageError(index)}
              className="carousel-thumbnail-img"
            />
          </button>
        ))}
      </div>
    </div>
  );
};

const MeasurementsDropdown = ({ measurements, item, isInModal = false, measurementUnit = 'inch', onUnitChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ marginTop: isInModal ? '0' : '8px', marginBottom: isInModal ? '0' : '8px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ marginBottom: isInModal ? '0' : '10px', display: 'flex', justifyContent: 'center' }}>
        {!isInModal && <strong style={{ display: 'block', marginBottom: '10px' }}>Measurements:</strong>}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          style={{
            width: '180px',
            minWidth: '180px',
            maxWidth: '180px',
            padding: '6px 12px',
            backgroundColor: '#8B4513',
            border: 'none',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '6px',
            transition: 'background-color 0.2s ease',
            fontWeight: '500',
            textAlign: 'left',
            boxSizing: 'border-box'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#6d370f'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#8B4513'}
        >
          <span>Show Measurements</span>
          <span style={{ fontSize: '9px', transition: 'transform 0.2s ease', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            ▼
          </span>
        </button>
      </div>

      {isOpen && (
        <div style={{
          marginTop: '8px',
          padding: isInModal ? '15px 20px' : '12px 15px',
          backgroundColor: '#fff',
          border: '1px solid #dee2e6',
          borderRadius: '6px',
          fontSize: isInModal ? '14px' : '12px',
          color: '#333',
          minWidth: isInModal ? '280px' : '200px',
          maxHeight: isInModal ? '350px' : '250px',
          overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          {isInModal && onUnitChange && (
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              marginBottom: '15px',
              paddingBottom: '15px',
              borderBottom: '1px solid #e0e0e0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#f5f5f5', padding: '2px', borderRadius: '20px' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnitChange('inch');
                  }}
                  style={{
                    padding: '4px 12px',
                    border: 'none',
                    borderRadius: '15px',
                    backgroundColor: measurementUnit === 'inch' ? '#2196F3' : '#666',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: measurementUnit === 'inch' ? '600' : '400',
                    transition: 'all 0.2s'
                  }}
                >
                  Inch
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnitChange('cm');
                  }}
                  style={{
                    padding: '4px 12px',
                    border: 'none',
                    borderRadius: '15px',
                    backgroundColor: measurementUnit === 'cm' ? '#2196F3' : '#666',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: measurementUnit === 'cm' ? '600' : '400',
                    transition: 'all 0.2s'
                  }}
                >
                  CM
                </button>
              </div>
            </div>
          )}
          {measurements.map((measurement, idx) => (
            <div key={idx} style={{
              padding: isInModal ? '6px 0' : '4px 0',
              borderBottom: idx < measurements.length - 1 ? '1px solid #f0f0f0' : 'none',
              fontSize: isInModal ? '14px' : '11px'
            }}>
              {measurement}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const RentalClothes = ({ openAuthModal, showAll = false, isGuest = false }) => {
  const { alert } = useAlert();
  const [rentalItems, setRentalItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [rentalDuration, setRentalDuration] = useState(3);
  const [endDate, setEndDate] = useState('');
  const [totalCost, setTotalCost] = useState(0);
  const [cartMessage, setCartMessage] = useState('');
  const [dateError, setDateError] = useState('');
  const [addingToCart, setAddingToCart] = useState(false);
  const [measurementUnit, setMeasurementUnit] = useState('inch');
  const [sizeSelections, setSizeSelections] = useState({});
  const [expandedMeasurementSize, setExpandedMeasurementSize] = useState(null);
  const navigate = useNavigate();

  const getDisplayPrice = (item) => {
    if (!item) return 500;
    const prices = getAvailableSizeKeys(item.sizeOptions || {})
      .map((k) => parseFloat(item.sizeOptions?.[k]?.price))
      .filter((p) => !isNaN(p) && p > 0);

    if (prices.length > 0) {
      return Math.min(...prices);
    }

    const fallback = parseFloat(String(item.price || '').replace(/[^\d.]/g, ''));
    return !isNaN(fallback) && fallback > 0 ? fallback : 500;
  };

  const calculateEndDate = (start, duration) => {
    if (!start) return '';
    const startDateObj = new Date(start);
    const endDateObj = new Date(startDateObj);
    endDateObj.setDate(startDateObj.getDate() + duration - 1);
    return endDateObj.toISOString().split('T')[0];
  };

  useEffect(() => {
    if (startDate && rentalDuration) {
      const calculatedEndDate = calculateEndDate(startDate, rentalDuration);
      setEndDate(calculatedEndDate);
      if (selectedItem) {
        const cost = calculateTotalCostWithSelections(sizeSelections, selectedItem, rentalDuration);
        setTotalCost(cost);
      }
    } else {
      setEndDate('');
      setTotalCost(0);
    }
  }, [startDate, rentalDuration, selectedItem, sizeSelections]);

  const isTopCategory = (category) => {
    return ['suit', 'tuxedo', 'formal_wear', 'business'].includes(category);
  };

  const isBottomCategory = (category) => {
    return ['casual', 'pants', 'trousers'].includes(category);
  };

  const getMeasurementValue = (measurement, unit) => {
    if (!measurement) return null;

    if (typeof measurement === 'object' && measurement.inch !== undefined) {
      if (unit === 'inch') {
        return measurement.inch ? `${measurement.inch} inch` : null;
      } else {
        return measurement.cm ? `${measurement.cm} cm` : null;
      }
    }

    if (typeof measurement === 'string' || typeof measurement === 'number') {
      const inchValue = String(measurement);
      if (unit === 'inch') {
        return `${inchValue} inch`;
      } else {

        const num = parseFloat(inchValue);
        if (isNaN(num)) return null;
        return `${(num * 2.54).toFixed(2)} cm`;
      }
    }

    return null;
  };

  const getMeasurementsSummary = (item) => {
    if (!item || !item.size) return null;

    try {
      const source = item.measurementProfile || parseRentalSizeConfig(item.size).measurementProfile;
      let measurements;
      let sizeString = source;

      if (typeof sizeString === 'string' && sizeString.startsWith('{') && !sizeString.endsWith('}')) {

        return null;
      }

      if (typeof sizeString === 'string') {
        try {
          measurements = JSON.parse(sizeString);
        } catch (parseError) {

          return null;
        }
      } else {
        measurements = sizeString;
      }

      if (!measurements || typeof measurements !== 'object' || Array.isArray(measurements)) {
        return null;
      }

      const parts = Object.entries(measurements)
        .filter(([key, value]) => {

          if (typeof value === 'object' && value !== null) {

            return (value.inch && value.inch !== '' && value.inch !== '0') ||
                   (value.cm && value.cm !== '' && value.cm !== '0');
          } else {

          return value !== null && value !== undefined && value !== '' && value !== '0' && String(value).trim() !== '';
          }
        })
        .map(([key, value]) => {

          let label = key;

          label = label.replace(/([A-Z])/g, ' $1');

          label = label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();

          label = label.replace('sleeve length', 'Sleeve Length');
          label = label.replace('sleevelength', 'Sleeve Length');

          const displayValue = getMeasurementValue(value, measurementUnit);
          return displayValue ? `${label}: ${displayValue}` : null;
        })
        .filter(part => part !== null);

      return parts.length > 0 ? parts : null;
    } catch (e) {
      return null;
    }
  };

  const formatMeasurements = (item) => {
    if (!item || (!item.size && !item.measurementProfile)) return 'N/A';

    try {

      let measurements;
      const source = item.measurementProfile || item.size;
      if (typeof source === 'string') {

        try {
          measurements = JSON.parse(source);
        } catch (parseError) {

          return source;
        }
      } else {
        measurements = source;
      }

      if (!measurements || typeof measurements !== 'object' || Array.isArray(measurements)) {
        return typeof source === 'string' ? source : JSON.stringify(source);
      }

      const category = item.category || 'suit';

      if (isTopCategory(category)) {
        const parts = [];

        const checkValue = (val) => {
          if (typeof val === 'object' && val !== null) {
            return (val.inch && val.inch !== '' && val.inch !== '0') ||
                   (val.cm && val.cm !== '' && val.cm !== '0');
          }
          return val && val !== '' && val !== '0';
        };

        if (checkValue(measurements.chest)) {
          const value = getMeasurementValue(measurements.chest, measurementUnit);
          if (value) parts.push({ label: 'Chest', value });
        }
        if (checkValue(measurements.shoulders)) {
          const value = getMeasurementValue(measurements.shoulders, measurementUnit);
          if (value) parts.push({ label: 'Shoulders', value });
        }
        if (checkValue(measurements.sleeveLength)) {
          const value = getMeasurementValue(measurements.sleeveLength, measurementUnit);
          if (value) parts.push({ label: 'Sleeve Length', value });
        }
        if (checkValue(measurements.neck)) {
          const value = getMeasurementValue(measurements.neck, measurementUnit);
          if (value) parts.push({ label: 'Neck', value });
        }
        if (checkValue(measurements.waist)) {
          const value = getMeasurementValue(measurements.waist, measurementUnit);
          if (value) parts.push({ label: 'Waist', value });
        }
        if (checkValue(measurements.length)) {
          const value = getMeasurementValue(measurements.length, measurementUnit);
          if (value) parts.push({ label: 'Length', value });
        }

        return parts.length > 0 ? (
          <div>
            <strong style={{ display: 'block', marginBottom: '10px', color: '#333', fontSize: '1rem' }}>Top Measurements</strong>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e0e0e0', borderRadius: '6px', overflow: 'hidden' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: '600', color: '#333', fontSize: '0.9rem' }}>Measurement</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: '600', color: '#333', fontSize: '0.9rem' }}>Value ({measurementUnit === 'inch' ? 'inches' : 'centimeters'})</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((part, idx) => (
                  <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '10px', borderBottom: '1px solid #f0f0f0', fontWeight: '500' }}>{part.label}</td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #f0f0f0' }}>{part.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : 'No measurements available';
      } else if (isBottomCategory(category)) {
        const parts = [];
        const checkValue = (val) => {
          if (typeof val === 'object' && val !== null) {
            return (val.inch && val.inch !== '' && val.inch !== '0') ||
                   (val.cm && val.cm !== '' && val.cm !== '0');
          }
          return val && val !== '' && val !== '0';
        };

        if (checkValue(measurements.waist)) {
          const value = getMeasurementValue(measurements.waist, measurementUnit);
          if (value) parts.push({ label: 'Waist', value });
        }
        if (checkValue(measurements.hips)) {
          const value = getMeasurementValue(measurements.hips, measurementUnit);
          if (value) parts.push({ label: 'Hips', value });
        }
        if (checkValue(measurements.inseam)) {
          const value = getMeasurementValue(measurements.inseam, measurementUnit);
          if (value) parts.push({ label: 'Inseam', value });
        }
        if (checkValue(measurements.length)) {
          const value = getMeasurementValue(measurements.length, measurementUnit);
          if (value) parts.push({ label: 'Length', value });
        }
        if (checkValue(measurements.thigh)) {
          const value = getMeasurementValue(measurements.thigh, measurementUnit);
          if (value) parts.push({ label: 'Thigh', value });
        }
        if (checkValue(measurements.outseam)) {
          const value = getMeasurementValue(measurements.outseam, measurementUnit);
          if (value) parts.push({ label: 'Outseam', value });
        }

        return parts.length > 0 ? (
          <div>
            <strong style={{ display: 'block', marginBottom: '10px', color: '#333', fontSize: '1rem' }}>Bottom Measurements</strong>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e0e0e0', borderRadius: '6px', overflow: 'hidden' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: '600', color: '#333', fontSize: '0.9rem' }}>Measurement</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: '600', color: '#333', fontSize: '0.9rem' }}>Value ({measurementUnit === 'inch' ? 'inches' : 'centimeters'})</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((part, idx) => (
                  <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '10px', borderBottom: '1px solid #f0f0f0', fontWeight: '500' }}>{part.label}</td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #f0f0f0' }}>{part.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : 'No measurements available';
      } else {

        if (measurements && typeof measurements === 'object') {
          const parts = Object.entries(measurements)
            .filter(([key, value]) => {
              const checkValue = (val) => {
                if (typeof val === 'object' && val !== null) {
                  return (val.inch && val.inch !== '' && val.inch !== '0') ||
                         (val.cm && val.cm !== '' && val.cm !== '0');
                }
                return val && val !== '' && val !== '0';
              };
              return checkValue(value);
            })
            .map(([key, value]) => {
              const displayValue = getMeasurementValue(value, measurementUnit);
              return displayValue ? { label: key.charAt(0).toUpperCase() + key.slice(1), value: displayValue } : null;
            })
            .filter(part => part !== null);

          return parts.length > 0 ? (
            <div>
              <div style={{ marginLeft: '10px' }}>
                {parts.map((part, idx) => (
                  <div key={idx} style={{ marginBottom: '4px', fontSize: '0.9rem' }}>
                    <span style={{ fontWeight: '500' }}>{part.label}:</span> {part.value}
                  </div>
                ))}
              </div>
            </div>
          ) : (typeof item.size === 'string' ? item.size : 'N/A');
        }

        return typeof source === 'string' ? source : JSON.stringify(source);
      }
    } catch (e) {
      console.error('Error formatting measurements:', e, 'Item size:', item.size);

      return typeof item.size === 'string' ? item.size : 'N/A';
    }
  };

  const [selectedItems, setSelectedItems] = useState([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);

  useEffect(() => {
    const fetchRentals = async () => {
      try {
        setLoading(true);
        const result = await getAllRentals();
        if (result.items && result.items.length > 0) {

          const transformedItems = result.items.map(item => {
            const parsedSize = parseRentalSizeConfig(item.size);

            const thumbnailImage = item.front_image
              ? getRentalImageUrl(item.front_image)
              : (item.image_url ? getRentalImageUrl(item.image_url) : suitSample);

            return {
              ...item,
              img: thumbnailImage,
              price: item.price ? `P ${item.price}` : 'P 500',

              size: item.size || null,
              sizeOptions: parsedSize.sizeOptions,
              measurementProfile: parsedSize.measurementProfile,
              category: item.category || 'suit',

              item_name: item.item_name,
              brand: item.brand,
              color: item.color,
              material: item.material,

              front_image: item.front_image || null,
              back_image: item.back_image || null,
              side_image: item.side_image || null
            };
          });
          setRentalItems(transformedItems);
        } else {

          setRentalItems([]);
        }
      } catch (error) {
        console.error('Error fetching rentals:', error);

        setRentalItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRentals();
  }, []);

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedItem(null);
    setSizeSelections({});
    setExpandedMeasurementSize(null);
  };

  const handleSeeMore = () => {
    navigate('/rentals', { state: { isGuest } });
  };

  const calculateTotalCost = (duration, item) => {
    if (!duration || !item || duration < 3) return 0;
    const validDuration = Math.floor(duration / 3) * 3;
    if (validDuration < 3) return 0;
    let basePrice = 500;
    if (item.price) {
      const priceStr = String(item.price).replace(/[^\d.]/g, '');
      const parsedPrice = parseFloat(priceStr);
      if (!isNaN(parsedPrice) && parsedPrice > 0) basePrice = parsedPrice;
    }
    return (validDuration / 3) * basePrice;
  };

  const calculateTotalCostWithSelections = (selections, item, duration) => {
    if (!duration || !item || duration < 3) return 0;
    const validDuration = Math.floor(duration / 3) * 3;
    if (validDuration < 3) return 0;
    const sizeOpts = item.sizeOptions || {};
    let fallbackPrice = 500;
    if (item.price) {
      const priceStr = String(item.price).replace(/[^\d.]/g, '');
      const p = parseFloat(priceStr);
      if (!isNaN(p) && p > 0) fallbackPrice = p;
    }
    if (Object.keys(sizeOpts).length === 0) {
      return (validDuration / 3) * fallbackPrice;
    }
    let total = 0;
    Object.entries(selections).forEach(([sizeKey, qty]) => {
      const q = parseInt(qty, 10);
      if (isNaN(q) || q <= 0) return;
      const sizePrice = sizeOpts[sizeKey]?.price > 0 ? sizeOpts[sizeKey].price : fallbackPrice;
      total += q * sizePrice * (validDuration / 3);
    });
    return total;
  };

  const calculateMultiTotalCost = (duration, items) => {
    if (!duration || !items || items.length === 0) return 0;
    return items.reduce((total, item) => total + calculateTotalCost(duration, item), 0);
  };

  const calculateMultiDownpayment = (items, duration) => {
    if (!items || items.length === 0 || !duration) return 0;
    const totalCost = calculateMultiTotalCost(duration, items);
    return totalCost * 0.5;
  };

  const toggleItemSelection = (item) => {
    setSelectedItems(prev => {
      const isSelected = prev.find(i => (i.id || i.item_id) === (item.id || item.item_id));
      if (isSelected) {
        return prev.filter(i => (i.id || i.item_id) !== (item.id || item.item_id));
      } else {
        return [...prev, item];
      }
    });
  };

  const isItemSelected = (item) => {
    return selectedItems.some(i => (i.id || i.item_id) === (item.id || item.item_id));
  };

  const openDateModal = async () => {
    if (selectedItems.length === 0) {
      await alert('Please select at least one item', 'Selection Required', 'warning');
      return;
    }
    setStartDate('');
    setRentalDuration(3);
    setEndDate('');
    setTotalCost(0);
    setCartMessage('');
    setIsDateModalOpen(true);
  };

  useEffect(() => {
    if (startDate && rentalDuration && selectedItems.length > 0 && isDateModalOpen) {
      const calculatedEndDate = calculateEndDate(startDate, rentalDuration);
      setEndDate(calculatedEndDate);
      const cost = calculateMultiTotalCost(rentalDuration, selectedItems);
      setTotalCost(cost);
    } else if (isDateModalOpen) {
      setEndDate('');
      setTotalCost(0);
    }
  }, [startDate, rentalDuration, selectedItems, isDateModalOpen]);

  const closeDateModal = () => {
    setIsDateModalOpen(false);
  };

  const handleStartDateChange = async (date) => {
    setDateError('');
    if (date) {
      try {
        const { checkDateOpen } = await import('../../api/ShopScheduleApi');
        const result = await checkDateOpen(date);
        if (!result.success || !result.is_open) {
          setDateError('The shop is closed on this date. Please select another date.');
          setStartDate('');
          return;
        }
      } catch (error) {
        const dayOfWeek = new Date(date).getDay();
        if (dayOfWeek === 0) {
          setDateError('The shop is closed on Sundays. Please select another date.');
          setStartDate('');
          return;
        }
      }
    }
    setStartDate(date);
  };

  const handleDurationChange = (duration) => {
    setRentalDuration(parseInt(duration));
  };

  const openModal = (item) => {
    setSelectedItem(item);
    setStartDate('');
    setRentalDuration(3);
    setEndDate('');
    setTotalCost(0);
    setCartMessage('');
    setSizeSelections({});
    setExpandedMeasurementSize(null);
    setIsModalOpen(true);
  };

  const handleAddToCart = async () => {
    if (!selectedItem || !startDate || !rentalDuration) {
      setCartMessage('Please select start date and rental duration');
      return;
    }
    const selectedEntries = Object.entries(sizeSelections).filter(([, qty]) => parseInt(qty, 10) > 0);
    if (getAvailableSizeKeys(selectedItem.sizeOptions || {}).length > 0 && selectedEntries.length === 0) {
      setCartMessage('Please select at least one size');
      return;
    }
    setAddingToCart(true);
    setCartMessage('');
    try {
      const downpayment = totalCost * 0.5;
      const selectedSizesData = selectedEntries.map(([sizeKey, qty]) => ({
        sizeKey,
        label: selectedItem.sizeOptions?.[sizeKey]?.label || SIZE_LABELS[sizeKey] || sizeKey,
        quantity: parseInt(qty, 10),
        price: selectedItem.sizeOptions?.[sizeKey]?.price || 0
      }));
      const primarySize = selectedSizesData[0];
      const rentalData = {
        serviceType: 'rental',
        serviceId: selectedItem.id || selectedItem.item_id,
        quantity: selectedSizesData.reduce((s, e) => s + e.quantity, 0),
        basePrice: '0',
        finalPrice: totalCost.toString(),
        pricingFactors: {
          duration: rentalDuration,
          price: totalCost,
          downpayment: downpayment.toString()
        },
        specificData: {
          item_name: selectedItem.item_name || selectedItem.name || 'Rental Item',
          size: selectedSizesData.map(e => `${e.label} x${e.quantity}`).join(', '),
          selected_sizes: selectedSizesData,
          selected_size: primarySize?.sizeKey || null,
          size_options: selectedItem.sizeOptions || {},
          category: selectedItem.category || 'rental',
          image_url: selectedItem.front_image ? getRentalImageUrl(selectedItem.front_image) : getRentalImageUrl(selectedItem.image_url),
          front_image: selectedItem.front_image ? getRentalImageUrl(selectedItem.front_image) : null,
          back_image: selectedItem.back_image ? getRentalImageUrl(selectedItem.back_image) : null,
          side_image: selectedItem.side_image ? getRentalImageUrl(selectedItem.side_image) : null
        },
        rentalDates: { startDate, endDate, duration: rentalDuration }
      };
      const result = await addToCart(rentalData);
      if (result.success) {
        setCartMessage(`✅ ${selectedItem.item_name || selectedItem.name} added to cart!`);
        setTimeout(() => {
          setIsModalOpen(false);
          setSelectedItem(null);
          setSizeSelections({});
          setStartDate('');
          setRentalDuration(3);
          setEndDate('');
          setTotalCost(0);
        }, 1500);
      } else {
        setCartMessage(`❌ Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Add to cart error:', error);
      setCartMessage('❌ Failed to add item to cart');
    } finally {
      setAddingToCart(false);
      setTimeout(() => setCartMessage(''), 3000);
    }
  };

  const handleAddMultipleToCart = async () => {
    if (selectedItems.length === 0 || !startDate || !rentalDuration) {
      setCartMessage('Please select items, start date, and rental duration');
      return;
    }

    setAddingToCart(true);
    setCartMessage('');

    try {

      const totalDownpayment = totalCost * 0.5;

      const itemsBundle = selectedItems.map(item => ({
        selected_size: getAvailableSizeKeys(item.sizeOptions || {})[0] || null,
        selected_size_details: (() => {
          const firstAvailable = getAvailableSizeKeys(item.sizeOptions || {})[0];
          return firstAvailable ? (item.sizeOptions?.[firstAvailable] || null) : null;
        })(),
        id: item.id || item.item_id,
        item_name: item.item_name || item.name || 'Rental Item',
        brand: item.brand || 'Unknown',
        size: (() => {
          const firstAvailable = getAvailableSizeKeys(item.sizeOptions || {})[0];
          return firstAvailable ? (SIZE_LABELS[firstAvailable] || firstAvailable) : (item.size || 'Standard');
        })(),
        category: item.category || 'rental',
        downpayment: item.downpayment || 0,
        image_url: item.front_image ? getRentalImageUrl(item.front_image) : getRentalImageUrl(item.image_url),
        front_image: item.front_image ? getRentalImageUrl(item.front_image) : null,
        back_image: item.back_image ? getRentalImageUrl(item.back_image) : null,
        side_image: item.side_image ? getRentalImageUrl(item.side_image) : null,
        individual_cost: calculateTotalCost(rentalDuration, item)
      }));

      const rentalData = {
        serviceType: 'rental',
        serviceId: itemsBundle[0].id,
        quantity: selectedItems.length,
        basePrice: '0',
        finalPrice: totalCost.toString(),
        pricingFactors: {
          duration: rentalDuration,
          price: totalCost,
          downpayment: totalDownpayment.toString(),
          is_bundle: true,
          item_count: selectedItems.length
        },
        specificData: {
          is_bundle: true,
          bundle_items: itemsBundle,
          item_names: itemsBundle.map(i => i.item_name).join(', '),
          item_name: `Rental Bundle (${selectedItems.length} items)`,
          brand: 'Multiple',
          size: 'Various',
          category: 'rental_bundle'
        },
        rentalDates: {
          startDate: startDate,
          endDate: endDate,
          duration: rentalDuration
        }
      };

      const result = await addToCart(rentalData);

      if (result.success) {
        setCartMessage(`✅ ${selectedItems.length} items added to cart as bundle!`);

        setTimeout(() => {
          setIsDateModalOpen(false);
          setSelectedItems([]);
          setIsMultiSelectMode(false);
          setStartDate('');
          setEndDate('');
          setTotalCost(0);
        }, 1500);
      } else {
        setCartMessage(`❌ Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Add to cart error:', error);
      setCartMessage('❌ Failed to add items to cart');
    } finally {
      setAddingToCart(false);
      setTimeout(() => setCartMessage(''), 3000);
    }
  };

  const availableItems = rentalItems.filter(item => item.status === 'available');
  const displayItems = showAll ? availableItems : availableItems.slice(0, 3);

  if (loading) {
    return (
      <section className="rental" id="Rentals">
        <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Rental Clothes</h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f5f5f5', padding: '6px 12px', borderRadius: '20px' }}>
              <button
                onClick={() => setMeasurementUnit('inch')}
                style={{
                  padding: '6px 16px',
                  border: 'none',
                  borderRadius: '15px',
                  backgroundColor: measurementUnit === 'inch' ? '#2196F3' : 'transparent',
                  color: measurementUnit === 'inch' ? 'white' : '#666',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: measurementUnit === 'inch' ? '600' : '400',
                  transition: 'all 0.2s'
                }}
              >
                Inch
              </button>
              <button
                onClick={() => setMeasurementUnit('cm')}
                style={{
                  padding: '6px 16px',
                  border: 'none',
                  borderRadius: '15px',
                  backgroundColor: measurementUnit === 'cm' ? '#2196F3' : 'transparent',
                  color: measurementUnit === 'cm' ? 'white' : '#666',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: measurementUnit === 'cm' ? '600' : '400',
                  transition: 'all 0.2s'
                }}
              >
                CM
              </button>
            </div>
          </div>
        </div>
        <div className="rental-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rental-card loading">
              <div className="loading-placeholder"></div>
              <div className="rental-info">
                <h3>Loading...</h3>
                <p className="price">P ---</p>
                <button className="btn-view" disabled>Loading...</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="rental" id="Rentals">
        <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>{showAll ? 'All Rental Clothes' : 'Rental Clothes'}</h2>

          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                if (isMultiSelectMode) {
                  setIsMultiSelectMode(false);
                  setSelectedItems([]);
                } else {
                  setIsMultiSelectMode(true);
                }
              }}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                border: isMultiSelectMode ? '2px solid #dc3545' : '2px solid #007bff',
                backgroundColor: isMultiSelectMode ? '#dc3545' : '#007bff',
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                whiteSpace: 'nowrap'
              }}
            >
              {isMultiSelectMode ? '✕ Cancel Selection' : '☑ Select Multiple'}
            </button>
          </div>
        </div>
        <div className="rental-grid">
          {displayItems.length === 0 ? (
            <div style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: '60px 20px',
              color: '#666',
              fontSize: '18px'
            }}>
              <p style={{ margin: 0, fontWeight: '500' }}>No rental clothes</p>
            </div>
          ) : (
            displayItems.map((item, i) => (
            <div
              key={i}
              className="rental-card"
              style={{
                position: 'relative',
                border: isMultiSelectMode && isItemSelected(item) ? '3px solid #007bff' : '1px solid #ddd',
                transition: 'all 0.2s ease'
              }}
              onClick={() => {
                if (isMultiSelectMode) {
                  toggleItemSelection(item);
                }
              }}
            >
              {isMultiSelectMode && (
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  zIndex: 10,
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: isItemSelected(item) ? '#007bff' : 'white',
                  border: isItemSelected(item) ? '2px solid #007bff' : '2px solid #ccc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}>
                  {isItemSelected(item) && (
                    <span style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>✓</span>
                  )}
                </div>
              )}
              <img 
                src={item.img} 
                alt={item.name} 
                onError={(e) => { e.target.src = suitSample; }}
                style={{
                  opacity: isMultiSelectMode ? 0.9 : 1,
                  cursor: isMultiSelectMode ? 'pointer' : 'default'
                }} 
              />
              <div className="rental-info">
                <h3>{item.item_name || item.name}</h3>
                <p className="price">From ₱{(() => {
                  const prices = getAvailableSizeKeys(item.sizeOptions || {})
                    .map((k) => parseFloat(item.sizeOptions?.[k]?.price))
                    .filter((p) => !isNaN(p) && p > 0);
                  if (prices.length > 0) {
                    return Math.min(...prices).toLocaleString('en-PH', { minimumFractionDigits: 2 });
                  }
                  const fallback = parseFloat(String(item.price || '').replace(/[^\d.]/g, ''));
                  return (!isNaN(fallback) && fallback > 0 ? fallback : 500).toLocaleString('en-PH', { minimumFractionDigits: 2 });
                })()} / 3 days</p>
                {/* Sizes chips */}
                {getAvailableSizeKeys(item.sizeOptions || {}).length > 0 && (
                  <div className="rc-card-sizes">
                    {getAvailableSizeKeys(item.sizeOptions || {}).map(key => {
                      const opt = item.sizeOptions[key] || {};
                      return (
                        <span key={key} className="rc-size-chip">
                          {opt.label || SIZE_LABELS[key] || key}
                          {opt.price > 0 && ` · ₱${parseFloat(opt.price).toLocaleString('en-PH')}`}
                        </span>
                      );
                    })}
                  </div>
                )}

                {!isMultiSelectMode && (
                  <button onClick={() => openModal(item)} className="btn-view">View</button>
                )}
                {isMultiSelectMode && (
                  <div style={{
                    padding: '8px 12px',
                    backgroundColor: isItemSelected(item) ? '#e3f2fd' : '#f8f9fa',
                    borderRadius: '5px',
                    fontSize: '13px',
                    color: isItemSelected(item) ? '#1976d2' : '#666',
                    fontWeight: isItemSelected(item) ? '600' : '400'
                  }}>
                    {isItemSelected(item) ? '✓ Selected' : 'Tap to select'}
                  </div>
                )}
              </div>
            </div>
            ))
          )}
        </div>
        {!showAll && rentalItems.length > 3 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: '20px',
            marginBottom: '10px'
          }}>
            <span
              onClick={handleSeeMore}
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
      {isMultiSelectMode && selectedItems.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#1a1a2e',
          color: 'white',
          padding: '15px 25px',
          borderRadius: '30px',
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          zIndex: 1000
        }}>
          <span style={{ fontSize: '15px' }}>
            <strong>{selectedItems.length}</strong> item{selectedItems.length > 1 ? 's' : ''} selected
          </span>
          <span style={{ color: '#aaa' }}>|</span>
          <span style={{ fontSize: '14px', color: '#aaa' }}>
            Est. Downpayment: ₱{totalCost > 0 ? (totalCost * 0.5).toFixed(2) : '0.00'}
          </span>
          <button
            onClick={openDateModal}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '20px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px'
            }}
          >
            Set Dates & Add to Cart →
          </button>
        </div>
      )}
      {isDateModalOpen && selectedItems.length > 0 && (
        <div className="modal" onClick={closeDateModal} style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            background: 'white',
            padding: '25px',
            borderRadius: '15px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto',
            position: 'relative'
          }}>
            <span className="close" onClick={closeDateModal} style={{
              position: 'absolute',
              top: '10px',
              right: '15px',
              fontSize: '24px',
              cursor: 'pointer'
            }}>×</span>

            <h2 style={{ marginBottom: '20px', color: '#1a1a2e' }}>
              Rental Bundle ({selectedItems.length} items)
            </h2>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              marginBottom: '20px',
              padding: '15px',
              backgroundColor: '#f8f9fa',
              borderRadius: '10px'
            }}>
              {selectedItems.map((item, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  backgroundColor: 'white',
                  borderRadius: '20px',
                  border: '1px solid #ddd',
                  fontSize: '13px'
                }}>
                  <img
                    src={item.img}
                    alt={item.item_name || item.name}
                    style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <span>{item.item_name || item.name}</span>
                  <button
                    onClick={() => toggleItemSelection(item)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#dc3545',
                      cursor: 'pointer',
                      padding: '2px',
                      fontSize: '14px'
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="date-section" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                <div className="date-input-group" style={{ flex: 1, minWidth: '200px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: '#000' }}>Start Date *</label>
                  <input
                    type="date"
                    className="date-input"
                    value={startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: dateError ? '1px solid #f44336' : '1px solid #ddd',
                      fontSize: '14px',
                      color: '#000',
                      backgroundColor: '#fff'
                    }}
                  />
                  {dateError && (
                    <span style={{ color: '#f44336', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                      {dateError}
                    </span>
                  )}
                </div>
                <div className="date-input-group" style={{ flex: 1, minWidth: '200px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: '#000' }}>Rental Duration *</label>
                  <select
                    className="date-input"
                    value={rentalDuration}
                    onChange={(e) => handleDurationChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #ddd',
                      fontSize: '14px',
                      color: '#000',
                      backgroundColor: '#fff'
                    }}
                  >
                    <option value="3">3 days</option>
                    <option value="6">6 days</option>
                    <option value="9">9 days</option>
                    <option value="12">12 days</option>
                    <option value="15">15 days</option>
                    <option value="18">18 days</option>
                    <option value="21">21 days</option>
                    <option value="24">24 days</option>
                    <option value="27">27 days</option>
                    <option value="30">30 days</option>
                  </select>
                </div>
                {endDate && (
                  <div className="date-input-group" style={{ flex: 1, minWidth: '200px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: '#000' }}>End Date (Auto-calculated)</label>
                    <input
                      type="date"
                      className="date-input"
                      value={endDate}
                      disabled
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid #ddd',
                        fontSize: '14px',
                        color: '#666',
                        backgroundColor: '#f5f5f5',
                        cursor: 'not-allowed'
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
            {totalCost > 0 && (
              <div className="cost-breakdown">
                <h4>Payment Details</h4>
                <div style={{ marginBottom: '10px' }}>
                  {selectedItems.map((item, idx) => {
                    const itemCost = calculateTotalCost(rentalDuration, item);
                    return (
                      <div key={idx} className="cost-item">
                        <span>{item.item_name || item.name}:</span>
                        <span>₱{itemCost.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="cost-item">
                  <span>Downpayment (Due Upon Pickup - 50%):</span>
                  <span>₱{(totalCost * 0.5).toFixed(2)}</span>
                </div>
                <div className="cost-item">
                  <span>Rental Price ({rentalDuration} days):</span>
                  <span>₱{totalCost.toFixed(2)}</span>
                </div>
                <div className="cost-total">
                  <span>Total Rental Cost (Due on Return):</span>
                  <span>₱{totalCost.toFixed(2)}</span>
                </div>
                <div style={{
                  marginTop: '15px',
                  padding: '10px 12px',
                  backgroundColor: '#fff3cd',
                  border: '1px solid #ffc107',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: '#856404'
                }}>
                  <strong>⚠️ Late Return:</strong> ₱100/day penalty for exceeding rental period.
                </div>
              </div>
            )}
            {cartMessage && (
              <div style={{
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '15px',
                backgroundColor: cartMessage.includes('✅') ? '#d4edda' : '#f8d7da',
                color: cartMessage.includes('✅') ? '#155724' : '#721c24',
                textAlign: 'center'
              }}>
                {cartMessage}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={closeDateModal}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddMultipleToCart}
                disabled={!startDate || !rentalDuration || totalCost <= 0 || addingToCart}
                style={{
                  padding: '12px 24px',
                  backgroundColor: (!startDate || !rentalDuration || totalCost <= 0 || addingToCart) ? '#ccc' : '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (!startDate || !rentalDuration || totalCost <= 0 || addingToCart) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                {addingToCart ? 'Adding...' : `Add Bundle to Cart - ₱${(totalCost * 0.5).toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      )}
      {isModalOpen && selectedItem && (
        <div className="rc-modal-overlay" onClick={closeModal}>
          <div className="rc-modal" onClick={(e) => e.stopPropagation()}>
            <button className="rc-modal-close" onClick={closeModal}>×</button>
            <div className="rc-modal-inner">
              {/* Left: image carousel */}
              <div className="rc-modal-images">
                <RentalImageCarousel
                  images={[
                    { url: selectedItem.front_image ? getRentalImageUrl(selectedItem.front_image) : null, label: 'Front' },
                    { url: selectedItem.back_image ? getRentalImageUrl(selectedItem.back_image) : null, label: 'Back' },
                    { url: selectedItem.side_image ? getRentalImageUrl(selectedItem.side_image) : null, label: 'Side' },
                    { url: selectedItem.img || (selectedItem.image_url ? getRentalImageUrl(selectedItem.image_url) : null), label: 'Main' }
                  ].filter(img => img.url)}
                  itemName={selectedItem.item_name || selectedItem.name}
                />
              </div>

              {/* Right: details */}
              <div className="rc-modal-details">
                <h2 className="rc-modal-title">{selectedItem.item_name || selectedItem.name}</h2>

                {/* Meta info */}
                <div className="rc-meta-row">
                  {selectedItem.category && (
                    <span className="rc-meta-tag">Category: {selectedItem.category.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</span>
                  )}
                  {selectedItem.color && <span className="rc-meta-tag">Color: {selectedItem.color}</span>}
                  {selectedItem.material && <span className="rc-meta-tag">Material: {selectedItem.material}</span>}
                  <span className="rc-meta-tag">Price: from ₱{getDisplayPrice(selectedItem).toLocaleString('en-PH', { minimumFractionDigits: 2 })} / 3 days</span>
                </div>

                {/* Sizes + Measurements table */}
                {getAvailableSizeKeys(selectedItem.sizeOptions || {}).length > 0 && (
                  <div className="rc-sizes-section">
                    <div className="rc-section-header-row">
                      <h4>Select Sizes & Quantities</h4>
                      <div className="rc-unit-toggle">
                        <button className={measurementUnit === 'inch' ? 'active' : ''} onClick={() => setMeasurementUnit('inch')}>in</button>
                        <button className={measurementUnit === 'cm' ? 'active' : ''} onClick={() => setMeasurementUnit('cm')}>cm</button>
                      </div>
                    </div>
                    <div className="rc-selection-summary" style={{ marginTop: '10px' }}>
                      Available Sizes:{' '}
                      {getAvailableSizeKeys(selectedItem.sizeOptions || {})
                        .map((key) => {
                          const opt = selectedItem.sizeOptions[key] || {};
                          const qty = opt.quantity;
                          const hasQty = qty !== null && qty !== undefined && qty !== '' && !Number.isNaN(parseInt(qty, 10));
                          return `${opt.label || SIZE_LABELS[key] || key}${hasQty ? ` (${parseInt(qty, 10)} pcs)` : ''}`;
                        })
                        .join(', ')}
                    </div>
                    <div className="rc-sizes-table">
                      {getAvailableSizeKeys(selectedItem.sizeOptions || {}).map((sizeKey) => {
                        const opt = selectedItem.sizeOptions[sizeKey] || {};
                        const parsedFallbackTotal = parseInt(selectedItem.total_available, 10);
                        const maxQty = Number.isFinite(opt.quantity)
                          ? opt.quantity
                          : (Number.isNaN(parsedFallbackTotal) ? 0 : parsedFallbackTotal);
                        const currentQty = parseInt(sizeSelections[sizeKey] || 0, 10);
                        const isExpanded = expandedMeasurementSize === sizeKey;
                        const resolvedMeasurements = normalizeMeasurementsObject(
                          opt.measurements || selectedItem.measurementProfile
                        );
                        const hasMeasurements = !!resolvedMeasurements;

                        const getMeasVal = (m, key) => {
                          if (!m) return null;
                          const val = m[key];
                          if (!val) return null;
                          if (typeof val === 'object') {
                            return measurementUnit === 'inch'
                              ? (val.inch ? `${val.inch} in` : null)
                              : (val.cm ? `${val.cm} cm` : null);
                          }
                          return `${val}`;
                        };

                        const topFields = ['chest','shoulders','sleeveLength','neck','waist','length'];
                        const bottomFields = ['waist','hips','inseam','outseam','thigh','length'];
                        const measurementRows = hasMeasurements
                          ? [...new Set([...topFields, ...bottomFields])].map(k => {
                              const v = getMeasVal(resolvedMeasurements, k);
                              return v ? { label: k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()), value: v } : null;
                            }).filter(Boolean)
                          : [];

                        return (
                          <div key={sizeKey} className={`rc-size-row ${currentQty > 0 ? 'selected' : ''}`}>
                            <div className="rc-size-row-header">
                              <span className="rc-size-label">{opt.label || SIZE_LABELS[sizeKey] || sizeKey}</span>
                              {opt.price > 0 && (
                                <span className="rc-size-price">₱{parseFloat(opt.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })} / 3 days</span>
                              )}
                              <span className="rc-size-avail">{maxQty > 0 ? `${maxQty} available` : 'available'}</span>
                              <div className="rc-qty-control">
                                <button
                                  disabled={currentQty <= 0}
                                  onClick={() => setSizeSelections(prev => ({ ...prev, [sizeKey]: Math.max(0, currentQty - 1) }))}
                                >−</button>
                                <span>{currentQty}</span>
                                <button
                                  disabled={currentQty >= maxQty}
                                  onClick={() => setSizeSelections(prev => ({ ...prev, [sizeKey]: Math.min(maxQty, currentQty + 1) }))}
                                >+</button>
                              </div>
                              {hasMeasurements && measurementRows.length > 0 && (
                                <button
                                  className="rc-meas-toggle"
                                  onClick={() => setExpandedMeasurementSize(isExpanded ? null : sizeKey)}
                                >
                                  {isExpanded ? '▲ Hide' : '▼ Measurements'}
                                </button>
                              )}
                            </div>
                            {isExpanded && measurementRows.length > 0 && (
                              <div className="rc-measurements-panel">
                                <table className="rc-meas-table">
                                  <thead>
                                    <tr><th>Measurement</th><th>Value</th></tr>
                                  </thead>
                                  <tbody>
                                    {measurementRows.map((r, idx) => (
                                      <tr key={idx}><td>{r.label}</td><td>{r.value}</td></tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {Object.values(sizeSelections).some(q => parseInt(q, 10) > 0) && (
                      <div className="rc-selection-summary">
                        Selected: {Object.entries(sizeSelections)
                          .filter(([, q]) => parseInt(q, 10) > 0)
                          .map(([k, q]) => `${selectedItem.sizeOptions?.[k]?.label || SIZE_LABELS[k] || k} ×${q}`)
                          .join(', ')}
                      </div>
                    )}
                  </div>
                )}

                {selectedItem.description && (
                  <div className="rc-desc">
                    <strong>Description</strong>
                    <p>{selectedItem.description}</p>
                  </div>
                )}

                {selectedItem.care_instructions && (
                  <div className="rc-desc">
                    <strong>Care Instructions</strong>
                    <p>{selectedItem.care_instructions}</p>
                  </div>
                )}

                {/* Rental dates */}
                <div className="rc-date-grid">
                  <div className="rc-form-field">
                    <label>Start Date *</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className={dateError ? 'has-error' : ''}
                    />
                    {dateError && <span className="rc-field-error">{dateError}</span>}
                  </div>
                  <div className="rc-form-field">
                    <label>Duration *</label>
                    <select value={rentalDuration} onChange={(e) => handleDurationChange(e.target.value)}>
                      {[3,6,9,12,15,18,21,24,27,30].map(d => <option key={d} value={d}>{d} days</option>)}
                    </select>
                  </div>
                  {endDate && (
                    <div className="rc-form-field">
                      <label>End Date</label>
                      <input type="date" value={endDate} disabled />
                    </div>
                  )}
                </div>

                {totalCost > 0 && startDate && (
                  <div className="rc-cost-box">
                    {Object.entries(sizeSelections).filter(([, q]) => parseInt(q, 10) > 0).map(([sizeKey, qty]) => {
                      const opt = selectedItem.sizeOptions?.[sizeKey] || {};
                      const fallback = parseFloat(String(selectedItem.price || '').replace(/[^\d.]/g, '')) || 500;
                      const price = opt.price > 0 ? opt.price : fallback;
                      const lineCost = parseInt(qty, 10) * price * (Math.floor(rentalDuration / 3));
                      return (
                        <div key={sizeKey} className="rc-cost-line">
                          <span>{opt.label || SIZE_LABELS[sizeKey] || sizeKey} ×{qty} ({rentalDuration}d)</span>
                          <span>₱{lineCost.toFixed(2)}</span>
                        </div>
                      );
                    })}
                    <div className="rc-cost-divider" />
                    <div className="rc-cost-line total">
                      <span>Total</span><span>₱{totalCost.toFixed(2)}</span>
                    </div>
                    <div className="rc-cost-line downpayment">
                      <span>Downpayment (50%, due on pickup)</span><span>₱{(totalCost * 0.5).toFixed(2)}</span>
                    </div>
                    <div className="rc-late-warning">⚠️ ₱100/day penalty for late returns</div>
                  </div>
                )}

                {cartMessage && (
                  <div className={`rc-cart-msg ${cartMessage.includes('✅') ? 'success' : 'error'}`}>{cartMessage}</div>
                )}

                <button
                  className="rc-btn-rent"
                  onClick={handleAddToCart}
                  disabled={!startDate || !rentalDuration || totalCost <= 0 || addingToCart}
                >
                  {addingToCart ? 'Adding...' : `Add to Cart — ₱${totalCost > 0 ? (totalCost * 0.5).toFixed(2) : '0.00'} downpayment`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RentalClothes;

