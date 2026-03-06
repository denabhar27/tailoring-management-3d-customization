import React, { useState, useEffect } from 'react';
import '../adminStyle/dryclean.css';
import AdminHeader from './AdminHeader';
import Sidebar from './Sidebar';
import { getAllRepairOrders, getRepairOrdersByStatus, updateRepairOrderItem } from '../api/RepairOrderApi';
import ImagePreviewModal from '../components/ImagePreviewModal';
import SimpleImageCarousel from '../components/SimpleImageCarousel';
import { useAlert } from '../context/AlertContext';
import { getAllRepairGarmentTypesAdmin, createRepairGarmentType, updateRepairGarmentType, deleteRepairGarmentType } from '../api/RepairGarmentTypeApi';
import { recordPayment } from '../api/PaymentApi';
import { deleteOrderItem } from '../api/OrderApi';
import { API_BASE_URL } from '../api/config';

const Repair = () => {
  const { alert, confirm } = useAlert();
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewFilter, setViewFilter] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
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
    is_active: 1
  });

  const [showPriceConfirmationModal, setShowPriceConfirmationModal] = useState(false);
  const [priceConfirmationItem, setPriceConfirmationItem] = useState(null);
  const [priceConfirmationPrice, setPriceConfirmationPrice] = useState('');

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
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

  const getNextStatus = (currentStatus, serviceType = 'repair', item = null) => {
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

    const flow = statusFlow[serviceType] || statusFlow['repair'];
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

  const getNextStatusLabel = (currentStatus, serviceType = 'repair', item = null) => {
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
    loadRepairOrders();
    loadRepairGarmentTypes();
  }, []);

  const loadRepairGarmentTypes = async () => {
    setLoadingRepairGarmentTypes(true);
    try {
      const result = await getAllRepairGarmentTypesAdmin();
      if (result.success) {
        setRepairGarmentTypes(result.garments || []);
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

    try {
      let result;
      if (editingRepairGarmentType) {
        result = await updateRepairGarmentType(editingRepairGarmentType.repair_garment_id, repairGarmentTypeForm);
      } else {
        result = await createRepairGarmentType(repairGarmentTypeForm);
      }

      if (result.success) {
        alert(editingRepairGarmentType ? 'Repair garment type updated successfully!' : 'Repair garment type created successfully!', 'Success');
        setShowRepairGarmentTypeModal(false);
        setRepairGarmentTypeForm({ garment_name: '', description: '', is_active: 1 });
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
    setRepairGarmentTypeForm({
      garment_name: garment.garment_name,
      description: garment.description || '',
      is_active: garment.is_active
    });
    setShowRepairGarmentTypeModal(true);
  };

  const openNewRepairGarmentType = () => {
    setEditingRepairGarmentType(null);
    setRepairGarmentTypeForm({ garment_name: '', description: '', is_active: 1 });
    setShowRepairGarmentTypeModal(true);
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
    setShowPriceConfirmationModal(true);
  };

  const handlePriceConfirmationSubmit = async () => {
    if (!priceConfirmationItem) return;

    const finalPrice = parseFloat(priceConfirmationPrice);
    if (isNaN(finalPrice) || finalPrice <= 0) {
      showToast("Please enter a valid price", "error");
      return;
    }

    try {
      const result = await updateRepairOrderItem(priceConfirmationItem.item_id, {
        approvalStatus: 'price_confirmation',
        finalPrice: finalPrice
      });
      if (result.success) {
        await loadRepairOrders();

        if (viewFilter !== 'all') {
          setViewFilter('price-confirmation');
        }
        showToast("Repair request moved to price confirmation!", "success");
        setShowPriceConfirmationModal(false);
        setPriceConfirmationItem(null);
        setPriceConfirmationPrice('');
      } else {
        showToast(result.message || "Failed to accept repair request", "error");
      }
    } catch (err) {
      console.error("Accept error:", err);
      showToast("Failed to accept repair request", "error");
    }
  };

  const handleDecline = async (itemId) => {
    console.log("Declining item:", itemId);
    const confirmed = await confirm("Decline this repair request?", "Decline Repair", "warning");
    if (confirmed) {
      try {
        const result = await updateRepairOrderItem(itemId, {
          approvalStatus: 'cancelled'
        });
        console.log("Decline result:", result);
        if (result.success) {
          loadRepairOrders();
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
      const amountPaid = parseFloat(pricingFactors.amount_paid || 0);
      const finalPrice = parseFloat(item.final_price || 0);
      const remainingBalance = finalPrice - amountPaid;

      if (remainingBalance > 0.01) {
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
        loadRepairOrders();
      } else {
        await alert(result.message || 'Failed to delete order', 'Error', 'error');
      }
    } catch (error) {
      console.error('Error deleting order:', error);
      await alert('Error deleting order', 'Error', 'error');
    }
  };

  const getEstimatedPrice = (item) => {
    if (!item || !item.specific_data) return null;
    const damageLevel = item.specific_data.damageLevel;
    const prices = {
      'minor': 300,
      'moderate': 500,
      'major': 800,
      'severe': 1200
    };
    return item.specific_data.estimatedPrice || prices[damageLevel] || null;
  };

  const handleSaveEdit = async () => {
    if (!selectedOrder) return;

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

    try {
      const result = await recordPayment(selectedOrder.item_id, amount);
      if (result.success) {
        const remaining = result.payment?.remaining_balance || 0;
        await alert(`Payment of ₱${amount.toFixed(2)} recorded successfully. ${remaining > 0 ? `Remaining balance: ₱${remaining.toFixed(2)}` : 'Payment complete!'}`, 'Success', 'success');
        setShowPaymentModal(false);
        setPaymentAmount('');
        await loadRepairOrders();
      } else {
        await alert(result.message || 'Failed to record payment', 'Error', 'error');
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      await alert('Error recording payment', 'Error', 'error');
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
            <option value="accepted">Accepted</option>
            <option value="price_confirmation">Price Confirmation</option>
            <option value="confirmed">In Progress</option>
            <option value="ready_for_pickup">To Pick up</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Rejected</option>
          </select>
        </div>
        <div className="table-container">
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
                getFilteredItems().map(item => {

                  const pricingFactors = typeof item.pricing_factors === 'string'
                    ? JSON.parse(item.pricing_factors || '{}')
                    : (item.pricing_factors || {});
                  const amountPaid = parseFloat(pricingFactors.amount_paid || 0);
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
                      <td>{new Date(item.order_date).toLocaleDateString()}</td>
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
                            {getNextStatus(item.approval_status, 'repair', item) && (
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
                            {item.approval_status !== 'completed' && item.approval_status !== 'cancelled' && item.approval_status !== 'price_confirmation' && (
                              <button
                                className="icon-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedOrder(item);
                                  setPaymentAmount('');
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

              <div className="detail-row"><strong>Damage Description:</strong> {selectedOrder.specific_data?.damageDescription || 'N/A'}</div>

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
                      <div className="detail-row"><strong>Damage Level:</strong> {garment.damageLevel ? garment.damageLevel.charAt(0).toUpperCase() + garment.damageLevel.slice(1) : 'N/A'}</div>
                      <div className="detail-row"><strong>Description:</strong> {garment.notes || 'N/A'}</div>
                      <div className="detail-row"><strong>Price:</strong> ₱{garment.basePrice || 'N/A'}</div>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div className="detail-row"><strong>Garment:</strong> {selectedOrder.specific_data?.garmentType || 'N/A'}</div>
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

              <div className="detail-row"><strong>Damage Description:</strong> {selectedOrder.specific_data?.damageDescription || 'N/A'}</div>
              <div className="detail-row"><strong>Date Received:</strong> {new Date(selectedOrder.order_date).toLocaleDateString()}</div>
              <div className="detail-row"><strong>Estimated Time:</strong> {selectedOrder.pricing_factors?.estimatedTime || 'N/A'}</div>
              <div className="detail-row"><strong>Repair Cost:</strong> ₱{parseFloat(selectedOrder.final_price || 0).toLocaleString()}</div>
              <div className="detail-row"><strong>Status:</strong>
                <span className={`status-badge ${getStatusClass(selectedOrder.approval_status || 'pending')}`}>
                  {getStatusText(selectedOrder.approval_status || 'pending')}
                </span>
              </div>

              {selectedOrder.pricing_factors?.adminNotes && (
                <div className="detail-row"><strong>Admin Notes:</strong> {selectedOrder.pricing_factors.adminNotes}</div>
              )}
            </div>
            <div className="modal-footer">
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
                setRepairGarmentTypeForm({ garment_name: '', description: '', is_active: 1 });
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
                setRepairGarmentTypeForm({ garment_name: '', description: '', is_active: 1 });
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
              <div className="detail-row"><strong>Garment Type:</strong> {priceConfirmationItem.specific_data?.garmentType || 'N/A'}</div>
              <div className="detail-row"><strong>Damage Level:</strong> {priceConfirmationItem.specific_data?.damageLevel || 'N/A'}</div>

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

              <div style={{ marginTop: '15px', padding: '12px', backgroundColor: '#e3f2fd', borderRadius: '4px', fontSize: '0.9em', color: '#1976d2' }}>
                ℹ️ Customer will be notified to confirm the price before proceeding.
              </div>
            </div>
            <div className="modal-footer-centered">
              <button className="btn-cancel" onClick={() => setShowPriceConfirmationModal(false)}>Cancel</button>
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
            </div>
            <div className="modal-footer-centered">
              <button className="btn-cancel" onClick={() => {
                setShowPaymentModal(false);
                setPaymentAmount('');
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
    </div>
  );
};

export default Repair;
