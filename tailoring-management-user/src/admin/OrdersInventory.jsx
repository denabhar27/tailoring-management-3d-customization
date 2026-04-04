import React, { useState, useEffect } from 'react';
import '../adminStyle/ordersInventory.css';
import AdminHeader from './AdminHeader';
import Sidebar from './Sidebar';
import { getAllBillingRecords, getBillingStats, updateBillingRecordStatus } from '../api/BillingApi';
import { getCompletedItems, getInventoryStats } from '../api/InventoryApi';
import { getAllRentals, createRental, updateRental, deleteRental, getRentalImageUrl, getRentalSizeActivity, resolveMaintenance, updateRentalDamagePayment } from '../api/RentalApi';
import { useAlert } from '../context/AlertContext';
import ImagePreviewModal from '../components/ImagePreviewModal';
import SimpleImageCarousel from '../components/SimpleImageCarousel';
import { API_BASE_URL } from '../api/config';
import { getUserRole, getUser } from '../api/AuthApi';
import { useLocation, useNavigate } from 'react-router-dom';
import { exportToExcel } from '../utils/excelExport';
import { getCompensationIncidents, getCompensationStats } from '../api/DamageCompensationApi';

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
      reason = 'Unavailable';
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

const formatServiceTypeLabel = (serviceType = '') => {
  const normalized = String(serviceType || '').trim().toLowerCase();
  if (normalized === 'dry_cleaning' || normalized === 'dry-cleaning' || normalized === 'drycleaning') return 'Dry Cleaning';
  if (normalized === 'repair') return 'Repair';
  if (normalized === 'customization' || normalized === 'customize') return 'Customization';
  if (normalized === 'rental') return 'Rental';
  if (!normalized) return 'N/A';
  return String(serviceType);
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
        >‹</button>
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
        >›</button>
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
  const location = useLocation();
  const { alert, confirm, prompt } = useAlert();
  const isRentalInventoryPage = location.pathname === '/rental-inventory';
  
  // Combined data states
  const [billingRecords, setBillingRecords] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [rentalItems, setRentalItems] = useState([]);
  const [combinedData, setCombinedData] = useState([]);
  const [compensationIncidents, setCompensationIncidents] = useState([]);
  
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
  const [compensationStats, setCompensationStats] = useState({
    total_incidents: 0,
    approved_incidents: 0,
    pending_incidents: 0,
    paid_incidents: 0,
    unpaid_incidents: 0,
    approved_compensation: 0,
    paid_compensation: 0,
    outstanding_compensation: 0
  });
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceTypeFilter, setServiceTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Modal states
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [imagePreview, setImagePreview] = useState({ isOpen: false, imageUrl: '', altText: '' });
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [selectedSettlementIncident, setSelectedSettlementIncident] = useState(null);
  
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
  const [sizeActivityContext, setSizeActivityContext] = useState({ itemName: '', sizeLabel: '', sizeKey: '', itemId: null });
  const [maintenanceUpdates, setMaintenanceUpdates] = useState({});

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
  }, [billingRecords, inventoryItems, statusFilter, serviceTypeFilter, searchTerm, dateFrom, dateTo]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [billingResponse, billingStatsResponse, inventoryResponse, inventoryStatsResponse, rentalResponse, compensationIncidentsResponse, compensationStatsResponse] = await Promise.all([
        getAllBillingRecords(),
        getBillingStats(),
        getCompletedItems(),
        getInventoryStats(),
        getAllRentals(),
        getCompensationIncidents(),
        getCompensationStats()
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

      if (compensationIncidentsResponse.success) {
        setCompensationIncidents(compensationIncidentsResponse.incidents || []);
      }

      if (compensationStatsResponse.success) {
        setCompensationStats(compensationStatsResponse.stats || {});
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

      // Date range filter
      let matchesDateRange = true;
      const parsedDate = new Date(item.displayDate);
      if (!Number.isNaN(parsedDate.getTime())) {
        if (dateFrom) {
          const from = new Date(`${dateFrom}T00:00:00`);
          if (parsedDate < from) matchesDateRange = false;
        }
        if (dateTo) {
          const to = new Date(`${dateTo}T23:59:59`);
          if (parsedDate > to) matchesDateRange = false;
        }
      }
      
      return matchesSearch && matchesStatus && matchesService && matchesDateRange;
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
    paidBills: billingStats.paid || billingRecords.filter(b => b.status === 'Paid' || b.status === 'Fully Paid').length,
    unpaidBills: billingStats.unpaid || billingRecords.filter(b => b.status === 'Unpaid' || b.status === 'Down-payment').length,
    totalRevenue: billingStats.totalRevenue || 0,
    activeRentals: rentalItems.filter(r => r.status === 'rented').length,
    availableItems: rentalItems.filter(r => r.status === 'available').length,
    pendingOrders: billingRecords.filter(b => b.status === 'Unpaid' || b.status === 'Down-payment').length,
    inProgressOrders: billingRecords.filter(b => getOrderStatus(b) === 'in-progress').length,
    totalInventory: inventoryStats.total || inventoryItems.length,
    monthlyRevenue: billingStats.totalRevenue || 0 // Could be calculated based on current month
  };

  const rentalInventoryStats = {
    totalInventory: rentalItems.length,
    availableItems: rentalItems.filter((item) => (item.status || 'available') === 'available').length,
    unavailableItems: rentalItems.filter((item) => (item.status || 'available') !== 'available').length
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
      'partial payment': { backgroundColor: '#e1f5fe', color: '#0277bd' },
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

  const getIncidentCustomerName = (incident) => {
    return incident?.customer_name_display || incident?.customer_name || 'N/A';
  };

  const getIncidentHandledBy = (incident) => {
    return incident?.handled_by
      || incident?.responsible_party
      || incident?.handled_by_username
      || (incident?.reported_by_role === 'clerk' ? 'Clerk' : incident?.reported_by_role)
      || 'N/A';
  };

  const getIncidentDetailLines = (incident) => {
    const notes = String(incident?.notes || '').trim();
    if (!notes) return [];
    return notes
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
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
      sizeKey: normalizedKey || row?.key || '',
      itemId: item?.item_id || null
    });
    setIsSizeActivityModalOpen(true);
    setSizeActivityLoading(true);
    setSizeActivityRows([]);
    setMaintenanceUpdates({});

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

  const handleMaintenanceUpdate = (logId, field, value) => {
    setMaintenanceUpdates(prev => ({
      ...prev,
      [logId]: {
        ...prev[logId],
        [field]: value
      }
    }));
  };

  const refreshSizeActivityRows = async (itemId, sizeKey) => {
    const refreshResult = await getRentalSizeActivity(itemId, sizeKey);
    const rows = Array.isArray(refreshResult?.data?.activities) ? refreshResult.data.activities : [];
    setSizeActivityRows(rows);
  };

  const handleSetDamageCharge = async (entry) => {
    if (!entry?.log_id || !sizeActivityContext.itemId) return;

    const issueType = String(entry.damage_type || 'damage').replace(/_/g, ' ');
    const currentAmount = parseFloat(entry.compensation_amount || 0) || 0;
    const input = await prompt(
      `Enter the amount the customer must pay for this ${issueType} issue.`,
      'Set Charge Amount',
      'e.g. 500.00',
      currentAmount > 0 ? currentAmount.toFixed(2) : ''
    );

    if (input === null) return;

    const amount = parseFloat(String(input).replace(/,/g, '').trim());
    if (!Number.isFinite(amount) || amount < 0) {
      await alert('Please enter a valid non-negative amount.', 'Invalid Amount', 'warning');
      return;
    }

    const normalizedAmount = Math.max(0, amount);
    const nextPaymentStatus = normalizedAmount <= 0
      ? 'unpaid'
      : (String(entry.payment_status || 'unpaid').toLowerCase() === 'paid' ? 'paid' : 'unpaid');

    try {
      const result = await updateRentalDamagePayment(
        sizeActivityContext.itemId,
        entry.log_id,
        normalizedAmount,
        nextPaymentStatus
      );

      if (result?.success) {
        await alert(
          `Charge amount set to ₱${normalizedAmount.toFixed(2)}.`,
          'Success',
          'success'
        );
        await refreshSizeActivityRows(sizeActivityContext.itemId, sizeActivityContext.sizeKey);
        await fetchAllData();
      } else {
        await alert(result?.message || 'Failed to update charge amount.', 'Error', 'error');
      }
    } catch (error) {
      console.error('Error updating damage charge amount:', error);
      await alert('Error updating charge amount.', 'Error', 'error');
    }
  };

  const handleDamagePaymentStatusChange = async (entry, nextStatus) => {
    if (!entry?.log_id || !sizeActivityContext.itemId) return;

    const amount = parseFloat(entry.compensation_amount || 0) || 0;
    const normalizedStatus = String(nextStatus || '').toLowerCase() === 'paid' ? 'paid' : 'unpaid';

    if (normalizedStatus === 'paid' && amount <= 0) {
      await alert('Set the charge amount first before marking this as paid.', 'Amount Required', 'warning');
      return;
    }

    const confirmed = await confirm(
      normalizedStatus === 'paid'
        ? `Mark this issue as paid (₱${amount.toFixed(2)})?`
        : 'Mark this issue as unpaid?',
      'Update Payment Status',
      'question',
      { confirmText: 'Yes', cancelText: 'No' }
    );

    if (!confirmed) return;

    try {
      const result = await updateRentalDamagePayment(
        sizeActivityContext.itemId,
        entry.log_id,
        amount,
        normalizedStatus
      );

      if (result?.success) {
        await alert(
          `Payment status updated to ${normalizedStatus}.`,
          'Success',
          'success'
        );
        await refreshSizeActivityRows(sizeActivityContext.itemId, sizeActivityContext.sizeKey);
        await fetchAllData();
      } else {
        await alert(result?.message || 'Failed to update payment status.', 'Error', 'error');
      }
    } catch (error) {
      console.error('Error updating damage payment status:', error);
      await alert('Error updating payment status.', 'Error', 'error');
    }
  };

  const handleResolveMaintenance = async (logId, maxQuantity) => {
    const update = maintenanceUpdates[logId] || {};
    const quantity = parseInt(update.quantity || maxQuantity, 10);

    if (quantity <= 0 || quantity > maxQuantity) {
      await alert(`Please enter a valid quantity (1-${maxQuantity})`, 'Invalid Quantity', 'warning');
      return;
    }

    const confirmed = await confirm(
      `Move ${quantity} item(s) from maintenance to available?`,
      'Resolve Maintenance',
      'question'
    );

    if (!confirmed) return;

    try {
      const result = await resolveMaintenance(
        sizeActivityContext.itemId,
        logId,
        quantity,
        update.resolution_note || 'Fixed and returned to available'
      );

      if (result.success) {
        await alert(
          `Successfully moved ${quantity} item(s) to available. ${result.data.remaining_damage_quantity > 0 ? `${result.data.remaining_damage_quantity} item(s) remain in maintenance.` : 'All items resolved.'}`,
          'Success',
          'success'
        );
        
        // Refresh the activity log
        await refreshSizeActivityRows(sizeActivityContext.itemId, sizeActivityContext.sizeKey);
        setMaintenanceUpdates({});
        
        // Refresh the main rental items list
        await fetchAllData();
      } else {
        await alert(result.message || 'Failed to resolve maintenance', 'Error', 'error');
      }
    } catch (error) {
      console.error('Error resolving maintenance:', error);
      await alert('Error resolving maintenance', 'Error', 'error');
    }
  };

  const filteredRentalItems = rentalFilter 
    ? rentalItems.filter(i => (i.status || 'available') === rentalFilter) 
    : rentalItems;

  const handleExportReportsToExcel = async () => {
    try {
      const currentUser = getUser();
      const reportRows = combinedData.map((item) => ({
        'ID': item.uniqueNo || '',
        'Customer/Item': item.displayName || '',
        'Service/Category': item.displayService || '',
        'Amount/Price': parseFloat(item.displayAmount || 0),
        'Date': item.displayDate || '',
        'Status': item.displayStatus || item.status || ''
      }));

      // Create receipt information
      const receiptInfo = {
        clerkName: currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || currentUser.username || 'Unknown Clerk' : 'Unknown Clerk',
        exportDate: new Date().toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        reportType: 'Billing & Inventory Reports'
      };

      await exportToExcel({
        data: reportRows,
        filename: 'reports_table',
        sheetName: 'Reports',
        headers: ['ID', 'Customer/Item', 'Service/Category', 'Amount/Price', 'Date', 'Status'],
        receiptInfo: receiptInfo
      });
    } catch (error) {
      console.error('Failed to export reports:', error);
      await alert('Failed to export reports to Excel', 'Export Error', 'error');
    }
  };

  const clearReportFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setServiceTypeFilter('');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="orders-inventory-management">
      <Sidebar />
      <AdminHeader />

      <div className="content">
        {/* Page Title */}
        <div className="dashboard-title">
          <div>
            <h2>{isRentalInventoryPage ? 'Rental Inventory' : 'Reports'}</h2>
            <p>{isRentalInventoryPage ? 'Rental inventory tracking and availability' : 'Billing-focused order reports'}</p>
          </div>
        </div>

        {!isRentalInventoryPage && (
          <>
        {/* Combined Statistics Cards */}
        <div className="stats-grid-combined report-print-area">
          <div className="stat-card" onClick={() => setStatusFilter('all')}>
            <div className="stat-header">
              <span>Total Bills</span>
              <div className="stat-icon" style={{ background: '#e3f2fd', color: '#2196f3' }}>📄</div>
            </div>
            <div className="stat-number">{combinedStats.totalOrders}</div>
          </div>

          <div className="stat-card" onClick={() => setStatusFilter('Paid')}>
            <div className="stat-header">
              <span>Paid</span>
              <div className="stat-icon" style={{ background: '#e8f5e9', color: '#4caf50' }}>✓</div>
            </div>
            <div className="stat-number">{combinedStats.paidBills}</div>
          </div>

          <div className="stat-card" onClick={() => setStatusFilter('Unpaid')}>
            <div className="stat-header">
              <span>Unpaid</span>
              <div className="stat-icon" style={{ background: '#ffebee', color: '#f44336' }}>⚠</div>
            </div>
            <div className="stat-number">{combinedStats.unpaidBills}</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>Damage Incidents</span>
              <div className="stat-icon" style={{ background: '#fff8e1', color: '#f57c00' }}>⚠</div>
            </div>
            <div className="stat-number">{compensationStats.total_incidents || 0}</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>Outstanding Compensation</span>
              <div className="stat-icon" style={{ background: '#ffebee', color: '#e53935' }}>₱</div>
            </div>
            <div className="stat-number">₱{parseFloat(compensationStats.outstanding_compensation || 0).toLocaleString()}</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>Paid Compensation</span>
              <div className="stat-icon" style={{ background: '#e8f5e9', color: '#2e7d32' }}>✓</div>
            </div>
            <div className="stat-number">₱{parseFloat(compensationStats.paid_compensation || 0).toLocaleString()}</div>
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
            <option value="Partial Payment">Partial Payment</option>
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

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="filter-select"
            title="From date"
          />

          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="filter-select"
            title="To date"
          />

          <button className="clear-filter-btn" onClick={clearReportFilters}>
            Clear Filters
          </button>
        </div>

        {/* Combined Billing & Inventory Table */}
        <div className="combined-table-section">
          <div className="combined-table-header">
            <h3 className="section-title">
              <i className="fas fa-table"></i> Reports
              <span className="item-count">({combinedData.length} items)</span>
            </h3>
            <button className="print-report-btn" onClick={handleExportReportsToExcel}>
              <i className="fas fa-file-excel"></i> Export to Excel
            </button>
          </div>
          
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
                    <th>Service/Category</th>
                    <th>Amount/Price</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedData.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="empty-state">
                        No items found matching your filters
                      </td>
                    </tr>
                  ) : (
                    combinedData.map(item => {

                      return (
                        <tr 
                          key={item.combinedId} 
                          onClick={() => handleViewDetails(item)}
                          className="clickable-row"
                        >
                          <td><strong>{item.uniqueNo}</strong></td>
                          <td>{item.displayName}</td>
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

        <div className="combined-table-section" style={{ marginTop: '20px' }}>
          <div className="combined-table-header">
            <h3 className="section-title">
              <i className="fas fa-triangle-exclamation"></i> Damage Compensation Incidents
              <span className="item-count">({compensationIncidents.length} items)</span>
            </h3>
          </div>

          <div className="table-container scrollable-table">
            {loading ? (
              <div className="loading-state">
                <i className="fas fa-spinner fa-spin"></i>
                Loading incidents...
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Damage Type</th>
                    <th>Liability</th>
                    <th>Compensation</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {compensationIncidents.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="empty-state">No damage incidents recorded</td>
                    </tr>
                  ) : (
                    compensationIncidents.map((incident) => (
                      <tr key={incident.id}>
                        <td>{formatServiceTypeLabel(incident.service_type)}</td>
                        <td>#{incident.order_id || incident.order_item_id}</td>
                        <td>{getIncidentCustomerName(incident)}</td>
                        <td style={{ textTransform: 'capitalize' }}>{String(incident.damage_type || 'N/A').replace(/_/g, ' ')}</td>
                        <td><span className={`badge liability-${incident.liability_status}`}>{incident.liability_status}</span></td>
                        <td style={{ color: '#c41c3b', fontWeight: 'bold' }}>₱{parseFloat(incident.compensation_amount || 0).toLocaleString()}</td>
                        <td><span className={`badge status-${incident.compensation_status}`}>{incident.compensation_status}</span></td>
                        <td>
                          <button
                            className="action-btn view-btn"
                            onClick={() => {
                              setSelectedSettlementIncident(incident);
                              setShowSettlementModal(true);
                            }}
                            title="View Details"
                            style={{ background: '#2196F3', color: 'white', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer' }}
                          >
                            <i className="fas fa-eye"></i>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
          </>
        )}

        {isRentalInventoryPage && (
        /* Rental Inventory Tracking Section */
        <div className="rental-post-section">
          <div className="section-header">
            <h3 className="section-title">
              <i className="fas fa-boxes"></i> Rental Inventory
            </h3>
            <span className="inventory-info-badge">
              <i className="fas fa-info-circle"></i> View only - Edit items in Post Rent
            </span>
          </div>

          <div className="stats-grid-combined" style={{ marginBottom: '20px' }}>
            <div className="stat-card" onClick={() => setRentalFilter('available')}>
              <div className="stat-header">
                <span>Available Items</span>
                <div className="stat-icon" style={{ background: '#e8f5e9', color: '#4caf50' }}>
                  <i className="fas fa-box-open"></i>
                </div>
              </div>
              <div className="stat-number">{rentalInventoryStats.availableItems}</div>
            </div>

            <div className="stat-card" onClick={() => setRentalFilter('rented')}>
              <div className="stat-header">
                <span>Unavailable Items</span>
                <div className="stat-icon" style={{ background: '#ffebee', color: '#f44336' }}>
                  <i className="fas fa-ban"></i>
                </div>
              </div>
              <div className="stat-number">{rentalInventoryStats.unavailableItems}</div>
            </div>

            <div className="stat-card" onClick={() => setRentalFilter('')}>
              <div className="stat-header">
                <span>Total Inventory</span>
                <div className="stat-icon" style={{ background: '#e3f2fd', color: '#2196f3' }}>
                  <i className="fas fa-boxes"></i>
                </div>
              </div>
              <div className="stat-number">{rentalInventoryStats.totalInventory}</div>
            </div>
          </div>

          <div className="rental-filter-container">
            <select value={rentalFilter} onChange={(e) => setRentalFilter(e.target.value)}>
              <option value="">All Items</option>
              <option value="available">In Stock</option>
              <option value="rented">Unavailable (Rented)</option>
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
                const stockStatus = isOutOfStock ? 'Unavailable' : 'In Stock';
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
                          <span>UNAVAILABLE</span>
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
        )}
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
                            <td style={{ padding: '8px 10px', fontWeight: 600, color: '#1976d2' }}>
                              <span style={{
                                fontSize: '13px',
                                textDecoration: 'underline',
                                cursor: 'pointer',
                                transition: 'color 0.2s ease'
                              }}
                              onMouseOver={(e) => e.target.style.color = '#1565c0'}
                              onMouseOut={(e) => e.target.style.color = '#1976d2'}
                              onClick={(e) => openSizeActivityModal(selectedRentalItem, row, e)}
                              title="Click to view size activity"
                              >
                                {row.label}
                              </span>
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>{row.quantity}</td>
                            <td style={{ padding: '8px 10px' }}>
                              {row.quantity <= 0 ? (
                                <span style={{ color: '#b71c1c', fontWeight: 700 }}>Unavailable</span>
                              ) : row.maintenanceQty > 0 || row.rentedQty > 0 ? (
                                <span style={{ color: '#f57c00', fontWeight: 700 }}>{row.reason}</span>
                              ) : (
                                <span style={{ color: '#2e7d32', fontWeight: 700 }}>Available</span>
                              )}
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '96vw', maxWidth: '1320px', maxHeight: '90vh' }}>
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
                  <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#fafafa' }}>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '12px', width: '140px' }}>Name</th>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '12px', width: '120px' }}>Activity</th>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '12px', width: '110px' }}>Issue Type</th>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '12px', width: '110px' }}>Damage Level</th>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '12px', width: '220px' }}>Comment</th>
                        <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: '12px', width: '70px' }}>Qty</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: '12px', width: '120px' }}>Amount To Pay</th>
                        <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: '12px', width: '120px' }}>Payment Status</th>
                        <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: '12px', width: '260px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sizeActivityRows.map((entry, idx) => {
                        const isMaintenance = entry.activity_type === 'maintenance';
                        const update = maintenanceUpdates[entry.log_id] || {};
                        const resolveQty = update.quantity || entry.quantity;
                        const issueType = String(entry.damage_type || 'damage').toLowerCase();
                        const issueTypeLabel = issueType ? `${issueType.charAt(0).toUpperCase()}${issueType.slice(1)}` : 'Damage';
                        const compensationAmount = Math.max(0, parseFloat(entry.compensation_amount || 0) || 0);
                        const paymentStatus = String(entry.payment_status || 'unpaid').toLowerCase() === 'paid' ? 'paid' : 'unpaid';
                        const canMarkPaid = compensationAmount > 0;

                        return (
                          <tr key={`${entry.activity_type}-${idx}`} style={{ borderTop: idx === 0 ? 'none' : '1px solid #f1f1f1' }}>
                            <td style={{ padding: '8px 10px', wordBreak: 'break-word' }}>{isMaintenance ? (entry.processed_by || '-') : (entry.person_name || '-')}</td>
                            <td style={{ padding: '8px 10px' }}>
                              <span style={{
                                fontWeight: 700,
                                textTransform: 'capitalize',
                                color: isMaintenance ? '#f57c00' : '#666'
                              }}>
                                {entry.activity_type === 'ready_to_pickup' ? 'Ready To Pickup' : entry.activity_type.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td style={{ padding: '8px 10px', textTransform: 'capitalize' }}>
                              {isMaintenance ? issueTypeLabel : 'N/A'}
                            </td>
                            <td style={{ padding: '8px 10px', textTransform: 'capitalize' }}>
                              {isMaintenance && issueType === 'damage' && entry.damage_level ? (
                                <span style={{
                                  color: entry.damage_level === 'severe' ? '#d32f2f' : entry.damage_level === 'moderate' ? '#f57c00' : '#fbc02d',
                                  fontWeight: 600
                                }}>
                                  {entry.damage_level}
                                </span>
                              ) : 'N/A'}
                            </td>
                            <td style={{ padding: '8px 10px', wordBreak: 'break-word' }}>{entry.damage_note || 'N/A'}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>{entry.quantity || 0}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: compensationAmount > 0 ? '#6d4c41' : '#888' }}>
                              {isMaintenance ? `₱${compensationAmount.toFixed(2)}` : 'N/A'}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              {isMaintenance ? (
                                <span style={{
                                  display: 'inline-block',
                                  minWidth: '72px',
                                  padding: '4px 8px',
                                  borderRadius: '999px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  background: paymentStatus === 'paid' ? '#e8f5e9' : '#ffebee',
                                  color: paymentStatus === 'paid' ? '#2e7d32' : '#c62828'
                                }}>
                                  {paymentStatus}
                                </span>
                              ) : 'N/A'}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              {isMaintenance && entry.log_id ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
                                    <button
                                      onClick={() => handleSetDamageCharge(entry)}
                                      style={{
                                        padding: '4px 10px',
                                        backgroundColor: '#8B4513',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap'
                                      }}
                                      title="Set amount to collect from customer"
                                    >
                                      Set Amount
                                    </button>
                                    <button
                                      onClick={() => handleDamagePaymentStatusChange(entry, paymentStatus === 'paid' ? 'unpaid' : 'paid')}
                                      disabled={!canMarkPaid && paymentStatus !== 'paid'}
                                      style={{
                                        padding: '4px 10px',
                                        backgroundColor: paymentStatus === 'paid' ? '#9e9e9e' : '#1976d2',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        cursor: (!canMarkPaid && paymentStatus !== 'paid') ? 'not-allowed' : 'pointer',
                                        whiteSpace: 'nowrap',
                                        opacity: (!canMarkPaid && paymentStatus !== 'paid') ? 0.7 : 1
                                      }}
                                      title={paymentStatus === 'paid' ? 'Mark this issue as unpaid' : 'Mark this issue as paid'}
                                    >
                                      {paymentStatus === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
                                    </button>
                                  </div>
                                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
                                    <input
                                      type="number"
                                      min="1"
                                      max={entry.quantity}
                                      value={resolveQty}
                                      onChange={(e) => handleMaintenanceUpdate(entry.log_id, 'quantity', e.target.value)}
                                      style={{
                                        width: '60px',
                                        padding: '4px 6px',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        fontSize: '12px'
                                      }}
                                      title="Quantity to move to available"
                                    />
                                    <button
                                      onClick={() => handleResolveMaintenance(entry.log_id, entry.quantity)}
                                      style={{
                                        padding: '4px 12px',
                                        backgroundColor: '#4caf50',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap'
                                      }}
                                      title="Move to available"
                                    >
                                      ✓ Fix
                                    </button>
                                  </div>
                                </div>
                              ) : '-'}
                            </td>
                          </tr>
                        );
                      })}
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

      {/* Settlement Details Modal */}
      {showSettlementModal && selectedSettlementIncident && (
        <div className="modal-overlay active" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) setShowSettlementModal(false); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Settlement Details</h2>
              <span className="close-modal" onClick={() => setShowSettlementModal(false)}>×</span>
            </div>
            <div className="modal-body">
              <div className="detail-row">
                <label>Customer Name:</label>
                <span>{getIncidentCustomerName(selectedSettlementIncident)}</span>
              </div>
              <div className="detail-row">
                <label>Handled By:</label>
                <span>{getIncidentHandledBy(selectedSettlementIncident)}</span>
              </div>
              <div className="detail-row">
                <label>Service Type:</label>
                <span>{formatServiceTypeLabel(selectedSettlementIncident.service_type)}</span>
              </div>
              <div className="detail-row">
                <label>Damage Type:</label>
                <span style={{ textTransform: 'capitalize' }}>
                  {String(selectedSettlementIncident.damage_type || 'N/A').replace(/_/g, ' ')}
                </span>
              </div>
              <div className="detail-row">
                <label>Incident:</label>
                <span>{selectedSettlementIncident.damage_description || 'N/A'}</span>
              </div>
              <div className="detail-row">
                <label>Order Item ID:</label>
                <span>{selectedSettlementIncident.order_item_id || 'N/A'}</span>
              </div>
              <div className="detail-row">
                <label>Amount:</label>
                <span style={{ color: '#c41c3b', fontWeight: 'bold', fontSize: '18px' }}>
                  ₱{parseFloat(selectedSettlementIncident.compensation_amount || 0).toLocaleString()}
                </span>
              </div>
              <div className="detail-row">
                <label>Liability Status:</label>
                <span className={`badge liability-${selectedSettlementIncident.liability_status}`}>
                  {selectedSettlementIncident.liability_status}
                </span>
              </div>
              <div className="detail-row">
                <label>Payment Status:</label>
                <span className={`badge status-${selectedSettlementIncident.compensation_status}`}>
                  {selectedSettlementIncident.compensation_status}
                </span>
              </div>
              <div className="detail-row">
                <label>Paid At:</label>
                <span>{selectedSettlementIncident.compensation_paid_at
                  ? new Date(selectedSettlementIncident.compensation_paid_at).toLocaleString()
                  : 'N/A'
                }</span>
              </div>
              <div className="detail-row">
                <label>Payment Reference:</label>
                <span>{selectedSettlementIncident.payment_reference || 'N/A'}</span>
              </div>
              {getIncidentDetailLines(selectedSettlementIncident).length > 0 && (
                <div className="detail-row">
                  <label>Details:</label>
                  <span>
                    {getIncidentDetailLines(selectedSettlementIncident).map((line, index) => (
                      <div key={`settlement-line-${index}`}>{line}</div>
                    ))}
                  </span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setShowSettlementModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersInventory;
