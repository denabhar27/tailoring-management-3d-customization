import { useState, useEffect, Fragment, useRef } from 'react';

import { useNavigate } from 'react-router-dom';

import { API_BASE_URL, getImageUrl } from '../api/config';
import { formatPatternChoice } from '../utils/patternDisplay';

import '../adminStyle/customize.css';

import AdminHeader from './AdminHeader';

import Sidebar from './Sidebar';

import { getAllCustomizationOrders, updateCustomizationOrderItem, uploadGLBFile, getAllCustom3DModels, deleteCustom3DModel, updateCustom3DModel, cancelEnhancement } from '../api/CustomizationApi';

import { getUserRole } from '../api/AuthApi';

import { getAllFabricTypesAdmin, createFabricType, updateFabricType, deleteFabricType } from '../api/FabricTypeApi';

import { getAllGarmentTypesAdmin, createGarmentType, updateGarmentType, deleteGarmentType } from '../api/GarmentTypeApi';

import { getAllPatterns, uploadPatternImage, createPattern, updatePattern, deletePattern } from '../api/PatternApi';

import ImagePreviewModal from '../components/ImagePreviewModal';

import { getMeasurements, saveMeasurements } from '../api/CustomerApi';

import { useAlert } from '../context/AlertContext';

import { recordPayment } from '../api/PaymentApi';

import { deleteOrderItem, updateOrderItemPrice } from '../api/OrderApi';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { createPortal } from 'react-dom';

import CustomizationPriceEditModal from '../components/admin/CustomizationPriceEditModal';

const isAuthenticated = () => {

  return !!localStorage.getItem('token');

};

const Customize = () => {

  const { alert, confirm, prompt } = useAlert();

  const navigate = useNavigate();

  const [allItems, setAllItems] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');

  const [statusFilter, setStatusFilter] = useState('');

  const [todayAppointmentsOnly, setTodayAppointmentsOnly] = useState(false);
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [timeFilter, setTimeFilter] = useState('');

  const [viewFilter, setViewFilter] = useState("all");
  const [tableView, setTableView] = useState('orders');

  const [showDetailModal, setShowDetailModal] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailEstimatedCompletionDate, setDetailEstimatedCompletionDate] = useState('');
  const [savingEstimatedDate, setSavingEstimatedDate] = useState(false);
  const [showEnhanceModal, setShowEnhanceModal] = useState(false);
  const [enhanceOrder, setEnhanceOrder] = useState(null);
  const [savingEnhancement, setSavingEnhancement] = useState(false);
  const [enhanceForm, setEnhanceForm] = useState({
    notes: '',
    additionalCost: '',
    estimatedCompletionDate: ''
  });
  const [showEnhancementViewModal, setShowEnhancementViewModal] = useState(false);
  const [enhancementViewItem, setEnhancementViewItem] = useState(null);
  const [enhancementPriceItem, setEnhancementPriceItem] = useState(null);
  const [savingEnhancementPrice, setSavingEnhancementPrice] = useState(false);
  const [showAccessoriesPriceModal, setShowAccessoriesPriceModal] = useState(false);
  const [accessoriesPriceItem, setAccessoriesPriceItem] = useState(null);
  const [accessoriesPrice, setAccessoriesPrice] = useState('');

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

  const [additionalMeasurementProfiles, setAdditionalMeasurementProfiles] = useState([]);

  const [measurementsLoading, setMeasurementsLoading] = useState(false);

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const [confirmAction, setConfirmAction] = useState(null);

  const [confirmMessage, setConfirmMessage] = useState('');

  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [paymentAmount, setPaymentAmount] = useState('');

  const [cashReceived, setCashReceived] = useState('');
  const [paymentOption, setPaymentOption] = useState('downpayment');
  const [moveToStatusOnNoDownpayment, setMoveToStatusOnNoDownpayment] = useState('');

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const [showPriceEditModal, setShowPriceEditModal] = useState(false);

  const [priceEditOrder, setPriceEditOrder] = useState(null);

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

  const [collapsedParentOrders, setCollapsedParentOrders] = useState({});
  const [openSecondaryMenuId, setOpenSecondaryMenuId] = useState(null);
  const [secondaryMenuPosition, setSecondaryMenuPosition] = useState({ top: 0, left: 0 });
  const secondaryMenuRef = useRef(null);

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
  const [sizeModalModelId, setSizeModalModelId] = useState('');
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

  const toggleParentOrderCollapse = (orderId) => {
    setCollapsedParentOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  useEffect(() => {
    if (!openSecondaryMenuId) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (secondaryMenuRef.current && !secondaryMenuRef.current.contains(event.target)) {
        setOpenSecondaryMenuId(null);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpenSecondaryMenuId(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openSecondaryMenuId]);

  useEffect(() => {
    if (!openSecondaryMenuId) {
      return undefined;
    }

    const handleViewportChange = () => {
      setOpenSecondaryMenuId(null);
    };

    window.addEventListener('scroll', handleViewportChange, true);
    window.addEventListener('resize', handleViewportChange);

    return () => {
      window.removeEventListener('scroll', handleViewportChange, true);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [openSecondaryMenuId]);

  const toggleSecondaryMenu = (menuId, triggerElement) => {
    if (openSecondaryMenuId === menuId) {
      setOpenSecondaryMenuId(null);
      return;
    }

    if (triggerElement && typeof window !== 'undefined') {
      const rect = triggerElement.getBoundingClientRect();
      const menuWidth = 170;
      const viewportPadding = 8;
      const left = Math.max(
        viewportPadding,
        Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - viewportPadding)
      );
      const top = Math.min(rect.bottom + 8, window.innerHeight - viewportPadding);

      setSecondaryMenuPosition({ top, left });
    }

    setOpenSecondaryMenuId(menuId);
  };

  const closeSecondaryMenu = () => {
    setOpenSecondaryMenuId(null);
  };

  const renderSecondaryActionMenu = ({
    menuId,
    showEditPrice = false,
    showDelete = false,
    onEditPrice,
    onDelete
  }) => {
    if (!showEditPrice && !showDelete) {
      return null;
    }

    const isOpen = openSecondaryMenuId === menuId;

    return (
      <div className={`secondary-actions-menu${isOpen ? ' open' : ''}`}>
        <button
          type="button"
          className="icon-btn secondary-actions-trigger"
          onClick={(e) => {
            e.stopPropagation();
            toggleSecondaryMenu(menuId, e.currentTarget);
          }}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-label="Open more actions"
        >
          <span className="secondary-actions-dots" aria-hidden="true">...</span>
        </button>

        {isOpen && typeof document !== 'undefined' && createPortal(
          <div
            ref={secondaryMenuRef}
            className="secondary-actions-dropdown secondary-actions-dropdown-portal"
            role="menu"
            style={{ top: `${secondaryMenuPosition.top}px`, left: `${secondaryMenuPosition.left}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            {showEditPrice && (
              <button
                type="button"
                className="secondary-actions-item"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  closeSecondaryMenu();
                  onEditPrice?.();
                }}
              >
                Edit Price
              </button>
            )}

            {showDelete && (
              <button
                type="button"
                className="secondary-actions-item danger"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  closeSecondaryMenu();
                  onDelete?.();
                }}
              >
                Delete Order
              </button>
            )}
          </div>,
          document.body
        )}
      </div>
    );
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

      'ready_to_pickup': 'to-pickup',

      'picked_up': 'to-pickup',

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

      'ready_to_pickup': 'To Pick up',

      'picked_up': 'To Pick up',

      'completed': 'Completed',

      'cancelled': 'Rejected',

      'auto_confirmed': 'In Progress'

    };

    return statusTextMap[status] || 'Pending';

  };

  const getNextStatus = (currentStatus, serviceType = 'customization', item = null) => {

    const normalizedCurrentStatus = currentStatus === 'ready_to_pickup' ? 'ready_for_pickup' : currentStatus;

    if (!normalizedCurrentStatus || normalizedCurrentStatus === 'pending_review' || normalizedCurrentStatus === 'pending') {

      return 'price_confirmation';

    }

    if (normalizedCurrentStatus === 'price_confirmation') {

      return 'accepted';

    }

    if (normalizedCurrentStatus === 'accepted') {

      return 'confirmed';

    }

    if (normalizedCurrentStatus === 'picked_up') {

      return 'completed';

    }

    const statusFlow = {

      'repair': ['pending', 'price_confirmation', 'accepted', 'confirmed', 'ready_for_pickup', 'completed'],

      'customization': ['pending', 'price_confirmation', 'accepted', 'confirmed', 'ready_for_pickup', 'completed'],

      'dry_cleaning': ['pending', 'price_confirmation', 'accepted', 'confirmed', 'ready_for_pickup', 'completed'],

      'rental': ['pending', 'ready_for_pickup', 'picked_up', 'rented', 'returned', 'completed']

    };

    const flow = statusFlow[serviceType] || statusFlow['customization'];

    const currentIndex = flow.indexOf(normalizedCurrentStatus);

    if (currentIndex === -1 || currentIndex === flow.length - 1) {

      return null;

    }

    const nextStatus = flow[currentIndex + 1];

    if (nextStatus === 'completed' && item) {

      const pricingFactors = typeof item.pricing_factors === 'string'

        ? JSON.parse(item.pricing_factors || '{}')

        : (item.pricing_factors || {});

      const isEnhancementOrder = pricingFactors.enhancementRequest && pricingFactors.enhancementAdminAccepted;
      const isAccessoriesEnhancement = isEnhancementOrder && !!pricingFactors.accessoriesPrice;
      const amountPaid = (isEnhancementOrder && !isAccessoriesEnhancement) ? parseFloat(item.final_price || 0) : parseFloat(pricingFactors.amount_paid || 0);

      const finalPrice = parseFloat(item.final_price || 0);

      const remainingBalance = finalPrice - amountPaid;

      if (remainingBalance > 0.01) {

        return null;

      }

    }

    return nextStatus;

  };

  const isToday = (dateStr) => {
    if (!dateStr) return false;
    try {
      const today = new Date();
      const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const raw = String(dateStr).trim();
      const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
      if (match?.[1]) return match[1] === todayKey;

      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) return false;
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return dateKey === todayKey;
    } catch (e) {
      return false;
    }
  };

  const parseMaybeObject = (value) => {
    if (!value) return {};
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (e) {
        return {};
      }
    }
    return {};
  };

  const getComputedStatus = (item) => {
    const specificData = parseMaybeObject(item?.specific_data);
    const pricingFactors = parseMaybeObject(item?.pricing_factors);
    const appointmentDate =
      item?.appointment_date ||
      item?.appointmentDate ||
      specificData?.appointment_date ||
      specificData?.appointmentDate ||
      specificData?.preferredDate ||
      specificData?.date;
    const estimatedDate = pricingFactors?.estimatedCompletionDate || pricingFactors?.estimated_completion_date;

    if (appointmentDate && isToday(appointmentDate)) {
      return 'appointment-today';
    }
    if (estimatedDate && isToday(estimatedDate)) {
      return 'estimated-today';
    }
    return null;
  };

  const getPreferredCompletionDate = (item) => {
    const specificData = parseMaybeObject(item?.specific_data);
    return specificData?.preferredDate
      || specificData?.preferred_date
      || specificData?.appointmentDate
      || specificData?.appointment_date
      || item?.preferred_date
      || '';
  };

  const isTodayAppointment = (item) => getComputedStatus(item) === 'appointment-today';

  const getNextStatusLabel = (currentStatus, serviceType = 'customization', item = null) => {

    const nextStatus = getNextStatus(currentStatus, serviceType, item);

    if (!nextStatus) return null;

    const labelMap = {

      'accepted': 'Accept',

      'price_confirmation': 'Price Confirm',

      'confirmed': 'Next',

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

  const normalizeMeasurementFields = (value) => {
    const parsed = parseJSONField(value, []);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed).map(([field, config]) => ({
        field,
        label: config?.label || field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        unit: config?.unit || 'inches'
      }));
    }
    return [];
  };

  const getSelectedSizeModalGarment = () => garmentTypes.find(g => String(g.garment_id) === String(sizeModalGarmentId));

  const getSizeModalGarmentModels = () => {
    const selectedGarment = getSelectedSizeModalGarment();
    if (!selectedGarment?.garment_code) return [];
    const category = String(selectedGarment.garment_code).toLowerCase();
    return (customModels || []).filter((m) =>
      m &&
      m.is_active &&
      String(m.model_type || '').toLowerCase() === 'garment' &&
      String(m.garment_category || '').toLowerCase() === category
    );
  };

  const getSelectedSizeModalModel = () => {
    if (!sizeModalModelId) return null;
    return getSizeModalGarmentModels().find((m) => String(m.model_id) === String(sizeModalModelId)) || null;
  };

  const loadSizeModalProfile = (garment, model = null) => {
    if (model) {
      setSizeModalMeasurements(normalizeMeasurementFields(model.measurement_fields));
      setSizeModalSizeChart(parseJSONField(model.size_chart, {}));
      return;
    }
    setSizeModalMeasurements(normalizeMeasurementFields(garment?.measurement_fields));
    setSizeModalSizeChart(parseJSONField(garment?.size_chart, {}));
  };

  const openSizeModal = (garmentId = '') => {
    const selectedId = garmentId || (garmentTypes[0]?.garment_id ? String(garmentTypes[0].garment_id) : '');
    setSizeModalGarmentId(selectedId);
    setSizeModalModelId('');
    const selectedGarment = garmentTypes.find(g => String(g.garment_id) === String(selectedId));
    loadSizeModalProfile(selectedGarment, null);
    setSizeModalNewSize('');
    setSizeModalCustomLabel('');
    setSizeModalCustomUnit('inches');
    setShowSizeModal(true);
  };

  const onChangeSizeModalGarment = (garmentId) => {
    setSizeModalGarmentId(garmentId);
    setSizeModalModelId('');
    const selectedGarment = garmentTypes.find(g => String(g.garment_id) === String(garmentId));
    loadSizeModalProfile(selectedGarment, null);
  };

  const onChangeSizeModalModel = (modelId) => {
    setSizeModalModelId(modelId);
    const selectedGarment = getSelectedSizeModalGarment();
    if (!modelId) {
      loadSizeModalProfile(selectedGarment, null);
      return;
    }
    const model = getSizeModalGarmentModels().find((m) => String(m.model_id) === String(modelId));
    loadSizeModalProfile(selectedGarment, model || null);
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
      const selectedModel = getSelectedSizeModalModel();
      let result;

      if (selectedModel) {
        result = await updateCustom3DModel(selectedModel.model_id, {
          measurement_fields: sizeModalMeasurements,
          size_chart: sizeModalSizeChart
        });
      } else {
        const payload = {
          garment_name: selectedGarment.garment_name,
          garment_price: selectedGarment.garment_price,
          garment_code: selectedGarment.garment_code || '',
          description: selectedGarment.description || '',
          is_active: selectedGarment.is_active,
          measurement_fields: sizeModalMeasurements,
          size_chart: sizeModalSizeChart
        };
        result = await updateGarmentType(selectedGarment.garment_id, payload);
      }

      if (!result.success) {
        showToast(result.message || 'Failed to save sizes', 'error');
        return;
      }

      showToast(selectedModel ? 'Model sizes and measurements saved successfully!' : 'Sizes and measurements saved successfully!', 'success');
      await loadGarmentTypes();
      await loadCustom3DModels();
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

  const topMeasurementFields = [
    { key: 'chest', label: 'Chest' },
    { key: 'shoulders', label: 'Shoulders' },
    { key: 'sleeve_length', label: 'Sleeve Length' },
    { key: 'neck', label: 'Neck' },
    { key: 'waist', label: 'Waist' },
    { key: 'neck_circumference', label: 'Neck Circumference' },
    { key: 'front_length', label: 'Front Length' },
    { key: 'back_length', label: 'Back Length' },
    { key: 'armhole', label: 'Armhole' },
    { key: 'bicep', label: 'Bicep' },
    { key: 'length', label: 'Length' }
  ];

  const bottomMeasurementFields = [
    { key: 'waist', label: 'Waist' },
    { key: 'hips', label: 'Hips' },
    { key: 'inseam', label: 'Inseam' },
    { key: 'length', label: 'Length' },
    { key: 'rise', label: 'Rise' },
    { key: 'thigh', label: 'Thigh' },
    { key: 'outseam', label: 'Outseam' }
  ];

  const normalizeMeasurementMap = (value) => {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  };

  const createMeasurementProfileId = () => {
    return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  };

  const createEmptyAdditionalProfile = (label = '') => ({
    id: createMeasurementProfileId(),
    label,
    top: {},
    bottom: {},
    notes: ''
  });

  const profileHasAnyMeasurement = (profile) => {
    if (!profile || typeof profile !== 'object') return false;
    const hasTop = Object.values(normalizeMeasurementMap(profile.top)).some((value) => String(value ?? '').trim() !== '');
    const hasBottom = Object.values(normalizeMeasurementMap(profile.bottom)).some((value) => String(value ?? '').trim() !== '');
    const hasLabel = String(profile.label || '').trim() !== '';
    const hasNotes = String(profile.notes || '').trim() !== '';
    return hasTop || hasBottom || hasLabel || hasNotes;
  };

  const sanitizeAdditionalMeasurementProfiles = (profiles) => {
    if (!Array.isArray(profiles)) return [];

    return profiles
      .map((profile, index) => ({
        id: profile?.id || createMeasurementProfileId(),
        label: (profile?.label || profile?.name || `Person ${index + 1}`).toString(),
        top: normalizeMeasurementMap(profile?.top || profile?.top_measurements),
        bottom: normalizeMeasurementMap(profile?.bottom || profile?.bottom_measurements),
        notes: (profile?.notes || '').toString()
      }))
      .filter(profileHasAnyMeasurement);
  };

  const parseAdditionalMeasurementProfiles = (measurementsSource = {}, specificData = {}) => {
    const rawProfiles =
      measurementsSource?.additional_profiles ||
      measurementsSource?.additionalProfiles ||
      specificData?.measurement_profiles ||
      specificData?.additional_measurements ||
      [];

    let parsedProfiles = rawProfiles;

    if (typeof rawProfiles === 'string') {
      try {
        parsedProfiles = JSON.parse(rawProfiles);
      } catch {
        parsedProfiles = [];
      }
    }

    return sanitizeAdditionalMeasurementProfiles(parsedProfiles);
  };

  const hydrateMeasurementsFromSource = (rawMeasurementSource = null, specificData = {}) => {
    const source = rawMeasurementSource && typeof rawMeasurementSource === 'object'
      ? rawMeasurementSource
      : {};

    setMeasurements({
      top: normalizeMeasurementMap(source.top || source.top_measurements),
      bottom: normalizeMeasurementMap(source.bottom || source.bottom_measurements),
      notes: source.notes || ''
    });

    setAdditionalMeasurementProfiles(parseAdditionalMeasurementProfiles(source, specificData));
  };

  const updateAdditionalMeasurementProfile = (profileId, updater) => {
    setAdditionalMeasurementProfiles((prevProfiles) =>
      prevProfiles.map((profile) => {
        if (profile.id !== profileId) return profile;
        return typeof updater === 'function' ? updater(profile) : updater;
      })
    );
  };

  const openMeasurementsEditor = async (order) => {
    if (!order) return;
    setMeasurementsLoading(true);

    try {
      const customerId = order.order_type === 'walk_in'
        ? order.walk_in_customer_id
        : order.user_id;
      const customerType = order.order_type === 'walk_in' ? 'walk_in' : 'online';

      if (order.specific_data?.measurements) {
        const orderMeasurements = typeof order.specific_data.measurements === 'string'
          ? JSON.parse(order.specific_data.measurements)
          : order.specific_data.measurements;

        hydrateMeasurementsFromSource(orderMeasurements, order.specific_data);
        setShowMeasurementsModal(true);
        return;
      }

      const result = await getMeasurements(customerId, customerType);

      if (result.success && result.measurements) {
        hydrateMeasurementsFromSource({
          top: typeof result.measurements.top_measurements === 'string'
            ? JSON.parse(result.measurements.top_measurements)
            : normalizeMeasurementMap(result.measurements.top_measurements),
          bottom: typeof result.measurements.bottom_measurements === 'string'
            ? JSON.parse(result.measurements.bottom_measurements)
            : normalizeMeasurementMap(result.measurements.bottom_measurements),
          notes: result.measurements.notes || ''
        }, order.specific_data || {});

        setShowMeasurementsModal(true);
        return;
      }

      const garments = Array.isArray(order.specific_data?.garments) ? order.specific_data.garments : [];
      let userMeas = null;

      if (garments.length > 0) {
        for (const garment of garments) {
          const designData = parseDesignData(garment.designData);
          if (designData?.userMeasurements && Object.keys(designData.userMeasurements).length > 0) {
            userMeas = designData.userMeasurements;
            break;
          }
        }
      } else {
        const designData = parseDesignData(order.specific_data?.designData);
        if (designData?.userMeasurements && Object.keys(designData.userMeasurements).length > 0) {
          userMeas = designData.userMeasurements;
        }
      }

      if (userMeas) {
        const topFields = ['chest', 'shoulders', 'sleeveLength', 'sleeve_length', 'neck', 'neckCircumference', 'waist', 'frontLength', 'backLength', 'length', 'armhole', 'bicep'];
        const bottomFields = ['waist', 'hips', 'inseam', 'outseam', 'thigh', 'cuff', 'rise'];
        const topMeas = {};
        const bottomMeas = {};

        Object.entries(userMeas).forEach(([key, val]) => {
          if (!val) return;
          const mappedKey = key === 'sleeveLength' ? 'sleeve_length'
            : key === 'neckCircumference' ? 'neck_circumference'
            : key === 'frontLength' ? 'front_length'
            : key === 'backLength' ? 'back_length'
            : key === 'sleeve_length' ? 'sleeve_length'
            : key;
          if (topFields.includes(key)) topMeas[mappedKey] = val;
          if (bottomFields.includes(key)) bottomMeas[mappedKey] = val;
        });

        hydrateMeasurementsFromSource({
          top: topMeas,
          bottom: bottomMeas,
          notes: 'Pre-filled from customer-provided body measurements'
        }, order.specific_data || {});
      } else {
        hydrateMeasurementsFromSource({ top: {}, bottom: {}, notes: '' }, order.specific_data || {});
      }

      setShowMeasurementsModal(true);
    } catch (error) {
      console.error('Error loading measurements:', error);
      setMeasurements({ top: {}, bottom: {}, notes: '' });
      setAdditionalMeasurementProfiles([]);
      setShowMeasurementsModal(true);
    } finally {
      setMeasurementsLoading(false);
    }
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

  const todayAppointmentsCount = allItems.filter(isTodayAppointment).length;

  const getItemActivityTimestamp = (item) => {
    const candidates = [item?.updated_at, item?.status_updated_at, item?.order_date];
    for (const candidate of candidates) {
      const ts = new Date(candidate || 0).getTime();
      if (Number.isFinite(ts) && ts > 0) return ts;
    }
    return 0;
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

        const computedStatus = getComputedStatus(item);
        let normalizedStatus = item.approval_status;

        if (item.approval_status === 'pending_review' ||

          item.approval_status === null ||

          item.approval_status === undefined ||

          item.approval_status === '') {

          normalizedStatus = 'pending';

        }

        return computedStatus === statusFilter || normalizedStatus === statusFilter;

      });

    }

    if (todayAppointmentsOnly) {
      items = items.filter(isTodayAppointment);
    }

    if (dateRangeStart || dateRangeEnd) {
      items = items.filter(item => {
        const specificData = parseMaybeObject(item?.specific_data);
        const pricingFactors = parseMaybeObject(item?.pricing_factors);
        const appointmentDate = item?.appointment_date || item?.appointmentDate || specificData?.appointment_date || specificData?.appointmentDate || specificData?.pickupDate || specificData?.preferredDate || specificData?.date;
        if (!appointmentDate) return false;
        const itemDate = new Date(appointmentDate);
        itemDate.setHours(0, 0, 0, 0);
        if (dateRangeStart && dateRangeEnd) {
          const start = new Date(dateRangeStart);
          const end = new Date(dateRangeEnd);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          return itemDate >= start && itemDate <= end;
        } else if (dateRangeStart) {
          const start = new Date(dateRangeStart);
          start.setHours(0, 0, 0, 0);
          return itemDate >= start;
        } else if (dateRangeEnd) {
          const end = new Date(dateRangeEnd);
          end.setHours(23, 59, 59, 999);
          return itemDate <= end;
        }
        return true;
      });
    }

    if (timeFilter) {
      items = items.filter(item => {
        const specificData = parseMaybeObject(item?.specific_data);
        const pricingFactors = parseMaybeObject(item?.pricing_factors);
        // Check separate preferredTime field (customization)
        const preferredTime = specificData?.preferredTime;
        if (preferredTime) {
          const t = String(preferredTime).includes('T') ? String(preferredTime).split('T')[1]?.slice(0, 5) : String(preferredTime).slice(0, 5);
          return t === timeFilter;
        }
        // Check time embedded in pickupDate (dry cleaning / repair)
        const apptDate = specificData?.pickupDate || pricingFactors?.pickupDate || item?.appointment_date || specificData?.appointment_date;
        if (!apptDate) return false;
        const timeStr = String(apptDate).split('T')[1]?.slice(0, 5);
        return timeStr === timeFilter;
      });
    }

    items.sort((a, b) => {
      const activityDiff = getItemActivityTimestamp(b) - getItemActivityTimestamp(a);
      if (activityDiff !== 0) return activityDiff;

      const orderDiff = Number(b.order_id || 0) - Number(a.order_id || 0);
      if (orderDiff !== 0) return orderDiff;

      return Number(b.item_id || 0) - Number(a.item_id || 0);
    });

    return items;

  };

  const getFilteredEnhancementItems = () => {
    let items = allItems.filter(item => {
      const pf = typeof item.pricing_factors === 'string'
        ? JSON.parse(item.pricing_factors || '{}')
        : (item.pricing_factors || {});
      return pf.enhancementRequest === true && pf.enhancementPendingAdminReview === true
        && (item.approval_status === 'pending' || item.approval_status === 'pending_review');
    });

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

    if (todayAppointmentsOnly) {
      items = items.filter(isTodayAppointment);
    }

    if (dateRangeStart || dateRangeEnd) {
      items = items.filter(item => {
        const specificData = parseMaybeObject(item?.specific_data);
        const appointmentDate = item?.appointment_date || item?.appointmentDate || specificData?.appointment_date || specificData?.appointmentDate || specificData?.pickupDate || specificData?.preferredDate || specificData?.date;
        if (!appointmentDate) return false;
        const itemDate = new Date(appointmentDate);
        itemDate.setHours(0, 0, 0, 0);
        if (dateRangeStart && dateRangeEnd) {
          const start = new Date(dateRangeStart);
          const end = new Date(dateRangeEnd);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          return itemDate >= start && itemDate <= end;
        } else if (dateRangeStart) {
          const start = new Date(dateRangeStart);
          start.setHours(0, 0, 0, 0);
          return itemDate >= start;
        } else if (dateRangeEnd) {
          const end = new Date(dateRangeEnd);
          end.setHours(23, 59, 59, 999);
          return itemDate <= end;
        }
        return true;
      });
    }

    if (timeFilter) {
      items = items.filter(item => {
        const specificData = parseMaybeObject(item?.specific_data);
        const pricingFactors = parseMaybeObject(item?.pricing_factors);
        const preferredTime = specificData?.preferredTime;
        if (preferredTime) {
          const t = String(preferredTime).includes('T') ? String(preferredTime).split('T')[1]?.slice(0, 5) : String(preferredTime).slice(0, 5);
          return t === timeFilter;
        }
        const apptDate = specificData?.pickupDate || pricingFactors?.pickupDate || item?.appointment_date || specificData?.appointment_date;
        if (!apptDate) return false;
        const timeStr = String(apptDate).split('T')[1]?.slice(0, 5);
        return timeStr === timeFilter;
      });
    }

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

    setPriceConfirmationReason(parseMaybeObject(item?.pricing_factors)?.adminNotes || '');

    setShowPriceConfirmationModal(true);

  };

  const openPriceConfirmationReviewModal = (item) => {
    if (!item) return;

    const estimatedPrice = getEstimatedPrice(item) || parseFloat(item.final_price || 0);
    setPriceConfirmationItem(item);
    setPriceConfirmationPrice(estimatedPrice.toFixed(2));
    setPriceConfirmationReason(parseMaybeObject(item?.pricing_factors)?.adminNotes || '');
    setShowPriceConfirmationModal(true);
  };

  const handleAcceptHagglePrice = async (item) => {
    const pricingFactors = parseMaybeObject(item?.pricing_factors);
    const haggleOffer = parseFloat(pricingFactors?.haggleOffer || 0);

    if (!Number.isFinite(haggleOffer) || haggleOffer <= 0) {
      showToast('No valid haggle offer found.', 'error');
      return;
    }

    try {
      const result = await updateCustomizationOrderItem(item.item_id, {
        approvalStatus: 'accepted',
        finalPrice: haggleOffer,
        adminNotes: 'Customer haggle offer accepted',
        pricingFactors: {
          haggleDeclined: false,
          haggleDecision: 'accepted',
          haggleAcceptedAt: new Date().toISOString(),
          haggleDecisionBy: 'admin'
        }
      });

      if (result.success) {
        await loadCustomizationOrders();
        showToast(`Haggle accepted at ₱${haggleOffer.toFixed(2)}.`, 'success');
      } else {
        showToast(result.message || 'Failed to accept haggle offer', 'error');
      }
    } catch (error) {
      console.error('Accept haggle error:', error);
      showToast('Failed to accept haggle offer', 'error');
    }
  };

  const handleDeclineHagglePrice = async (item) => {
    const pricingFactors = parseMaybeObject(item?.pricing_factors);
    const haggleOffer = parseFloat(pricingFactors?.haggleOffer || 0);

    if (!Number.isFinite(haggleOffer) || haggleOffer <= 0) {
      showToast('No valid haggle offer found.', 'error');
      return;
    }

    try {
      const result = await updateCustomizationOrderItem(item.item_id, {
        approvalStatus: 'price_confirmation',
        adminNotes: `Customer haggled price (₱${haggleOffer.toFixed(2)}) was declined by admin.`,
        pricingFactors: {
          haggleDeclined: true,
          haggleDecision: 'declined',
          haggleDeclinedAt: new Date().toISOString(),
          haggleDecisionBy: 'admin'
        }
      });

      if (result.success) {
        await loadCustomizationOrders();
        showToast('Haggled price declined. Customer will see this in order tracking.', 'success');
        setShowPriceConfirmationModal(false);
        setPriceConfirmationItem(null);
        setPriceConfirmationPrice('');
        setPriceConfirmationReason('');
      } else {
        showToast(result.message || 'Failed to decline haggle offer', 'error');
      }
    } catch (error) {
      console.error('Decline haggle error:', error);
      showToast('Failed to decline haggle offer', 'error');
    }
  };

  const handlePriceConfirmationSubmit = async (overridePrice = null, overrideReason = null, overrideStatus = null) => {

    if (!priceConfirmationItem) return;

    const isEventObject = overridePrice && typeof overridePrice === 'object' && (
      typeof overridePrice.preventDefault === 'function' || 'nativeEvent' in overridePrice
    );
    const safeOverridePrice = isEventObject ? null : overridePrice;

    const finalPrice = parseFloat(safeOverridePrice ?? priceConfirmationPrice);
    const currentPrice = parseFloat(priceConfirmationItem.final_price || 0);
    const isPriceChanged = Math.abs(finalPrice - currentPrice) > 0.01;
    const reasonToUse = overrideReason ?? priceConfirmationReason;
    const targetStatus = overrideStatus || 'price_confirmation';

    if (isNaN(finalPrice) || finalPrice <= 0) {

      showToast("Please enter a valid price", "error");

      return;

    }

    if (isPriceChanged && !String(reasonToUse || '').trim()) {

      showToast("Please provide a reason for the price change", "error");

      return;

    }

    try {

      const result = await updateCustomizationOrderItem(priceConfirmationItem.item_id, {

        approvalStatus: targetStatus,

        finalPrice: finalPrice,

        adminNotes: isPriceChanged ? String(reasonToUse || '').trim() : undefined

      });

      if (result.success) {

        await loadCustomizationOrders();

        if (viewFilter !== 'all') {

          setViewFilter(targetStatus === 'accepted' ? 'accepted' : 'price-confirmation');

        }

        showToast(targetStatus === 'accepted' ? "Customization request moved to accepted!" : "Customization request moved to price confirmation!", "success");

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

  const handleDecline = async (itemId) => {

    const reasonInput = await prompt(
      'Please enter the reason for declining this customization request.',
      'Decline Reason',
      'e.g. submitted design or measurements are incomplete',
      ''
    );
    if (reasonInput === null) return;

    const reason = String(reasonInput || '').trim();
    if (!reason) {
      showToast('Please provide a decline reason.', 'error');
      return;
    }

    openConfirmModal("Are you sure you want to decline this customization request?", async () => {

      try {

        const result = await updateCustomizationOrderItem(itemId, {

          approvalStatus: 'cancelled',
          adminNotes: reason,
          pricingFactors: {
            adminDeclineReason: reason,
            adminDeclinedAt: new Date().toISOString()
          }

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
      const isEnhancementOrder = pricingFactors.enhancementRequest && pricingFactors.enhancementAdminAccepted;
      const isAccessoriesEnhancement = isEnhancementOrder && !!pricingFactors.accessoriesPrice;
      const amountPaid = (isEnhancementOrder && !isAccessoriesEnhancement) ? parseFloat(item.final_price || 0) : parseFloat(pricingFactors.amount_paid || 0);
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
    setDetailEstimatedCompletionDate(
      item?.pricing_factors?.estimatedCompletionDate ||
      item?.pricing_factors?.estimated_completion_date ||
      ''
    );

    setShowDetailModal(true);

  };

  const handleSaveEstimatedCompletionDateFromDetails = async () => {
    if (!selectedOrder) return;
    const preferredDate = getPreferredCompletionDate(selectedOrder);
    if (preferredDate && detailEstimatedCompletionDate && new Date(detailEstimatedCompletionDate) < new Date(preferredDate)) {
      showToast('Estimated completion date cannot be earlier than the customer\'s preferred date.', 'error');
      return;
    }
    try {
      setSavingEstimatedDate(true);
      const result = await updateCustomizationOrderItem(selectedOrder.item_id, {
        pricingFactors: {
          ...(selectedOrder.pricing_factors || {}),
          estimatedCompletionDate: detailEstimatedCompletionDate || null
        },
        approvalStatus: selectedOrder.approval_status
      });

      if (result.success) {
        setSelectedOrder((prev) => ({
          ...prev,
          pricing_factors: {
            ...(prev?.pricing_factors || {}),
            estimatedCompletionDate: detailEstimatedCompletionDate || null
          }
        }));
        showToast('Estimated completion date saved.', 'success');
        loadCustomizationOrders();
      } else {
        showToast(result.message || 'Failed to save estimated completion date', 'error');
      }
    } catch (error) {
      showToast('Failed to save estimated completion date', 'error');
    } finally {
      setSavingEstimatedDate(false);
    }
  };

  const openEnhanceModal = (item) => {
    const currentEstimatedDate = item?.pricing_factors?.estimatedCompletionDate || item?.pricing_factors?.estimated_completion_date || '';
    setEnhanceOrder(item);
    setEnhanceForm({
      notes: '',
      additionalCost: '',
      estimatedCompletionDate: currentEstimatedDate
    });
    setShowEnhanceModal(true);
  };

  const handleSaveEnhancement = async () => {
    if (!enhanceOrder) return;
    const notes = String(enhanceForm.notes || '').trim();
    if (!notes) {
      showToast('Please add enhancement notes.', 'error');
      return;
    }

    const additionalCost = parseFloat(enhanceForm.additionalCost || 0);
    if (!Number.isFinite(additionalCost) || additionalCost < 0) {
      showToast('Additional cost must be 0 or higher.', 'error');
      return;
    }

    const currentFinal = parseFloat(enhanceOrder.final_price || 0);
    const nextFinal = currentFinal + additionalCost;

    try {
      setSavingEnhancement(true);
      const result = await updateCustomizationOrderItem(enhanceOrder.item_id, {
        finalPrice: nextFinal,
        approvalStatus: 'confirmed',
        adminNotes: `Enhancement requested in-shop: ${notes}`,
        pricingFactors: {
          ...(enhanceOrder.pricing_factors || {}),
          enhancementRequest: true,
          enhancementNotes: notes,
          enhancementAdditionalCost: additionalCost.toFixed(2),
          enhancementBasePrice: currentFinal.toFixed(2),
          enhancementUpdatedAt: new Date().toISOString(),
          estimatedCompletionDate: enhanceForm.estimatedCompletionDate || null
        }
      });

      if (result.success) {
        setShowEnhanceModal(false);
        setEnhanceOrder(null);
        showToast('Enhancement applied. Order moved to In Progress.', 'success');
        loadCustomizationOrders();
      } else {
        showToast(result.message || 'Failed to apply enhancement', 'error');
      }
    } catch (err) {
      showToast('Failed to apply enhancement', 'error');
    } finally {
      setSavingEnhancement(false);
    }
  };

  const handleEnhancementPriceConfirm = async (item) => {
    const target = item || enhancementPriceItem;
    if (!target) return;

    const pricingFactors = typeof target.pricing_factors === 'string'
      ? JSON.parse(target.pricing_factors || '{}')
      : (target.pricing_factors || {});

    if (pricingFactors.addAccessories === true) {
      setAccessoriesPriceItem(target);
      setAccessoriesPrice('');
      setShowAccessoriesPriceModal(true);
      setShowEnhancementViewModal(false);
      return;
    }

    try {
      setSavingEnhancementPrice(true);
      const result = await updateCustomizationOrderItem(target.item_id, {
        approvalStatus: 'accepted',
        finalPrice: parseFloat(target.final_price || 0),
        pricingFactors: {
          ...pricingFactors,
          enhancementAdminAccepted: true,
          enhancementPendingAdminReview: false,
          enhancementAdminAcceptedAt: new Date().toISOString()
        }
      });
      if (result.success) {
        setEnhancementPriceItem(null);
        setShowEnhancementViewModal(false);
        showToast('Enhancement accepted. Order moved to Accepted.', 'success');
        loadCustomizationOrders();
      } else {
        showToast(result.message || 'Failed to accept enhancement', 'error');
      }
    } catch (err) {
      showToast('Failed to accept enhancement', 'error');
    } finally {
      setSavingEnhancementPrice(false);
    }
  };

  const handleAccessoriesPriceSubmit = async () => {
    if (!accessoriesPriceItem) return;
    const price = parseFloat(accessoriesPrice);
    if (isNaN(price) || price <= 0) {
      showToast('Please enter a valid accessories price', 'error');
      return;
    }
    try {
      setSavingEnhancementPrice(true);
      const pricingFactors = typeof accessoriesPriceItem.pricing_factors === 'string'
        ? JSON.parse(accessoriesPriceItem.pricing_factors || '{}')
        : (accessoriesPriceItem.pricing_factors || {});
      const baseFinalPrice = parseFloat(accessoriesPriceItem.final_price || 0);
      const newFinalPrice = baseFinalPrice + price;
      const result = await updateCustomizationOrderItem(accessoriesPriceItem.item_id, {
        approvalStatus: 'price_confirmation',
        finalPrice: newFinalPrice,
        adminNotes: `Accessories price: \u20b1${price.toFixed(2)}`,
        pricingFactors: {
          ...pricingFactors,
          enhancementAdminAccepted: false,
          enhancementPendingAdminReview: false,
          enhancementAdminAcceptedAt: new Date().toISOString(),
          accessoriesPrice: price.toFixed(2),
          accessoriesBasePrice: baseFinalPrice.toFixed(2)
        }
      });
      if (result.success) {
        setShowAccessoriesPriceModal(false);
        setAccessoriesPriceItem(null);
        setAccessoriesPrice('');
        showToast('Accessories price sent for customer confirmation.', 'success');
        loadCustomizationOrders();
      } else {
        showToast(result.message || 'Failed to submit accessories price', 'error');
      }
    } catch (err) {
      showToast('Failed to submit accessories price', 'error');
    } finally {
      setSavingEnhancementPrice(false);
    }
  };

  const handleEditOrder = (item) => {

    setSelectedOrder(item);

    setEditForm({

      finalPrice: item.final_price || '',

      approvalStatus: item.approval_status || '',

      adminNotes: item.pricing_factors?.adminNotes || '',

      pricingFactors: {
        estimatedCompletionDate: item.pricing_factors?.estimatedCompletionDate || item.pricing_factors?.estimated_completion_date || ''
      }

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

    if (!selectedOrder) {

      await alert('No order selected', 'Error', 'error');

      return;

    }

    const canUseNoDownpaymentFlow = selectedOrder.approval_status === 'accepted'
      && paymentOption === 'no_downpayment';

    if (canUseNoDownpaymentFlow) {

      const nextStatus = moveToStatusOnNoDownpayment
        || getNextStatus(selectedOrder.approval_status, 'customization', selectedOrder);

      if (!nextStatus) {

        await alert('Please select a status to move to', 'Error', 'error');

        return;

      }

      setShowPaymentModal(false);
      setPaymentAmount('');
      setCashReceived('');
      setPaymentOption('downpayment');
      setMoveToStatusOnNoDownpayment('');
      updateStatus(selectedOrder.item_id, nextStatus);
      return;

    }

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

    // Check if this is an enhancement order - if so, reset payment tracking
    const isEnhancement = pricingFactors.enhancementRequest && pricingFactors.enhancementAdminAccepted;
    const amountPaid = isEnhancement ? 0 : parseFloat(pricingFactors.amount_paid || 0);

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
        setPaymentOption('downpayment');
        setMoveToStatusOnNoDownpayment('');

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

  const handlePriceUpdate = async (itemId, newPrice, reason) => {

    try {

      const result = await updateOrderItemPrice(itemId, newPrice, reason);

      if (result.success) {

        await alert('Price updated successfully!', 'Success', 'success');

        loadCustomizationOrders();

      } else {

        throw new Error(result.message);

      }

    } catch (error) {

      await alert(error.response?.data?.message || 'Failed to update price', 'Error', 'error');

      throw error;

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

        <div className="order-view-tabs" role="tablist" aria-label="Order view selection">
          <button
            type="button"
            className={`order-view-tab ${tableView === 'orders' ? 'active' : ''}`}
            onClick={() => setTableView('orders')}
            role="tab"
            aria-selected={tableView === 'orders'}
          >
            Order List
          </button>
          <button
            type="button"
            className={`order-view-tab ${tableView === 'enhancements' ? 'active' : ''}`}
            onClick={() => setTableView('enhancements')}
            role="tab"
            aria-selected={tableView === 'enhancements'}
          >
            Enhancement Request
          </button>
        </div>

        <div className="search-container">

          <input

            type="text"

            placeholder="Search by Order ID, Name, Garment, or Fabric"

            value={searchTerm}

            onChange={(e) => setSearchTerm(e.target.value)}

          />

          {tableView === 'orders' && (
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>

            <option value="">All Status</option>

            <option value="pending">Pending</option>

            <option value="accepted">Accepted</option>

            <option value="price_confirmation">Price Confirmation</option>

            <option value="confirmed">In Progress</option>

            <option value="ready_for_pickup">To Pick up</option>

            <option value="completed">Completed</option>

            <option value="estimated-today">Estimated Release Today</option>

            <option value="cancelled">Rejected</option>

          </select>
          )}

        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '12px',
          margin: '10px 0 12px 0',
          padding: '10px 12px',
          border: '1px solid #e7d9cc',
          borderRadius: '8px',
          background: '#fffaf5'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#333', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={todayAppointmentsOnly}
                onChange={(e) => {
                  setTodayAppointmentsOnly(e.target.checked);
                  if (e.target.checked) {
                    setDateRangeStart('');
                    setDateRangeEnd('');
                  }
                }}
              />
              Today's appointments ({todayAppointmentsCount})
            </label>
            <div style={{ width: '1px', height: '20px', background: '#ddd' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: '#333', fontWeight: '500' }}>Date Range:</label>
              <input
                type="date"
                value={dateRangeStart}
                onChange={(e) => {
                  setDateRangeStart(e.target.value);
                  if (e.target.value) setTodayAppointmentsOnly(false);
                }}
                style={{ padding: '4px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}
              />
              <span style={{ color: '#666' }}>to</span>
              <input
                type="date"
                value={dateRangeEnd}
                onChange={(e) => {
                  setDateRangeEnd(e.target.value);
                  if (e.target.value) setTodayAppointmentsOnly(false);
                }}
                style={{ padding: '4px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}
              />
              {(dateRangeStart || dateRangeEnd) && (
                <button
                  onClick={() => {
                    setDateRangeStart('');
                    setDateRangeEnd('');
                  }}
                  style={{
                    padding: '4px 8px',
                    background: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
              <div style={{ width: '1px', height: '20px', background: '#ddd' }}></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '13px', color: '#333', fontWeight: '500' }}>Time:</label>

                <select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value)}
                  style={{ padding: '4px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}
                >
                  <option value="">All Times</option>
                  <option value="08:30">8:30 AM</option>
                  <option value="09:30">9:30 AM</option>
                  <option value="10:30">10:30 AM</option>
                  <option value="11:30">11:30 AM</option>
                  <option value="12:30">12:30 PM</option>
                  <option value="13:30">1:30 PM</option>
                  <option value="14:30">2:30 PM</option>
                  <option value="15:30">3:30 PM</option>
                  <option value="16:30">4:30 PM</option>
                </select>
                {timeFilter && (
                  <button
                    onClick={() => setTimeFilter('')}
                    style={{ padding: '4px 8px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
                  >Clear</button>
                )}
              </div>
        </div>

        {tableView === 'orders' && (
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

                (() => {
                  const orderedItems = [...getFilteredItems()];
                  const groupedMap = orderedItems.reduce((acc, entry) => {
                    const key = String(entry?.order_id || '');
                    if (!key) return acc;
                    if (!acc.has(key)) {
                      acc.set(key, []);
                    }
                    acc.get(key).push(entry);
                    return acc;
                  }, new Map());

                  const groupedItems = Array.from(groupedMap.values()).flatMap((group) =>
                    group.sort((a, b) => Number(a.item_id || 0) - Number(b.item_id || 0))
                  );

                  const parentItemCounts = groupedItems.reduce((counts, groupedItem) => {
                    const key = String(groupedItem?.order_id || '');
                    if (!key) return counts;
                    counts[key] = (counts[key] || 0) + 1;
                    return counts;
                  }, {});

                  return groupedItems.map((item, index) => {

                  const pricingFactors = typeof item.pricing_factors === 'string'

                    ? JSON.parse(item.pricing_factors || '{}')

                    : (item.pricing_factors || {});

                  const isEnhancementOrder = pricingFactors.enhancementRequest && pricingFactors.enhancementAdminAccepted;
                  const isAccessoriesEnhancement = isEnhancementOrder && !!pricingFactors.accessoriesPrice;
                  const finalPrice = parseFloat(item.final_price || 0);
                  const amountPaid = (isEnhancementOrder && !isAccessoriesEnhancement) ? parseFloat(item.final_price || 0) : parseFloat(pricingFactors.amount_paid || 0);
                  const remainingBalance = finalPrice - amountPaid;

                  const isUniform = item.specific_data?.garmentType?.toLowerCase() === 'uniform' ||

                    item.specific_data?.isUniform === true ||

                    item.pricing_factors?.isUniform === true;

                  const parentOrderId = item.order_id;
                  const isFirstInParent = index === 0 || groupedItems[index - 1]?.order_id !== parentOrderId;
                  const parentItemCount = parentItemCounts[String(parentOrderId || '')] || 0;
                  const isAddAnotherGroup = parentItemCount > 1;
                  const isCollapsed = isAddAnotherGroup && !!collapsedParentOrders[parentOrderId];
                  const isSecondaryMenuOpenForRow = typeof openSecondaryMenuId === 'string' && openSecondaryMenuId.startsWith(`custom-${item.item_id}-`);

                  return (

                    <Fragment key={`parent-${parentOrderId}-child-${item.item_id}`}>
                      {isAddAnotherGroup && isFirstInParent && (
                        <tr>
                          <td colSpan="9" style={{ backgroundColor: '#f7f2ef', fontWeight: 700, color: '#5D4037' }}>
                            <button
                              type="button"
                              onClick={() => toggleParentOrderCollapse(parentOrderId)}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                color: '#5D4037',
                                fontWeight: 700,
                                fontSize: '13px',
                                lineHeight: 1.2,
                                padding: '6px 10px',
                                borderRadius: '8px',
                                textTransform: 'none',
                                letterSpacing: 'normal',
                                boxShadow: 'none',
                                minHeight: '30px'
                              }}
                            >
                              {isCollapsed ? '▶' : '▼'} ORD#{parentOrderId} ({parentItemCount} child orders)
                            </button>
                          </td>
                        </tr>
                      )}
                      {(!isAddAnotherGroup || !isCollapsed || isFirstInParent) && (
                    <tr className="clickable-row" onClick={() => handleViewDetails(item)}>

                      <td>
                        <strong>ORD#{item.order_id}</strong>
                        <div style={{ fontSize: '11px', color: '#777', marginTop: '2px' }}>Child #{item.item_id}</div>
                      </td>

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

                      <td>{(() => {
                        const preferredDate = item.specific_data?.preferredDate || item.specific_data?.preferred_date;
                        if (!preferredDate) return 'N/A';
                        const date = new Date(preferredDate);
                        return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
                      })()}</td>

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

                      <td onClick={(e) => e.stopPropagation()} style={isSecondaryMenuOpenForRow ? { position: 'relative', zIndex: 5002 } : undefined}>

                        <span className={`status-badge ${getStatusClass(item.approval_status || 'pending')}`}>

                          {getStatusText(item.approval_status || 'pending')}

                        </span>
                        {(() => {
                          const pf = typeof item.pricing_factors === 'string'
                            ? JSON.parse(item.pricing_factors || '{}')
                            : (item.pricing_factors || {});
                          if (pf.enhancementRequest && (pf.enhancementAdminAccepted || pf.addAccessories)) {
                            return (
                              <div style={{ fontSize: '11px', color: '#673ab7', marginTop: '4px', fontWeight: '600' }}>
                                {pf.addAccessories && !pf.enhancementAdminAccepted ? 'Enhancement + Accessories' : 'Enhancement'}
                              </div>
                            );
                          }
                          return null;
                        })()}

                        {item.approval_status === 'picked_up' && (
                          <div style={{ marginTop: '4px', fontSize: '11px', color: '#1b5e20', fontWeight: '600' }}>
                            Note: Picked up
                          </div>
                        )}

                      </td>

                      <td onClick={(e) => e.stopPropagation()}>

                        {item.approval_status === 'price_declined' ? (

                          <div className="action-buttons">
                            {renderSecondaryActionMenu({
                              menuId: `custom-${item.item_id}-price-declined`,
                              showDelete: isAdminUser,
                              onDelete: () => handleDeleteOrder(item)
                            })}
                          </div>

                        ) : item.approval_status === 'pending_review' || item.approval_status === 'pending' || item.approval_status === null || item.approval_status === undefined || item.approval_status === '' ? (

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

                            {item.approval_status === 'accepted' && (
                              <button className="icon-btn decline" onClick={() => handleDecline(item.item_id)} title="Decline">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18"></line>
                                  <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                              </button>
                            )}

                            {item.approval_status === 'price_confirmation' && (() => {
                              const haggleOffer = parseFloat(parseMaybeObject(item?.pricing_factors)?.haggleOffer || 0);
                              if (!Number.isFinite(haggleOffer) || haggleOffer <= 0) {
                                return null;
                              }

                              return (
                                <>
                                  <button
                                    className="icon-btn"
                                    onClick={() => {
                                      openPriceConfirmationReviewModal(item);
                                    }}
                                    title={`View Haggle Offer (₱${haggleOffer.toFixed(2)})`}
                                    style={{ backgroundColor: '#0288d1', color: 'white' }}
                                  >
                                    <i className="fas fa-eye"></i>
                                  </button>
                                  <button
                                    className="icon-btn"
                                    onClick={() => {
                                      handleAcceptHagglePrice(item);
                                    }}
                                    title={`Accept Haggle ₱${haggleOffer.toFixed(2)}`}
                                    style={{ backgroundColor: '#2e7d32', color: 'white' }}
                                  >
                                    <i className="fas fa-check"></i>
                                  </button>
                                </>
                              );
                            })()}

                            {item.approval_status !== 'price_confirmation' && getNextStatus(item.approval_status, 'customization', item) && (() => {
                              const nextStatus = getNextStatus(item.approval_status, 'customization', item);
                              const isMovingToInProgress = nextStatus === 'confirmed';
                              const halfPrice = finalPrice * 0.5;
                              const hasHalfPayment = amountPaid >= halfPrice - 0.01;
                              
                              if (isMovingToInProgress && !hasHalfPayment && !isEnhancementOrder) {
                                return null;
                              }
                              
                              return (
                                <button
                                  className="icon-btn next-status"
                                  onClick={() => updateStatus(item.item_id, nextStatus)}
                                  title={`Move to ${getNextStatusLabel(item.approval_status, 'customization', item)}`}
                                  style={{ backgroundColor: '#4CAF50', color: 'white' }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="9 18 15 12 9 6"></polyline>
                                  </svg>
                                </button>
                              );
                            })()}

                            {(item.approval_status !== 'completed' && item.approval_status !== 'cancelled' && item.approval_status !== 'price_confirmation') && (!isEnhancementOrder || (pricingFactors.accessoriesPrice && remainingBalance > 0.01)) && (

                              <button

                                className="icon-btn"

                                onClick={(e) => {

                                  e.stopPropagation();

                                  setSelectedOrder(item);

                                  const finalPrice = parseFloat(item.final_price || 0);
                                  const halfPrice = (finalPrice * 0.5).toFixed(2);
                                  const acceptedNextStatus = item.approval_status === 'accepted'
                                    ? getNextStatus(item.approval_status, 'customization', item)
                                    : '';

                                  setPaymentAmount(halfPrice);

                                  setCashReceived('');
                                  setPaymentOption('downpayment');
                                  setMoveToStatusOnNoDownpayment(acceptedNextStatus || '');

                                  setShowPaymentModal(true);

                                }}

                                title="Record Payment"

                                style={{ backgroundColor: '#2196F3', color: 'white' }}

                              >

                                💰

                              </button>

                            )}

                            {(item.approval_status === 'completed' || item.approval_status === 'cancelled') && (
                              <>
                                {item.approval_status === 'completed' && (
                                  <button
                                    className="icon-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEnhanceModal(item);
                                    }}
                                    title="Enhance Order"
                                    style={{ backgroundColor: '#673ab7', color: 'white' }}
                                  >
                                    <i className="fas fa-wand-magic-sparkles"></i>
                                  </button>
                                )}
                              </>

                            )}

                            {renderSecondaryActionMenu({
                              menuId: `custom-${item.item_id}-secondary`,
                              showEditPrice: item.approval_status === 'accepted' && item.order_type !== 'walk_in',
                              showDelete: item.approval_status === 'completed' || item.approval_status === 'cancelled',
                              onEditPrice: () => {
                                setPriceEditOrder(item);
                                setShowPriceEditModal(true);
                              },
                              onDelete: () => handleDeleteOrder(item)
                            })}

                          </div>

                        )}

                      </td>

                    </tr>
                      )}
                    </Fragment>

                  );

                });
                })()

              )}

            </tbody>

          </table>
          </div>

        </div>
        )}

        {tableView === 'enhancements' && (
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
                     <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredEnhancementItems().length === 0 ? (
                    <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#999' }}>No enhancement requests</td></tr>
                  ) : getFilteredEnhancementItems().map(item => {
                        const pf = typeof item.pricing_factors === 'string'
                          ? JSON.parse(item.pricing_factors || '{}')
                          : (item.pricing_factors || {});

                        const finalPrice = parseFloat(item.final_price || 0);

                    return (
                      <tr key={item.item_id}>
                            <td>
                              <strong>ORD#{item.order_id}</strong>
                              <div style={{ fontSize: '11px', color: '#777', marginTop: '2px' }}>Child #{item.item_id}</div>
                            </td>
                            <td>
                              {item.order_type === 'walk_in'
                                ? <span><span style={{ display: 'inline-block', backgroundColor: '#ff9800', color: 'white', padding: '2px 8px', borderRadius: '3px', fontSize: '0.75em', marginRight: '5px', fontWeight: 'bold' }}>WALK-IN</span>{item.walk_in_customer_name || 'Walk-in Customer'}</span>
                                : `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'N/A'}
                            </td>
                            <td>{getGarmentSummaryText(item.specific_data)}</td>
                            <td><span style={{ fontSize: '0.9em', color: '#5D4037' }}>{getFabricSummaryText(item.specific_data)}</span></td>
                            <td>{(() => {
                              const preferredDate = item.specific_data?.preferredDate || item.specific_data?.preferred_date;
                              if (!preferredDate) return 'N/A';
                              return new Date(preferredDate).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
                            })()}</td>
                            <td>&#8369;{finalPrice.toLocaleString()}</td>
                            <td>
                              <span className="status-badge" style={{ backgroundColor: '#ede7f6', color: '#673ab7', border: '1px solid #ce93d8' }}>
                                Enhancement Request
                              </span>
                            </td>
                            <td>
                              <div className="action-buttons">
                                <button
                                  className="icon-btn"
                                  title="View Enhancement Details"
                                  style={{ backgroundColor: '#2196F3', color: 'white' }}
                                  onClick={() => {
                                    setEnhancementViewItem(item);
                                    setShowEnhancementViewModal(true);
                                  }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                </button>
                                <button
                                  className="icon-btn accept"
                                  title={pf.addAccessories ? 'Set Accessories Price' : 'Accept Enhancement'}
                                  disabled={savingEnhancementPrice}
                                  onClick={() => handleEnhancementPriceConfirm(item)}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </button>
                              </div>
                            </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
      {showEnhancementViewModal && enhancementViewItem && (() => {
        const pf = typeof enhancementViewItem.pricing_factors === 'string'
          ? JSON.parse(enhancementViewItem.pricing_factors || '{}')
          : (enhancementViewItem.pricing_factors || {});
        const parseEnhancementImageUrls = () => {
          const raw = pf?.enhancementImageUrls;
          if (raw == null || raw === '') return [];
          if (Array.isArray(raw)) return raw;
          if (typeof raw === 'string') {
            try {
              const parsed = JSON.parse(raw);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          }
          return [];
        };
        const enhancementImages = parseEnhancementImageUrls();
        return (
          <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowEnhancementViewModal(false)}>
            <div className="modal-content" style={{ maxWidth: '500px' }}>
              <div className="modal-header">
                <h2>Report / Enhancement request</h2>
                <span className="close-modal" onClick={() => setShowEnhancementViewModal(false)}>×</span>
              </div>
              <div className="modal-body">
                <div className="detail-row"><strong>Order ID:</strong> #{enhancementViewItem.order_id}</div>
                <div className="detail-row">
                  <strong>Customer:</strong>
                  {enhancementViewItem.order_type === 'walk_in'
                    ? (enhancementViewItem.walk_in_customer_name || 'Walk-in Customer')
                    : `${enhancementViewItem.first_name || ''} ${enhancementViewItem.last_name || ''}`.trim() || 'N/A'}
                </div>
                <div className="detail-row"><strong>Report / Enhancement notes:</strong></div>
                <div style={{ padding: '10px', backgroundColor: '#f3e5f5', borderRadius: '6px', marginBottom: '12px', border: '1px solid #ce93d8' }}>
                  {pf.enhancementNotes || 'No notes provided'}
                </div>
                {enhancementImages.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <div className="detail-row"><strong>Photos attached:</strong></div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                      {enhancementImages.map((url, idx) => (
                        <img
                          key={`${url}-${idx}`}
                          src={getImageUrl(url)}
                          alt=""
                          style={{
                            width: 96,
                            height: 96,
                            objectFit: 'cover',
                            borderRadius: 6,
                            cursor: 'pointer',
                            border: '1px solid #ddd'
                          }}
                          onClick={() => openImagePreview(getImageUrl(url), 'Enhancement photo')}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {pf.addAccessories && (
                  <div style={{ padding: '8px 12px', backgroundColor: '#fff3e0', borderRadius: '6px', marginBottom: '12px', border: '1px solid #ffcc80', fontSize: '13px', color: '#e65100', fontWeight: '600' }}>
                    Customer requested to add accessories - price confirmation required.
                  </div>
                )}
                <div className="detail-row">
                  <strong>Preferred Completion Date:</strong>
                  {pf.enhancementPreferredCompletionDate
                    ? new Date(pf.enhancementPreferredCompletionDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                    : 'Not specified'}
                </div>
                <div className="detail-row"><strong>Requested At:</strong> {pf.enhancementUpdatedAt ? new Date(pf.enhancementUpdatedAt).toLocaleString() : 'N/A'}</div>
                <div className="detail-row"><strong>Current Price:</strong> ₱{parseFloat(enhancementViewItem.final_price || 0).toLocaleString()}</div>
                {pf.accessoriesDeclineReason && (
                  <div style={{ padding: '8px 12px', backgroundColor: '#ffebee', borderRadius: '6px', marginBottom: '12px', border: '1px solid #ef9a9a', fontSize: '13px', color: '#c62828' }}>
                    <strong>Customer Decline Reason:</strong> {pf.accessoriesDeclineReason}
                  </div>
                )}
              </div>
              <div className="modal-footer enhancement-view-footer">
                <button
                  className="btn-cancel"
                  style={{ backgroundColor: '#f44336', color: 'white', border: 'none' }}
                  disabled={savingEnhancementPrice}
                  onClick={async () => {
                    const reasonInput = await prompt(
                      'Please enter the reason for cancelling this enhancement request.',
                      'Cancellation Reason',
                      'e.g. requested design change cannot be produced with current assets',
                      ''
                    );
                    if (reasonInput === null) return;

                    const reason = String(reasonInput || '').trim();
                    if (!reason) {
                      showToast('Please provide a cancellation reason.', 'error');
                      return;
                    }

                    const confirmed = await confirm('Cancel this enhancement request?', 'Cancel Enhancement', 'warning');
                    if (!confirmed) return;
                    setSavingEnhancementPrice(true);
                    const result = await cancelEnhancement(enhancementViewItem.item_id, reason);
                    setSavingEnhancementPrice(false);
                    if (result.success) { setShowEnhancementViewModal(false); showToast('Enhancement cancelled.', 'success'); loadCustomizationOrders(); }
                    else showToast(result.message || 'Failed to cancel enhancement', 'error');
                  }}
                >
                  Cancel Enhancement
                </button>
                <button
                  className="btn-save"
                  disabled={savingEnhancementPrice}
                  onClick={() => handleEnhancementPriceConfirm(enhancementViewItem)}
                  style={{ background: '#8b4513', borderColor: '#6d3510', color: '#fff', whiteSpace: 'nowrap' }}
                >
                  {savingEnhancementPrice ? 'Processing...' : pf.addAccessories ? 'Set Accessories Price' : 'Accept Enhancement'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {showAccessoriesPriceModal && accessoriesPriceItem && (
        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowAccessoriesPriceModal(false)}>
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h2>Set Accessories Price</h2>
              <span className="close-modal" onClick={() => setShowAccessoriesPriceModal(false)}>x</span>
            </div>
            <div className="modal-body">
              <div className="detail-row"><strong>Order ID:</strong> #{accessoriesPriceItem.order_id}</div>
              <div className="detail-row"><strong>Current Price:</strong> &#8369;{parseFloat(accessoriesPriceItem.final_price || 0).toLocaleString()}</div>
              <div style={{ padding: '8px 12px', backgroundColor: '#fff3e0', borderRadius: '6px', margin: '10px 0', border: '1px solid #ffcc80', fontSize: '13px', color: '#e65100' }}>
                Customer requested to add accessories. Enter the price below - the customer will be asked to confirm before proceeding.
              </div>
              <div className="payment-form-group" style={{ marginTop: '12px' }}>
                <label>Accessories Price *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={accessoriesPrice}
                  onChange={(e) => setAccessoriesPrice(e.target.value)}
                  placeholder="Enter accessories price"
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => { setShowAccessoriesPriceModal(false); setAccessoriesPrice(''); }}>Cancel</button>
              <button
                className="btn-save"
                disabled={savingEnhancementPrice}
                onClick={handleAccessoriesPriceSubmit}
                style={{ background: '#8b4513', borderColor: '#6d3510', color: '#fff' }}
              >
                {savingEnhancementPrice ? 'Sending...' : 'Send for Confirmation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEnhanceModal && enhanceOrder && (
        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowEnhanceModal(false)}>
          <div className="modal-content enhance-order-modal" style={{ maxWidth: '640px', width: '95vw' }}>
            <div className="modal-header">
              <h2><i className="fas fa-tools" style={{ marginRight: '8px', color: '#8b4513' }}></i>Enhance Completed Customization</h2>
              <span className="close-modal" onClick={() => setShowEnhanceModal(false)}>×</span>
            </div>
            <div className="modal-body enhance-order-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '10px', textAlign: 'left' }}>
              <div className="form-group enhance-order-field" style={{ width: '100%' }}>
                <label>Order ID</label>
                <div style={{ width: '100%', boxSizing: 'border-box', color: '#333', fontWeight: 600 }}>#{enhanceOrder.order_id}</div>
              </div>

              <div className="form-group enhance-order-field" style={{ marginTop: '14px', width: '100%' }}>
                <label>Enhancement Notes</label>
                <textarea
                  value={enhanceForm.notes}
                  onChange={(e) => setEnhanceForm({ ...enhanceForm, notes: e.target.value })}
                  rows={3}
                  placeholder="Describe requested enhancement..."
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
                />
              </div>
              <div className="form-group enhance-order-field" style={{ width: '100%' }}>
                <label>Additional Cost (PHP)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={enhanceForm.additionalCost}
                  onChange={(e) => setEnhanceForm({ ...enhanceForm, additionalCost: e.target.value })}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
                />
              </div>
              <div className="form-group enhance-order-field" style={{ width: '100%' }}>
                <label>New Estimated Completion Date</label>
                <input
                  type="date"
                  min={getPreferredCompletionDate(selectedOrder) || ''}
                  value={enhanceForm.estimatedCompletionDate}
                  onChange={(e) => setEnhanceForm({ ...enhanceForm, estimatedCompletionDate: e.target.value })}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
                />
              </div>
              <div className="form-group enhance-order-field" style={{ width: '100%', marginTop: '8px', fontSize: '12px', color: '#666' }}>
                Saving will move this completed order back to <strong>In Progress</strong>.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowEnhanceModal(false)}>Cancel</button>
              <button
                className="btn-save enhance-apply-btn"
                style={{ background: '#8b4513', borderColor: '#6d3510', color: '#fff' }}
                onClick={handleSaveEnhancement}
                disabled={savingEnhancement}
              >
                <i className={`fas ${savingEnhancement ? 'fa-spinner fa-spin' : 'fa-check-circle'}`} style={{ marginRight: '8px' }}></i>
                {savingEnhancement ? 'Applying...' : 'Apply Enhancement'}
              </button>
            </div>
          </div>
        </div>
      )}
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

              {(editForm.approvalStatus === 'accepted' || editForm.approvalStatus === 'confirmed') && (
                <div className="form-group">
                  <label>Estimated Completion Date</label>
                  <input
                    type="date"
                    min={getPreferredCompletionDate(selectedOrder) || ''}
                    value={editForm.pricingFactors?.estimatedCompletionDate || editForm.pricingFactors?.estimated_completion_date || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEditForm({
                        ...editForm,
                        pricingFactors: {
                          ...(editForm.pricingFactors || {}),
                          estimatedCompletionDate: value
                        }
                      });
                    }}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
              )}

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

                    onClick={() => openMeasurementsEditor(selectedOrder)}

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

              <div className="detail-row"><strong>Preferred Date:</strong> {(() => {
                const preferredDate = selectedOrder.specific_data?.preferredDate || selectedOrder.specific_data?.preferred_date;
                if (!preferredDate) return 'N/A';
                const date = new Date(preferredDate);
                return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
              })()}</div>
              <div className="detail-row"><strong>Preferred Time:</strong> {selectedOrder.specific_data?.preferredTime ? String(selectedOrder.specific_data.preferredTime).split('T')[1]?.slice(0, 5) || String(selectedOrder.specific_data.preferredTime).slice(0, 5) : 'N/A'}</div>

              <div className="detail-row"><strong>Estimated Time:</strong> {(() => {
                const pricingFactors = selectedOrder?.pricing_factors || {};
                const specificData = selectedOrder?.specific_data || {};
                const storedEstimatedTime = pricingFactors.estimatedTime || pricingFactors.estimated_time || specificData.estimatedTime || specificData.estimated_time;

                const preferredDate = specificData.preferredDate || specificData.preferred_date;
                const completionDate = detailEstimatedCompletionDate || pricingFactors.estimatedCompletionDate || pricingFactors.estimated_completion_date;

                if (completionDate) {
                  const parsedDate = new Date(completionDate);
                  return Number.isNaN(parsedDate.getTime())
                    ? completionDate
                    : parsedDate.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
                }

                return storedEstimatedTime || 'N/A';
              })()}</div>

              {(selectedOrder.approval_status === 'accepted' || selectedOrder.approval_status === 'confirmed') && (
                <div className="detail-row" style={{ alignItems: 'center', gap: '10px' }}>
                  <strong>Estimated Completion Date:</strong>
                  <input
                    type="date"
                    min={getPreferredCompletionDate(selectedOrder) || ''}
                    value={detailEstimatedCompletionDate || ''}
                    onChange={(e) => setDetailEstimatedCompletionDate(e.target.value)}
                    style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                  <button
                    className="btn-secondary"
                    onClick={handleSaveEstimatedCompletionDateFromDetails}
                    disabled={savingEstimatedDate}
                    style={{ padding: '6px 12px' }}
                  >
                    {savingEstimatedDate ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}

              {(() => {
                const base = parseFloat(selectedOrder.base_price ?? selectedOrder.basePrice ?? 0);
                const fallback = parseFloat(getEstimatedPrice(selectedOrder) || 0);
                const previousPrice = base > 0 ? base : fallback;
                const currentPrice = parseFloat(selectedOrder.final_price || 0);
                const priceChanged = previousPrice > 0 && Math.abs(currentPrice - previousPrice) > 0.01;

                return priceChanged ? (
                  <div className="detail-row"><strong>Previous Price:</strong> ₱{previousPrice.toLocaleString()}</div>
                ) : null;
              })()}

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

                  onClick={() => openMeasurementsEditor(selectedOrder)}

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
                          const patternLabel = formatPatternChoice(designData);
                          return (
                            <div key={idx} style={{ marginBottom: '12px', padding: '10px', background: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                              <div style={{ marginBottom: '8px', fontWeight: '700' }}>Garment #{idx + 1}</div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '14px' }}>
                                {designData.size && <div><strong>Size:</strong> {designData.size.charAt(0).toUpperCase() + designData.size.slice(1)}</div>}
                                {designData.fit && <div><strong>Fit:</strong> {designData.fit.charAt(0).toUpperCase() + designData.fit.slice(1)}</div>}
                                {designData.colors && designData.colors.fabric && <div><strong>Color:</strong> {getColorName(designData.colors.fabric)}</div>}
                                {patternLabel && <div><strong>Pattern:</strong> {patternLabel}</div>}
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
                const topLevelPatternLabel = designData ? formatPatternChoice(designData) : null;

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
                          {topLevelPatternLabel && <div className="detail-row"><strong>Pattern:</strong> {topLevelPatternLabel}</div>}
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

              {(() => {
                const pricingFactors = parseMaybeObject(priceConfirmationItem?.pricing_factors);
                const haggleOffer = parseFloat(pricingFactors?.haggleOffer || 0);
                if (!Number.isFinite(haggleOffer) || haggleOffer <= 0) {
                  return null;
                }

                return (
                  <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#f7f2ed', borderRadius: '6px', border: '1px solid rgba(139, 69, 19, 0.28)', maxWidth: '460px', marginLeft: 'auto', marginRight: 'auto', textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, color: 'rgb(139, 69, 19)' }}>Customer Haggle Offer</div>
                    <div style={{ marginTop: '4px', color: '#5b3a1f' }}>₱{haggleOffer.toFixed(2)}</div>
                    <div style={{ marginTop: '8px', display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      <button
                        type="button"
                        className="btn-cancel"
                        onClick={() => {
                          handleDeclineHagglePrice(priceConfirmationItem);
                        }}
                        style={{
                          padding: '8px 12px',
                          fontSize: '13px',
                          background: '#6c757d',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: 600,
                          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)'
                        }}
                      >
                        Decline Haggled Price
                      </button>
                      <button
                        type="button"
                        className="btn-save"
                        onClick={() => handlePriceConfirmationSubmit(haggleOffer.toFixed(2), priceConfirmationReason || 'Customer haggle offer', 'accepted')}
                        style={{
                          padding: '8px 12px',
                          fontSize: '13px',
                          background: 'rgb(139, 69, 19)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: 600,
                          boxShadow: '0 4px 12px rgba(139, 69, 19, 0.3)'
                        }}
                      >
                        Accept Haggled Price
                      </button>
                    </div>
                  </div>
                );
              })()}

              <div className="payment-form-group" style={{ marginTop: '12px' }}>

                <label>Reason for Price Change <span style={{ color: '#666', fontSize: '12px' }}>(required only if price changes)</span></label>

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
              <div style={{ marginTop: '8px', fontSize: '13px', color: '#6b7280' }}>
                The section below is reserved for the main customer. Use Add Another Measurement for family members or other people included in this order.
              </div>
              <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
                <div style={{ flex: 1, padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>

                  <p className="measurement-title" style={{ marginTop: 0, marginBottom: '15px', color: '#000', textAlign: 'center', fontWeight: '600', fontSize: '16px', padding: 0 }}>Primary Customer - Top Measurements</p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    {topMeasurementFields.map((field) => {
                      const value = measurements.top[field.key] ?? '';
                      return (
                        <div className="form-group" key={`top-${field.key}`}>
                          <label>{field.label} (inches)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={value}
                            onChange={(e) => setMeasurements({ ...measurements, top: { ...measurements.top, [field.key]: e.target.value } })}
                            placeholder={`Enter ${field.label.toLowerCase()} measurement`}
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                          />
                        </div>
                      );
                    })}
                  </div>

                </div>
                <div style={{ flex: 1, padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>

                  <p className="measurement-title" style={{ marginTop: 0, marginBottom: '15px', color: '#000', textAlign: 'center', fontWeight: '600', fontSize: '16px', padding: 0 }}>Primary Customer - Bottom Measurements</p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    {bottomMeasurementFields.map((field) => {
                      const value = measurements.bottom[field.key] ?? '';
                      return (
                        <div className="form-group" key={`bottom-${field.key}`}>
                          <label>{field.label} (inches)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={value}
                            onChange={(e) => setMeasurements({ ...measurements, bottom: { ...measurements.bottom, [field.key]: e.target.value } })}
                            placeholder={`Enter ${field.label.toLowerCase()} measurement`}
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                          />
                        </div>
                      );
                    })}
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

              <div style={{ marginTop: '20px', padding: '18px', backgroundColor: '#f7f8fc', border: '1px solid #dfe3ef', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '10px', flexWrap: 'wrap' }}>
                  <div>
                    <strong style={{ color: '#1f2937', fontSize: '16px' }}>Additional People Measurements</strong>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                      Add measurements for people like niece, nephew, or others included in this customization.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setAdditionalMeasurementProfiles((prev) => [...prev, createEmptyAdditionalProfile()])}
                    style={{ padding: '6px 12px', fontSize: '13px' }}
                  >
                    + Add Another Measurement
                  </button>
                </div>

                {additionalMeasurementProfiles.length === 0 ? (
                  <div style={{ fontSize: '13px', color: '#6b7280', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '12px' }}>
                    No additional person added yet.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '14px' }}>
                    {additionalMeasurementProfiles.map((profile, index) => (
                      <div key={profile.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                          <div style={{ flex: '1 1 240px' }}>
                            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#333' }}>
                              Person Label
                            </label>
                            <input
                              type="text"
                              value={profile.label || ''}
                              onChange={(e) => updateAdditionalMeasurementProfile(profile.id, (current) => ({
                                ...current,
                                label: e.target.value
                              }))}
                              placeholder={`Example: Niece #${index + 1}`}
                              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                            />
                          </div>
                          <button
                            type="button"
                            className="btn-cancel-list"
                            onClick={() => setAdditionalMeasurementProfiles((prev) => prev.filter((entry) => entry.id !== profile.id))}
                            style={{ padding: '6px 10px', fontSize: '12px' }}
                          >
                            Remove
                          </button>
                        </div>

                        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                          <div style={{ flex: '1 1 320px', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                            <p className="measurement-title" style={{ marginTop: 0, marginBottom: '12px', color: '#000', textAlign: 'center', fontWeight: '600', fontSize: '14px', padding: 0 }}>Top Measurements</p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                              {topMeasurementFields.map((field) => (
                                <div className="form-group" key={`${profile.id}-top-${field.key}`}>
                                  <label>{field.label} (inches)</label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={profile.top?.[field.key] || ''}
                                    onChange={(e) => updateAdditionalMeasurementProfile(profile.id, (current) => ({
                                      ...current,
                                      top: {
                                        ...(current.top || {}),
                                        [field.key]: e.target.value
                                      }
                                    }))}
                                    placeholder={`Enter ${field.label.toLowerCase()}`}
                                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>

                          <div style={{ flex: '1 1 320px', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                            <p className="measurement-title" style={{ marginTop: 0, marginBottom: '12px', color: '#000', textAlign: 'center', fontWeight: '600', fontSize: '14px', padding: 0 }}>Bottom Measurements</p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                              {bottomMeasurementFields.map((field) => (
                                <div className="form-group" key={`${profile.id}-bottom-${field.key}`}>
                                  <label>{field.label} (inches)</label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={profile.bottom?.[field.key] || ''}
                                    onChange={(e) => updateAdditionalMeasurementProfile(profile.id, (current) => ({
                                      ...current,
                                      bottom: {
                                        ...(current.bottom || {}),
                                        [field.key]: e.target.value
                                      }
                                    }))}
                                    placeholder={`Enter ${field.label.toLowerCase()}`}
                                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div style={{ marginTop: '12px' }}>
                          <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '600', fontSize: '13px' }}>Notes</label>
                          <textarea
                            value={profile.notes || ''}
                            onChange={(e) => updateAdditionalMeasurementProfile(profile.id, (current) => ({
                              ...current,
                              notes: e.target.value
                            }))}
                            placeholder="Optional notes for this person..."
                            rows={2}
                            style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', lineHeight: '1.4', backgroundColor: '#fff' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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

                const sanitizedAdditionalProfiles = sanitizeAdditionalMeasurementProfiles(additionalMeasurementProfiles);
                const orderMeasurementsPayload = {
                  top: measurements.top,
                  bottom: measurements.bottom,
                  notes: measurements.notes,
                  additional_profiles: sanitizedAdditionalProfiles
                };

                const measurementsData = {
                  top_measurements: measurements.top,
                  bottom_measurements: measurements.bottom,
                  notes: measurements.notes,
                  additional_profiles: sanitizedAdditionalProfiles,
                  isWalkIn: isWalkIn,
                  orderId: selectedOrder.order_id,
                  itemId: selectedOrder.item_id,
                  customer_name: customerName
                };

                try {
                  const result = await saveMeasurements(customerId, measurementsData);
                  if (result.success) {
                    setSelectedOrder((prev) => {
                      if (!prev || prev.item_id !== selectedOrder.item_id) return prev;
                      return {
                        ...prev,
                        specific_data: {
                          ...(prev.specific_data || {}),
                          measurements: orderMeasurementsPayload
                        }
                      };
                    });

                    setAllItems((prevItems) =>
                      prevItems.map((item) =>
                        item.item_id === selectedOrder.item_id
                          ? {
                              ...item,
                              specific_data: {
                                ...(item.specific_data || {}),
                                measurements: orderMeasurementsPayload
                              }
                            }
                          : item
                      )
                    );

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

              <div className="size-modal-select-row">
                <div className="customize-form-group size-modal-select-group">
                  <label>Garment Type *</label>
                  <select value={sizeModalGarmentId} onChange={(e) => onChangeSizeModalGarment(e.target.value)}>
                    <option value="">Select Garment Type</option>
                    {garmentTypes.map(g => (
                      <option key={g.garment_id} value={g.garment_id}>{g.garment_name}</option>
                    ))}
                  </select>
                </div>

                <div className="customize-form-group size-modal-select-group">
                  <label>3D Model (Optional)</label>
                  <select value={sizeModalModelId} onChange={(e) => onChangeSizeModalModel(e.target.value)} disabled={!sizeModalGarmentId}>
                    <option value="">Base Garment Type (default profile)</option>
                    {getSizeModalGarmentModels().map((model) => (
                      <option key={model.model_id} value={model.model_id}>{model.model_name}</option>
                    ))}
                  </select>
                  <small>Choose a model to set size details specifically for that 3D model variant.</small>
                </div>
              </div>

              <div className="customize-form-group size-modal-section">
                <label>Measurement Fields</label>
                <div className="size-modal-measurement-chips">
                  {COMMON_MEASUREMENTS.map(m => {
                    const active = sizeModalMeasurements.some(x => x.field === m.field);
                    return (
                      <button
                        key={m.field}
                        type="button"
                        onClick={() => active ? removeMeasurementFromSizeModal(m.field) : addMeasurementToSizeModal(m)}
                        className={`size-modal-measurement-btn ${active ? 'active' : ''}`}
                      >
                        {active ? '✓ ' : '+ '}{m.label}
                      </button>
                    );
                  })}
                </div>

                <div className="size-modal-custom-row">
                  <div className="size-modal-custom-label-col">
                    <small>Custom Label</small>
                    <input
                      type="text"
                      value={sizeModalCustomLabel}
                      onChange={(e) => setSizeModalCustomLabel(e.target.value)}
                      placeholder="e.g., Armhole"
                    />
                  </div>
                  <div className="size-modal-custom-unit-col">
                    <small>Unit</small>
                    <select value={sizeModalCustomUnit} onChange={(e) => setSizeModalCustomUnit(e.target.value)}>
                      <option value="inches">inches</option>
                      <option value="cm">cm</option>
                      <option value="mm">mm</option>
                    </select>
                  </div>
                  <button type="button" className="fabric-edit-btn size-modal-add-custom-btn" onClick={addCustomMeasurementToSizeModal}>Add</button>
                </div>
              </div>

              <div className="customize-form-group size-modal-section">
                <label>Add Size</label>
                <div className="size-modal-add-size-row">
                  <input
                    type="text"
                    value={sizeModalNewSize}
                    onChange={(e) => setSizeModalNewSize(e.target.value)}
                    placeholder="e.g., Extra Small, S, M, L..."
                    className="size-modal-size-input"
                  />
                  <button type="button" className="fabric-edit-btn size-modal-add-size-btn" onClick={addSizeToSizeModal}>+ Add size</button>
                </div>
              </div>

              {sizeModalMeasurements.length > 0 && Object.keys(sizeModalSizeChart).length > 0 && (
                <div className="customize-form-group size-modal-section">
                  <label>Size Details</label>
                  <div className="size-modal-table-wrap">
                    <table className="size-modal-table">
                      <thead>
                        <tr>
                          <th>Size</th>
                          {sizeModalMeasurements.map((m) => (
                            <th key={m.field}>
                              {m.label}
                              <br />
                              <small>({m.unit})</small>
                            </th>
                          ))}
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.keys(sizeModalSizeChart).map((sizeKey) => (
                          <tr key={sizeKey}>
                            <td className="size-modal-size-name">{sizeKey.replace(/-/g, ' ')}</td>
                            {sizeModalMeasurements.map((m) => (
                              <td key={m.field}>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={sizeModalSizeChart?.[sizeKey]?.[m.field] ?? ''}
                                  onChange={(e) => updateSizeModalValue(sizeKey, m.field, e.target.value)}
                                  className="size-modal-value-input"
                                />
                              </td>
                            ))}
                            <td>
                              <button
                                type="button"
                                className="size-modal-remove-btn"
                                onClick={() => removeSizeFromSizeModal(sizeKey)}
                                aria-label={`Remove ${sizeKey} size`}
                                title="Remove size"
                              >
                                <FontAwesomeIcon icon={faXmark} />
                              </button>
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

                                // Check if this is an enhancement order - if so, reset payment tracking
                const isEnhancement = pricingFactors.enhancementRequest && pricingFactors.enhancementAdminAccepted;
                const amountPaid = isEnhancement ? 0 : parseFloat(pricingFactors.amount_paid || 0);

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

              {selectedOrder.approval_status === 'accepted' && getNextStatus(selectedOrder.approval_status, 'customization', selectedOrder) && (
                <div className="payment-form-group">
                  <label>Payment Option *</label>
                  <div className="payment-option-group">
                    <label className="payment-option-item">
                      <input
                        type="checkbox"
                        className="payment-option-input"
                        checked={paymentOption === 'downpayment'}
                        onChange={() => setPaymentOption('downpayment')}
                      />
                      <span>Downpayment</span>
                    </label>
                    <label className="payment-option-item">
                      <input
                        type="checkbox"
                        className="payment-option-input"
                        checked={paymentOption === 'no_downpayment'}
                        onChange={() => {
                          const nextStatus = getNextStatus(selectedOrder.approval_status, 'customization', selectedOrder);
                          setPaymentOption('no_downpayment');
                          setMoveToStatusOnNoDownpayment(nextStatus || '');
                          setPaymentAmount('');
                          setCashReceived('');
                        }}
                      />
                      <span>No Downpayment</span>
                    </label>
                  </div>
                </div>
              )}

              {!(selectedOrder.approval_status === 'accepted' && paymentOption === 'no_downpayment') && (
                <>
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
                </>
              )}

              {selectedOrder.approval_status === 'accepted' && paymentOption === 'no_downpayment' && getNextStatus(selectedOrder.approval_status, 'customization', selectedOrder) && (
                <div className="payment-form-group">
                  <label>Move To *</label>
                  <select
                    value={moveToStatusOnNoDownpayment}
                    onChange={(e) => setMoveToStatusOnNoDownpayment(e.target.value)}
                    className="form-control"
                  >
                    <option value="">Select status</option>
                    <option value={getNextStatus(selectedOrder.approval_status, 'customization', selectedOrder)}>
                      {getNextStatusLabel(selectedOrder.approval_status, 'customization', selectedOrder)}
                    </option>
                  </select>
                </div>
              )}

            </div>

            <div className="modal-footer-centered">

              <button className="btn-cancel" onClick={() => {

                setShowPaymentModal(false);

                setPaymentAmount('');

                setCashReceived('');
                setPaymentOption('downpayment');
                setMoveToStatusOnNoDownpayment('');

              }}>

                Cancel

              </button>

              <button className="btn-save" onClick={handleRecordPayment}>

                {selectedOrder.approval_status === 'accepted' && paymentOption === 'no_downpayment' ? 'Move Status' : 'Record Payment'}

              </button>

            </div>

          </div>

        </div>

      )}

      {showPriceEditModal && priceEditOrder && (

        <CustomizationPriceEditModal

          order={priceEditOrder}

          onClose={() => {

            setShowPriceEditModal(false);

            setPriceEditOrder(null);

          }}

          onSave={handlePriceUpdate}

        />

      )}

    </div>

  );

};

export default Customize;

