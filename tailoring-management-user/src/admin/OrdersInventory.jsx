import React, { useState, useEffect } from 'react';
import '../adminStyle/ordersInventory.css';
import AdminHeader from './AdminHeader';
import Sidebar from './Sidebar';
import { getAllBillingRecords, getBillingStats, updateBillingRecordStatus } from '../api/BillingApi';
import { getCompletedItems, getInventoryStats } from '../api/InventoryApi';
import { getAllRentals, createRental, updateRental, deleteRental, getRentalImageUrl, getRentalSizeActivity } from '../api/RentalApi';
import { useAlert } from '../context/AlertContext';
import ImagePreviewModal from '../components/ImagePreviewModal';
import SimpleImageCarousel from '../components/SimpleImageCarousel';
import { API_BASE_URL } from '../api/config';
import { getUserRole } from '../api/AuthApi';
import { useNavigate } from 'react-router-dom';

const SIZE_LABELS = {
  small: 'Small (S)',
  medium: 'Medium (M)',
  large: 'Large (L)',
  extra_large: 'Extra Large (XL)'
};

const parseRentalSizeEntries = (rawSize) => {
  if (!rawSize) return [];

  try {
    const parsed = typeof rawSize === 'string' ? JSON.parse(rawSize) : rawSize;
    if (!parsed || typeof parsed !== 'object') return [];

    if (Array.isArray(parsed.size_entries)) {
      return parsed.size_entries.map((entry, idx) => {
        const key = entry?.sizeKey || entry?.size_key || `custom_${idx}`;
        const qty = parseInt(entry?.quantity, 10);
        const quantity = Number.isNaN(qty) ? 0 : Math.max(0, qty);
        const label =
          key === 'custom'
            ? (entry?.customLabel || entry?.label || `Custom ${idx + 1}`)
            : (entry?.label || SIZE_LABELS[key] || key);
        return { key, label, quantity };
      });
    }

    const source = parsed.size_options || parsed.sizeOptions;
    if (source && typeof source === 'object') {
      return Object.entries(source).map(([key, option]) => {
        const qty = parseInt(option?.quantity, 10);
        const quantity = Number.isNaN(qty) ? 0 : Math.max(0, qty);
        return { key, label: option?.label || SIZE_LABELS[key] || key, quantity };
      });
    }
  } catch {
    return [];
  }

  return [];
};

const getSizeAvailabilityRows = (item) => {
  const rows = parseRentalSizeEntries(item?.size);
  if (rows.length === 0) return [];

  const reasonCounts = item?.size_reason_counts && typeof item.size_reason_counts === 'object'
    ? item.size_reason_counts
    : {};

  return rows.map((row) => {
    const rowReasons = reasonCounts[row.key] || {};
    const rentedQty = Math.max(0, parseInt(rowReasons?.rented, 10) || 0);
    const maintenanceQty = Math.max(0, parseInt(rowReasons?.maintenance, 10) || 0);
    const hasReasons = rentedQty > 0 || maintenanceQty > 0;

    let reason = 'Available';
    if (hasReasons) {
      const segments = [];
      if (rentedQty > 0) segments.push(`${rentedQty} rented`);
      if (maintenanceQty > 0) segments.push(`${maintenanceQty} maintenance`);
      reason = segments.join(' + ');
    } else if (row.quantity <= 0) {
      reason = 'Out of stock';
    }

    return {
      ...row,
      reason,
      rentedQty,
      maintenanceQty,
      isOut: row.quantity <= 0
    };
  });
};

const normalizeSizeKey = (key = '') => {
  const raw = String(key || '').trim().toLowerCase();
  if (!raw) return '';
  const simplified = raw.replace(/\([^)]*\)/g, '').trim();
  const alias = {
    s: 'small',
    small: 'small',
    m: 'medium',
    medium: 'medium',
    l: 'large',
    large: 'large',
    xl: 'extra_large',
    'extra large': 'extra_large',
    extra_large: 'extra_large'
  };
  if (alias[simplified]) return alias[simplified];
  if (alias[raw]) return alias[raw];
  return simplified || raw;
};

// ImageCarousel component for rental items
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
        }}>‹</button>
        <button onClick={goToNext} style={{
          position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
          width: '32px', height: '32px', borderRadius: '50%', border: 'none',
          backgroundColor: 'rgba(255,255,255,0.9)', color: '#333', cursor: 'pointer',
          fontSize: '16px', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}>›</button>
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

const OrdersInventory = () => {
  const navigate = useNavigate();
  const { alert, confirm } = useAlert();
  
  // Combined data states
  const [billingRecords, setBillingRecords] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [rentalItems, setRentalItems] = useState([]);
  const [combinedData, setCombinedData] = useState([]);
  
  // Statistics states
  const [billingStats, setBillingStats] = useState({
    total: 0,
    paid: 0,
    unpaid: 0,
    totalRevenue: 0,
    pendingRevenue: 0
  });
  const [inventoryStats, setInventoryStats] = useState({
    total: 0,
    customization: 0,
    dryCleaning: 0,
    repair: 0,
    totalValue: 0
  });
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('');
  const [serviceTypeFilter, setServiceTypeFilter] = useState('');  
  
  // Modal states
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [imagePreview, setImagePreview] = useState({ isOpen: false, imageUrl: '', altText: '' });
  
  // Rental Post states
  const [isRentalModalOpen, setIsRentalModalOpen] = useState(false);
  const [editingRentalId, setEditingRentalId] = useState(null);
  const [rentalFilter, setRentalFilter] = useState('');
  const [rentalFormData, setRentalFormData] = useState({
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
    status: 'available'
  });
  const [frontImagePreview, setFrontImagePreview] = useState('');
  const [frontImageFile, setFrontImageFile] = useState(null);
  const [backImagePreview, setBackImagePreview] = useState('');
  const [backImageFile, setBackImageFile] = useState(null);
  const [sideImagePreview, setSideImagePreview] = useState('');
  const [sideImageFile, setSideImageFile] = useState(null);
  const [rentalError, setRentalError] = useState('');
  const [isRentalLoading, setIsRentalLoading] = useState(false);
  const [selectedRentalItem, setSelectedRentalItem] = useState(null);
  const [isRentalDetailModalOpen, setIsRentalDetailModalOpen] = useState(false);
  const [isSizeActivityModalOpen, setIsSizeActivityModalOpen] = useState(false);
  const [sizeActivityLoading, setSizeActivityLoading] = useState(false);
  const [sizeActivityRows, setSizeActivityRows] = useState([]);
  const [sizeActivityContext, setSizeActivityContext] = useState({ itemName: '', sizeLabel: '', sizeKey: '' });

  // Fetch all data on component mount
  useEffect(() => {
    const role = getUserRole();
    if (role !== 'admin') {
      navigate('/customize', { replace: true });
      return undefined;
    }

    fetchAllData();
    const refreshInterval = setInterval(fetchAllData, 30000); // Refresh every 30 seconds
    return () => clearInterval(refreshInterval);
  }, [navigate]);

  // Combine billing and inventory data when they change
  useEffect(() => {
    combineData();
  }, [billingRecords, inventoryItems, statusFilter, typeFilter, serviceTypeFilter, searchTerm]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [billingResponse, billingStatsResponse, inventoryResponse, inventoryStatsResponse, rentalResponse] = await Promise.all([
        getAllBillingRecords(),
        getBillingStats(),
        getCompletedItems(),
        getInventoryStats(),
        getAllRentals()
      ]);
      
      if (billingResponse.success) {
        setBillingRecords(billingResponse.records);
      }
      
      if (billingStatsResponse.success) {
        setBillingStats(billingStatsResponse.stats);
      }
      
      if (inventoryResponse.success) {
        setInventoryItems(inventoryResponse.items);
      }
      
      if (inventoryStatsResponse.success) {
        setInventoryStats(inventoryStatsResponse.stats);
      }
      
      if (rentalResponse.items && Array.isArray(rentalResponse.items)) {
        setRentalItems(rentalResponse.items);
      } else if (Array.isArray(rentalResponse)) {
        setRentalItems(rentalResponse);
      }
      
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const combineData = () => {
    let combined = [];
    
    // Add billing records — preserve the real billing status (Paid, Unpaid, etc.)
    billingRecords.forEach(record => {
      combined.push({
        ...record,
        dataType: 'order',
        combinedId: `order-${record.id}`,
        displayStatus: record.status,   // keep exact billing status string
        displayName: record.customerName,
        displayService: record.serviceTypeDisplay || record.serviceType,
        displayAmount: record.price,
        displayDate: record.date
      });
    });
    
    // Add inventory items with 'Completed' status
    inventoryItems.forEach(item => {
      combined.push({
        ...item,
        dataType: 'inventory',
        combinedId: `inventory-${item.id}`,
        displayStatus: 'Completed',
        displayName: item.customerName,
        displayService: item.serviceTypeDisplay || item.serviceType,
        displayAmount: item.price,
        displayDate: item.date
      });
    });
    
    // Apply filters
    combined = combined.filter(item => {
      // Search filter
      const matchesSearch = searchTerm === '' ||
        item.uniqueNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.displayService?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Status filter — exact match against the real billing status
      let matchesStatus = true;
      if (statusFilter && statusFilter !== 'all') {
        const rawStatus = item.displayStatus || '';
        matchesStatus = rawStatus.toLowerCase() === statusFilter.toLowerCase();
      }
      
      // Type filter
      let matchesType = true;
      if (typeFilter) {
        matchesType = item.dataType === typeFilter;
      }

      // Service type filter
      let matchesService = true;
      if (serviceTypeFilter) {
        const svc = (item.serviceType || '').toLowerCase();
        const filterSvc = serviceTypeFilter.toLowerCase();
        if (filterSvc === 'dry_cleaning') {
          matchesService = svc === 'dry_cleaning' || svc === 'dry-cleaning' || svc === 'drycleaning';
        } else if (filterSvc === 'customization') {
          matchesService = svc === 'customization' || svc === 'customize';
        } else {
          matchesService = svc === filterSvc;
        }
      }
      
      return matchesSearch && matchesStatus && matchesType && matchesService;
    });
    
    // Sort by date (newest first)
    combined.sort((a, b) => new Date(b.displayDate) - new Date(a.displayDate));
    
    setCombinedData(combined);
  };

  // Kept for backward compat but no longer used for displayStatus
  const getOrderStatus = (record) => {
    return record.status || 'Unpaid';
  };

  // Calculate combined statistics
  const combinedStats = {
    totalOrders: billingStats.total || billingRecords.length,
    totalRevenue: billingStats.totalRevenue || 0,
    activeRentals: rentalItems.filter(r => r.status === 'rented').length,
    availableItems: rentalItems.filter(r => r.status === 'available').length,
    pendingOrders: billingRecords.filter(b => b.status === 'Unpaid' || b.status === 'Down-payment').length,
    inProgressOrders: billingRecords.filter(b => getOrderStatus(b) === 'in-progress').length,
    totalInventory: inventoryStats.total || inventoryItems.length,
    monthlyRevenue: billingStats.totalRevenue || 0 // Could be calculated based on current month
  };

  const handleViewDetails = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const openImagePreview = (imageUrl, altText) => {
    setImagePreview({ isOpen: true, imageUrl, altText });
  };

  const closeImagePreview = () => {
    setImagePreview({ isOpen: false, imageUrl: '', altText: '' });
  };

  const getServiceImageUrl = (item) => {
    if (item.completedItemImage && item.completedItemImage !== 'no-image') {
      return item.completedItemImage.startsWith('http') ? item.completedItemImage : `${API_BASE_URL}${item.completedItemImage}`;
    }
    if (item.specificData?.imageUrl && item.specificData.imageUrl !== 'no-image') {
      return item.specificData.imageUrl.startsWith('http') ? item.specificData.imageUrl : `${API_BASE_URL}${item.specificData.imageUrl}`;
    }
    return null;
  };

  const getServiceImageUrls = (item) => {
    if (!item.specificData?.imageUrls || item.specificData.imageUrls.length === 0) return null;
    return item.specificData.imageUrls.map(url => 
      url.startsWith('http') ? url : `${API_BASE_URL}${url}`
    );
  };

  const getServiceDescription = (item) => {
    if (!item.specificData) return null;
    const data = item.specificData;
    const serviceType = (item.serviceType || '').toLowerCase();

    if (serviceType === 'rental') {
      const bundleItems = data.bundle_items || [];
      if (bundleItems.length > 0) {
        return bundleItems.map(i => `${i.name || 'Rental Item'} - ${i.description || 'No description'}`).join(', ');
      }
      return data.name || data.description || 'Rental service';
    } else if (serviceType === 'dry_cleaning' || serviceType === 'dry-cleaning' || serviceType === 'drycleaning') {
      return `${data.garmentType || 'Garment'} - Brand: ${data.brand || 'N/A'} - Quantity: ${data.quantity || 1}`;
    } else if (serviceType === 'repair') {
      return `${data.serviceName || 'Repair'} - ${data.damageDescription || 'No description'}`;
    } else if (serviceType === 'customization' || serviceType === 'customize') {
      return `${data.garmentType || 'Custom'} - ${data.fabricType || 'N/A'} fabric`;
    }
    return data.description || data.notes || 'Service details';
  };

  const getStatusBadgeStyle = (status) => {
    const normalizedStatus = (status || '').toLowerCase().trim();
    const styles = {
      'completed': { backgroundColor: '#e8f5e9', color: '#2e7d32' },
      'paid': { backgroundColor: '#e8f5e9', color: '#2e7d32' },
      'fully paid': { backgroundColor: '#c8e6c9', color: '#1b5e20' },
      'unpaid': { backgroundColor: '#ffebee', color: '#d32f2f' },
      'down-payment': { backgroundColor: '#fff8e1', color: '#f57c00' },
      'in-progress': { backgroundColor: '#e3f2fd', color: '#1976d2' },
      'in progress': { backgroundColor: '#e3f2fd', color: '#1976d2' },
      'cancelled': { backgroundColor: '#fce4ec', color: '#c62828' },
      'available': { backgroundColor: '#e8f5e9', color: '#2e7d32' },
      'rented': { backgroundColor: '#fff3e0', color: '#e65100' },
      'pending': { backgroundColor: '#fff3e0', color: '#e65100' }
    };
    return styles[normalizedStatus] || { backgroundColor: '#f5f5f5', color: '#666' };
  };

  const getTypeIndicator = (type) => {
    return type === 'order' ? 
      { bg: '#e3f2fd', color: '#1976d2', label: 'Order' } : 
      { bg: '#f3e5f5', color: '#7b1fa2', label: 'Inventory' };
  };

  const getRentalPriceDisplay = (item) => {
    const fullPrice = parseFloat(item.price || 0);
    const amountPaid = parseFloat(item.pricingFactors?.amount_paid || 0);
    const remainingBalance = fullPrice - amountPaid;
    const serviceType = (item.serviceType || '').toLowerCase();

    if (serviceType === 'rental' && amountPaid > 0) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '13px' }}>₱{fullPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          {remainingBalance > 0 && (
            <span style={{ fontSize: '11px', color: '#f44336' }}>Bal: ₱{remainingBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          )}
        </div>
      );
    }
    return `₱${fullPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Rental Post Management Functions
  const loadRentalItems = async () => {
    try {
      const result = await getAllRentals();
      if (result.items && Array.isArray(result.items)) {
        setRentalItems(result.items);
      } else if (Array.isArray(result)) {
        setRentalItems(result);
      }
    } catch (error) {
      console.error('Error loading rental items:', error);
    }
  };

  const openRentalModal = (id = null) => {
    setRentalError('');
    if (id != null) {
      const item = rentalItems.find(i => i.item_id === id);
      if (item) {
        setRentalFormData({
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
          status: item.status || 'available'
        });
        setFrontImagePreview(item.front_image ? getRentalImageUrl(item.front_image) : '');
        setBackImagePreview(item.back_image ? getRentalImageUrl(item.back_image) : '');
        setSideImagePreview(item.side_image ? getRentalImageUrl(item.side_image) : '');
        setEditingRentalId(id);
      }
    } else {
      setRentalFormData({
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
        status: 'available'
      });
      setFrontImagePreview('');
      setFrontImageFile(null);
      setBackImagePreview('');
      setBackImageFile(null);
      setSideImagePreview('');
      setSideImageFile(null);
      setEditingRentalId(null);
    }
    setIsRentalModalOpen(true);
  };

  const closeRentalModal = () => {
    setIsRentalModalOpen(false);
    setEditingRentalId(null);
    setFrontImagePreview('');
    setFrontImageFile(null);
    setBackImagePreview('');
    setBackImageFile(null);
    setSideImagePreview('');
    setSideImageFile(null);
    setRentalError('');
  };

  const handleRentalImageChange = (e, imageType) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setRentalError('Please select an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setRentalError('Image size should be less than 5MB');
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
        }
      };
      reader.readAsDataURL(file);
      setRentalError('');
    }
  };

  const saveRentalItem = async () => {
    setRentalError('');
    setIsRentalLoading(true);

    if (!rentalFormData.item_name || !rentalFormData.price) {
      setRentalError('Item name and price are required');
      setIsRentalLoading(false);
      return;
    }

    try {
      let result;
      const imageFiles = {};
      if (frontImageFile) imageFiles.front_image = frontImageFile;
      if (backImageFile) imageFiles.back_image = backImageFile;
      if (sideImageFile) imageFiles.side_image = sideImageFile;

      const hasNewImages = Object.keys(imageFiles).length > 0;
      
      if (editingRentalId) {
        result = await updateRental(editingRentalId, rentalFormData, hasNewImages ? imageFiles : null);
      } else {
        result = await createRental(rentalFormData, hasNewImages ? imageFiles : null);
      }

      if (result.success !== false) {
        await loadRentalItems();
        closeRentalModal();
        await alert(editingRentalId ? 'Item updated successfully!' : 'Item posted successfully!', 'Success', 'success');
      } else {
        setRentalError(result.message || 'Error saving item');
      }
    } catch (error) {
      console.error('Error saving item:', error);
      setRentalError('Error saving item. Please try again.');
    } finally {
      setIsRentalLoading(false);
    }
  };

  const deleteRentalItem = async (id) => {
    const confirmed = await confirm('Delete this item permanently?', 'Delete Item', 'warning');
    if (confirmed) {
      try {
        const result = await deleteRental(id);
        if (result.success !== false) {
          setRentalItems(prev => prev.filter(item => item.item_id !== id));
          await alert('Item deleted successfully!', 'Success', 'success');
        } else {
          setRentalError(result.message || 'Error deleting item');
        }
      } catch (error) {
        console.error('Error deleting item:', error);
        setRentalError('Error deleting item. Please try again.');
      }
    }
  };

  const openRentalDetailModal = (item) => {
    setSelectedRentalItem(item);
    setIsRentalDetailModalOpen(true);
  };

  const closeRentalDetailModal = () => {
    setIsRentalDetailModalOpen(false);
    setSelectedRentalItem(null);
  };

  const openSizeActivityModal = async (item, row, event) => {
    if (event) event.stopPropagation();
    const normalizedKey = normalizeSizeKey(row?.key);
    setSizeActivityContext({
      itemName: item?.item_name || 'Rental Item',
      sizeLabel: row?.label || row?.key || 'Size',
      sizeKey: normalizedKey || row?.key || ''
    });
    setIsSizeActivityModalOpen(true);
    setSizeActivityLoading(true);
    setSizeActivityRows([]);

    try {
      const result = await getRentalSizeActivity(item?.item_id, normalizedKey || row?.key);
      const rows = Array.isArray(result?.data?.activities) ? result.data.activities : [];
      setSizeActivityRows(rows);
    } catch (error) {
      console.error('Error loading size activity:', error);
      setSizeActivityRows([]);
    } finally {
      setSizeActivityLoading(false);
    }
  };

  const filteredRentalItems = rentalFilter 
    ? rentalItems.filter(i => (i.status || 'available') === rentalFilter) 
    : rentalItems;

  return (
    <div className="orders-inventory-management">
      <Sidebar />
      <AdminHeader />

      <div className="content">
        {/* Page Title */}
        <div className="dashboard-title">
          <div>
            <h2>Orders & Inventory</h2>
            <p>Unified view of billing, orders, and inventory management</p>
          </div>
        </div>

        {/* Combined Statistics Cards */}
        <div className="stats-grid-combined">
          <div className="stat-card" onClick={() => setStatusFilter('all')}>
            <div className="stat-header">
              <span>Total Orders</span>
              <div className="stat-icon" style={{ background: '#e3f2fd', color: '#2196f3' }}>
                <i className="fas fa-file-invoice"></i>
              </div>
            </div>
            <div className="stat-number">{combinedStats.totalOrders}</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>Total Revenue</span>
              <div className="stat-icon" style={{ background: '#e8f5e9', color: '#4caf50' }}>
                <i className="fas fa-peso-sign"></i>
              </div>
            </div>
            <div className="stat-number" style={{ fontSize: '24px' }}>
              ₱{parseFloat(combinedStats.totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="stat-card" onClick={() => setStatusFilter('rented')}>
            <div className="stat-header">
              <span>Active Rentals</span>
              <div className="stat-icon" style={{ background: '#fff3e0', color: '#ff9800' }}>
                <i className="fas fa-exchange-alt"></i>
              </div>
            </div>
            <div className="stat-number">{combinedStats.activeRentals}</div>
          </div>

          <div className="stat-card" onClick={() => setStatusFilter('available')}>
            <div className="stat-header">
              <span>Available Items</span>
              <div className="stat-icon" style={{ background: '#e8f5e9', color: '#4caf50' }}>
                <i className="fas fa-box-open"></i>
              </div>
            </div>
            <div className="stat-number">{combinedStats.availableItems}</div>
          </div>

          <div className="stat-card" onClick={() => setStatusFilter('pending')}>
            <div className="stat-header">
              <span>Pending Orders</span>
              <div className="stat-icon" style={{ background: '#fff3e0', color: '#ff9800' }}>
                <i className="fas fa-clock"></i>
              </div>
            </div>
            <div className="stat-number">{combinedStats.pendingOrders}</div>
          </div>

          <div className="stat-card" onClick={() => setStatusFilter('in-progress')}>
            <div className="stat-header">
              <span>In Progress</span>
              <div className="stat-icon" style={{ background: '#e3f2fd', color: '#2196f3' }}>
                <i className="fas fa-spinner"></i>
              </div>
            </div>
            <div className="stat-number">{combinedStats.inProgressOrders}</div>
          </div>

          <div className="stat-card" onClick={() => setStatusFilter('completed')}>
            <div className="stat-header">
              <span>Total Inventory</span>
              <div className="stat-icon" style={{ background: '#f3e5f5', color: '#9c27b0' }}>
                <i className="fas fa-boxes"></i>
              </div>
            </div>
            <div className="stat-number">{combinedStats.totalInventory}</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>Monthly Revenue</span>
              <div className="stat-icon" style={{ background: '#fce4ec', color: '#e91e63' }}>
                <i className="fas fa-chart-line"></i>
              </div>
            </div>
            <div className="stat-number" style={{ fontSize: '24px' }}>
              ₱{parseFloat(combinedStats.monthlyRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Search and Filter Section */}
        <div className="search-filter-section">
          <input
            type="text"
            placeholder="Search by Order ID, Customer Name, or Service..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />

          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Status</option>
            <option value="Completed">Completed</option>
            <option value="Paid">Paid</option>
            <option value="Fully Paid">Fully Paid</option>
            <option value="Unpaid">Unpaid</option>
            <option value="Down-payment">Down-payment</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <select 
            value={serviceTypeFilter} 
            onChange={(e) => setServiceTypeFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">All Services</option>
            <option value="dry_cleaning">Dry Cleaning</option>
            <option value="repair">Repair</option>
            <option value="customization">Customization</option>
            <option value="rental">Rental</option>
          </select>

          <select 
            value={typeFilter} 
            onChange={(e) => setTypeFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">All Types</option>
            <option value="order">Orders Only</option>
            <option value="inventory">Inventory Only</option>
          </select>
        </div>

        {/* Combined Billing & Inventory Table */}
        <div className="combined-table-section">
          <h3 className="section-title">
            <i className="fas fa-table"></i> Orders & Inventory
            <span className="item-count">({combinedData.length} items)</span>
          </h3>
          
          <div className="table-container scrollable-table">
            {loading ? (
              <div className="loading-state">
                <i className="fas fa-spinner fa-spin"></i>
                Loading data...
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Customer/Item</th>
                    <th>Type</th>
                    <th>Service/Category</th>
                    <th>Amount/Price</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedData.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="empty-state">
                        No items found matching your filters
                      </td>
                    </tr>
                  ) : (
                    combinedData.map(item => {
                      const typeIndicator = getTypeIndicator(item.dataType);
                      
                      return (
                        <tr 
                          key={item.combinedId} 
                          onClick={() => handleViewDetails(item)}
                          className="clickable-row"
                        >
                          <td><strong>{item.uniqueNo}</strong></td>
                          <td>{item.displayName}</td>
                          <td>
                            <span 
                              className="type-badge"
                              style={{ backgroundColor: typeIndicator.bg, color: typeIndicator.color }}
                            >
                              {typeIndicator.label}
                            </span>
                          </td>
                          <td>
                            <span className="service-type-badge" data-service-type={(item.serviceType || '').toLowerCase()}>
                              {item.displayService}
                            </span>
                          </td>
                          <td className="amount-cell">
                            {getRentalPriceDisplay(item)}
                          </td>
                          <td>{item.displayDate}</td>
                          <td>
                            <span 
                              className={`status-badge ${(item.displayStatus || '').toLowerCase().replace(/ /g, '-')}`}
                            >
                              {item.displayStatus || item.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Rental Inventory Tracking Section */}
        <div className="rental-post-section">
          <div className="section-header">
            <h3 className="section-title">
              <i className="fas fa-boxes"></i> Rental Inventory
            </h3>
            <span className="inventory-info-badge">
              <i className="fas fa-info-circle"></i> View only - Edit items in Post Rent
            </span>
          </div>

          <div className="rental-filter-container">
            <select value={rentalFilter} onChange={(e) => setRentalFilter(e.target.value)}>
              <option value="">All Items</option>
              <option value="available">In Stock</option>
              <option value="rented">Out of Stock (Rented)</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          <div className="rental-items-grid">
            {filteredRentalItems.length === 0 ? (
              <p className="empty-message">
                {rentalItems.length === 0 
                  ? 'No rental items found. Add items in Post Rent page.' 
                  : `No items found with status "${rentalFilter || 'all'}".`}
              </p>
            ) : (
              filteredRentalItems.map(item => {
                const sizeRows = getSizeAvailabilityRows(item);
                const outCount = sizeRows.filter((s) => s.isOut).length;
                const totalCount = sizeRows.length;
                const isOutOfStock = totalCount > 0 ? outCount >= totalCount : (item.total_available || 0) <= 0;
                const stockStatus = isOutOfStock ? 'Out of Stock' : 'In Stock';
                return (
                  <div key={item.item_id} className={`rental-item-card ${isOutOfStock ? 'out-of-stock' : ''}`} onClick={() => openRentalDetailModal(item)}>
                    <div className="rental-item-image-wrapper">
                      <img 
                        src={item.front_image ? getRentalImageUrl(item.front_image) : (item.image_url ? getRentalImageUrl(item.image_url) : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE2IiBmaWxsPSIjOTk5Ij5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=')} 
                        alt={item.item_name} 
                        className="rental-item-image" 
                      />
                      {isOutOfStock && (
                        <div className="out-of-stock-overlay">
                          <span>OUT OF STOCK</span>
                        </div>
                      )}
                    </div>
                    <div className="rental-item-info">
                      <h4>{item.item_name}</h4>
                      <div className="rental-item-price">
                        ₱{parseFloat(item.price || 0).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </div>
                      <div className="stock-status-row">
                        <span className={`stock-badge ${isOutOfStock ? 'out' : 'in'}`}>
                          {stockStatus}
                        </span>
                        <span className={`status-badge-rental ${(item.status || 'available').toLowerCase()}`}>
                          {item.status || 'available'}
                        </span>
                      </div>
                      {sizeRows.length > 0 && (
                        <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {sizeRows.map((row) => (
                            <button
                              key={`${item.item_id}-${row.key}-${row.label}`}
                              type="button"
                              onClick={(e) => openSizeActivityModal(item, row, e)}
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                borderRadius: '999px',
                                padding: '3px 8px',
                                border: row.isOut ? '1px solid #ef9a9a' : '1px solid #a5d6a7',
                                background: row.isOut ? '#ffebee' : '#e8f5e9',
                                color: row.isOut ? '#b71c1c' : '#1b5e20',
                                cursor: 'pointer'
                              }}
                              title={`${row.label}: ${row.quantity} (${row.reason})`}
                            >
                              {row.label}: {row.quantity} ({row.reason})
                            </button>
                          ))}
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#6d4c41',
                              padding: '3px 0'
                            }}
                          >
                            {outCount}/{totalCount} sizes unavailable
                          </span>
                        </div>
                      )}
                      <button className="view-details-btn" onClick={(e) => { e.stopPropagation(); openRentalDetailModal(item); }}>
                        <i className="fas fa-eye"></i> View Details
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Detail Modal for Orders/Inventory */}
      {showDetailModal && selectedItem && (
        <div className="modal-overlay active" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) setShowDetailModal(false); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedItem.dataType === 'order' ? 'Order Details' : 'Inventory Item Details'}</h2>
              <span className="close-modal" onClick={() => setShowDetailModal(false)}>×</span>
            </div>
            <div className="modal-body">
              <div className="detail-row">
                <strong>Order ID:</strong>
                <span>{selectedItem.uniqueNo}</span>
              </div>
              <div className="detail-row">
                <strong>Customer Name:</strong>
                <span>{selectedItem.displayName}</span>
              </div>
              <div className="detail-row">
                <strong>Type:</strong>
                <span className="type-badge" style={{ backgroundColor: getTypeIndicator(selectedItem.dataType).bg, color: getTypeIndicator(selectedItem.dataType).color }}>
                  {getTypeIndicator(selectedItem.dataType).label}
                </span>
              </div>
              <div className="detail-row">
                <strong>Service Type:</strong>
                <span className="service-type-badge" data-service-type={(selectedItem.serviceType || '').toLowerCase()}>
                  {selectedItem.displayService}
                </span>
              </div>
              <div className="detail-row">
                <strong>Date:</strong>
                <span>{selectedItem.displayDate}</span>
              </div>
              <div className="detail-row">
                <strong>Amount:</strong>
                <span style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: '18px' }}>
                  ₱{parseFloat(selectedItem.displayAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="detail-row">
                <strong>Status:</strong>
                <span className="status-badge" style={getStatusBadgeStyle(selectedItem.displayStatus)}>
                  {selectedItem.displayStatus || selectedItem.status}
                </span>
              </div>
              {getServiceDescription(selectedItem) && (
                <div className="detail-row">
                  <strong>Description:</strong>
                  <span>{getServiceDescription(selectedItem)}</span>
                </div>
              )}
              {getServiceImageUrls(selectedItem) ? (
                <div className="detail-row">
                  <strong>Images:</strong>
                  <div style={{ marginTop: '8px' }}>
                    <SimpleImageCarousel
                      images={getServiceImageUrls(selectedItem).map((url, idx) => ({ url, label: `Photo ${idx + 1}` }))}
                      itemName="Service Photo"
                      height="300px"
                    />
                  </div>
                </div>
              ) : getServiceImageUrl(selectedItem) && (
                <div className="detail-row">
                  <strong>Image:</strong>
                  <div style={{ marginTop: '8px' }}>
                    <img
                      src={getServiceImageUrl(selectedItem)}
                      alt="Service"
                      style={{ maxWidth: '300px', maxHeight: '300px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
                      onClick={() => openImagePreview(getServiceImageUrl(selectedItem), 'Service Image')}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="close-btn" onClick={() => setShowDetailModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Rental Item Detail Modal */}
      {isRentalDetailModalOpen && selectedRentalItem && (
        <div className="modal-overlay active" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) closeRentalDetailModal(); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Rental Item Details</h2>
              <span className="close-modal" onClick={closeRentalDetailModal}>×</span>
            </div>
            <div className="modal-body">
              <ImageCarousel
                images={[
                  { url: selectedRentalItem.front_image, label: 'Front' },
                  { url: selectedRentalItem.back_image, label: 'Back' },
                  { url: selectedRentalItem.side_image, label: 'Side' }
                ]}
                itemName={selectedRentalItem.item_name}
                getRentalImageUrl={getRentalImageUrl}
              />
              <div className="detail-row">
                <strong>Item Name:</strong>
                <span>{selectedRentalItem.item_name}</span>
              </div>
              <div className="detail-row">
                <strong>Category:</strong>
                <span>{selectedRentalItem.category}</span>
              </div>
              <div className="detail-row">
                <strong>Price:</strong>
                <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>
                  ₱{parseFloat(selectedRentalItem.price || 0).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </span>
              </div>
              {selectedRentalItem.downpayment && (
                <div className="detail-row">
                  <strong>Downpayment:</strong>
                  <span>₱{parseFloat(selectedRentalItem.downpayment || 0).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
              )}
              <div className="detail-row">
                <strong>Status:</strong>
                <span className={`status-badge-rental ${(selectedRentalItem.status || 'available').toLowerCase()}`}>
                  {selectedRentalItem.status || 'available'}
                </span>
              </div>
              {getSizeAvailabilityRows(selectedRentalItem).length > 0 && (
                <div className="detail-row" style={{ display: 'block' }}>
                  <strong>Size Stock Breakdown:</strong>
                  <div style={{ marginTop: '8px', border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#fafafa' }}>
                          <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '12px' }}>Size</th>
                          <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: '12px' }}>Qty</th>
                          <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '12px' }}>State</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getSizeAvailabilityRows(selectedRentalItem).map((row, idx) => (
                          <tr key={`${row.key}-${idx}`} style={{ borderTop: idx === 0 ? 'none' : '1px solid #f1f1f1' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                              <button
                                type="button"
                                onClick={(e) => openSizeActivityModal(selectedRentalItem, row, e)}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#1976d2',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  padding: 0
                                }}
                              >
                                {row.label}
                              </button>
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>{row.quantity}</td>
                            <td style={{ padding: '8px 10px', color: row.isOut ? '#b71c1c' : '#2e7d32', fontWeight: 700 }}>
                              {row.reason}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <small style={{ color: '#666', display: 'block', marginTop: '6px' }}>
                    Note: this view reflects current per-size quantity and current item status.
                  </small>
                </div>
              )}
              {selectedRentalItem.description && (
                <div className="detail-row">
                  <strong>Description:</strong>
                  <span>{selectedRentalItem.description}</span>
                </div>
              )}
              {selectedRentalItem.material && (
                <div className="detail-row">
                  <strong>Material:</strong>
                  <span>{selectedRentalItem.material}</span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="close-btn" onClick={closeRentalDetailModal}>Close</button>
            </div>
          </div>
        </div>
      )}

      {isSizeActivityModalOpen && (
        <div className="modal-overlay active" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) setIsSizeActivityModalOpen(false); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Size Activity Log</h2>
              <span className="close-modal" onClick={() => setIsSizeActivityModalOpen(false)}>×</span>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '8px', fontWeight: 700, color: '#5d4037' }}>
                {sizeActivityContext.itemName} - {sizeActivityContext.sizeLabel}
              </div>
              {sizeActivityLoading ? (
                <div style={{ padding: '10px 0' }}>Loading size activity...</div>
              ) : sizeActivityRows.length === 0 ? (
                <div style={{ padding: '10px 0', color: '#666' }}>No renter/maintenance records for this size.</div>
              ) : (
                <div style={{ border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#fafafa' }}>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '12px' }}>Name</th>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '12px' }}>Status</th>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '12px' }}>Damage Level</th>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '12px' }}>Damage Note</th>
                        <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: '12px' }}>Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sizeActivityRows.map((entry, idx) => (
                        <tr key={`${entry.activity_type}-${idx}`} style={{ borderTop: idx === 0 ? 'none' : '1px solid #f1f1f1' }}>
                          <td style={{ padding: '8px 10px' }}>{entry.activity_type === 'maintenance' ? (entry.processed_by || '-') : (entry.person_name || '-')}</td>
                          <td style={{ padding: '8px 10px', fontWeight: 700, textTransform: 'capitalize' }}>{entry.activity_type}</td>
                          <td style={{ padding: '8px 10px', textTransform: 'capitalize' }}>{entry.activity_type === 'maintenance' ? (entry.damage_level || 'N/A') : 'N/A'}</td>
                          <td style={{ padding: '8px 10px' }}>{entry.activity_type === 'maintenance' ? (entry.damage_note || 'N/A') : 'N/A'}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>{entry.quantity || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="close-btn" onClick={() => setIsSizeActivityModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Rental Modal */}
      {isRentalModalOpen && (
        <div className="modal-overlay active" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) closeRentalModal(); }}>
          <div className="modal-content rental-form-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingRentalId ? 'Edit Rental Item' : 'Add New Rental Item'}</h2>
              <span className="close-modal" onClick={closeRentalModal}>×</span>
            </div>
            <div className="modal-body">
              {rentalError && (
                <div className="error-message">{rentalError}</div>
              )}
              
              {/* Image Upload Section */}
              <div className="image-upload-section">
                <h4>Upload Images (Front, Back, Side)</h4>
                <div className="image-upload-grid">
                  <div className="upload-area" onClick={() => document.getElementById('frontImageInput')?.click()}>
                    {frontImagePreview ? (
                      <img src={frontImagePreview} alt="Front" />
                    ) : (
                      <div className="upload-placeholder">
                        <i className="fas fa-camera"></i>
                        <span>Front</span>
                      </div>
                    )}
                    <input type="file" id="frontImageInput" accept="image/*" onChange={(e) => handleRentalImageChange(e, 'front')} style={{ display: 'none' }} />
                  </div>
                  <div className="upload-area" onClick={() => document.getElementById('backImageInput')?.click()}>
                    {backImagePreview ? (
                      <img src={backImagePreview} alt="Back" />
                    ) : (
                      <div className="upload-placeholder">
                        <i className="fas fa-camera"></i>
                        <span>Back</span>
                      </div>
                    )}
                    <input type="file" id="backImageInput" accept="image/*" onChange={(e) => handleRentalImageChange(e, 'back')} style={{ display: 'none' }} />
                  </div>
                  <div className="upload-area" onClick={() => document.getElementById('sideImageInput')?.click()}>
                    {sideImagePreview ? (
                      <img src={sideImagePreview} alt="Side" />
                    ) : (
                      <div className="upload-placeholder">
                        <i className="fas fa-camera"></i>
                        <span>Side</span>
                      </div>
                    )}
                    <input type="file" id="sideImageInput" accept="image/*" onChange={(e) => handleRentalImageChange(e, 'side')} style={{ display: 'none' }} />
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="form-grid">
                <div className="input-group">
                  <label>Item Name *</label>
                  <input 
                    type="text" 
                    value={rentalFormData.item_name} 
                    onChange={(e) => setRentalFormData({ ...rentalFormData, item_name: e.target.value })} 
                    placeholder="e.g., Brown Business Suit"
                  />
                </div>
                <div className="input-group">
                  <label>Category</label>
                  <select value={rentalFormData.category} onChange={(e) => setRentalFormData({ ...rentalFormData, category: e.target.value })}>
                    <option value="suit">Suit</option>
                    <option value="tuxedo">Tuxedo</option>
                    <option value="formal_wear">Formal Wear</option>
                    <option value="business">Business</option>
                    <option value="casual">Casual</option>
                    <option value="pants">Pants</option>
                    <option value="trousers">Trousers</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Price *</label>
                  <input 
                    type="number" 
                    value={rentalFormData.price} 
                    onChange={(e) => setRentalFormData({ ...rentalFormData, price: e.target.value })} 
                    placeholder="0.00"
                  />
                </div>
                <div className="input-group">
                  <label>Downpayment</label>
                  <input 
                    type="number" 
                    value={rentalFormData.downpayment} 
                    onChange={(e) => setRentalFormData({ ...rentalFormData, downpayment: e.target.value })} 
                    placeholder="0.00"
                  />
                </div>
                <div className="input-group">
                  <label>Status</label>
                  <select value={rentalFormData.status} onChange={(e) => setRentalFormData({ ...rentalFormData, status: e.target.value })}>
                    <option value="available">Available</option>
                    <option value="rented">Rented</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Total Available</label>
                  <input 
                    type="number" 
                    value={rentalFormData.total_available} 
                    onChange={(e) => setRentalFormData({ ...rentalFormData, total_available: e.target.value })} 
                    placeholder="1"
                  />
                </div>
                <div className="input-group full-width">
                  <label>Description</label>
                  <textarea 
                    value={rentalFormData.description} 
                    onChange={(e) => setRentalFormData({ ...rentalFormData, description: e.target.value })} 
                    placeholder="Item description..."
                    rows="3"
                  />
                </div>
                <div className="input-group">
                  <label>Material</label>
                  <input 
                    type="text" 
                    value={rentalFormData.material} 
                    onChange={(e) => setRentalFormData({ ...rentalFormData, material: e.target.value })} 
                    placeholder="e.g., Cotton, Wool"
                  />
                </div>
                <div className="input-group">
                  <label>Color</label>
                  <input 
                    type="text" 
                    value={rentalFormData.color} 
                    onChange={(e) => setRentalFormData({ ...rentalFormData, color: e.target.value })} 
                    placeholder="e.g., Black, Navy"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={closeRentalModal}>Cancel</button>
              <button className="save-btn" onClick={saveRentalItem} disabled={isRentalLoading}>
                {isRentalLoading ? 'Saving...' : (editingRentalId ? 'Update Item' : 'Add Item')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      <ImagePreviewModal
        isOpen={imagePreview.isOpen}
        imageUrl={imagePreview.imageUrl}
        altText={imagePreview.altText}
        onClose={closeImagePreview}
      />
    </div>
  );
};

export default OrdersInventory;
