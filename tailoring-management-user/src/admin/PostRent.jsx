
import React, { useState, useEffect } from 'react';
import '../adminStyle/post.css';
import AdminHeader from './AdminHeader';
import Sidebar from './Sidebar';
import { getAllRentals, createRental, updateRental, deleteRental, getRentalImageUrl } from '../api/RentalApi';
import { useAlert } from '../context/AlertContext';

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
        <button onClick={goToPrev} style={{
          position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)',
          width: '32px', height: '32px', borderRadius: '50%', border: 'none',
          backgroundColor: 'rgba(255,255,255,0.9)', color: '#333', cursor: 'pointer',
          fontSize: '16px', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}>{"\u2039"}</button>
        <button onClick={goToNext} style={{
          position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
          width: '32px', height: '32px', borderRadius: '50%', border: 'none',
          backgroundColor: 'rgba(255,255,255,0.9)', color: '#333', cursor: 'pointer',
          fontSize: '16px', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}>{"\u203A"}</button>
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
    material: '',
    care_instructions: '',
    damage_notes: '',
    status: 'available',
    measurements: {
      
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
    }
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
        
        let measurements = {
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
        };
        if (item.size) {
          try {
            const parsed = typeof item.size === 'string' ? JSON.parse(item.size) : item.size;
            if (parsed && typeof parsed === 'object') {
              
              Object.keys(measurements).forEach(key => {
                if (parsed[key]) {
                  if (typeof parsed[key] === 'object' && (parsed[key].inch !== undefined || parsed[key].cm !== undefined)) {
                    
                    measurements[key] = {
                      inch: parsed[key].inch || '',
                      cm: parsed[key].cm || ''
                    };
                  } else if (typeof parsed[key] === 'string' || typeof parsed[key] === 'number') {
                    
                    const inchValue = String(parsed[key]);
                    const cmValue = inchValue ? (parseFloat(inchValue) * 2.54).toFixed(2) : '';
                    measurements[key] = {
                      inch: inchValue,
                      cm: cmValue
                    };
                  }
                }
              });
            }
          } catch (e) {
            
          }
        }

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
          material: item.material || '',
          care_instructions: item.care_instructions || '',
          damage_notes: item.damage_notes || '',
          status: item.status || 'available',
          measurements: measurements
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
        material: '',
        care_instructions: '',
        damage_notes: '',
        status: 'available',
        measurements: {
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
        }
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

  const isTopCategory = (category) => {
    return ['suit', 'tuxedo', 'formal_wear', 'business'].includes(category);
  };

  const isBottomCategory = (category) => {
    return ['casual', 'pants', 'trousers'].includes(category);
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

  const handleMeasurementChange = (field, unit, value) => {
    const currentMeasurement = formData.measurements[field] || { inch: '', cm: '' };
    let updatedMeasurement = { ...currentMeasurement };
    
    if (unit === 'inch') {
      updatedMeasurement.inch = value;
      updatedMeasurement.cm = inchToCm(value);
    } else if (unit === 'cm') {
      updatedMeasurement.cm = value;
      updatedMeasurement.inch = cmToInch(value);
    }
    
    setFormData({
      ...formData,
      measurements: {
        ...formData.measurements,
        [field]: updatedMeasurement
      }
    });
  };

  const saveItem = async () => {
    setError('');
    setIsLoading(true);

    if (!formData.item_name || !formData.price) {
      setError('Item name and price are required');
      setIsLoading(false);
      return;
    }

    const measurementsToSave = {};
    if (isTopCategory(formData.category)) {
      measurementsToSave.chest = formData.measurements.chest || { inch: '', cm: '' };
      measurementsToSave.shoulders = formData.measurements.shoulders || { inch: '', cm: '' };
      measurementsToSave.sleeveLength = formData.measurements.sleeveLength || { inch: '', cm: '' };
      measurementsToSave.neck = formData.measurements.neck || { inch: '', cm: '' };
      measurementsToSave.waist = formData.measurements.waist || { inch: '', cm: '' };
      measurementsToSave.length = formData.measurements.length || { inch: '', cm: '' };
    } else if (isBottomCategory(formData.category)) {
      measurementsToSave.waist = formData.measurements.waist || { inch: '', cm: '' };
      measurementsToSave.hips = formData.measurements.hips || { inch: '', cm: '' };
      measurementsToSave.inseam = formData.measurements.inseam || { inch: '', cm: '' };
      measurementsToSave.length = formData.measurements.length || { inch: '', cm: '' };
      measurementsToSave.thigh = formData.measurements.thigh || { inch: '', cm: '' };
      measurementsToSave.outseam = formData.measurements.outseam || { inch: '', cm: '' };
    }

    const dataToSave = {
      ...formData,
      size: JSON.stringify(measurementsToSave)
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
              <button className="close-button" onClick={closeModal}>├ù</button>
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
              {isTopCategory(formData.category) && (
                <div className="measurements-section" style={{ marginBottom: '20px' }}>
                  <h4 style={{ marginBottom: '15px', color: '#333', fontSize: '1.1rem', fontWeight: '600' }}>Top Measurements</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa' }}>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: '600', color: '#fff' }}>Measurement</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: '600', color: '#fff' }}>Inches</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: '600', color: '#fff' }}>Centimeters</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0', color: '#000' }}><strong style={{ color: '#000' }}>Chest</strong></td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0' }}>
                          <input 
                            type="number" 
                            step="0.1"
                            value={formData.measurements.chest?.inch || ''} 
                            onChange={(e) => handleMeasurementChange('chest', 'inch', e.target.value)} 
                            placeholder="Inches"
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', color: '#000' }}
                          />
                        </td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0' }}>
                          <input 
                            type="number" 
                            step="0.1"
                            value={formData.measurements.chest?.cm || ''} 
                            onChange={(e) => handleMeasurementChange('chest', 'cm', e.target.value)} 
                            placeholder="Centimeters"
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', color: '#000' }}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0', color: '#000' }}><strong style={{ color: '#000' }}>Shoulders</strong></td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0' }}>
                          <input 
                            type="number" 
                            step="0.1"
                            value={formData.measurements.shoulders?.inch || ''} 
                            onChange={(e) => handleMeasurementChange('shoulders', 'inch', e.target.value)} 
                            placeholder="Inches"
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', color: '#000' }}
                          />
                        </td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0' }}>
                          <input 
                            type="number" 
                            step="0.1"
                            value={formData.measurements.shoulders?.cm || ''} 
                            onChange={(e) => handleMeasurementChange('shoulders', 'cm', e.target.value)} 
                            placeholder="Centimeters"
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', color: '#000' }}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0', color: '#000' }}><strong style={{ color: '#000' }}>Sleeve Length</strong></td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0' }}>
                          <input 
                            type="number" 
                            step="0.1"
                            value={formData.measurements.sleeveLength?.inch || ''} 
                            onChange={(e) => handleMeasurementChange('sleeveLength', 'inch', e.target.value)} 
                            placeholder="Inches"
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', color: '#000' }}
                          />
                        </td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0' }}>
                          <input 
                            type="number" 
                            step="0.1"
                            value={formData.measurements.sleeveLength?.cm || ''} 
                            onChange={(e) => handleMeasurementChange('sleeveLength', 'cm', e.target.value)} 
                            placeholder="Centimeters"
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', color: '#000' }}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0', color: '#000' }}><strong style={{ color: '#000' }}>Neck</strong></td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0' }}>
                          <input 
                            type="number" 
                            step="0.1"
                            value={formData.measurements.neck?.inch || ''} 
                            onChange={(e) => handleMeasurementChange('neck', 'inch', e.target.value)} 
                            placeholder="Inches"
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', color: '#000' }}
                          />
                        </td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0' }}>
                          <input 
                            type="number" 
                            step="0.1"
                            value={formData.measurements.neck?.cm || ''} 
                            onChange={(e) => handleMeasurementChange('neck', 'cm', e.target.value)} 
                            placeholder="Centimeters"
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', color: '#000' }}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0', color: '#000' }}><strong style={{ color: '#000' }}>Waist</strong></td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0' }}>
                          <input 
                            type="number" 
                            step="0.1"
                            value={formData.measurements.waist?.inch || ''} 
                            onChange={(e) => handleMeasurementChange('waist', 'inch', e.target.value)} 
                            placeholder="Inches"
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', color: '#000' }}
                          />
                        </td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0' }}>
                          <input 
                            type="number" 
                            step="0.1"
                            value={formData.measurements.waist?.cm || ''} 
                            onChange={(e) => handleMeasurementChange('waist', 'cm', e.target.value)} 
                            placeholder="Centimeters"
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', color: '#000' }}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '12px', color: '#000' }}><strong style={{ color: '#000' }}>Length</strong></td>
                        <td style={{ padding: '12px' }}>
                          <input 
                            type="number" 
                            step="0.1"
                            value={formData.measurements.length?.inch || ''} 
                            onChange={(e) => handleMeasurementChange('length', 'inch', e.target.value)} 
                            placeholder="Inches"
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', color: '#000' }}
                          />
                        </td>
                        <td style={{ padding: '12px' }}>
                          <input 
                            type="number" 
                            step="0.1"
                            value={formData.measurements.length?.cm || ''} 
                            onChange={(e) => handleMeasurementChange('length', 'cm', e.target.value)} 
                            placeholder="Centimeters"
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', color: '#000' }}
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {isBottomCategory(formData.category) && (
                <div className="measurements-section" style={{ marginBottom: '20px' }}>
                  <h4 style={{ marginBottom: '15px', color: '#333', fontSize: '1.1rem', fontWeight: '600' }}>Bottom Measurements</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa' }}>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: '600', color: '#fff' }}>Measurement</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: '600', color: '#fff' }}>Inches</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: '600', color: '#fff' }}>Centimeters</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0', color: '#000' }}><strong style={{ color: '#000' }}>Waist</strong></td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0' }}>
                          <input 
                            type="number" 
                            step="0.1"
                            value={formData.measurements.waist?.inch || ''} 
                            onChange={(e) => handleMeasurementChange('waist', 'inch', e.target.value)} 
                            placeholder="Inches"
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', color: '#000' }}
                          />
                        </td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0' }}>
                          <input 
                            type="number" 
                            step="0.1"
                            value={formData.measurements.waist?.cm || ''} 
                            onChange={(e) => handleMeasurementChange('waist', 'cm', e.target.value)} 
                            placeholder="Centimeters"
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', color: '#000' }}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0', color: '#000' }}><strong style={{ color: '#000' }}>Hips</strong></td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0' }}>
                          <input 
                            type="number" 
                            step="0.1"
                            value={formData.measurements.hips?.inch || ''} 
                            onChange={(e) => handleMeasurementChange('hips', 'inch', e.target.value)} 
                            placeholder="Inches"
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', color: '#000' }}
                          />
                        </td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0' }}>
                          <input 
                            type="number" 
                            step="0.1"
                            value={formData.measurements.hips?.cm || ''} 
                            onChange={(e) => handleMeasurementChange('hips', 'cm', e.target.value)} 
                            placeholder="Centimeters"
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', color: '#000' }}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0', color: '#000' }}><strong style={{ color: '#000' }}>Inseam</strong></td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0' }}>
                          <input 
                            type="number" 
                            step="0.1"
                            value={formData.measurements.inseam?.inch || ''} 
                            onChange={(e) => handleMeasurementChange('inseam', 'inch', e.target.value)} 
                            placeholder="Inches"
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', color: '#000' }}
                          />
                        </td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0' }}>
                          <input 
                            type="number" 
                            step="0.1"
                            value={formData.measurements.inseam?.cm || ''} 
                            onChange={(e) => handleMeasurementChange('inseam', 'cm', e.target.value)} 
                            placeholder="Centimeters"
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', color: '#000' }}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0', color: '#000' }}><strong style={{ color: '#000' }}>Length</strong></td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0' }}>
                          <input 
                            type="number" 
                            step="0.1"
                            value={formData.measurements.length?.inch || ''} 
                            onChange={(e) => handleMeasurementChange('length', 'inch', e.target.value)} 
                            placeholder="Inches"
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', color: '#000' }}
                          />
                        </td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0' }}>
                          <input 
                            type="number" 
                            step="0.1"
                            value={formData.measurements.length?.cm || ''} 
                            onChange={(e) => handleMeasurementChange('length', 'cm', e.target.value)} 
                            placeholder="Centimeters"
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', color: '#000' }}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0', color: '#000' }}><strong style={{ color: '#000' }}>Thigh</strong></td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0' }}>
                          <input 
                            type="number" 
                            step="0.1"
                            value={formData.measurements.thigh?.inch || ''} 
                            onChange={(e) => handleMeasurementChange('thigh', 'inch', e.target.value)} 
                            placeholder="Inches"
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', color: '#000' }}
                          />
                        </td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0' }}>
                          <input 
                            type="number" 
                            step="0.1"
                            value={formData.measurements.thigh?.cm || ''} 
                            onChange={(e) => handleMeasurementChange('thigh', 'cm', e.target.value)} 
                            placeholder="Centimeters"
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', color: '#000' }}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '12px', color: '#000' }}><strong style={{ color: '#000' }}>Outseam</strong></td>
                        <td style={{ padding: '12px' }}>
                          <input 
                            type="number" 
                            step="0.1"
                            value={formData.measurements.outseam?.inch || ''} 
                            onChange={(e) => handleMeasurementChange('outseam', 'inch', e.target.value)} 
                            placeholder="Inches"
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', color: '#000' }}
                          />
                        </td>
                        <td style={{ padding: '12px' }}>
                          <input 
                            type="number" 
                            step="0.1"
                            value={formData.measurements.outseam?.cm || ''} 
                            onChange={(e) => handleMeasurementChange('outseam', 'cm', e.target.value)} 
                            placeholder="Centimeters"
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', color: '#000' }}
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              <div className="form-grid">
                <div className="input-group">
                  <label>Price *</label>
                  <input 
                    type="text" 
                    value={formData.price} 
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })} 
                    placeholder="e.g., 500.00"
                  />
                </div>
                <div className="input-group">
                  <label>Total Available</label>
                  <input 
                    type="number" 
                    value={formData.total_available} 
                    onChange={(e) => setFormData({ ...formData, total_available: e.target.value })} 
                    min="1"
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="input-group">
                  <label>Brand</label>
                  <input 
                    type="text" 
                    value={formData.brand} 
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })} 
                    placeholder="e.g., Armani"
                  />
                </div>
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
              <button className="close-button" onClick={closeDetailModal}>├ù</button>
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
