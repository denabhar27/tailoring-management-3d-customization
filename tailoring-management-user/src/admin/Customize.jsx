import { useState, useEffect } from 'react';

import { useNavigate } from 'react-router-dom';

import { API_BASE_URL } from '../api/config';

import '../adminStyle/customize.css';

import AdminHeader from './AdminHeader';

import Sidebar from './Sidebar';

import { getAllCustomizationOrders, updateCustomizationOrderItem, uploadGLBFile, getAllCustom3DModels, deleteCustom3DModel } from '../api/CustomizationApi';

import { getUserRole } from '../api/AuthApi';

import { getAllFabricTypesAdmin, createFabricType, updateFabricType, deleteFabricType } from '../api/FabricTypeApi';

import { getAllGarmentTypesAdmin, createGarmentType, updateGarmentType, deleteGarmentType } from '../api/GarmentTypeApi';

import { getAllPatterns, uploadPatternImage, createPattern, updatePattern, deletePattern } from '../api/PatternApi';

import ImagePreviewModal from '../components/ImagePreviewModal';

import { getMeasurements, saveMeasurements } from '../api/CustomerApi';

import { useAlert } from '../context/AlertContext';

import { recordPayment } from '../api/PaymentApi';

import { deleteOrderItem } from '../api/OrderApi';

const isAuthenticated = () => {

  return !!localStorage.getItem('token');

};

const Customize = () => {

  const { alert, confirm } = useAlert();

  const navigate = useNavigate();

  const [allItems, setAllItems] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');

  const [statusFilter, setStatusFilter] = useState('');

  const [viewFilter, setViewFilter] = useState("all");

  const [showDetailModal, setShowDetailModal] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState(null);

  const [editForm, setEditForm] = useState({

    finalPrice: '',

    approvalStatus: '',

    adminNotes: ''

  });

  const [showMeasurementsModal, setShowMeasurementsModal] = useState(false);

  const [measurements, setMeasurements] = useState({

    top: {},

    bottom: {},

    notes: ''

  });

  const [measurementsLoading, setMeasurementsLoading] = useState(false);

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const [confirmAction, setConfirmAction] = useState(null);

  const [confirmMessage, setConfirmMessage] = useState('');

  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [paymentAmount, setPaymentAmount] = useState('');

  const [cashReceived, setCashReceived] = useState('');

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const [showPriceConfirmationModal, setShowPriceConfirmationModal] = useState(false);

  const [priceConfirmationItem, setPriceConfirmationItem] = useState(null);

  const [priceConfirmationPrice, setPriceConfirmationPrice] = useState('');

  const [priceConfirmationReason, setPriceConfirmationReason] = useState('');

  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);

  const [previewImageUrl, setPreviewImageUrl] = useState('');

  const [previewImageAlt, setPreviewImageAlt] = useState('');

  const [showGLBUploadModal, setShowGLBUploadModal] = useState(false);

  const [glbFile, setGlbFile] = useState(null);

  const [glbFormData, setGlbFormData] = useState({

    model_name: '',

    model_type: 'garment',

    garment_category: '',

    description: ''

  });

  const [uploadingGLB, setUploadingGLB] = useState(false);

  const [customModels, setCustomModels] = useState([]);

  const [showFabricTypeModal, setShowFabricTypeModal] = useState(false);

  const [fabricTypes, setFabricTypes] = useState([]);

  const [fabricTypeForm, setFabricTypeForm] = useState({

    fabric_name: '',

    fabric_price: '',

    description: '',

    is_active: 1

  });

  const [editingFabricType, setEditingFabricType] = useState(null);

  const [loadingFabricTypes, setLoadingFabricTypes] = useState(false);

  const [showGarmentTypeModal, setShowGarmentTypeModal] = useState(false);

  const [garmentTypes, setGarmentTypes] = useState([]);

  const [garmentTypeForm, setGarmentTypeForm] = useState({

    garment_name: '',

    garment_price: '',

    garment_code: '',

    description: '',

    is_active: 1

  });

  const [editingGarmentType, setEditingGarmentType] = useState(null);

  const [loadingGarmentTypes, setLoadingGarmentTypes] = useState(false);

  const [garmentGlbFile, setGarmentGlbFile] = useState(null);

  const [uploadingGarmentGlb, setUploadingGarmentGlb] = useState(false);

  const [showPatternModal, setShowPatternModal] = useState(false);

  const [patterns, setPatterns] = useState([]);

  const [patternForm, setPatternForm] = useState({

    pattern_code: '',

    pattern_name: '',

    pattern_type: 'image',

    repeat_x: 2.0,

    repeat_y: 2.0,

    description: '',

    is_active: 1,

    make_seamless: true,

    texture_size: 512,

    pattern_scale: 'medium'

  });

  const [editingPattern, setEditingPattern] = useState(null);

  const [loadingPatterns, setLoadingPatterns] = useState(false);

  const [patternImageFile, setPatternImageFile] = useState(null);

  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showSizeModal, setShowSizeModal] = useState(false);
  const [sizeModalGarmentId, setSizeModalGarmentId] = useState('');
  const [sizeModalMeasurements, setSizeModalMeasurements] = useState([]);
  const [sizeModalSizeChart, setSizeModalSizeChart] = useState({});
  const [sizeModalNewSize, setSizeModalNewSize] = useState('');
  const [sizeModalCustomLabel, setSizeModalCustomLabel] = useState('');
  const [sizeModalCustomUnit, setSizeModalCustomUnit] = useState('inches');

  const [patternImagePreview, setPatternImagePreview] = useState(null);

  const [uploadingPattern, setUploadingPattern] = useState(false);

  const COMMON_MEASUREMENTS = [
    { field: 'chest', label: 'Chest', unit: 'inches' },
    { field: 'waist', label: 'Waist', unit: 'inches' },
    { field: 'hips', label: 'Hips', unit: 'inches' },
    { field: 'shoulders', label: 'Shoulders', unit: 'inches' },
    { field: 'sleeveLength', label: 'Sleeve Length', unit: 'inches' },
    { field: 'neck', label: 'Neck', unit: 'inches' },
    { field: 'backLength', label: 'Back Length', unit: 'inches' },
    { field: 'length', label: 'Length', unit: 'inches' },
    { field: 'inseam', label: 'Inseam', unit: 'inches' },
    { field: 'outseam', label: 'Outseam', unit: 'inches' },
    { field: 'thigh', label: 'Thigh', unit: 'inches' },
    { field: 'cuff', label: 'Cuff/Bottom', unit: 'inches' }
  ];

  const defaultGarmentCategories = [

    { value: 'coat-men', label: 'Blazer' },

    { value: 'barong', label: 'Barong' },

    { value: 'suit-1', label: 'Suit' },

    { value: 'pants', label: 'Pants' }

  ];

  const openImagePreview = (url, alt) => {

    setPreviewImageUrl(url);

    setPreviewImageAlt(alt);

    setImagePreviewOpen(true);

  };

  const closeImagePreview = () => {

    setImagePreviewOpen(false);

    setPreviewImageUrl('');

    setPreviewImageAlt('');

  };

  const showToast = (message, type = 'success') => {

    setToast({ show: true, message, type });

    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);

  };

  const openConfirmModal = (message, action) => {

    setConfirmMessage(message);

    setConfirmAction(() => action);

    setShowConfirmModal(true);

  };

  const handleConfirm = () => {

    if (confirmAction) confirmAction();

    setShowConfirmModal(false);

    setConfirmAction(null);

  };

  useEffect(() => {

    const handleClickOutside = (event) => {

      if (showAddMenu && !event.target.closest('[data-add-menu]')) {

        setShowAddMenu(false);

      }

    };

    if (showAddMenu) {

      document.addEventListener('mousedown', handleClickOutside);

    }

    return () => {

      document.removeEventListener('mousedown', handleClickOutside);

    };

  }, [showAddMenu]);

  useEffect(() => {

    if (!isAuthenticated()) {

      setError('Please log in to access this page');

      navigate('/login');

      return;

    }

    const role = getUserRole();

    if (role !== 'admin' && role !== 'clerk') {

      setError('Access restricted');

      navigate('/');

      return;

    }

  }, [navigate]);

  const getStatusClass = (status) => {

    const statusMap = {

      'pending_review': 'pending',

      'pending': 'pending',

      'accepted': 'accepted',

      'price_confirmation': 'price-confirmation',

      'confirmed': 'in-progress',

      'ready_for_pickup': 'to-pickup',

      'completed': 'completed',

      'cancelled': 'rejected',

      'auto_confirmed': 'in-progress'

    };

    return statusMap[status] || 'pending';

  };

  const getStatusText = (status) => {

    const statusTextMap = {

      'pending_review': 'Pending',

      'pending': 'Pending',

      'accepted': 'Accepted',

      'price_confirmation': 'Price Confirmation',

      'confirmed': 'In Progress',

      'ready_for_pickup': 'To Pick up',

      'completed': 'Completed',

      'cancelled': 'Rejected',

      'auto_confirmed': 'In Progress'

    };

    return statusTextMap[status] || 'Pending';

  };

  const getNextStatus = (currentStatus, serviceType = 'customization', item = null) => {

    if (!currentStatus || currentStatus === 'pending_review' || currentStatus === 'pending') {

      return 'price_confirmation';

    }

    if (currentStatus === 'price_confirmation') {

      return 'accepted';

    }

    if (currentStatus === 'accepted') {

      return 'confirmed';

    }

    const statusFlow = {

      'repair': ['pending', 'price_confirmation', 'accepted', 'confirmed', 'ready_for_pickup', 'completed'],

      'customization': ['pending', 'price_confirmation', 'accepted', 'confirmed', 'ready_for_pickup', 'completed'],

      'dry_cleaning': ['pending', 'price_confirmation', 'accepted', 'confirmed', 'ready_for_pickup', 'completed'],

      'rental': ['pending', 'ready_for_pickup', 'picked_up', 'rented', 'returned', 'completed']

    };

    const flow = statusFlow[serviceType] || statusFlow['customization'];

    const currentIndex = flow.indexOf(currentStatus);

    if (currentIndex === -1 || currentIndex === flow.length - 1) {

      return null;

    }

    const nextStatus = flow[currentIndex + 1];

    if (nextStatus === 'completed' && item) {

      const pricingFactors = typeof item.pricing_factors === 'string'

        ? JSON.parse(item.pricing_factors || '{}')

        : (item.pricing_factors || {});

      const amountPaid = parseFloat(pricingFactors.amount_paid || 0);

      const finalPrice = parseFloat(item.final_price || 0);

      const remainingBalance = finalPrice - amountPaid;

      if (remainingBalance > 0.01) {

        return null;

      }

    }

    return nextStatus;

  };

  const getNextStatusLabel = (currentStatus, serviceType = 'customization', item = null) => {

    const nextStatus = getNextStatus(currentStatus, serviceType, item);

    if (!nextStatus) return null;

    const labelMap = {

      'accepted': 'Accept',

      'price_confirmation': 'Price Confirm',

      'confirmed': 'Start Progress',

      'ready_for_pickup': 'Ready for Pickup',

      'completed': 'Complete',

      'picked_up': 'Mark Picked Up',

      'rented': 'Mark Rented',

      'returned': 'Mark Returned'

    };

    return labelMap[nextStatus] || getStatusText(nextStatus);

  };

  useEffect(() => {

    const role = getUserRole();

    if (isAuthenticated() && (role === 'admin' || role === 'clerk')) {

      loadCustomizationOrders();

      loadCustom3DModels();

      loadFabricTypes();

      loadGarmentTypes();

      loadPatterns();

    }

  }, []);

  const loadFabricTypes = async () => {

    setLoadingFabricTypes(true);

    try {

      const result = await getAllFabricTypesAdmin();

      if (result.success) {

        setFabricTypes(result.fabrics || []);

      } else {

        showToast(result.message || 'Failed to load fabric types', 'error');

      }

    } catch (err) {

      console.error("Load fabric types error:", err);

      showToast('Failed to load fabric types', 'error');

    } finally {

      setLoadingFabricTypes(false);

    }

  };

  const handleFabricTypeSubmit = async () => {

    if (!fabricTypeForm.fabric_name.trim()) {

      showToast('Please enter a fabric name', 'error');

      return;

    }

    if (!fabricTypeForm.fabric_price || isNaN(parseFloat(fabricTypeForm.fabric_price))) {

      showToast('Please enter a valid price', 'error');

      return;

    }

    try {

      let result;

      if (editingFabricType) {

        result = await updateFabricType(editingFabricType.fabric_id, fabricTypeForm);

      } else {

        result = await createFabricType(fabricTypeForm);

      }

      if (result.success) {

        showToast(editingFabricType ? 'Fabric type updated successfully!' : 'Fabric type created successfully!', 'success');

        setShowFabricTypeModal(false);

        setFabricTypeForm({ fabric_name: '', fabric_price: '', description: '', is_active: 1 });

        setEditingFabricType(null);

        await loadFabricTypes();

      } else {

        showToast(result.message || 'Failed to save fabric type', 'error');

      }

    } catch (err) {

      console.error("Save fabric type error:", err);

      showToast('Failed to save fabric type', 'error');

    }

  };

  const handleDeleteFabricType = async (fabricId) => {

    openConfirmModal("Are you sure you want to delete this fabric type? This action cannot be undone.", async () => {

      try {

        const result = await deleteFabricType(fabricId);

        if (result.success) {

          showToast('Fabric type deleted successfully', 'success');

          setFabricTypes(prevFabrics => prevFabrics.filter(fabric => fabric.fabric_id !== fabricId));

          await loadFabricTypes();

        } else {

          showToast(result.message || 'Failed to delete fabric type', 'error');

        }

      } catch (err) {

        console.error("Delete fabric type error:", err);

        showToast('Failed to delete fabric type', 'error');

        await loadFabricTypes();

      }

    });

  };

  const openEditFabricType = (fabric) => {

    setEditingFabricType(fabric);

    setFabricTypeForm({

      fabric_name: fabric.fabric_name,

      fabric_price: fabric.fabric_price,

      description: fabric.description || '',

      is_active: fabric.is_active

    });

    setShowFabricTypeModal(true);

  };

  const openNewFabricType = () => {

    setEditingFabricType(null);

    setFabricTypeForm({ fabric_name: '', fabric_price: '', description: '', is_active: 1 });

    setShowFabricTypeModal(true);

  };

  const loadGarmentTypes = async () => {

    setLoadingGarmentTypes(true);

    try {

      const result = await getAllGarmentTypesAdmin();

      if (result.success) {

        setGarmentTypes(result.garments || []);

      } else {

        showToast(result.message || 'Failed to load garment types', 'error');

      }

    } catch (err) {

      console.error("Load garment types error:", err);

      showToast('Failed to load garment types', 'error');

    } finally {

      setLoadingGarmentTypes(false);

    }

  };

  const handleGarmentTypeSubmit = async () => {

    if (!garmentTypeForm.garment_name.trim()) {

      showToast('Please enter a garment name', 'error');

      return;

    }

    if (!garmentTypeForm.garment_price || isNaN(parseFloat(garmentTypeForm.garment_price))) {

      showToast('Please enter a valid price', 'error');

      return;

    }

    if (!garmentTypeForm.garment_code.trim()) {

      showToast('Please enter a garment code', 'error');

      return;

    }

    if (!editingGarmentType && !garmentGlbFile) {

      showToast('Please upload a 3D model (GLB file) for this garment type', 'error');

      return;

    }

    setUploadingGarmentGlb(true);

    try {

      let result;
      const submitPayload = {
        ...garmentTypeForm,
        measurement_fields: parseJSONField(editingGarmentType?.measurement_fields, null),
        size_chart: parseJSONField(editingGarmentType?.size_chart, null)
      };

      if (editingGarmentType) {

        result = await updateGarmentType(editingGarmentType.garment_id, submitPayload);

      } else {

        result = await createGarmentType(submitPayload);

      }

      if (result.success) {

        if (garmentGlbFile) {

          const glbFormData = {

            model_name: garmentTypeForm.garment_name,

            model_type: 'garment',

            garment_category: garmentTypeForm.garment_code,

            description: garmentTypeForm.description || `3D model for ${garmentTypeForm.garment_name}`

          };

          const uploadResult = await uploadGLBFile(garmentGlbFile, glbFormData);

          if (!uploadResult.success) {

            showToast('Garment type saved but failed to upload 3D model: ' + (uploadResult.message || 'Unknown error'), 'warning');

          } else {

            await loadCustom3DModels();

          }

        }

        showToast(editingGarmentType ? 'Garment type updated successfully!' : 'Garment type created successfully!', 'success');

        setShowGarmentTypeModal(false);

        setGarmentTypeForm({ garment_name: '', garment_price: '', garment_code: '', description: '', is_active: 1 });

        setGarmentGlbFile(null);

        setEditingGarmentType(null);

        await loadGarmentTypes();

      } else {

        showToast(result.message || 'Failed to save garment type', 'error');

      }

    } catch (err) {

      console.error("Save garment type error:", err);

      showToast('Failed to save garment type', 'error');

    } finally {

      setUploadingGarmentGlb(false);

    }

  };

  const handleGarmentGlbFileChange = (e) => {

    const file = e.target.files[0];

    if (file) {

      if (!file.name.toLowerCase().endsWith('.glb')) {

        showToast('Please select a valid GLB file', 'error');

        return;

      }

      if (file.size > 50 * 1024 * 1024) {

        showToast('File size must be less than 50MB', 'error');

        return;

      }

      setGarmentGlbFile(file);

    }

  };

  const handleDeleteGarmentType = async (garmentId) => {

    openConfirmModal("Are you sure you want to delete this garment type? This action cannot be undone.", async () => {

      try {

        const result = await deleteGarmentType(garmentId);

        if (result.success) {

          showToast('Garment type deleted successfully', 'success');

          setGarmentTypes(prevGarments => prevGarments.filter(garment => garment.garment_id !== garmentId));

          await loadGarmentTypes();

        } else {

          showToast(result.message || 'Failed to delete garment type', 'error');

        }

      } catch (err) {

        console.error("Delete garment type error:", err);

        showToast('Failed to delete garment type', 'error');

        await loadGarmentTypes();

      }

    });

  };

  const openEditGarmentType = (garment) => {

    setEditingGarmentType(garment);

    setGarmentTypeForm({

      garment_name: garment.garment_name,

      garment_price: garment.garment_price,

      garment_code: garment.garment_code || '',

      description: garment.description || '',

      is_active: garment.is_active

    });

    setGarmentGlbFile(null);

    setShowGarmentTypeModal(true);

  };

  const openNewGarmentType = () => {

    setEditingGarmentType(null);

    setGarmentTypeForm({ garment_name: '', garment_price: '', garment_code: '', description: '', is_active: 1 });

    setGarmentGlbFile(null);

    setShowGarmentTypeModal(true);

  };

  const parseJSONField = (value, fallback) => {
    if (!value) return fallback;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch (e) {
      return fallback;
    }
  };

  const getSelectedSizeModalGarment = () => garmentTypes.find(g => String(g.garment_id) === String(sizeModalGarmentId));

  const openSizeModal = (garmentId = '') => {
    const selectedId = garmentId || (garmentTypes[0]?.garment_id ? String(garmentTypes[0].garment_id) : '');
    setSizeModalGarmentId(selectedId);
    const selectedGarment = garmentTypes.find(g => String(g.garment_id) === String(selectedId));
    setSizeModalMeasurements(parseJSONField(selectedGarment?.measurement_fields, []));
    setSizeModalSizeChart(parseJSONField(selectedGarment?.size_chart, {}));
    setSizeModalNewSize('');
    setSizeModalCustomLabel('');
    setSizeModalCustomUnit('inches');
    setShowSizeModal(true);
  };

  const onChangeSizeModalGarment = (garmentId) => {
    setSizeModalGarmentId(garmentId);
    const selectedGarment = garmentTypes.find(g => String(g.garment_id) === String(garmentId));
    setSizeModalMeasurements(parseJSONField(selectedGarment?.measurement_fields, []));
    setSizeModalSizeChart(parseJSONField(selectedGarment?.size_chart, {}));
  };

  const addMeasurementToSizeModal = (measurement) => {
    const exists = sizeModalMeasurements.some(m => m.field === measurement.field);
    if (exists) return;
    setSizeModalMeasurements(prev => [...prev, measurement]);
  };

  const removeMeasurementFromSizeModal = (field) => {
    setSizeModalMeasurements(prev => prev.filter(m => m.field !== field));
    setSizeModalSizeChart(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(sizeKey => {
        if (next[sizeKey] && next[sizeKey][field] !== undefined) {
          const { [field]: _removed, ...rest } = next[sizeKey];
          next[sizeKey] = rest;
        }
      });
      return next;
    });
  };

  const addCustomMeasurementToSizeModal = () => {
    if (!sizeModalCustomLabel.trim()) return;
    const field = sizeModalCustomLabel.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!field) return;
    if (sizeModalMeasurements.some(m => m.field === field)) return;
    setSizeModalMeasurements(prev => [...prev, { field, label: sizeModalCustomLabel.trim(), unit: sizeModalCustomUnit }]);
    setSizeModalCustomLabel('');
  };

  const addSizeToSizeModal = () => {
    const sizeKey = sizeModalNewSize.trim().toLowerCase().replace(/\s+/g, '-');
    if (!sizeKey) return;
    if (sizeModalSizeChart[sizeKey]) return;
    setSizeModalSizeChart(prev => ({ ...prev, [sizeKey]: {} }));
    setSizeModalNewSize('');
  };

  const removeSizeFromSizeModal = (sizeKey) => {
    setSizeModalSizeChart(prev => {
      const { [sizeKey]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const updateSizeModalValue = (sizeKey, field, value) => {
    setSizeModalSizeChart(prev => ({
      ...prev,
      [sizeKey]: {
        ...(prev[sizeKey] || {}),
        [field]: value === '' ? '' : (parseFloat(value) || 0)
      }
    }));
  };

  const handleSaveSizeModal = async () => {
    const selectedGarment = getSelectedSizeModalGarment();
    if (!selectedGarment) {
      showToast('Please select a garment type', 'error');
      return;
    }
    try {
      const payload = {
        garment_name: selectedGarment.garment_name,
        garment_price: selectedGarment.garment_price,
        garment_code: selectedGarment.garment_code || '',
        description: selectedGarment.description || '',
        is_active: selectedGarment.is_active,
        measurement_fields: sizeModalMeasurements,
        size_chart: sizeModalSizeChart
      };
      const result = await updateGarmentType(selectedGarment.garment_id, payload);
      if (!result.success) {
        showToast(result.message || 'Failed to save sizes', 'error');
        return;
      }
      showToast('Sizes and measurements saved successfully!', 'success');
      await loadGarmentTypes();
      setShowSizeModal(false);
    } catch (err) {
      console.error('Save size modal error:', err);
      showToast('Failed to save sizes', 'error');
    }
  };

  const loadPatterns = async () => {

    setLoadingPatterns(true);

    try {

      const result = await getAllPatterns();

      if (result.success) {

        const sortedPatterns = (result.patterns || []).sort((a, b) => {

          const defaultPatterns = ['none', 'minimal-stripe', 'minimal-check', 'embroidery-1', 'embroidery-2'];

          const aIsDefault = defaultPatterns.includes(a.pattern_code);

          const bIsDefault = defaultPatterns.includes(b.pattern_code);

          if (aIsDefault && !bIsDefault) return -1;

          if (!aIsDefault && bIsDefault) return 1;

          if (aIsDefault && bIsDefault) {

            return (a.sort_order || 0) - (b.sort_order || 0);

          }

          return (a.pattern_name || '').localeCompare(b.pattern_name || '');

        });

        setPatterns(sortedPatterns);

      } else {

        showToast(result.message || 'Failed to load patterns', 'error');

      }

    } catch (err) {

      console.error("Load patterns error:", err);

      showToast('Failed to load patterns', 'error');

    } finally {

      setLoadingPatterns(false);

    }

  };

  const handlePatternImageChange = (e) => {

    const file = e.target.files[0];

    if (file) {

      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

      if (!allowedTypes.includes(file.type)) {

        showToast('Please select an image file (JPEG, PNG, GIF, WebP, or SVG)', 'error');

        return;

      }

      if (file.size > 10 * 1024 * 1024) {

        showToast('File size must be less than 10MB', 'error');

        return;

      }

      setPatternImageFile(file);

      const reader = new FileReader();

      reader.onload = (e) => {

        setPatternImagePreview(e.target.result);

      };

      reader.readAsDataURL(file);

    }

  };

  const generatePatternCode = (name) => {

    const baseName = name.toLowerCase()

      .replace(/[^a-z0-9\s]/g, '')

      .replace(/\s+/g, '-')

      .substring(0, 30);

    const timestamp = Date.now().toString(36);

    return `${baseName}-${timestamp}`;

  };

  const handlePatternSubmit = async () => {

    if (!patternForm.pattern_name.trim()) {

      showToast('Please enter a pattern name', 'error');

      return;

    }

    let code = patternForm.pattern_code.trim();

    if (!code || !editingPattern) {

      code = generatePatternCode(patternForm.pattern_name);

    }

    if (!editingPattern && !patternImageFile) {

      showToast('Please select a pattern image', 'error');

      return;

    }

    setUploadingPattern(true);

    try {

      let result;

      if (editingPattern) {

        const updateData = {

          pattern_name: patternForm.pattern_name,

          pattern_code: code,

          repeat_x: parseFloat(patternForm.repeat_x) || 2.0,

          repeat_y: parseFloat(patternForm.repeat_y) || 2.0,

          description: patternForm.description,

          is_active: patternForm.is_active

        };

        result = await updatePattern(editingPattern.pattern_id, updateData, patternImageFile);

      } else {

        const patternData = {

          pattern_code: code,

          pattern_name: patternForm.pattern_name,

          repeat_x: parseFloat(patternForm.repeat_x) || 2.0,

          repeat_y: parseFloat(patternForm.repeat_y) || 2.0,

          description: patternForm.description,

          make_seamless: patternForm.make_seamless,

          texture_size: patternForm.texture_size,

          pattern_scale: patternForm.pattern_scale

        };

        result = await uploadPatternImage(patternImageFile, patternData);

        if (result.success && result.isSeamless) {

          showToast('Pattern processed into seamless texture!', 'info');

        }

      }

      if (result.success) {

        showToast(editingPattern ? 'Pattern updated successfully' : 'Pattern added successfully', 'success');

        await loadPatterns();

        resetPatternForm();

      } else {

        showToast(result.message || 'Failed to save pattern', 'error');

      }

    } catch (err) {

      console.error("Pattern submit error:", err);

      showToast('Failed to save pattern', 'error');

    } finally {

      setUploadingPattern(false);

    }

  };

  const resetPatternForm = () => {

    setPatternForm({

      pattern_code: '',

      pattern_name: '',

      pattern_type: 'image',

      repeat_x: 2.0,

      repeat_y: 2.0,

      description: '',

      is_active: 1,

      make_seamless: true,

      texture_size: 512,

      pattern_scale: 'medium'

    });

    setPatternImageFile(null);

    setPatternImagePreview(null);

    setEditingPattern(null);

  };

  const handleDeletePattern = async (patternId, patternCode) => {

    const defaultPatterns = ['none', 'minimal-stripe', 'minimal-check', 'embroidery-1', 'embroidery-2'];

    if (defaultPatterns.includes(patternCode)) {

      showToast('Cannot delete default patterns', 'error');

      return;

    }

    openConfirmModal("Are you sure you want to delete this pattern? This action cannot be undone.", async () => {

      try {

        const result = await deletePattern(patternId);

        if (result.success) {

          showToast('Pattern deleted successfully', 'success');

          await loadPatterns();

        } else {

          showToast(result.message || 'Failed to delete pattern', 'error');

        }

      } catch (err) {

        console.error("Delete pattern error:", err);

        showToast('Failed to delete pattern', 'error');

      }

    });

  };

  const openEditPattern = (pattern) => {

    setEditingPattern(pattern);

    setPatternForm({

      pattern_code: pattern.pattern_code,

      pattern_name: pattern.pattern_name,

      pattern_type: pattern.pattern_type,

      repeat_x: parseFloat(pattern.repeat_x) || 2.0,

      repeat_y: parseFloat(pattern.repeat_y) || 2.0,

      description: pattern.description || '',

      is_active: pattern.is_active,

      make_seamless: true,

      texture_size: 512,

      pattern_scale: 'medium'

    });

    setPatternImageFile(null);

    if (pattern.image_url) {

      setPatternImagePreview(`${API_BASE_URL}${pattern.image_url}`);

    } else {

      setPatternImagePreview(null);

    }

    setShowPatternModal(true);

  };

  const openNewPattern = () => {

    resetPatternForm();

    setShowPatternModal(true);

  };

  const getPatternImageUrl = (pattern) => {

    if (!pattern.image_url) return null;

    if (pattern.image_url.startsWith('http')) return pattern.image_url;

    return `${API_BASE_URL}${pattern.image_url}`;

  };

  const getCustomizationGarments = (specificData) => {
    return Array.isArray(specificData?.garments) ? specificData.garments : [];
  };

  const getGarmentSummaryText = (specificData) => {
    const garments = getCustomizationGarments(specificData);
    if (!garments.length) {
      return specificData?.garmentType || 'N/A';
    }

    const names = garments
      .map((g) => (g?.garmentType || '').trim())
      .filter(Boolean);

    if (!names.length) {
      return `${garments.length} item${garments.length > 1 ? 's' : ''}`;
    }

    const uniqueNames = [...new Set(names)];
    if (uniqueNames.length === 1) {
      return `${uniqueNames[0]} x${garments.length}`;
    }

    const preview = uniqueNames.slice(0, 2).join(', ');
    return uniqueNames.length > 2 ? `${preview} +${uniqueNames.length - 2} more` : preview;
  };

  const getFabricSummaryText = (specificData) => {
    const garments = getCustomizationGarments(specificData);
    if (!garments.length) {
      return specificData?.fabricType || 'N/A';
    }

    const fabrics = garments
      .map((g) => (g?.fabricType || '').trim())
      .filter(Boolean);

    if (!fabrics.length) {
      return specificData?.fabricType || 'N/A';
    }

    const uniqueFabrics = [...new Set(fabrics)];
    return uniqueFabrics.join(', ');
  };

  const getDisplayImageUrl = (url) => {
    if (!url || typeof url !== 'string') return '';
    if (url.startsWith('data:image') || url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `${API_BASE_URL}${url}`;
  };

  const parseDesignData = (value) => {
    if (!value) return null;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }
    return null;
  };

  const getAllGarmentCategories = () => {

    const categories = [...defaultGarmentCategories];

    garmentTypes.forEach(garment => {

      if (garment.is_active && garment.garment_code) {

        const exists = categories.find(c => c.value === garment.garment_code);

        if (!exists) {

          categories.push({

            value: garment.garment_code,

            label: garment.garment_name

          });

        }

      }

    });

    return categories;

  };

  const loadCustom3DModels = async () => {

    try {

      const result = await getAllCustom3DModels();

      if (result.success) {

        setCustomModels(result.models || []);

      }

    } catch (err) {

      console.error("Load custom 3D models error:", err);

    }

  };

  const handleGLBFileChange = (e) => {

    const file = e.target.files[0];

    if (file) {

      if (!file.name.toLowerCase().endsWith('.glb')) {

        showToast('Please select a GLB file', 'error');

        return;

      }

      if (file.size > 50 * 1024 * 1024) {

        showToast('File size must be less than 50MB', 'error');

        return;

      }

      setGlbFile(file);

    }

  };

  const handleGLBUpload = async () => {

    if (!glbFile) {

      showToast('Please select a GLB file', 'error');

      return;

    }

    if (!glbFormData.model_name.trim()) {

      showToast('Please enter a model name', 'error');

      return;

    }

    if (glbFormData.model_type === 'garment' && !glbFormData.garment_category) {

      showToast('Please select a garment type (Blazer, Barong, Suit, or Pants)', 'error');

      return;

    }

    if (!isAuthenticated()) {

      showToast('Please log in to upload files', 'error');

      navigate('/login');

      return;

    }

    const token = localStorage.getItem('token');

    if (!token) {

      showToast('Authentication token not found. Please log in again.', 'error');

      navigate('/login');

      return;

    }

    setUploadingGLB(true);

    try {

      const result = await uploadGLBFile(glbFile, glbFormData);

      if (result.success) {

        showToast('GLB file uploaded successfully!', 'success');

        setShowGLBUploadModal(false);

        setGlbFile(null);

        setGlbFormData({

          model_name: '',

          model_type: 'garment',

          garment_category: '',

          description: ''

        });

        await loadCustom3DModels();

      } else {

        if (result.requiresAuth) {

          showToast('Session expired. Please log in again.', 'error');

          setTimeout(() => {

            navigate('/login');

          }, 2000);

        } else {

          showToast(result.message || 'Failed to upload GLB file', 'error');

        }

      }

    } catch (err) {

      console.error("Upload GLB error:", err);

      showToast('Failed to upload GLB file', 'error');

    } finally {

      setUploadingGLB(false);

    }

  };

  const handleDeleteModel = async (modelId) => {

    openConfirmModal("Are you sure you want to delete this 3D model? This action cannot be undone.", async () => {

      try {

        const result = await deleteCustom3DModel(modelId);

        if (result.success) {

          showToast('Model deleted successfully', 'success');

          await loadCustom3DModels();

        } else {

          showToast(result.message || 'Failed to delete model', 'error');

        }

      } catch (err) {

        console.error("Delete model error:", err);

        showToast('Failed to delete model', 'error');

      }

    });

  };

  const handleDeleteAllModels = async () => {

    if (customModels.length === 0) {

      showToast('No models to delete', 'info');

      return;

    }

    openConfirmModal(

      `Are you sure you want to delete ALL ${customModels.length} custom 3D models? This action cannot be undone.`,

      async () => {

        try {

          let deletedCount = 0;

          let failedCount = 0;

          for (const model of customModels) {

            try {

              const result = await deleteCustom3DModel(model.model_id);

              if (result.success) {

                deletedCount++;

              } else {

                failedCount++;

              }

            } catch (err) {

              console.error(`Error deleting model ${model.model_id}:`, err);

              failedCount++;

            }

          }

          if (deletedCount > 0) {

            showToast(`Successfully deleted ${deletedCount} model(s)`, 'success');

            await loadCustom3DModels();

          }

          if (failedCount > 0) {

            showToast(`Failed to delete ${failedCount} model(s)`, 'error');

          }

        } catch (err) {

          console.error("Delete all models error:", err);

          showToast('Error deleting models', 'error');

        }

      }

    );

  };

  const loadCustomizationOrders = async () => {

    setLoading(true);

    setError('');

    try {

      const result = await getAllCustomizationOrders();

      if (result.success) {

        setAllItems(result.orders);

      } else {

        setError(result.message || 'Failed to load customization orders');

      }

    } catch (err) {

      console.error("Load error:", err);

      setError('Failed to load customization orders');

    } finally {

      setLoading(false);

    }

  };

  const pendingAppointments = allItems.filter(item =>

    item.approval_status === 'pending_review' ||

    item.approval_status === 'pending' ||

    item.approval_status === null ||

    item.approval_status === undefined ||

    item.approval_status === ''

  );

  const stats = {

    pending: pendingAppointments.length,

    accepted: allItems.filter(o => o.approval_status === 'accepted').length,

    inProgress: allItems.filter(o => o.approval_status === 'confirmed').length,

    toPickup: allItems.filter(o => o.approval_status === 'ready_for_pickup').length,

    completed: allItems.filter(o => o.approval_status === 'completed').length,

    rejected: allItems.filter(o => o.approval_status === 'cancelled').length

  };

  const getFilteredItems = () => {

    let items = [];

    if (viewFilter === "pending") {

      items = pendingAppointments;

    } else if (viewFilter === "accepted") {

      items = allItems.filter(item => item.approval_status === 'accepted');

    } else if (viewFilter === "price-confirmation") {

      items = allItems.filter(item => item.approval_status === 'price_confirmation');

    } else if (viewFilter === "in-progress") {

      items = allItems.filter(item => item.approval_status === 'confirmed');

    } else if (viewFilter === "to-pickup") {

      items = allItems.filter(item => item.approval_status === 'ready_for_pickup');

    } else if (viewFilter === "completed") {

      items = allItems.filter(item => item.approval_status === 'completed');

    } else if (viewFilter === "rejected") {

      items = allItems.filter(item => item.approval_status === 'cancelled');

    } else {

      items = allItems;

    }

    items = items.filter(item =>

      !searchTerm ||

      item.order_id?.toString().includes(searchTerm.toLowerCase()) ||

      `${item.first_name} ${item.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||

      (item.walk_in_customer_name && item.walk_in_customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||

      item.specific_data?.garmentType?.toLowerCase().includes(searchTerm.toLowerCase()) ||

      (Array.isArray(item.specific_data?.garments) && item.specific_data.garments.some(g =>
        (g?.garmentType || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (g?.fabricType || '').toLowerCase().includes(searchTerm.toLowerCase())
      )) ||

      item.specific_data?.fabricType?.toLowerCase().includes(searchTerm.toLowerCase()) ||

      item.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||

      (item.walk_in_customer_email && item.walk_in_customer_email.toLowerCase().includes(searchTerm.toLowerCase()))

    );

    if (statusFilter && viewFilter === 'all') {

      items = items.filter(item => {

        let normalizedStatus = item.approval_status;

        if (item.approval_status === 'pending_review' ||

          item.approval_status === null ||

          item.approval_status === undefined ||

          item.approval_status === '') {

          normalizedStatus = 'pending';

        }

        return normalizedStatus === statusFilter;

      });

    }

    items.sort((a, b) => {

      const isPendingA = a.approval_status === 'pending' || a.approval_status === 'pending_review' || !a.approval_status;

      const isPendingB = b.approval_status === 'pending' || b.approval_status === 'pending_review' || !b.approval_status;

      if (isPendingA && !isPendingB) return -1;

      if (!isPendingA && isPendingB) return 1;

      return 0;

    });

    return items;

  };

  const handleAccept = async (itemId) => {

    const item = allItems.find(i => i.item_id === itemId);

    if (!item) {

      showToast("Order not found", "error");

      return;

    }

    if (item.order_type === 'walk_in') {

      try {

        const estimatedPrice = getEstimatedPrice(item) || parseFloat(item.final_price || 0);

        const result = await updateCustomizationOrderItem(itemId, {

          approvalStatus: 'accepted',

          finalPrice: estimatedPrice

        });

        if (result.success) {

          await loadCustomizationOrders();

          showToast("Walk-in order accepted (price confirmed in person)", "success");

        } else {

          showToast(result.message || "Failed to accept request", "error");

        }

      } catch (err) {

        console.error("Accept error:", err);

        showToast("Failed to accept request", "error");

      }

      return;

    }

    const estimatedPrice = getEstimatedPrice(item) || parseFloat(item.final_price || 0);

    setPriceConfirmationItem(item);

    setPriceConfirmationPrice(estimatedPrice.toFixed(2));

    setPriceConfirmationReason(item.pricing_factors?.adminNotes || '');

    setShowPriceConfirmationModal(true);

  };

  const handlePriceConfirmationSubmit = async () => {

    if (!priceConfirmationItem) return;

    const finalPrice = parseFloat(priceConfirmationPrice);

    if (isNaN(finalPrice) || finalPrice <= 0) {

      showToast("Please enter a valid price", "error");

      return;

    }

    if (!priceConfirmationReason.trim()) {

      showToast("Please provide a reason for the price change", "error");

      return;

    }

    try {

      const result = await updateCustomizationOrderItem(priceConfirmationItem.item_id, {

        approvalStatus: 'price_confirmation',

        finalPrice: finalPrice,

        adminNotes: priceConfirmationReason.trim()

      });

      if (result.success) {

        await loadCustomizationOrders();

        if (viewFilter !== 'all') {

          setViewFilter('price-confirmation');

        }

        showToast("Customization request moved to price confirmation!", "success");

        setShowPriceConfirmationModal(false);

        setPriceConfirmationItem(null);

        setPriceConfirmationPrice('');

        setPriceConfirmationReason('');

      } else {

        showToast(result.message || "Failed to accept request", "error");

      }

    } catch (err) {

      console.error("Accept error:", err);

      showToast("Failed to accept request", "error");

    }

  };

  const handleDecline = (itemId) => {

    openConfirmModal("Are you sure you want to decline this customization request?", async () => {

      try {

        const result = await updateCustomizationOrderItem(itemId, {

          approvalStatus: 'cancelled'

        });

        if (result.success) {

          loadCustomizationOrders();

          showToast("Request declined", "success");

        } else {

          showToast(result.message || "Failed to decline request", "error");

        }

      } catch (err) {

        console.error("Decline error:", err);

        showToast("Failed to decline request", "error");

      }

    });

  };

  const updateStatus = async (itemId, status) => {

    const item = allItems.find(i => i.item_id === itemId);

    const statusLabel = getStatusText(status);

    const currentStatusLabel = item ? getStatusText(item.approval_status) : 'current';

    if (status === 'completed' && item) {

      const pricingFactors = typeof item.pricing_factors === 'string'

        ? JSON.parse(item.pricing_factors || '{}')

        : (item.pricing_factors || {});

      const amountPaid = parseFloat(pricingFactors.amount_paid || 0);

      const finalPrice = parseFloat(item.final_price || 0);

      const remainingBalance = finalPrice - amountPaid;

      if (remainingBalance > 0.01) {

        showToast(`Cannot mark as completed. Payment is not complete. Remaining balance: ₱${remainingBalance.toFixed(2)}`, "error");

        return;

      }

    }

    openConfirmModal(

      `Are you sure you want to move this order from "${currentStatusLabel}" to "${statusLabel}"?`,

      async () => {

        try {

          const result = await updateCustomizationOrderItem(itemId, {

            approvalStatus: status

          });

          if (result.success) {

            await loadCustomizationOrders();

            if (viewFilter !== 'all') {

              if (status === 'accepted') {

                setViewFilter('accepted');

              } else if (status === 'price_confirmation') {

                setViewFilter('price-confirmation');

              } else if (status === 'confirmed') {

                setViewFilter('in-progress');

              } else if (status === 'ready_for_pickup') {

                setViewFilter('to-pickup');

              } else if (status === 'completed') {

                setViewFilter('completed');

              } else if (status === 'cancelled') {

                setViewFilter('rejected');

              }

            }

            showToast(`Status updated to "${statusLabel}"!`, "success");

          } else {

            showToast(result.message || "Failed to update status", "error");

          }

        } catch (err) {

          showToast("Failed to update status", "error");

        }

      }

    );

  };

  const getColorName = (hex) => {

    if (!hex) return 'Not specified';

    if (typeof hex === 'string' && !hex.startsWith('#') && !hex.match(/^[0-9a-fA-F]{3,6}$/)) {

      return hex.charAt(0).toUpperCase() + hex.slice(1);

    }

    let normalizedHex = String(hex).toLowerCase().trim();

    if (!normalizedHex.startsWith('#')) {

      normalizedHex = `#${normalizedHex}`;

    }

    const colorMap = {

      '#1a1a1a': 'Classic Black',

      '#1e3a5f': 'Navy Blue',

      '#6b1e3d': 'Burgundy',

      '#2d5a3d': 'Forest Green',

      '#4a4a4a': 'Charcoal Gray',

      '#c9a66b': 'Camel Tan',

      '#f5e6d3': 'Cream White',

      '#5d4037': 'Chocolate Brown',

      '#2a4d8f': 'Royal Blue',

      '#722f37': 'Wine Red',

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

    if (colorMap[normalizedHex]) {

      return colorMap[normalizedHex];

    }

    try {

      const r = parseInt(normalizedHex.slice(1, 3), 16);

      const g = parseInt(normalizedHex.slice(3, 5), 16);

      const b = parseInt(normalizedHex.slice(5, 7), 16);

      if (r > 200 && g > 200 && b > 200) return 'Light';

      if (r < 50 && g < 50 && b < 50) return 'Dark';

      if (r > g && r > b) return 'Reddish';

      if (g > r && g > b) return 'Greenish';

      if (b > r && b > g) return 'Bluish';

      if (r === g && g === b) return 'Gray';

    } catch (e) {

    }

    return normalizedHex;

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

  const handleViewDetails = (item) => {

    setSelectedOrder(item);

    setShowDetailModal(true);

  };

  const handleEditOrder = (item) => {

    setSelectedOrder(item);

    setEditForm({

      finalPrice: item.final_price || '',

      approvalStatus: item.approval_status || '',

      adminNotes: item.pricing_factors?.adminNotes || ''

    });

    setShowEditModal(true);

  };

  const handleDeleteOrder = async (item) => {

    const statusText = item.approval_status === 'cancelled' ? 'rejected' : 'completed';

    const confirmed = await confirm(

      `Are you sure you want to delete this ${statusText} order (ORD-${item.order_id})?\n\nThis action cannot be undone.`,

      'Delete Order',

      'danger',

      { confirmText: 'Delete', cancelText: 'Cancel' }

    );

    if (!confirmed) return;

    try {

      const result = await deleteOrderItem(item.item_id);

      if (result.success) {

        await alert('Order deleted successfully', 'Success', 'success');

        loadCustomizationOrders();

      } else {

        await alert(result.message || 'Failed to delete order', 'Error', 'error');

      }

    } catch (error) {

      console.error('Error deleting order:', error);

      await alert('Error deleting order', 'Error', 'error');

    }

  };

  const handleRecordPayment = async () => {

    if (!selectedOrder || !paymentAmount) {

      await alert('Please enter a payment amount', 'Error', 'error');

      return;

    }

    const amount = parseFloat(paymentAmount);

    if (isNaN(amount) || amount <= 0) {

      await alert('Please enter a valid payment amount', 'Error', 'error');

      return;

    }

    const pricingFactors = typeof selectedOrder.pricing_factors === 'string'

      ? JSON.parse(selectedOrder.pricing_factors || '{}')

      : (selectedOrder.pricing_factors || {});

    const amountPaid = parseFloat(pricingFactors.amount_paid || 0);

    const finalPrice = parseFloat(selectedOrder.final_price || 0);

    const remainingBalance = Math.max(0, finalPrice - amountPaid);

    if (amount > remainingBalance) {

      await alert(`Payment amount exceeds remaining balance (₱${remainingBalance.toFixed(2)})`, 'Error', 'error');

      return;

    }

    const cashGiven = parseFloat(cashReceived);

    if (isNaN(cashGiven) || cashGiven <= 0) {

      await alert('Please enter a valid cash received amount', 'Error', 'error');

      return;

    }

    if (cashGiven < amount) {

      await alert('Cash received cannot be less than payment amount', 'Error', 'error');

      return;

    }

    try {

      const result = await recordPayment(selectedOrder.item_id, amount, cashGiven, 'cash');

      if (result.success) {

        const remaining = result.payment?.remaining_balance || 0;

        const changeAmount = parseFloat(result.payment?.change_amount || 0);

        await alert(`Payment of ₱${amount.toFixed(2)} recorded successfully. Change: ₱${changeAmount.toFixed(2)}. ${remaining > 0 ? `Remaining balance: ₱${remaining.toFixed(2)}` : 'Payment complete!'}`, 'Success', 'success');

        setShowPaymentModal(false);

        setPaymentAmount('');

        setCashReceived('');

        await loadCustomizationOrders();

      } else {

        await alert(result.message || 'Failed to record payment', 'Error', 'error');

      }

    } catch (error) {

      console.error('Error recording payment:', error);

      await alert('Error recording payment', 'Error', 'error');

    }

  };

  const getEstimatedPrice = (item) => {

    if (!item || !item.specific_data) return null;

    return item.specific_data.estimatedPrice || parseFloat(item.final_price || 0);

  };

  const handleSaveEdit = async () => {

    if (!selectedOrder) return;

    const currentPrice = parseFloat(selectedOrder.final_price || 0);

    const newPrice = parseFloat(editForm.finalPrice || 0);

    const isPriceChanged = !isNaN(newPrice) && Math.abs(newPrice - currentPrice) > 0.01;

    if (isPriceChanged && !String(editForm.adminNotes || '').trim()) {

      showToast('Please provide a reason for the price change', 'error');

      return;

    }

    try {

      const result = await updateCustomizationOrderItem(selectedOrder.item_id, editForm);

      if (result.success) {

        setShowEditModal(false);

        loadCustomizationOrders();

        showToast('Order updated successfully!', 'success');

      } else {

        showToast(result.message || 'Failed to update order', 'error');

      }

    } catch (err) {

      console.error("Update error:", err);

      showToast('Failed to update order', 'error');

    }

  };

  return (

    <div className="customization-management">

      <Sidebar />

      <AdminHeader />

      <div className="content">

        <div className="dashboard-title">

          <div>

            <h2>Customization</h2>

            <p>Track and manage all customization orders</p>

          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', position: 'relative' }}>

            <div style={{ position: 'relative' }} data-add-menu>

              <button

                onClick={() => setShowAddMenu(!showAddMenu)}

                style={{

                  padding: '10px 20px',

                  backgroundColor: '#667eea',

                  color: 'white',

                  border: 'none',

                  borderRadius: '5px',

                  cursor: 'pointer',

                  fontSize: '14px',

                  fontWeight: '500',

                  display: 'flex',

                  alignItems: 'center',

                  gap: '8px'

                }}

              >

                + Add New

                <span style={{ fontSize: '12px' }}>{showAddMenu ? '▲' : '▼'}</span>

              </button>

              {showAddMenu && (

                <div

                  style={{

                    position: 'absolute',

                    top: '100%',

                    right: 0,

                    marginTop: '5px',

                    backgroundColor: 'white',

                    border: '1px solid #ddd',

                    borderRadius: '5px',

                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',

                    minWidth: '200px',

                    zIndex: 1000,

                    overflow: 'hidden'

                  }}

                >

                  <button

                    onClick={() => {

                      setShowGLBUploadModal(true);

                      setShowAddMenu(false);

                    }}

                    style={{

                      width: '100%',

                      padding: '12px 16px',

                      backgroundColor: 'white',

                      color: 'white',

                      border: 'none',

                      borderBottom: '1px solid #eee',

                      cursor: 'pointer',

                      fontSize: '14px',

                      fontWeight: '500',

                      textAlign: 'left',

                      transition: 'background-color 0.2s'

                    }}

                    onMouseEnter={(e) => {

                      e.target.style.backgroundColor = '#f5f5f5';

                    }}

                    onMouseLeave={(e) => {

                      e.target.style.backgroundColor = 'white';

                    }}

                  >

                    Add 3D Model

                  </button>

                  <button

                    onClick={() => {

                      openNewFabricType();

                      setShowAddMenu(false);

                    }}

                    style={{

                      width: '100%',

                      padding: '12px 16px',

                      backgroundColor: 'white',

                      color: 'white',

                      border: 'none',

                      borderBottom: '1px solid #eee',

                      cursor: 'pointer',

                      fontSize: '14px',

                      fontWeight: '500',

                      textAlign: 'left',

                      transition: 'background-color 0.2s'

                    }}

                    onMouseEnter={(e) => {

                      e.target.style.backgroundColor = '#f5f5f5';

                    }}

                    onMouseLeave={(e) => {

                      e.target.style.backgroundColor = 'white';

                    }}

                  >

                    Add Fabric Type

                  </button>

                  <button

                    onClick={() => {

                      openNewGarmentType();

                      setShowAddMenu(false);

                    }}

                    style={{

                      width: '100%',

                      padding: '12px 16px',

                      backgroundColor: 'white',

                      color: 'white',

                      border: 'none',

                      borderBottom: '1px solid #eee',

                      cursor: 'pointer',

                      fontSize: '14px',

                      fontWeight: '500',

                      textAlign: 'left',

                      transition: 'background-color 0.2s'

                    }}

                    onMouseEnter={(e) => {

                      e.target.style.backgroundColor = '#f5f5f5';

                    }}

                    onMouseLeave={(e) => {

                      e.target.style.backgroundColor = 'white';

                    }}

                  >

                    Add Garment Type

                  </button>

                  <button

                    onClick={() => {

                      openNewPattern();

                      setShowAddMenu(false);

                    }}

                    style={{

                      width: '100%',

                      padding: '12px 16px',

                      backgroundColor: 'white',

                      color: 'white',

                      border: 'none',

                      cursor: 'pointer',

                      fontSize: '14px',

                      fontWeight: '500',

                      textAlign: 'left',

                      transition: 'background-color 0.2s'

                    }}

                    onMouseEnter={(e) => {

                      e.target.style.backgroundColor = '#f5f5f5';

                    }}

                    onMouseLeave={(e) => {

                      e.target.style.backgroundColor = 'white';

                    }}

                  >

                    Add Pattern

                  </button>

                  <button

                    onClick={() => {

                      openSizeModal();

                      setShowAddMenu(false);

                    }}

                    style={{

                      width: '100%',

                      padding: '12px 16px',

                      backgroundColor: 'white',

                      color: 'white',

                      border: 'none',

                      cursor: 'pointer',

                      fontSize: '14px',

                      fontWeight: '500',

                      textAlign: 'left',

                      transition: 'background-color 0.2s'

                    }}

                    onMouseEnter={(e) => {

                      e.target.style.backgroundColor = '#f5f5f5';

                    }}

                    onMouseLeave={(e) => {

                      e.target.style.backgroundColor = 'white';

                    }}

                  >

                    Add Sizes

                  </button>

                </div>

              )}

            </div>

          </div>

          {error && <div className="error-message" style={{ color: 'red', marginBottom: '20px' }}>{error}</div>}

        </div>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-header">
              <span>Pending</span>
              <div className="stat-icon" style={{ background: '#fff3e0', color: '#ff9800' }}>
                <i className="fas fa-hourglass-half"></i>
              </div>
            </div>
            <div className="stat-number">{stats.pending}</div>
          </div>
          <div className="stat-card">
            <div className="stat-header">
              <span>In Progress</span>
              <div className="stat-icon" style={{ background: '#e8f5e9', color: '#4caf50' }}>
                <i className="fas fa-sync-alt"></i>
              </div>
            </div>
            <div className="stat-number">{stats.inProgress}</div>
          </div>
          <div className="stat-card">
            <div className="stat-header">
              <span>To Pick up</span>
              <div className="stat-icon" style={{ background: '#e3f2fd', color: '#2196f3' }}>
                <i className="fas fa-box"></i>
              </div>
            </div>
            <div className="stat-number">{stats.toPickup}</div>
          </div>
          <div className="stat-card">
            <div className="stat-header">
              <span>Completed</span>
              <div className="stat-icon" style={{ background: '#e8f5e9', color: '#4caf50' }}>
                <i className="fas fa-check"></i>
              </div>
            </div>
            <div className="stat-number">{stats.completed}</div>
          </div>
          <div className="stat-card">
            <div className="stat-header">
              <span>Rejected</span>
              <div className="stat-icon" style={{ background: '#ffebee', color: '#f44336' }}>
                <i className="fas fa-times"></i>
              </div>
            </div>
            <div className="stat-number">{stats.rejected}</div>
          </div>

        </div>

        <div className="search-container">

          <input

            type="text"

            placeholder="Search by Order ID, Name, Garment, or Fabric"

            value={searchTerm}

            onChange={(e) => setSearchTerm(e.target.value)}

          />

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>

            <option value="">All Status</option>

            <option value="pending">Pending</option>

            <option value="accepted">Accepted</option>

            <option value="price_confirmation">Price Confirmation</option>

            <option value="confirmed">In Progress</option>

            <option value="ready_for_pickup">To Pick up</option>

            <option value="completed">Completed</option>

            <option value="cancelled">Rejected</option>

          </select>

        </div>
        <div className="table-container">

          <div className="table-scroll-viewport">
          <table>

            <thead>

              <tr>

                <th>Order ID</th>

                <th>Customer</th>

                <th>Garment</th>

                <th>Fabric</th>

                <th>Date</th>

                <th>Price</th>

                <th>Payment Status</th>

                <th>Status</th>

                <th>Actions</th>

              </tr>

            </thead>

            <tbody>

              {loading ? (

                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '40px' }}>Loading customization orders...</td></tr>

              ) : getFilteredItems().length === 0 ? (

                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '40px' }}>No customization orders found</td></tr>

              ) : (

                getFilteredItems().map(item => {

                  const pricingFactors = typeof item.pricing_factors === 'string'

                    ? JSON.parse(item.pricing_factors || '{}')

                    : (item.pricing_factors || {});

                  const amountPaid = parseFloat(pricingFactors.amount_paid || 0);

                  const finalPrice = parseFloat(item.final_price || 0);

                  const remainingBalance = finalPrice - amountPaid;

                  const isUniform = item.specific_data?.garmentType?.toLowerCase() === 'uniform' ||

                    item.specific_data?.isUniform === true ||

                    item.pricing_factors?.isUniform === true;

                  return (

                    <tr key={item.item_id} className="clickable-row" onClick={() => handleViewDetails(item)}>

                      <td><strong>#{item.order_id}</strong></td>

                      <td>

                        {item.order_type === 'walk_in' ? (

                          <span>

                            <span style={{

                              display: 'inline-block',

                              backgroundColor: '#ff9800',

                              color: 'white',

                              padding: '2px 8px',

                              borderRadius: '3px',

                              fontSize: '0.75em',

                              marginRight: '5px',

                              fontWeight: 'bold'

                            }}>WALK-IN</span>

                            {item.walk_in_customer_name || 'Walk-in Customer'}

                          </span>

                        ) : (

                          `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'N/A'

                        )}

                      </td>

                      <td>{getGarmentSummaryText(item.specific_data)}</td>

                      <td><span style={{ fontSize: '0.9em', color: '#5D4037' }}>{getFabricSummaryText(item.specific_data)}</span></td>

                      <td>{new Date(item.order_date).toLocaleDateString()}</td>

                      <td>

                        {isUniform && finalPrice === 0 ? (

                          <span style={{ color: '#e65100', fontWeight: '600', fontSize: '0.9em' }}>Price varies</span>

                        ) : isUniform && finalPrice > 0 ? (

                          <span style={{ color: '#4caf50', fontWeight: '600' }}>₱{parseFloat(item.final_price || 0).toLocaleString()}</span>

                        ) : (

                          `₱${parseFloat(item.final_price || 0).toLocaleString()}`

                        )}

                      </td>

                      <td>

                        <div style={{ fontSize: '12px' }}>

                          {isUniform && finalPrice === 0 ? (

                            <span style={{ color: '#e65100', fontStyle: 'italic' }}>Pending quote</span>

                          ) : (

                            <>

                              <div>Paid: ₱{amountPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>

                              <div style={{ color: remainingBalance > 0 ? '#ff9800' : '#4caf50', fontWeight: 'bold' }}>

                                Remaining: ₱{Math.max(0, remainingBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

                              </div>

                            </>

                          )}

                        </div>

                      </td>

                      <td onClick={(e) => e.stopPropagation()}>

                        <span className={`status-badge ${getStatusClass(item.approval_status || 'pending')}`}>

                          {getStatusText(item.approval_status || 'pending')}

                        </span>

                      </td>

                      <td onClick={(e) => e.stopPropagation()}>

                        {item.approval_status === 'pending_review' || item.approval_status === 'pending' || item.approval_status === null || item.approval_status === undefined || item.approval_status === '' ? (

                          <div className="action-buttons">

                            <button className="icon-btn accept" onClick={() => handleAccept(item.item_id)} title="Accept">

                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">

                                <polyline points="20 6 9 17 4 12"></polyline>

                              </svg>

                            </button>

                            <button className="icon-btn decline" onClick={() => handleDecline(item.item_id)} title="Decline">

                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">

                                <line x1="18" y1="6" x2="6" y2="18"></line>

                                <line x1="6" y1="6" x2="18" y2="18"></line>

                              </svg>

                            </button>

                          </div>

                        ) : (

                          <div className="action-buttons">

                            {getNextStatus(item.approval_status, 'customization', item) && (

                              <button

                                className="icon-btn next-status"

                                onClick={() => updateStatus(item.item_id, getNextStatus(item.approval_status, 'customization', item))}

                                title={`Move to ${getNextStatusLabel(item.approval_status, 'customization', item)}`}

                                style={{ backgroundColor: '#4CAF50', color: 'white' }}

                              >

                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">

                                  <polyline points="9 18 15 12 9 6"></polyline>

                                </svg>

                              </button>

                            )}

                            {item.approval_status !== 'completed' && item.approval_status !== 'cancelled' && item.approval_status !== 'price_confirmation' && (

                              <button

                                className="icon-btn"

                                onClick={(e) => {

                                  e.stopPropagation();

                                  setSelectedOrder(item);

                                  const finalPrice = parseFloat(item.final_price || 0);

                                  const halfPrice = (finalPrice * 0.5).toFixed(2);

                                  setPaymentAmount(halfPrice);

                                  setCashReceived('');

                                  setShowPaymentModal(true);

                                }}

                                title="Record Payment"

                                style={{ backgroundColor: '#2196F3', color: 'white' }}

                              >

                                💰

                              </button>

                            )}

                            {(item.approval_status === 'completed' || item.approval_status === 'cancelled') && (

                              <button

                                className="icon-btn delete"

                                onClick={(e) => {

                                  e.stopPropagation();

                                  handleDeleteOrder(item);

                                }}

                                title="Delete Order"

                                style={{ backgroundColor: '#f44336', color: 'white' }}

                              >

                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">

                                  <polyline points="3 6 5 6 21 6"></polyline>

                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>

                                  <line x1="10" y1="11" x2="10" y2="17"></line>

                                  <line x1="14" y1="11" x2="14" y2="17"></line>

                                </svg>

                              </button>

                            )}

                          </div>

                        )}

                      </td>

                    </tr>

                  );

                })

              )}

            </tbody>

          </table>
          </div>

        </div>

      </div>
      {showEditModal && selectedOrder && (

        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowEditModal(false)}>

          <div className="modal-content">

            <div className="modal-header">

              <h2>Update Customization Order</h2>

              <span className="close-modal" onClick={() => setShowEditModal(false)}>×</span>

            </div>

            <div className="modal-body">

              <div className="detail-row"><strong>Order ID:</strong> #{selectedOrder.order_id}</div>

              {selectedOrder.order_type === 'walk_in' && selectedOrder.specific_data?.referenceImage && (
                <div className="detail-row">
                  <strong>Reference Image:</strong>
                  <div
                    className="clickable-image"
                    style={{ marginTop: '10px', cursor: 'pointer' }}
                    onClick={() => openImagePreview(`${API_BASE_URL}/${selectedOrder.specific_data.referenceImage}`, 'Reference image')}
                  >
                    <img
                      src={`${API_BASE_URL}/${selectedOrder.specific_data.referenceImage}`}
                      alt="Reference image"
                      style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', border: '1px solid #ddd' }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                    <small className="click-hint" style={{ display: 'block', fontSize: '11px', color: '#888', marginTop: '4px' }}>Click to expand</small>
                  </div>
                </div>
              )}

              <div className="form-group" style={{ marginTop: '20px' }}>

                <label>Final Price (₱)</label>

                <input

                  type="number"

                  value={editForm.finalPrice}

                  onChange={(e) => {

                    const newPrice = e.target.value;

                    const estimatedPrice = getEstimatedPrice(selectedOrder);

                    const originalPrice = parseFloat(selectedOrder.final_price || 0);

                    let newStatus = editForm.approvalStatus;

                    const isWalkIn = selectedOrder.order_type === 'walk_in';

                    if (newPrice && (editForm.approvalStatus === 'pending' || editForm.approvalStatus === 'accepted')) {

                      const priceChanged = estimatedPrice ? Math.abs(parseFloat(newPrice) - estimatedPrice) > 0.01 :

                        Math.abs(parseFloat(newPrice) - originalPrice) > 0.01;

                      if (priceChanged) {

                        newStatus = isWalkIn ? 'accepted' : 'price_confirmation';

                      }

                    }

                    setEditForm({ ...editForm, finalPrice: newPrice, approvalStatus: newStatus });

                  }}

                  placeholder="Enter final price"

                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}

                />

                {(() => {

                  const estimatedPrice = getEstimatedPrice(selectedOrder);

                  if (estimatedPrice && editForm.finalPrice) {

                    const priceDiff = parseFloat(editForm.finalPrice) - estimatedPrice;

                    if (Math.abs(priceDiff) > 0.01) {

                      return (

                        <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#fff3cd', borderRadius: '4px', fontSize: '0.9em' }}>

                          <strong>⚠️ Price Changed:</strong> Estimated: ₱{estimatedPrice.toFixed(2)} → New: ₱{parseFloat(editForm.finalPrice).toFixed(2)}

                          <br />

                          <span style={{ color: '#666', fontSize: '0.85em' }}>

                            {selectedOrder.order_type === 'walk_in'

                              ? 'Status will be set to "Accepted" (walk-in orders skip price confirmation).'

                              : 'Status will be set to "Price Confirmation" to notify customer.'}

                          </span>

                        </div>

                      );

                    }

                  }

                  return null;

                })()}

              </div>

              <div className="form-group">

                <label>Status</label>

                <select

                  value={editForm.approvalStatus}

                  onChange={(e) => {

                    const newStatus = e.target.value;

                    const isWalkIn = selectedOrder.order_type === 'walk_in';

                    if (isWalkIn && newStatus === 'price_confirmation') {

                      showToast('Walk-in orders do not require price confirmation. Status set to "Accepted".', 'info');

                      setEditForm({ ...editForm, approvalStatus: 'accepted' });

                    } else {

                      setEditForm({ ...editForm, approvalStatus: newStatus });

                    }

                  }}

                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}

                >

                  <option value="pending">Pending</option>

                  <option value="accepted">Accepted</option>

                  {selectedOrder.order_type !== 'walk_in' && (

                    <option value="price_confirmation">Price Confirmation</option>

                  )}

                  <option value="confirmed">In Progress</option>

                  <option value="ready_for_pickup">Ready for Pickup</option>

                  <option value="completed">Completed</option>

                  <option value="cancelled">Rejected</option>

                </select>

                {editForm.approvalStatus === 'price_confirmation' && selectedOrder.order_type !== 'walk_in' && (

                  <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#e3f2fd', borderRadius: '4px', fontSize: '0.9em', color: '#1976d2' }}>

                    ℹ️ Customer will be notified to confirm the updated price.

                  </div>

                )}

                {selectedOrder.order_type === 'walk_in' && (

                  <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#fff3cd', borderRadius: '4px', fontSize: '0.9em', color: '#856404' }}>

                    ℹ️ Walk-in orders skip price confirmation (customer confirms in person).

                  </div>

                )}

              </div>

              <div className="form-group">

                <label>Admin Notes</label>

                <textarea

                  value={editForm.adminNotes}

                  onChange={(e) => setEditForm({ ...editForm, adminNotes: e.target.value })}

                  placeholder="Add admin notes..."

                  rows={3}

                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}

                />

              </div>
              <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '2px solid #eee' }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>

                  <h3 style={{ margin: 0, fontSize: '18px', color: '#333' }}>Customer Measurements</h3>

                  <button

                    className="btn-secondary"

                    onClick={async () => {

                      setMeasurementsLoading(true);

                      const customerId = selectedOrder.order_type === 'walk_in'

                        ? selectedOrder.walk_in_customer_id

                        : selectedOrder.user_id;

                      const customerType = selectedOrder.order_type === 'walk_in' ? 'walk_in' : 'online';

                      if (selectedOrder.order_type === 'walk_in' && selectedOrder.specific_data?.measurements) {

                        const orderMeasurements = typeof selectedOrder.specific_data.measurements === 'string'

                          ? JSON.parse(selectedOrder.specific_data.measurements)

                          : selectedOrder.specific_data.measurements;

                        setMeasurements({

                          top: orderMeasurements.top || {},

                          bottom: orderMeasurements.bottom || {},

                          notes: orderMeasurements.notes || ''

                        });

                        setMeasurementsLoading(false);

                        setShowMeasurementsModal(true);

                      } else {

                        const result = await getMeasurements(customerId, customerType);

                        if (result.success && result.measurements) {

                          setMeasurements({

                            top: typeof result.measurements.top_measurements === 'string'

                              ? JSON.parse(result.measurements.top_measurements)

                              : result.measurements.top_measurements || {},

                            bottom: typeof result.measurements.bottom_measurements === 'string'

                              ? JSON.parse(result.measurements.bottom_measurements)

                              : result.measurements.bottom_measurements || {},

                            notes: result.measurements.notes || ''

                          });

                        } else {

                          setMeasurements({ top: {}, bottom: {}, notes: '' });

                        }

                        setMeasurementsLoading(false);

                        setShowMeasurementsModal(true);

                      }

                    }}

                    style={{ padding: '6px 12px', fontSize: '14px' }}

                  >

                    {measurementsLoading ? 'Loading...' : 'View/Edit Measurements'}

                  </button>

                </div>

              </div>

            </div>

            <div className="modal-footer">

              <button className="btn-cancel" onClick={() => setShowEditModal(false)}>Cancel</button>

              <button className="btn-save" onClick={handleSaveEdit}>Save Changes</button>

            </div>

          </div>

        </div>

      )}
      {showDetailModal && selectedOrder && (

        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowDetailModal(false)}>

          <div className="modal-content">

            <div className="modal-header">

              <h2>Order Details</h2>

              <span className="close-modal" onClick={() => setShowDetailModal(false)}>×</span>

            </div>

            <div className="modal-body">

              <div className="detail-row"><strong>Order ID:</strong> #{selectedOrder.order_id}</div>

              {selectedOrder.order_type === 'walk_in' && (

                <div className="detail-row">

                  <strong>Order Type:</strong>

                  <span style={{

                    display: 'inline-block',

                    backgroundColor: '#ff9800',

                    color: 'white',

                    padding: '2px 8px',

                    borderRadius: '3px',

                    fontSize: '0.75em',

                    marginLeft: '8px',

                    fontWeight: 'bold'

                  }}>WALK-IN</span>

                </div>

              )}

              <div className="detail-row">

                <strong>Customer:</strong>

                <span>

                  {selectedOrder.order_type === 'walk_in'

                    ? (selectedOrder.walk_in_customer_name || 'Walk-in Customer')

                    : `${selectedOrder.first_name || ''} ${selectedOrder.last_name || ''}`.trim() || 'N/A'}

                </span>

              </div>

              {selectedOrder.order_type === 'walk_in' ? (

                <>

                  {selectedOrder.walk_in_customer_email && (

                    <div className="detail-row"><strong>Email:</strong> <span>{selectedOrder.walk_in_customer_email}</span></div>

                  )}

                  {selectedOrder.walk_in_customer_phone && (

                    <div className="detail-row"><strong>Phone:</strong> <span>{selectedOrder.walk_in_customer_phone}</span></div>

                  )}

                </>

              ) : (

                <div className="detail-row">

                  <strong>Email:</strong>

                  <span>{selectedOrder.email || 'N/A'}</span>

                </div>

              )}

              <div className="detail-row"><strong>Preferred Date:</strong> {selectedOrder.specific_data?.preferredDate || 'N/A'}</div>

              <div className="detail-row"><strong>Date Received:</strong> {new Date(selectedOrder.order_date).toLocaleDateString()}</div>

              <div className="detail-row"><strong>Price:</strong> ₱{parseFloat(selectedOrder.final_price || 0).toLocaleString()}</div>

              <div className="detail-row"><strong>Status:</strong>

                <span className={`status-badge ${getStatusClass(selectedOrder.approval_status || 'pending')}`}>

                  {getStatusText(selectedOrder.approval_status || 'pending')}

                </span>

              </div>

              {selectedOrder.specific_data?.notes && (

                <div className="detail-row"><strong>Customer Notes:</strong> {selectedOrder.specific_data.notes}</div>

              )}

              {selectedOrder.pricing_factors?.adminNotes && (

                <div className="detail-row"><strong>Admin Notes:</strong> {selectedOrder.pricing_factors.adminNotes}</div>

              )}
              <div className="measurements-btn-wrapper">

                <button

                  className="btn-measurements"

                  onClick={async () => {

                    setMeasurementsLoading(true);

                    const customerId = selectedOrder.order_type === 'walk_in'

                      ? selectedOrder.walk_in_customer_id

                      : selectedOrder.user_id;

                    const customerType = selectedOrder.order_type === 'walk_in' ? 'walk_in' : 'online';

                    if (selectedOrder.order_type === 'walk_in' && selectedOrder.specific_data?.measurements) {

                      const orderMeasurements = typeof selectedOrder.specific_data.measurements === 'string'

                        ? JSON.parse(selectedOrder.specific_data.measurements)

                        : selectedOrder.specific_data.measurements;

                      setMeasurements({

                        top: orderMeasurements.top || {},

                        bottom: orderMeasurements.bottom || {},

                        notes: orderMeasurements.notes || ''

                      });

                      setMeasurementsLoading(false);

                      setShowMeasurementsModal(true);

                    } else {

                      const result = await getMeasurements(customerId, customerType);

                      if (result.success && result.measurements) {

                        setMeasurements({

                          top: typeof result.measurements.top_measurements === 'string'

                            ? JSON.parse(result.measurements.top_measurements)

                            : result.measurements.top_measurements || {},

                          bottom: typeof result.measurements.bottom_measurements === 'string'

                            ? JSON.parse(result.measurements.bottom_measurements)

                            : result.measurements.bottom_measurements || {},

                          notes: result.measurements.notes || ''

                        });

                      } else {

                        // Try to pre-populate from user-provided measurements in designData
                        const garments = Array.isArray(selectedOrder.specific_data?.garments) ? selectedOrder.specific_data.garments : [];
                        let userMeas = null;
                        if (garments.length > 0) {
                          for (const g of garments) {
                            const dd = parseDesignData(g.designData);
                            if (dd?.userMeasurements && Object.keys(dd.userMeasurements).length > 0) {
                              userMeas = dd.userMeasurements;
                              break;
                            }
                          }
                        } else {
                          const dd = parseDesignData(selectedOrder.specific_data?.designData);
                          if (dd?.userMeasurements && Object.keys(dd.userMeasurements).length > 0) {
                            userMeas = dd.userMeasurements;
                          }
                        }

                        if (userMeas) {
                          // Map user measurements to top/bottom format
                          const topFields = ['chest', 'shoulders', 'sleeveLength', 'neck', 'waist', 'length', 'backLength'];
                          const bottomFields = ['waist', 'hips', 'inseam', 'outseam', 'thigh', 'cuff'];
                          const topMeas = {};
                          const bottomMeas = {};
                          Object.entries(userMeas).forEach(([key, val]) => {
                            if (val) {
                              const mappedKey = key === 'sleeveLength' ? 'sleeve_length' : key === 'backLength' ? 'length' : key;
                              if (topFields.includes(key)) topMeas[mappedKey] = val;
                              if (bottomFields.includes(key)) bottomMeas[mappedKey] = val;
                            }
                          });
                          setMeasurements({
                            top: topMeas,
                            bottom: bottomMeas,
                            notes: 'Pre-filled from customer-provided body measurements'
                          });
                        } else {
                          setMeasurements({ top: {}, bottom: {}, notes: '' });
                        }

                      }

                      setMeasurementsLoading(false);

                      setShowMeasurementsModal(true);

                    }

                  }}

                >

                  {measurementsLoading ? 'Loading...' : 'View/Edit Measurements'}

                </button>

              </div>
              {selectedOrder.order_type === 'walk_in' && selectedOrder.specific_data?.referenceImage && (
                <div className="detail-row">
                  <strong>Reference Image:</strong>
                  <div
                    className="clickable-image"
                    style={{ marginTop: '10px', cursor: 'pointer' }}
                    onClick={() => openImagePreview(`${API_BASE_URL}/${selectedOrder.specific_data.referenceImage}`, 'Reference image')}
                  >
                    <img
                      src={`${API_BASE_URL}/${selectedOrder.specific_data.referenceImage}`}
                      alt="Reference image"
                      style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', border: '1px solid #ddd' }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                    <small className="click-hint" style={{ display: 'block', fontSize: '11px', color: '#888', marginTop: '4px' }}>Click to expand</small>
                  </div>
                </div>
              )}
              {(() => {
                const garments = Array.isArray(selectedOrder.specific_data?.garments)
                  ? selectedOrder.specific_data.garments
                  : [];

                if (garments.length > 0) {
                  return (
                    <div className="detail-row">
                      <strong>Garments:</strong>
                      <div style={{ marginTop: '10px', width: '100%' }}>
                        {garments.map((garment, idx) => {
                          const garmentDesignData = parseDesignData(garment.designData);
                          const garmentAngleImages = garmentDesignData?.angleImageUrls || garmentDesignData?.angleImages;

                          return (
                            <div key={idx} style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '12px', marginBottom: '12px', background: '#fafafa' }}>
                              <div style={{ marginBottom: '6px', fontWeight: '700' }}>Garment #{idx + 1}</div>
                              <div style={{ marginBottom: '6px' }}><strong>Garment Type:</strong> {garment.garmentType || 'N/A'}</div>
                              <div style={{ marginBottom: '6px' }}><strong>Fabric Type:</strong> {garment.fabricType || 'N/A'}</div>

                              {garmentAngleImages && (
                                <div style={{ marginTop: '8px' }}>
                                  <strong>Design Views:</strong>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginTop: '8px' }}>
                                    {['front', 'back', 'right', 'left'].map((angle) => {
                                      const angleUrl = getDisplayImageUrl(garmentAngleImages[angle]);
                                      if (!angleUrl) return null;

                                      return (
                                        <div key={angle} style={{ position: 'relative' }}>
                                          <div className="clickable-image" style={{ cursor: 'pointer' }} onClick={() => openImagePreview(angleUrl, `${angle} view`)}>
                                            <img
                                              src={angleUrl}
                                              alt={`${angle} view`}
                                              style={{ width: '100%', height: 'auto', maxHeight: '200px', borderRadius: '8px', border: '2px solid #ddd', objectFit: 'contain' }}
                                              onError={(e) => {
                                                e.target.style.display = 'none';
                                              }}
                                            />
                                            <div style={{ position: 'absolute', bottom: '5px', left: '5px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', textTransform: 'capitalize', fontWeight: 'bold' }}>
                                              {angle}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {!garmentAngleImages && garment.imageUrl && garment.imageUrl !== 'no-image' && (
                                <div style={{ marginTop: '10px' }}>
                                  <strong>Design Preview:</strong>
                                  <div className="clickable-image" style={{ marginTop: '8px', cursor: 'pointer' }} onClick={() => openImagePreview(getDisplayImageUrl(garment.imageUrl), `Garment #${idx + 1} preview`)}>
                                    <img
                                      src={getDisplayImageUrl(garment.imageUrl)}
                                      alt={`Garment #${idx + 1} preview`}
                                      style={{ maxWidth: '100%', maxHeight: '220px', borderRadius: '8px', border: '1px solid #ddd' }}
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                      }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                const designData = parseDesignData(selectedOrder.specific_data?.designData);
                const angleImages = designData?.angleImageUrls || designData?.angleImages;

                if (angleImages && (angleImages.front || angleImages.back || angleImages.right || angleImages.left)) {
                  return (
                    <div className="detail-row">
                      <strong>Design Views:</strong>
                      <div style={{ marginTop: '10px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                          {['front', 'back', 'right', 'left'].map((angle) => (
                            angleImages[angle] && (
                              <div key={angle} style={{ position: 'relative' }}>
                                <div className="clickable-image" style={{ cursor: 'pointer' }} onClick={() => openImagePreview(getDisplayImageUrl(angleImages[angle]), `${angle} view`)}>
                                  <img
                                    src={getDisplayImageUrl(angleImages[angle])}
                                    alt={`${angle} view`}
                                    style={{ width: '100%', height: 'auto', maxHeight: '200px', borderRadius: '8px', border: '2px solid #ddd', objectFit: 'contain' }}
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                    }}
                                  />
                                  <div style={{ position: 'absolute', bottom: '5px', left: '5px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', textTransform: 'capitalize', fontWeight: 'bold' }}>
                                    {angle}
                                  </div>
                                </div>
                              </div>
                            )
                          ))}
                        </div>
                        <small className="click-hint" style={{ display: 'block', fontSize: '11px', color: '#888', marginTop: '8px' }}>Click any image to expand</small>
                      </div>
                    </div>
                  );
                }

                if (selectedOrder.specific_data?.imageUrl && selectedOrder.specific_data.imageUrl !== 'no-image') {
                  return (
                    <div className="detail-row">
                      <strong>Design Preview:</strong>
                      <div className="clickable-image" style={{ marginTop: '10px', cursor: 'pointer' }} onClick={() => openImagePreview(getDisplayImageUrl(selectedOrder.specific_data.imageUrl), 'Design preview')}>
                        <img
                          src={getDisplayImageUrl(selectedOrder.specific_data.imageUrl)}
                          alt="Design preview"
                          style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', border: '1px solid #ddd' }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                        <small className="click-hint" style={{ display: 'block', fontSize: '11px', color: '#888', marginTop: '4px' }}>Click to expand</small>
                      </div>
                    </div>
                  );
                }

                return null;

              })()}
              {(() => {
                const garments = Array.isArray(selectedOrder.specific_data?.garments)
                  ? selectedOrder.specific_data.garments
                  : [];

                if (garments.length > 0) {
                  const garmentsWithDesign = garments.filter((g) => {
                    const d = parseDesignData(g.designData);
                    return d && (d.size || d.fit || d.colors || d.pattern || d.personalization || d.buttons || d.accessories);
                  });

                  if (!garmentsWithDesign.length) return null;

                  return (
                    <div className="detail-row" style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                      <div style={{ width: '100%' }}>
                        <h5 style={{ margin: '0 0 15px 0', color: '#333', fontSize: '16px', fontWeight: '600' }}>
                          3D Customization Choices
                        </h5>

                        {garmentsWithDesign.map((garment, idx) => {
                          const designData = parseDesignData(garment.designData);
                          return (
                            <div key={idx} style={{ marginBottom: '12px', padding: '10px', background: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                              <div style={{ marginBottom: '8px', fontWeight: '700' }}>Garment #{idx + 1}</div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '14px' }}>
                                {designData.size && <div><strong>Size:</strong> {designData.size.charAt(0).toUpperCase() + designData.size.slice(1)}</div>}
                                {designData.fit && <div><strong>Fit:</strong> {designData.fit.charAt(0).toUpperCase() + designData.fit.slice(1)}</div>}
                                {designData.colors && designData.colors.fabric && <div><strong>Color:</strong> {getColorName(designData.colors.fabric)}</div>}
                                {designData.pattern && designData.pattern !== 'none' && <div><strong>Pattern:</strong> {designData.pattern.charAt(0).toUpperCase() + designData.pattern.slice(1)}</div>}
                                {designData.personalization && designData.personalization.initials && (
                                  <div style={{ gridColumn: '1 / -1' }}>
                                    <strong>Personalization:</strong> {designData.personalization.initials}
                                    {designData.personalization.font && ` (${designData.personalization.font} font)`}
                                  </div>
                                )}
                                {designData.buttons && designData.buttons.length > 0 && (
                                  <div style={{ gridColumn: '1 / -1' }}>
                                    <strong>Button Types:</strong>
                                    <div style={{ marginLeft: '10px', marginTop: '5px', fontSize: '13px' }}>
                                      {designData.buttons.map((btn, index) => (
                                        <div key={btn.id || index} style={{ margin: '5px 0' }}>
                                          Button {index + 1}: {getButtonType(btn.modelPath)}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {designData.accessories && designData.accessories.length > 0 && (
                                  <div style={{ gridColumn: '1 / -1' }}>
                                    <strong>Accessories:</strong>
                                    <div style={{ marginLeft: '10px', marginTop: '5px', fontSize: '13px' }}>
                                      {designData.accessories.map((acc, index) => (
                                        <div key={acc.id || index} style={{ margin: '5px 0' }}>
                                          {getAccessoryName(acc.modelPath)}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                const designData = parseDesignData(selectedOrder.specific_data?.designData);

                if (designData && (designData.size || designData.fit || designData.colors || designData.pattern || designData.personalization || designData.buttons || designData.accessories)) {
                  return (
                    <div className="detail-row" style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                      <div style={{ width: '100%' }}>
                        <h5 style={{ margin: '0 0 15px 0', color: '#333', fontSize: '16px', fontWeight: '600' }}>
                          3D Customization Choices
                        </h5>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '14px' }}>
                          {designData.size && <div className="detail-row"><strong>Size:</strong> {designData.size.charAt(0).toUpperCase() + designData.size.slice(1)}</div>}
                          {designData.fit && <div className="detail-row"><strong>Fit:</strong> {designData.fit.charAt(0).toUpperCase() + designData.fit.slice(1)}</div>}
                          {designData.colors && designData.colors.fabric && <div className="detail-row"><strong>Color:</strong> {getColorName(designData.colors.fabric)}</div>}
                          {designData.pattern && designData.pattern !== 'none' && <div className="detail-row"><strong>Pattern:</strong> {designData.pattern.charAt(0).toUpperCase() + designData.pattern.slice(1)}</div>}
                          {designData.personalization && designData.personalization.initials && (
                            <div className="detail-row" style={{ gridColumn: '1 / -1' }}>
                              <strong>Personalization:</strong> {designData.personalization.initials}
                              {designData.personalization.font && ` (${designData.personalization.font} font)`}
                            </div>
                          )}
                          {designData.buttons && designData.buttons.length > 0 && (
                            <div className="detail-row" style={{ gridColumn: '1 / -1' }}>
                              <strong>Button Types:</strong>
                              <div style={{ marginLeft: '10px', marginTop: '5px', fontSize: '13px' }}>
                                {designData.buttons.map((btn, index) => (
                                  <div key={btn.id || index} style={{ margin: '5px 0' }}>
                                    Button {index + 1}: {getButtonType(btn.modelPath)}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {designData.accessories && designData.accessories.length > 0 && (
                            <div className="detail-row" style={{ gridColumn: '1 / -1' }}>
                              <strong>Accessories:</strong>
                              <div style={{ marginLeft: '10px', marginTop: '5px', fontSize: '13px' }}>
                                {designData.accessories.map((acc, index) => (
                                  <div key={acc.id || index} style={{ margin: '5px 0' }}>
                                    {getAccessoryName(acc.modelPath)}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                return null;

              })()}

              {/* User-Provided Body Measurements Section */}
              {(() => {
                // Collect userMeasurements from all garments' designData or from the single designData
                const garments = Array.isArray(selectedOrder.specific_data?.garments)
                  ? selectedOrder.specific_data.garments
                  : [];

                let allUserMeasurements = [];

                if (garments.length > 0) {
                  garments.forEach((garment, idx) => {
                    const dData = parseDesignData(garment.designData);
                    if (dData?.userMeasurements && Object.keys(dData.userMeasurements).length > 0) {
                      allUserMeasurements.push({ index: idx, garmentType: garment.garmentType, measurements: dData.userMeasurements });
                    }
                  });
                } else {
                  const dData = parseDesignData(selectedOrder.specific_data?.designData);
                  if (dData?.userMeasurements && Object.keys(dData.userMeasurements).length > 0) {
                    allUserMeasurements.push({ index: 0, garmentType: selectedOrder.specific_data?.garmentType, measurements: dData.userMeasurements });
                  }
                }

                if (allUserMeasurements.length === 0) return null;

                const formatLabel = (key) => key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());

                return (
                  <div className="detail-row" style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e8f5e9', borderRadius: '8px', border: '1px solid #a5d6a7' }}>
                    <div style={{ width: '100%' }}>
                      <h5 style={{ margin: '0 0 10px 0', color: '#2e7d32', fontSize: '16px', fontWeight: '600' }}>
                        📏 Customer-Provided Body Measurements
                      </h5>
                      <p style={{ fontSize: '12px', color: '#666', margin: '0 0 12px 0', fontStyle: 'italic' }}>
                        These measurements were voluntarily provided by the customer. You can edit them via the "View/Edit Measurements" button above.
                      </p>
                      {allUserMeasurements.map((item, mIdx) => (
                        <div key={mIdx} style={{ marginBottom: '12px', padding: '10px', background: '#fff', borderRadius: '8px', border: '1px solid #c8e6c9' }}>
                          {allUserMeasurements.length > 1 && (
                            <div style={{ marginBottom: '8px', fontWeight: '700', fontSize: '14px' }}>
                              Garment #{item.index + 1} {item.garmentType ? `(${item.garmentType})` : ''}
                            </div>
                          )}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '14px' }}>
                            {Object.entries(item.measurements).map(([key, value]) => (
                              value ? (
                                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: '#f1f8e9', borderRadius: '4px' }}>
                                  <strong>{formatLabel(key)}:</strong>
                                  <span>{value} inches</span>
                                </div>
                              ) : null
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

            </div>

            <div className="modal-footer">

              <button className="close-btn" onClick={() => setShowDetailModal(false)}>Close</button>

            </div>

          </div>

        </div>

      )}
      {showConfirmModal && (

        <div className="modal-overlay active confirm-modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowConfirmModal(false)}>

          <div className="confirm-modal">

            <div className="confirm-icon">

              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#3498DB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">

                <circle cx="12" cy="12" r="10"></circle>

                <line x1="12" y1="8" x2="12" y2="12"></line>

                <line x1="12" y1="16" x2="12.01" y2="16"></line>

              </svg>

            </div>

            <h3>Confirm Action</h3>

            <p>{confirmMessage}</p>

            <div className="confirm-buttons">

              <button className="confirm-btn cancel" onClick={() => setShowConfirmModal(false)}>Cancel</button>

              <button className="confirm-btn confirm" onClick={handleConfirm}>Confirm</button>

            </div>

          </div>

        </div>

      )}
      {showPriceConfirmationModal && priceConfirmationItem && priceConfirmationItem.order_type !== 'walk_in' && (

        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowPriceConfirmationModal(false)}>

          <div className="modal-content">

            <div className="modal-header">

              <h2>Price Confirmation</h2>

              <span className="close-modal" onClick={() => setShowPriceConfirmationModal(false)}>×</span>

            </div>

            <div className="modal-body">

              <div className="detail-row"><strong>Order ID:</strong> #{priceConfirmationItem.order_id}</div>

              <div className="detail-row"><strong>Service:</strong> Customization</div>

              <div className="detail-row"><strong>Fabric:</strong> {priceConfirmationItem.specific_data?.fabricType || 'N/A'}</div>

              <div className="payment-form-group">

                <label>Final Price (₱)</label>

                <input

                  type="number"

                  step="0.01"

                  min="0"

                  value={priceConfirmationPrice}

                  onChange={(e) => setPriceConfirmationPrice(e.target.value)}

                  placeholder="Enter final price"

                />

                {(() => {

                  const estimatedPrice = getEstimatedPrice(priceConfirmationItem);

                  if (estimatedPrice && priceConfirmationPrice) {

                    const priceDiff = parseFloat(priceConfirmationPrice) - estimatedPrice;

                    if (Math.abs(priceDiff) > 0.01) {

                      return (

                        <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#fff3cd', borderRadius: '4px', fontSize: '0.9em' }}>

                          <strong>⚠️ Price Changed:</strong> Estimated: ₱{estimatedPrice.toFixed(2)} → New: ₱{parseFloat(priceConfirmationPrice).toFixed(2)}

                        </div>

                      );

                    }

                  }

                  return null;

                })()}

              </div>

              <div className="payment-form-group" style={{ marginTop: '12px' }}>

                <label>Reason for Price Change <span style={{ color: '#d32f2f' }}>*</span></label>

                <textarea

                  value={priceConfirmationReason}

                  onChange={(e) => setPriceConfirmationReason(e.target.value)}

                  placeholder="Explain why the price was changed..."

                  rows={3}

                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}

                />

              </div>

              <div style={{ marginTop: '15px', padding: '12px', backgroundColor: '#e3f2fd', borderRadius: '4px', fontSize: '0.9em', color: '#1976d2' }}>

                ℹ️ Customer will be notified to confirm the price before proceeding.

              </div>

            </div>

            <div className="modal-footer-centered">

              <button className="btn-cancel" onClick={() => {

                setShowPriceConfirmationModal(false);

                setPriceConfirmationReason('');

              }}>Cancel</button>

              <button className="btn-save" onClick={handlePriceConfirmationSubmit}>Confirm & Move to Price Confirmation</button>

            </div>

          </div>

        </div>

      )}
      {showMeasurementsModal && selectedOrder && (

        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowMeasurementsModal(false)}>

          <div className="modal-content" style={{ maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}>

            <div className="modal-header">

              <h2>Customer Measurements</h2>

              <span className="close-modal" onClick={() => setShowMeasurementsModal(false)}>×</span>

            </div>

            <div className="modal-body">

              <div className="detail-row">

                <strong>Customer:</strong>

                {selectedOrder.order_type === 'walk_in'

                  ? (selectedOrder.walk_in_customer_name || 'Walk-in Customer')

                  : `${selectedOrder.first_name || ''} ${selectedOrder.last_name || ''}`.trim() || 'N/A'}

                {selectedOrder.order_type === 'walk_in' && (

                  <span style={{ marginLeft: '10px', padding: '2px 8px', backgroundColor: '#fff3cd', borderRadius: '4px', fontSize: '12px', color: '#856404' }}>

                    Walk-in

                  </span>

                )}

              </div>
              <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
                <div style={{ flex: 1, padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>

                  <p className="measurement-title" style={{ marginTop: 0, marginBottom: '15px', color: '#000', textAlign: 'center', fontWeight: '600', fontSize: '16px', padding: 0 }}>Top Measurements</p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>

                    <div className="form-group">

                      <label>Chest (inches)</label>

                      <input

                        type="number"

                        step="0.1"

                        value={measurements.top.chest || ''}

                        onChange={(e) => setMeasurements({ ...measurements, top: { ...measurements.top, chest: e.target.value } })}

                        placeholder="Enter chest measurement"

                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}

                      />

                    </div>

                    <div className="form-group">

                      <label>Shoulders (inches)</label>

                      <input

                        type="number"

                        step="0.1"

                        value={measurements.top.shoulders || ''}

                        onChange={(e) => setMeasurements({ ...measurements, top: { ...measurements.top, shoulders: e.target.value } })}

                        placeholder="Enter shoulder measurement"

                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}

                      />

                    </div>

                    <div className="form-group">

                      <label>Sleeve Length (inches)</label>

                      <input

                        type="number"

                        step="0.1"

                        value={measurements.top.sleeve_length || ''}

                        onChange={(e) => setMeasurements({ ...measurements, top: { ...measurements.top, sleeve_length: e.target.value } })}

                        placeholder="Enter sleeve length"

                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}

                      />

                    </div>

                    <div className="form-group">

                      <label>Neck (inches)</label>

                      <input

                        type="number"

                        step="0.1"

                        value={measurements.top.neck || ''}

                        onChange={(e) => setMeasurements({ ...measurements, top: { ...measurements.top, neck: e.target.value } })}

                        placeholder="Enter neck measurement"

                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}

                      />

                    </div>

                    <div className="form-group">

                      <label>Waist (inches)</label>

                      <input

                        type="number"

                        step="0.1"

                        value={measurements.top.waist || ''}

                        onChange={(e) => setMeasurements({ ...measurements, top: { ...measurements.top, waist: e.target.value } })}

                        placeholder="Enter waist measurement"

                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}

                      />

                    </div>

                    <div className="form-group">

                      <label>Length (inches)</label>

                      <input

                        type="number"

                        step="0.1"

                        value={measurements.top.length || ''}

                        onChange={(e) => setMeasurements({ ...measurements, top: { ...measurements.top, length: e.target.value } })}

                        placeholder="Enter length measurement"

                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}

                      />

                    </div>

                  </div>

                </div>
                <div style={{ flex: 1, padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>

                  <p className="measurement-title" style={{ marginTop: 0, marginBottom: '15px', color: '#000', textAlign: 'center', fontWeight: '600', fontSize: '16px', padding: 0 }}>Bottom Measurements</p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>

                    <div className="form-group">

                      <label>Waist (inches)</label>

                      <input

                        type="number"

                        step="0.1"

                        value={measurements.bottom.waist || ''}

                        onChange={(e) => setMeasurements({ ...measurements, bottom: { ...measurements.bottom, waist: e.target.value } })}

                        placeholder="Enter waist measurement"

                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}

                      />

                    </div>

                    <div className="form-group">

                      <label>Hips (inches)</label>

                      <input

                        type="number"

                        step="0.1"

                        value={measurements.bottom.hips || ''}

                        onChange={(e) => setMeasurements({ ...measurements, bottom: { ...measurements.bottom, hips: e.target.value } })}

                        placeholder="Enter hip measurement"

                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}

                      />

                    </div>

                    <div className="form-group">

                      <label>Inseam (inches)</label>

                      <input

                        type="number"

                        step="0.1"

                        value={measurements.bottom.inseam || ''}

                        onChange={(e) => setMeasurements({ ...measurements, bottom: { ...measurements.bottom, inseam: e.target.value } })}

                        placeholder="Enter inseam measurement"

                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}

                      />

                    </div>

                    <div className="form-group">

                      <label>Length (inches)</label>

                      <input

                        type="number"

                        step="0.1"

                        value={measurements.bottom.length || ''}

                        onChange={(e) => setMeasurements({ ...measurements, bottom: { ...measurements.bottom, length: e.target.value } })}

                        placeholder="Enter length measurement"

                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}

                      />

                    </div>

                    <div className="form-group">

                      <label>Thigh (inches)</label>

                      <input

                        type="number"

                        step="0.1"

                        value={measurements.bottom.thigh || ''}

                        onChange={(e) => setMeasurements({ ...measurements, bottom: { ...measurements.bottom, thigh: e.target.value } })}

                        placeholder="Enter thigh measurement"

                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}

                      />

                    </div>

                    <div className="form-group">

                      <label>Outseam (inches)</label>

                      <input

                        type="number"

                        step="0.1"

                        value={measurements.bottom.outseam || ''}

                        onChange={(e) => setMeasurements({ ...measurements, bottom: { ...measurements.bottom, outseam: e.target.value } })}

                        placeholder="Enter outseam measurement"

                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}

                      />

                    </div>

                  </div>

                </div>

              </div>
              <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#FFF8F0', borderRadius: '12px', border: '1px solid #E8C9A0', width: '100%', textAlign: 'left' }}>

                <label style={{ display: 'block', marginBottom: '10px', color: '#333', fontWeight: '700', fontSize: '16px' }}>Notes</label>

                <textarea

                  value={measurements.notes}

                  onChange={(e) => setMeasurements({ ...measurements, notes: e.target.value })}

                  placeholder="Add any additional notes about measurements..."

                  rows={4}

                  style={{ width: '100%', padding: '12px 14px', border: '1px solid #E8C9A0', borderRadius: '8px', fontSize: '14px', lineHeight: '1.5', minHeight: '80px', backgroundColor: '#fff' }}

                />

              </div>

            </div>

            <div className="modal-footer-centered">
              <button className="btn-cancel-list" onClick={() => setShowMeasurementsModal(false)}>Cancel</button>
              <button className="btn-save-list" onClick={async () => {

                const isWalkIn = selectedOrder.order_type === 'walk_in';
                const customerId = isWalkIn
                  ? selectedOrder.walk_in_customer_id
                  : selectedOrder.user_id;

                const customerName = isWalkIn
                  ? selectedOrder.walk_in_customer_name
                  : `${selectedOrder.first_name || ''} ${selectedOrder.last_name || ''}`.trim();

                const measurementsData = {
                  top_measurements: measurements.top,
                  bottom_measurements: measurements.bottom,
                  notes: measurements.notes,
                  isWalkIn: isWalkIn,
                  orderId: selectedOrder.order_id,
                  itemId: selectedOrder.item_id,
                  customer_name: customerName
                };

                try {
                  const result = await saveMeasurements(customerId, measurementsData);
                  if (result.success) {
                    await alert('Measurements saved successfully!', 'Success', 'success');
                    setShowMeasurementsModal(false);

                    loadCustomizationOrders();
                  } else {
                    await alert(result.message || 'Failed to save measurements', 'Error', 'error');
                  }
                } catch (error) {
                  await alert('Failed to save measurements', 'Error', 'error');
                }
              }}>Save Measurements</button>
            </div>

          </div>

        </div>

      )}
      {toast.show && (

        <div className={`toast ${toast.type}`}>

          {toast.type === 'success' ? (

            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">

              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>

              <polyline points="22 4 12 14.01 9 11.01"></polyline>

            </svg>

          ) : (

            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">

              <circle cx="12" cy="12" r="10"></circle>

              <line x1="15" y1="9" x2="9" y2="15"></line>

              <line x1="9" y1="9" x2="15" y2="15"></line>

            </svg>

          )}

          <span>{toast.message}</span>

        </div>

      )}
      <ImagePreviewModal

        isOpen={imagePreviewOpen}

        imageUrl={previewImageUrl}

        altText={previewImageAlt}

        onClose={closeImagePreview}

      />
      {showGLBUploadModal && (

        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowGLBUploadModal(false)}>

          <div className="modal-content" style={{ maxWidth: '600px' }}>

            <div className="modal-header">

              <h2>Upload 3D Model (GLB File)</h2>

              <span className="close-modal" onClick={() => setShowGLBUploadModal(false)}>×</span>

            </div>

            <div className="glb-modal-body">
              <div className="model-type-selection">

                <label>

                  Select Model Type * <span className="required-note">(Important: Choose where this model will be used)</span>

                </label>

                <select

                  value={glbFormData.model_type}

                  onChange={(e) => setGlbFormData({ ...glbFormData, model_type: e.target.value, garment_category: '' })}

                >

                  <option value="garment">👔 Garment (Main clothing items - Coats, Suits, Barong, Pants)</option>

                  <option value="button">🔘 Button (Decorative buttons for garments)</option>

                  <option value="accessory">🎩 Accessory (Hats, ties, belts, etc.)</option>

                </select>

                <div className="model-type-info">

                  {glbFormData.model_type === 'garment' && (

                    <div>

                      <strong>Garment:</strong> This will appear in the "Select Type" dropdown alongside built-in models (Blazer, Barong, Suit, Pants).

                      Use this for complete clothing items.

                    </div>

                  )}

                  {glbFormData.model_type === 'button' && (

                    <div>

                      <strong>Button:</strong> This will appear in the "3D Buttons" section. Use this for decorative button models that can be added to garments.

                    </div>

                  )}

                  {glbFormData.model_type === 'accessory' && (

                    <div>

                      <strong>Accessory:</strong> This will appear in the "3D Accessories" section. Use this for items like hats, ties, belts, etc.

                    </div>

                  )}

                </div>

              </div>

              <div className="glb-form-group">

                <label>Model Name *</label>

                <input

                  type="text"

                  value={glbFormData.model_name}

                  onChange={(e) => setGlbFormData({ ...glbFormData, model_name: e.target.value })}

                  placeholder={glbFormData.model_type === 'garment' ? 'e.g., Chinese Collar 3D Model' : glbFormData.model_type === 'button' ? 'e.g., Gold Button Set' : 'e.g., Leather Belt'}

                />

              </div>
              {glbFormData.model_type === 'garment' && (

                <div className="glb-form-group">

                  <label>Select Garment Type *</label>

                  <select

                    value={glbFormData.garment_category}

                    onChange={(e) => setGlbFormData({ ...glbFormData, garment_category: e.target.value })}

                    required

                  >

                    <option value="">-- Select Garment Type --</option>

                    {getAllGarmentCategories().map(category => (

                      <option key={category.value} value={category.value}>

                        {category.label}

                      </option>

                    ))}

                  </select>

                  <small>This model will appear in the "Select Type" dropdown for the selected garment type</small>

                </div>

              )}

              <div className="glb-form-group">

                <label>GLB File *</label>

                <input

                  type="file"

                  accept=".glb"

                  onChange={handleGLBFileChange}

                />

                {glbFile && (

                  <div className="file-selected-info">

                    Selected: {glbFile.name} ({(glbFile.size / 1024 / 1024).toFixed(2)} MB)

                  </div>

                )}

                <small>Maximum file size: 50MB</small>

              </div>

              <div className="glb-form-group">

                <label>Description</label>

                <textarea

                  value={glbFormData.description}

                  onChange={(e) => setGlbFormData({ ...glbFormData, description: e.target.value })}

                  placeholder="Optional description..."

                  rows={3}

                />

              </div>
              {customModels.length > 0 && (

                <div className="models-list-header">

                  <div className="models-list-title-row">

                    <h3>Existing Custom Models ({customModels.length})</h3>

                    <button

                      onClick={handleDeleteAllModels}

                      className="model-delete-all-btn"

                      title="Delete all custom models"

                    >

                      DELETE ALL

                    </button>

                  </div>

                  <div className="models-scrollable">

                    {customModels.map(model => (

                      <div key={model.model_id} className="model-item-card">

                        <div className="model-item-info">

                          <div className="model-item-name">{model.model_name}</div>

                          <div className="model-item-details">

                            Type: {model.model_type} | Category: {model.garment_category || 'N/A'}

                          </div>

                        </div>

                        <button

                          onClick={() => handleDeleteModel(model.model_id)}

                          className="model-delete-btn"

                        >

                          DELETE

                        </button>

                      </div>

                    ))}

                  </div>

                </div>

              )}

            </div>

            <div className="modal-footer-centered">

              <button className="glb-btn-cancel" onClick={() => setShowGLBUploadModal(false)}>Cancel</button>

              <button

                className="glb-btn-submit"

                onClick={handleGLBUpload}

                disabled={uploadingGLB || !glbFile || !glbFormData.model_name.trim()}

              >

                {uploadingGLB ? 'Uploading...' : 'Upload'}

              </button>

            </div>

          </div>

        </div>

      )}
      {showFabricTypeModal && (

        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowFabricTypeModal(false)}>

          <div className="modal-content" style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>

            <div className="modal-header">

              <h2>{editingFabricType ? 'Edit Fabric Type' : 'Add Fabric Type'}</h2>

              <span className="close-modal" onClick={() => {

                setShowFabricTypeModal(false);

                setEditingFabricType(null);

                setFabricTypeForm({ fabric_name: '', fabric_price: '', description: '', is_active: 1 });

              }}>×</span>

            </div>

            <div className="customize-modal-body">

              <div className="customize-form-group">

                <label>Fabric Name *</label>

                <input

                  type="text"

                  value={fabricTypeForm.fabric_name}

                  onChange={(e) => setFabricTypeForm({ ...fabricTypeForm, fabric_name: e.target.value })}

                  placeholder="e.g., Silk, Cotton, Linen"

                />

              </div>

              <div className="customize-form-group">

                <label>Price (₱) *</label>

                <input

                  type="number"

                  step="0.01"

                  min="0"

                  value={fabricTypeForm.fabric_price}

                  onChange={(e) => setFabricTypeForm({ ...fabricTypeForm, fabric_price: e.target.value })}

                  placeholder="0.00"

                />

              </div>

              <div className="customize-form-group">

                <label>Description</label>

                <textarea

                  value={fabricTypeForm.description}

                  onChange={(e) => setFabricTypeForm({ ...fabricTypeForm, description: e.target.value })}

                  placeholder="Optional description..."

                  rows={3}

                />

              </div>

              <div className="customize-form-group">

                <label>

                  <input

                    type="checkbox"

                    checked={fabricTypeForm.is_active === 1}

                    onChange={(e) => setFabricTypeForm({ ...fabricTypeForm, is_active: e.target.checked ? 1 : 0 })}

                  />

                  Active (Show in dropdowns)

                </label>

              </div>
              {fabricTypes.length > 0 && (

                <div className="fabric-types-list-header">

                  <h3>Existing Fabric Types ({fabricTypes.length})</h3>

                  <div className="fabric-types-scrollable">

                    {fabricTypes.map(fabric => (

                      <div

                        key={fabric.fabric_id}

                        className={`fabric-item-card ${fabric.is_active ? 'active' : 'inactive'}`}

                      >

                        <div className="fabric-item-info">

                          <div className="fabric-item-name">{fabric.fabric_name}</div>

                          <div className="fabric-item-details">

                            <span className="price">Price: ₱{parseFloat(fabric.fabric_price).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>

                            {fabric.description && ` | ${fabric.description}`}

                            {!fabric.is_active && <span className="inactive-badge">(Inactive)</span>}

                          </div>

                        </div>

                        <div className="fabric-item-actions">

                          <button

                            onClick={() => openEditFabricType(fabric)}

                            className="fabric-edit-btn"

                          >

                            Edit

                          </button>

                          <button

                            onClick={() => handleDeleteFabricType(fabric.fabric_id)}

                            className="fabric-delete-btn"

                          >

                            Delete

                          </button>

                        </div>

                      </div>

                    ))}

                  </div>

                </div>

              )}

            </div>

            <div className="customize-modal-footer">

              <button className="customize-btn-cancel" onClick={() => {

                setShowFabricTypeModal(false);

                setEditingFabricType(null);

                setFabricTypeForm({ fabric_name: '', fabric_price: '', description: '', is_active: 1 });

              }}>Cancel</button>

              <button

                className="customize-btn-submit"

                onClick={handleFabricTypeSubmit}

                disabled={!fabricTypeForm.fabric_name.trim() || !fabricTypeForm.fabric_price || isNaN(parseFloat(fabricTypeForm.fabric_price))}

              >

                {editingFabricType ? 'Update' : 'Create'}

              </button>

            </div>

          </div>

        </div>

      )}
      {showGarmentTypeModal && (

        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowGarmentTypeModal(false)}>

          <div className="modal-content" style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>

            <div className="modal-header">

              <h2>{editingGarmentType ? 'Edit Garment Type' : 'Add Garment Type'}</h2>

              <span className="close-modal" onClick={() => {

                setShowGarmentTypeModal(false);

                setEditingGarmentType(null);

                setGarmentTypeForm({ garment_name: '', garment_price: '', garment_code: '', description: '', is_active: 1 });

                setGarmentGlbFile(null);

              }}>×</span>

            </div>

            <div className="customize-modal-body">

              <div className="customize-form-group">

                <label>Garment Name *</label>

                <input

                  type="text"

                  value={garmentTypeForm.garment_name}

                  onChange={(e) => setGarmentTypeForm({ ...garmentTypeForm, garment_name: e.target.value })}

                  placeholder="e.g., Polo, Vest, Tuxedo"

                />

              </div>

              <div className="customize-form-group">

                <label>Garment Code *</label>

                <input

                  type="text"

                  value={garmentTypeForm.garment_code}

                  onChange={(e) => setGarmentTypeForm({ ...garmentTypeForm, garment_code: e.target.value.toLowerCase().replace(/\s+/g, '-') })}

                  placeholder="e.g., polo, vest, tuxedo (lowercase, no spaces)"

                />

                <small>This code is used internally to identify the garment type. Use lowercase letters and hyphens only.</small>

              </div>

              <div className="customize-form-group">

                <label>Price (₱) *</label>

                <input

                  type="number"

                  step="0.01"

                  min="0"

                  value={garmentTypeForm.garment_price}

                  onChange={(e) => setGarmentTypeForm({ ...garmentTypeForm, garment_price: e.target.value })}

                  placeholder="0.00"

                />

              </div>

              <div className="customize-form-group">

                <label>3D Model (GLB File) {!editingGarmentType && '*'}</label>

                <input

                  type="file"

                  accept=".glb"

                  onChange={handleGarmentGlbFileChange}

                  style={{ marginBottom: '8px' }}

                />

                {garmentGlbFile && (

                  <div style={{

                    padding: '8px 12px',

                    backgroundColor: '#e8f5e9',

                    borderRadius: '4px',

                    fontSize: '13px',

                    color: '#2e7d32',

                    display: 'flex',

                    alignItems: 'center',

                    gap: '8px'

                  }}>

                    <span>✅</span>

                    <span>Selected: {garmentGlbFile.name} ({(garmentGlbFile.size / 1024 / 1024).toFixed(2)} MB)</span>

                  </div>

                )}

                <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>

                  {editingGarmentType

                    ? 'Upload a new GLB file to replace the existing 3D model (optional)'

                    : 'Upload a 3D model file (.glb) that will be displayed in the 3D customizer. Max 50MB.'}

                </small>

              </div>

              <div className="customize-form-group">

                <label>Description</label>

                <textarea

                  value={garmentTypeForm.description}

                  onChange={(e) => setGarmentTypeForm({ ...garmentTypeForm, description: e.target.value })}

                  placeholder="Optional description..."

                  rows={3}

                />

              </div>

              <div className="customize-form-group">

                <label>

                  <input

                    type="checkbox"

                    checked={garmentTypeForm.is_active === 1}

                    onChange={(e) => setGarmentTypeForm({ ...garmentTypeForm, is_active: e.target.checked ? 1 : 0 })}

                  />

                  Active (Show in dropdowns)

                </label>

              </div>
              {garmentTypes.length > 0 && (

                <div className="fabric-types-list-header">

                  <h3>Existing Garment Types ({garmentTypes.length})</h3>

                  <div className="fabric-types-scrollable">

                    {garmentTypes.map(garment => (

                      <div

                        key={garment.garment_id}

                        className={`fabric-item-card ${garment.is_active ? 'active' : 'inactive'}`}

                      >

                        <div className="fabric-item-info">

                          <div className="fabric-item-name">{garment.garment_name}</div>

                          <div className="fabric-item-details">

                            <span className="price">Price: ₱{parseFloat(garment.garment_price).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>

                            {garment.garment_code && <span> | Code: {garment.garment_code}</span>}

                            {garment.description && ` | ${garment.description}`}

                            {!garment.is_active && <span className="inactive-badge">(Inactive)</span>}

                          </div>

                        </div>

                        <div className="fabric-item-actions">

                          <button

                            onClick={() => openEditGarmentType(garment)}

                            className="fabric-edit-btn"

                          >

                            Edit

                          </button>

                          <button

                            onClick={() => handleDeleteGarmentType(garment.garment_id)}

                            className="fabric-delete-btn"

                          >

                            Delete

                          </button>

                        </div>

                      </div>

                    ))}

                  </div>

                </div>

              )}

            </div>

            <div className="customize-modal-footer">

              <button className="customize-btn-cancel" onClick={() => {

                setShowGarmentTypeModal(false);

                setEditingGarmentType(null);

                setGarmentTypeForm({ garment_name: '', garment_price: '', garment_code: '', description: '', is_active: 1 });

                setGarmentGlbFile(null);

              }} disabled={uploadingGarmentGlb}>Cancel</button>

              <button

                className="customize-btn-submit"

                onClick={handleGarmentTypeSubmit}

                disabled={

                  uploadingGarmentGlb ||

                  !garmentTypeForm.garment_name.trim() ||

                  !garmentTypeForm.garment_price ||

                  isNaN(parseFloat(garmentTypeForm.garment_price)) ||

                  (!editingGarmentType && !garmentGlbFile)

                }

              >

                {uploadingGarmentGlb ? 'Uploading...' : (editingGarmentType ? 'Update' : 'Create')}

              </button>

            </div>

          </div>

        </div>

      )}
      {showSizeModal && (

        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowSizeModal(false)}>

          <div className="modal-content" style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>

            <div className="modal-header">

              <h2>Add Sizes</h2>

              <span className="close-modal" onClick={() => setShowSizeModal(false)}>×</span>

            </div>

            <div className="customize-modal-body">

              <div className="customize-form-group">
                <label>Garment Type *</label>
                <select value={sizeModalGarmentId} onChange={(e) => onChangeSizeModalGarment(e.target.value)}>
                  <option value="">Select Garment Type</option>
                  {garmentTypes.map(g => (
                    <option key={g.garment_id} value={g.garment_id}>{g.garment_name}</option>
                  ))}
                </select>
              </div>

              <div className="customize-form-group" style={{ borderTop: '1px solid #e0e0e0', paddingTop: '16px' }}>
                <label>Measurement Fields</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px', marginBottom: '10px' }}>
                  {COMMON_MEASUREMENTS.map(m => {
                    const active = sizeModalMeasurements.some(x => x.field === m.field);
                    return (
                      <button
                        key={m.field}
                        type="button"
                        onClick={() => active ? removeMeasurementFromSizeModal(m.field) : addMeasurementToSizeModal(m)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '14px',
                          border: active ? '2px solid #4caf50' : '1px solid #ccc',
                          backgroundColor: active ? '#e8f5e9' : '#fff',
                          color: active ? '#2e7d32' : '#555',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        {active ? '✓ ' : '+ '}{m.label}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1', minWidth: '150px' }}>
                    <small>Custom Label</small>
                    <input
                      type="text"
                      value={sizeModalCustomLabel}
                      onChange={(e) => setSizeModalCustomLabel(e.target.value)}
                      placeholder="e.g., Armhole"
                    />
                  </div>
                  <div style={{ minWidth: '100px' }}>
                    <small>Unit</small>
                    <select value={sizeModalCustomUnit} onChange={(e) => setSizeModalCustomUnit(e.target.value)}>
                      <option value="inches">inches</option>
                      <option value="cm">cm</option>
                      <option value="mm">mm</option>
                    </select>
                  </div>
                  <button type="button" className="fabric-edit-btn" onClick={addCustomMeasurementToSizeModal}>Add</button>
                </div>
              </div>

              <div className="customize-form-group" style={{ borderTop: '1px solid #e0e0e0', paddingTop: '16px' }}>
                <label>Add Size</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={sizeModalNewSize}
                    onChange={(e) => setSizeModalNewSize(e.target.value)}
                    placeholder="e.g., Extra Small"
                  />
                  <button type="button" className="fabric-edit-btn" onClick={addSizeToSizeModal}>+ Add Size</button>
                </div>
              </div>

              {sizeModalMeasurements.length > 0 && Object.keys(sizeModalSizeChart).length > 0 && (
                <div className="customize-form-group">
                  <label>Size Details</label>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '450px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f5f5f5' }}>
                          <th style={{ padding: '8px', borderBottom: '1px solid #ddd', textAlign: 'left' }}>Size</th>
                          {sizeModalMeasurements.map(m => (
                            <th key={m.field} style={{ padding: '8px', borderBottom: '1px solid #ddd', textAlign: 'center' }}>
                              {m.label}
                              <br />
                              <small>({m.unit})</small>
                            </th>
                          ))}
                          <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.keys(sizeModalSizeChart).map(sizeKey => (
                          <tr key={sizeKey} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '8px', fontWeight: '600' }}>{sizeKey.replace(/-/g, ' ')}</td>
                            {sizeModalMeasurements.map(m => (
                              <td key={m.field} style={{ padding: '6px' }}>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={sizeModalSizeChart?.[sizeKey]?.[m.field] ?? ''}
                                  onChange={(e) => updateSizeModalValue(sizeKey, m.field, e.target.value)}
                                  style={{ width: '100%', textAlign: 'center' }}
                                />
                              </td>
                            ))}
                            <td style={{ padding: '6px' }}>
                              <button type="button" className="fabric-delete-btn" onClick={() => removeSizeFromSizeModal(sizeKey)}>Remove</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>

            <div className="customize-modal-footer">
              <button className="customize-btn-cancel" onClick={() => setShowSizeModal(false)}>Cancel</button>
              <button className="customize-btn-submit" onClick={handleSaveSizeModal} disabled={!sizeModalGarmentId}>Save</button>
            </div>

          </div>

        </div>

      )}
      {showPatternModal && (

        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowPatternModal(false)}>

          <div className="modal-content" style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>

            <div className="modal-header">

              <h2>{editingPattern ? 'Edit Pattern' : 'Add New Pattern'}</h2>

              <span className="close-modal" onClick={() => {

                setShowPatternModal(false);

                resetPatternForm();

              }}>×</span>

            </div>

            <div className="customize-modal-body">

              <div className="customize-form-group">

                <label>Pattern Name *</label>

                <input

                  type="text"

                  value={patternForm.pattern_name}

                  onChange={(e) => {

                    setPatternForm({

                      ...patternForm,

                      pattern_name: e.target.value,

                      pattern_code: patternForm.pattern_code || generatePatternCode(e.target.value)

                    });

                  }}

                  placeholder="e.g., Floral Print, Polka Dots, Herringbone"

                />

              </div>

              <div className="customize-form-group">

                <label>Pattern Code</label>

                <input

                  type="text"

                  value={patternForm.pattern_code}

                  onChange={(e) => setPatternForm({ ...patternForm, pattern_code: e.target.value })}

                  placeholder="Auto-generated from name"

                  disabled={editingPattern && ['none', 'minimal-stripe', 'minimal-check', 'embroidery-1', 'embroidery-2'].includes(editingPattern.pattern_code)}

                />

                <small style={{ color: '#666' }}>Unique identifier for the pattern (auto-generated if empty)</small>

              </div>

              <div className="customize-form-group">

                <label>Pattern Image {!editingPattern && '*'}</label>

                <input

                  type="file"

                  accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"

                  onChange={handlePatternImageChange}

                  style={{ marginBottom: '10px' }}

                />

                <small style={{ color: '#666' }}>Supported formats: JPEG, PNG, GIF, WebP, SVG (max 10MB)</small>

                {patternImagePreview && (

                  <div style={{ marginTop: '10px', textAlign: 'center' }}>

                    <p style={{ marginBottom: '8px', color: '#666', fontSize: '14px' }}>Preview:</p>

                    <div style={{

                      width: '200px',

                      height: '200px',

                      margin: '0 auto',

                      border: '2px solid #ddd',

                      borderRadius: '8px',

                      overflow: 'hidden',

                      background: `url(${patternImagePreview})`,

                      backgroundSize: 'cover',

                      backgroundPosition: 'center',

                      backgroundRepeat: 'repeat'

                    }} />

                    <p style={{ marginTop: '8px', color: '#888', fontSize: '12px' }}>

                      This pattern will tile/repeat on garments

                    </p>

                  </div>

                )}

              </div>

              <div style={{ display: 'flex', gap: '15px' }}>

                <div className="customize-form-group" style={{ flex: 1 }}>

                  <label>Repeat X</label>

                  <input

                    type="number"

                    step="0.5"

                    min="0.5"

                    max="10"

                    value={patternForm.repeat_x}

                    onChange={(e) => setPatternForm({ ...patternForm, repeat_x: parseFloat(e.target.value) || 2.0 })}

                    placeholder="2.0"

                  />

                  <small style={{ color: '#666' }}>Horizontal repeat (higher = smaller pattern)</small>

                </div>

                <div className="customize-form-group" style={{ flex: 1 }}>

                  <label>Repeat Y</label>

                  <input

                    type="number"

                    step="0.5"

                    min="0.5"

                    max="10"

                    value={patternForm.repeat_y}

                    onChange={(e) => setPatternForm({ ...patternForm, repeat_y: parseFloat(e.target.value) || 2.0 })}

                    placeholder="2.0"

                  />

                  <small style={{ color: '#666' }}>Vertical repeat (higher = smaller pattern)</small>

                </div>

              </div>
              {!editingPattern && (

                <div style={{

                  border: '1px solid #e0e0e0',

                  borderRadius: '8px',

                  padding: '15px',

                  marginTop: '15px',

                  backgroundColor: '#f8f9fa'

                }}>

                  <h4 style={{ margin: '0 0 12px 0', color: '#333', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>

                    🔄 Seamless Texture Processing

                    <span style={{

                      fontSize: '11px',

                      backgroundColor: '#4CAF50',

                      color: 'white',

                      padding: '2px 8px',

                      borderRadius: '10px'

                    }}>

                      Auto

                    </span>

                  </h4>

                  <p style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>

                    Your uploaded image will be automatically converted into a seamless, tileable fabric pattern

                    optimized for 3D garment texturing.

                  </p>

                  <div className="customize-form-group" style={{ marginBottom: '12px' }}>

                    <label>

                      <input

                        type="checkbox"

                        checked={patternForm.make_seamless}

                        onChange={(e) => setPatternForm({ ...patternForm, make_seamless: e.target.checked })}

                      />

                      Create seamless tileable texture

                    </label>

                    <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>

                      Blends edges for smooth repetition without visible seams

                    </small>

                  </div>

                  <div style={{ display: 'flex', gap: '15px' }}>

                    <div className="customize-form-group" style={{ flex: 1 }}>

                      <label>Texture Resolution</label>

                      <select

                        value={patternForm.texture_size}

                        onChange={(e) => setPatternForm({ ...patternForm, texture_size: parseInt(e.target.value) })}

                      >

                        <option value={256}>256x256 (Fast, Low Detail)</option>

                        <option value={512}>512x512 (Balanced)</option>

                        <option value={1024}>1024x1024 (High Quality)</option>

                        <option value={2048}>2048x2048 (Maximum Detail)</option>

                      </select>

                      <small style={{ color: '#666' }}>Higher = better quality, larger file</small>

                    </div>

                    <div className="customize-form-group" style={{ flex: 1 }}>

                      <label>Pattern Scale</label>

                      <select

                        value={patternForm.pattern_scale}

                        onChange={(e) => setPatternForm({ ...patternForm, pattern_scale: e.target.value })}

                      >

                        <option value="small">Small (Fine details, more repeats)</option>

                        <option value="medium">Medium (Balanced)</option>

                        <option value="large">Large (Bold pattern, fewer repeats)</option>

                      </select>

                      <small style={{ color: '#666' }}>How pattern appears on garments</small>

                    </div>

                  </div>

                  <div style={{

                    marginTop: '10px',

                    padding: '10px',

                    backgroundColor: '#e3f2fd',

                    borderRadius: '6px',

                    fontSize: '12px',

                    color: '#1565c0'

                  }}>

                    ✨ <strong>Applies to all garments:</strong> Coats, Barong, Suits, Pants, and any custom models

                  </div>

                </div>

              )}

              <div className="customize-form-group">

                <label>Description</label>

                <textarea

                  value={patternForm.description}

                  onChange={(e) => setPatternForm({ ...patternForm, description: e.target.value })}

                  placeholder="Optional description of the pattern..."

                  rows={2}

                />

              </div>

              <div className="customize-form-group">

                <label>

                  <input

                    type="checkbox"

                    checked={patternForm.is_active === 1}

                    onChange={(e) => setPatternForm({ ...patternForm, is_active: e.target.checked ? 1 : 0 })}

                  />

                  Active (Show in pattern dropdown)

                </label>

              </div>
              {patterns.length > 0 && (

                <div className="fabric-types-list-header">

                  <h3>Existing Patterns ({patterns.length})</h3>

                  <div className="fabric-types-scrollable" style={{ maxHeight: '300px', overflowY: 'auto' }}>

                    {patterns.map(pattern => {

                      const isDefault = ['none', 'minimal-stripe', 'minimal-check', 'embroidery-1', 'embroidery-2'].includes(pattern.pattern_code);

                      const imageUrl = getPatternImageUrl(pattern);

                      return (

                        <div

                          key={pattern.pattern_id}

                          className={`fabric-item-card ${pattern.is_active ? 'active' : 'inactive'}`}

                          style={{ display: 'flex', alignItems: 'center', gap: '15px' }}

                        >
                          <div style={{

                            width: '60px',

                            height: '60px',

                            borderRadius: '6px',

                            border: '1px solid #ddd',

                            flexShrink: 0,

                            background: imageUrl

                              ? `url(${imageUrl}) center/cover`

                              : pattern.pattern_type === 'procedural'

                                ? '#f0f0f0'

                                : '#ccc',

                            display: 'flex',

                            alignItems: 'center',

                            justifyContent: 'center',

                            fontSize: '10px',

                            color: '#666'

                          }}>

                            {!imageUrl && pattern.pattern_type === 'procedural' && '🎨'}

                          </div>

                          <div className="fabric-item-info" style={{ flex: 1 }}>

                            <div className="fabric-item-name">

                              {pattern.pattern_name}

                              {isDefault && <span style={{ color: '#888', fontSize: '12px', marginLeft: '8px' }}>(Built-in)</span>}

                            </div>

                            <div className="fabric-item-details">

                              <span>Code: {pattern.pattern_code}</span>

                              {' | '}

                              <span>Type: {pattern.pattern_type}</span>

                              {' | '}

                              <span>Repeat: {pattern.repeat_x}x{pattern.repeat_y}</span>

                              {!pattern.is_active && <span className="inactive-badge">(Inactive)</span>}

                            </div>

                          </div>

                          <div className="fabric-item-actions">

                            <button

                              className="fabric-edit-btn"

                              onClick={() => openEditPattern(pattern)}

                            >

                              Edit

                            </button>

                            {!isDefault && (

                              <button

                                className="fabric-delete-btn"

                                onClick={() => handleDeletePattern(pattern.pattern_id, pattern.pattern_code)}

                              >

                                Delete

                              </button>

                            )}

                          </div>

                        </div>

                      );

                    })}

                  </div>

                </div>

              )}

            </div>

            <div className="modal-footer-centered">

              <button className="customize-btn-cancel" onClick={() => {

                setShowPatternModal(false);

                resetPatternForm();

              }} disabled={uploadingPattern}>Cancel</button>

              <button

                className="customize-btn-submit"

                onClick={handlePatternSubmit}

                disabled={

                  uploadingPattern ||

                  !patternForm.pattern_name.trim() ||

                  (!editingPattern && !patternImageFile)

                }

              >

                {uploadingPattern ? 'Uploading...' : (editingPattern ? 'Update' : 'Create Pattern')}

              </button>

            </div>

          </div>

        </div>

      )}
      {showPaymentModal && selectedOrder && (

        <div className="modal-overlay active" onClick={(e) => {

          if (e.target.classList.contains('modal-overlay')) setShowPaymentModal(false);

        }}>

          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>

            <div className="modal-header">

              <h2>Record Payment</h2>

              <span className="close-modal" onClick={() => setShowPaymentModal(false)}>×</span>

            </div>

            <div className="modal-body">

              <div className="detail-row">

                <strong>Order ID:</strong>

                <span>ORD-{selectedOrder.order_id}</span>

              </div>

              <div className="detail-row">

                <strong>Customer:</strong>

                <span>{selectedOrder.first_name} {selectedOrder.last_name}</span>

              </div>

              <div className="detail-row">

                <strong>Service:</strong>

                <span>Customization - {selectedOrder.specific_data?.garmentType || 'N/A'}</span>

              </div>

              <div className="detail-row">

                <strong>Total Price:</strong>

                <span>₱{parseFloat(selectedOrder.final_price || 0).toLocaleString()}</span>

              </div>

              {(() => {

                const pricingFactors = typeof selectedOrder.pricing_factors === 'string'

                  ? JSON.parse(selectedOrder.pricing_factors || '{}')

                  : (selectedOrder.pricing_factors || {});

                const amountPaid = parseFloat(pricingFactors.amount_paid || 0);

                const finalPrice = parseFloat(selectedOrder.final_price || 0);

                const remaining = finalPrice - amountPaid;

                if (amountPaid > 0) {

                  return (

                    <>

                      <div className="detail-row">

                        <strong>Amount Paid:</strong>

                        <span>₱{amountPaid.toLocaleString()}</span>

                      </div>

                      <div className="detail-row">

                        <strong>Remaining Balance:</strong>

                        <span style={{ color: remaining > 0 ? '#ff9800' : '#4caf50', fontWeight: 'bold' }}>

                          ₱{Math.max(0, remaining).toLocaleString()}

                        </span>

                      </div>

                    </>

                  );

                }

                return null;

              })()}

              <div className="payment-form-group">

                <label>Payment Amount *</label>

                <input

                  type="number"

                  value={paymentAmount}

                  onChange={(e) => setPaymentAmount(e.target.value)}

                  className="form-control"

                  placeholder="Enter payment amount"

                  min="0"

                  step="0.01"

                  autoFocus

                />

                <small style={{ color: '#666', marginTop: '5px', display: 'block' }}>

                  Enter the amount the customer is paying now

                </small>

              </div>

              <div className="payment-form-group">

                <label>Cash Received *</label>

                <input

                  type="number"

                  value={cashReceived}

                  onChange={(e) => setCashReceived(e.target.value)}

                  className="form-control"

                  placeholder="Enter cash received (e.g. 1000)"

                  min="0"

                  step="0.01"

                />

                {!Number.isNaN(parseFloat(paymentAmount)) && !Number.isNaN(parseFloat(cashReceived)) && parseFloat(cashReceived) >= parseFloat(paymentAmount) && (

                  <small style={{ color: '#2e7d32', marginTop: '5px', display: 'block' }}>

                    Change: ₱{(parseFloat(cashReceived) - parseFloat(paymentAmount)).toFixed(2)}

                  </small>

                )}

              </div>

            </div>

            <div className="modal-footer-centered">

              <button className="btn-cancel" onClick={() => {

                setShowPaymentModal(false);

                setPaymentAmount('');

                setCashReceived('');

              }}>

                Cancel

              </button>

              <button className="btn-save" onClick={handleRecordPayment}>

                Record Payment

              </button>

            </div>

          </div>

        </div>

      )}

    </div>

  );

};

export default Customize;

