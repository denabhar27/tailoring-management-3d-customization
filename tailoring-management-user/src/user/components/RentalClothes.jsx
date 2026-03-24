import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllRentals, getRentalImageUrl } from '../../api/RentalApi';
import { addToCart } from '../../api/CartApi';
import suitSample from "../../assets/suits.png";
import shirtIcon from "../../assets/shirt-icon.png";
import tuxedoIcon from "../../assets/tuxedo.png";
import { useAlert } from '../../context/AlertContext';
import '../../components/SimpleImageCarousel.css';
import '../../styles/RentalClothes.css';

const SIZE_LABELS = {
  small: 'Small (S)',
  medium: 'Medium (M)',
  large: 'Large (L)',
  extra_large: 'Extra Large (XL)'
};

const SIZE_SHORT_LABELS = {
  small: 'S',
  medium: 'M',
  large: 'L',
  extra_large: 'XL'
};

const getSizeShortLabel = (sizeKey, label) => {
  if (SIZE_SHORT_LABELS[sizeKey]) return SIZE_SHORT_LABELS[sizeKey];
  const match = /\(([^)]+)\)/.exec(label || '');
  if (match && match[1]) return match[1].toUpperCase();
  if (label && label.trim()) return label.trim().slice(0, 3).toUpperCase();
  return (sizeKey || '').slice(0, 3).toUpperCase();
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
  const [cardSizeSelections, setCardSizeSelections] = useState({});
  const [expandedMeasurementSize, setExpandedMeasurementSize] = useState(null);
  const [isSizesSectionOpen, setIsSizesSectionOpen] = useState(false);
  const [inlineMessage, setInlineMessage] = useState('');
  const [inlineMessageItemId, setInlineMessageItemId] = useState(null);
  const navigate = useNavigate();

  const getItemDisplayName = (item) => {
    const raw = String(item?.item_name || item?.name || '').trim();
    if (!raw || /^\d+$/.test(raw)) {
      return `${formatLabel(item?.category || 'rental')} Item`;
    }
    return raw;
  };

  const formatTagText = (value) => {
    const val = String(value || '').trim();
    if (!val) return '';
    const shortMap = {
      blu: 'Blue',
      blk: 'Black',
      wht: 'White',
      gry: 'Gray',
      grn: 'Green',
      brn: 'Brown'
    };
    const mapped = shortMap[val.toLowerCase()];
    return mapped || formatLabel(val);
  };

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
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [selectedColorFilter, setSelectedColorFilter] = useState('all');
  const [selectedSizeFilter, setSelectedSizeFilter] = useState('all');
  const [selectedPriceFilter, setSelectedPriceFilter] = useState('all');

  const categoryFilters = [
    { id: 'all', label: 'All', iconType: 'emoji', icon: '🧾' },
    { id: 'tshirt', label: 'T-Shirt', iconType: 'image', icon: shirtIcon },
    { id: 'pants', label: 'Pants', iconType: 'emoji', icon: '👖' },
    { id: 'barong', label: 'Barong', iconType: 'image', icon: shirtIcon },
    { id: 'tuxedo', label: 'Tuxedo', iconType: 'image', icon: tuxedoIcon }
  ];

  const normalizeCategoryText = (value) => String(value || '').toLowerCase().replace(/[_-]/g, ' ').trim();

  const belongsToFilter = (item, filterId) => {
    if (filterId === 'all') return true;

    const category = normalizeCategoryText(item?.category);
    const name = normalizeCategoryText(item?.item_name || item?.name);
    const combined = `${category} ${name}`;

    if (filterId === 'tshirt') {
      return combined.includes('t shirt') || combined.includes('tshirt') || combined.includes('shirt') || combined.includes('casual');
    }

    if (filterId === 'pants') {
      return combined.includes('pants') || combined.includes('trouser');
    }

    if (filterId === 'barong') {
      return combined.includes('barong') || combined.includes('formal') || combined.includes('business');
    }

    if (filterId === 'tuxedo') {
      return combined.includes('tuxedo') || combined.includes('suit');
    }

    return true;
  };

  const priceRanges = [
    { id: 'all', label: 'All Prices' },
    { id: 'under-1000', label: 'Under ₱1,000', min: 0, max: 1000 },
    { id: '1000-2000', label: '₱1,000 - ₱2,000', min: 1000, max: 2000 },
    { id: '2000-3000', label: '₱2,000 - ₱3,000', min: 2000, max: 3000 },
    { id: 'above-3000', label: 'Above ₱3,000', min: 3000, max: Infinity }
  ];

  const formatLabel = (text) => {
    return text
      .replace(/[_-]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const parsePriceValue = (price) => {
    const priceStr = String(price || '').replace(/[^\d.]/g, '');
    const parsed = parseFloat(priceStr);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const isPriceInRange = (price, rangeId) => {
    if (rangeId === 'all') return true;
    const range = priceRanges.find(r => r.id === rangeId);
    if (!range) return true;
    const priceVal = parsePriceValue(price);
    return priceVal >= range.min && priceVal <= range.max;
  };

  const getCategoryOptions = () => {
    const categories = rentalItems.reduce((acc, item) => {
      const cat = item.category || 'uncategorized';
      if (!acc.find(c => c.value === cat)) {
        acc.push({ value: cat, label: formatLabel(cat) });
      }
      return acc;
    }, []);
    return [{ value: 'all', label: 'All Clothing Types' }, ...categories];
  };

  const getColorOptions = () => {
    const colors = rentalItems.reduce((acc, item) => {
      const color = item.color || 'no-color';
      if (!acc.find(c => c.value === color)) {
        acc.push({ value: color, label: formatLabel(color) });
      }
      return acc;
    }, []);
    return [{ value: 'all', label: 'All Colors' }, ...colors];
  };

  const getSizeOptions = () => {
    const sizes = new Set();
    rentalItems.forEach(item => {
      if (item.sizeOptions && typeof item.sizeOptions === 'object') {
        Object.keys(item.sizeOptions).forEach(size => sizes.add(size));
      }
    });
    const sizeArray = Array.from(sizes).sort();
    return [{ value: 'all', label: 'All Sizes' }, ...sizeArray.map(s => ({ value: s, label: s.toUpperCase() }))];
  };

  const getPriceOptions = () => {
    return priceRanges.map(range => ({ value: range.id, label: range.label }));
  };

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
    setIsSizesSectionOpen(false);
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

  const calculateBundleTotalWithSelections = (duration, items, selectionsByItem) => {
    if (!duration || !items || items.length === 0) return 0;
    const validDuration = Math.floor(duration / 3) * 3;
    if (validDuration < 3) return 0;

    return items.reduce((total, item) => {
      const sizeOpts = item.sizeOptions || {};
      const fallbackPrice = (() => {
        const priceStr = String(item.price || '').replace(/[^\d.]/g, '');
        const p = parseFloat(priceStr);
        return !isNaN(p) && p > 0 ? p : 500;
      })();
      const selections = selectionsByItem?.[item.id || item.item_id] || {};
      const sizeTotal = Object.entries(selections).reduce((sum, [key, qty]) => {
        const q = parseInt(qty, 10);
        if (isNaN(q) || q <= 0) return sum;
        const price = sizeOpts[key]?.price > 0 ? sizeOpts[key].price : fallbackPrice;
        return sum + q * price * (validDuration / 3);
      }, 0);

      if (Object.keys(sizeOpts).length > 0) return total + sizeTotal;
      return total + (fallbackPrice * (validDuration / 3));
    }, 0);
  };

  const calculateMultiDownpayment = (items, duration) => {
    if (!items || items.length === 0 || !duration) return 0;
    const totalCost = calculateMultiTotalCost(duration, items);
    return totalCost * 0.5;
  };

  const getItemId = (item) => item?.id || item?.item_id;

  const getItemSizeSelection = (item) => cardSizeSelections[getItemId(item)] || {};

  const getItemSelectedQuantity = (item) => {
    return Object.values(getItemSizeSelection(item)).reduce((sum, qty) => {
      const parsed = parseInt(qty, 10);
      return sum + (isNaN(parsed) ? 0 : parsed);
    }, 0);
  };

  const getItemSizeSummary = (item) => {
    const selections = getItemSizeSelection(item);
    return Object.entries(selections)
      .filter(([, qty]) => parseInt(qty, 10) > 0)
      .map(([sizeKey, qty]) => `${item.sizeOptions?.[sizeKey]?.label || SIZE_LABELS[sizeKey] || sizeKey} x${qty}`)
      .join(', ');
  };

  const toggleItemSelection = (item) => {
    const itemId = getItemId(item);
    const currentlySelected = selectedItems.some(i => getItemId(i) === itemId);

    if (currentlySelected) {
      setSelectedItems(prev => prev.filter(i => getItemId(i) !== itemId));
      setCardSizeSelections(prev => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
      if (inlineMessageItemId === itemId) {
        setInlineMessage('');
        setInlineMessageItemId(null);
      }
      return;
    }

    setSelectedItems(prev => [...prev, item]);
  };

  const isItemSelected = (item) => {
    return selectedItems.some(i => getItemId(i) === getItemId(item));
  };

  const updateCardSizeQuantity = (item, sizeKey, delta) => {
    const itemId = getItemId(item);
    const option = item.sizeOptions?.[sizeKey] || {};
    const parsedOptionQty = parseInt(option.quantity, 10);
    const parsedFallbackQty = parseInt(item.total_available, 10);
    const maxQty = !Number.isNaN(parsedOptionQty)
      ? Math.max(parsedOptionQty, 0)
      : (!Number.isNaN(parsedFallbackQty) ? Math.max(parsedFallbackQty, 0) : Number.POSITIVE_INFINITY);

    const currentQty = parseInt(cardSizeSelections?.[itemId]?.[sizeKey] || 0, 10);
    const nextQtyRaw = Math.max(0, currentQty + delta);

    if (delta > 0 && Number.isFinite(maxQty) && nextQtyRaw > maxQty) {
      setInlineMessage(`${option.label || SIZE_LABELS[sizeKey] || sizeKey} is out of stock for ${item.item_name || item.name}.`);
      setInlineMessageItemId(itemId);
      setTimeout(() => {
        setInlineMessage('');
        setInlineMessageItemId(null);
      }, 1800);
      return;
    }

    const safeQty = Number.isFinite(maxQty) ? Math.min(nextQtyRaw, maxQty) : nextQtyRaw;
    const nextItemSelections = {
      ...(cardSizeSelections[itemId] || {}),
      [sizeKey]: safeQty
    };

    if (safeQty <= 0) {
      delete nextItemSelections[sizeKey];
    }

    const hasAnyAfter = Object.values(nextItemSelections).some(q => parseInt(q, 10) > 0);

    setCardSizeSelections(prev => {
      const next = { ...prev };
      if (hasAnyAfter) {
        next[itemId] = nextItemSelections;
      } else {
        delete next[itemId];
      }
      return next;
    });

    // Keep explicit multi-select choices intact even when size qty goes back to 0.
    setSelectedItems(prev => {
      const exists = prev.some(i => getItemId(i) === itemId);
      if (!exists) return [...prev, item];
      return prev;
    });

    if (inlineMessageItemId === itemId) {
      setInlineMessage('');
      setInlineMessageItemId(null);
    }
  };

  const openDateModal = async () => {
    if (selectedItems.length === 0) {
      await alert('Please select at least one item', 'Selection Required', 'warning');
      return;
    }

    setStartDate('');
    setRentalDuration(3);
    setEndDate('');
    const cost = calculateBundleTotalWithSelections(3, selectedItems, cardSizeSelections);
    setTotalCost(cost);
    setCartMessage('');
    setIsDateModalOpen(true);
  };

  useEffect(() => {
    if (rentalDuration && selectedItems.length > 0 && isDateModalOpen) {
      const cost = calculateBundleTotalWithSelections(rentalDuration, selectedItems, cardSizeSelections);
      setTotalCost(cost);

      if (startDate) {
        const calculatedEndDate = calculateEndDate(startDate, rentalDuration);
        setEndDate(calculatedEndDate);
      } else {
        setEndDate('');
      }
    } else if (isDateModalOpen) {
      setEndDate('');
      setTotalCost(0);
    }
  }, [startDate, rentalDuration, selectedItems, isDateModalOpen, cardSizeSelections]);

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
    const preset = cardSizeSelections[item.id || item.item_id] || {};
    setSelectedItem(item);
    setStartDate('');
    setRentalDuration(3);
    setEndDate('');
    setTotalCost(0);
    setCartMessage('');
    setSizeSelections(preset);
    setExpandedMeasurementSize(null);
    setIsSizesSectionOpen(false);
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

    const itemsWithSizes = selectedItems.map(item => {
      const selections = cardSizeSelections[item.id || item.item_id] || {};
      const selectedSizes = Object.entries(selections)
        .filter(([, qty]) => parseInt(qty, 10) > 0)
        .map(([sizeKey, qty]) => ({
          sizeKey,
          quantity: parseInt(qty, 10),
          price: item.sizeOptions?.[sizeKey]?.price || 0,
          label: item.sizeOptions?.[sizeKey]?.label || SIZE_LABELS[sizeKey] || sizeKey
        }));

      return {
        item,
        selectedSizes
      };
    });

    const hasAtLeastOneSelection = itemsWithSizes.some(entry => entry.selectedSizes.length > 0);
    if (!hasAtLeastOneSelection) {
      setCartMessage('Please pick size quantities for your selected items');
      return;
    }

    setAddingToCart(true);
    setCartMessage('');

    try {
      const total = calculateBundleTotalWithSelections(rentalDuration, selectedItems, cardSizeSelections);
      const totalDownpayment = total * 0.5;

      const itemsBundle = itemsWithSizes.map(({ item, selectedSizes }) => ({
        id: item.id || item.item_id,
        item_name: item.item_name || item.name || 'Rental Item',
        brand: item.brand || 'Unknown',
        category: item.category || 'rental',
        color: item.color || null,
        material: item.material || null,
        downpayment: item.downpayment || 0,
        image_url: item.front_image ? getRentalImageUrl(item.front_image) : getRentalImageUrl(item.image_url),
        front_image: item.front_image ? getRentalImageUrl(item.front_image) : null,
        back_image: item.back_image ? getRentalImageUrl(item.back_image) : null,
        side_image: item.side_image ? getRentalImageUrl(item.side_image) : null,
        size_options: item.sizeOptions || {},
        selected_sizes: selectedSizes,
        individual_cost: selectedSizes.reduce((sum, s) => {
          const price = s.price > 0 ? s.price : parseFloat(String(item.price || '').replace(/[^ -9.]/g, '')) || 500;
          return sum + (s.quantity * price * (Math.floor(rentalDuration / 3)));
        }, 0)
      })).filter(entry => entry.selected_sizes && entry.selected_sizes.length > 0);

      const rentalData = {
        serviceType: 'rental',
        serviceId: itemsBundle[0].id,
        quantity: itemsBundle.reduce((sum, i) => sum + i.selected_sizes.reduce((s, e) => s + e.quantity, 0), 0),
        basePrice: '0',
        finalPrice: total.toString(),
        pricingFactors: {
          duration: rentalDuration,
          price: total,
          downpayment: totalDownpayment.toString(),
          is_bundle: true,
          item_count: itemsBundle.length
        },
        specificData: {
          is_bundle: true,
          bundle_items: itemsBundle,
          item_names: itemsBundle.map(i => i.item_name).join(', '),
          item_name: `Rental Bundle (${itemsBundle.length} items)`,
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
        setCartMessage(`✅ ${itemsBundle.length} items added to cart as bundle!`);

        setTimeout(() => {
          setIsDateModalOpen(false);
          setSelectedItems([]);
          setCardSizeSelections({});
          setInlineMessage('');
          setInlineMessageItemId(null);
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
  const filteredItems = availableItems.filter(item => {
    const categoryMatch = belongsToFilter(item, selectedCategoryFilter);
    const colorMatch = selectedColorFilter === 'all' || (item.color && normalizeCategoryText(item.color) === normalizeCategoryText(selectedColorFilter));
    const sizeMatch = selectedSizeFilter === 'all' || (item.sizeOptions && selectedSizeFilter in item.sizeOptions);
    const priceMatch = isPriceInRange(item.price, selectedPriceFilter);
    return categoryMatch && colorMatch && sizeMatch && priceMatch;
  });
  const displayItems = showAll ? filteredItems : filteredItems.slice(0, 3);
  const bundlePreviewTotal = calculateBundleTotalWithSelections(3, selectedItems, cardSizeSelections);
  const selectedBundleQty = selectedItems.reduce((sum, item) => sum + getItemSelectedQuantity(item), 0);
  const modalLiveTotal = selectedItem ? calculateTotalCostWithSelections(sizeSelections, selectedItem, rentalDuration) : 0;
  const modalLiveDownpayment = modalLiveTotal * 0.5;

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
        <div className="section-header rc-rental-head">
          <div className="rc-rental-title-wrap">
            <h2 className="rc-rental-title">{showAll ? 'All Rental Clothes' : 'Rental Clothes'}</h2>
            {showAll && (
              <p className="rc-results-summary">Showing {displayItems.length} of {availableItems.length} available items</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                if (isMultiSelectMode) {
                  setIsMultiSelectMode(false);
                  setSelectedItems([]);
                  setCardSizeSelections({});
                  setInlineMessage('');
                  setInlineMessageItemId(null);
                } else {
                  setIsMultiSelectMode(true);
                }
              }}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                border: isMultiSelectMode ? '2px solid #8f2f2f' : '2px solid #8f5825',
                backgroundColor: isMultiSelectMode ? '#8f2f2f' : '#8f5825',
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
        {showAll && (
          <div className="rc-filter-bar" role="group" aria-label="Filter rental clothes">
            <span className="rc-filter-label">Filter by:</span>
            <select 
              className="rc-filter-select"
              value={selectedCategoryFilter} 
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            >
              {getCategoryOptions().map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <select 
              className="rc-filter-select"
              value={selectedColorFilter} 
              onChange={(e) => setSelectedColorFilter(e.target.value)}
            >
              {getColorOptions().map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <select 
              className="rc-filter-select"
              value={selectedSizeFilter} 
              onChange={(e) => setSelectedSizeFilter(e.target.value)}
            >
              {getSizeOptions().map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <select 
              className="rc-filter-select"
              value={selectedPriceFilter} 
              onChange={(e) => setSelectedPriceFilter(e.target.value)}
            >
              {getPriceOptions().map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        )}

        <div className="rental-grid">
          {displayItems.length === 0 ? (
            <div style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: '60px 20px',
              color: '#666',
              fontSize: '18px'
            }}>
              <p style={{ margin: 0, fontWeight: '500' }}>No rental clothes under this category</p>
            </div>
          ) : (
            displayItems.map((item, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
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
                  alt={getItemDisplayName(item)} 
                  onError={(e) => { e.target.src = suitSample; }}
                  style={{
                    opacity: isMultiSelectMode ? 0.9 : 1,
                    cursor: isMultiSelectMode ? 'pointer' : 'default'
                  }} 
                />
                <div className="rental-info">
                  <h3 className="rc-item-name">{getItemDisplayName(item)}</h3>
                  <div className="rc-item-meta">
                    <span className="rc-item-badge">{formatLabel(item.category || 'Rental')}</span>
                    {item.color && <span className="rc-item-badge rc-item-badge-soft">{formatLabel(item.color)}</span>}
                  </div>
                  <p className="rc-item-price">From ₱{parsePriceValue(item.price).toLocaleString('en-PH')}</p>
                  {getAvailableSizeKeys(item.sizeOptions || {}).length > 0 && (
                    <div className="rc-card-sizes">
                      {getAvailableSizeKeys(item.sizeOptions || {}).map(key => {
                        const opt = item.sizeOptions[key] || {};
                        const labelSource = opt.label || SIZE_LABELS[key] || key;
                        const shortLabel = getSizeShortLabel(key, labelSource);
                        return (
                          <span key={key} className="rc-size-chip">
                            {shortLabel}
                            {opt.price > 0 && ` · ₱${parseFloat(opt.price).toLocaleString('en-PH')}`}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {!isMultiSelectMode && (
                    <button onClick={() => openModal(item)} className="btn-view">View</button>
                  )}
                  {isMultiSelectMode && getAvailableSizeKeys(item.sizeOptions || {}).length === 0 && (
                    <div className="rc-card-select-hint">
                      {isItemSelected(item) ? '✓ Selected' : 'Tap to select'}
                    </div>
                  )}
                  {isMultiSelectMode && isItemSelected(item) && getAvailableSizeKeys(item.sizeOptions || {}).length > 0 && (
                    <div className="rc-card-select-hint">
                      ✓ Selected - choose sizes in next step
                    </div>
                  )}
                </div>
              </div>
            </div>
            ))
          )}
        </div>
        {!showAll && filteredItems.length > 3 && (
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
        <div className="rc-bundle-bar">

          <div className="rc-bundle-meta">
            <span><strong>{selectedItems.length}</strong> item{selectedItems.length > 1 ? 's' : ''} selected</span>
            <span>{selectedBundleQty > 0 ? `${selectedBundleQty} pcs total` : 'Set sizes & quantities in next step'}</span>
            <span>
              {bundlePreviewTotal > 0
                ? `Est. downpayment: ₱${(bundlePreviewTotal * 0.5).toFixed(2)}`
                : 'Est. downpayment: select size quantities'}
            </span>
          </div>

          <button
            onClick={openDateModal}
            className="rc-bundle-btn"
            disabled={selectedItems.length === 0}
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

            <h2 style={{ marginBottom: '20px', color: '#1a1a2e', textAlign: 'left' }}>
              Rental Bundle ({selectedItems.length} items)
            </h2>
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#1a1a2e', textAlign: 'left' }}>Select Sizes and Quantities</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {selectedItems.map((item) => {
                  const itemId = getItemId(item);
                  const availableSizeKeys = getAvailableSizeKeys(item.sizeOptions || {});
                  const hasSizeOptions = availableSizeKeys.length > 0;
                  const selectedQty = getItemSelectedQuantity(item);

                  return (
                    <div key={`bundle-size-${itemId}`} className="rc-bundle-size-card">
                      <div className="rc-bundle-size-header">
                        <img
                          src={item.img}
                          alt={item.item_name || item.name}
                          className="rc-bundle-size-image"
                          onError={(e) => {
                            e.target.src = suitSample;
                          }}
                        />
                        <div className="rc-bundle-size-header-info">
                          <strong className="rc-bundle-size-title">{item.item_name || item.name}</strong>
                          <div className="rc-bundle-size-total">
                            <span>Total selected</span>
                            <span className="rc-bundle-size-total-badge">{selectedQty} pcs</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="rc-bundle-size-remove"
                          onClick={() => toggleItemSelection(item)}
                          aria-label={`Remove ${item.item_name || item.name} from selected items`}
                        >
                          Remove
                        </button>
                      </div>

                      {hasSizeOptions ? (
                        <div className="rc-bundle-size-list">
                          {availableSizeKeys.map((sizeKey) => {
                            const opt = item.sizeOptions?.[sizeKey] || {};
                            const currentQty = parseInt(cardSizeSelections?.[itemId]?.[sizeKey] || 0, 10);
                            const parsedSizeQty = parseInt(opt.quantity, 10);
                            const parsedFallbackQty = parseInt(item.total_available, 10);
                            const maxQty = !Number.isNaN(parsedSizeQty)
                              ? Math.max(parsedSizeQty, 0)
                              : (!Number.isNaN(parsedFallbackQty) ? Math.max(parsedFallbackQty, 0) : Number.POSITIVE_INFINITY);
                            const isSelected = currentQty > 0;
                            const labelSource = opt.label || SIZE_LABELS[sizeKey] || sizeKey;
                            const shortLabel = getSizeShortLabel(sizeKey, labelSource);

                            const toggleBox = () => {
                              if (isSelected) {
                                updateCardSizeQuantity(item, sizeKey, -currentQty);
                              } else {
                                updateCardSizeQuantity(item, sizeKey, 1);
                              }
                            };

                            return (
                              <div key={`${itemId}-${sizeKey}`} className={`rc-bundle-size-row ${isSelected ? 'selected' : ''}`}>
                                <div className="rc-bundle-size-row-left">
                                  <button
                                    type="button"
                                    className="rc-size-box-btn"
                                    onClick={toggleBox}
                                    disabled={Number.isFinite(maxQty) && maxQty <= 0}
                                  >
                                    <span className="rc-size-letter">{shortLabel}</span>
                                  </button>
                                  <span className="rc-bundle-size-label">{labelSource}</span>
                                </div>
                                <div className="rc-size-qty-inline rc-bundle-size-qty-inline">
                                  <button
                                    type="button"
                                    onClick={() => updateCardSizeQuantity(item, sizeKey, -1)}
                                    disabled={currentQty <= 0}
                                  >
                                    -
                                  </button>
                                  <span>{currentQty}</span>
                                  <button
                                    type="button"
                                    onClick={() => updateCardSizeQuantity(item, sizeKey, 1)}
                                    disabled={Number.isFinite(maxQty) && currentQty >= maxQty}
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rc-bundle-size-empty">
                          No size options available for this item.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {inlineMessage && (
              <div className="rc-inline-stock-msg" style={{ marginBottom: '15px' }}>{inlineMessage}</div>
            )}

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
                  {selectedItems.map((item) => {
                    const itemId = getItemId(item);
                    const selections = cardSizeSelections[itemId] || {};
                    const sizeSummary = Object.entries(selections)
                      .filter(([, qty]) => parseInt(qty, 10) > 0)
                      .map(([sizeKey, qty]) => `${item.sizeOptions?.[sizeKey]?.label || SIZE_LABELS[sizeKey] || sizeKey} x${qty}`)
                      .join(', ');
                    const itemCost = calculateTotalCostWithSelections(selections, item, rentalDuration);

                    if (itemCost <= 0) {
                      return (
                        <div key={itemId} className="cost-item">
                          <span>{item.item_name || item.name}</span>
                          <span style={{ color: '#c62828', fontWeight: '600' }}>Select size qty</span>
                        </div>
                      );
                    }

                    return (
                      <div key={itemId} className="cost-item">
                        <span>{item.item_name || item.name}{sizeSummary ? ` (${sizeSummary})` : ''}:</span>
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
                  <span>₱{(totalCost * 0.5).toFixed(2)}</span>
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
                  itemName={getItemDisplayName(selectedItem)}
                />
              </div>

              {/* Right: details */}
              <div className="rc-modal-details">
                <h2 className="rc-modal-title">{getItemDisplayName(selectedItem)}</h2>

                {/* Meta info */}
                <div className="rc-meta-row">
                  {selectedItem.category && (
                    <span className="rc-meta-tag rc-meta-tag-category">{formatTagText(selectedItem.category)}</span>
                  )}
                  {selectedItem.color && <span className="rc-meta-tag rc-meta-tag-color">{formatTagText(selectedItem.color)}</span>}
                  {selectedItem.material && <span className="rc-meta-tag rc-meta-tag-material">{formatTagText(selectedItem.material)}</span>}
                </div>
                <div className="rc-starting-price">
                  Starting from <strong>₱{getDisplayPrice(selectedItem).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                  <span> - 3-day rental</span>
                </div>

                {/* Sizes + Measurements table */}
                {getAvailableSizeKeys(selectedItem.sizeOptions || {}).length > 0 && (
                  <div className="rc-sizes-section">
                    <div className="rc-section-header-row">
                      <h4>Sizes & Quantities</h4>
                      <div className="rc-section-tools">
                        <div className="rc-unit-toggle">
                          <button className={measurementUnit === 'inch' ? 'active' : ''} onClick={() => setMeasurementUnit('inch')}>in</button>
                          <button className={measurementUnit === 'cm' ? 'active' : ''} onClick={() => setMeasurementUnit('cm')}>cm</button>
                        </div>
                        <button
                          type="button"
                          className="rc-collapse-toggle"
                          onClick={() => setIsSizesSectionOpen(prev => !prev)}
                        >
                          {isSizesSectionOpen ? 'Hide details' : 'Show details'}
                        </button>
                      </div>
                    </div>
                    <div className="rc-selection-summary" style={{ marginTop: '4px' }}>
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
                    {isSizesSectionOpen && (
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
                                <span className="rc-size-price">₱ {parseFloat(opt.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })} / 3 days</span>
                              )}
                              <div className="rc-qty-control">
                                <button
                                  disabled={currentQty <= 0}
                                  onClick={() => setSizeSelections(prev => ({ ...prev, [sizeKey]: Math.max(0, currentQty - 1) }))}
                                >−</button>
                                <span>{currentQty}</span>
                                <button
                                  disabled={currentQty >= maxQty}
                                  onClick={() => setSizeSelections(prev => ({ ...prev, [sizeKey]: Math.min(maxQty, currentQty + 1) }))}
                                >+
                                </button>
                              </div>
                              {hasMeasurements && measurementRows.length > 0 && (
                                <button
                                  className="rc-meas-toggle"
                                  onClick={() => setExpandedMeasurementSize(isExpanded ? null : sizeKey)}
                                >
                                  {isExpanded ? 'Hide Measurements' : 'Measurements'}
                                </button>
                              )}
                            </div>
                            {hasMeasurements && measurementRows.length > 0 && (
                              <>
                                {isExpanded && (
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
                              </>
                            )}
                          </div>
                        );
                        })}
                      </div>
                    )}
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
                  disabled={!startDate || !rentalDuration || modalLiveTotal <= 0 || addingToCart}
                >
                  {addingToCart ? 'Adding...' : (
                    <>
                      <span className="rc-btn-rent-main">Add to Cart</span>
                      <span className="rc-btn-rent-sub">50% downpayment required</span>
                      <span className="rc-btn-rent-price">₱{modalLiveDownpayment > 0 ? modalLiveDownpayment.toFixed(2) : '0.00'}</span>
                    </>
                  )}
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

