import React, { useState, useEffect, Fragment, useRef } from 'react';

import '../adminStyle/repair.css';

import AdminHeader from './AdminHeader';

import Sidebar from './Sidebar';

import { getAllRepairOrders, getRepairOrdersByStatus, updateRepairOrderItem, cancelEnhancement } from '../api/RepairOrderApi';

import ImagePreviewModal from '../components/ImagePreviewModal';

import SimpleImageCarousel from '../components/SimpleImageCarousel';

import { useAlert } from '../context/AlertContext';

import {

  getAllRepairGarmentTypesAdmin,

  createRepairGarmentType,

  updateRepairGarmentType,

  deleteRepairGarmentType,

  createRepairDamageLevel,

  updateRepairDamageLevel,

  deleteRepairDamageLevel

} from '../api/RepairGarmentTypeApi';

import { recordPayment } from '../api/PaymentApi';

import { deleteOrderItem, updateOrderItemPrice } from '../api/OrderApi';

import { API_BASE_URL, getImageUrl } from '../api/config';

import PriceEditModal from '../components/admin/PriceEditModal';
import PriceHistoryModal from '../components/admin/PriceHistoryModal';

import {
  createCompensationIncident,
  getCompensationIncidents,
  settleCompensationIncident,
  updateCompensationLiability
} from '../api/DamageCompensationApi';
import { getClerks } from '../api/ClerkApi';
import { getUserRole } from '../api/AuthApi';
import { createPortal } from 'react-dom';



const Repair = () => {

  const { alert, confirm, prompt } = useAlert();

  const createEmptyDamageLevel = (sortOrder = 1) => ({
    repair_damage_level_id: null,

    level_name: '',

    level_description: '',
    base_price: '',

    sort_order: sortOrder,

    is_active: 1
  });

  const [allItems, setAllItems] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');

  const [statusFilter, setStatusFilter] = useState('');

  const [todayAppointmentsOnly, setTodayAppointmentsOnly] = useState(false);
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [timeFilter, setTimeFilter] = useState('');
  const [tableView, setTableView] = useState('orders');

  const [viewFilter, setViewFilter] = useState("all");

  const [showAddModal, setShowAddModal] = useState(false);

  const [showDetailModal, setShowDetailModal] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState(null);

  const [detailEstimatedCompletionDate, setDetailEstimatedCompletionDate] = useState('');

  const [savingEstimatedDate, setSavingEstimatedDate] = useState(false);

  const [markingOrderReceived, setMarkingOrderReceived] = useState(false);

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



  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);

  const [previewImageUrl, setPreviewImageUrl] = useState('');

  const [previewImageAlt, setPreviewImageAlt] = useState('');



  const [repairGarmentTypes, setRepairGarmentTypes] = useState([]);

  const [loadingRepairGarmentTypes, setLoadingRepairGarmentTypes] = useState(false);

  const [showRepairGarmentTypeModal, setShowRepairGarmentTypeModal] = useState(false);

  const [editingRepairGarmentType, setEditingRepairGarmentType] = useState(null);

  const [repairGarmentTypeForm, setRepairGarmentTypeForm] = useState({

    garment_name: '',

    description: '',

    has_damage_levels: 1,

    default_damage_level_id: null,

    damage_levels: [createEmptyDamageLevel(1)],

    is_active: 1

  });



  const [showPriceConfirmationModal, setShowPriceConfirmationModal] = useState(false);

  const [priceConfirmationItem, setPriceConfirmationItem] = useState(null);

  const [priceConfirmationPrice, setPriceConfirmationPrice] = useState('');

  const [priceConfirmationReason, setPriceConfirmationReason] = useState('');



  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [paymentAmount, setPaymentAmount] = useState('');

  const [cashReceived, setCashReceived] = useState('');
  const [paymentOption, setPaymentOption] = useState('downpayment');
  const [moveToStatusOnNoDownpayment, setMoveToStatusOnNoDownpayment] = useState('');



  const [showPriceEditModal, setShowPriceEditModal] = useState(false);

  const [showPriceHistoryModal, setShowPriceHistoryModal] = useState(false);

  const [priceEditOrder, setPriceEditOrder] = useState(null);



  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const [damageIncidents, setDamageIncidents] = useState([]);
  const [clerkOptions, setClerkOptions] = useState([]);
  const [loadingClerkOptions, setLoadingClerkOptions] = useState(false);

  const [showDamageReportModal, setShowDamageReportModal] = useState(false);
  const [showLiabilityModal, setShowLiabilityModal] = useState(false);
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [damageTargetItem, setDamageTargetItem] = useState(null);
  const [activeDamageIncident, setActiveDamageIncident] = useState(null);
  const [disputeImageFile, setDisputeImageFile] = useState(null);
  const [damageForm, setDamageForm] = useState({
    damageType: '',
    damageDescription: '',
    responsibleParty: '',
    totalQuantity: '1',
    damagedQuantity: '1',
    affectedGarments: [],
    compensationAmount: '',
    compensationType: 'money',
    clotheDescription: ''
  });
  const [liabilityForm, setLiabilityForm] = useState({
    decision: 'approved',
    compensationAmount: '',
    compensationType: 'money',
    clotheDescription: '',
    notes: ''
  });
  const [settlementForm, setSettlementForm] = useState({
    paymentReference: '',
    refundAmount: '',
    customerCompensationChoice: '',
    customerProceedChoice: ''
  });

  const [collapsedParentOrders, setCollapsedParentOrders] = useState({});
  const [openSecondaryMenuId, setOpenSecondaryMenuId] = useState(null);
  const [secondaryMenuPosition, setSecondaryMenuPosition] = useState({ top: 0, left: 0 });
  const secondaryMenuRef = useRef(null);
  const isAdminUser = getUserRole() === 'admin';



  const showToast = (message, type = 'success') => {

    setToast({ show: true, message, type });

    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const getPricingFactors = (order) => {
    const rawPricingFactors = order?.pricing_factors;
    if (typeof rawPricingFactors === 'string') {
      try {
        return JSON.parse(rawPricingFactors || '{}');
      } catch (err) {
        return {};
      }
    }
    return rawPricingFactors || {};
  };

  const isOrderReceivedByAdmin = (order) => {
    const pricingFactors = getPricingFactors(order);
    return Boolean(
      pricingFactors.adminReceivedClothes ||
      pricingFactors.receivedByAdmin ||
      pricingFactors.clothesReceived
    );
  };

  const getOrderReceivedAt = (order) => {
    const pricingFactors = getPricingFactors(order);
    return (
      pricingFactors.adminReceivedClothesAt ||
      pricingFactors.receivedByAdminAt ||
      pricingFactors.clothesReceivedAt ||
      null
    );
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
    showReportDamage = false,
    showEditPrice = false,
    showDelete = false,
    onReportDamage,
    onEditPrice,
    onDelete
  }) => {
    if (!showReportDamage && !showEditPrice && !showDelete) {
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
          <span className="secondary-actions-dots" aria-hidden="true">⋯</span>
        </button>

        {isOpen && typeof document !== 'undefined' && createPortal(
          <div
            ref={secondaryMenuRef}
            className="secondary-actions-dropdown secondary-actions-dropdown-portal"
            role="menu"
            style={{ top: `${secondaryMenuPosition.top}px`, left: `${secondaryMenuPosition.left}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            {showReportDamage && (
              <button
                type="button"
                className="secondary-actions-item"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  closeSecondaryMenu();
                  onReportDamage?.();
                }}
              >
                Report Dispute
              </button>
            )}

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

      'price_declined': 'rejected',

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

      'price_declined': 'Price Declined',

      'cancelled': 'Rejected',

      'auto_confirmed': 'In Progress'

    };

    return statusTextMap[status] || 'Pending';

  };

  const isPaidCompensationIncident = (incident) => (
    incident &&
    String(incident.liability_status || '').toLowerCase() === 'approved' &&
    String(incident.compensation_status || '').toLowerCase() === 'paid'
  );

  const normalizeIncidentStatus = (value) => String(value || '').toLowerCase();

  const getClerkDisplayName = (clerk) => {
    const fullName = [clerk?.first_name, clerk?.middle_name, clerk?.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();
    return fullName || clerk?.email || `Clerk #${clerk?.user_id || ''}`;
  };



  const getNextStatus = (currentStatus, serviceType = 'repair', item = null) => {

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



    const flow = statusFlow[serviceType] || statusFlow['repair'];

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

      const incident = getIncidentForItem(item.item_id);
      const hasPaidCompensation = isPaidCompensationIncident(incident);
      const proceedChoice = String(incident?.customer_proceed_choice || '').toLowerCase();
      const compensationBypassesPayment = hasPaidCompensation && proceedChoice !== 'proceed';



      if (remainingBalance > 0.01 && !compensationBypassesPayment) {

        return null;

      }

    }



    return nextStatus;

  };



  const getNextStatusLabel = (currentStatus, serviceType = 'repair', item = null) => {

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

  const getPreferredCompletionDate = (item) => {
    const specificData = parseMaybeObject(item?.specific_data);
    return specificData?.preferredDate
      || specificData?.preferred_date
      || specificData?.appointmentDate
      || specificData?.appointment_date
      || item?.preferred_date
      || '';
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

      specificData?.date ||

      ((item?.approval_status === 'accepted' || item?.approval_status === 'confirmed') ? item?.order_date : null);

    const estimatedDate = pricingFactors?.estimatedCompletionDate || pricingFactors?.estimated_completion_date;



    if (appointmentDate && isToday(appointmentDate)) {

      return 'appointment-today';

    }

    if (estimatedDate && isToday(estimatedDate)) {

      return 'estimated-today';

    }

    return null;

  };

  const isTodayAppointment = (item) => getComputedStatus(item) === 'appointment-today';



  useEffect(() => {

    loadRepairOrders();

    loadRepairGarmentTypes();
    loadClerkOptions();

  }, []);

  const loadClerkOptions = async () => {
    setLoadingClerkOptions(true);
    try {
      const result = await getClerks();
      if (result.success) {
        const clerks = Array.isArray(result.clerks) ? result.clerks : [];
        setClerkOptions(clerks.filter((clerk) => String(clerk?.status || '').toLowerCase() !== 'inactive'));
      } else {
        showToast(result.message || 'Failed to load clerks', 'error');
      }
    } catch (error) {
      showToast('Failed to load clerks', 'error');
    } finally {
      setLoadingClerkOptions(false);
    }
  };



  const loadRepairGarmentTypes = async () => {

    setLoadingRepairGarmentTypes(true);

    try {

      const result = await getAllRepairGarmentTypesAdmin();

      if (result.success) {

        const normalizedGarments = (result.garments || []).map((garment) => ({

          ...garment,

          is_active: Number(garment.is_active) === 1 ? 1 : 0,

          damage_levels: (garment.damage_levels || []).map((level) => ({

            ...level,

            is_active: Number(level.is_active) === 1 ? 1 : 0,

            base_price: parseFloat(level.base_price || 0),

            sort_order: parseInt(level.sort_order, 10) || 0

          }))

        }));

        setRepairGarmentTypes(normalizedGarments);

      } else {

        alert(result.message || 'Failed to load repair garment types', 'Error');

      }

    } catch (err) {

      console.error("Load repair garment types error:", err);

      alert('Failed to load repair garment types', 'Error');

    } finally {

      setLoadingRepairGarmentTypes(false);

    }

  };



  const handleRepairGarmentTypeSubmit = async () => {

    if (!repairGarmentTypeForm.garment_name.trim()) {

      alert('Please enter a garment name', 'Error');

      return;

    }



    const normalizedDamageLevels = (repairGarmentTypeForm.damage_levels || [])

      .filter((level) => level && String(level.level_name || '').trim() !== '')

      .map((level, index) => ({

        repair_damage_level_id: level.repair_damage_level_id || null,

        level_name: String(level.level_name || '').trim(),

        level_description: level.level_description || '',

        base_price: parseFloat(level.base_price || 0),

        sort_order: index + 1,

        is_active: level.is_active !== undefined ? level.is_active : 1

      }));



    if (normalizedDamageLevels.length === 0) {

      alert('Please add at least one damage level with a name and price', 'Error');

      return;

    }



    const hasInvalidPrice = normalizedDamageLevels.some((level) => !Number.isFinite(level.base_price) || level.base_price <= 0);

    if (hasInvalidPrice) {

      alert('Please enter a valid price greater than 0 for each damage level', 'Error');

      return;

    }



    try {

      let result;

      let garmentId;



      const garmentPayload = {

        garment_name: repairGarmentTypeForm.garment_name,

        description: repairGarmentTypeForm.description,

        has_damage_levels: 1,

        default_damage_level_id: repairGarmentTypeForm.default_damage_level_id || null,

        is_active: repairGarmentTypeForm.is_active

      };



      if (editingRepairGarmentType) {

        garmentId = editingRepairGarmentType.repair_garment_id;

        result = await updateRepairGarmentType(garmentId, garmentPayload);

      } else {

        result = await createRepairGarmentType({

          ...garmentPayload,

          damage_levels: normalizedDamageLevels

        });

        garmentId = result?.garment?.repair_garment_id;

      }



      if (result.success) {

        if (editingRepairGarmentType && garmentId) {

          const existingLevels = editingRepairGarmentType.damage_levels || [];

          const existingById = new Map(

            existingLevels

              .filter((level) => level?.repair_damage_level_id)

              .map((level) => [String(level.repair_damage_level_id), level])

          );



          const currentIds = new Set(

            normalizedDamageLevels

              .filter((level) => level.repair_damage_level_id)

              .map((level) => String(level.repair_damage_level_id))

          );



          const createPromises = normalizedDamageLevels

            .filter((level) => !level.repair_damage_level_id)

            .map((level) => createRepairDamageLevel(garmentId, level));



          const updatePromises = normalizedDamageLevels

            .filter((level) => level.repair_damage_level_id)

            .map((level) => updateRepairDamageLevel(garmentId, level.repair_damage_level_id, level));



          const deletePromises = Array.from(existingById.values())

            .filter((level) => !currentIds.has(String(level.repair_damage_level_id)))

            .map((level) => deleteRepairDamageLevel(garmentId, level.repair_damage_level_id));



          await Promise.all([...createPromises, ...updatePromises, ...deletePromises]);

        }



        alert(editingRepairGarmentType ? 'Repair garment type updated successfully!' : 'Repair garment type created successfully!', 'Success');

        setShowRepairGarmentTypeModal(false);

        setRepairGarmentTypeForm({

          garment_name: '',

          description: '',

          has_damage_levels: 1,

          default_damage_level_id: null,

          damage_levels: [createEmptyDamageLevel(1)],

          is_active: 1

        });

        setEditingRepairGarmentType(null);

        await loadRepairGarmentTypes();

      } else {

        alert(result.message || 'Failed to save repair garment type', 'Error');

      }

    } catch (err) {

      console.error("Save repair garment type error:", err);

      alert('Failed to save repair garment type', 'Error');

    }

  };



  const handleDeleteRepairGarmentType = async (garmentId) => {

    const confirmed = await confirm("Are you sure you want to delete this repair garment type? This action cannot be undone.");

    if (!confirmed) return;



    try {

      const result = await deleteRepairGarmentType(garmentId);

      if (result.success) {

        alert('Repair garment type deleted successfully', 'Success');

        setRepairGarmentTypes(prevGarments => prevGarments.filter(garment => garment.repair_garment_id !== garmentId));

        await loadRepairGarmentTypes();

      } else {

        alert(result.message || 'Failed to delete repair garment type', 'Error');

      }

    } catch (err) {

      console.error("Delete repair garment type error:", err);

      alert('Failed to delete repair garment type', 'Error');

      await loadRepairGarmentTypes();

    }

  };



  const openEditRepairGarmentType = (garment) => {

    setEditingRepairGarmentType(garment);

    const mappedDamageLevels = (garment.damage_levels || []).length > 0

      ? garment.damage_levels

          .sort((a, b) => (parseInt(a.sort_order, 10) || 0) - (parseInt(b.sort_order, 10) || 0))

          .map((level, index) => ({

            repair_damage_level_id: level.repair_damage_level_id,

            level_name: level.level_name || '',

            level_description: level.level_description || '',

            base_price: level.base_price || '',

            sort_order: level.sort_order !== undefined ? level.sort_order : index + 1,

            is_active: level.is_active !== undefined ? level.is_active : 1

          }))

      : [createEmptyDamageLevel(1)];



    setRepairGarmentTypeForm({

      garment_name: garment.garment_name,

      description: garment.description || '',

      has_damage_levels: garment.has_damage_levels !== undefined ? garment.has_damage_levels : 1,

      default_damage_level_id: garment.default_damage_level_id || null,

      damage_levels: mappedDamageLevels,

      is_active: garment.is_active

    });

    setShowRepairGarmentTypeModal(true);

  };



  const openNewRepairGarmentType = () => {

    setEditingRepairGarmentType(null);

    setRepairGarmentTypeForm({

      garment_name: '',

      description: '',

      has_damage_levels: 1,

      default_damage_level_id: null,

      damage_levels: [createEmptyDamageLevel(1)],

      is_active: 1

    });

    setShowRepairGarmentTypeModal(true);

  };



  const addDamageLevelRow = () => {

    setRepairGarmentTypeForm((prev) => ({

      ...prev,

      damage_levels: [...(prev.damage_levels || []), createEmptyDamageLevel((prev.damage_levels || []).length + 1)]

    }));

  };



  const updateDamageLevelRow = (index, field, value) => {

    setRepairGarmentTypeForm((prev) => ({

      ...prev,

      damage_levels: (prev.damage_levels || []).map((row, rowIndex) =>

        rowIndex === index ? { ...row, [field]: value } : row

      )

    }));

  };



  const removeDamageLevelRow = (index) => {

    setRepairGarmentTypeForm((prev) => {

      const nextRows = (prev.damage_levels || []).filter((_, rowIndex) => rowIndex !== index);

      return {

        ...prev,

        damage_levels: nextRows.length > 0 ? nextRows : [createEmptyDamageLevel(1)]

      };

    });

  };



  const loadRepairOrders = async () => {

    setLoading(true);

    setError('');

    try {

      console.log("Loading repair orders...");

      const result = await getAllRepairOrders();

      console.log("Loaded orders:", result);

      if (result.success) {

        console.log("Setting orders:", result.orders);



        result.orders.forEach(order => {

          if (order.item_id === 25) {

            console.log("Item 25 status after refresh:", order.approval_status);

          }

        });

        setAllItems(result.orders);

        const incidentsResult = await getCompensationIncidents({ service_type: 'repair' });
        if (incidentsResult.success) {
          setDamageIncidents(incidentsResult.incidents || []);
        }

      } else {

        setError(result.message || 'Failed to load repair orders');

      }

    } catch (err) {

      console.error("Load error:", err);

      setError('Failed to load repair orders');

    } finally {

      setLoading(false);

    }

  };

  const getIncidentForItem = (itemId) => {
    const incidents = damageIncidents.filter((incident) => Number(incident.order_item_id) === Number(itemId));
    if (!incidents.length) return null;
    return incidents.sort((a, b) => Number(b.id || 0) - Number(a.id || 0))[0];
  };

  const getCustomerNameFromItem = (item) => {
    if (item.order_type === 'walk_in') {
      return item.walk_in_customer_name || 'Walk-in Customer';
    }
    return `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'Unknown Customer';
  };

  const openDamageReportModal = (item) => {
    let totalQty = 1;
    try {
      const specificData = typeof item?.specific_data === 'string'
        ? JSON.parse(item.specific_data)
        : (item?.specific_data || {});
      const garments = Array.isArray(specificData?.garments) ? specificData.garments : [];
      if (garments.length > 0) {
        totalQty = garments.reduce((sum, garment) => {
          const qty = parseInt(garment?.quantity || 1, 10);
          return sum + (Number.isInteger(qty) && qty > 0 ? qty : 1);
        }, 0);
      } else {
        const fallbackQty = parseInt(specificData?.quantity || 1, 10);
        totalQty = Number.isInteger(fallbackQty) && fallbackQty > 0 ? fallbackQty : 1;
      }
    } catch (error) {
      totalQty = 1;
    }

    setDamageTargetItem(item);
    setDamageForm({
      damageType: '',
      damageDescription: '',
      responsibleParty: '',
      totalQuantity: String(Math.max(1, totalQty)),
      damagedQuantity: '1',
      affectedGarments: [],
      compensationAmount: '',
      compensationType: 'both',
      clotheDescription: ''
    });
    setDisputeImageFile(null);
    setShowDamageReportModal(true);
  };

  const handleReportDamage = async () => {
    if (!damageTargetItem) return;

    const totalQuantity = parseInt(damageForm.totalQuantity || '1', 10);
    const damagedQuantity = parseInt(damageForm.damagedQuantity || '1', 10);
    const compensationAmount = parseFloat(damageForm.compensationAmount || '0');
    const selectedGarments = Array.isArray(damageForm.affectedGarments) ? damageForm.affectedGarments : [];
    const totalAffectedQty = selectedGarments.reduce((sum, garment) => {
      const qty = parseInt(garment?.damagedQty || 0, 10);
      return sum + (Number.isInteger(qty) && qty > 0 ? qty : 0);
    }, 0);
    if (!damageForm.damageType.trim()) {
      showToast('Please enter a damage type', 'error');
      return;
    }
    if (!damageForm.responsibleParty.trim()) {
      showToast('Please select a responsible clerk', 'error');
      return;
    }
    if (!Number.isInteger(totalQuantity) || totalQuantity < 1) {
      showToast('Please enter a valid total quantity', 'error');
      return;
    }
    if (!Number.isInteger(damagedQuantity) || damagedQuantity < 1 || damagedQuantity > totalQuantity) {
      showToast('Damaged quantity must be between 1 and total quantity', 'error');
      return;
    }
    if (selectedGarments.length === 0) {
      showToast('Please select at least one affected garment', 'error');
      return;
    }
    if (totalAffectedQty !== damagedQuantity) {
      showToast('Damaged quantity must match the total of affected garment quantities', 'error');
      return;
    }
    const selectedCompensationType = damageForm.compensationType || '';
    const hasMoneyType = selectedCompensationType === 'money' || selectedCompensationType === 'both';
    const hasClotheType = selectedCompensationType === 'clothe' || selectedCompensationType === 'both';
    const hasMoneyOffer = Number.isFinite(compensationAmount) && compensationAmount > 0;
    const hasClotheOffer = damageForm.clotheDescription.trim().length > 0;
    if (!hasMoneyType && !hasClotheType) {
      showToast('Please select at least one compensation type', 'error');
      return;
    }
    if (hasMoneyType && !hasMoneyOffer) {
      showToast('Please enter a compensation amount greater than 0', 'error');
      return;
    }
    if (hasClotheType && !hasClotheOffer) {
      showToast('Please provide a clothe compensation description', 'error');
      return;
    }

    const damagedGarmentSummary = selectedGarments
      .map((garment) => `${garment.garmentType} x${garment.damagedQty}`)
      .join(', ');

    const result = await createCompensationIncident({
      order_item_id: damageTargetItem.item_id,
      order_id: damageTargetItem.order_id,
      service_type: 'repair',
      customer_name: getCustomerNameFromItem(damageTargetItem),
      responsible_party: damageForm.responsibleParty.trim(),
      damage_type: damageForm.damageType.trim(),
      damage_description: damageForm.damageDescription.trim(),
      total_quantity: totalQuantity,
      damaged_quantity: damagedQuantity,
      damaged_garment_type: damagedGarmentSummary || null,
      compensation_amount: hasMoneyType ? compensationAmount : 0,
      compensation_type: hasMoneyType && hasClotheType ? 'both' : hasMoneyType ? 'money' : 'clothe',
      clothe_description: hasClotheType ? damageForm.clotheDescription.trim() : null,
      disputeImageFile,
      notes: 'Reported from Repair management'
    });

    if (!result.success) {
      showToast(result.message || 'Failed to report damage incident', 'error');
      return;
    }

    showToast('Damage incident reported. Set liability next.', 'success');
    setShowDamageReportModal(false);
    setDamageTargetItem(null);
    setDisputeImageFile(null);
    await loadRepairOrders();
  };

  const openLiabilityModal = (incident, decision) => {
    setActiveDamageIncident(incident);
    setLiabilityForm({
      decision,
      compensationAmount: `${incident.compensation_amount || 0}`,
      compensationType: incident.compensation_type || 'money',
      clotheDescription: incident.clothe_description || '',
      notes: incident.notes || ''
    });
    setShowLiabilityModal(true);
  };

  const handleLiabilityDecision = async () => {
    if (!activeDamageIncident) return;

    const compensationAmount = parseFloat(liabilityForm.compensationAmount || '0');
    const hasMoneyOffer = Number.isFinite(compensationAmount) && compensationAmount > 0;
    const hasClotheOffer = liabilityForm.clotheDescription.trim().length > 0;
    if (!hasMoneyOffer && !hasClotheOffer) {
      showToast('Please provide at least one compensation option (money amount or clothe description)', 'error');
      return;
    }

    const result = await updateCompensationLiability(activeDamageIncident.id, {
      liability_status: liabilityForm.decision,
      compensation_amount: hasMoneyOffer ? compensationAmount : 0,
      compensation_type: hasMoneyOffer && hasClotheOffer ? 'both' : hasMoneyOffer ? 'money' : 'clothe',
      clothe_description: hasClotheOffer ? liabilityForm.clotheDescription.trim() : null,
      notes: liabilityForm.notes
    });

    if (!result.success) {
      showToast(result.message || 'Failed to update liability decision', 'error');
      return;
    }

    showToast(`Liability marked as ${liabilityForm.decision}`, 'success');
    setShowLiabilityModal(false);
    setActiveDamageIncident(null);
    await loadRepairOrders();
  };

  const openSettlementModal = (incident) => {
    setActiveDamageIncident(incident);
    const item = allItems.find(i => Number(i.item_id) === Number(incident.order_item_id));
    const isWalkIn = item?.order_type === 'walk_in';
    const pf = typeof item?.pricing_factors === 'string' ? JSON.parse(item?.pricing_factors || '{}') : (item?.pricing_factors || {});
    const servicePaid = parseFloat(pf.amount_paid || 0);
    const compensationAmt = parseFloat(incident.compensation_amount || 0);
    const shouldAutoRefund =
      incident.customer_proceed_choice === 'dont_proceed' &&
      (incident.customer_compensation_choice === 'money' || incident.compensation_type === 'money');
    const autoRefund = shouldAutoRefund ? (servicePaid + compensationAmt) : 0;
    setSettlementForm({
      paymentReference: incident.payment_reference || '',
      refundAmount: autoRefund > 0 ? autoRefund.toFixed(2) : '',
      customerCompensationChoice: isWalkIn
        ? (incident.customer_compensation_choice || (incident.compensation_type === 'clothe' ? 'clothe' : 'money'))
        : '',
      customerProceedChoice: isWalkIn
        ? (incident.customer_proceed_choice || 'proceed')
        : ''
    });
    setShowSettlementModal(true);
  };

  const handleSettleCompensation = async () => {
    if (!activeDamageIncident) return;

    if (activeDamageIncident.liability_status !== 'approved') {
      showToast('Approve liability before settlement', 'error');
      return;
    }

    const result = await settleCompensationIncident(activeDamageIncident.id, {
      payment_reference: settlementForm.paymentReference.trim(),
      refund_amount: settlementForm.refundAmount ? parseFloat(settlementForm.refundAmount) : undefined
    });

    if (!result.success) {
      showToast(result.message || 'Failed to settle compensation', 'error');
      return;
    }

    showToast('Compensation marked as paid', 'success');
    setShowSettlementModal(false);
    setActiveDamageIncident(null);
    await loadRepairOrders();
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
      const activityDiff = getItemActivityTimestamp(a) - getItemActivityTimestamp(b);
      if (activityDiff !== 0) return activityDiff;

      const orderDiff = Number(a.order_id || 0) - Number(b.order_id || 0);
      if (orderDiff !== 0) return orderDiff;

      return Number(a.item_id || 0) - Number(b.item_id || 0);
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

    items = items.filter(item => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      const customerName = item.order_type === 'walk_in'
        ? (item.walk_in_customer_name || '').toLowerCase()
        : `${item.first_name || ''} ${item.last_name || ''}`.toLowerCase();
      const customerEmail = item.order_type === 'walk_in'
        ? (item.walk_in_customer_email || '').toLowerCase()
        : (item.email || '').toLowerCase();
      const garmentSummary = item.specific_data?.garments && item.specific_data.garments.length > 0
        ? item.specific_data.garments.map(g => formatGarmentWithSize(g)).join(', ').toLowerCase()
        : ((item.specific_data?.size ? `${item.specific_data?.garmentType || 'N/A'} (${item.specific_data.size})` : (item.specific_data?.garmentType || ''))).toLowerCase();

      return (
        item.order_id?.toString().includes(searchLower) ||
        customerName.includes(searchLower) ||
        garmentSummary.includes(searchLower) ||
        customerEmail.includes(searchLower)
      );
    });

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

      alert("Order not found", "Error", "error");

      return;

    }



    if (item.order_type === 'walk_in') {

      try {

        const estimatedPrice = getEstimatedPrice(item) || parseFloat(item.final_price || 0);

        const result = await updateRepairOrderItem(itemId, {

          approvalStatus: 'accepted',

          finalPrice: estimatedPrice

        });

        if (result.success) {

          await loadRepairOrders();

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
      const result = await updateRepairOrderItem(item.item_id, {
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
        await loadRepairOrders();
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
      const result = await updateRepairOrderItem(item.item_id, {
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
        await loadRepairOrders();
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

      const result = await updateRepairOrderItem(priceConfirmationItem.item_id, {

        approvalStatus: targetStatus,

        finalPrice: finalPrice,

        adminNotes: isPriceChanged ? String(reasonToUse || '').trim() : undefined

      });

      if (result.success) {

        await loadRepairOrders();



        if (viewFilter !== 'all') {

          setViewFilter(targetStatus === 'accepted' ? 'accepted' : 'price-confirmation');

        }

        showToast(targetStatus === 'accepted' ? "Repair request moved to accepted!" : "Repair request moved to price confirmation!", "success");

        setShowPriceConfirmationModal(false);

        setPriceConfirmationItem(null);

        setPriceConfirmationPrice('');

        setPriceConfirmationReason('');

      } else {

        showToast(result.message || "Failed to accept repair request", "error");

      }

    } catch (err) {

      console.error("Accept error:", err);

      showToast("Failed to accept repair request", "error");

    }

  };

  const getPricingFactorsFromItem = (item) => {
    try {
      return typeof item?.pricing_factors === 'string'
        ? JSON.parse(item.pricing_factors || '{}')
        : (item?.pricing_factors || {});
    } catch (error) {
      return {};
    }
  };



  const handleDecline = async (itemId) => {

    console.log("Declining item:", itemId);

    const reasonInput = await prompt(
      'Please enter the reason for declining this repair request.',
      'Decline Reason',
      'e.g. repair request lacks required details',
      ''
    );
    if (reasonInput === null) {
      return;
    }

    const reason = String(reasonInput || '').trim();
    if (!reason) {
      await alert('Please provide a decline reason.', 'Required', 'warning');
      return;
    }

    const confirmed = await confirm("Decline this repair request?", "Decline Repair", "warning");

    if (confirmed) {

      try {

        const result = await updateRepairOrderItem(itemId, {

          approvalStatus: 'cancelled',
          adminNotes: reason,
          pricingFactors: {
            adminDeclineReason: reason,
            adminDeclinedAt: new Date().toISOString()
          }

        });

        console.log("Decline result:", result);

        if (result.success) {

          loadRepairOrders();
          showToast('Request declined', 'success');

        } else {

          await alert(result.message || "Failed to decline repair request", "Error", "error");

        }

      } catch (err) {

        console.error("Decline error:", err);

        await alert("Failed to decline repair request", "Error", "error");

      }

    }

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

      const incident = getIncidentForItem(item.item_id);
      const hasPaidCompensation = isPaidCompensationIncident(incident);
      const proceedChoiceForUpdate = String(incident?.customer_proceed_choice || '').toLowerCase();
      const compensationBypassesPaymentForUpdate = hasPaidCompensation && proceedChoiceForUpdate !== 'proceed';



      if (remainingBalance > 0.01 && !compensationBypassesPaymentForUpdate) {

        await alert(

          `Cannot mark as completed. Payment is not complete. Remaining balance: ₱${remainingBalance.toFixed(2)}`,

          "Payment Required",

          "error"

        );

        return;

      }

    }



    const confirmed = await confirm(

      `Are you sure you want to move this order from "${currentStatusLabel}" to "${statusLabel}"?`,

      'Update Status',

      'warning'

    );



    if (!confirmed) return;



    try {

      const result = await updateRepairOrderItem(itemId, {

        approvalStatus: status

      });

      if (result.success) {

        await loadRepairOrders();



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

  const handleMarkOrderReceived = async () => {

    if (!selectedOrder || selectedOrder.approval_status !== 'accepted') return;

    if (isOrderReceivedByAdmin(selectedOrder)) {
      showToast('Order is already marked as received.', 'success');
      return;
    }

    try {
      setMarkingOrderReceived(true);
      const currentPricingFactors = getPricingFactors(selectedOrder);
      const receivedAt = new Date().toISOString();

      const result = await updateRepairOrderItem(selectedOrder.item_id, {
        approvalStatus: selectedOrder.approval_status,
        pricingFactors: {
          ...currentPricingFactors,
          adminReceivedClothes: true,
          adminReceivedClothesAt: receivedAt
        }
      });

      if (result.success) {
        setSelectedOrder((prev) => ({
          ...prev,
          pricing_factors: {
            ...getPricingFactors(prev),
            adminReceivedClothes: true,
            adminReceivedClothesAt: receivedAt
          }
        }));
        showToast('Order marked as received.', 'success');
        loadRepairOrders();
      } else {
        showToast(result.message || 'Failed to mark order as received', 'error');
      }
    } catch (err) {
      showToast('Failed to mark order as received', 'error');
    } finally {
      setMarkingOrderReceived(false);
    }

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

      const result = await updateRepairOrderItem(selectedOrder.item_id, {

        estimatedCompletionDate: detailEstimatedCompletionDate || null,

        approvalStatus: selectedOrder.approval_status

      });



      if (result.success) {

        setSelectedOrder((prev) => ({

          ...prev,

          pricing_factors: {

            ...(prev?.pricing_factors || {}),

            estimatedCompletionDate: detailEstimatedCompletionDate || null,

            estimated_completion_date: detailEstimatedCompletionDate || null

          }

        }));

        showToast('Estimated completion date saved.', 'success');

        loadRepairOrders();

      } else {

        showToast(result.message || 'Failed to save estimated completion date', 'error');

      }

    } catch (err) {

      showToast('Failed to save estimated completion date', 'error');

    } finally {

      setSavingEstimatedDate(false);

    }

  };



  const handleEditOrder = (item) => {

    setSelectedOrder(item);

    setEditForm({

      finalPrice: item.final_price || '',

      approvalStatus: item.approval_status || '',

      adminNotes: item.pricing_factors?.adminNotes || '',

      estimatedCompletionDate: item.pricing_factors?.estimatedCompletionDate || item.pricing_factors?.estimated_completion_date || ''

    });

    setShowEditModal(true);

  };



  const handleDeleteOrder = async (item) => {

    if (!isAdminUser) {
      await alert('Only admin can delete orders', 'Access Denied', 'warning');
      return;
    }

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

        loadRepairOrders();

      } else {

        await alert(result.message || 'Failed to delete order', 'Error', 'error');

      }

    } catch (error) {

      console.error('Error deleting order:', error);

      await alert('Error deleting order', 'Error', 'error');

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

      const result = await updateRepairOrderItem(enhanceOrder.item_id, {

        finalPrice: nextFinal,

        approvalStatus: 'confirmed',

        adminNotes: `Enhancement requested in-shop: ${notes}`,

        estimatedCompletionDate: enhanceForm.estimatedCompletionDate || null,

        pricingFactors: {

          enhancementRequest: true,

          enhancementNotes: notes,

          enhancementAdditionalCost: additionalCost.toFixed(2),

          enhancementBasePrice: currentFinal.toFixed(2),

          enhancementUpdatedAt: new Date().toISOString(),

          estimatedCompletionDate: enhanceForm.estimatedCompletionDate || null,

          enhancementPendingAdminReview: true

        }

      });



      if (result.success) {

        setShowEnhanceModal(false);

        setEnhanceOrder(null);

        showToast('Enhancement applied. Order moved to In Progress.', 'success');

        loadRepairOrders();

      } else {

        showToast(result.message || 'Failed to apply enhancement', 'error');

      }

    } catch (err) {

      showToast('Failed to apply enhancement', 'error');

    } finally {

      setSavingEnhancement(false);

    }

  };



  const getEstimatedPrice = (item) => {

    if (!item || !item.specific_data) return null;

    return item.specific_data.estimatedPrice || null;

  };



  const getDamageLevelSummary = (item) => {

    if (!item?.specific_data) return 'N/A';



    if (Array.isArray(item.specific_data.garments) && item.specific_data.garments.length > 0) {

      return item.specific_data.garments

        .map((g) => g?.damageLevel)

        .filter(Boolean)

        .join(', ') || 'N/A';

    }



    return item.specific_data.damageLevel || 'N/A';

  };

  const formatGarmentWithSize = (garment) => {
    const garmentType = garment?.garmentType || 'Unknown';
    return garment?.size ? `${garmentType} (${garment.size})` : garmentType;
  };



  const handleSaveEdit = async () => {

    if (!selectedOrder) return;



    const currentPrice = parseFloat(selectedOrder.final_price || 0);

    const newPrice = parseFloat(editForm.finalPrice || 0);

    const isPriceChanged = !isNaN(newPrice) && Math.abs(newPrice - currentPrice) > 0.01;

    if (isPriceChanged && !String(editForm.adminNotes || '').trim()) {

      await alert('Please provide a reason for the price change', "Reason Required", "warning");

      return;

    }



    try {

      console.log("Frontend - Sending edit data:", editForm);

      console.log("Frontend - Selected order:", selectedOrder);



      const result = await updateRepairOrderItem(selectedOrder.item_id, editForm);

      console.log("Frontend - Update result:", result);



      if (result.success) {

        setShowEditModal(false);

        loadRepairOrders();

        await alert('Repair order updated successfully!', "Success", "success");

      } else {

        await alert(result.message || 'Failed to update repair order', "Error", "error");

      }

    } catch (err) {

      console.error("Frontend - Update error:", err);

      await alert('Failed to update repair order', "Error", "error");

    }

  };



  const handleEnhancementPriceConfirm = async (item) => {
    const target = item || enhancementPriceItem;
    if (!target) return;

    const pricingFactors = typeof target.pricing_factors === 'string'
      ? JSON.parse(target.pricing_factors || '{}')
      : (target.pricing_factors || {});

    // If addAccessories is true, open accessories price modal instead
    if (pricingFactors.addAccessories === true) {
      setAccessoriesPriceItem(target);
      setAccessoriesPrice('');
      setShowAccessoriesPriceModal(true);
      setShowEnhancementViewModal(false);
      return;
    }

    // No accessories — go directly to accepted
    try {
      setSavingEnhancementPrice(true);
      const result = await updateRepairOrderItem(target.item_id, {
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
        loadRepairOrders();
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
      const result = await updateRepairOrderItem(accessoriesPriceItem.item_id, {
        approvalStatus: 'price_confirmation',
        finalPrice: newFinalPrice,
        adminNotes: `Accessories price: ₱${price.toFixed(2)}`,
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
        loadRepairOrders();
      } else {
        showToast(result.message || 'Failed to submit accessories price', 'error');
      }
    } catch (err) {
      showToast('Failed to submit accessories price', 'error');
    } finally {
      setSavingEnhancementPrice(false);
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
        || getNextStatus(selectedOrder.approval_status, 'repair', selectedOrder);

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

        await loadRepairOrders();

      } else {

        await alert(result.message || 'Failed to record payment', 'Error', 'error');

      }

    } catch (error) {

      console.error('Error recording payment:', error);

      await alert('Error recording payment', 'Error', 'error');

    }

  };



  const handlePriceUpdate = async (itemId, newPrice, reason) => {

    try {

      const result = await updateOrderItemPrice(itemId, newPrice, reason);

      if (result.success) {

        await alert('Price updated successfully!', 'Success', 'success');

        loadRepairOrders();

      } else {

        throw new Error(result.message);

      }

    } catch (error) {

      await alert(error.response?.data?.message || 'Failed to update price', 'Error', 'error');

      throw error;

    }

  };



  return (

    <div className="dry-cleaning-management">

      <Sidebar />

      <AdminHeader />



      <div className="content">

        <div className="dashboard-title">

          <div>

            <h2>Repair Services Management</h2>

            <p>Manage garment repair requests and ongoing fixes</p>

          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>

            <button

              onClick={openNewRepairGarmentType}

              style={{

                padding: '10px 20px',

                backgroundColor: '#2196f3',

                color: 'white',

                border: 'none',

                borderRadius: '5px',

                cursor: 'pointer',

                fontSize: '14px',

                fontWeight: '500'

              }}

            >

              + Add Repair Garment Type

            </button>

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

            placeholder="Search by Unique No, Name, or Garment"

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

            <option value="cancelled">Rejected</option>

            <option value="estimated-today">Estimated Release Today</option>

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

                <th>Damage Type</th>

                <th>Date</th>

                <th>Price</th>

                <th>Payment Status</th>

                <th>Status</th>

                <th>Actions</th>

              </tr>

            </thead>

            <tbody>

              {loading ? (

                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '40px' }}>Loading repair orders...</td></tr>

              ) : getFilteredItems().length === 0 ? (

                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '40px' }}>No repair orders found</td></tr>

              ) : (

                (() => {
                  const orderedItems = getFilteredItems().filter(item => 

                  item && 

                  item.order_id && 

                  item.specific_data

                );

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

                  const incident = getIncidentForItem(item.item_id);
                  const liabilityStatus = normalizeIncidentStatus(incident?.liability_status);
                  const compensationStatus = normalizeIncidentStatus(incident?.compensation_status);
                  const isCompensatedIncident = incident && liabilityStatus === 'approved' && compensationStatus === 'paid';
                  const isDamagePendingIncident = incident && liabilityStatus === 'pending';
                  const isForCompensationIncident = incident && liabilityStatus === 'approved' && compensationStatus !== 'paid';
                  const customerProceedChoice = String(incident?.customer_proceed_choice || '').toLowerCase();
                  const customerWantsToProceed = isCompensatedIncident && customerProceedChoice === 'proceed';
                  const customerDontProceed = isCompensatedIncident && customerProceedChoice === 'dont_proceed';



                  const pricingFactors = typeof item.pricing_factors === 'string'

                    ? JSON.parse(item.pricing_factors || '{}')

                    : (item.pricing_factors || {});
                  const isReceivedByAdmin = isOrderReceivedByAdmin(item);

                  const isEnhancementOrder = pricingFactors.enhancementRequest && pricingFactors.enhancementAdminAccepted;

                  const isAccessoriesEnhancement = isEnhancementOrder && !!pricingFactors.accessoriesPrice;

                  const amountPaid = (isEnhancementOrder && !isAccessoriesEnhancement) ? parseFloat(item.final_price || 0) : parseFloat(pricingFactors.amount_paid || 0);

                  const finalPrice = parseFloat(item.final_price || 0);

                  const remainingBalance = finalPrice - amountPaid;

                  const parentOrderId = item.order_id;
                  const isFirstInParent = index === 0 || groupedItems[index - 1]?.order_id !== parentOrderId;
                  const parentItemCount = parentItemCounts[String(parentOrderId || '')] || 0;
                  const isAddAnotherGroup = parentItemCount > 1;
                  const isCollapsed = isAddAnotherGroup && !!collapsedParentOrders[parentOrderId];
                  const isSecondaryMenuOpenForRow = typeof openSecondaryMenuId === 'string' && openSecondaryMenuId.startsWith(`repair-${item.item_id}-`);



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

                      <td>

                        {item.specific_data?.garments && item.specific_data.garments.length > 0

                          ? item.specific_data.garments.map((g) => formatGarmentWithSize(g)).join(', ')

                          : (item.specific_data?.size ? `${item.specific_data?.garmentType || 'N/A'} (${item.specific_data.size})` : (item.specific_data?.garmentType || 'N/A'))}

                      </td>

                      <td><span style={{ fontSize: '0.9em', color: '#d32f2f' }}>{getDamageLevelSummary(item)}</span></td>

                      <td>{(() => {
                        const pickupDate = item.specific_data?.pickupDate || item.pricing_factors?.pickupDate;
                        if (!pickupDate) return 'N/A';
                        const date = new Date(pickupDate);
                        return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
                      })()}</td>

                      <td>₱{parseFloat(item.final_price || 0).toLocaleString()}</td>

                      <td>

                        <div style={{ fontSize: '12px' }}>

                          <div>Paid: ₱{amountPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>

                          <div style={{ color: remainingBalance > 0 ? '#ff9800' : '#4caf50', fontWeight: 'bold' }}>

                            Remaining: ₱{Math.max(0, remainingBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

                          </div>

                        </div>

                      </td>

                      <td
                        onClick={(e) => e.stopPropagation()}
                        style={isSecondaryMenuOpenForRow ? { position: 'relative', zIndex: 5002 } : undefined}
                      >

                        <span
                          className={`status-badge ${customerWantsToProceed ? getStatusClass(item.approval_status || 'pending') : isCompensatedIncident ? 'completed' : isDamagePendingIncident ? 'rejected' : isForCompensationIncident ? 'price-confirmation' : getStatusClass(item.approval_status || 'pending')}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            whiteSpace: 'nowrap',
                            fontSize: '11px',
                            lineHeight: '1',
                            padding: '3px 7px',
                            fontWeight: 600,
                            ...(!customerWantsToProceed && isCompensatedIncident ? {
                            backgroundColor: '#e8f5e9',
                            color: '#1b5e20',
                            border: '1px solid #a5d6a7'
                          } : isDamagePendingIncident ? {
                            backgroundColor: '#ffebee',
                            color: '#c62828',
                            border: '1px solid #ef9a9a'
                          } : isForCompensationIncident ? {
                            backgroundColor: '#fff8e1',
                            color: '#ef6c00',
                            border: '1px solid #ffcc80'
                          } : {})
                          }}
                        >
                          {customerWantsToProceed
                            ? getStatusText(item.approval_status || 'pending')
                            : isCompensatedIncident ? 'Compensated'
                            : isDamagePendingIncident ? 'Damage Reported'
                            : isForCompensationIncident ? 'For Compensation'
                            : getStatusText(item.approval_status || 'pending')}
                        </span>
                        {customerWantsToProceed && (
                          <div style={{ marginTop: '4px', fontSize: '11px', color: '#1b5e20', fontWeight: '600' }}>
                            📝 Note: Compensated
                          </div>
                        )}

                        {incident && !isDamagePendingIncident && (
                          <div style={{ marginTop: '6px', fontSize: '11px', color: '#444' }}>
                            Damage: {incident.liability_status}/{incident.compensation_status}
                          </div>
                        )}

                        {isDamagePendingIncident && (
                          <div style={{ marginTop: '6px', fontSize: '11px', color: '#b71c1c', fontWeight: '600' }}>
                            Awaiting liability decision
                          </div>
                        )}

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

                        {item.approval_status === 'accepted' && isReceivedByAdmin && (
                          <div style={{ marginTop: '4px', fontSize: '11px', color: '#1b5e20', fontWeight: '600' }}>
                            Note: Received
                          </div>
                        )}

                        {item.approval_status === 'picked_up' && (
                          <div style={{ marginTop: '4px', fontSize: '11px', color: '#1b5e20', fontWeight: '600' }}>
                            Note: Picked up
                          </div>
                        )}

                      </td>

                      <td onClick={(e) => e.stopPropagation()}>

                        {isDamagePendingIncident ? (
                          <div className="action-buttons">
                            <button
                              className="icon-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                openLiabilityModal(incident, 'approved');
                              }}
                              title="Approve Liability"
                              style={{ backgroundColor: '#2e7d32', color: 'white', border: '1px solid #1b5e20' }}
                            >
                              <i className="fas fa-circle-check"></i>
                            </button>

                            <button
                              className="icon-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                openLiabilityModal(incident, 'rejected');
                              }}
                              title="Reject Liability"
                              style={{ backgroundColor: '#c62828', color: 'white', border: '1px solid #8e0000' }}
                            >
                              <i className="fas fa-circle-xmark"></i>
                            </button>
                          </div>
                        ) : isForCompensationIncident ? (
                          <div className="action-buttons">
                            <button
                              className="icon-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                openSettlementModal(incident);
                              }}
                              title="Settle Compensation"
                              style={{ backgroundColor: '#8e24aa', color: 'white' }}
                            >
                              <i className="fas fa-hand-holding-usd"></i>
                            </button>
                          </div>
                        ) : isCompensatedIncident ? (
                          <div className="action-buttons">
                            {customerWantsToProceed && item.approval_status !== 'price_confirmation' && getNextStatus(item.approval_status, 'repair', item) && (
                              <button
                                className="icon-btn next-status"
                                onClick={() => updateStatus(item.item_id, getNextStatus(item.approval_status, 'repair', item))}
                                title={`Move to ${getNextStatusLabel(item.approval_status, 'repair', item)}`}
                                style={{ backgroundColor: '#4CAF50', color: 'white' }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="9 18 15 12 9 6"></polyline>
                                </svg>
                              </button>
                            )}
                            {customerWantsToProceed && item.approval_status !== 'completed' && item.approval_status !== 'cancelled' && !isEnhancementOrder && (
                              <button
                                className="icon-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedOrder(item);
                                  const fp = parseFloat(item.final_price || 0);
                                  const acceptedNextStatus = item.approval_status === 'accepted'
                                    ? getNextStatus(item.approval_status, 'repair', item)
                                    : '';
                                  setPaymentAmount((fp * 0.5).toFixed(2));
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
                            <button
                              className="icon-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                openSettlementModal(incident);
                              }}
                              title="View Settlement Details"
                              style={{ backgroundColor: '#1565c0', color: 'white', border: '1px solid #0d47a1' }}
                            >
                              <i className="fas fa-receipt"></i>
                            </button>
                            {renderSecondaryActionMenu({
                              menuId: `repair-${item.item_id}-compensated`,
                              showDelete: isAdminUser && !customerWantsToProceed,
                              onDelete: () => handleDeleteOrder(item)
                            })}
                          </div>
                        ) : item.approval_status === 'price_declined' ? (

                          <div className="action-buttons">
                            {renderSecondaryActionMenu({
                              menuId: `repair-${item.item_id}-price-declined`,
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

                            {item.approval_status === 'accepted' && !isDamagePendingIncident && !isForCompensationIncident && (
                              <button className="icon-btn decline" onClick={() => handleDecline(item.item_id)} title="Decline">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18"></line>
                                  <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                              </button>
                            )}

                            {!isDamagePendingIncident && !isForCompensationIncident && item.approval_status === 'price_confirmation' && (() => {
                              const haggleOffer = parseFloat(parseMaybeObject(item?.pricing_factors)?.haggleOffer || 0);
                              if (!Number.isFinite(haggleOffer) || haggleOffer <= 0) {
                                return null;
                              }

                              return (
                                <>
                                  <button
                                    className="icon-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openPriceConfirmationReviewModal(item);
                                    }}
                                    title={`View Haggle Offer (₱${haggleOffer.toFixed(2)})`}
                                    style={{ backgroundColor: '#3949ab', color: 'white' }}
                                  >
                                    <i className="fas fa-eye"></i>
                                  </button>
                                  <button
                                    className="icon-btn accept"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAcceptHagglePrice(item);
                                    }}
                                    title={`Accept Haggle ₱${haggleOffer.toFixed(2)}`}
                                    style={{ backgroundColor: '#2e7d32', color: 'white' }}
                                  >
                                    <i className="fas fa-circle-check"></i>
                                  </button>
                                </>
                              );
                            })()}

                            {!isDamagePendingIncident && !isForCompensationIncident && item.approval_status !== 'price_confirmation' && getNextStatus(item.approval_status, 'repair', item) && (() => {
                              const nextStatus = getNextStatus(item.approval_status, 'repair', item);
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
                                  title={`Move to ${getNextStatusLabel(item.approval_status, 'repair', item)}`}
                                  style={{ backgroundColor: '#4CAF50', color: 'white' }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="9 18 15 12 9 6"></polyline>
                                  </svg>
                                </button>
                              );
                            })()}

                            {!isDamagePendingIncident && !isForCompensationIncident && item.approval_status !== 'completed' && item.approval_status !== 'cancelled' && item.approval_status !== 'price_confirmation' && (

                              <>

                                {incident && incident.liability_status === 'pending' && (

                                  <button

                                    className="icon-btn"

                                    onClick={(e) => {

                                      e.stopPropagation();

                                      openLiabilityModal(incident, 'approved');

                                    }}

                                    title="Approve Liability"

                                    style={{ backgroundColor: '#2e7d32', color: 'white', border: '1px solid #1b5e20' }}

                                  >

                                    <i className="fas fa-circle-check"></i>

                                  </button>

                                )}

                                {incident && incident.liability_status === 'pending' && (

                                  <button

                                    className="icon-btn"

                                    onClick={(e) => {

                                      e.stopPropagation();

                                      openLiabilityModal(incident, 'rejected');

                                    }}

                                    title="Reject Liability"

                                    style={{ backgroundColor: '#c62828', color: 'white', border: '1px solid #8e0000' }}

                                  >

                                    <i className="fas fa-circle-xmark"></i>

                                  </button>

                                )}

                                

                                {incident && incident.liability_status === 'rejected' && (

                                  <button

                                    className="icon-btn"

                                    onClick={(e) => {

                                      e.stopPropagation();

                                      openLiabilityModal(incident, 'pending');

                                    }}

                                    title="Revise Compensation"

                                    style={{ backgroundColor: '#ef6c00', color: 'white', border: '1px solid #e65100' }}

                                  >

                                    <i className="fas fa-pen-to-square"></i>

                                  </button>

                                )}

                                {incident && incident.liability_status === 'approved' && incident.compensation_status === 'paid' && (

                                  <button

                                    className="icon-btn"

                                    onClick={(e) => {

                                      e.stopPropagation();

                                      openSettlementModal(incident);

                                    }}

                                    title="View Settlement Details"

                                    style={{ backgroundColor: '#1565c0', color: 'white', border: '1px solid #0d47a1', cursor: 'default' }}

                                  >

                                    <i className="fas fa-receipt"></i>

                                  </button>

                                )}

                                {(!isEnhancementOrder || (pricingFactors.accessoriesPrice && remainingBalance > 0.01)) && (
                                  <button
                                    className="icon-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedOrder(item);
                                      const finalPrice = parseFloat(item.final_price || 0);
                                      const halfPrice = (finalPrice * 0.5).toFixed(2);
                                      const acceptedNextStatus = item.approval_status === 'accepted'
                                        ? getNextStatus(item.approval_status, 'repair', item)
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

                              </>

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
                                menuId: `repair-${item.item_id}-secondary`,
                                showReportDamage: !isDamagePendingIncident && !isForCompensationIncident && item.approval_status !== 'completed' && item.approval_status !== 'cancelled' && item.approval_status !== 'price_confirmation',
                                showEditPrice: !isDamagePendingIncident && !isForCompensationIncident && item.approval_status !== 'completed' && item.approval_status !== 'cancelled' && item.approval_status !== 'price_confirmation' && item.approval_status === 'accepted' && item.order_type !== 'walk_in',
                                showDelete: (item.approval_status === 'completed' || item.approval_status === 'cancelled') && isAdminUser && !isCompensatedIncident && !isDamagePendingIncident && !isForCompensationIncident,
                                onReportDamage: () => openDamageReportModal(item),
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
                    <th>Damage Type</th>
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
                            <td>
                              {item.specific_data?.garments && item.specific_data.garments.length > 0
                                ? item.specific_data.garments.map((g) => formatGarmentWithSize(g)).join(', ')
                                : (item.specific_data?.size ? `${item.specific_data?.garmentType || 'N/A'} (${item.specific_data.size})` : (item.specific_data?.garmentType || 'N/A'))}
                            </td>
                            <td><span style={{ fontSize: '0.9em', color: '#d32f2f' }}>{getDamageLevelSummary(item)}</span></td>
                            <td>{(() => {
                              const pickupDate = item.specific_data?.pickupDate || item.pricing_factors?.pickupDate;
                              if (!pickupDate) return 'N/A';
                              return new Date(pickupDate).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
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
                    ⚠️ Customer requested to add accessories — price confirmation required.
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
                      'e.g. requested changes are not feasible with this repair scope',
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
                    if (result.success) { setShowEnhancementViewModal(false); showToast('Enhancement cancelled.', 'success'); loadRepairOrders(); }
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


      {showEditModal && selectedOrder && (

        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowEditModal(false)}>

          <div className="modal-content">

            <div className="modal-header">

              <h2>Edit Repair Order</h2>

              <span className="close-modal" onClick={() => setShowEditModal(false)}>×</span>

            </div>

            <div className="modal-body">

              <div className="detail-row"><strong>Order ID:</strong> #{selectedOrder.order_id}</div>

              <div className="detail-row"><strong>Garment:</strong> {selectedOrder.specific_data?.garmentType || 'N/A'}</div>

              <div className="detail-row"><strong>Size:</strong> {selectedOrder.specific_data?.size || 'N/A'}</div>

              <div className="detail-row"><strong>Service:</strong> {selectedOrder.specific_data?.serviceName || 'N/A'}</div>



              {/* Support multiple images */}

              {selectedOrder.specific_data?.imageUrls && selectedOrder.specific_data.imageUrls.length > 0 ? (

                <div className="detail-row">

                  <strong>Damage Images ({selectedOrder.specific_data.imageUrls.length}):</strong><br />

                  <div style={{ marginTop: '8px' }}>

                    <SimpleImageCarousel

                      images={selectedOrder.specific_data.imageUrls.map((url, idx) => ({ url: `${API_BASE_URL}${url}`, label: `Photo ${idx + 1}/${selectedOrder.specific_data.imageUrls.length}` }))}

                      itemName="Damage Photo"

                      height="280px"

                    />

                  </div>

                </div>

              ) : selectedOrder.specific_data?.imageUrl && (

                <div className="detail-row">

                  <strong>Damage Image:</strong><br />

                  <div

                    className="clickable-image"

                    style={{ cursor: 'pointer', display: 'inline-block', marginTop: '8px' }}

                    onClick={() => openImagePreview(`${API_BASE_URL}${selectedOrder.specific_data.imageUrl}`, 'Damage Image')}

                  >

                    <img

                      src={`${API_BASE_URL}${selectedOrder.specific_data.imageUrl}`}

                      alt="Damage"

                      style={{ maxWidth: '200px', maxHeight: '200px', border: '1px solid #ddd', borderRadius: '4px' }}

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

                    const currentPrice = parseFloat(selectedOrder.final_price || 0);



                    let newStatus = editForm.approvalStatus;

                    const isWalkIn = selectedOrder.order_type === 'walk_in';



                    if (newPrice && estimatedPrice && (editForm.approvalStatus === 'pending' || editForm.approvalStatus === 'accepted')) {

                      const priceChanged = Math.abs(parseFloat(newPrice) - estimatedPrice) > 0.01;

                      if (priceChanged) {



                        newStatus = isWalkIn ? 'accepted' : 'price_confirmation';

                      }

                    }



                    setEditForm({ ...editForm, finalPrice: newPrice, approvalStatus: newStatus });

                  }}

                  placeholder="Enter final price"

                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}

                />

                {(() => {

                  const estimatedPrice = getEstimatedPrice(selectedOrder);

                  const isWalkIn = selectedOrder.order_type === 'walk_in';

                  if (estimatedPrice && editForm.finalPrice) {

                    const priceDiff = parseFloat(editForm.finalPrice) - estimatedPrice;

                    if (Math.abs(priceDiff) > 0.01) {

                      return (

                        <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#fff3cd', borderRadius: '4px', fontSize: '0.9em' }}>

                          <strong>⚠️ Price Changed:</strong> Estimated: ₱{estimatedPrice.toFixed(2)} → New: ₱{parseFloat(editForm.finalPrice).toFixed(2)}

                          <br />

                          <span style={{ color: '#666', fontSize: '0.85em' }}>

                            {isWalkIn

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

                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}

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

                    value={editForm.estimatedCompletionDate || ''}

                    onChange={(e) => setEditForm({ ...editForm, estimatedCompletionDate: e.target.value })}

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

                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}

                />

              </div>

            </div>

            <div className="modal-footer">

              <button className="btn-cancel" onClick={() => setShowEditModal(false)}>Cancel</button>

              <button className="btn-save" onClick={handleSaveEdit}>Save Changes</button>

            </div>

          </div>

        </div>

      )}

      {showEnhanceModal && enhanceOrder && (

        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowEnhanceModal(false)}>

          <div className="modal-content enhance-order-modal" style={{ maxWidth: '640px', width: '95vw' }}>

            <div className="modal-header">

              <h2><i className="fas fa-tools" style={{ marginRight: '8px', color: '#8b4513' }}></i>Enhance Completed Repair</h2>

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

      {showDetailModal && selectedOrder && (

        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowDetailModal(false)}>

          <div className="modal-content">

            <div className="modal-header">

              <h2>Repair Order Details</h2>

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

              {selectedOrder.order_type === 'walk_in' && (

                <>

                  {selectedOrder.walk_in_customer_email && (

                    <div className="detail-row"><strong>Email:</strong> {selectedOrder.walk_in_customer_email}</div>

                  )}

                  {selectedOrder.walk_in_customer_phone && (

                    <div className="detail-row"><strong>Phone:</strong> {selectedOrder.walk_in_customer_phone}</div>

                  )}

                </>

              )}

              {/* Multiple garments support */}

              {selectedOrder.specific_data?.garments && selectedOrder.specific_data.garments.length > 0 ? (

                <>

                  <div className="detail-row"><strong>Garments:</strong> {selectedOrder.specific_data.garments.length} item{selectedOrder.specific_data.garments.length > 1 ? 's' : ''}</div>

                  {selectedOrder.specific_data.garments.map((garment, idx) => (

                    <div key={idx} style={{ marginLeft: '20px', paddingLeft: '10px', borderLeft: '2px solid #e0e0e0', marginBottom: '10px' }}>

                      <div className="detail-row"><strong>Garment #{idx + 1}:</strong> {garment.garmentType || 'N/A'}</div>

                      <div className="detail-row"><strong>Size:</strong> {garment.size || 'N/A'}</div>

                      <div className="detail-row"><strong>Damage Level:</strong> {garment.damageLevel ? garment.damageLevel.charAt(0).toUpperCase() + garment.damageLevel.slice(1) : 'N/A'}</div>

                      <div className="detail-row"><strong>Description:</strong> {garment.notes || 'N/A'}</div>

                      <div className="detail-row"><strong>Price:</strong> ₱{garment.basePrice || 'N/A'}</div>

                    </div>

                  ))}

                </>

              ) : (

                <>

                  <div className="detail-row"><strong>Garment:</strong> {selectedOrder.specific_data?.garmentType || 'N/A'}</div>

                  <div className="detail-row"><strong>Size:</strong> {selectedOrder.specific_data?.size || 'N/A'}</div>

                  <div className="detail-row"><strong>Service:</strong> {selectedOrder.specific_data?.serviceName || 'N/A'}</div>

                  <div className="detail-row"><strong>Damage Level:</strong> {selectedOrder.specific_data?.damageLevel || 'N/A'}</div>

                </>

              )}



              {/* Support multiple images */}

              {selectedOrder.specific_data?.imageUrls && selectedOrder.specific_data.imageUrls.length > 0 ? (

                <div className="detail-row">

                  <strong>Damage Images ({selectedOrder.specific_data.imageUrls.length}):</strong><br />

                  <div style={{ marginTop: '8px' }}>

                    <SimpleImageCarousel

                      images={selectedOrder.specific_data.imageUrls.map((url, idx) => ({ url: `${API_BASE_URL}${url}`, label: `Photo ${idx + 1}/${selectedOrder.specific_data.imageUrls.length}` }))}

                      itemName="Damage Photo"

                      height="300px"

                    />

                  </div>

                </div>

              ) : selectedOrder.specific_data?.imageUrl && (

                <div className="detail-row">

                  <strong>Damage Image:</strong><br />

                  <div

                    className="clickable-image"

                    style={{ cursor: 'pointer', display: 'inline-block', marginTop: '8px' }}

                    onClick={() => openImagePreview(`${API_BASE_URL}${selectedOrder.specific_data.imageUrl}`, 'Damage Image')}

                  >

                    <img

                      src={`${API_BASE_URL}${selectedOrder.specific_data.imageUrl}`}

                      alt="Damage"

                      style={{ maxWidth: '300px', maxHeight: '300px', border: '1px solid #ddd', borderRadius: '4px' }}

                    />

                    <small className="click-hint" style={{ display: 'block', fontSize: '11px', color: '#888', marginTop: '4px' }}>Click to expand</small>

                  </div>

                </div>

              )}

              <div className="detail-row"><strong>Preferred Date:</strong> {(() => {
                const pickupDate = selectedOrder.specific_data?.pickupDate || selectedOrder.pricing_factors?.pickupDate;
                if (!pickupDate) return 'N/A';
                const date = new Date(pickupDate);
                return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
              })()}</div>

              <div className="detail-row"><strong>Preferred Time:</strong> {(() => {
                const pickupDate = selectedOrder.specific_data?.pickupDate || selectedOrder.pricing_factors?.pickupDate;
                if (!pickupDate) return 'N/A';
                const timeStr = String(pickupDate).split('T')[1]?.slice(0, 5);
                if (!timeStr) return 'N/A';
                const [hours, minutes] = timeStr.split(':').map(Number);
                const period = hours >= 12 ? 'PM' : 'AM';
                const displayHours = hours % 12 || 12;
                return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
              })()}</div>

              <div className="detail-row"><strong>Estimated Time:</strong> {(() => {

                const pf = selectedOrder?.pricing_factors || {};

                const sd = selectedOrder?.specific_data || {};



                const savedEstimatedTime = pf.estimatedTime || pf.estimated_time || sd.estimatedTime || sd.estimated_time;

                if (savedEstimatedTime) return savedEstimatedTime;



                const completionDate =

                  detailEstimatedCompletionDate ||

                  pf.estimatedCompletionDate ||

                  pf.estimated_completion_date ||

                  sd.estimatedCompletionDate ||

                  sd.estimated_completion_date;



                if (!completionDate) return 'N/A';



                const parsedDate = new Date(completionDate);

                return Number.isNaN(parsedDate.getTime())

                  ? completionDate

                  : parsedDate.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });

              })()}</div>



              {(selectedOrder.approval_status === 'accepted' || selectedOrder.approval_status === 'confirmed') && (

                <div className="detail-row" style={{ alignItems: 'center', gap: '10px' }}>

                  <strong>Estimated Completion Date:</strong>

                  <input

                    type="date"

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

              <div className="detail-row"><strong>Repair Cost:</strong> ₱{parseFloat(selectedOrder.final_price || 0).toLocaleString()}</div>

              <div className="detail-row"><strong>Status:</strong>

                <span className={`status-badge ${getStatusClass(selectedOrder.approval_status || 'pending')}`}>

                  {getStatusText(selectedOrder.approval_status || 'pending')}

                </span>

              </div>

              {selectedOrder.approval_status === 'accepted' && (
                <div className="detail-row"><strong>Note:</strong> {(() => {
                  const isReceivedByAdmin = isOrderReceivedByAdmin(selectedOrder);
                  if (!isReceivedByAdmin) {
                    return 'Not yet received';
                  }
                  const receivedAt = getOrderReceivedAt(selectedOrder);
                  if (!receivedAt) {
                    return 'Received';
                  }
                  const parsedDate = new Date(receivedAt);
                  if (Number.isNaN(parsedDate.getTime())) {
                    return 'Received';
                  }
                  return `Received (${parsedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })})`;
                })()}</div>
              )}



              {selectedOrder.pricing_factors?.adminNotes && (

                <div className="detail-row"><strong>Admin Notes:</strong> {selectedOrder.pricing_factors.adminNotes}</div>

              )}

              {(() => {
                const incident = getIncidentForItem(selectedOrder.item_id);
                if (!incident) return null;
                return (
                  <>
                    <div className="detail-row"><strong>Damage Incident:</strong> {incident.damage_type}</div>
                    <div className="detail-row"><strong>Liability:</strong> {incident.liability_status}</div>
                    {incident.compensation_type === 'clothe' ? (
                      <div className="detail-row"><strong>Compensation:</strong> 👕 Clothe — {incident.clothe_description || 'Replacement garment'}</div>
                    ) : incident.compensation_type === 'both' ? (
                      <>
                        <div className="detail-row"><strong>Money Option:</strong> ₱{parseFloat(incident.compensation_amount || 0).toLocaleString()}</div>
                        <div className="detail-row"><strong>Clothe Option:</strong> 👕 {incident.clothe_description || 'Replacement garment'}</div>
                        {incident.customer_compensation_choice && (
                          <div className="detail-row"><strong>Customer Chose:</strong> {incident.customer_compensation_choice === 'clothe' ? '👕 Clothe' : '💵 Money'}</div>
                        )}
                      </>
                    ) : (
                      <div className="detail-row"><strong>Compensation:</strong> ₱{parseFloat(incident.compensation_amount || 0).toLocaleString()}</div>
                    )}
                    <div className="detail-row"><strong>Compensation Status:</strong> {incident.compensation_status}</div>
                    {incident.customer_proceed_choice && (
                      <div className="detail-row"><strong>Order Proceed:</strong> {incident.customer_proceed_choice === 'proceed' ? '✅ Proceed' : '❌ Don\'t proceed'}</div>
                    )}
                  </>
                );
              })()}

            </div>

            <div className="modal-footer">

              {selectedOrder.approval_status === 'accepted' && (
                <button
                  className="btn-receive"
                  onClick={handleMarkOrderReceived}
                  disabled={markingOrderReceived || isOrderReceivedByAdmin(selectedOrder)}
                  style={(markingOrderReceived || isOrderReceivedByAdmin(selectedOrder)) ? { opacity: 0.7, cursor: 'not-allowed' } : undefined}
                >
                  {isOrderReceivedByAdmin(selectedOrder) ? 'Received' : (markingOrderReceived ? 'Receiving...' : 'Receive')}
                </button>
              )}

              <button className="close-btn" onClick={() => setShowDetailModal(false)}>Close</button>

            </div>

          </div>

        </div>

      )}

      <ImagePreviewModal

        isOpen={imagePreviewOpen}

        imageUrl={previewImageUrl}

        altText={previewImageAlt}

        onClose={closeImagePreview}

      />

      {showRepairGarmentTypeModal && (

        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowRepairGarmentTypeModal(false)}>

          <div className="modal-content" style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>

            <div className="modal-header">

              <h2>{editingRepairGarmentType ? 'Edit Repair Garment Type' : 'Add Repair Garment Type'}</h2>

              <span className="close-modal" onClick={() => {

                setShowRepairGarmentTypeModal(false);

                setEditingRepairGarmentType(null);

                setRepairGarmentTypeForm({

                  garment_name: '',

                  description: '',

                  has_damage_levels: 1,

                  default_damage_level_id: null,

                  damage_levels: [createEmptyDamageLevel(1)],

                  is_active: 1

                });

              }}>×</span>

            </div>



            <div className="repair-modal-body">

              <div className="repair-form-group">

                <label>Garment Name *</label>

                <input

                  type="text"

                  value={repairGarmentTypeForm.garment_name}

                  onChange={(e) => setRepairGarmentTypeForm({ ...repairGarmentTypeForm, garment_name: e.target.value })}

                  placeholder="e.g., Shirt, Pants, Jacket, Coat, Dress, Suit"

                />

              </div>



              <div className="repair-form-group">

                <label>Description</label>

                <textarea

                  value={repairGarmentTypeForm.description}

                  onChange={(e) => setRepairGarmentTypeForm({ ...repairGarmentTypeForm, description: e.target.value })}

                  placeholder="Optional description..."

                  rows={3}

                />

              </div>



              <div className="repair-form-group">

                <label>Damage Levels *</label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

                  {(repairGarmentTypeForm.damage_levels || []).map((level, index) => (

                    <div key={`damage-level-${index}`} style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '12px', background: '#fafafa' }}>

                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '8px', alignItems: 'center' }}>

                        <input

                          type="text"

                          value={level.level_name}

                          onChange={(e) => updateDamageLevelRow(index, 'level_name', e.target.value)}

                          placeholder="Level name (e.g. Minor Localized Damage)"

                        />

                        <input

                          type="number"

                          value={level.base_price}

                          onChange={(e) => updateDamageLevelRow(index, 'base_price', e.target.value)}

                          placeholder="Price"

                          min="0"

                          step="0.01"

                        />

                        <button

                          type="button"

                          onClick={() => removeDamageLevelRow(index)}

                          className="repair-garment-delete-btn"

                          style={{ whiteSpace: 'nowrap' }}

                        >

                          Remove

                        </button>

                      </div>

                      <textarea

                        value={level.level_description}

                        onChange={(e) => updateDamageLevelRow(index, 'level_description', e.target.value)}

                        placeholder="Description (optional)"

                        rows={2}

                        style={{ marginTop: '8px' }}

                      />

                    </div>

                  ))}

                  <button

                    type="button"

                    onClick={addDamageLevelRow}

                    style={{ alignSelf: 'flex-start', padding: '6px 12px', borderRadius: '6px', border: '1px solid #2196f3', color: '#2196f3', background: '#fff', cursor: 'pointer' }}

                  >

                    + Add Damage Level

                  </button>

                </div>

              </div>



              <div className="repair-form-group">

                <label>

                  <input

                    type="checkbox"

                    checked={repairGarmentTypeForm.is_active === 1}

                    onChange={(e) => setRepairGarmentTypeForm({ ...repairGarmentTypeForm, is_active: e.target.checked ? 1 : 0 })}

                  />

                  Active (Show in dropdowns)

                </label>

              </div>

              {repairGarmentTypes.length > 0 && (

                <div className="repair-types-list-header">

                  <h3>Existing Repair Garment Types ({repairGarmentTypes.length})</h3>

                  <div className="repair-types-scrollable">

                    {repairGarmentTypes.map(garment => (

                      <div

                        key={garment.repair_garment_id}

                        className={`repair-item-card ${garment.is_active ? 'active' : 'inactive'}`}

                      >

                        <div className="repair-item-info">

                          <div className="repair-item-name">{garment.garment_name}</div>

                          <div className="repair-item-details">

                            {garment.description && `${garment.description}`}

                            {!garment.is_active && <span className="inactive-badge">(Inactive)</span>}

                          </div>

                          {Array.isArray(garment.damage_levels) && garment.damage_levels.length > 0 && (

                            <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>

                              {garment.damage_levels

                                .sort((a, b) => (parseInt(a.sort_order, 10) || 0) - (parseInt(b.sort_order, 10) || 0))

                                .map((level) => (

                                  <span

                                    key={level.repair_damage_level_id || `${garment.repair_garment_id}-${level.level_name}`}

                                    style={{

                                      fontSize: '11px',

                                      fontWeight: 600,

                                      padding: '4px 8px',

                                      borderRadius: '999px',

                                      background: Number(level.is_active) === 1 ? '#e3f2fd' : '#f5f5f5',

                                      color: Number(level.is_active) === 1 ? '#1565c0' : '#888'

                                    }}

                                  >

                                    {level.level_name}: ₱{parseFloat(level.base_price || 0).toFixed(2)}

                                  </span>

                                ))}

                            </div>

                          )}

                        </div>

                        <div className="repair-item-actions">

                          <button

                            onClick={() => openEditRepairGarmentType(garment)}

                            className="repair-garment-edit-btn"

                          >

                            Edit

                          </button>

                          <button

                            onClick={() => handleDeleteRepairGarmentType(garment.repair_garment_id)}

                            className="repair-garment-delete-btn"

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



            <div className="repair-modal-footer">

              <button className="repair-btn-cancel" onClick={() => {

                setShowRepairGarmentTypeModal(false);

                setEditingRepairGarmentType(null);

                setRepairGarmentTypeForm({

                  garment_name: '',

                  description: '',

                  has_damage_levels: 1,

                  default_damage_level_id: null,

                  damage_levels: [createEmptyDamageLevel(1)],

                  is_active: 1

                });

              }}>Cancel</button>

              <button

                className="repair-btn-submit"

                onClick={handleRepairGarmentTypeSubmit}

                disabled={!repairGarmentTypeForm.garment_name.trim()}

              >

                {editingRepairGarmentType ? 'Update' : 'Create'}

              </button>

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

              {/* Multiple garments support */}
              {priceConfirmationItem.specific_data?.garments && priceConfirmationItem.specific_data.garments.length > 0 ? (
                <>
                  <div className="detail-row"><strong>Garments:</strong> {priceConfirmationItem.specific_data.garments.length} item{priceConfirmationItem.specific_data.garments.length > 1 ? 's' : ''}</div>
                  {priceConfirmationItem.specific_data.garments.map((garment, idx) => (
                    <div key={idx} style={{ marginLeft: '20px', paddingLeft: '10px', borderLeft: '2px solid #e0e0e0', marginBottom: '10px' }}>
                      <div className="detail-row"><strong>Garment #{idx + 1}:</strong> {garment.garmentType || 'N/A'}</div>
                      <div className="detail-row"><strong>Size:</strong> {garment.size || 'N/A'}</div>
                      <div className="detail-row"><strong>Damage Level:</strong> {garment.damageLevel ? garment.damageLevel.charAt(0).toUpperCase() + garment.damageLevel.slice(1) : 'N/A'}</div>
                      <div className="detail-row"><strong>Description:</strong> {garment.notes || 'N/A'}</div>
                      <div className="detail-row"><strong>Price:</strong> ₱{garment.basePrice || 'N/A'}</div>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div className="detail-row"><strong>Garment Type:</strong> {priceConfirmationItem.specific_data?.garmentType || 'N/A'}</div>
                  <div className="detail-row"><strong>Size:</strong> {priceConfirmationItem.specific_data?.size || 'N/A'}</div>
                  <div className="detail-row"><strong>Damage Level:</strong> {priceConfirmationItem.specific_data?.damageLevel || 'N/A'}</div>
                </>
              )}



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

                {(() => {
                  const pricingFactors = getPricingFactorsFromItem(priceConfirmationItem);
                  const haggleOffer = parseFloat(pricingFactors.haggleOffer || 0);
                  if (!Number.isFinite(haggleOffer) || haggleOffer <= 0) {
                    return null;
                  }

                  return (
                    <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#f7f2ed', borderRadius: '6px', border: '1px solid rgba(139, 69, 19, 0.28)' }}>
                      <div style={{ fontWeight: 700, color: 'rgb(139, 69, 19)' }}>Customer Haggle Offer</div>
                      <div style={{ marginTop: '4px', color: '#5b3a1f' }}>₱{haggleOffer.toFixed(2)}</div>
                      <div style={{ marginTop: '8px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
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

              </div>



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

                <span>Repair - {selectedOrder.specific_data?.serviceName || 'N/A'}</span>

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



              {selectedOrder.approval_status === 'accepted' && getNextStatus(selectedOrder.approval_status, 'repair', selectedOrder) && (
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
                          const nextStatus = getNextStatus(selectedOrder.approval_status, 'repair', selectedOrder);
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

              {selectedOrder.approval_status === 'accepted' && paymentOption === 'no_downpayment' && getNextStatus(selectedOrder.approval_status, 'repair', selectedOrder) && (
                <div className="payment-form-group">
                  <label>Move To *</label>
                  <select
                    value={moveToStatusOnNoDownpayment}
                    onChange={(e) => setMoveToStatusOnNoDownpayment(e.target.value)}
                    className="form-control"
                  >
                    <option value="">Select status</option>
                    <option value={getNextStatus(selectedOrder.approval_status, 'repair', selectedOrder)}>
                      {getNextStatusLabel(selectedOrder.approval_status, 'repair', selectedOrder)}
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

      {showDamageReportModal && damageTargetItem && (
        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowDamageReportModal(false)}>
          <div className="modal-content damage-compensation-modal" style={{ maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', textAlign: 'left' }}>
            <div className="modal-header">
              <h2><i className="fas fa-triangle-exclamation" style={{ marginRight: '8px' }}></i>Report Dispute</h2>
              <span className="close-modal" onClick={() => setShowDamageReportModal(false)}>×</span>
            </div>
            <div className="modal-body damage-compensation-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
              <div
                className="incident-detail-card"
                style={{
                  width: '100%',
                  gridColumn: '1 / -1',
                  border: 'none',
                  borderRadius: 0,
                  padding: 0,
                  background: 'transparent'
                }}
              >
                <div className="incident-detail-item"><span className="incident-detail-label">Order ID</span><span className="incident-detail-value">#{damageTargetItem.order_id || 'N/A'}</span></div>
                <div className="incident-detail-item"><span className="incident-detail-label">Order Item ID</span><span className="incident-detail-value">#{damageTargetItem.item_id || 'N/A'}</span></div>
                <div className="incident-detail-item"><span className="incident-detail-label">Customer Name</span><span className="incident-detail-value">{getCustomerNameFromItem(damageTargetItem)}</span></div>
                <div className="incident-detail-item"><span className="incident-detail-label">Order Type</span><span className="incident-detail-value">{damageTargetItem.order_type === 'walk_in' ? 'Walk-in' : 'Online'}</span></div>
                <div className="incident-detail-item"><span className="incident-detail-label">Garment</span><span className="incident-detail-value">{Array.isArray(damageTargetItem.specific_data?.garments) && damageTargetItem.specific_data.garments.length > 0 ? damageTargetItem.specific_data.garments.map((g) => formatGarmentWithSize(g)).join(', ') : (damageTargetItem.specific_data?.size ? `${damageTargetItem.specific_data?.garmentType || 'N/A'} (${damageTargetItem.specific_data.size})` : (damageTargetItem.specific_data?.garmentType || 'N/A'))}</span></div>
                <div className="incident-detail-item"><span className="incident-detail-label">Service</span><span className="incident-detail-value">{damageTargetItem.specific_data?.serviceName || 'N/A'}</span></div>
                <div className="incident-detail-item"><span className="incident-detail-label">Status</span><span className="incident-detail-value">{(damageTargetItem.approval_status || 'N/A').toString().replace(/_/g, ' ')}</span></div>
              </div>

              <div className="payment-form-group" style={{ marginTop: 0, width: '100%', gridColumn: '1 / -1' }}>
                <label>Damage Type *</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  placeholder="e.g. Stain, Tear, Shrinkage"
                  value={damageForm.damageType}
                  onChange={(e) => setDamageForm({ ...damageForm, damageType: e.target.value })}
                />
              </div>

              <div className="payment-form-group" style={{ marginTop: 0, width: '100%', gridColumn: '1 / -1' }}>
                <label>Damage Description</label>
                <textarea
                  rows={3}
                  className="form-control"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  placeholder="Describe the issue"
                  value={damageForm.damageDescription}
                  onChange={(e) => setDamageForm({ ...damageForm, damageDescription: e.target.value })}
                />
              </div>

              <div className="payment-form-group" style={{ marginTop: 0, width: '100%', gridColumn: '1 / -1' }}>
                <label>Affected Garments *</label>
                <div className="affected-garments-box" style={{
                  border: '1px solid #d7deea',
                  borderRadius: '10px',
                  padding: '8px',
                  backgroundColor: '#f8faff',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {(() => {
                    try {
                      const specificData = typeof damageTargetItem?.specific_data === 'string'
                        ? JSON.parse(damageTargetItem.specific_data)
                        : (damageTargetItem?.specific_data || {});
                      let garments = Array.isArray(specificData?.garments) ? specificData.garments : [];

                      // Walk-in repair orders can store a single garment in specific_data.garmentType.
                      if (!garments.length && specificData?.garmentType) {
                        const pricingFactors = typeof damageTargetItem?.pricing_factors === 'string'
                          ? JSON.parse(damageTargetItem.pricing_factors || '{}')
                          : (damageTargetItem?.pricing_factors || {});
                        const fallbackQtyRaw = parseInt(specificData?.quantity || pricingFactors?.quantity || 1, 10);
                        const fallbackQty = Number.isInteger(fallbackQtyRaw) && fallbackQtyRaw > 0 ? fallbackQtyRaw : 1;
                        garments = [{
                          garmentType: specificData.garmentType,
                          size: specificData.size || '',
                          quantity: fallbackQty
                        }];
                      }

                      if (!garments.length) {
                        return <div style={{ padding: '10px', color: '#999' }}>No garments in this order</div>;
                      }

                      return garments.map((garment, idx) => {
                        const garmentType = garment?.garmentType || garment?.garment_type || `Garment ${idx + 1}`;
                        const garmentDisplay = garment?.size ? `${garmentType} (${garment.size})` : garmentType;
                        const garmentQtyRaw = parseInt(garment?.quantity || 1, 10);
                        const garmentQty = Number.isInteger(garmentQtyRaw) && garmentQtyRaw > 0 ? garmentQtyRaw : 1;
                        const isChecked = damageForm.affectedGarments.some((ag) => ag.garmentType === garmentDisplay);
                        const affectedGarment = damageForm.affectedGarments.find((ag) => ag.garmentType === garmentDisplay);
                        const damagedQty = affectedGarment?.damagedQty || 1;

                        return (
                          <div key={idx} className="affected-garment-row" style={{
                            padding: '10px 12px',
                            borderBottom: idx < garments.length - 1 ? '1px solid #e8edf6' : 'none',
                            borderRadius: '6px'
                          }}>
                            <div className="affected-garment-main">
                              <input
                                className="affected-garment-checkbox"
                                type="checkbox"
                                id={`repair-garment-${idx}`}
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    const nextAffectedGarments = [...damageForm.affectedGarments, { garmentType: garmentDisplay, damagedQty: 1 }];
                                    const nextDamagedQty = nextAffectedGarments.reduce((sum, ag) => sum + (parseInt(ag.damagedQty || 0, 10) || 0), 0);
                                    setDamageForm({
                                      ...damageForm,
                                      affectedGarments: nextAffectedGarments,
                                      damagedQuantity: String(Math.max(1, nextDamagedQty))
                                    });
                                  } else {
                                    const nextAffectedGarments = damageForm.affectedGarments.filter((ag) => ag.garmentType !== garmentDisplay);
                                    const nextDamagedQty = nextAffectedGarments.reduce((sum, ag) => sum + (parseInt(ag.damagedQty || 0, 10) || 0), 0);
                                    setDamageForm({
                                      ...damageForm,
                                      affectedGarments: nextAffectedGarments,
                                      damagedQuantity: String(Math.max(1, nextDamagedQty))
                                    });
                                  }
                                }}
                              />
                              <label className="affected-garment-name" htmlFor={`repair-garment-${idx}`}>
                                {garmentDisplay} (qty: {garmentQty})
                              </label>
                            </div>
                            {isChecked && (
                              <div className="affected-garment-damaged" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <label style={{ fontSize: '12px', margin: 0, color: '#51607d', fontWeight: 600 }}>Damaged</label>
                                <input
                                  className="affected-garment-qty-input"
                                  type="number"
                                  min="1"
                                  max={garmentQty}
                                  step="1"
                                  value={damagedQty}
                                  onChange={(e) => {
                                    const newQty = parseInt(e.target.value || '1', 10);
                                    if (newQty >= 1 && newQty <= garmentQty) {
                                      const nextAffectedGarments = damageForm.affectedGarments.map((ag) =>
                                        ag.garmentType === garmentDisplay ? { ...ag, damagedQty: newQty } : ag
                                      );
                                      const nextDamagedQty = nextAffectedGarments.reduce((sum, ag) => sum + (parseInt(ag.damagedQty || 0, 10) || 0), 0);
                                      setDamageForm({
                                        ...damageForm,
                                        affectedGarments: nextAffectedGarments,
                                        damagedQuantity: String(Math.max(1, nextDamagedQty))
                                      });
                                    }
                                  }}
                                  style={{
                                    padding: '6px 8px',
                                    border: '1px solid #c7d2e5',
                                    borderRadius: '6px',
                                    fontWeight: 600,
                                    color: '#1f2a44'
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      });
                    } catch (error) {
                      return <div style={{ padding: '10px', color: '#d32f2f' }}>Error loading garments</div>;
                    }
                  })()}
                </div>
                {damageForm.affectedGarments.length === 0 && (
                  <div style={{ fontSize: '12px', color: '#d32f2f', marginTop: '5px' }}>
                    At least one garment must be selected
                  </div>
                )}
              </div>

              <div className="payment-form-group" style={{ marginTop: 0, width: '100%', gridColumn: '1 / -1' }}>
                <label>Dispute Image</label>
                <input
                  type="file"
                  className="form-control"
                  accept="image/*"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setDisputeImageFile(file);
                  }}
                />
                <div style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>
                  Optional. Upload a photo as evidence for this dispute.
                </div>
                {disputeImageFile && (
                  <div style={{ marginTop: '6px', fontSize: '12px', color: '#1f2a44' }}>
                    Selected: {disputeImageFile.name}
                  </div>
                )}
              </div>

              <div className="payment-form-group" style={{ marginTop: 0, width: '100%', gridColumn: '1 / -1' }}>
                <label>Total Quantity in this item</label>
                <input
                  type="number"
                  className="form-control"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  min="1"
                  step="1"
                  value={damageForm.totalQuantity}
                  onChange={(e) => setDamageForm({ ...damageForm, totalQuantity: e.target.value })}
                />
              </div>

              <div className="payment-form-group" style={{ marginTop: 0, width: '100%', gridColumn: '1 / -1' }}>
                <label>Damaged Quantity *</label>
                <input
                  type="number"
                  className="form-control"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  min="1"
                  step="1"
                  max={Math.max(1, parseInt(damageForm.totalQuantity || '1', 10) || 1)}
                  value={damageForm.damagedQuantity}
                  onChange={(e) => setDamageForm({ ...damageForm, damagedQuantity: e.target.value })}
                />
              </div>

              <div className="payment-form-group" style={{ marginTop: 0, width: '100%', gridColumn: '1 / -1' }}>
                <label>Responsible Staff/Admin</label>
                <select
                  className="form-control"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  value={damageForm.responsibleParty}
                  disabled={loadingClerkOptions}
                  onChange={(e) => setDamageForm({ ...damageForm, responsibleParty: e.target.value })}
                >
                  <option value="">{loadingClerkOptions ? 'Loading clerks...' : 'Select clerk...'}</option>
                  {clerkOptions.map((clerk) => {
                    const clerkName = getClerkDisplayName(clerk);
                    return (
                      <option key={clerk.user_id} value={clerkName}>
                        {clerkName}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="payment-form-group" style={{ marginTop: 0, width: '100%', gridColumn: '1 / -1' }}>
                <label>Compensation Type *</label>
                <div className="compensation-type-options" style={{ marginTop: '6px' }}>
                  <label className="compensation-type-option" style={{ cursor: 'pointer' }}>
                    <input
                      className="compensation-type-checkbox"
                      type="checkbox"
                      value="money"
                      checked={damageForm.compensationType === 'money' || damageForm.compensationType === 'both'}
                      onChange={(e) => {
                        const current = damageForm.compensationType || '';
                        const nextType = e.target.checked
                          ? (current === 'clothe' || current === 'both' ? 'both' : 'money')
                          : (current === 'both' ? 'clothe' : '');
                        setDamageForm({ ...damageForm, compensationType: nextType });
                      }}
                    />
                    <span>Compensation</span>
                  </label>
                  <label className="compensation-type-option" style={{ cursor: 'pointer' }}>
                    <input
                      className="compensation-type-checkbox"
                      type="checkbox"
                      value="clothe"
                      checked={damageForm.compensationType === 'clothe' || damageForm.compensationType === 'both'}
                      onChange={(e) => {
                        const current = damageForm.compensationType || '';
                        const nextType = e.target.checked
                          ? (current === 'money' || current === 'both' ? 'both' : 'clothe')
                          : (current === 'both' ? 'money' : '');
                        setDamageForm({ ...damageForm, compensationType: nextType });
                      }}
                    />
                    <span>Replacement</span>
                  </label>
                </div>
              </div>

              {(damageForm.compensationType === 'money' || damageForm.compensationType === 'both') && (
                <div className="payment-form-group" style={{ marginTop: 0, width: '100%', gridColumn: '1 / -1' }}>
                  <label>Compensation Amount (PHP)</label>
                  <input
                    type="number"
                    className="form-control"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    min="0"
                    step="0.01"
                    placeholder="Enter amount"
                    value={damageForm.compensationAmount}
                    onChange={(e) => setDamageForm({ ...damageForm, compensationAmount: e.target.value })}
                  />
                </div>
              )}

              {(damageForm.compensationType === 'clothe' || damageForm.compensationType === 'both') && (
                <div className="payment-form-group" style={{ marginTop: 0, width: '100%', gridColumn: '1 / -1' }}>
                  <label>Clothe Compensation Description</label>
                  <textarea
                    rows={3}
                    className="form-control"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="Describe the replacement clothe (e.g. same jacket, size M, black)."
                    value={damageForm.clotheDescription}
                    onChange={(e) => setDamageForm({ ...damageForm, clotheDescription: e.target.value })}
                  />
                </div>
              )}
              <div style={{ fontSize: '12px', color: '#666', gridColumn: '1 / -1' }}>
                ℹ️ Select one or both compensation types for this damage report.
              </div>
            </div>
            <div className="modal-footer-centered" style={{ justifyContent: 'flex-end' }}>
              <button className="btn-cancel" onClick={() => { setShowDamageReportModal(false); setDisputeImageFile(null); }}>Cancel</button>
              <button className="btn-save" onClick={handleReportDamage}>Save Incident</button>
            </div>
          </div>
        </div>
      )}

      {showLiabilityModal && activeDamageIncident && (
        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowLiabilityModal(false)}>
          <div className="modal-content damage-compensation-modal" style={{ maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', textAlign: 'left' }}>
            <div className="modal-header">
              <h2><i className="fas fa-balance-scale" style={{ marginRight: '8px' }}></i>Liability Decision</h2>
              <span className="close-modal" onClick={() => setShowLiabilityModal(false)}>×</span>
            </div>
            <div className="modal-body damage-compensation-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
              <div className="detail-row"><strong>Damage Type:</strong> {activeDamageIncident.damage_type}</div>

              <div className="payment-form-group" style={{ marginTop: 0 }}>
                <label>Decision *</label>
                <select
                  className="form-control"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  value={liabilityForm.decision}
                  onChange={(e) => setLiabilityForm({ ...liabilityForm, decision: e.target.value })}
                >
                  <option value="pending">Set to Pending (Ask Customer Again)</option>
                  <option value="approved">Approve Liability</option>
                  <option value="rejected">Reject Liability</option>
                </select>
              </div>

              <div className="payment-form-group" style={{ marginTop: 0 }}>
                <label>Compensation Amount (PHP)</label>
                <input
                  type="number"
                  className="form-control"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  min="0"
                  step="0.01"
                  placeholder="Leave 0 if not offering money"
                  value={liabilityForm.compensationAmount}
                  onChange={(e) => setLiabilityForm({ ...liabilityForm, compensationAmount: e.target.value })}
                />
              </div>

              <div className="payment-form-group" style={{ marginTop: 0 }}>
                <label>Clothe Compensation Description</label>
                <textarea
                  rows={3}
                  className="form-control"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  placeholder="Describe the replacement clothe. Leave blank if not offering clothe."
                  value={liabilityForm.clotheDescription}
                  onChange={(e) => setLiabilityForm({ ...liabilityForm, clotheDescription: e.target.value })}
                />
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                ℹ️ Fill in one or both options. The customer will choose which compensation they prefer.
              </div>

              <div className="payment-form-group" style={{ marginTop: 0 }}>
                <label>Notes</label>
                <textarea
                  rows={3}
                  className="form-control"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  value={liabilityForm.notes}
                  onChange={(e) => setLiabilityForm({ ...liabilityForm, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer-centered" style={{ justifyContent: 'flex-end' }}>
              <button className="btn-cancel" onClick={() => setShowLiabilityModal(false)}>Cancel</button>
              <button className="btn-save" onClick={handleLiabilityDecision}>Apply Decision</button>
            </div>
          </div>
        </div>
      )}

      {showSettlementModal && activeDamageIncident && (
        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowSettlementModal(false)}>
          <div className="modal-content damage-compensation-modal" style={{ maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', textAlign: 'left' }}>
            <div className="modal-header">
              <h2>
                {activeDamageIncident.compensation_status === 'paid' ? 'Settlement Details' : 'Settle Compensation'}
              </h2>
              <span className="close-modal" onClick={() => setShowSettlementModal(false)}>×</span>
            </div>
            <div className="modal-body damage-compensation-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
              <div className="detail-row"><strong>Incident:</strong> {activeDamageIncident.damage_type}</div>
              {activeDamageIncident.compensation_type === 'clothe' ? (
                <div className="detail-row"><strong>Compensation:</strong> Clothe - {activeDamageIncident.clothe_description || 'Replacement garment'}</div>
              ) : activeDamageIncident.compensation_type === 'both' ? (
                <>
                  <div className="detail-row"><strong>Money Option:</strong> ₱{parseFloat(activeDamageIncident.compensation_amount || 0).toLocaleString()}</div>
                  <div className="detail-row"><strong>Clothe Option:</strong> {activeDamageIncident.clothe_description || 'Replacement garment'}</div>
                  {activeDamageIncident.customer_compensation_choice && (
                    <div className="detail-row"><strong>Customer Chose:</strong> {activeDamageIncident.customer_compensation_choice === 'clothe' ? 'Clothe' : 'Money - ₱' + parseFloat(activeDamageIncident.compensation_amount || 0).toLocaleString()}</div>
                  )}
                </>
              ) : (
                <div className="detail-row"><strong>Amount:</strong> ₱{parseFloat(activeDamageIncident.compensation_amount || 0).toLocaleString()}</div>
              )}
              {activeDamageIncident.customer_proceed_choice && (
                <div className="detail-row"><strong>Order Proceed:</strong> {activeDamageIncident.customer_proceed_choice === 'proceed' ? 'Proceed' : 'Don\'t proceed'}</div>
              )}

              {activeDamageIncident.compensation_status === 'paid' ? (
                <>
                  <div className="detail-row"><strong>Payment Reference:</strong> {activeDamageIncident.payment_reference || 'N/A'}</div>
                  {activeDamageIncident.refund_amount > 0 && (
                    <div className="detail-row"><strong>Refund Amount:</strong> ₱{parseFloat(activeDamageIncident.refund_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                  )}
                  <div className="detail-row"><strong>Paid At:</strong> {activeDamageIncident.compensation_paid_at ? new Date(activeDamageIncident.compensation_paid_at).toLocaleString() : 'N/A'}</div>
                </>
              ) : (
                <>
                  {(() => {
                    const item = allItems.find(i => Number(i.item_id) === Number(activeDamageIncident.order_item_id));
                    const isWalkIn = item?.order_type === 'walk_in';
                    if (!isWalkIn) return null;

                    return (
                      <>
                        <div className="payment-form-group">
                          <label>Customer Compensation Choice *</label>
                          <select
                            className="form-control"
                            style={{ width: '100%', boxSizing: 'border-box' }}
                            value={settlementForm.customerCompensationChoice}
                            onChange={(e) => setSettlementForm({ ...settlementForm, customerCompensationChoice: e.target.value })}
                          >
                            <option value="">Select choice</option>
                            <option value="money">Money</option>
                            <option value="clothe">Clothe</option>
                          </select>
                        </div>

                        <div className="payment-form-group">
                          <label>Order Proceed Choice *</label>
                          <select
                            className="form-control"
                            style={{ width: '100%', boxSizing: 'border-box' }}
                            value={settlementForm.customerProceedChoice}
                            onChange={(e) => setSettlementForm({ ...settlementForm, customerProceedChoice: e.target.value })}
                          >
                            <option value="">Select choice</option>
                            <option value="proceed">Proceed</option>
                            <option value="dont_proceed">Don't proceed</option>
                          </select>
                        </div>
                      </>
                    );
                  })()}

                  <div className="payment-form-group" style={{ marginTop: 0 }}>
                    <label>Payment Reference</label>
                    <input
                      type="text"
                      className="form-control"
                      style={{ width: '100%', boxSizing: 'border-box' }}
                      placeholder="Receipt number or reference"
                      value={settlementForm.paymentReference}
                      onChange={(e) => setSettlementForm({ ...settlementForm, paymentReference: e.target.value })}
                    />
                  </div>
                  <div className="payment-form-group" style={{ marginTop: 0 }}>
                    <label>Refund Amount (PHP) <span style={{ fontSize: '11px', color: '#888', fontWeight: 'normal' }}>(optional — if customer is owed a refund)</span></label>
                    {(() => {
                      const item = allItems.find(i => Number(i.item_id) === Number(activeDamageIncident.order_item_id));
                      const pf = typeof item?.pricing_factors === 'string' ? JSON.parse(item?.pricing_factors || '{}') : (item?.pricing_factors || {});
                      const servicePaid = parseFloat(pf.amount_paid || 0);
                      const compensationAmt = parseFloat(activeDamageIncident.compensation_amount || 0);
                      const isDontProceed = activeDamageIncident.customer_proceed_choice === 'dont_proceed';
                      const isMoneyComp = activeDamageIncident.customer_compensation_choice === 'money' || activeDamageIncident.compensation_type === 'money';
                      if (isDontProceed && isMoneyComp && (servicePaid > 0 || compensationAmt > 0)) {
                        return (
                          <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px', padding: '8px', background: '#fff3e0', borderRadius: '6px', border: '1px solid #ffcc80' }}>
                            Customer chose not to proceed. Suggested refund:<br />
                            {servicePaid > 0 && <span>Service paid: ₱{servicePaid.toFixed(2)}</span>}
                            {servicePaid > 0 && compensationAmt > 0 && <span> + </span>}
                            {compensationAmt > 0 && <span>Compensation: ₱{compensationAmt.toFixed(2)}</span>}
                            {(servicePaid > 0 || compensationAmt > 0) && <strong> = ₱{(servicePaid + compensationAmt).toFixed(2)}</strong>}
                          </div>
                        );
                      }
                      return null;
                    })()}
                    <input
                      type="number"
                      className="form-control"
                      style={{ width: '100%', boxSizing: 'border-box' }}
                      min="0"
                      step="0.01"
                      placeholder="Enter refund amount"
                      value={settlementForm.refundAmount || ''}
                      onChange={(e) => setSettlementForm({ ...settlementForm, refundAmount: e.target.value })}
                    />
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer-centered" style={{ justifyContent: 'flex-end' }}>
              {activeDamageIncident.compensation_status === 'paid' ? (
                <button className="btn-cancel" onClick={() => setShowSettlementModal(false)}>Close</button>
              ) : (
                <>
                  <button className="btn-cancel" onClick={() => setShowSettlementModal(false)}>Cancel</button>
                  <button className="btn-save" onClick={handleSettleCompensation}>Mark as Paid</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showAccessoriesPriceModal && accessoriesPriceItem && (
        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowAccessoriesPriceModal(false)}>
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h2>Set Accessories Price</h2>
              <span className="close-modal" onClick={() => setShowAccessoriesPriceModal(false)}>×</span>
            </div>
            <div className="modal-body">
              <div className="detail-row"><strong>Order ID:</strong> #{accessoriesPriceItem.order_id}</div>
              <div className="detail-row"><strong>Current Price:</strong> ₱{parseFloat(accessoriesPriceItem.final_price || 0).toLocaleString()}</div>
              <div style={{ padding: '8px 12px', backgroundColor: '#fff3e0', borderRadius: '6px', margin: '10px 0', border: '1px solid #ffcc80', fontSize: '13px', color: '#e65100' }}>
                Customer requested to add accessories. Enter the price below — the customer will be asked to confirm before proceeding.
              </div>
              <div className="payment-form-group" style={{ marginTop: '12px' }}>
                <label>Accessories Price (₱) *</label>
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

      {showPriceEditModal && priceEditOrder && (

        <PriceEditModal

          order={priceEditOrder}

          onClose={() => {

            setShowPriceEditModal(false);

            setPriceEditOrder(null);

          }}

          onSave={handlePriceUpdate}

        />

      )}

      {showPriceHistoryModal && priceEditOrder && (

        <PriceHistoryModal

          itemId={priceEditOrder.item_id}

          onClose={() => {

            setShowPriceHistoryModal(false);

            setPriceEditOrder(null);

          }}

        />

      )}

    </div>

  );

};



export default Repair;

