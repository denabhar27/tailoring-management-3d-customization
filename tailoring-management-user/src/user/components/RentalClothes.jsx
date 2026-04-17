import React, { useState, useEffect } from 'react';

import { useNavigate } from 'react-router-dom';

import { getAllRentals, getRentalImageUrl, getAvailableQuantity } from '../../api/RentalApi';

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

        const deposit = parseFloat(entry.deposit) || 0;

        const rentalDuration = Math.max(1, Math.min(30, parseInt(entry.rental_duration, 10) || 3));

        const overdueAmount = Math.max(0, parseFloat(entry.overdue_amount) || 50);

        const normalizedMeasurements = normalizeMeasurementsObject(

          entry.measurements || entry.measurement_profile || entry.measurementProfile

        );

        sizeOptions[key] = {

          quantity: isNaN(qty) ? null : Math.max(0, qty),

          price,

          deposit,

          rental_duration: rentalDuration,

          overdue_amount: overdueAmount,

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

          rental_duration: Math.max(1, Math.min(30, parseInt(option.rental_duration, 10) || 3)),

          overdue_amount: Math.max(0, parseFloat(option.overdue_amount) || 50),

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



const resolveMeasurementsForSize = (item, sizeKey, option = {}) => {

  const direct = normalizeMeasurementsObject(

    option.measurements || option.measurement_profile || option.measurementProfile

  );

  if (direct) return direct;



  const parsed = (() => {

    try {

      return typeof item?.size === 'string' ? JSON.parse(item.size) : item?.size;

    } catch {

      return null;

    }

  })();



  if (parsed && typeof parsed === 'object') {

    if (Array.isArray(parsed.size_entries)) {

      const matchedEntry = parsed.size_entries.find((entry) => {

        if (!entry || typeof entry !== 'object') return false;

        const entryKey = entry.sizeKey || entry.key;

        if (entryKey && entryKey === sizeKey) return true;

        const optionLabel = String(option.label || '').trim().toLowerCase();

        const entryLabel = String(entry.customLabel || entry.label || '').trim().toLowerCase();

        return optionLabel && entryLabel && optionLabel === entryLabel;

      });

      const fromEntry = normalizeMeasurementsObject(

        matchedEntry?.measurements || matchedEntry?.measurement_profile || matchedEntry?.measurementProfile

      );

      if (fromEntry) return fromEntry;

    }



    const optionsSource = parsed.size_options || parsed.sizeOptions;

    const fromStructuredOption = normalizeMeasurementsObject(

      optionsSource?.[sizeKey]?.measurements || optionsSource?.[sizeKey]?.measurement_profile || optionsSource?.[sizeKey]?.measurementProfile

    );

    if (fromStructuredOption) return fromStructuredOption;



    const fromRoot = normalizeMeasurementsObject(parsed.measurement_profile || parsed.measurementProfile || parsed.measurements);

    if (fromRoot) return fromRoot;

  }



  return normalizeMeasurementsObject(item?.measurementProfile);

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

  const [rentalDuration, setRentalDuration] = useState(0);

  const [endDate, setEndDate] = useState('');

  const [totalCost, setTotalCost] = useState(0);

  const [cartMessage, setCartMessage] = useState('');

  const [dateError, setDateError] = useState('');

  const [addingToCart, setAddingToCart] = useState(false);

  const [measurementUnit, setMeasurementUnit] = useState('inch');

  const [sizeSelections, setSizeSelections] = useState({});

  const [sizeDurationSelections, setSizeDurationSelections] = useState({});

  const [cardSizeSelections, setCardSizeSelections] = useState({});

  const [cardSizeDurationSelections, setCardSizeDurationSelections] = useState({});

  const [expandedMeasurementSize, setExpandedMeasurementSize] = useState(null);

  const [, setIsSizesSectionOpen] = useState(false);

  const [inlineMessage, setInlineMessage] = useState('');

  const [inlineMessageItemId, setInlineMessageItemId] = useState(null);

  const [realTimeAvailability, setRealTimeAvailability] = useState({});

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



  const getDisplayPriceRange = (item) => {

    if (!item) {

      return { min: 500, max: 500 };

    }



    const prices = getAvailableSizeKeys(item.sizeOptions || {})

      .map((k) => parseFloat(item.sizeOptions?.[k]?.price))

      .filter((p) => !isNaN(p) && p > 0);



    if (prices.length > 0) {

      return {

        min: Math.min(...prices),

        max: Math.max(...prices)

      };

    }



    const fallback = getDisplayPrice(item);

    return { min: fallback, max: fallback };

  };



  const getDisplayDeposit = (item) => {

    if (!item) return 0;

    const deposits = getAvailableSizeKeys(item.sizeOptions || {})

      .map((k) => parseFloat(item.sizeOptions?.[k]?.deposit))

      .filter((d) => !isNaN(d) && d > 0);



    if (deposits.length > 0) {

      return Math.min(...deposits);

    }



    const fallback = parseFloat(String(item.deposit || '').replace(/[^\d.]/g, ''));

    return !isNaN(fallback) && fallback > 0 ? fallback : 0;

  };



  const getDisplayDepositRange = (item) => {

    if (!item) {

      return { min: 0, max: 0 };

    }



    const deposits = getAvailableSizeKeys(item.sizeOptions || {})

      .map((k) => parseFloat(item.sizeOptions?.[k]?.deposit))

      .filter((d) => !isNaN(d) && d > 0);



    if (deposits.length > 0) {

      return {

        min: Math.min(...deposits),

        max: Math.max(...deposits)

      };

    }



    const fallback = getDisplayDeposit(item);

    return { min: fallback, max: fallback };

  };



  const calculateEndDate = (start, duration) => {

    if (!start) return '';

    const startDateObj = new Date(start);

    const endDateObj = new Date(startDateObj);

    endDateObj.setDate(startDateObj.getDate() + duration - 1);

    return endDateObj.toISOString().split('T')[0];

  };



  const getSelectedSizeTerms = (item, selections = {}, start, durationSelections = {}) => {

    if (!item) return [];

    return Object.entries(selections)

      .map(([sizeKey, qty]) => {

        const quantity = parseInt(qty, 10);

        if (isNaN(quantity) || quantity <= 0) return null;

        const opt = item.sizeOptions?.[sizeKey] || {};

        const rentalDuration = Math.max(1, Math.min(30, parseInt(durationSelections[sizeKey] ?? opt.rental_duration, 10) || 3));

        const overdueAmount = Math.max(0, parseFloat(opt.overdue_amount) || 50);

        const dueDate = start ? calculateEndDate(start, rentalDuration) : '';

        return {

          sizeKey,

          quantity,

          rental_duration: rentalDuration,

          overdue_amount: overdueAmount,

          due_date: dueDate,

          label: opt.label || SIZE_LABELS[sizeKey] || sizeKey

        };

      })

      .filter(Boolean);

  };



  const getLatestDueDate = (terms = []) => {

    if (!Array.isArray(terms) || terms.length === 0) return '';

    return terms

      .map((term) => term.due_date)

      .filter(Boolean)

      .reduce((latest, current) => (current > latest ? current : latest), terms[0].due_date || '');

  };



  const getLongestDuration = (terms = []) => {

    if (!Array.isArray(terms) || terms.length === 0) return 0;

    return terms.reduce((max, term) => Math.max(max, parseInt(term.rental_duration, 10) || 0), 0);

  };



  const getDurationOptions = (terms = []) => {

    const uniqueDurations = [...new Set(

      (Array.isArray(terms) ? terms : [])

        .map((term) => Math.max(1, parseInt(term.rental_duration, 10) || 0))

        .filter((duration) => duration > 0)

    )];

    return uniqueDurations.sort((left, right) => left - right);

  };



  useEffect(() => {

    if (startDate && selectedItem) {

      const terms = getSelectedSizeTerms(selectedItem, sizeSelections, startDate, sizeDurationSelections);

      const nextDuration = getLongestDuration(terms);

      setRentalDuration(nextDuration);

      setEndDate(nextDuration > 0 ? calculateEndDate(startDate, nextDuration) : '');

      const cost = calculateTotalCostWithSelections(sizeSelections, selectedItem, sizeDurationSelections);

      setTotalCost(cost);

    } else {

      setEndDate('');

      setRentalDuration(0);

      setTotalCost(0);

    }

  }, [startDate, selectedItem, sizeSelections, sizeDurationSelections]);



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

    setSizeDurationSelections({});

    setExpandedMeasurementSize(null);

    setIsSizesSectionOpen(false);

  };



  const handleSeeMore = () => {

    navigate('/rentals', { state: { isGuest } });

  };



  const calculateTotalCost = (_duration, item) => {

    if (!item) return 0;

    let basePrice = 500;

    if (item.price) {

      const priceStr = String(item.price).replace(/[^\d.]/g, '');

      const parsedPrice = parseFloat(priceStr);

      if (!isNaN(parsedPrice) && parsedPrice > 0) basePrice = parsedPrice;

    }

    return basePrice;

  };



  const calculateTotalDeposit = (item) => {

    if (!item) return 0;

    const sizeOpts = item.sizeOptions || {};

    if (Object.keys(sizeOpts).length === 0) {

      return getDisplayDeposit(item);

    }

    let totalDeposit = 0;

    Object.values(sizeOpts).forEach(opt => {

      const deposit = parseFloat(opt.deposit) || 0;

      const qty = parseInt(opt.quantity) || 0;

      totalDeposit += deposit * qty;

    });

    return totalDeposit > 0 ? totalDeposit : getDisplayDeposit(item);

  };



  const calculateTotalCostWithSelections = (selections, item, durationSelections = {}) => {

    if (!item) return 0;

    const sizeOpts = item.sizeOptions || {};

    let fallbackPrice = 500;

    if (item.price) {

      const priceStr = String(item.price).replace(/[^\d.]/g, '');

      const p = parseFloat(priceStr);

      if (!isNaN(p) && p > 0) fallbackPrice = p;

    }

    if (Object.keys(sizeOpts).length === 0) {

      const fallbackQty = Object.values(selections || {}).reduce((sum, qty) => {
        const q = parseInt(qty, 10);
        return sum + (isNaN(q) || q <= 0 ? 0 : q);
      }, 0);

      return (fallbackQty > 0 ? fallbackQty : 1) * fallbackPrice;

    }

    let total = 0;

    Object.entries(selections).forEach(([sizeKey, qty]) => {

      const q = parseInt(qty, 10);

      if (isNaN(q) || q <= 0) return;

      const sizePrice = sizeOpts[sizeKey]?.price > 0 ? sizeOpts[sizeKey].price : fallbackPrice;
      const cycleDays = Math.max(1, Math.min(30, parseInt(sizeOpts[sizeKey]?.rental_duration, 10) || 3));
      const selectedDays = Math.max(1, Math.min(30, parseInt(durationSelections[sizeKey], 10) || cycleDays));
      const cycleCount = Math.max(1, Math.ceil(selectedDays / cycleDays));

      total += q * sizePrice * cycleCount;

    });

    return total;

  };



  const calculateTotalDepositWithSelections = (selections, item) => {

    const sizeOpts = item.sizeOptions || {};

    if (Object.keys(sizeOpts).length === 0) {

      return getDisplayDeposit(item);

    }

    let total = 0;

    Object.entries(selections).forEach(([sizeKey, qty]) => {

      const q = parseInt(qty, 10);

      if (isNaN(q) || q <= 0) return;

      const sizeDeposit = parseFloat(sizeOpts[sizeKey]?.deposit) || 0;

      total += q * sizeDeposit;

    });

    return total > 0 ? total : 0;

  };



  const calculateMultiTotalCost = (_duration, items) => {

    if (!items || items.length === 0) return 0;

    return items.reduce((total, item) => total + calculateTotalCost(null, item), 0);

  };



  const calculateBundleTotalWithSelections = (items, selectionsByItem, durationSelectionsByItem = {}) => {

    if (!items || items.length === 0) return 0;

    return items.reduce((total, item) => {

      const itemId = item.id || item.item_id;

      const selections = selectionsByItem?.[itemId] || {};

      const durations = durationSelectionsByItem?.[itemId] || {};

      return total + calculateTotalCostWithSelections(selections, item, durations);

    }, 0);

  };



  const getBundleSelectedTerms = (items, selectionsByItem = {}, start, durationSelectionsByItem = {}) => {

    if (!Array.isArray(items) || items.length === 0) return [];

    return items.flatMap((item) => {

      const itemId = item.id || item.item_id;

      return getSelectedSizeTerms(item, selectionsByItem[itemId] || {}, start, durationSelectionsByItem[itemId] || {}).map((term) => ({

        ...term,

        item_id: itemId,

        item_name: item.item_name || item.name || 'Rental Item'

      }));

    });

  };



  const calculateMultiDownpayment = (items, _duration) => {

    if (!items || items.length === 0) return 0;

    const totalCost = calculateMultiTotalCost(null, items);

    const totalDeposit = items.reduce((sum, item) => sum + calculateTotalDeposit(item), 0);

    return totalCost + totalDeposit;

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

      setCardSizeDurationSelections(prev => {
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



  const updateCardSizeQuantity = async (item, sizeKey, delta) => {

    const itemId = getItemId(item);

    // Fetch real-time availability if not already loaded

    let availableQty = realTimeAvailability[sizeKey];

    if (availableQty === undefined) {

      try {

        const availabilityData = await getAvailableQuantity(itemId);

        if (availabilityData && availabilityData.available_quantities) {

          setRealTimeAvailability(availabilityData.available_quantities);

          availableQty = availabilityData.available_quantities[sizeKey];

        }

      } catch (error) {

        console.error('Error fetching availability:', error);

      }

    }

    const option = item.sizeOptions?.[sizeKey] || {};

    const parsedOptionQty = parseInt(option.quantity, 10);

    const parsedFallbackQty = parseInt(item.total_available, 10);

    // Use real-time availability if available, otherwise fall back to database quantity

    const maxQty = availableQty !== undefined

      ? availableQty

      : (!Number.isNaN(parsedOptionQty)

        ? Math.max(parsedOptionQty, 0)

        : (!Number.isNaN(parsedFallbackQty) ? Math.max(parsedFallbackQty, 0) : Number.POSITIVE_INFINITY));



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

    const nextDurationSelections = {
      ...(cardSizeDurationSelections[itemId] || {}),
      [sizeKey]: Math.max(1, Math.min(30, parseInt((cardSizeDurationSelections[itemId] || {})[sizeKey], 10) || parseInt(option.rental_duration, 10) || 3))
    };



    if (safeQty <= 0) {

      delete nextItemSelections[sizeKey];

      delete nextDurationSelections[sizeKey];

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

    setCardSizeDurationSelections(prev => {
      const next = { ...prev };
      if (hasAnyAfter) {
        next[itemId] = nextDurationSelections;
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

  const updateCardSizeDuration = (item, sizeKey, delta) => {
    const itemId = getItemId(item);
    const option = item.sizeOptions?.[sizeKey] || {};
    const baseDuration = Math.max(1, Math.min(30, parseInt(option.rental_duration, 10) || 3));
    const currentDuration = Math.max(1, Math.min(30, parseInt(cardSizeDurationSelections?.[itemId]?.[sizeKey], 10) || baseDuration));
    const nextDuration = Math.max(1, Math.min(30, currentDuration + delta));

    setCardSizeDurationSelections(prev => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        [sizeKey]: nextDuration
      }
    }));
  };



  const openDateModal = async () => {

    if (selectedItems.length === 0) {

      await alert('Please select at least one item', 'Selection Required', 'warning');

      return;

    }

    // Fetch real-time availability for all selected items

    const availabilityPromises = selectedItems.map(item => 

      getAvailableQuantity(item.id || item.item_id)

        .then(data => ({ itemId: item.id || item.item_id, data }))

        .catch(err => ({ itemId: item.id || item.item_id, data: null }))

    );

    

    try {

      const availabilityResults = await Promise.all(availabilityPromises);

      const availabilityMap = {};

      availabilityResults.forEach(result => {

        if (result.data && result.data.available_quantities) {

          availabilityMap[result.itemId] = result.data.available_quantities;

        }

      });

      setRealTimeAvailability(availabilityMap);

    } catch (error) {

      console.error('Error fetching availability for bundle:', error);

    }



    setStartDate('');

    setRentalDuration(0);

    setEndDate('');

    const terms = getBundleSelectedTerms(selectedItems, cardSizeSelections, '', cardSizeDurationSelections);

    setRentalDuration(getLongestDuration(terms));

    const cost = calculateBundleTotalWithSelections(selectedItems, cardSizeSelections, cardSizeDurationSelections);

    setTotalCost(cost);

    setCartMessage('');

    setIsDateModalOpen(true);

  };



  useEffect(() => {

    if (selectedItems.length > 0 && isDateModalOpen) {

      const terms = getBundleSelectedTerms(selectedItems, cardSizeSelections, startDate, cardSizeDurationSelections);

      setRentalDuration(getLongestDuration(terms));

      const cost = calculateBundleTotalWithSelections(selectedItems, cardSizeSelections, cardSizeDurationSelections);

      setTotalCost(cost);



      if (startDate) {

        const calculatedEndDate = getLatestDueDate(terms);

        setEndDate(calculatedEndDate || '');

      } else {

        setEndDate('');

      }

    } else if (isDateModalOpen) {

      setEndDate('');

      setTotalCost(0);

    }

  }, [startDate, selectedItems, isDateModalOpen, cardSizeSelections, cardSizeDurationSelections]);



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



  const openModal = async (item) => {

    const preset = cardSizeSelections[item.id || item.item_id] || {};

    const durationPreset = Object.entries(item.sizeOptions || {}).reduce((acc, [sizeKey, opt]) => {
      acc[sizeKey] = Math.max(1, Math.min(30, parseInt(opt.rental_duration, 10) || 3));
      return acc;
    }, {});

    setSelectedItem(item);

    setStartDate('');

    const initialTerms = getSelectedSizeTerms(item, preset, '', durationPreset);

    setRentalDuration(getLongestDuration(initialTerms));

    setEndDate('');

    setTotalCost(0);

    setCartMessage('');

    setSizeSelections(preset);

    setSizeDurationSelections(durationPreset);

    setExpandedMeasurementSize(null);

    setIsSizesSectionOpen(false);

    setIsModalOpen(true);

    // Fetch real-time availability

    try {

      const availabilityData = await getAvailableQuantity(item.id || item.item_id);

      if (availabilityData && availabilityData.available_quantities) {

        setRealTimeAvailability(availabilityData.available_quantities);

      }

    } catch (error) {

      console.error('Error fetching availability:', error);

      setRealTimeAvailability({});

    }

  };



  const handleAddToCart = async () => {

    if (!selectedItem || !startDate) {

      setCartMessage('Please select a start date');

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

      const downpayment = totalCost;

      const totalDeposit = calculateTotalDepositWithSelections(sizeSelections, selectedItem);

      const selectedTerms = getSelectedSizeTerms(selectedItem, sizeSelections, startDate, sizeDurationSelections);

      const derivedDuration = getLongestDuration(selectedTerms);

      const derivedEndDate = getLatestDueDate(selectedTerms);

      const selectedSizesData = selectedEntries.map(([sizeKey, qty]) => {

        const sizeDuration = Math.max(1, Math.min(30, parseInt(sizeDurationSelections[sizeKey] ?? selectedItem.sizeOptions?.[sizeKey]?.rental_duration, 10) || 3));

        return {

          sizeKey,

          label: selectedItem.sizeOptions?.[sizeKey]?.label || SIZE_LABELS[sizeKey] || sizeKey,

          quantity: parseInt(qty, 10),

          price: selectedItem.sizeOptions?.[sizeKey]?.price || 0,

          deposit: selectedItem.sizeOptions?.[sizeKey]?.deposit || 0,

          rental_duration: sizeDuration,

          overdue_amount: Math.max(0, parseFloat(selectedItem.sizeOptions?.[sizeKey]?.overdue_amount) || 50),

          due_date: calculateEndDate(startDate, sizeDuration)

        };

      });

      const primarySize = selectedSizesData[0];

      const rentalData = {

        serviceType: 'rental',

        serviceId: selectedItem.id || selectedItem.item_id,

        quantity: selectedSizesData.reduce((s, e) => s + e.quantity, 0),

        basePrice: '0',

        finalPrice: totalCost.toString(),

        pricingFactors: {

          duration: derivedDuration,

          price: totalCost,

          downpayment: totalDeposit.toString(),

          deposit: totalDeposit.toString(),

          total_due_on_pickup: (downpayment + totalDeposit).toString()

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

        rentalDates: { startDate, endDate: derivedEndDate || endDate, duration: derivedDuration }

      };

      const result = await addToCart(rentalData);

      if (result.success) {

        setCartMessage(`✅ ${selectedItem.item_name || selectedItem.name} added to cart!`);

        setTimeout(() => {

          setIsModalOpen(false);

          setSelectedItem(null);

          setSizeSelections({});

          setStartDate('');

          setRentalDuration(0);

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

    if (selectedItems.length === 0 || !startDate) {

      setCartMessage('Please select items and start date');

      return;

    }



    const itemsWithSizes = selectedItems.map(item => {

      const selections = cardSizeSelections[item.id || item.item_id] || {};

      const durationMap = cardSizeDurationSelections[item.id || item.item_id] || {};

      const selectedSizes = Object.entries(selections)

        .filter(([, qty]) => parseInt(qty, 10) > 0)

        .map(([sizeKey, qty]) => ({

          sizeKey,

          quantity: parseInt(qty, 10),

          price: item.sizeOptions?.[sizeKey]?.price || 0,

          deposit: item.sizeOptions?.[sizeKey]?.deposit || 0,

          rental_duration: Math.max(1, Math.min(30, parseInt(durationMap[sizeKey], 10) || parseInt(item.sizeOptions?.[sizeKey]?.rental_duration, 10) || 3)),

          overdue_amount: Math.max(0, parseFloat(item.sizeOptions?.[sizeKey]?.overdue_amount) || 50),

          due_date: calculateEndDate(startDate, Math.max(1, Math.min(30, parseInt(durationMap[sizeKey], 10) || parseInt(item.sizeOptions?.[sizeKey]?.rental_duration, 10) || 3))),

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

      const bundleTerms = getBundleSelectedTerms(selectedItems, cardSizeSelections, startDate, cardSizeDurationSelections);

      const derivedDuration = getLongestDuration(bundleTerms);

      const derivedEndDate = getLatestDueDate(bundleTerms);

      const total = calculateBundleTotalWithSelections(selectedItems, cardSizeSelections, cardSizeDurationSelections);

      const totalDownpayment = total;

      const bundleDeposit = selectedItems.reduce((sum, item) => {

        const selections = cardSizeSelections[item.id || item.item_id] || {};

        return sum + calculateTotalDepositWithSelections(selections, item);

      }, 0);



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

          const price = s.price > 0 ? s.price : parseFloat(String(item.price || '').replace(/[^\d.]/g, '')) || 500;

          const cycleDays = Math.max(1, Math.min(30, parseInt(item.sizeOptions?.[s.sizeKey]?.rental_duration, 10) || 3));

          const selectedDays = Math.max(1, Math.min(30, parseInt(s.rental_duration, 10) || cycleDays));

          const cycleCount = Math.max(1, Math.ceil(selectedDays / cycleDays));

          return sum + (s.quantity * price * cycleCount);

        }, 0)

      })).filter(entry => entry.selected_sizes && entry.selected_sizes.length > 0);



      const rentalData = {

        serviceType: 'rental',

        serviceId: itemsBundle[0].id,

        quantity: itemsBundle.reduce((sum, i) => sum + i.selected_sizes.reduce((s, e) => s + e.quantity, 0), 0),

        basePrice: '0',

        finalPrice: total.toString(),

        pricingFactors: {

          duration: derivedDuration,

          price: total,

          downpayment: bundleDeposit.toString(),

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

          endDate: derivedEndDate || endDate,

          duration: derivedDuration

        }

      };



      const result = await addToCart(rentalData);



      if (result.success) {

        setCartMessage(`✅ ${itemsBundle.length} items added to cart as bundle!`);



        setTimeout(() => {

          setIsDateModalOpen(false);

          setSelectedItems([]);

          setCardSizeSelections({});

          setCardSizeDurationSelections({});

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

  const bundlePreviewTotal = calculateBundleTotalWithSelections(selectedItems, cardSizeSelections, cardSizeDurationSelections);

  const bundlePreviewTerms = getBundleSelectedTerms(selectedItems, cardSizeSelections, startDate, cardSizeDurationSelections);

  const selectedBundleQty = selectedItems.reduce((sum, item) => sum + getItemSelectedQuantity(item), 0);

  const modalLiveTotal = selectedItem ? calculateTotalCostWithSelections(sizeSelections, selectedItem, sizeDurationSelections) : 0;

  const modalLiveDeposit = selectedItem ? calculateTotalDepositWithSelections(sizeSelections, selectedItem) : 0;

  const modalLiveDownpayment = modalLiveTotal + modalLiveDeposit;



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

            <p className="rc-rental-eyebrow">Wardrobe Collection</p>
            <h2 className="rc-rental-title">{showAll ? 'All Rental Clothes' : 'Rental Clothes'}</h2>

            {showAll && (

              <p className="rc-results-summary">Showing {displayItems.length} of {availableItems.length} available items</p>

            )}

          </div>

          <div className="rc-rental-actions">

            <button
              className={`rc-select-multiple-btn ${isMultiSelectMode ? 'active' : ''}`}

              onClick={() => {

                if (isMultiSelectMode) {

                  setIsMultiSelectMode(false);

                  setSelectedItems([]);

                  setCardSizeSelections({});

                  setCardSizeDurationSelections({});

                  setInlineMessage('');

                  setInlineMessageItemId(null);

                } else {

                  setIsMultiSelectMode(true);

                }

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

            <div key={i} className="rc-rental-card-wrap">

              <div

                className="rental-card"

                style={{

                  position: 'relative',

                  border: isMultiSelectMode && isItemSelected(item) ? '2px solid #8f5825' : '1px solid #e5d8c9',

                  transition: 'all 0.2s ease'

                }}

                onClick={() => {

                  if (isMultiSelectMode) {

                    toggleItemSelection(item);

                  }

                }}

              >

                {isMultiSelectMode && (

                  <div className={`rc-multi-select-indicator ${isItemSelected(item) ? 'selected' : ''}`}>

                    {isItemSelected(item) && (

                      <span style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>✓</span>

                    )}

                  </div>

                )}

                <img 

                  src={item.img} 

                  alt={getItemDisplayName(item)} 

                  onError={(e) => { e.target.src = suitSample; }}

                  className={isMultiSelectMode ? 'rc-card-image-select-mode' : ''}

                />

                <div className="rental-info">

                  <h3 className="rc-item-name">{getItemDisplayName(item)}</h3>

                  <div className="rc-item-meta">

                    <span className="rc-item-badge">{formatLabel(item.category || 'Rental')}</span>

                    {item.color && <span className="rc-item-badge rc-item-badge-soft">{formatLabel(item.color)}</span>}

                  </div>

                  <div className="rc-item-pricing">

                    <p className="rc-item-price">

                      {(() => {

                        const { min, max } = getDisplayPriceRange(item);

                        const minLabel = `₱${min.toLocaleString('en-PH')}`;

                        const maxLabel = `₱${max.toLocaleString('en-PH')}`;

                        return min === max ? minLabel : `${minLabel} - ${maxLabel}`;

                      })()}

                    </p>

                  </div>

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

                    <button onClick={() => openModal(item)} className="btn-view">View Details</button>

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

          <div className="rc-see-more-wrap">

            <span

              onClick={handleSeeMore}

              className="rc-see-more-btn"

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

                ? `Est. total due on pickup: ₱${(bundlePreviewTotal + selectedItems.reduce((sum, item) => sum + calculateTotalDepositWithSelections(cardSizeSelections[getItemId(item)] || {}, item), 0)).toFixed(2)}`

                : 'Est. total due on pickup: select size quantities'}

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

            maxWidth: '860px',

            width: '96%',

            maxHeight: '92vh',

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

            <div className="date-section" style={{ marginBottom: '20px' }}>

              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>

                <div className="date-input-group" style={{ flex: 1, minWidth: '240px', maxWidth: '360px' }}>

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

              </div>

            </div>

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

                            const baseDuration = Math.max(1, Math.min(30, parseInt(opt.rental_duration, 10) || 3));

                            const currentDuration = Math.max(1, Math.min(30, parseInt(cardSizeDurationSelections?.[itemId]?.[sizeKey], 10) || baseDuration));

                            const parsedSizeQty = parseInt(opt.quantity, 10);

                            const parsedFallbackQty = parseInt(item.total_available, 10);

                            // Use real-time availability if available for this item

                            const itemAvailability = realTimeAvailability[itemId] || {};

                            const realTimeQty = itemAvailability[sizeKey];

                            const maxQty = realTimeQty !== undefined

                              ? realTimeQty

                              : (!Number.isNaN(parsedSizeQty)

                                ? Math.max(parsedSizeQty, 0)

                                : (!Number.isNaN(parsedFallbackQty) ? Math.max(parsedFallbackQty, 0) : Number.POSITIVE_INFINITY));

                            const isSelected = currentQty > 0;

                            const labelSource = opt.label || SIZE_LABELS[sizeKey] || sizeKey;

                            const shortLabel = getSizeShortLabel(sizeKey, labelSource);

                            const sizePrice = parseFloat(opt.price) || 0;

                            const sizeDeposit = parseFloat(opt.deposit) || 0;



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

                                  <div className="rc-bundle-size-copy">
                                    <span className="rc-bundle-size-label">{labelSource}</span>
                                    <div className="rc-bundle-size-price-row">
                                      {sizePrice > 0 && (
                                        <span className="rc-size-price">₱ {sizePrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })} / {baseDuration} day{baseDuration > 1 ? 's' : ''}</span>
                                      )}
                                      {sizeDeposit > 0 && (
                                        <span className="rc-size-price" style={{ color: '#b94a48' }}>Deposit: ₱ {sizeDeposit.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                                      )}
                                    </div>
                                  </div>

                                </div>

                                <div className="rc-bundle-size-controls">
                                  <div className="rc-bundle-controls-inline">
                                    <div className="rc-bundle-control-group rc-bundle-control-group-qty">
                                      <div className="rc-size-qty-inline rc-bundle-size-qty-inline">
                                        <button
                                          type="button"
                                          onClick={() => updateCardSizeQuantity(item, sizeKey, -1)}
                                          disabled={currentQty <= 0}
                                        >
                                          -
                                        </button>
                                        <span className="rc-bundle-qty-value">{currentQty}</span>
                                        <button
                                          type="button"
                                          onClick={() => updateCardSizeQuantity(item, sizeKey, 1)}
                                          disabled={Number.isFinite(maxQty) && currentQty >= maxQty}
                                        >
                                          +
                                        </button>
                                      </div>
                                    </div>

                                    <div className="rc-bundle-control-group rc-bundle-control-group-duration">
                                      <span className="rc-bundle-control-label">Duration:</span>
                                      <div className="rc-size-qty-inline rc-bundle-size-qty-inline rc-bundle-duration-inline">
                                        <button
                                          type="button"
                                          onClick={() => updateCardSizeDuration(item, sizeKey, -1)}
                                          disabled={currentDuration <= 1}
                                        >
                                          -
                                        </button>
                                        <span className="rc-bundle-duration-value">{currentDuration}</span>
                                        <button
                                          type="button"
                                          onClick={() => updateCardSizeDuration(item, sizeKey, 1)}
                                          disabled={currentDuration >= 30}
                                        >
                                          +
                                        </button>
                                        <span className="rc-bundle-control-suffix">days</span>
                                      </div>
                                    </div>
                                  </div>

                                  {realTimeQty !== undefined && (
                                    <span className="rc-bundle-stock-note" style={{ color: realTimeQty === 0 ? '#d32f2f' : '#666' }}>
                                      {realTimeQty === 0 ? 'Out of stock' : `${realTimeQty} available`}
                                    </span>
                                  )}

                                  {startDate && currentQty > 0 && (
                                    <div className="rc-bundle-end-date">
                                      <span className="rc-bundle-end-date-label">End Date ({labelSource}):</span>
                                      <input
                                        type="date"
                                        value={calculateEndDate(startDate, currentDuration)}
                                        readOnly
                                        className="rc-bundle-end-date-input"
                                      />
                                    </div>
                                  )}

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



            {startDate && bundlePreviewTerms.length > 0 && (

              <div style={{ marginBottom: '20px', display: 'grid', gap: '6px' }}>

                {bundlePreviewTerms.map((term, idx) => (

                  <div key={`bundle-term-${term.item_id}-${term.sizeKey}-${idx}`} style={{ fontSize: '12px', color: '#555' }}>

                    Overdue ({term.item_name} - {term.label}): <strong>₱{(parseFloat(term.overdue_amount) || 0).toFixed(2)} per late day</strong>

                  </div>

                ))}

              </div>

            )}

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

                    const durations = cardSizeDurationSelections[itemId] || {};

                    const itemCost = calculateTotalCostWithSelections(selections, item, durations);



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

                  <span>Rental Price ({rentalDuration > 0 ? `${rentalDuration} day${rentalDuration > 1 ? 's' : ''}` : 'dynamic terms'}):</span>

                  <span>₱{totalCost.toFixed(2)}</span>

                </div>

                {(() => {

                  const bundleDeposit = selectedItems.reduce((sum, item) => {

                    const selections = cardSizeSelections[item.id || item.item_id] || {};

                    return sum + calculateTotalDepositWithSelections(selections, item);

                  }, 0);

                  return bundleDeposit > 0 && (

                    <>

                      <div style={{ borderTop: '1px solid #e0e0e0', margin: '10px 0' }} />

                      {selectedItems.map((item) => {

                        const itemId = getItemId(item);

                        const selections = cardSizeSelections[itemId] || {};

                        return Object.entries(selections)

                          .filter(([, qty]) => parseInt(qty, 10) > 0)

                          .map(([sizeKey, qty]) => {

                            const opt = item.sizeOptions?.[sizeKey] || {};

                            const deposit = parseFloat(opt.deposit) || 0;

                            const lineDeposit = parseInt(qty, 10) * deposit;

                            if (lineDeposit <= 0) return null;

                            return (

                              <div key={`${itemId}-${sizeKey}-dep`} className="cost-item deposit">

                                <span>{item.item_name || item.name} ({opt.label || SIZE_LABELS[sizeKey] || sizeKey} x{qty}) Deposit:</span>

                                <span>₱{lineDeposit.toFixed(2)}</span>

                              </div>

                            );

                          });

                      })}

                      <div className="cost-item deposit">

                        <span>Total Deposit (Refundable - Due Upon Pickup):</span>

                        <span>₱{bundleDeposit.toFixed(2)}</span>

                      </div>

                    </>

                  );

                })()}

                <div className="cost-total">

                  <span>Total Due on Pickup:</span>

                  <span>₱{(() => {

                    const bundleDeposit = selectedItems.reduce((sum, item) => {

                      const selections = cardSizeSelections[item.id || item.item_id] || {};

                      return sum + calculateTotalDepositWithSelections(selections, item);

                    }, 0);

                    return (totalCost + bundleDeposit).toFixed(2);

                  })()}</span>

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

                  <strong>⚠️ Late Return:</strong> Overdue amount follows the selected size rate and is charged per late day.

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

                disabled={!startDate || totalCost <= 0 || addingToCart}

                style={{

                  padding: '12px 24px',

                  backgroundColor: (!startDate || totalCost <= 0 || addingToCart) ? '#ccc' : '#007bff',

                  color: 'white',

                  border: 'none',

                  borderRadius: '8px',

                  cursor: (!startDate || totalCost <= 0 || addingToCart) ? 'not-allowed' : 'pointer',

                  fontSize: '14px',

                  fontWeight: '600'

                }}

              >

                {addingToCart ? 'Adding...' : `Add Bundle to Cart - ₱${(() => {

                  const bundleDeposit = selectedItems.reduce((sum, item) => {

                    const selections = cardSizeSelections[item.id || item.item_id] || {};

                    return sum + calculateTotalDepositWithSelections(selections, item);

                  }, 0);

                  return (totalCost + bundleDeposit).toFixed(2);

                })()}`}

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

                  {(() => {

                    const priceRange = getDisplayPriceRange(selectedItem);

                    const formattedMin = `₱${priceRange.min.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

                    const formattedMax = `₱${priceRange.max.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

                    const priceText = priceRange.min === priceRange.max

                      ? formattedMin

                      : `${formattedMin} - ${formattedMax}`;



                    return (

                      <div>Rental Price: <strong>{priceText}</strong> <span>- cycle-based rental</span></div>

                    );

                  })()}

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

                      </div>

                    </div>

                    <div className="rc-sizes-table">

                        {getAvailableSizeKeys(selectedItem.sizeOptions || {}).map((sizeKey) => {

                        const opt = selectedItem.sizeOptions[sizeKey] || {};

                        const parsedFallbackTotal = parseInt(selectedItem.total_available, 10);

                        // Use real-time availability if available, otherwise fall back to database quantity

                        const realTimeQty = realTimeAvailability[sizeKey];

                        const maxQty = realTimeQty !== undefined 

                          ? realTimeQty

                          : (Number.isFinite(opt.quantity)

                            ? opt.quantity

                            : (Number.isNaN(parsedFallbackTotal) ? 0 : parsedFallbackTotal));

                        const currentQty = parseInt(sizeSelections[sizeKey] || 0, 10);

                        // If current selection exceeds real-time availability, reset it

                        if (realTimeQty !== undefined && currentQty > realTimeQty) {

                          setSizeSelections(prev => ({ ...prev, [sizeKey]: realTimeQty }));

                        }

                        const isExpanded = expandedMeasurementSize === sizeKey;

                        const resolvedMeasurements = resolveMeasurementsForSize(selectedItem, sizeKey, opt);

                        const hasMeasurements = !!resolvedMeasurements;



                        const getMeasVal = (m, keys = []) => {

                          if (!m) return null;

                          const keyList = Array.isArray(keys) ? keys : [keys];

                          const val = keyList.map((k) => m[k]).find(Boolean);

                          if (!val) return null;

                          if (typeof val === 'object') {

                            return measurementUnit === 'inch'

                              ? (val.inch ? `${val.inch} in` : null)

                              : (val.cm ? `${val.cm} cm` : null);

                          }

                          return `${val}`;

                        };



                        const measurementFields = [

                          { label: 'Chest', keys: ['chest'] },

                          { label: 'Shoulders', keys: ['shoulders'] },

                          { label: 'Sleeve Length', keys: ['sleeveLength'] },

                          { label: 'Neck', keys: ['neck'] },

                          { label: 'Waist', keys: ['waist', 'topWaist', 'bottomWaist'] },

                          { label: 'Length', keys: ['length', 'topLength', 'bottomLength'] },

                          { label: 'Hips', keys: ['hips'] },

                          { label: 'Inseam', keys: ['inseam'] },

                          { label: 'Thigh', keys: ['thigh'] },

                          { label: 'Outseam', keys: ['outseam'] }

                        ];

                        const measurementRows = hasMeasurements

                          ? measurementFields.map((field) => {

                              const v = getMeasVal(resolvedMeasurements, field.keys);

                              return v ? { label: field.label, value: v } : null;

                            }).filter(Boolean)

                          : [];



                        return (

                          <div key={sizeKey} className={`rc-size-row ${currentQty > 0 ? 'selected' : ''}`}>

                            <div className="rc-size-row-header" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'stretch' }}>

                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>

                                <span className="rc-size-label">{opt.label || SIZE_LABELS[sizeKey] || sizeKey}</span>

                                {opt.price > 0 && (

                                  <span className="rc-size-price">₱ {parseFloat(opt.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })} / {Math.max(1, Math.min(30, parseInt(opt.rental_duration, 10) || 3))} day{(Math.max(1, Math.min(30, parseInt(opt.rental_duration, 10) || 3)) > 1) ? 's' : ''}</span>

                                )}

                                {(parseFloat(opt.deposit) || 0) > 0 && (

                                  <span className="rc-size-price" style={{ color: '#b94a48' }}>

                                    Deposit: ₱ {parseFloat(opt.deposit).toLocaleString('en-PH', { minimumFractionDigits: 2 })}

                                  </span>

                                )}

                              </div>

                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

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

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

                                    <span style={{ fontSize: '12px', color: '#666', whiteSpace: 'nowrap' }}>Duration:</span>

                                    {(() => {

                                      const baseDuration = Math.max(1, Math.min(30, parseInt(opt.rental_duration, 10) || 3));

                                      const selectedDuration = Math.max(1, Math.min(30, parseInt(sizeDurationSelections[sizeKey], 10) || baseDuration));

                                      return (

                                        <div className="rc-qty-control" style={{ minWidth: '110px' }}>

                                          <button

                                            disabled={selectedDuration <= 1}

                                            onClick={() => setSizeDurationSelections(prev => ({ ...prev, [sizeKey]: Math.max(1, selectedDuration - 1) }))}

                                          >−</button>

                                          <span>{selectedDuration}</span>

                                          <button

                                            disabled={selectedDuration >= 30}

                                            onClick={() => setSizeDurationSelections(prev => ({ ...prev, [sizeKey]: Math.min(30, selectedDuration + 1) }))}

                                          >+</button>

                                        </div>

                                      );

                                    })()}

                                    <span style={{ fontSize: '11px', color: '#888' }}>days</span>

                                  </div>

                                  {realTimeQty !== undefined && (

                                    <span style={{ fontSize: '12px', color: realTimeQty === 0 ? '#d32f2f' : '#666' }}>

                                      {realTimeQty === 0 ? 'Out of stock' : `${realTimeQty} available`}

                                    </span>

                                  )}

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

                              {(() => {

                                const selectedDuration = Math.max(1, Math.min(30, parseInt(sizeDurationSelections[sizeKey] ?? opt.rental_duration, 10) || 3));
                                const sizeEndDate = startDate ? calculateEndDate(startDate, selectedDuration) : '';
                                const sizeLabel = opt.label || SIZE_LABELS[sizeKey] || sizeKey;

                                return (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '12px', color: '#666', whiteSpace: 'nowrap' }}>End Date ({sizeLabel}):</span>
                                    <input
                                      type="date"
                                      value={sizeEndDate}
                                      readOnly
                                      style={{
                                        width: '150px',
                                        padding: '6px 8px',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        color: '#666',
                                        backgroundColor: '#f5f5f5',
                                        fontSize: '13px'
                                      }}
                                    />
                                  </div>
                                );

                              })()}

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

                </div>



                {totalCost > 0 && startDate && (

                  <div className="rc-cost-box">

                    {Object.entries(sizeSelections).filter(([, q]) => parseInt(q, 10) > 0).map(([sizeKey, qty]) => {

                      const opt = selectedItem.sizeOptions?.[sizeKey] || {};

                      const fallback = parseFloat(String(selectedItem.price || '').replace(/[^\d.]/g, '')) || 500;

                      const price = opt.price > 0 ? opt.price : fallback;

                      const lineDuration = Math.max(1, Math.min(30, parseInt(sizeDurationSelections[sizeKey] ?? opt.rental_duration, 10) || 3));

                      const cycleDays = Math.max(1, Math.min(30, parseInt(opt.rental_duration, 10) || 3));
                      const chosenDays = Math.max(1, Math.min(30, parseInt(sizeDurationSelections[sizeKey] ?? cycleDays, 10) || cycleDays));
                      const cycleCount = Math.max(1, Math.ceil(chosenDays / cycleDays));
                      const lineCost = parseInt(qty, 10) * price * cycleCount;

                      const deposit = parseFloat(opt.deposit) || 0;

                      const lineDeposit = parseInt(qty, 10) * deposit;

                      return (

                        <div key={sizeKey} className="rc-cost-line">

                          <span>{opt.label || SIZE_LABELS[sizeKey] || sizeKey} ×{qty} ({lineDuration}d)</span>

                          <span>₱{lineCost.toFixed(2)}</span>

                        </div>

                      );

                    })}

                    <div className="rc-cost-divider" />

                    <div className="rc-cost-line total">

                      <span>Total</span><span>₱{totalCost.toFixed(2)}</span>

                    </div>

                    {modalLiveDeposit > 0 && (

                      <>

                        <div className="rc-cost-divider" />

                        {Object.entries(sizeSelections).filter(([, q]) => parseInt(q, 10) > 0).map(([sizeKey, qty]) => {

                          const opt = selectedItem.sizeOptions?.[sizeKey] || {};

                          const deposit = parseFloat(opt.deposit) || 0;

                          const lineDeposit = parseInt(qty, 10) * deposit;

                          if (lineDeposit <= 0) return null;

                          return (

                            <div key={`dep-${sizeKey}`} className="rc-cost-line deposit">

                              <span>{opt.label || SIZE_LABELS[sizeKey] || sizeKey} ×{qty} Deposit</span>

                              <span>₱{lineDeposit.toFixed(2)}</span>

                            </div>

                          );

                        })}

                        <div className="rc-cost-line deposit">

                          <span>Total Deposit (Refundable, due on pickup)</span><span>₱{modalLiveDeposit.toFixed(2)}</span>

                        </div>

                      </>

                    )}

                    {(totalCost + modalLiveDeposit) > 0 && (

                      <div className="rc-cost-line total-due">

                        <span><strong>Total Due on Pickup</strong></span><span><strong>₱{(totalCost + modalLiveDeposit).toFixed(2)}</strong></span>

                      </div>

                    )}

                    <div className="rc-late-warning">⚠️ Overdue amount depends on selected size rate per late day</div>

                    {Object.entries(sizeSelections).filter(([, q]) => parseInt(q, 10) > 0).length > 0 && (

                      <div className="rc-late-warning" style={{ marginTop: '8px' }}>

                        {Object.entries(sizeSelections)

                          .filter(([, q]) => parseInt(q, 10) > 0)

                          .map(([sizeKey]) => {

                            const opt = selectedItem.sizeOptions?.[sizeKey] || {};

                            const chosenDuration = Math.max(1, Math.min(30, parseInt(sizeDurationSelections[sizeKey] ?? opt.rental_duration, 10) || 3));

                            const overdueAmount = Math.max(0, parseFloat(opt.overdue_amount) || 50);

                            const label = opt.label || SIZE_LABELS[sizeKey] || sizeKey;

                            return `${label}: ₱${overdueAmount.toFixed(2)} / ${chosenDuration} day${chosenDuration > 1 ? 's' : ''}`;

                          })

                          .join(' | ')}

                      </div>

                    )}

                  </div>

                )}



                {cartMessage && (

                  <div className={`rc-cart-msg ${cartMessage.includes('✅') ? 'success' : 'error'}`}>{cartMessage}</div>

                )}



                <div className="rc-modal-actions">

                  <button

                    type="button"

                    className="rc-btn-cancel-rent"

                    onClick={closeModal}

                  >

                    Cancel

                  </button>

                  <button

                    className="rc-btn-rent"

                    onClick={handleAddToCart}

                    disabled={!startDate || modalLiveTotal <= 0 || addingToCart}

                  >

                    {addingToCart ? 'Adding...' : (

                      <>

                        <span className="rc-btn-rent-main">Add to Cart</span>

                        <span className="rc-btn-rent-price">₱{(modalLiveTotal + modalLiveDeposit).toFixed(2)}</span>

                      </>

                    )}

                  </button>

                </div>

              </div>

            </div>

          </div>

        </div>

      )}

    </>

  );

};



export default RentalClothes;




