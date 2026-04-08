import { useState, useEffect } from 'react';

import { useNavigate } from 'react-router-dom';

import '../adminStyle/dryclean.css';

import AdminHeader from './AdminHeader';

import Sidebar from './Sidebar';

import { getAllDryCleaningOrders, updateDryCleaningOrderItem } from '../api/DryCleaningOrderApi';

import { getUserRole } from '../api/AuthApi';

import { getAllDCGarmentTypesAdmin, createDCGarmentType, updateDCGarmentType, deleteDCGarmentType } from '../api/DryCleaningGarmentTypeApi';

import { recordPayment } from '../api/PaymentApi';

import { deleteOrderItem, updateOrderItemPrice } from '../api/OrderApi';

import ImagePreviewModal from '../components/ImagePreviewModal';

import SimpleImageCarousel from '../components/SimpleImageCarousel';

import { API_BASE_URL } from '../api/config';

import PriceEditModal from '../components/admin/PriceEditModal';

import PriceHistoryModal from '../components/admin/PriceHistoryModal';

import {
  createCompensationIncident,
  getCompensationIncidents,
  settleCompensationIncident,
  updateCompensationLiability
} from '../api/DamageCompensationApi';



const isAuthenticated = () => {

  return !!localStorage.getItem('token');

};



const DryCleaning = () => {

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

  const [showDetailModal, setShowDetailModal] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState(null);

  const [detailEstimatedCompletionDate, setDetailEstimatedCompletionDate] = useState('');

  const [savingEstimatedDate, setSavingEstimatedDate] = useState(false);

  const [showEnhanceModal, setShowEnhanceModal] = useState(false);

  const [enhanceOrder, setEnhanceOrder] = useState(null);

  const [savingEnhancement, setSavingEnhancement] = useState(false);
  const [showEnhancementViewModal, setShowEnhancementViewModal] = useState(false);
  const [enhancementViewItem, setEnhancementViewItem] = useState(null);
  const [enhancementPriceItem, setEnhancementPriceItem] = useState(null);
  const [savingEnhancementPrice, setSavingEnhancementPrice] = useState(false);

  const [enhanceForm, setEnhanceForm] = useState({

    notes: '',

    additionalCost: '',

    estimatedCompletionDate: ''

  });

  const [editForm, setEditForm] = useState({

    finalPrice: '',

    approvalStatus: '',

    adminNotes: ''

  });



  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const [confirmAction, setConfirmAction] = useState(null);

  const [confirmMessage, setConfirmMessage] = useState('');

  const [confirmButtonText, setConfirmButtonText] = useState('Confirm');

  const [confirmButtonStyle, setConfirmButtonStyle] = useState('blue');



  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [paymentAmount, setPaymentAmount] = useState('');

  const [cashReceived, setCashReceived] = useState('');



  const [showPriceEditModal, setShowPriceEditModal] = useState(false);

  const [showPriceHistoryModal, setShowPriceHistoryModal] = useState(false);

  const [priceEditOrder, setPriceEditOrder] = useState(null);



  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);

  const [previewImageUrl, setPreviewImageUrl] = useState('');

  const [previewImageAlt, setPreviewImageAlt] = useState('');



  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const [damageIncidents, setDamageIncidents] = useState([]);

  const [showDamageReportModal, setShowDamageReportModal] = useState(false);
  const [showLiabilityModal, setShowLiabilityModal] = useState(false);
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [damageTargetItem, setDamageTargetItem] = useState(null);
  const [activeDamageIncident, setActiveDamageIncident] = useState(null);
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
    totalQuantity: '1',
    damagedQuantity: '1',
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



  const [showPriceConfirmationModal, setShowPriceConfirmationModal] = useState(false);

  const [priceConfirmationItem, setPriceConfirmationItem] = useState(null);

  const [priceConfirmationPrice, setPriceConfirmationPrice] = useState('');

  const [priceConfirmationReason, setPriceConfirmationReason] = useState('');

  const isAdminUser = getUserRole() === 'admin';



  const [garmentTypes, setGarmentTypes] = useState([]);

  const [loadingGarmentTypes, setLoadingGarmentTypes] = useState(false);

  const [showGarmentTypeModal, setShowGarmentTypeModal] = useState(false);

  const [editingGarmentType, setEditingGarmentType] = useState(null);

  const [garmentTypeForm, setGarmentTypeForm] = useState({

    garment_name: '',

    garment_price: '',

    description: '',

    is_active: 1

  });



  const showToast = (message, type = 'success') => {

    setToast({ show: true, message, type });

    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);

  };



  const openImagePreview = (url, altText) => {

    setPreviewImageUrl(url);

    setPreviewImageAlt(altText || 'Image');

    setImagePreviewOpen(true);

  };



  const closeImagePreview = () => {

    setImagePreviewOpen(false);

    setPreviewImageUrl('');

    setPreviewImageAlt('');

  };



  const openConfirmModal = (message, action, buttonText = 'Confirm', buttonStyle = 'blue') => {

    setConfirmMessage(message);

    setConfirmAction(() => action);

    setConfirmButtonText(buttonText);

    setConfirmButtonStyle(buttonStyle);

    setShowConfirmModal(true);

  };



  const handleConfirm = () => {

    if (confirmAction) confirmAction();

    setShowConfirmModal(false);

    setConfirmAction(null);

  };



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

    loadGarmentTypes();

  }, [navigate]);



  const loadGarmentTypes = async () => {

    setLoadingGarmentTypes(true);

    try {

      const result = await getAllDCGarmentTypesAdmin();

      if (result.success) {

        setGarmentTypes(result.data || []);

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



    try {

      let result;

      if (editingGarmentType) {

        result = await updateDCGarmentType(editingGarmentType.dc_garment_id, garmentTypeForm);

      } else {

        result = await createDCGarmentType(garmentTypeForm);

      }



      if (result.success) {

        showToast(editingGarmentType ? 'Garment type updated successfully!' : 'Garment type created successfully!', 'success');

        setShowGarmentTypeModal(false);

        setGarmentTypeForm({ garment_name: '', garment_price: '', description: '', is_active: 1 });

        setEditingGarmentType(null);

        await loadGarmentTypes();

      } else {

        showToast(result.message || 'Failed to save garment type', 'error');

      }

    } catch (err) {

      console.error("Save garment type error:", err);

      showToast('Failed to save garment type', 'error');

    }

  };



  const handleDeleteGarmentType = async (garmentId) => {

    openConfirmModal("Are you sure you want to delete this garment type? This action cannot be undone.", async () => {

      try {

        const result = await deleteDCGarmentType(garmentId);

        if (result.success) {

          showToast('Garment type deleted successfully', 'success');



          setGarmentTypes(prevGarments => prevGarments.filter(garment => garment.dc_garment_id !== garmentId));



          await loadGarmentTypes();

        } else {

          showToast(result.message || 'Failed to delete garment type', 'error');

        }

      } catch (err) {

        console.error("Delete garment type error:", err);

        showToast('Failed to delete garment type', 'error');



        await loadGarmentTypes();

      }

    }, 'Delete', 'danger');

  };



  const openEditGarmentType = (garment) => {

    setEditingGarmentType(garment);

    setGarmentTypeForm({

      garment_name: garment.garment_name,

      garment_price: garment.garment_price,

      description: garment.description || '',

      is_active: garment.is_active

    });

    setShowGarmentTypeModal(true);

  };



  const openNewGarmentType = () => {

    setEditingGarmentType(null);

    setGarmentTypeForm({ garment_name: '', garment_price: '', description: '', is_active: 1 });

    setShowGarmentTypeModal(true);

  };



  const getStatusClass = (status) => {

    const statusMap = {

      'pending_review': 'pending',

      'pending': 'pending',

      'accepted': 'accepted',

      'price_confirmation': 'pending',

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

      'ready_to_pickup': 'To Pick up',

      'completed': 'Completed',

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



  const getNextStatus = (currentStatus, serviceType = 'dry_cleaning', item = null) => {

    const normalizedCurrentStatus = currentStatus === 'ready_to_pickup' ? 'ready_for_pickup' : currentStatus;

    if (!normalizedCurrentStatus || normalizedCurrentStatus === 'pending_review' || normalizedCurrentStatus === 'pending') {

      if (serviceType === 'dry_cleaning') {

        return 'accepted';

      }

      return 'price_confirmation';

    }



    if (normalizedCurrentStatus === 'price_confirmation') {

      return 'accepted';

    }



    if (normalizedCurrentStatus === 'accepted') {

      return 'confirmed';

    }



    const statusFlow = {

      'repair': ['pending', 'price_confirmation', 'accepted', 'confirmed', 'ready_for_pickup', 'completed'],

      'customization': ['pending', 'price_confirmation', 'accepted', 'confirmed', 'ready_for_pickup', 'completed'],

      'dry_cleaning': ['pending', 'accepted', 'confirmed', 'ready_for_pickup', 'completed'],

      'rental': ['pending', 'ready_for_pickup', 'picked_up', 'rented', 'returned', 'completed']

    };



    const flow = statusFlow[serviceType] || statusFlow['dry_cleaning'];

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

      const amountPaid = isEnhancementOrder ? parseFloat(item.final_price || 0) : parseFloat(pricingFactors.amount_paid || 0);

      const finalPrice = parseFloat(item.final_price || 0);

      const remainingBalance = finalPrice - amountPaid;

      const incident = getIncidentForItem(item.item_id);
      const hasPaidCompensation = isPaidCompensationIncident(incident);



      if (remainingBalance > 0.01 && !hasPaidCompensation) {

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

      specificData?.pickupDate ||

      specificData?.preferredDate ||

      specificData?.date ||

      ((item?.approval_status === 'accepted' || item?.approval_status === 'confirmed') ? item?.order_date : null);



    const estimatedDate =

      pricingFactors?.estimatedCompletionDate ||

      pricingFactors?.estimated_completion_date ||

      specificData?.estimatedCompletionDate ||

      specificData?.estimated_completion_date;



    if (appointmentDate && isToday(appointmentDate)) {

      return 'appointment-today';

    }

    if (estimatedDate && isToday(estimatedDate)) {

      return 'estimated-today';

    }

    return null;

  };

  const isTodayAppointment = (item) => getComputedStatus(item) === 'appointment-today';



  const getNextStatusLabel = (currentStatus, serviceType = 'dry_cleaning', item = null) => {

    const nextStatus = getNextStatus(currentStatus, serviceType, item);

    if (!nextStatus) return null;



    const labelMap = {

      'accepted': 'Accept',

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

      loadDryCleaningOrders();

    }

  }, []);



  const loadDryCleaningOrders = async () => {

    setLoading(true);

    setError('');

    try {

      const result = await getAllDryCleaningOrders();

      if (result.success) {

        setAllItems(result.orders);

        const incidentsResult = await getCompensationIncidents({ service_type: 'dry_cleaning' });
        if (incidentsResult.success) {
          setDamageIncidents(incidentsResult.incidents || []);
        }

      } else {

        setError(result.message || 'Failed to load dry cleaning orders');

      }

    } catch (err) {

      console.error("Load error:", err);

      setError('Failed to load dry cleaning orders');

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
    const totalQtyRaw = Number(item?.specific_data?.quantity || 1);
    const totalQty = Number.isFinite(totalQtyRaw) && totalQtyRaw > 0 ? Math.floor(totalQtyRaw) : 1;
    setDamageTargetItem(item);
    setDamageForm({
      damageType: '',
      damageDescription: '',
      responsibleParty: '',
      totalQuantity: String(totalQty),
      damagedQuantity: '1',
      affectedGarments: [],
      compensationAmount: '',
      compensationType: 'money',
      clotheDescription: ''
    });
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
    const hasMoneyOffer = Number.isFinite(compensationAmount) && compensationAmount > 0;
    const hasClotheOffer = damageForm.clotheDescription.trim().length > 0;
    if (!hasMoneyOffer && !hasClotheOffer) {
      showToast('Please provide at least one compensation option (money amount or clothe description)', 'error');
      return;
    }

    const damagedGarmentSummary = selectedGarments
      .map((garment) => `${garment.garmentType} x${garment.damagedQty}`)
      .join(', ');

    const result = await createCompensationIncident({
      order_item_id: damageTargetItem.item_id,
      order_id: damageTargetItem.order_id,
      service_type: 'dry_cleaning',
      customer_name: getCustomerNameFromItem(damageTargetItem),
      responsible_party: damageForm.responsibleParty.trim(),
      damage_type: damageForm.damageType.trim(),
      damage_description: damageForm.damageDescription.trim(),
      total_quantity: totalQuantity,
      damaged_quantity: damagedQuantity,
      damaged_garment_type: damagedGarmentSummary || null,
      compensation_amount: compensationAmount,
      compensation_type: hasMoneyOffer && hasClotheOffer ? 'both' : hasMoneyOffer ? 'money' : 'clothe',
      clothe_description: hasClotheOffer ? damageForm.clotheDescription.trim() : null,
      notes: 'Reported from Dry Cleaning management'
    });

    if (!result.success) {
      showToast(result.message || 'Failed to report damage incident', 'error');
      return;
    }

    showToast('Damage incident reported. Set liability next.', 'success');
    setShowDamageReportModal(false);
    setDamageTargetItem(null);
    await loadDryCleaningOrders();
  };

  const openLiabilityModal = (incident, decision) => {
    setActiveDamageIncident(incident);
    setLiabilityForm({
      decision,
      totalQuantity: `${incident.total_quantity || 1}`,
      damagedQuantity: `${incident.damaged_quantity || 1}`,
      compensationAmount: `${incident.compensation_amount || 0}`,
      compensationType: incident.compensation_type || 'money',
      clotheDescription: incident.clothe_description || '',
      notes: incident.notes || ''
    });
    setShowLiabilityModal(true);
  };

  const handleLiabilityDecision = async () => {
    if (!activeDamageIncident) return;

    const totalQuantity = parseInt(liabilityForm.totalQuantity || '1', 10);
    const damagedQuantity = parseInt(liabilityForm.damagedQuantity || '1', 10);
    const compensationAmount = parseFloat(liabilityForm.compensationAmount || '0');
    if (!Number.isInteger(totalQuantity) || totalQuantity < 1) {
      showToast('Please enter a valid total quantity', 'error');
      return;
    }
    if (!Number.isInteger(damagedQuantity) || damagedQuantity < 1 || damagedQuantity > totalQuantity) {
      showToast('Damaged quantity must be between 1 and total quantity', 'error');
      return;
    }
    const hasMoneyOffer = Number.isFinite(compensationAmount) && compensationAmount > 0;
    const hasClotheOffer = liabilityForm.clotheDescription.trim().length > 0;
    if (!hasMoneyOffer && !hasClotheOffer) {
      showToast('Please provide at least one compensation option (money amount or clothe description)', 'error');
      return;
    }

    const result = await updateCompensationLiability(activeDamageIncident.id, {
      liability_status: liabilityForm.decision,
      total_quantity: totalQuantity,
      damaged_quantity: damagedQuantity,
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
    await loadDryCleaningOrders();
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

    const item = allItems.find(i => Number(i.item_id) === Number(activeDamageIncident.order_item_id));
    const isWalkIn = item?.order_type === 'walk_in';

    if (isWalkIn && !settlementForm.customerCompensationChoice) {
      showToast('Please select customer compensation choice', 'error');
      return;
    }

    if (isWalkIn && !settlementForm.customerProceedChoice) {
      showToast('Please select if customer wants to proceed with the order', 'error');
      return;
    }

    const result = await settleCompensationIncident(activeDamageIncident.id, {
      payment_reference: settlementForm.paymentReference.trim(),
      refund_amount: settlementForm.refundAmount ? parseFloat(settlementForm.refundAmount) : undefined,
      ...(isWalkIn ? {
        customer_compensation_choice: settlementForm.customerCompensationChoice,
        customer_proceed_choice: settlementForm.customerProceedChoice
      } : {})
    });

    if (!result.success) {
      showToast(result.message || 'Failed to settle compensation', 'error');
      return;
    }

    showToast('Compensation marked as paid', 'success');
    setShowSettlementModal(false);
    setActiveDamageIncident(null);
    await loadDryCleaningOrders();
  };



  const pendingAppointments = allItems.filter(item =>

    item.approval_status === 'pending_review' ||

    item.approval_status === 'pending' ||

    (item.approval_status === 'price_confirmation' && statusFilter !== 'price_confirmation') ||

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



  const getFilteredItems = () => {

    let items = [];



    if (viewFilter === "pending") {

      items = pendingAppointments;

    } else if (viewFilter === "accepted") {

      items = allItems.filter(item => item.approval_status === 'accepted');

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



    items = items.filter(item => {

      if (!searchTerm) return true;

      const searchLower = searchTerm.toLowerCase();

      const customerName = item.order_type === 'walk_in'

        ? (item.walk_in_customer_name || '').toLowerCase()

        : `${item.first_name || ''} ${item.last_name || ''}`.toLowerCase();

      const customerEmail = item.order_type === 'walk_in'

        ? (item.walk_in_customer_email || '').toLowerCase()

        : (item.email || '').toLowerCase();



      return (

        item.order_id?.toString().includes(searchLower) ||

        customerName.includes(searchLower) ||

        item.specific_data?.garmentType?.toLowerCase().includes(searchLower) ||

        customerEmail.includes(searchLower)

      );

    });



    if (statusFilter && viewFilter === 'all') {

      items = items.filter(item => {

        const computedStatus = getComputedStatus(item);

        let normalizedStatus = item.approval_status;

        if (item.approval_status === 'pending_review' ||

            (item.approval_status === 'price_confirmation' && statusFilter !== 'price_confirmation') ||

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

      const isPendingA = a.approval_status === 'pending' || a.approval_status === 'pending_review' || a.approval_status === 'price_confirmation' || !a.approval_status;

      const isPendingB = b.approval_status === 'pending' || b.approval_status === 'pending_review' || b.approval_status === 'price_confirmation' || !b.approval_status;



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



    // Check if garment type is "Others" - requires price confirmation

    const hasOthersGarment = (() => {

      if (item.specific_data?.garments && item.specific_data.garments.length > 0) {

        return item.specific_data.garments.some(g => g.isEstimated === true);

      }

      return false;

    })();



    // Walk-in orders skip price confirmation modal

    if (item.order_type === 'walk_in') {

      try {

        const actualPrice = parseFloat(item.final_price || 0);

        const priceToUse = actualPrice > 0 ? actualPrice : (getEstimatedPrice(item) || 0);

        const result = await updateDryCleaningOrderItem(itemId, {

          approvalStatus: 'accepted',

          finalPrice: priceToUse

        });

        if (result.success) {

          await loadDryCleaningOrders();

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



    // If garment type is "Others", show price confirmation modal

    if (hasOthersGarment) {

      const estimatedPrice = getEstimatedPrice(item) || parseFloat(item.final_price || 0);

      setPriceConfirmationItem(item);

      setPriceConfirmationPrice(estimatedPrice.toFixed(2));

      setPriceConfirmationReason(item.pricing_factors?.adminNotes || '');

      setShowPriceConfirmationModal(true);

      return;

    }



    // Standard garments with fixed prices - accept directly

    openConfirmModal(

      'Are you sure you want to accept this pending dry cleaning request?',

      async () => {

        try {

          const actualPrice = parseFloat(item.final_price || 0);

          const priceToUse = actualPrice > 0 ? actualPrice : (getEstimatedPrice(item) || 0);

          const result = await updateDryCleaningOrderItem(itemId, {

            approvalStatus: 'accepted',

            finalPrice: priceToUse

          });

          if (result.success) {

            await loadDryCleaningOrders();

            showToast('Dry cleaning request accepted!', 'success');

          } else {

            showToast(result.message || 'Failed to accept request', 'error');

          }

        } catch (err) {

          console.error('Accept error:', err);

          showToast('Failed to accept request', 'error');

        }

      },

      'Accept',

      'blue'

    );

  };



  const handlePriceConfirmationSubmit = async () => {

    if (!priceConfirmationItem) return;



    const finalPrice = parseFloat(priceConfirmationPrice);
    const currentPrice = parseFloat(priceConfirmationItem.final_price || 0);
    const isPriceChanged = Math.abs(finalPrice - currentPrice) > 0.01;

    if (isNaN(finalPrice) || finalPrice <= 0) {

      showToast("Please enter a valid price", "error");

      return;

    }



    if (isPriceChanged && !priceConfirmationReason.trim()) {

      showToast("Please provide a reason for the price", "error");

      return;

    }



    try {

      const result = await updateDryCleaningOrderItem(priceConfirmationItem.item_id, {

        approvalStatus: 'price_confirmation',

        finalPrice: finalPrice,

        adminNotes: isPriceChanged ? priceConfirmationReason.trim() : undefined

      });

      if (result.success) {

        await loadDryCleaningOrders();

        showToast("Dry cleaning request moved to price confirmation!", "success");

        setShowPriceConfirmationModal(false);

        setPriceConfirmationItem(null);

        setPriceConfirmationPrice('');

        setPriceConfirmationReason('');

      } else {

        showToast(result.message || "Failed to accept dry cleaning request", "error");

      }

    } catch (err) {

      console.error("Accept error:", err);

      showToast("Failed to accept dry cleaning request", "error");

    }

  };



  const handleDecline = (itemId) => {

    openConfirmModal("Are you sure you want to decline this dry cleaning request?", async () => {

      try {

        const result = await updateDryCleaningOrderItem(itemId, {

          approvalStatus: 'cancelled'

        });

        if (result.success) {

          loadDryCleaningOrders();

          showToast("Request declined", "success");

        } else {

          showToast(result.message || "Failed to decline request", "error");

        }

      } catch (err) {

        console.error("Decline error:", err);

        showToast("Failed to decline request", "error");

      }

    }, 'Decline', 'danger');

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

      const amountPaid = isEnhancementOrder ? parseFloat(item.final_price || 0) : parseFloat(pricingFactors.amount_paid || 0);

      const finalPrice = parseFloat(item.final_price || 0);

      const remainingBalance = finalPrice - amountPaid;

      const incident = getIncidentForItem(item.item_id);
      const hasPaidCompensation = isPaidCompensationIncident(incident);



      if (remainingBalance > 0.01 && !hasPaidCompensation) {

        showToast(`Cannot mark as completed. Payment is not complete. Remaining balance: ₱${remainingBalance.toFixed(2)}`, "error");

        return;

      }

    }



    openConfirmModal(

      `Are you sure you want to move this order from "${currentStatusLabel}" to "${statusLabel}"?`,

      async () => {

        try {

          const result = await updateDryCleaningOrderItem(itemId, {

            approvalStatus: status

          });

          if (result.success) {

            await loadDryCleaningOrders();



            if (viewFilter !== 'all') {



              if (status === 'accepted') {

                setViewFilter('accepted');

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

      },

      'Confirm',

      'blue'

    );

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

      const result = await updateDryCleaningOrderItem(enhanceOrder.item_id, {

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

          estimatedCompletionDate: enhanceForm.estimatedCompletionDate || null

        }

      });



      if (result.success) {

        setShowEnhanceModal(false);

        setEnhanceOrder(null);

        showToast('Enhancement applied. Order moved to In Progress.', 'success');

        loadDryCleaningOrders();

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

    try {
      setSavingEnhancementPrice(true);

      const pricingFactors = typeof target.pricing_factors === 'string'
        ? JSON.parse(target.pricing_factors || '{}')
        : (target.pricing_factors || {});

      const result = await updateDryCleaningOrderItem(target.item_id, {
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
        loadDryCleaningOrders();
      } else {
        showToast(result.message || 'Failed to accept enhancement', 'error');
      }
    } catch (err) {
      showToast('Failed to accept enhancement', 'error');
    } finally {
      setSavingEnhancementPrice(false);
    }
  };



  const handleSaveEstimatedCompletionDateFromDetails = async () => {

    if (!selectedOrder) return;

    try {

      setSavingEstimatedDate(true);

      const result = await updateDryCleaningOrderItem(selectedOrder.item_id, {

        estimatedCompletionDate: detailEstimatedCompletionDate || null,

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

        loadDryCleaningOrders();

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
      showToast('Only admin can delete orders', 'error');
      return;
    }

    const statusText = item.approval_status === 'cancelled' ? 'rejected' : 'completed';

    openConfirmModal(

      `Are you sure you want to delete this ${statusText} order (ORD-${item.order_id})? This action cannot be undone.`,

      async () => {

        try {

          const result = await deleteOrderItem(item.item_id);

          if (result.success) {

            showToast('Order deleted successfully', 'success');

            loadDryCleaningOrders();

          } else {

            showToast(result.message || 'Failed to delete order', 'error');

          }

        } catch (error) {

          console.error('Error deleting order:', error);

          showToast('Error deleting order', 'error');

        }

      },

      'Delete',

      'danger'

    );

  };



  const handleRecordPayment = async () => {

    if (!selectedOrder || !paymentAmount) {

      showToast('Please enter a payment amount', 'error');

      return;

    }



    const amount = parseFloat(paymentAmount);

    if (isNaN(amount) || amount <= 0) {

      showToast('Please enter a valid payment amount', 'error');

      return;

    }



    const pricingFactors = typeof selectedOrder.pricing_factors === 'string'

      ? JSON.parse(selectedOrder.pricing_factors || '{}')

      : (selectedOrder.pricing_factors || {});

    const amountPaid = parseFloat(pricingFactors.amount_paid || 0);

    const finalPrice = parseFloat(selectedOrder.final_price || 0);

    const remainingBalance = Math.max(0, finalPrice - amountPaid);

    if (amount > remainingBalance) {

      showToast(`Payment amount exceeds remaining balance (₱${remainingBalance.toFixed(2)})`, 'error');

      return;

    }



    const cashGiven = parseFloat(cashReceived);

    if (isNaN(cashGiven) || cashGiven <= 0) {

      showToast('Please enter a valid cash received amount', 'error');

      return;

    }



    if (cashGiven < amount) {

      showToast('Cash received cannot be less than payment amount', 'error');

      return;

    }



    try {

      const result = await recordPayment(selectedOrder.item_id, amount, cashGiven, 'cash');

      if (result.success) {

        const remaining = result.payment?.remaining_balance || 0;

        const changeAmount = parseFloat(result.payment?.change_amount || 0);

        showToast(`Payment of ₱${amount.toFixed(2)} recorded successfully. Change: ₱${changeAmount.toFixed(2)}. ${remaining > 0 ? `Remaining balance: ₱${remaining.toFixed(2)}` : 'Payment complete!'}`, 'success');

        setShowPaymentModal(false);

        setPaymentAmount('');

        setCashReceived('');

        await loadDryCleaningOrders();

      } else {

        showToast(result.message || 'Failed to record payment', 'error');

      }

    } catch (error) {

      console.error('Error recording payment:', error);

      showToast('Error recording payment', 'error');

    }

  };



  const handlePriceUpdate = async (itemId, newPrice, reason) => {

    try {

      const result = await updateOrderItemPrice(itemId, newPrice, reason);

      if (result.success) {

        showToast('Price updated successfully!', 'success');

        loadDryCleaningOrders();

      } else {

        throw new Error(result.message);

      }

    } catch (error) {

      showToast(error.response?.data?.message || 'Failed to update price', 'error');

      throw error;

    }

  };



  const getEstimatedPrice = (item) => {

    if (!item || !item.specific_data) return null;

    const serviceName = item.specific_data.serviceName || '';

    const quantity = item.specific_data.quantity || 1;



    const basePrices = {

      'Basic Dry Cleaning': 200,

      'Premium Dry Cleaning': 350,

      'Delicate Items': 450,

      'Express Service': 500

    };



    const pricePerItem = {

      'Basic Dry Cleaning': 150,

      'Premium Dry Cleaning': 250,

      'Delicate Items': 350,

      'Express Service': 400

    };



    const basePrice = basePrices[serviceName] || 200;

    const perItemPrice = pricePerItem[serviceName] || 150;



    return item.specific_data.finalPrice || (basePrice + (perItemPrice * quantity));

  };



  const handleSaveEdit = async () => {

    if (!selectedOrder) return;



    try {

      const result = await updateDryCleaningOrderItem(selectedOrder.item_id, editForm);



      if (result.success) {

        setShowEditModal(false);

        loadDryCleaningOrders();

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

    <div className="dry-cleaning-management">

      <Sidebar />

      <AdminHeader />



      <div className="content">

        <div className="dashboard-title">

          <div>

            <h2>Dry Cleaning Management</h2>

            <p>Track and manage all dry cleaning orders</p>

          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>

            <button

              onClick={openNewGarmentType}

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

              + Add Garment Type

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

        <div className="search-container">

          <input

            type="text"

            placeholder="Search by Unique No, Name, or Garment"

            value={searchTerm}

            onChange={(e) => setSearchTerm(e.target.value)}

          />

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>

            <option value="">All Status</option>

            <option value="pending">Pending</option>

            <option value="price_confirmation">Price Confirmation</option>

            <option value="accepted">Accepted</option>

            <option value="confirmed">In Progress</option>

            <option value="ready_for_pickup">To Pick up</option>

            <option value="completed">Completed</option>

            <option value="cancelled">Rejected</option>

            <option value="estimated-today">Estimated Release Today</option>

          </select>

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
                  <option value="08:00">8:00 AM</option>
                  <option value="08:30">8:30 AM</option>
                  <option value="09:00">9:00 AM</option>
                  <option value="09:30">9:30 AM</option>
                  <option value="10:00">10:00 AM</option>
                  <option value="10:30">10:30 AM</option>
                  <option value="11:00">11:00 AM</option>
                  <option value="11:30">11:30 AM</option>
                  <option value="12:00">12:00 PM</option>
                  <option value="12:30">12:30 PM</option>
                  <option value="13:00">1:00 PM</option>
                  <option value="13:30">1:30 PM</option>
                  <option value="14:00">2:00 PM</option>
                  <option value="14:30">2:30 PM</option>
                  <option value="15:00">3:00 PM</option>
                  <option value="15:30">3:30 PM</option>
                  <option value="16:00">4:00 PM</option>
                  <option value="16:30">4:30 PM</option>
                  <option value="17:00">5:00 PM</option>
                  <option value="17:30">5:30 PM</option>
                </select>

                {timeFilter && (
                  <button
                    onClick={() => setTimeFilter('')}
                    style={{ padding: '4px 8px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
                  >Clear</button>
                )}
              </div>
        </div>

        <div className="table-container">

          <div className="table-scroll-viewport">

          <table>

            <thead>

              <tr>

                <th>Order ID</th>

                <th>Customer</th>

                <th>Garment</th>

                <th>Service</th>

                <th>Date</th>

                <th>Price</th>

                <th>Payment Status</th>

                <th>Status</th>

                <th>Actions</th>

              </tr>

            </thead>

            <tbody>

              {loading ? (

                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '40px' }}>Loading dry cleaning orders...</td></tr>

              ) : getFilteredItems().length === 0 ? (

                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '40px' }}>No dry cleaning orders found</td></tr>

              ) : (

                getFilteredItems().map(item => {

                  const incident = getIncidentForItem(item.item_id);
                  const liabilityStatus = normalizeIncidentStatus(incident?.liability_status);
                  const compensationStatus = normalizeIncidentStatus(incident?.compensation_status);
                  const isCompensatedIncident = incident && liabilityStatus === 'approved' && compensationStatus === 'paid';
                  const isDamagePendingIncident = incident && liabilityStatus === 'pending';
                  const isForCompensationIncident = incident && liabilityStatus === 'approved' && compensationStatus !== 'paid';



                  const pricingFactors = typeof item.pricing_factors === 'string'

                    ? JSON.parse(item.pricing_factors || '{}')

                    : (item.pricing_factors || {});

                  const isEnhancementOrder = pricingFactors.enhancementRequest && pricingFactors.enhancementAdminAccepted;

                  const amountPaid = isEnhancementOrder ? parseFloat(item.final_price || 0) : parseFloat(pricingFactors.amount_paid || 0);

                  const finalPrice = parseFloat(item.final_price || 0);

                  const remainingBalance = finalPrice - amountPaid;



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

                    <td>

                      {item.specific_data?.garments && item.specific_data.garments.length > 0

                        ? item.specific_data.garments.map(g => g.garmentType || 'Unknown').join(', ')

                        : (item.specific_data?.garmentType || 'N/A')}

                    </td>

                    <td><span style={{ fontSize: '0.9em', color: '#d32f2f' }}>{item.specific_data?.serviceName || 'N/A'}</span></td>

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

                    <td onClick={(e) => e.stopPropagation()}>

                      {(() => {
                        const hasApprovedDamage = normalizeIncidentStatus(incident?.liability_status) === 'approved';
                        const isCompensationPaid = hasApprovedDamage && normalizeIncidentStatus(incident?.compensation_status) === 'paid';
                        const isDamagePending = normalizeIncidentStatus(incident?.liability_status) === 'pending';
                        return (
                          <span
                            className={`status-badge ${hasApprovedDamage ? (isCompensationPaid ? 'completed' : 'rejected') : isDamagePending ? 'rejected' : getStatusClass(item.approval_status || 'pending')}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              whiteSpace: 'nowrap',
                              fontSize: '11px',
                              lineHeight: '1',
                              padding: '3px 7px',
                              fontWeight: 600,
                              ...(hasApprovedDamage ? {
                              backgroundColor: isCompensationPaid ? '#e8f5e9' : '#ffebee',
                              color: isCompensationPaid ? '#1b5e20' : '#c62828',
                              border: `1px solid ${isCompensationPaid ? '#a5d6a7' : '#ef9a9a'}`
                            } : isDamagePending ? {
                              backgroundColor: '#ffebee',
                              color: '#c62828',
                              border: '1px solid #ef9a9a'
                            } : {})
                            }}
                          >
                            {hasApprovedDamage
                              ? (isCompensationPaid ? 'Compensated' : 'For Compensation')
                              : isDamagePending
                              ? 'Damage Reported'
                              : getStatusText(item.approval_status || 'pending')}
                          </span>
                        );
                      })()}

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

                      {pricingFactors.enhancementRequest && pricingFactors.enhancementAdminAccepted && (
                        <div style={{ fontSize: '11px', color: '#673ab7', marginTop: '4px', fontWeight: '600' }}>
                          ✨ Enhancement
                        </div>
                      )}

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
                          ) : isCompensatedIncident && (
                            <>
                              {item.approval_status !== 'price_confirmation' && getNextStatus(item.approval_status, 'dry_cleaning', item) && (
                                <button
                                  className="icon-btn next-status"
                                  onClick={() => updateStatus(item.item_id, getNextStatus(item.approval_status, 'dry_cleaning', item))}
                                  title={`Move to ${getNextStatusLabel(item.approval_status, 'dry_cleaning', item)}`}
                                  style={{ backgroundColor: '#4CAF50', color: 'white' }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="9 18 15 12 9 6"></polyline>
                                  </svg>
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

                              {isAdminUser && (
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
                            </>
                          )}

                          {!isCompensatedIncident && !isDamagePendingIncident && !isForCompensationIncident && item.approval_status !== 'price_confirmation' && getNextStatus(item.approval_status, 'dry_cleaning', item) && (() => {
                            const nextStatus = getNextStatus(item.approval_status, 'dry_cleaning', item);
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
                                title={`Move to ${getNextStatusLabel(item.approval_status, 'dry_cleaning', item)}`}
                                style={{ backgroundColor: '#4CAF50', color: 'white' }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="9 18 15 12 9 6"></polyline>
                                </svg>
                              </button>
                            );
                          })()}

                          {!isCompensatedIncident && !isDamagePendingIncident && !isForCompensationIncident && item.approval_status !== 'completed' && item.approval_status !== 'cancelled' && item.approval_status !== 'price_confirmation' && (

                            <>

                              <button

                                className="icon-btn"

                                onClick={(e) => {

                                  e.stopPropagation();

                                  openDamageReportModal(item);

                                }}

                                title="Report Damage"

                                style={{ backgroundColor: '#fff', color: '#c62828', border: '1px solid #ef9a9a' }}

                              >

                                <i className="fas fa-triangle-exclamation"></i>

                              </button>

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

                              {!isEnhancementOrder && (
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

                              {item.approval_status === 'accepted' && item.order_type !== 'walk_in' && (
                              <button

                                className="icon-btn"

                                onClick={(e) => {

                                  e.stopPropagation();

                                  setPriceEditOrder(item);

                                  setShowPriceEditModal(true);

                                }}

                                title="Edit Price"

                                style={{ backgroundColor: '#ff9800', color: 'white' }}

                              >

                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">

                                  <circle cx="12" cy="12" r="10"></circle>

                                  <line x1="12" y1="6" x2="12" y2="18"></line>

                                  <line x1="9" y1="9" x2="9" y2="13"></line>

                                  <line x1="15" y1="11" x2="15" y2="15"></line>

                                  <path d="M9 13h6"></path>

                                  <path d="M9 9h4a2 2 0 0 1 0 4H9"></path>

                                </svg>

                              </button>
                              )}

                            </>

                          )}

                          {!isCompensatedIncident && !isDamagePendingIncident && !isForCompensationIncident && (item.approval_status === 'completed' || item.approval_status === 'cancelled') && (

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

                              {isAdminUser && (
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

                            </>

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

        {/* Enhancement Requests Table */}
        {(() => {
          const enhancementItems = allItems.filter(item => {
            const pf = typeof item.pricing_factors === 'string'
              ? JSON.parse(item.pricing_factors || '{}')
              : (item.pricing_factors || {});
            return pf.enhancementRequest === true && pf.enhancementPendingAdminReview === true
              && (item.approval_status === 'pending' || item.approval_status === 'pending_review');
          });

          return (
            <div style={{ marginTop: '40px' }}>
              <div className="dashboard-title" style={{ marginBottom: '12px' }}>
                <div>
                  <h2 style={{ color: '#673ab7' }}>Enhancement Requests</h2>
                  <p>Customer-requested enhancements pending admin review</p>
                </div>
              </div>
              <div className="table-container">
                <div className="table-scroll-viewport">
                  <table>
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Customer</th>
                        <th>Garment</th>
                        <th>Service</th>
                        <th>Date</th>
                        <th>Price</th>
                        <th>Payment Status</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enhancementItems.length === 0 ? (
                        <tr><td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: '#999' }}>No enhancement requests</td></tr>
                      ) : enhancementItems.map(item => {
                        const pf = typeof item.pricing_factors === 'string'
                          ? JSON.parse(item.pricing_factors || '{}')
                          : (item.pricing_factors || {});
                        const amountPaid = parseFloat(pf.amount_paid || 0);
                        const finalPrice = parseFloat(item.final_price || 0);
                        const remainingBalance = finalPrice - amountPaid;

                        return (
                          <tr key={item.item_id}>
                            <td><strong>#{item.order_id}</strong></td>
                            <td>
                              {item.order_type === 'walk_in'
                                ? <span><span style={{ display: 'inline-block', backgroundColor: '#ff9800', color: 'white', padding: '2px 8px', borderRadius: '3px', fontSize: '0.75em', marginRight: '5px', fontWeight: 'bold' }}>WALK-IN</span>{item.walk_in_customer_name || 'Walk-in Customer'}</span>
                                : `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'N/A'}
                            </td>
                            <td>
                              {item.specific_data?.garments && item.specific_data.garments.length > 0
                                ? item.specific_data.garments.map(g => g.garmentType || 'Unknown').join(', ')
                                : (item.specific_data?.garmentType || 'N/A')}
                            </td>
                            <td><span style={{ fontSize: '0.9em', color: '#d32f2f' }}>{item.specific_data?.serviceName || 'N/A'}</span></td>
                            <td>{(() => {
                              const pickupDate = item.specific_data?.pickupDate || item.pricing_factors?.pickupDate;
                              if (!pickupDate) return 'N/A';
                              return new Date(pickupDate).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
                            })()}</td>
                            <td>&#8369;{finalPrice.toLocaleString()}</td>
                            <td>
                              <div style={{ fontSize: '12px' }}>
                                <div>Paid: &#8369;{amountPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                <div style={{ color: remainingBalance > 0 ? '#ff9800' : '#4caf50', fontWeight: 'bold' }}>
                                  Remaining: &#8369;{Math.max(0, remainingBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              </div>
                            </td>
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
                                  title="Accept Enhancement"
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
            </div>
          );
        })()}

      </div>

      {showEditModal && selectedOrder && (

        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowEditModal(false)}>

          <div className="modal-content">

            <div className="modal-header">

              <h2>Update Dry Cleaning Order</h2>

              <span className="close-modal" onClick={() => setShowEditModal(false)}>×</span>

            </div>

            <div className="modal-body">

              <div className="detail-row"><strong>Order ID:</strong> #{selectedOrder.order_id}</div>

              {/* Multiple garments support */}

              {selectedOrder.specific_data?.garments && selectedOrder.specific_data.garments.length > 0 ? (

                <>

                  <div className="detail-row"><strong>Garments:</strong> {selectedOrder.specific_data.garments.length} item{selectedOrder.specific_data.garments.length > 1 ? 's' : ''}</div>

                  {selectedOrder.specific_data.garments.map((garment, idx) => (

                    <div key={idx} style={{ marginLeft: '20px', paddingLeft: '10px', borderLeft: '2px solid #e0e0e0', marginBottom: '8px' }}>

                      <div className="detail-row"><strong>#{idx + 1}:</strong> {garment.garmentType || 'N/A'} ({garment.brand || 'N/A'}) × {garment.quantity || 1} - ₱{(garment.pricePerItem * (garment.quantity || 1)).toFixed(2)}</div>

                    </div>

                  ))}

                </>

              ) : (

                <>

                  <div className="detail-row"><strong>Garment:</strong> {selectedOrder.specific_data?.garmentType || 'N/A'}</div>

                </>

              )}

              <div className="detail-row"><strong>Service:</strong> {selectedOrder.specific_data?.serviceName || 'N/A'}</div>



              {/* Support multiple images */}

              {selectedOrder.specific_data?.imageUrls && selectedOrder.specific_data.imageUrls.length > 0 ? (

                <div className="detail-row">

                  <strong>Clothing Images ({selectedOrder.specific_data.imageUrls.length}):</strong><br />

                  <div style={{ marginTop: '8px' }}>

                    <SimpleImageCarousel

                      images={selectedOrder.specific_data.imageUrls.map((url, idx) => ({ url: `${API_BASE_URL}${url}`, label: `Photo ${idx + 1}/${selectedOrder.specific_data.imageUrls.length}` }))}

                      itemName="Clothing Photo"

                      height="280px"

                    />

                  </div>

                </div>

              ) : selectedOrder.specific_data?.imageUrl && selectedOrder.specific_data.imageUrl !== 'no-image' && (

                <div className="detail-row">

                  <strong>Clothing Image:</strong><br />

                  <div

                    className="clickable-image"

                    style={{ cursor: 'pointer', display: 'inline-block', marginTop: '8px' }}

                    onClick={() => openImagePreview(`${API_BASE_URL}${selectedOrder.specific_data.imageUrl}`, 'Clothing Image')}

                  >

                    <img

                      src={`${API_BASE_URL}${selectedOrder.specific_data.imageUrl}`}

                      alt="Clothing"

                      style={{ maxWidth: '200px', maxHeight: '200px', border: '1px solid #ddd', borderRadius: '4px' }}

                    />

                    <small className="click-hint" style={{ display: 'block', fontSize: '11px', color: '#888', marginTop: '4px' }}>Click to expand</small>

                  </div>

                </div>

              )}



              <div className="form-group" style={{ marginTop: '20px' }}>

                <label>Final Price (₱)</label>

                {(() => {

                  // Check if garment type is "Others" - only then price is editable

                  const isOthersGarment = (() => {

                    if (selectedOrder.specific_data?.garments && selectedOrder.specific_data.garments.length > 0) {

                      return selectedOrder.specific_data.garments.some(g => 

                        (g.garmentType || '').toLowerCase() === 'others'

                      );

                    }

                    return (selectedOrder.specific_data?.garmentType || '').toLowerCase() === 'others';

                  })();



                  if (!isOthersGarment) {

                    return (

                      <>

                        <input

                          type="number"

                          value={editForm.finalPrice}

                          disabled

                          style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}

                        />

                        <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#e3f2fd', borderRadius: '4px', fontSize: '0.9em', color: '#1976d2' }}>

                          ℹ️ Price is fixed for standard garment types. Only "Others" garment type allows price editing.

                        </div>

                      </>

                    );

                  }



                  return (

                    <>

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



                          setEditForm({...editForm, finalPrice: newPrice, approvalStatus: newStatus});

                        }}

                        placeholder="Enter final price"

                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}

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

                      <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#fff3cd', borderRadius: '4px', fontSize: '0.9em', color: '#856404' }}>

                        ℹ️ Price is editable because garment type is "Others". System will send price confirmation to customer.

                      </div>

                    </>

                  );

                })()}

              </div>



              <div className="form-group">

                <label>Status</label>

                <select

                  value={editForm.approvalStatus}

                  onChange={(e) => setEditForm({ ...editForm, approvalStatus: e.target.value })}

                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}

                >

                  <option value="pending">Pending</option>

                  <option value="accepted">Accepted</option>

                  <option value="confirmed">In Progress</option>

                  <option value="ready_for_pickup">Ready for Pickup</option>

                  <option value="completed">Completed</option>

                  <option value="cancelled">Rejected</option>

                </select>

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

      {showEnhancementViewModal && enhancementViewItem && (() => {
        const pf = typeof enhancementViewItem.pricing_factors === 'string'
          ? JSON.parse(enhancementViewItem.pricing_factors || '{}')
          : (enhancementViewItem.pricing_factors || {});

        return (
          <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowEnhancementViewModal(false)}>
            <div className="modal-content" style={{ maxWidth: '500px' }}>
              <div className="modal-header">
                <h2>Enhancement Request Details</h2>
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
                <div className="detail-row"><strong>Enhancement Notes:</strong></div>
                <div style={{ padding: '10px', backgroundColor: '#f3e5f5', borderRadius: '6px', marginBottom: '12px', border: '1px solid #ce93d8' }}>
                  {pf.enhancementNotes || 'No notes provided'}
                </div>
                <div className="detail-row">
                  <strong>Preferred Completion Date:</strong>
                  {pf.enhancementPreferredCompletionDate
                    ? new Date(pf.enhancementPreferredCompletionDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                    : 'Not specified'}
                </div>
                <div className="detail-row"><strong>Requested At:</strong> {pf.enhancementUpdatedAt ? new Date(pf.enhancementUpdatedAt).toLocaleString() : 'N/A'}</div>
                <div className="detail-row"><strong>Current Price:</strong> ₱{parseFloat(enhancementViewItem.final_price || 0).toLocaleString()}</div>
              </div>
              <div className="modal-footer">
                <button className="btn-cancel" onClick={() => setShowEnhancementViewModal(false)}>Close</button>
                <button
                  className="btn-save"
                  disabled={savingEnhancementPrice}
                  onClick={() => handleEnhancementPriceConfirm(enhancementViewItem)}
                  style={{ background: '#8b4513', borderColor: '#6d3510', color: '#fff' }}
                >
                  {savingEnhancementPrice ? 'Accepting...' : 'Accept Enhancement'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {showEnhanceModal && enhanceOrder && (

        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowEnhanceModal(false)}>

          <div className="modal-content enhance-order-modal" style={{ maxWidth: '640px', width: '95vw' }}>

            <div className="modal-header">

              <h2><i className="fas fa-tools" style={{ marginRight: '8px', color: '#8b4513' }}></i>Enhance Completed Dry Cleaning</h2>

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

                    <div key={idx} style={{ marginLeft: '20px', paddingLeft: '10px', borderLeft: '2px solid #e0e0e0', marginBottom: '8px' }}>

                      <div className="detail-row"><strong>Garment #{idx + 1}:</strong> {garment.garmentType ? (garment.garmentType.charAt(0).toUpperCase() + garment.garmentType.slice(1)) : 'N/A'}</div>

                      <div className="detail-row"><strong>Brand:</strong> {garment.brand || 'N/A'}</div>

                      <div className="detail-row"><strong>Quantity:</strong> {garment.quantity || 1}</div>

                      <div className="detail-row"><strong>Price:</strong> ₱{(garment.pricePerItem * (garment.quantity || 1)).toFixed(2)}</div>

                    </div>

                  ))}

                </>

              ) : (

                <>

                  <div className="detail-row"><strong>Garment:</strong> {selectedOrder.specific_data?.garmentType || 'N/A'}</div>

                </>

              )}

              <div className="detail-row"><strong>Service:</strong> {selectedOrder.specific_data?.serviceName || 'N/A'}</div>



              {/* Support multiple images */}

              {selectedOrder.specific_data?.imageUrls && selectedOrder.specific_data.imageUrls.length > 0 ? (

                <div className="detail-row">

                  <strong>Clothing Images ({selectedOrder.specific_data.imageUrls.length}):</strong><br />

                  <div style={{ marginTop: '8px' }}>

                    <SimpleImageCarousel

                      images={selectedOrder.specific_data.imageUrls.map((url, idx) => ({ url: `${API_BASE_URL}${url}`, label: `Photo ${idx + 1}/${selectedOrder.specific_data.imageUrls.length}` }))}

                      itemName="Clothing Photo"

                      height="300px"

                    />

                  </div>

                </div>

              ) : selectedOrder.specific_data?.imageUrl && selectedOrder.specific_data.imageUrl !== 'no-image' && (

                <div className="detail-row">

                  <strong>Clothing Image:</strong><br />

                  <div

                    className="clickable-image"

                    style={{ cursor: 'pointer', display: 'inline-block', marginTop: '8px' }}

                    onClick={() => openImagePreview(`${API_BASE_URL}${selectedOrder.specific_data.imageUrl}`, 'Clothing Image')}

                  >

                    <img

                      src={`${API_BASE_URL}${selectedOrder.specific_data.imageUrl}`}

                      alt="Clothing"

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

                const pricingFactors = selectedOrder?.pricing_factors || {};

                const specificData = selectedOrder?.specific_data || {};

                const completionDate = detailEstimatedCompletionDate || pricingFactors.estimatedCompletionDate || pricingFactors.estimated_completion_date || specificData.estimatedCompletionDate || specificData.estimated_completion_date;



                if (completionDate) {

                  const parsedDate = new Date(completionDate);

                  return Number.isNaN(parsedDate.getTime())

                    ? completionDate

                    : parsedDate.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });

                }



                return pricingFactors.estimatedTime || pricingFactors.estimated_time || specificData.estimatedTime || specificData.estimated_time || 'N/A';

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

              <div className="detail-row"><strong>Price:</strong> ₱{parseFloat(selectedOrder.final_price || 0).toLocaleString()}</div>

              <div className="detail-row"><strong>Status:</strong>

                <span className={`status-badge ${getStatusClass(selectedOrder.approval_status || 'pending')}`}>

                  {getStatusText(selectedOrder.approval_status || 'pending')}

                </span>

              </div>



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
                    {(incident.damaged_quantity || incident.total_quantity) && (
                      <div className="detail-row"><strong>Affected Quantity:</strong> {incident.damaged_quantity || 1} of {incident.total_quantity || 1}</div>
                    )}
                    {incident.compensation_type === 'clothe' ? (
                      <div className="detail-row"><strong>Compensation:</strong> 👕 Clothe — {incident.clothe_description || 'Replacement garment'}</div>
                    ) : incident.compensation_type === 'both' ? (
                      <>
                        <div className="detail-row"><strong>Compensation (Money):</strong> ₱{parseFloat(incident.compensation_amount || 0).toLocaleString()}</div>
                        <div className="detail-row"><strong>Compensation (Clothe):</strong> 👕 {incident.clothe_description || 'Replacement garment'}</div>
                      </>
                    ) : (
                      <div className="detail-row"><strong>Compensation:</strong> ₱{parseFloat(incident.compensation_amount || 0).toLocaleString()}</div>
                    )}
                    <div className="detail-row"><strong>Compensation Status:</strong> {incident.compensation_status}</div>
                    {incident.customer_compensation_choice && (
                      <div className="detail-row"><strong>Customer Chose:</strong> {incident.customer_compensation_choice === 'clothe' ? '👕 Clothe' : '💵 Money'}</div>
                    )}
                    {incident.customer_proceed_choice && (
                      <div className="detail-row"><strong>Order Proceed:</strong> {incident.customer_proceed_choice === 'proceed' ? '✅ Proceed' : '❌ Don\'t proceed'}</div>
                    )}
                  </>
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

        <div className="modal-overlay confirm-overlay active" onClick={(e) => e.target === e.currentTarget && setShowConfirmModal(false)}>

          <div className="confirm-modal">

            <div className="confirm-icon">

              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={confirmButtonStyle === 'danger' ? '#E74C3C' : '#F39C12'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">

                <circle cx="12" cy="12" r="10"></circle>

                <line x1="12" y1="8" x2="12" y2="12"></line>

                <line x1="12" y1="16" x2="12.01" y2="16"></line>

              </svg>

            </div>

            <h3>Confirm Action</h3>

            <p>{confirmMessage}</p>

            <div className="confirm-buttons">

              <button className="confirm-btn cancel" onClick={() => setShowConfirmModal(false)}>Cancel</button>

              <button className={confirmButtonStyle === 'danger' ? 'confirm-btn-danger' : 'confirm-btn-blue'} onClick={handleConfirm}>{confirmButtonText}</button>

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

{showGarmentTypeModal && (

  <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowGarmentTypeModal(false)}>

    <div className="modal-content" style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>

      <div className="modal-header">

        <h2>{editingGarmentType ? 'Edit Garment Type' : 'Add Garment Type'}</h2>

        <span className="close-modal" onClick={() => {

          setShowGarmentTypeModal(false);

          setEditingGarmentType(null);

          setGarmentTypeForm({ garment_name: '', garment_price: '', description: '', is_active: 1 });

        }}>×</span>

      </div>



      <div className="garment-modal-body">

        <div className="garment-form-group">

          <label>Garment Name *</label>

          <input

            type="text"

            value={garmentTypeForm.garment_name}

            onChange={(e) => setGarmentTypeForm({ ...garmentTypeForm, garment_name: e.target.value })}

            placeholder="e.g., Barong, Suits, Coat, Trousers"

          />

        </div>



        <div className="garment-form-group">

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



        <div className="garment-form-group">

          <label>Description</label>

          <textarea

            value={garmentTypeForm.description}

            onChange={(e) => setGarmentTypeForm({ ...garmentTypeForm, description: e.target.value })}

            placeholder="Optional description..."

            rows={3}

          />

        </div>



        <div className="garment-form-group">

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

          <div className="garment-types-list-header">

            <h3>Existing Dry Cleaning Garment Types ({garmentTypes.length})</h3>

            <div className="garment-types-scrollable">

              {garmentTypes.map(garment => (

                <div

                  key={garment.dc_garment_id}

                  className={`garment-item-card ${garment.is_active ? 'active' : 'inactive'}`}

                >

                  <div className="garment-item-info">

                    <div className="garment-item-name">{garment.garment_name}</div>

                    <div className="garment-item-details">

                      <span className="price">Price: ₱{parseFloat(garment.garment_price).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>

                      {garment.description && ` | ${garment.description}`}

                      {!garment.is_active && <span className="inactive-badge">(Inactive)</span>}

                    </div>

                  </div>

                  <div className="garment-item-actions">

                    <button

                      onClick={() => openEditGarmentType(garment)}

                      className="garment-edit-btn"

                    >

                      Edit

                    </button>

                    <button

                      onClick={() => handleDeleteGarmentType(garment.dc_garment_id)}

                      className="garment-delete-btn"

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



      <div className="garment-modal-footer">

        <button className="garment-btn-cancel" onClick={() => {

          setShowGarmentTypeModal(false);

          setEditingGarmentType(null);

          setGarmentTypeForm({ garment_name: '', garment_price: '', description: '', is_active: 1 });

        }}>Cancel</button>

        <button

          className="garment-btn-submit"

          onClick={handleGarmentTypeSubmit}

          disabled={!garmentTypeForm.garment_name.trim() || !garmentTypeForm.garment_price || isNaN(parseFloat(garmentTypeForm.garment_price))}

        >

          {editingGarmentType ? 'Update' : 'Create'}

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

              <div className="detail-row">

                <strong>Garments:</strong>

                {priceConfirmationItem.specific_data?.garments && priceConfirmationItem.specific_data.garments.length > 0

                  ? priceConfirmationItem.specific_data.garments.map(g => g.garmentType || 'Unknown').join(', ')

                  : (priceConfirmationItem.specific_data?.garmentType || 'N/A')}

              </div>



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

                <label>Reason for Price <span style={{ color: '#666', fontSize: '12px' }}>(required only if price changes)</span></label>

                <textarea

                  value={priceConfirmationReason}

                  onChange={(e) => setPriceConfirmationReason(e.target.value)}

                  placeholder="Explain the price for this garment (e.g., special fabric, delicate material, extra care required)..."

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

                <span>

                  {selectedOrder.order_type === 'walk_in'

                    ? (selectedOrder.walk_in_customer_name || 'Walk-in Customer')

                    : `${selectedOrder.first_name || ''} ${selectedOrder.last_name || ''}`.trim() || 'N/A'}

                </span>

              </div>

              <div className="detail-row">

                <strong>Service:</strong>

                <span>Dry Cleaning - {selectedOrder.specific_data?.garmentType || 'N/A'}</span>

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

      {showDamageReportModal && damageTargetItem && (
        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowDamageReportModal(false)}>
          <div className="modal-content damage-compensation-modal" style={{ maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', textAlign: 'left' }}>
            <div className="modal-header">
              <h2><i className="fas fa-triangle-exclamation" style={{ marginRight: '8px' }}></i>Report Damage</h2>
              <span className="close-modal" onClick={() => setShowDamageReportModal(false)}>×</span>
            </div>
            <div className="modal-body damage-compensation-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
              <div className="incident-detail-card" style={{ width: '100%', gridColumn: '1 / -1' }}>
                <div className="incident-detail-item"><span className="incident-detail-label">Order ID</span><span className="incident-detail-value">#{damageTargetItem.order_id || 'N/A'}</span></div>
                <div className="incident-detail-item"><span className="incident-detail-label">Order Item ID</span><span className="incident-detail-value">#{damageTargetItem.item_id || 'N/A'}</span></div>
                <div className="incident-detail-item"><span className="incident-detail-label">Customer Name</span><span className="incident-detail-value">{getCustomerNameFromItem(damageTargetItem)}</span></div>
                <div className="incident-detail-item"><span className="incident-detail-label">Order Type</span><span className="incident-detail-value">{damageTargetItem.order_type === 'walk_in' ? 'Walk-in' : 'Online'}</span></div>
                <div className="incident-detail-item"><span className="incident-detail-label">Garment</span><span className="incident-detail-value">{Array.isArray(damageTargetItem.specific_data?.garments) && damageTargetItem.specific_data.garments.length > 0 ? damageTargetItem.specific_data.garments.map((g) => g?.garmentType || 'Unknown').join(', ') : (damageTargetItem.specific_data?.garmentType || 'N/A')}</span></div>
                <div className="incident-detail-item"><span className="incident-detail-label">Service</span><span className="incident-detail-value">{damageTargetItem.specific_data?.serviceName || 'N/A'}</span></div>
                <div className="incident-detail-item"><span className="incident-detail-label">Status</span><span className="incident-detail-value">{(damageTargetItem.approval_status || 'N/A').toString().replace(/_/g, ' ')}</span></div>
              </div>

              <div className="payment-form-group" style={{ width: '100%', gridColumn: '1 / -1' }}>
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

              <div className="payment-form-group" style={{ width: '100%', gridColumn: '1 / -1' }}>
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

              <div className="payment-form-group" style={{ width: '100%', gridColumn: '1 / -1' }}>
                <label>Affected Garments *</label>
                <div className="affected-garments-box" style={{ 
                  border: '1px solid #d7deea', 
                  borderRadius: '10px', 
                  padding: '8px', 
                  backgroundColor: '#f8faff',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {damageTargetItem && (() => {
                    try {
                      const specificData = typeof damageTargetItem.specific_data === 'string'
                        ? JSON.parse(damageTargetItem.specific_data)
                        : damageTargetItem.specific_data || {};
                      
                      let garments = Array.isArray(specificData.garments) ? specificData.garments : [];

                      // Walk-in dry cleaning orders can store a single garment in specific_data.garmentType.
                      if (!garments.length && specificData?.garmentType) {
                        const pricingFactors = typeof damageTargetItem?.pricing_factors === 'string'
                          ? JSON.parse(damageTargetItem.pricing_factors || '{}')
                          : (damageTargetItem?.pricing_factors || {});
                        const fallbackQtyRaw = parseInt(specificData?.quantity || pricingFactors?.quantity || 1, 10);
                        const fallbackQty = Number.isInteger(fallbackQtyRaw) && fallbackQtyRaw > 0 ? fallbackQtyRaw : 1;
                        garments = [{ garmentType: specificData.garmentType, quantity: fallbackQty }];
                      }

                      if (!Array.isArray(garments) || garments.length === 0) {
                        return <div style={{ padding: '10px', color: '#999' }}>No garments in this order</div>;
                      }

                      return garments.map((garment, idx) => {
                        const garmentType = garment.garmentType || garment.garment_type || `Garment ${idx + 1}`;
                        const garmentQty = garment.quantity || 1;
                        const isChecked = damageForm.affectedGarments.some(ag => ag.garmentType === garmentType);
                        const affectedGarment = damageForm.affectedGarments.find(ag => ag.garmentType === garmentType);
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
                                id={`garment-${idx}`}
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    const nextAffectedGarments = [...damageForm.affectedGarments, { garmentType, damagedQty: 1 }];
                                    const nextDamagedQty = nextAffectedGarments.reduce((sum, ag) => sum + (parseInt(ag.damagedQty || 0, 10) || 0), 0);
                                    setDamageForm({
                                      ...damageForm,
                                      affectedGarments: nextAffectedGarments,
                                      damagedQuantity: String(Math.max(1, nextDamagedQty))
                                    });
                                  } else {
                                    const nextAffectedGarments = damageForm.affectedGarments.filter(ag => ag.garmentType !== garmentType);
                                    const nextDamagedQty = nextAffectedGarments.reduce((sum, ag) => sum + (parseInt(ag.damagedQty || 0, 10) || 0), 0);
                                    setDamageForm({
                                      ...damageForm,
                                      affectedGarments: nextAffectedGarments,
                                      damagedQuantity: String(Math.max(1, nextDamagedQty))
                                    });
                                  }
                                }}
                              />
                              <label className="affected-garment-name" htmlFor={`garment-${idx}`}>
                                {garmentType} (qty: {garmentQty})
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
                                      const nextAffectedGarments = damageForm.affectedGarments.map(ag =>
                                        ag.garmentType === garmentType ? { ...ag, damagedQty: newQty } : ag
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
                    } catch (e) {
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

              <div className="payment-form-group" style={{ width: '100%', gridColumn: '1 / -1' }}>
                <label>Responsible Staff/Admin</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  placeholder="Name or identifier"
                  value={damageForm.responsibleParty}
                  onChange={(e) => setDamageForm({ ...damageForm, responsibleParty: e.target.value })}
                />
              </div>

              <div className="payment-form-group" style={{ width: '100%', gridColumn: '1 / -1' }}>
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

              <div className="payment-form-group" style={{ width: '100%', gridColumn: '1 / -1' }}>
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

              <div className="payment-form-group" style={{ width: '100%', gridColumn: '1 / -1' }}>
                <label>Compensation Amount (PHP)</label>
                <input
                  type="number"
                  className="form-control"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  min="0"
                  step="0.01"
                  value={damageForm.compensationAmount}
                  onChange={(e) => setDamageForm({ ...damageForm, compensationAmount: e.target.value })}
                />
              </div>

              <div className="payment-form-group" style={{ width: '100%', gridColumn: '1 / -1' }}>
                <label>Clothe Compensation Description</label>
                <textarea
                  rows={3}
                  className="form-control"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  placeholder="Describe the replacement clothe (e.g. same barong, size L, white). Leave blank if not offering clothe."
                  value={damageForm.clotheDescription}
                  onChange={(e) => setDamageForm({ ...damageForm, clotheDescription: e.target.value })}
                />
              </div>
              <div style={{ fontSize: '12px', color: '#666', gridColumn: '1 / -1' }}>
                ℹ️ Fill in one or both options. The customer will choose which compensation they prefer.
              </div>
            </div>
            <div className="modal-footer-centered" style={{ justifyContent: 'flex-end' }}>
              <button className="btn-cancel" onClick={() => setShowDamageReportModal(false)}>Cancel</button>
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

              <div className="payment-form-group">
                <label>Total Quantity</label>
                <input
                  type="number"
                  className="form-control"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  min="1"
                  step="1"
                  value={liabilityForm.totalQuantity}
                  onChange={(e) => setLiabilityForm({ ...liabilityForm, totalQuantity: e.target.value })}
                />
              </div>

              <div className="payment-form-group">
                <label>Damaged Quantity *</label>
                <input
                  type="number"
                  className="form-control"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  min="1"
                  step="1"
                  max={Math.max(1, parseInt(liabilityForm.totalQuantity || '1', 10) || 1)}
                  value={liabilityForm.damagedQuantity}
                  onChange={(e) => setLiabilityForm({ ...liabilityForm, damagedQuantity: e.target.value })}
                />
              </div>

              <div className="payment-form-group">
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

              <div className="payment-form-group">
                <label>Compensation Amount (PHP)</label>
                <input
                  type="number"
                  className="form-control"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  min="0"
                  step="0.01"
                  value={liabilityForm.compensationAmount}
                  onChange={(e) => setLiabilityForm({ ...liabilityForm, compensationAmount: e.target.value })}
                />
              </div>

              <div className="payment-form-group">
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

              <div className="payment-form-group">
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
              {(activeDamageIncident.damaged_quantity || activeDamageIncident.total_quantity) && (
                <div className="detail-row"><strong>Affected Quantity:</strong> {activeDamageIncident.damaged_quantity || 1} of {activeDamageIncident.total_quantity || 1}</div>
              )}
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

                  <div className="payment-form-group">
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



      <ImagePreviewModal

        isOpen={imagePreviewOpen}

        onClose={closeImagePreview}

        imageUrl={previewImageUrl}

        altText={previewImageAlt}

      />

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



export default DryCleaning;

