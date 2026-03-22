
import React, { useState, useEffect } from 'react';
import '../adminStyle/post.css';
import AdminHeader from './AdminHeader';
import Sidebar from './Sidebar';
import { getAllRentals, createRental, updateRental, deleteRental, getRentalImageUrl } from '../api/RentalApi';
import { useAlert } from '../context/AlertContext';

const SIZE_OPTION_KEYS = ['small', 'medium', 'large', 'extra_large'];

const SIZE_LABELS = {
  small: 'Small (S)',
  medium: 'Medium (M)',
  large: 'Large (L)',
  extra_large: 'Extra Large (XL)'
};

const EMPTY_MEASUREMENTS = () => ({
  chest: { inch: '', cm: '' },
  shoulders: { inch: '', cm: '' },
  sleeveLength: { inch: '', cm: '' },
  neck: { inch: '', cm: '' },
  waist: { inch: '', cm: '' },
  length: { inch: '', cm: '' },
  hips: { inch: '', cm: '' },
  inseam: { inch: '', cm: '' },
  thigh: { inch: '', cm: '' },
  outseam: { inch: '', cm: '' }
});

const createDefaultSizeEntry = (sizeKey, extraId = '') => ({
  id: `${sizeKey || 'custom'}_${Date.now()}${extraId}`,
  sizeKey: sizeKey || 'custom',
  customLabel: '',
  quantity: '',
  price: '',
  activeTab: 'top',
  isOpen: false,
  measurements: EMPTY_MEASUREMENTS()
});

const parseSizeEntriesFromPayload = (rawSize) => {
  const defaults = SIZE_OPTION_KEYS.map((k, i) => createDefaultSizeEntry(k, String(i)));
  if (!rawSize) return defaults;
  try {
    const parsed = typeof rawSize === 'string' ? JSON.parse(rawSize) : rawSize;
    if (parsed?.size_entries && Array.isArray(parsed.size_entries) && parsed.size_entries.length > 0) {
      return parsed.size_entries.map((entry, idx) => {
        const measurements = EMPTY_MEASUREMENTS();
        const m = entry.measurements || {};
        Object.keys(measurements).forEach(key => {
          if (m[key]) measurements[key] = { inch: m[key].inch ?? '', cm: m[key].cm ?? '' };
        });
        return {
          id: `entry_${idx}_${Date.now()}`,
          sizeKey: entry.sizeKey || 'custom',
          customLabel: entry.customLabel || '',
          quantity: entry.quantity !== undefined ? String(entry.quantity) : '',
          price: entry.price !== undefined ? String(entry.price) : '',
          activeTab: 'top',
          isOpen: false,
          measurements
        };
      });
    }
    // Old v1 format
    const sizeOpts = parsed?.size_options || parsed?.sizeOptions || {};
    const mp = parsed?.measurement_profile || parsed?.measurementProfile || {};
    const getMeasVal = (src, key) => {
      const val = src?.[key];
      if (!val) return { inch: '', cm: '' };
      if (typeof val === 'object' && (val.inch !== undefined || val.cm !== undefined))
        return { inch: val.inch ?? '', cm: val.cm ?? '' };
      return { inch: String(val), cm: '' };
    };
    return SIZE_OPTION_KEYS.map((key, idx) => {
      const opt = sizeOpts[key] || {};
      const measurements = EMPTY_MEASUREMENTS();
      Object.keys(measurements).forEach(k => { measurements[k] = getMeasVal(mp, k); });
      return {
        id: `${key}_${Date.now() + idx}`,
        sizeKey: key,
        customLabel: '',
        quantity: opt.quantity !== undefined ? String(opt.quantity) : '',
        price: opt.price !== undefined ? String(opt.price) : '',
        activeTab: 'top',
        isOpen: false,
        measurements
      };
    });
  } catch (e) {
    return defaults;
  }
};

const getTotalFromEntries = (entries) =>
  (entries || []).reduce((sum, entry) => {
    const qty = parseInt(entry.quantity, 10);
    return sum + (isNaN(qty) || qty < 0 ? 0 : qty);
  }, 0);

const TOP_MEASUREMENT_FIELDS = [
  { key: 'chest', label: 'Chest' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'sleeveLength', label: 'Sleeve Length' },
  { key: 'neck', label: 'Neck' },
  { key: 'waist', label: 'Waist' },
  { key: 'length', label: 'Length' }
];

const BOTTOM_MEASUREMENT_FIELDS = [
  { key: 'waist', label: 'Waist' },
  { key: 'hips', label: 'Hips' },
  { key: 'inseam', label: 'Inseam' },
  { key: 'length', label: 'Length' },
  { key: 'thigh', label: 'Thigh' },
  { key: 'outseam', label: 'Outseam' }
];

const createDefaultSizeOptions = () => ({
  small: { inch: '', cm: '', quantity: '' },
  medium: { inch: '', cm: '', quantity: '' },
  large: { inch: '', cm: '', quantity: '' },
  extra_large: { inch: '', cm: '', quantity: '' }
});

const parseSizeOptionsFromSizePayload = (rawSize) => {
  const defaults = createDefaultSizeOptions();

  if (!rawSize) {
    return defaults;
  }

  try {
    const parsed = typeof rawSize === 'string' ? JSON.parse(rawSize) : rawSize;
    const source = parsed?.size_options || parsed?.sizeOptions || parsed;

    if (!source || typeof source !== 'object') {
      return defaults;
    }

    const normalized = { ...defaults };
    SIZE_OPTION_KEYS.forEach((key) => {
      const option = source[key];
      if (!option || typeof option !== 'object') {
        return;
      }

      normalized[key] = {
        inch: option.inch ?? '',
        cm: option.cm ?? '',
        quantity: option.quantity ?? ''
      };
    });

    return normalized;
  } catch (e) {
    return defaults;
  }
};

const getTotalAvailableFromSizeOptions = (sizeOptions) => {
  return SIZE_OPTION_KEYS.reduce((total, key) => {
    const qty = parseInt(sizeOptions?.[key]?.quantity, 10);
    return total + (Number.isNaN(qty) || qty < 0 ? 0 : qty);
  }, 0);
};

const ImageCarousel = ({ images, itemName, getRentalImageUrl }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const validImages = images.filter(img => img && img.url);
  
  if (validImages.length === 0) {
    return (
      <div style={{
        width: '100%',
        height: '200px',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#999'
      }}>
        No Image Available
      </div>
    );
  }

  if (validImages.length === 1) {
    return (
      <img 
        src={getRentalImageUrl(validImages[0].url)}
        alt={itemName}
        className="detail-image"
        style={{ maxWidth: '100%', borderRadius: '8px' }}
      />
    );
  }

  const goToPrev = () => setCurrentIndex(prev => (prev === 0 ? validImages.length - 1 : prev - 1));
  const goToNext = () => setCurrentIndex(prev => (prev === validImages.length - 1 ? 0 : prev + 1));

  return (
    <div style={{ width: '100%' }}>
      <div style={{ 
        position: 'relative', 
        backgroundColor: '#f9f9f9',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
          <img 
            src={getRentalImageUrl(validImages[currentIndex].url)}
            alt={`${itemName} - ${validImages[currentIndex].label}`}
            style={{ maxWidth: '100%', maxHeight: '250px', objectFit: 'contain' }}
          />
        </div>
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
          aria-label="Previous image"
          style={{
            position: 'absolute',
            left: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '48px',
            height: '48px',
            border: 'none',
            background: 'transparent',
            color: '#7a7a7a',
            cursor: 'pointer',
            fontSize: '44px',
            fontWeight: 700,
            lineHeight: 1,
            boxShadow: 'none'
          }}
        >{"\u2039"}</button>
        <button
          onClick={goToNext}
          aria-label="Next image"
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '48px',
            height: '48px',
            border: 'none',
            background: 'transparent',
            color: '#7a7a7a',
            cursor: 'pointer',
            fontSize: '44px',
            fontWeight: 700,
            lineHeight: 1,
            boxShadow: 'none'
          }}
        >{"\u203A"}</button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '10px' }}>
        {validImages.map((img, index) => (
          <button key={index} onClick={() => setCurrentIndex(index)} style={{
            width: '50px', height: '50px', padding: 0, borderRadius: '6px', overflow: 'hidden',
            border: index === currentIndex ? '2px solid #007bff' : '2px solid #ddd',
            cursor: 'pointer', opacity: index === currentIndex ? 1 : 0.6, backgroundColor: '#fff'
          }}>
            <img src={getRentalImageUrl(img.url)} alt={img.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </button>
        ))}
      </div>
    </div>
  );
};

const PostRent = () => {
  const { alert, confirm } = useAlert();
  const [items, setItems] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [filter, setFilter] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [imageFile, setImageFile] = useState(null);
  
  const [frontImagePreview, setFrontImagePreview] = useState('');
  const [frontImageFile, setFrontImageFile] = useState(null);
  const [backImagePreview, setBackImagePreview] = useState('');
  const [backImageFile, setBackImageFile] = useState(null);
  const [sideImagePreview, setSideImagePreview] = useState('');
  const [sideImageFile, setSideImageFile] = useState(null);
  const [isSizeSectionOpen, setIsSizeSectionOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    item_name: '',
    description: '',
    brand: '',
    size: '',
    color: '',
    category: 'suit',
    price: '',
    downpayment: '',
    total_available: '1',
    size_entries: SIZE_OPTION_KEYS.map((k, i) => createDefaultSizeEntry(k, String(i))),
    material: '',
    care_instructions: '',
    damage_notes: '',
    status: 'available',
  });

  useEffect(() => {
    loadRentalItems();
  }, []);

  const loadRentalItems = async () => {
    try {
      setIsLoading(true);
      setError('');
      const result = await getAllRentals();
      console.log('Rental items API response:', result); 
      if (result.items && Array.isArray(result.items) && result.items.length > 0) {
        setItems(result.items);
        console.log('Loaded rental items:', result.items.length); 
      } else if (result && Array.isArray(result) && result.length > 0) {
        
        setItems(result);
        console.log('Loaded rental items (array):', result.length); 
      } else {
        console.log('No rental items found in database. Admin should add items via "Add Post +" button.');
        setItems([]);
      }
    } catch (error) {
      console.error('Error loading rental items:', error);
      setError('Error loading rental items: ' + (error.message || 'Unknown error'));
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  const openModal = (id = null) => {
    setError('');
    if (id != null) {
      const item = items.find(i => i.item_id === id);
      if (item) {
        setFormData({
          item_name: item.item_name || '',
          description: item.description || '',
          brand: item.brand || '',
          size: item.size || '',
          color: item.color || '',
          category: item.category || 'suit',
          price: item.price || '',
          downpayment: item.downpayment || '',
          total_available: item.total_available?.toString() || '1',
          size_entries: parseSizeEntriesFromPayload(item.size),
          material: item.material || '',
          care_instructions: item.care_instructions || '',
          damage_notes: item.damage_notes || '',
          status: item.status || 'available',
        });
        setImagePreview(item.image_url ? getRentalImageUrl(item.image_url) : '');
        setFrontImagePreview(item.front_image ? getRentalImageUrl(item.front_image) : '');
        setBackImagePreview(item.back_image ? getRentalImageUrl(item.back_image) : '');
        setSideImagePreview(item.side_image ? getRentalImageUrl(item.side_image) : '');
        setEditingId(id);
      }
    } else {
      setFormData({
        item_name: '',
        description: '',
        brand: '',
        size: '',
        color: '',
        category: 'suit',
        price: '',
        downpayment: '',
        total_available: '1',
        size_entries: SIZE_OPTION_KEYS.map((k, i) => createDefaultSizeEntry(k, String(i))),
        material: '',
        care_instructions: '',
        damage_notes: '',
        status: 'available',
      });
      setImagePreview('');
      setImageFile(null);
      
      setFrontImagePreview('');
      setFrontImageFile(null);
      setBackImagePreview('');
      setBackImageFile(null);
      setSideImagePreview('');
      setSideImageFile(null);
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setImagePreview('');
    setImageFile(null);
    
    setFrontImagePreview('');
    setFrontImageFile(null);
    setBackImagePreview('');
    setBackImageFile(null);
    setSideImagePreview('');
    setSideImageFile(null);
    setError('');
  };

  const handleImageChange = (e, imageType = 'front') => {
    const file = e.target.files?.[0];
    if (file) {
      
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setError('Image size should be less than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        switch (imageType) {
          case 'front':
            setFrontImageFile(file);
            setFrontImagePreview(reader.result);
            break;
          case 'back':
            setBackImageFile(file);
            setBackImagePreview(reader.result);
            break;
          case 'side':
            setSideImageFile(file);
            setSideImagePreview(reader.result);
            break;
          default:
            setImageFile(file);
            setImagePreview(reader.result);
        }
      };
      reader.readAsDataURL(file);
      setError('');
    }
  };

  const inchToCm = (inch) => {
    if (!inch || inch === '') return '';
    const num = parseFloat(inch);
    if (isNaN(num)) return '';
    return (num * 2.54).toFixed(2);
  };

  const cmToInch = (cm) => {
    if (!cm || cm === '') return '';
    const num = parseFloat(cm);
    if (isNaN(num)) return '';
    return (num / 2.54).toFixed(2);
  };

  const handleEntryChange = (entryId, field, value) => {
    setFormData(prev => {
      const nextEntries = prev.size_entries.map(entry =>
        entry.id === entryId ? { ...entry, [field]: value } : entry
      );
      return {
        ...prev,
        size_entries: nextEntries,
        ...(field === 'quantity' ? { total_available: String(getTotalFromEntries(nextEntries)) } : {})
      };
    });
  };

  const handleEntryMeasurementChange = (entryId, measKey, unit, value) => {
    setFormData(prev => ({
      ...prev,
      size_entries: prev.size_entries.map(entry => {
        if (entry.id !== entryId) return entry;
        const current = entry.measurements[measKey] || { inch: '', cm: '' };
        const updated = unit === 'inch'
          ? { inch: value, cm: inchToCm(value) }
          : { cm: value, inch: cmToInch(value) };
        return { ...entry, measurements: { ...entry.measurements, [measKey]: { ...current, ...updated } } };
      })
    }));
  };

  const addEntry = () => {
    const newEntry = { ...createDefaultSizeEntry('custom', `_${Date.now()}`), isOpen: true };
    setFormData(prev => ({ ...prev, size_entries: [...prev.size_entries, newEntry] }));
  };

  const removeEntry = (entryId) => {
    setFormData(prev => {
      const updated = prev.size_entries.filter(e => e.id !== entryId);
      return { ...prev, size_entries: updated, total_available: String(getTotalFromEntries(updated)) };
    });
  };

  const saveItem = async () => {
    setError('');
    setIsLoading(true);

    if (!formData.item_name) {
      setError('Item name is required');
      setIsLoading(false);
      return;
    }

    const sizeEntries = formData.size_entries || [];
    const normalizedEntries = sizeEntries.map(entry => ({
      sizeKey: entry.sizeKey,
      customLabel: entry.customLabel || '',
      quantity: Math.max(0, parseInt(entry.quantity, 10) || 0),
      price: parseFloat(entry.price) || 0,
      measurements: entry.measurements || {}
    }));

    // Build size_options for backward compatibility
    const normalizedSizeOptions = {};
    sizeEntries.forEach(entry => {
      const key = entry.sizeKey !== 'custom' ? entry.sizeKey : null;
      if (key) normalizedSizeOptions[key] = { quantity: Math.max(0, parseInt(entry.quantity, 10) || 0) };
    });

    const totalAvailable = getTotalFromEntries(sizeEntries);
    const firstEntryPrice = normalizedEntries.find(e => e.price > 0)?.price ?? 0;

    if (totalAvailable <= 0) {
      setError('Total available must be greater than 0');
      setIsLoading(false);
      return;
    }

    const dataToSave = {
      ...formData,
      price: firstEntryPrice,
      total_available: totalAvailable,
      size: JSON.stringify({
        format: 'rental_size_v2',
        size_options: normalizedSizeOptions,
        size_entries: normalizedEntries
      })
    };

    try {
      let result;

      const imageFiles = {};
      if (frontImageFile) imageFiles.front_image = frontImageFile;
      if (backImageFile) imageFiles.back_image = backImageFile;
      if (sideImageFile) imageFiles.side_image = sideImageFile;

      const hasNewImages = Object.keys(imageFiles).length > 0;
      
      if (editingId) {
        
        result = await updateRental(editingId, dataToSave, hasNewImages ? imageFiles : null);
      } else {
        
        result = await createRental(dataToSave, hasNewImages ? imageFiles : null);
      }

      if (result.success !== false) {
        
        await loadRentalItems();
        closeModal();
        await alert(editingId ? 'Item updated successfully!' : 'Item posted successfully!', 'Success', 'success');
      } else {
        setError(result.message || 'Error saving item');
      }
    } catch (error) {
      console.error('Error saving item:', error);
      setError('Error saving item. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteItem = async (id) => {
    const confirmed = await confirm('Delete this item permanently?', 'Delete Item', 'warning');
    if (confirmed) {
      try {
        const result = await deleteRental(id);
        if (result.success !== false) {
          setItems(prev => prev.filter(item => item.item_id !== id));
          await alert('Item deleted successfully!', 'Success', 'success');
        } else {
          setError(result.message || 'Error deleting item');
        }
      } catch (error) {
        console.error('Error deleting item:', error);
        setError('Error deleting item. Please try again.');
      }
    }
  };

  const openDetailModal = (item) => {
    setSelectedItem(item);
    setIsDetailModalOpen(true);
  };

  const closeDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedItem(null);
  };

  const filteredItems = filter 
    ? items.filter(i => (i.status || 'available') === filter) 
    : items;

  return (
    <div className="postrent">
      <Sidebar />
      <AdminHeader />

      <div className="content">
        <div className="dashboard-title">
          <h2>Post Rental Items</h2>
          <button className="add-btn" onClick={() => openModal()}>Add Post +</button>
        </div>

        {error && (
          <div className="error-message" style={{ 
            backgroundColor: '#f8d7da', 
            color: '#721c24', 
            padding: '10px', 
            borderRadius: '5px', 
            marginBottom: '20px' 
          }}>
            {error}
          </div>
        )}

        <div className="filter-container">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All Items</option>
            <option value="available">Available</option>
            <option value="rented">Rented</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>

        <div className="items-grid">
          {isLoading ? (
            <p className="empty-message">Loading rental items...</p>
          ) : filteredItems.length === 0 ? (
            <p className="empty-message">
              {items.length === 0 
                ? 'No rental items found in database. Click "Add Post +" to add your first rental item!' 
                : `No items found with status "${filter || 'all'}". ${items.length} total item(s) in database.`}
            </p>
          ) : (
            filteredItems.map(item => (
              <div key={item.item_id} className="compact-item-card" onClick={() => openDetailModal(item)}>
                <img 
                  src={item.front_image ? getRentalImageUrl(item.front_image) : (item.image_url ? getRentalImageUrl(item.image_url) : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE2IiBmaWxsPSIjOTk5Ij5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=')} 
                  alt={item.item_name} 
                  className="compact-item-image" 
                />
                <div className="compact-item-info">
                  <h3>{item.item_name}</h3>
                  <div className="compact-item-price">
                    ₱{parseFloat(item.price || 0).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </div>
                  <span className={`status-badge ${item.status?.toLowerCase()}`}>
                    {item.status || 'available'}
                  </span>
                  <div className="compact-actions">
                    <button className="compact-edit-btn" onClick={(e) => { e.stopPropagation(); openModal(item.item_id); }}>
                      Edit
                    </button>
                    <button className="compact-delete-btn" onClick={(e) => { e.stopPropagation(); deleteItem(item.item_id); }}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="overlay" onClick={(e) => {
          if (e.target.classList.contains('overlay')) {
            closeModal();
          }
        }}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>{editingId ? 'Edit Item' : 'Add New Item'}</h3>
              <button className="close-button" onClick={closeModal}>x</button>
            </div>

            <div className="dialog-body">
              {error && (
                <div className="error-message" style={{ 
                  backgroundColor: '#f8d7da', 
                  color: '#721c24', 
                  padding: '10px', 
                  borderRadius: '5px', 
                  marginBottom: '15px' 
                }}>
                  {error}
                </div>
              )}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '15px', color: '#333', fontSize: '1rem', fontWeight: '600' }}>
                  📸 Upload Images (Front, Back, Side)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                  <div 
                    className="upload-area" 
                    onClick={() => document.getElementById('frontImageInput')?.click()}
                    style={{ 
                      minHeight: '150px', 
                      border: '2px dashed #007bff',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '10px',
                      backgroundColor: frontImagePreview ? 'transparent' : '#f8f9fa',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {frontImagePreview ? (
                      <img src={frontImagePreview} alt="Front Preview" style={{ maxWidth: '100%', maxHeight: '120px', objectFit: 'contain', borderRadius: '6px' }} />
                    ) : (
                      <div style={{ textAlign: 'center' }}>
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#007bff" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="17 8 12 3 7 8"></polyline>
                          <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#666' }}><strong>Front</strong></p>
                      </div>
                    )}
                    <input type="file" id="frontImageInput" accept="image/*" className="hidden-input" onChange={(e) => handleImageChange(e, 'front')} style={{ display: 'none' }} />
                    <span style={{ fontSize: '11px', color: '#007bff', marginTop: '5px', fontWeight: '600' }}>Front View</span>
                  </div>
                  <div 
                    className="upload-area" 
                    onClick={() => document.getElementById('backImageInput')?.click()}
                    style={{ 
                      minHeight: '150px', 
                      border: '2px dashed #28a745',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '10px',
                      backgroundColor: backImagePreview ? 'transparent' : '#f8f9fa',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {backImagePreview ? (
                      <img src={backImagePreview} alt="Back Preview" style={{ maxWidth: '100%', maxHeight: '120px', objectFit: 'contain', borderRadius: '6px' }} />
                    ) : (
                      <div style={{ textAlign: 'center' }}>
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#28a745" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="17 8 12 3 7 8"></polyline>
                          <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#666' }}><strong>Back</strong></p>
                      </div>
                    )}
                    <input type="file" id="backImageInput" accept="image/*" className="hidden-input" onChange={(e) => handleImageChange(e, 'back')} style={{ display: 'none' }} />
                    <span style={{ fontSize: '11px', color: '#28a745', marginTop: '5px', fontWeight: '600' }}>Back View</span>
                  </div>
                  <div 
                    className="upload-area" 
                    onClick={() => document.getElementById('sideImageInput')?.click()}
                    style={{ 
                      minHeight: '150px', 
                      border: '2px dashed #fd7e14',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '10px',
                      backgroundColor: sideImagePreview ? 'transparent' : '#f8f9fa',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {sideImagePreview ? (
                      <img src={sideImagePreview} alt="Side Preview" style={{ maxWidth: '100%', maxHeight: '120px', objectFit: 'contain', borderRadius: '6px' }} />
                    ) : (
                      <div style={{ textAlign: 'center' }}>
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fd7e14" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="17 8 12 3 7 8"></polyline>
                          <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#666' }}><strong>Side</strong></p>
                      </div>
                    )}
                    <input type="file" id="sideImageInput" accept="image/*" className="hidden-input" onChange={(e) => handleImageChange(e, 'side')} style={{ display: 'none' }} />
                    <span style={{ fontSize: '11px', color: '#fd7e14', marginTop: '5px', fontWeight: '600' }}>Side View</span>
                  </div>
                </div>
                <small style={{ display: 'block', textAlign: 'center', color: '#888', marginTop: '10px' }}>
                  Upload up to 3 images (JPG, PNG) - Max 5MB each
                </small>
              </div>

              <div className="form-grid">
                <div className="input-group">
                  <label>Item Name *</label>
                  <input 
                    type="text" 
                    value={formData.item_name} 
                    onChange={(e) => setFormData({ ...formData, item_name: e.target.value })} 
                    placeholder="e.g., Brown Business Suit"
                  />
                </div>
                <div className="input-group">
                  <label>Category</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                    <option value="suit">Suit</option>
                    <option value="tuxedo">Tuxedo</option>
                    <option value="formal_wear">Formal Wear</option>
                    <option value="business">Business</option>
                    <option value="casual">Casual</option>
                    <option value="pants">Pants</option>
                    <option value="trousers">Trousers</option>
                  </select>
                </div>
              </div>
              {/* Combined collapsible Sizes & Measurements section */}
              <div style={{ marginBottom: '20px', border: '1px solid #e0e0e0', borderRadius: '10px', overflow: 'hidden' }}>
                <div
                  onClick={() => setIsSizeSectionOpen(!isSizeSectionOpen)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '14px 16px', backgroundColor: '#f8f9fa', cursor: 'pointer',
                    borderBottom: isSizeSectionOpen ? '1px solid #e0e0e0' : 'none', userSelect: 'none'
                  }}
                >
                  <h4 style={{ margin: 0, color: '#333', fontWeight: '600', fontSize: '1rem' }}>
                    Sizes &amp; Measurements
                  </h4>
                  <span style={{
                    fontSize: '11px', color: '#666', display: 'inline-block',
                    transform: isSizeSectionOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s'
                  }}>▼</span>
                </div>

                {isSizeSectionOpen && (
                  <div style={{ padding: '16px' }}>
                    <p style={{ fontSize: '12px', color: '#666', marginTop: 0, marginBottom: '14px' }}>
                      Set quantity per size. Expand a size row to add its garment measurements.
                    </p>

                    {formData.size_entries.map((entry, idx) => (
                      <div key={entry.id} style={{ marginBottom: '10px', border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }}>
                        {/* Row header */}
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
                          backgroundColor: entry.isOpen ? '#f0f7ff' : (idx % 2 === 0 ? '#fff' : '#fafafa')
                        }}>
                          {entry.sizeKey !== 'custom' ? (
                            <span style={{ minWidth: '130px', fontWeight: '600', color: '#333', fontSize: '13px' }}>
                              {SIZE_LABELS[entry.sizeKey] || entry.sizeKey}
                            </span>
                          ) : (
                            <input
                              type="text"
                              value={entry.customLabel}
                              onChange={(e) => handleEntryChange(entry.id, 'customLabel', e.target.value)}
                              placeholder="Size name (e.g., XL)"
                              style={{ width: '130px', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', color: '#000' }}
                            />
                          )}
                          <label style={{ fontSize: '12px', color: '#555', whiteSpace: 'nowrap' }}>Qty:</label>
                          <input
                            type="number"
                            min="0"
                            value={entry.quantity}
                            onChange={(e) => handleEntryChange(entry.id, 'quantity', e.target.value)}
                            placeholder="0"
                            style={{ width: '70px', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', color: '#000', fontSize: '13px' }}
                          />
                          <label style={{ fontSize: '12px', color: '#555', whiteSpace: 'nowrap' }}>Price:</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={entry.price}
                            onChange={(e) => handleEntryChange(entry.id, 'price', e.target.value)}
                            placeholder="0.00"
                            style={{ width: '90px', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', color: '#000', fontSize: '13px' }}
                          />
                          <button
                            type="button"
                            onClick={() => handleEntryChange(entry.id, 'isOpen', !entry.isOpen)}
                            style={{
                              marginLeft: 'auto', padding: '5px 14px', fontSize: '12px', whiteSpace: 'nowrap',
                              border: `1px solid ${entry.isOpen ? '#0d6efd' : '#aaa'}`, borderRadius: '14px',
                              backgroundColor: entry.isOpen ? '#0d6efd' : '#fff',
                              color: entry.isOpen ? '#fff' : '#555', cursor: 'pointer'
                            }}
                          >
                            {entry.isOpen ? '▲ Hide Measurements' : '▼ Measurements'}
                          </button>
                          {formData.size_entries.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeEntry(entry.id)}
                              style={{ padding: '5px 10px', fontSize: '12px', border: '1px solid #dc3545', borderRadius: '4px', backgroundColor: '#fff', color: '#dc3545', cursor: 'pointer' }}
                            >✕</button>
                          )}
                        </div>

                        {/* Expandable measurement sub-section */}
                        {entry.isOpen && (
                          <div style={{ padding: '14px', borderTop: '1px solid #e0e0e0', backgroundColor: '#fafcff' }}>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                              <button
                                type="button"
                                onClick={() => handleEntryChange(entry.id, 'activeTab', 'top')}
                                style={{
                                  padding: '6px 14px', borderRadius: '16px', fontSize: '12px', cursor: 'pointer', fontWeight: '600',
                                  border: entry.activeTab === 'top' ? '1px solid #0d6efd' : '1px solid #d9d9d9',
                                  backgroundColor: entry.activeTab === 'top' ? '#e7f1ff' : '#fff',
                                  color: entry.activeTab === 'top' ? '#0d6efd' : '#555'
                                }}
                              >Top</button>
                              <button
                                type="button"
                                onClick={() => handleEntryChange(entry.id, 'activeTab', 'bottom')}
                                style={{
                                  padding: '6px 14px', borderRadius: '16px', fontSize: '12px', cursor: 'pointer', fontWeight: '600',
                                  border: entry.activeTab === 'bottom' ? '1px solid #198754' : '1px solid #d9d9d9',
                                  backgroundColor: entry.activeTab === 'bottom' ? '#e8f8ef' : '#fff',
                                  color: entry.activeTab === 'bottom' ? '#198754' : '#555'
                                }}
                              >Bottom</button>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e0e0e0', borderRadius: '6px', overflow: 'hidden' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#f8f9fa' }}>
                                  <th style={{ padding: '9px 12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: '600', color: '#333', fontSize: '12px' }}>Measurement</th>
                                  <th style={{ padding: '9px 12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: '600', color: '#333', fontSize: '12px' }}>Inches</th>
                                  <th style={{ padding: '9px 12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: '600', color: '#333', fontSize: '12px' }}>Centimeters</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(entry.activeTab === 'top' ? TOP_MEASUREMENT_FIELDS : BOTTOM_MEASUREMENT_FIELDS).map((mf, mIdx) => (
                                  <tr key={mf.key} style={{ backgroundColor: mIdx % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', color: '#333', fontWeight: '600', fontSize: '12px' }}>{mf.label}</td>
                                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #f0f0f0' }}>
                                      <input
                                        type="number" step="0.1"
                                        value={entry.measurements[mf.key]?.inch || ''}
                                        onChange={(e) => handleEntryMeasurementChange(entry.id, mf.key, 'inch', e.target.value)}
                                        placeholder="in"
                                        style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', color: '#000', fontSize: '12px' }}
                                      />
                                    </td>
                                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #f0f0f0' }}>
                                      <input
                                        type="number" step="0.1"
                                        value={entry.measurements[mf.key]?.cm || ''}
                                        onChange={(e) => handleEntryMeasurementChange(entry.id, mf.key, 'cm', e.target.value)}
                                        placeholder="cm"
                                        style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', color: '#000', fontSize: '12px' }}
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addEntry}
                      style={{
                        marginTop: '8px', padding: '8px 18px', fontSize: '13px', width: '100%',
                        border: '2px dashed #0d6efd', borderRadius: '8px',
                        backgroundColor: '#f0f7ff', color: '#0d6efd', cursor: 'pointer', fontWeight: '600'
                      }}
                    >+ Add Another Size</button>
                  </div>
                )}
              </div>

              <div className="form-grid">
                <div className="input-group">
                  <label>Color</label>
                  <input 
                    type="text" 
                    value={formData.color} 
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })} 
                    placeholder="e.g., Brown"
                  />
                </div>
                <div className="input-group">
                  <label>Material</label>
                  <input 
                    type="text" 
                    value={formData.material} 
                    onChange={(e) => setFormData({ ...formData, material: e.target.value })} 
                    placeholder="e.g., Wool"
                  />
                </div>
              </div>

              <div className="input-group">
                <label>Status</label>
                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                  <option value="available">Available</option>
                  <option value="rented">Rented</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>

              {formData.status === 'maintenance' && (
                <div className="input-group" style={{ backgroundColor: '#fff3cd', padding: '15px', borderRadius: '8px', border: '1px solid #ffc107' }}>
                  <label style={{ color: '#856404', fontWeight: '600' }}>⚠️ Damage/Maintenance Notes</label>
                  <textarea 
                    rows={3} 
                    value={formData.damage_notes} 
                    onChange={(e) => setFormData({ ...formData, damage_notes: e.target.value })} 
                    placeholder="Describe the damage or reason for maintenance..."
                    style={{ marginTop: '8px' }}
                  />
                </div>
              )}

              <div className="input-group">
                <label>Description</label>
                <textarea 
                  rows={3} 
                  value={formData.description} 
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
                  placeholder="Describe the rental item..."
                />
              </div>

              <div className="input-group">
                <label>Care Instructions</label>
                <textarea 
                  rows={2} 
                  value={formData.care_instructions} 
                  onChange={(e) => setFormData({ ...formData, care_instructions: e.target.value })} 
                  placeholder="Special care instructions..."
                />
              </div>
            </div>

            <div className="dialog-footer">
              <button className="submit-btn" onClick={saveItem} disabled={isLoading}>
                {isLoading ? (editingId ? 'Updating...' : 'Posting...') : (editingId ? 'Update Item' : 'Post Item')}
              </button>
            </div>
          </div>
        </div>
      )}
      {isDetailModalOpen && selectedItem && (
        <div className="overlay" onClick={closeDetailModal}>
          <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="detail-modal-header">
              <h3>{selectedItem.item_name}</h3>
              <button className="close-button" onClick={closeDetailModal}>x</button>
            </div> 
            
            <div className="detail-modal-body">
              <div className="detail-image-section">
                <ImageCarousel 
                  images={[
                    { url: selectedItem.front_image, label: 'Front' },
                    { url: selectedItem.back_image, label: 'Back' },
                    { url: selectedItem.side_image, label: 'Side' },
                    { url: selectedItem.image_url, label: 'Main' }
                  ].filter(img => img.url)}
                  itemName={selectedItem.item_name}
                  getRentalImageUrl={getRentalImageUrl}
                />
              </div>
              
              <div className="detail-info-section">
                <div className="detail-status">
                  <span className={`status-badge ${selectedItem.status?.toLowerCase()}`}>
                    {selectedItem.status || 'available'}
                  </span>
                </div>
                
                <div className="detail-pricing">
                  <h4>Pricing</h4>
                  <div className="price-grid" style={{ gridTemplateColumns: '1fr' }}>
                    <div className="price-item">
                      <label>Price:</label>
                      <span className="price-value">₱{parseFloat(selectedItem.price || 0).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                  </div>
                </div>
                
                {(selectedItem.damage_notes || selectedItem.damaged_by) && (
                  <div className="detail-damage" style={{
                    marginBottom: '20px',
                    padding: '15px',
                    backgroundColor: selectedItem.status === 'maintenance' ? '#fff3cd' : '#e3f2fd',
                    borderRadius: '8px',
                    border: `1px solid ${selectedItem.status === 'maintenance' ? '#ffc107' : '#2196f3'}`,
                    borderLeft: `4px solid ${selectedItem.status === 'maintenance' ? '#ffc107' : '#2196f3'}`
                  }}>
                    <h4 style={{ margin: '0 0 10px 0', color: selectedItem.status === 'maintenance' ? '#856404' : '#1565c0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {selectedItem.status === 'maintenance' ? '⚠️' : '📋'} Damage/Maintenance Notes
                    </h4>
                    {selectedItem.damage_notes && (
                      <p style={{ margin: 0, color: selectedItem.status === 'maintenance' ? '#856404' : '#1565c0', lineHeight: '1.5' }}>
                        {(() => {
                          try {
                            
                            const parsed = JSON.parse(selectedItem.damage_notes);
                            if (typeof parsed === 'object' && parsed !== null) {
                              
                              return Object.values(parsed).join('; ');
                            } else {
                              
                              return selectedItem.damage_notes;
                            }
                          } catch (e) {
                            
                            return selectedItem.damage_notes;
                          }
                        })()}
                      </p>
                    )}
                    {selectedItem.damaged_by && (
                      <div style={{ 
                        marginTop: selectedItem.damage_notes ? '12px' : '0',
                        padding: '10px 12px',
                        backgroundColor: '#ffebee',
                        borderRadius: '6px',
                        border: '1px solid #ef9a9a'
                      }}>
                        <p style={{ 
                          margin: 0, 
                          color: '#c62828', 
                          fontWeight: '600',
                          fontSize: '0.95em',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          👤 Damaged by: <span style={{ fontWeight: '700' }}>{selectedItem.damaged_by}</span>
                        </p>
                      </div>
                    )}
                  </div>
                )}
                
                {selectedItem.description && (
                  <div className="detail-description">
                    <h4>Description</h4>
                    <p>{selectedItem.description}</p>
                  </div>
                )}
                
                {selectedItem.care_instructions && (
                  <div className="detail-care">
                    <h4>Care Instructions</h4>
                    <p>{selectedItem.care_instructions}</p>
                  </div>
                )}
                
                <div className="detail-actions">
                  <button className="detail-edit-btn" onClick={() => { closeDetailModal(); openModal(selectedItem.item_id); }}>
                    Edit Item
                  </button>
                  <button className="detail-delete-btn" onClick={() => { closeDetailModal(); deleteItem(selectedItem.item_id); }}>
                    Delete Item
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostRent;
