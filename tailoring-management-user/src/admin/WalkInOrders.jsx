import React, { useState, useEffect } from 'react';
import '../adminStyle/dryclean.css';
import AdminHeader from './AdminHeader';
import Sidebar from './Sidebar';
import { createWalkInDryCleaningOrder, createWalkInRepairOrder, createWalkInCustomizationOrder, createWalkInRentalOrder, searchWalkInCustomers } from '../api/WalkInOrderApi';
import { getAllDCGarmentTypesAdmin } from '../api/DryCleaningGarmentTypeApi';
import { getAllRepairGarmentTypesAdmin } from '../api/RepairGarmentTypeApi';
import { getAllGarmentTypesAdmin } from '../api/GarmentTypeApi';
import { getAllFabricTypesAdmin } from '../api/FabricTypeApi';
import { getAllRentals, getAvailableRentals, getRentalImageUrl } from '../api/RentalApi';
import { getAllPatterns } from '../api/PatternApi';
import { useAlert } from '../context/AlertContext';

const SIZE_LABELS = {
  small: 'Small (S)',
  medium: 'Medium (M)',
  large: 'Large (L)',
  extra_large: 'Extra Large (XL)'
};

const parseRentalSizeConfig = (rawSize) => {
  const fallback = { sizeOptions: {} };
  if (!rawSize) return fallback;

  try {
    const parsed = typeof rawSize === 'string' ? JSON.parse(rawSize) : rawSize;
    if (!parsed || typeof parsed !== 'object') return fallback;

    if (parsed.format === 'rental_size_v2' && Array.isArray(parsed.size_entries)) {
      const sizeOptions = {};
      parsed.size_entries.forEach((entry, idx) => {
        const key = entry.sizeKey !== 'custom'
          ? entry.sizeKey
          : (entry.customLabel || `Custom ${idx + 1}`);
        const qty = parseInt(entry.quantity, 10);
        const price = parseFloat(entry.price) || 0;
        sizeOptions[key] = {
          quantity: Number.isNaN(qty) ? 0 : Math.max(0, qty),
          price,
          label: entry.label || SIZE_LABELS[key] || entry.customLabel || key
        };
      });
      return { sizeOptions };
    }

    const optionsSource = parsed.size_options || parsed.sizeOptions;
    if (optionsSource && typeof optionsSource === 'object') {
      const sizeOptions = {};
      Object.keys(optionsSource).forEach((key) => {
        const option = optionsSource[key] || {};
        const qty = parseInt(option.quantity, 10);
        sizeOptions[key] = {
          quantity: Number.isNaN(qty) ? 0 : Math.max(0, qty),
          price: parseFloat(option.price) || 0,
          label: option.label || SIZE_LABELS[key] || key
        };
      });
      return { sizeOptions };
    }

    return fallback;
  } catch {
    return fallback;
  }
};

const getAvailableSizeKeys = (sizeOptions = {}) => {
  return Object.keys(sizeOptions).filter((key) => {
    const qty = parseInt(sizeOptions?.[key]?.quantity, 10);
    return Number.isNaN(qty) ? false : qty > 0;
  });
};

const WalkInOrders = () => {
  const { alert } = useAlert();
  const [serviceType, setServiceType] = useState('dry_cleaning');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [customerFirstName, setCustomerFirstName] = useState('');
  const [customerLastName, setCustomerLastName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);

  const [garmentType, setGarmentType] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [preferredPickupDate, setPreferredPickupDate] = useState('');
  const [preferredPickupTime, setPreferredPickupTime] = useState('');
  const [garmentTypes, setGarmentTypes] = useState([]);

  const [repairGarmentType, setRepairGarmentType] = useState('');
  const [damageLevel, setDamageLevel] = useState('');
  const [repairDescription, setRepairDescription] = useState('');
  const [repairPreferredDate, setRepairPreferredDate] = useState('');
  const [repairPreferredTime, setRepairPreferredTime] = useState('');
  const [estimatedRepairPrice, setEstimatedRepairPrice] = useState('');
  const [repairGarmentTypes, setRepairGarmentTypes] = useState([]);

  const [customGarmentType, setCustomGarmentType] = useState('');
  const [fabricType, setFabricType] = useState('');
  const [patternType, setPatternType] = useState('');
  const [customPreferredDate, setCustomPreferredDate] = useState('');
  const [customPreferredTime, setCustomPreferredTime] = useState('');
  const [estimatedCustomPrice, setEstimatedCustomPrice] = useState('');
  const [customGarmentTypes, setCustomGarmentTypes] = useState([]);
  const [fabricTypes, setFabricTypes] = useState([]);
  const [patterns, setPatterns] = useState([]);

  const [topMeasurements, setTopMeasurements] = useState({
    chest: '',
    shoulders: '',
    sleeve_length: '',
    neck: '',
    waist: '',
    length: ''
  });
  const [bottomMeasurements, setBottomMeasurements] = useState({
    waist: '',
    hips: '',
    inseam: '',
    length: '',
    thigh: '',
    outseam: ''
  });
  const [measurementNotes, setMeasurementNotes] = useState('');

  const [referenceImage, setReferenceImage] = useState(null);
  const [referenceImagePreview, setReferenceImagePreview] = useState(null);

  const [selectedRentalItems, setSelectedRentalItems] = useState([]);
  const [rentalSizeSelections, setRentalSizeSelections] = useState({});
  const [rentalDuration, setRentalDuration] = useState(3);
  const [eventDate, setEventDate] = useState('');
  const [damageDeposit, setDamageDeposit] = useState('');
  const [availableRentals, setAvailableRentals] = useState([]);

  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadGarmentTypes();
    loadRepairGarmentTypes();
    loadCustomGarmentTypes();
    loadFabricTypes();
    loadAvailableRentals();
    loadPatterns();
  }, []);

  const loadGarmentTypes = async () => {
    try {
      const result = await getAllDCGarmentTypesAdmin();
      if (result.success) {

        const types = result.data || result.types || result.garments || [];
        setGarmentTypes(types);
      }
    } catch (error) {
      console.error('Error loading garment types:', error);
    }
  };

  const loadRepairGarmentTypes = async () => {
    try {
      const result = await getAllRepairGarmentTypesAdmin();
      if (result.success) {
        const types = result.garments || result.data || [];
        setRepairGarmentTypes(types);
      }
    } catch (error) {
      console.error('Error loading repair garment types:', error);
    }
  };

  const loadCustomGarmentTypes = async () => {
    try {
      const result = await getAllGarmentTypesAdmin();
      if (result.success) {
        const types = result.garments || result.data || [];
        setCustomGarmentTypes(types);
      }
    } catch (error) {
      console.error('Error loading customization garment types:', error);
    }
  };

  const loadFabricTypes = async () => {
    try {
      const result = await getAllFabricTypesAdmin();
      if (result.success) {
        const types = result.fabrics || result.data || [];
        setFabricTypes(types);
      }
    } catch (error) {
      console.error('Error loading fabric types:', error);
    }
  };

  const loadPatterns = async () => {
    try {
      const result = await getAllPatterns();
      if (result.success) {

        const activePatterns = (result.patterns || []).filter(p => p.is_active !== 0);
        setPatterns(activePatterns);
      }
    } catch (error) {
      console.error('Error loading patterns:', error);
    }
  };

  const loadAvailableRentals = async () => {
    try {

      const result = await getAllRentals();
      console.log('All rentals result:', result);

      let items = [];
      if (result.items && Array.isArray(result.items)) {

        items = result.items.filter(item =>
          item.status === 'available' &&
          (item.total_available === null || item.total_available === undefined || item.total_available > 0)
        );
      } else if (Array.isArray(result)) {

        items = result.filter(item =>
          item.status === 'available' &&
          (item.total_available === null || item.total_available === undefined || item.total_available > 0)
        );
      }

      const mappedItems = (items || []).map((item) => {
        const parsedSize = parseRentalSizeConfig(item.size);
        return {
          ...item,
          sizeOptions: parsedSize.sizeOptions || {}
        };
      });

      console.log('Loaded available rental items:', mappedItems.length);
      setAvailableRentals(mappedItems);
    } catch (error) {
      console.error('Error loading available rentals:', error);
      setAvailableRentals([]);
    }
  };

  const handlePhoneChange = async (phone) => {
    setCustomerPhone(phone);
    if (phone.length >= 3) {
      try {
        const result = await searchWalkInCustomers(phone);
        if (result.success && result.customers) {
          setCustomerSearchResults(result.customers);
          setShowCustomerSearch(result.customers.length > 0);
        }
      } catch (error) {
        console.error('Error searching customers:', error);
      }
    } else {
      setShowCustomerSearch(false);
    }
  };

  const selectCustomer = (customer) => {
    const nameParts = (customer.name || '').trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    setCustomerFirstName(firstName);
    setCustomerLastName(lastName);
    setCustomerEmail(customer.email || '');
    setCustomerPhone(customer.phone);
    setShowCustomerSearch(false);
    setCustomerSearchResults([]);
  };

  const calculateDryCleaningPrice = () => {
    if (!garmentType || !quantity) return 0;
    const selectedGarment = garmentTypes.find(gt => gt.garment_name === garmentType);
    const pricePerItem = selectedGarment ? parseFloat(selectedGarment.garment_price || 200) : 200;
    return pricePerItem * parseInt(quantity);
  };

  const calculateRentalPrice = () => {
    if (selectedRentalItems.length === 0 || !rentalDuration) return 0;
    return selectedRentalItems.reduce((total, item) => {
      const basePrice = parseFloat(item.price || 0);
      const durationMultiplier = Math.ceil(parseInt(rentalDuration) / 3);
      const sizeKeys = getAvailableSizeKeys(item.sizeOptions || {});
      const selections = rentalSizeSelections[item.item_id] || {};

      if (sizeKeys.length > 0) {
        const itemTotal = Object.entries(selections).reduce((sum, [sizeKey, qtyRaw]) => {
          const qty = Math.max(0, parseInt(qtyRaw, 10) || 0);
          if (qty <= 0) return sum;
          const sizePrice = parseFloat(item.sizeOptions?.[sizeKey]?.price || 0);
          const effectivePrice = sizePrice > 0 ? sizePrice : basePrice;
          return sum + (qty * effectivePrice * durationMultiplier);
        }, 0);
        return total + itemTotal;
      }

      return total + (basePrice * durationMultiplier);
    }, 0);
  };

  const formatMeasurements = (item) => {
    if (!item || !item.size) return null;

    try {
      let measurements;
      if (typeof item.size === 'string') {
        try {
          measurements = JSON.parse(item.size);
        } catch (e) {
          return null;
        }
      } else {
        measurements = item.size;
      }

      if (!measurements || typeof measurements !== 'object' || Array.isArray(measurements)) {
        return null;
      }

      const measurementRows = Object.entries(measurements)
        .filter(([key, value]) => {
          if (typeof value === 'object' && value !== null) {
            return (value.inch && value.inch !== '' && value.inch !== '0') ||
                   (value.cm && value.cm !== '' && value.cm !== '0');
          }
          return value && value !== '' && value !== '0';
        })
        .map(([key, value]) => {

          let label = key.replace(/([A-Z])/g, ' $1');
          label = label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();

          let displayValue = '';
          if (typeof value === 'object' && value !== null && value.inch !== undefined) {
            displayValue = `${value.inch}" (${value.cm} cm)`;
          } else if (value) {
            const inchValue = String(value);
            const cmValue = (parseFloat(inchValue) * 2.54).toFixed(2);
            displayValue = `${inchValue}" (${cmValue} cm)`;
          }

          return displayValue ? { label, value: displayValue } : null;
        })
        .filter(row => row !== null && row.value);

      return measurementRows.length > 0 ? measurementRows : null;
    } catch (e) {
      console.error('Error formatting measurements:', e);
      return null;
    }
  };

  const getWalkInSizeSummary = (item) => {
    if (!item) return 'N/A';

    const localSelections = rentalSizeSelections[item.item_id] || {};
    const selectedFromState = Object.entries(localSelections)
      .map(([sizeKey, qtyRaw]) => {
        const qty = Math.max(0, parseInt(qtyRaw, 10) || 0);
        if (qty <= 0) return null;
        return {
          label: item.sizeOptions?.[sizeKey]?.label || SIZE_LABELS[sizeKey] || sizeKey,
          quantity: qty
        };
      })
      .filter(Boolean);

    if (selectedFromState.length > 0) {
      return selectedFromState.map((row) => `${row.label} x${row.quantity}`).join(', ');
    }

    const selectedSizes = Array.isArray(item.selected_sizes)
      ? item.selected_sizes
      : (Array.isArray(item.selectedSizes) ? item.selectedSizes : []);

    if (selectedSizes.length > 0) {
      const merged = new Map();
      selectedSizes.forEach((entry) => {
        const key = String(entry?.sizeKey || entry?.size_key || entry?.label || '').trim();
        if (!key) return;
        const label = String(entry?.label || key).trim();
        const qty = Math.max(0, parseInt(entry?.quantity, 10) || 0);
        const prev = merged.get(key);
        if (!prev) {
          merged.set(key, { label, quantity: qty });
        } else {
          merged.set(key, { label: prev.label || label, quantity: prev.quantity + qty });
        }
      });

      const formatted = Array.from(merged.values())
        .filter((row) => row.quantity > 0)
        .map((row) => `${row.label} x${row.quantity}`)
        .join(', ');

      if (formatted) return formatted;
    }

    try {
      const parsed = typeof item.size === 'string' ? JSON.parse(item.size) : item.size;
      if (parsed && Array.isArray(parsed.size_entries)) {
        const available = parsed.size_entries
          .map((entry) => {
            const qty = Math.max(0, parseInt(entry?.quantity, 10) || 0);
            const label = entry?.label || entry?.sizeKey || entry?.size_key;
            if (!label || qty <= 0) return null;
            return `${label} (${qty})`;
          })
          .filter(Boolean)
          .join(', ');
        if (available) return available;
      }
    } catch {
      // Ignore JSON parse failures and fall through to legacy string handling.
    }

    if (typeof item.size === 'string' && item.size.trim() && !item.size.trim().startsWith('{')) {
      return item.size.trim();
    }

    return 'N/A';
  };

  const toggleRentalItemSelection = (item) => {
    setSelectedRentalItems(prev => {
      const isSelected = prev.some(i => i.item_id === item.item_id);
      if (isSelected) {
        setRentalSizeSelections((sizePrev) => {
          const next = { ...sizePrev };
          delete next[item.item_id];
          return next;
        });
        return prev.filter(i => i.item_id !== item.item_id);
      } else {
        return [...prev, item];
      }
    });
  };

  const updateRentalSizeQuantity = (item, sizeKey, delta) => {
    const option = item.sizeOptions?.[sizeKey] || {};
    const maxQty = Math.max(0, parseInt(option.quantity, 10) || 0);

    setRentalSizeSelections((prev) => {
      const itemSelections = { ...(prev[item.item_id] || {}) };
      const currentQty = Math.max(0, parseInt(itemSelections[sizeKey], 10) || 0);
      const nextQty = Math.max(0, Math.min(maxQty, currentQty + delta));

      if (nextQty <= 0) {
        delete itemSelections[sizeKey];
      } else {
        itemSelections[sizeKey] = nextQty;
      }

      const next = { ...prev };
      if (Object.keys(itemSelections).length > 0) {
        next[item.item_id] = itemSelections;
      } else {
        delete next[item.item_id];
      }
      return next;
    });
  };

  const isRentalItemSelected = (item) => {
    return selectedRentalItems.some(i => i.item_id === item.item_id);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!customerFirstName || !customerLastName || !customerPhone) {
      alert('Please enter customer first name, last name, and phone number');
      return;
    }

    if (serviceType === 'dry_cleaning') {
      if (!garmentType || !quantity) {
        alert('Please select garment type and quantity');
        return;
      }
    } else if (serviceType === 'repair') {
      if (!repairGarmentType || !damageLevel || !repairDescription) {
        alert('Please fill in all required repair fields');
        return;
      }
    } else if (serviceType === 'customization') {
      if (!customGarmentType) {
        alert('Please select garment type');
        return;
      }
    } else if (serviceType === 'rental') {
      if (selectedRentalItems.length === 0 || !rentalDuration) {
        alert('Please select at least one rental item and duration');
        return;
      }

      const invalidItems = selectedRentalItems.filter((item) => {
        const sizeKeys = getAvailableSizeKeys(item.sizeOptions || {});
        if (sizeKeys.length === 0) return false;
        const totalQty = Object.values(rentalSizeSelections[item.item_id] || {}).reduce((sum, qtyRaw) => {
          return sum + (Math.max(0, parseInt(qtyRaw, 10) || 0));
        }, 0);
        return totalQty <= 0;
      });

      if (invalidItems.length > 0) {
        alert(`Please select sizes and quantities for: ${invalidItems.map((i) => i.item_name).join(', ')}`);
        return;
      }
    }

    setSubmitting(true);

    try {
      let result;

      if (serviceType === 'dry_cleaning') {
        const pricePerItem = garmentTypes.find(gt => gt.garment_name === garmentType)?.garment_price || 200;
        result = await createWalkInDryCleaningOrder({
          customerName: `${customerFirstName} ${customerLastName}`.trim(),
          customerEmail,
          customerPhone,
          garmentType,
          quantity: parseInt(quantity),
          specialInstructions,
          pricingFactors: {
            pricePerItem: pricePerItem.toString(),
            quantity: quantity.toString()
          },
          notes
        });
      } else if (serviceType === 'repair') {
        result = await createWalkInRepairOrder({
          customerName: `${customerFirstName} ${customerLastName}`.trim(),
          customerEmail,
          customerPhone,
          garmentType: repairGarmentType,
          damageLevel,
          description: repairDescription,
          estimatedPrice: estimatedRepairPrice || '0',
          notes
        });
      } else if (serviceType === 'customization') {

        const structuredMeasurements = {
          top: topMeasurements,
          bottom: bottomMeasurements,
          notes: measurementNotes
        };

        result = await createWalkInCustomizationOrder({
          customerName: `${customerFirstName} ${customerLastName}`.trim(),
          customerEmail,
          customerPhone,
          garmentType: customGarmentType,
          fabricType,
          patternType,
          measurements: structuredMeasurements,
          estimatedPrice: estimatedCustomPrice || '0',
          notes,
          referenceImage: referenceImage
        });
      } else if (serviceType === 'rental') {

        const totalDownpayment = selectedRentalItems.reduce((sum, item) => {
          const sizeKeys = getAvailableSizeKeys(item.sizeOptions || {});
          const qty = sizeKeys.length > 0
            ? Object.values(rentalSizeSelections[item.item_id] || {}).reduce((qSum, qRaw) => qSum + (Math.max(0, parseInt(qRaw, 10) || 0)), 0)
            : 1;
          return sum + (parseFloat(item.downpayment || '0') * Math.max(1, qty));
        }, 0);

        const rentalItemSelections = selectedRentalItems
          .map((item) => {
            const sizeKeys = getAvailableSizeKeys(item.sizeOptions || {});
            const selectedSizes = Object.entries(rentalSizeSelections[item.item_id] || {})
              .map(([sizeKey, qtyRaw]) => {
                const qty = Math.max(0, parseInt(qtyRaw, 10) || 0);
                if (qty <= 0) return null;
                return {
                  sizeKey,
                  label: item.sizeOptions?.[sizeKey]?.label || SIZE_LABELS[sizeKey] || sizeKey,
                  quantity: qty,
                  price: parseFloat(item.sizeOptions?.[sizeKey]?.price || 0)
                };
              })
              .filter(Boolean);

            const quantity = sizeKeys.length > 0
              ? selectedSizes.reduce((qSum, entry) => qSum + entry.quantity, 0)
              : 1;

            return {
              itemId: item.item_id,
              quantity,
              selected_sizes: selectedSizes
            };
          })
          .filter((entry) => entry.quantity > 0);

        result = await createWalkInRentalOrder({
          customerName: `${customerFirstName} ${customerLastName}`.trim(),
          customerEmail,
          customerPhone,
          rentalItemIds: selectedRentalItems.map(item => item.item_id),
          rentalItemSelections,
          rentalDuration: parseInt(rentalDuration),
          eventDate,
          damageDeposit: damageDeposit || totalDownpayment.toString(),
          isBundle: selectedRentalItems.length > 1,
          notes
        });
      }

      if (result.success) {
        alert('Walk-in order created successfully!', 'success');

        setCustomerFirstName('');
        setCustomerLastName('');
        setCustomerEmail('');
        setCustomerPhone('');
        setGarmentType('');
        setQuantity(1);
        setSpecialInstructions('');
        setPreferredPickupDate('');
        setPreferredPickupTime('');
        setSelectedRentalItems([]);
        setRentalSizeSelections({});
        setRentalDuration(3);
        setEventDate('');
        setDamageDeposit('');
        setNotes('');

        setCustomGarmentType('');
        setFabricType('');
        setPatternType('');
        setTopMeasurements({ chest: '', shoulders: '', sleeve_length: '', neck: '', waist: '', length: '' });
        setBottomMeasurements({ waist: '', hips: '', inseam: '', length: '', thigh: '', outseam: '' });
        setMeasurementNotes('');
        setCustomPreferredDate('');
        setCustomPreferredTime('');
        setEstimatedCustomPrice('');
        setReferenceImage(null);
        setReferenceImagePreview(null);

        if (serviceType === 'rental') {
          loadAvailableRentals();
        }
      } else {
        alert(result.message || 'Failed to create walk-in order', 'error');
      }
    } catch (error) {
      console.error('Error creating walk-in order:', error);
      alert('An error occurred while creating the order', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-page walk-in-orders-page">
      <Sidebar />
      <AdminHeader />

      <div className="content">
        <div className="dashboard-title">
          <h2>New Walk-In Order</h2>
        </div>

        <div className="form-container walk-in-form-container">
          {/* Side-by-side layout for Customer Info and Service Selection */}
          <div className="walk-in-form-grid">
            {/* Left Column: Customer Information */}
            <div className="customer-info-section">
              <div className="form-section">
                <h3>Customer Information</h3>

                <div className="form-group">
                  <label>Phone Number *</label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className="form-control"
                    placeholder="Enter phone number"
                    required
                  />
                  {showCustomerSearch && customerSearchResults.length > 0 && (
                    <div className="customer-search-results">
                      {customerSearchResults.map(customer => (
                        <div
                          key={customer.id}
                          className="customer-search-item"
                          onClick={() => selectCustomer(customer)}
                        >
                          <strong>{customer.name}</strong> - {customer.phone}
                          {customer.email && <span> ({customer.email})</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="form-row-compact">
                  <div className="form-group">
                    <label>First Name *</label>
                    <input
                      type="text"
                      value={customerFirstName}
                      onChange={(e) => setCustomerFirstName(e.target.value)}
                      className="form-control"
                      placeholder="First name"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Last Name *</label>
                    <input
                      type="text"
                      value={customerLastName}
                      onChange={(e) => setCustomerLastName(e.target.value)}
                      className="form-control"
                      placeholder="Last name"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="form-control"
                    placeholder="Enter email (optional)"
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Service Selection + Service Details */}
            <div className="service-details-section">
              <div className="form-section">
                <h3>Service Selection & Details</h3>
                <div className="form-group">
                  <label>Service Type *</label>
                  <select
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                    className="form-control"
                  >
                    <option key="dry_cleaning" value="dry_cleaning">Dry Cleaning</option>
                    <option key="repair" value="repair">Repair</option>
                    <option key="customization" value="customization">Customization</option>
                    <option key="rental" value="rental">Rental</option>
                  </select>
                </div>

                {/* Service-specific fields */}
                {serviceType === 'dry_cleaning' && (
                  <div className="service-specific-fields">
                    <div className="form-group">
                      <label>Garment Type *</label>
                      <select
                        value={garmentType}
                        onChange={(e) => setGarmentType(e.target.value)}
                        className="form-control"
                        required
                      >
                        <option value="">Select garment type</option>
                        {garmentTypes.map(gt => (
                          <option key={gt.garment_type_id} value={gt.garment_name}>
                            {gt.garment_name} - ₱{gt.garment_price}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Quantity *</label>
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="form-control"
                        min="1"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Special Instructions</label>
                      <textarea
                        value={specialInstructions}
                        onChange={(e) => setSpecialInstructions(e.target.value)}
                        className="form-control"
                        rows="2"
                        placeholder="Any special instructions..."
                      />
                    </div>

                    <div className="price-display">
                      <strong>Total Price: ₱{calculateDryCleaningPrice().toFixed(2)}</strong>
                    </div>
                  </div>
                )}

                {serviceType === 'repair' && (
                  <div className="service-specific-fields">
                    <div className="form-group">
                      <label>Garment Type *</label>
                      <select
                        value={repairGarmentType}
                        onChange={(e) => setRepairGarmentType(e.target.value)}
                        className="form-control"
                        required
                      >
                        <option value="">Select garment type</option>
                        {repairGarmentTypes.map(gt => (
                          <option key={gt.garment_type_id} value={gt.garment_name}>
                            {gt.garment_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Damage Level *</label>
                      <select
                        value={damageLevel}
                        onChange={(e) => setDamageLevel(e.target.value)}
                        className="form-control"
                        required
                      >
                        <option value="">Select damage level</option>
                        <option key="minor" value="minor">Minor</option>
                        <option key="moderate" value="moderate">Moderate</option>
                        <option key="severe" value="severe">Severe</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Description *</label>
                      <textarea
                        value={repairDescription}
                        onChange={(e) => setRepairDescription(e.target.value)}
                        className="form-control"
                        rows="3"
                        placeholder="Describe the damage and repair needed..."
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Final Price</label>
                      <input
                        type="number"
                        value={estimatedRepairPrice}
                        onChange={(e) => setEstimatedRepairPrice(e.target.value)}
                        className="form-control"
                        min="0"
                        step="0.01"
                        placeholder="Enter final price (optional)"
                      />
                    </div>
                  </div>
                )}

                <div className="form-group" style={{ marginTop: serviceType === 'customization' || serviceType === 'rental' ? '0' : '15px' }}>
                  <label>Order Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="form-control"
                    rows="2"
                    placeholder="Any additional notes..."
                  />
                </div>
              </div>
            </div>
          </div>

          {serviceType === 'customization' && (
            <div className="form-section">
              <h3>Customization Details</h3>

              <div className="form-group">
                <label>Garment Type *</label>
                <select
                  value={customGarmentType}
                  onChange={(e) => setCustomGarmentType(e.target.value)}
                  className="form-control"
                  required
                >
                  <option value="">Select garment type</option>
                  {customGarmentTypes.map(gt => (
                    <option key={gt.garment_type_id} value={gt.garment_name}>
                      {gt.garment_name}
                    </option>
                  ))}
                  <option value="Uniform">👔 Uniform (Price varies)</option>
                </select>
              </div>
              {customGarmentType === 'Uniform' && (
                <div style={{
                  backgroundColor: '#fff3e0',
                  padding: '12px 15px',
                  borderRadius: '8px',
                  marginBottom: '15px',
                  border: '1px solid #ffb74d',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}>
                  <span style={{ fontSize: '24px' }}>👔</span>
                  <div>
                    <strong style={{ color: '#e65100' }}>Uniform Order</strong>
                    <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#666' }}>
                      Price varies by uniform type and complexity. Please collect a reference image from the customer and note any specific requirements.
                    </p>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Fabric Type</label>
                <select
                  value={fabricType}
                  onChange={(e) => setFabricType(e.target.value)}
                  className="form-control"
                  disabled={customGarmentType === 'Uniform'}
                >
                  <option value="">{customGarmentType === 'Uniform' ? 'N/A for Uniform' : 'Select fabric type (optional)'}</option>
                  {fabricTypes.map(ft => (
                    <option key={ft.fabric_type_id} value={ft.fabric_name}>
                      {ft.fabric_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Pattern</label>
                <select
                  value={patternType}
                  onChange={(e) => setPatternType(e.target.value)}
                  className="form-control"
                >
                  <option value="">None (optional)</option>
                  {patterns.map(pt => (
                    <option key={pt.pattern_id} value={pt.pattern_name}>
                      {pt.pattern_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginTop: '15px' }}>
                <label>Reference Image (Optional)</label>
                <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                  Upload a reference image from the customer to help with the customization.
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setReferenceImage(file);
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setReferenceImagePreview(reader.result);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="form-control"
                  style={{ padding: '8px' }}
                />
                {referenceImagePreview && (
                  <div style={{ marginTop: '10px', position: 'relative', display: 'inline-block' }}>
                    <img
                      src={referenceImagePreview}
                      alt="Reference preview"
                      style={{
                        maxWidth: '200px',
                        maxHeight: '200px',
                        borderRadius: '8px',
                        border: '2px solid #8b4513'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setReferenceImage(null);
                        setReferenceImagePreview(null);
                      }}
                      style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '-8px',
                        background: '#dc3545',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold'
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'stretch', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, padding: '15px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #eee' }}>
                  <p style={{ fontWeight: '600', marginBottom: '15px', color: '#333', textAlign: 'center' }}>Top Measurements</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px 10px' }}>
                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label style={{ fontSize: '13px', display: 'block', minHeight: '36px', marginBottom: '5px' }}>Chest (inches)</label>
                      <input type="number" step="0.1" value={topMeasurements.chest} onChange={(e) => setTopMeasurements({ ...topMeasurements, chest: e.target.value })} className="form-control" placeholder="e.g. 40" />
                    </div>
                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label style={{ fontSize: '13px', display: 'block', minHeight: '36px', marginBottom: '5px' }}>Shoulders (inches)</label>
                      <input type="number" step="0.1" value={topMeasurements.shoulders} onChange={(e) => setTopMeasurements({ ...topMeasurements, shoulders: e.target.value })} className="form-control" placeholder="e.g. 18" />
                    </div>
                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label style={{ fontSize: '13px', display: 'block', minHeight: '36px', marginBottom: '5px' }}>Sleeve Length (inches)</label>
                      <input type="number" step="0.1" value={topMeasurements.sleeve_length} onChange={(e) => setTopMeasurements({ ...topMeasurements, sleeve_length: e.target.value })} className="form-control" placeholder="e.g. 25" />
                    </div>
                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label style={{ fontSize: '13px', display: 'block', minHeight: '36px', marginBottom: '5px' }}>Neck (inches)</label>
                      <input type="number" step="0.1" value={topMeasurements.neck} onChange={(e) => setTopMeasurements({ ...topMeasurements, neck: e.target.value })} className="form-control" placeholder="e.g. 16" />
                    </div>
                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label style={{ fontSize: '13px', display: 'block', minHeight: '36px', marginBottom: '5px' }}>Waist (inches)</label>
                      <input type="number" step="0.1" value={topMeasurements.waist} onChange={(e) => setTopMeasurements({ ...topMeasurements, waist: e.target.value })} className="form-control" placeholder="e.g. 34" />
                    </div>
                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label style={{ fontSize: '13px', display: 'block', minHeight: '36px', marginBottom: '5px' }}>Length (inches)</label>
                      <input type="number" step="0.1" value={topMeasurements.length} onChange={(e) => setTopMeasurements({ ...topMeasurements, length: e.target.value })} className="form-control" placeholder="e.g. 28" />
                    </div>
                  </div>
                </div>
                <div style={{ flex: 1, padding: '15px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #eee' }}>
                  <p style={{ fontWeight: '600', marginBottom: '15px', color: '#333', textAlign: 'center' }}>Bottom Measurements</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px 10px' }}>
                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label style={{ fontSize: '13px', display: 'block', minHeight: '36px', marginBottom: '5px' }}>Waist (inches)</label>
                      <input type="number" step="0.1" value={bottomMeasurements.waist} onChange={(e) => setBottomMeasurements({ ...bottomMeasurements, waist: e.target.value })} className="form-control" placeholder="e.g. 32" />
                    </div>
                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label style={{ fontSize: '13px', display: 'block', minHeight: '36px', marginBottom: '5px' }}>Hips (inches)</label>
                      <input type="number" step="0.1" value={bottomMeasurements.hips} onChange={(e) => setBottomMeasurements({ ...bottomMeasurements, hips: e.target.value })} className="form-control" placeholder="e.g. 40" />
                    </div>
                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label style={{ fontSize: '13px', display: 'block', minHeight: '36px', marginBottom: '5px' }}>Inseam (inches)</label>
                      <input type="number" step="0.1" value={bottomMeasurements.inseam} onChange={(e) => setBottomMeasurements({ ...bottomMeasurements, inseam: e.target.value })} className="form-control" placeholder="e.g. 30" />
                    </div>
                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label style={{ fontSize: '13px', display: 'block', minHeight: '36px', marginBottom: '5px' }}>Length (inches)</label>
                      <input type="number" step="0.1" value={bottomMeasurements.length} onChange={(e) => setBottomMeasurements({ ...bottomMeasurements, length: e.target.value })} className="form-control" placeholder="e.g. 42" />
                    </div>
                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label style={{ fontSize: '13px', display: 'block', minHeight: '36px', marginBottom: '5px' }}>Thigh (inches)</label>
                      <input type="number" step="0.1" value={bottomMeasurements.thigh} onChange={(e) => setBottomMeasurements({ ...bottomMeasurements, thigh: e.target.value })} className="form-control" placeholder="e.g. 24" />
                    </div>
                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label style={{ fontSize: '13px', display: 'block', minHeight: '36px', marginBottom: '5px' }}>Outseam (inches)</label>
                      <input type="number" step="0.1" value={bottomMeasurements.outseam} onChange={(e) => setBottomMeasurements({ ...bottomMeasurements, outseam: e.target.value })} className="form-control" placeholder="e.g. 44" />
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: '15px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500' }}>Measurement Notes</label>
                <textarea
                  value={measurementNotes}
                  onChange={(e) => setMeasurementNotes(e.target.value)}
                  className="form-control"
                  rows="2"
                  placeholder="Any additional notes about measurements..."
                />
              </div>

              <div className="form-group">
                <label>Final Price</label>
                <input
                  type="number"
                  value={estimatedCustomPrice}
                  onChange={(e) => setEstimatedCustomPrice(e.target.value)}
                  className="form-control"
                  min="0"
                  step="0.01"
                  placeholder="Enter final price (optional)"
                />
              </div>
            </div>
          )}

          {serviceType === 'rental' && (
            <div className="form-section">
              <h3>Rental Details</h3>

              <div className="form-group">
                <label>Select Rental Item *</label>
                {availableRentals.length === 0 ? (
                  <div style={{
                    padding: '40px',
                    textAlign: 'center',
                    color: '#888',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '8px'
                  }}>
                    No available rental items found. Please add items in Post Rent first.
                  </div>
                ) : (
                  <div className="rental-items-grid">
                    {availableRentals.map(item => {
                      const isSelected = isRentalItemSelected(item);
                      const imageUrl = item.front_image
                        ? getRentalImageUrl(item.front_image)
                        : (item.image_url ? getRentalImageUrl(item.image_url) : null);
                      const measurements = formatMeasurements(item);

                      return (
                        <div
                          key={item.item_id}
                          className={`rental-item-card ${isSelected ? 'selected' : ''}`}
                          onClick={() => toggleRentalItemSelection(item)}
                        >
                          <div className="rental-item-image-container">
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={item.item_name}
                                className="rental-item-image"
                              />
                            ) : (
                              <div className="rental-item-placeholder">
                                No Image
                              </div>
                            )}
                            {isSelected && (
                              <div className="rental-item-selected-badge">
                                ✓ Selected
                              </div>
                            )}
                          </div>
                          <div className="rental-item-card-info">
                            <h4 className="rental-item-name">{item.item_name}</h4>
                            {measurements && measurements.length > 0 && (
                              <div className="rental-item-measurements">
                                {measurements.slice(0, 3).map((m, idx) => (
                                  <span key={idx} className="measurement-tag">
                                    {m.label}: {m.value}
                                  </span>
                                ))}
                                {measurements.length > 3 && (
                                  <span className="measurement-tag">
                                    +{measurements.length - 3} more
                                  </span>
                                )}
                              </div>
                            )}
                            <p className="rental-item-price">
                              ₱{parseFloat(item.price || 0).toLocaleString('en-PH', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })} per 3 days
                            </p>
                            {item.category && (
                              <span className="rental-item-category">{item.category}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedRentalItems.length > 0 && (
                <div className="selected-rental-details">
                  <h4>Selected Items ({selectedRentalItems.length}):</h4>
                  <div className="selected-items-list">
                    {selectedRentalItems.map((item, idx) => {
                      const measurements = formatMeasurements(item);
                      const sizeKeys = getAvailableSizeKeys(item.sizeOptions || {});
                      return (
                        <div key={item.item_id} className="selected-item-detail">
                          <div className="selected-item-header">
                            <strong>{item.item_name}</strong>
                            <button
                              type="button"
                              className="remove-item-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRentalItemSelection(item);
                              }}
                            >
                              × Remove
                            </button>
                          </div>
                          <p><strong>Order Details:</strong> {item.item_name || 'Rental Item'} ({getWalkInSizeSummary(item)})</p>
                          <p><strong>Selected Sizes:</strong> {getWalkInSizeSummary(item)}</p>
                          {item.category && <p><strong>Category:</strong> {item.category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>}
                          {sizeKeys.length > 0 && (
                            <div className="walkin-size-editor">
                              <strong>Sizes and Quantity:</strong>
                              <div className="walkin-size-grid">
                                {sizeKeys.map((sizeKey) => {
                                  const opt = item.sizeOptions?.[sizeKey] || {};
                                  const currentQty = Math.max(0, parseInt(rentalSizeSelections[item.item_id]?.[sizeKey], 10) || 0);
                                  const maxQty = Math.max(0, parseInt(opt.quantity, 10) || 0);
                                  return (
                                    <div key={`${item.item_id}-${sizeKey}`} className={`walkin-size-row ${currentQty > 0 ? 'active' : ''}`}>
                                      <div className="walkin-size-label-wrap">
                                        <span className="walkin-size-key">{(opt.label || SIZE_LABELS[sizeKey] || sizeKey).charAt(0).toUpperCase()}</span>
                                        <span className="walkin-size-label">{opt.label || SIZE_LABELS[sizeKey] || sizeKey}</span>
                                      </div>
                                      <div className="walkin-size-qty-control">
                                        <button
                                          type="button"
                                          onClick={() => updateRentalSizeQuantity(item, sizeKey, -1)}
                                          disabled={currentQty <= 0}
                                        >
                                          -
                                        </button>
                                        <span>{currentQty}</span>
                                        <button
                                          type="button"
                                          onClick={() => updateRentalSizeQuantity(item, sizeKey, 1)}
                                          disabled={currentQty >= maxQty}
                                        >
                                          +
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {measurements && measurements.length > 0 && (
                            <div className="measurements-display">
                              <strong>Measurements:</strong>
                              <div className="measurements-grid">
                                {measurements.map((m, mIdx) => (
                                  <div key={mIdx} className="measurement-item">
                                    <span className="measurement-label">{m.label}:</span>
                                    <span className="measurement-value">{m.value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {item.description && (
                            <p><strong>Description:</strong> {item.description}</p>
                          )}
                          {item.material && (
                            <p><strong>Material:</strong> {item.material}</p>
                          )}
                          <p><strong>Price:</strong> ₱{parseFloat(item.price || 0).toLocaleString('en-PH', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })} per 3 days</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Rental Duration (days) *</label>
                <input
                  type="number"
                  value={rentalDuration}
                  onChange={(e) => setRentalDuration(e.target.value)}
                  className="form-control"
                  min="3"
                  step="3"
                  required
                />
                <small>Must be a multiple of 3 days</small>
              </div>

              <div className="form-group">
                <label>Event Date</label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="form-control"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className="price-display">
                <strong>Total Price: ₱{calculateRentalPrice().toFixed(2)}</strong>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="form-actions">
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={submitting}
              className="btn btn-primary"
            >
              {submitting ? 'Creating Order...' : 'Create Walk-In Order'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .walk-in-orders-page .content {
          max-width: 1200px;
        }
        .walk-in-form-container {
          max-width: 100% !important;
        }
        .walk-in-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 25px;
          margin-bottom: 25px;
        }
        @media (max-width: 900px) {
          .walk-in-form-grid {
            grid-template-columns: 1fr;
          }
        }
        .customer-info-section,
        .service-details-section {
          background: #fff;
          border-radius: 8px;
        }
        .customer-info-section .form-section,
        .service-details-section .form-section {
          margin-bottom: 0;
          padding-bottom: 0;
          border-bottom: none;
        }
        .form-row-compact {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .form-row-compact .form-group {
          margin-bottom: 15px;
        }
        .form-container {
          background: white;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .form-section {
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 1px solid #eee;
        }
        .form-section h3 {
          margin-bottom: 20px;
          color: #5D4037;
        }
        .form-group {
          margin-bottom: 20px;
        }
        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
        }
        .form-control {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }
        .customer-search-results {
          margin-top: 5px;
          border: 1px solid #ddd;
          border-radius: 4px;
          max-height: 200px;
          overflow-y: auto;
        }
        .customer-search-item {
          padding: 10px;
          cursor: pointer;
          border-bottom: 1px solid #eee;
        }
        .customer-search-item:hover {
          background: #f5f5f5;
        }
        .price-display {
          padding: 15px;
          background: #f9f9f9;
          border-radius: 4px;
          margin-top: 15px;
          font-size: 18px;
        }
        .rental-item-preview {
          padding: 15px;
          background: #f9f9f9;
          border-radius: 4px;
          margin-bottom: 15px;
        }
        .form-actions {
          margin-top: 30px;
          text-align: right;
        }
        .btn {
          padding: 12px 30px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
        }
        .btn-primary {
          background: #5D4037;
          color: white;
        }
        .btn-primary:hover:not(:disabled) {
          background: #4a3329;
        }
        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .rental-items-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 20px;
          margin-top: 15px;
        }
        .rental-item-card {
          background-color: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          transition: all 0.3s ease;
          cursor: pointer;
          border: 2px solid transparent;
        }
        .rental-item-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          border-color: #8B4513;
        }
        .rental-item-card.selected {
          border-color: #8B4513;
          box-shadow: 0 4px 16px rgba(139, 69, 19, 0.3);
        }
        .rental-item-image-container {
          position: relative;
          width: 100%;
          height: 180px;
          background-color: #f8f9fa;
          overflow: hidden;
        }
        .rental-item-image {
          width: 100%;
          height: 100%;
          object-fit: contain;
          background-color: #f8f9fa;
        }
        .rental-item-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #999;
          font-size: 14px;
          background-color: #f5f5f5;
        }
        .rental-item-selected-badge {
          position: absolute;
          top: 8px;
          right: 8px;
          background-color: #8B4513;
          color: white;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
        }
        .rental-item-card-info {
          padding: 12px;
        }
        .rental-item-name {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 8px 0;
          color: #2D3436;
        }
        .rental-item-brand {
          font-size: 13px;
          color: #636E72;
          margin: 4px 0;
        }
        .rental-item-size {
          font-size: 12px;
          color: #636E72;
          margin: 4px 0;
        }
        .rental-item-price {
          font-size: 14px;
          font-weight: 600;
          color: #8B4513;
          margin: 8px 0 4px 0;
        }
        .rental-item-category {
          display: inline-block;
          font-size: 11px;
          padding: 2px 8px;
          background-color: #f0f0f0;
          border-radius: 4px;
          color: #636E72;
          margin-top: 4px;
        }
        .selected-rental-details {
          margin-top: 20px;
          padding: 15px;
          background-color: #f9f9f9;
          border-radius: 8px;
          border-left: 4px solid #8B4513;
        }
        .selected-rental-details h4 {
          margin: 0 0 10px 0;
          color: #8B4513;
        }
        .selected-rental-details p {
          margin: 5px 0;
          color: #555;
        }
        .selected-items-list {
          margin-top: 15px;
        }
        .selected-item-detail {
          background-color: white;
          border: 1px solid #ddd;
          border-radius: 6px;
          padding: 15px;
          margin-bottom: 15px;
        }
        .selected-item-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          padding-bottom: 10px;
          border-bottom: 1px solid #eee;
        }
        .remove-item-btn {
          background-color: #dc3545;
          color: white;
          border: none;
          padding: 4px 10px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }
        .remove-item-btn:hover {
          background-color: #c82333;
        }
        .measurements-display {
          margin-top: 10px;
        }
        .measurements-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 8px;
          margin-top: 8px;
          padding: 10px;
          background-color: #f9f9f9;
          border-radius: 4px;
        }
        .measurement-item {
          display: flex;
          flex-direction: column;
        }
        .measurement-label {
          font-size: 11px;
          color: #666;
          font-weight: 500;
        }
        .measurement-value {
          font-size: 13px;
          color: #333;
          font-weight: 600;
        }
        .walkin-size-editor {
          margin-top: 10px;
          margin-bottom: 10px;
        }
        .walkin-size-grid {
          margin-top: 8px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .walkin-size-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 10px;
          border: 1px solid #e4dfd8;
          border-radius: 10px;
          background: #f7f4f1;
        }
        .walkin-size-row.active {
          border-color: #c9824c;
          background: #efe6dc;
        }
        .walkin-size-label-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .walkin-size-key {
          width: 30px;
          height: 30px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: #8b5e34;
          color: #fff;
          font-weight: 700;
          font-size: 12px;
          flex-shrink: 0;
        }
        .walkin-size-label {
          font-size: 13px;
          font-weight: 600;
          color: #4b3b2e;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .walkin-size-qty-control {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #d6cec3;
          border-radius: 999px;
          padding: 2px 6px;
          background: #fff;
        }
        .walkin-size-qty-control button {
          width: 26px;
          height: 26px;
          border: none;
          border-radius: 999px;
          background: transparent;
          color: #7a4317;
          font-size: 16px;
          cursor: pointer;
        }
        .walkin-size-qty-control button:disabled {
          color: #b9aea2;
          cursor: not-allowed;
        }
        .walkin-size-qty-control span {
          min-width: 16px;
          text-align: center;
          font-weight: 700;
          color: #0f172a;
        }
        .rental-item-measurements {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin: 8px 0;
        }
        .measurement-tag {
          font-size: 10px;
          padding: 2px 6px;
          background-color: #e9ecef;
          border-radius: 3px;
          color: #495057;
        }
      `}</style>
    </div>
  );
};

export default WalkInOrders;

