import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../adminStyle/dryclean.css';
import AdminHeader from './AdminHeader';
import Sidebar from './Sidebar';
import { getAllDryCleaningOrders, updateDryCleaningOrderItem } from '../api/DryCleaningOrderApi';
import { getUserRole } from '../api/AuthApi';
import { getAllDCGarmentTypesAdmin, createDCGarmentType, updateDCGarmentType, deleteDCGarmentType } from '../api/DryCleaningGarmentTypeApi';
import { recordPayment } from '../api/PaymentApi';
import { deleteOrderItem } from '../api/OrderApi';

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
  const [viewFilter, setViewFilter] = useState("all");
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
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

  const [showPriceConfirmationModal, setShowPriceConfirmationModal] = useState(false);
  const [priceConfirmationItem, setPriceConfirmationItem] = useState(null);
  const [priceConfirmationPrice, setPriceConfirmationPrice] = useState('');

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

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
    if (role !== 'admin') {
      setError('Admin access required');
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

  const getNextStatus = (currentStatus, serviceType = 'dry_cleaning', item = null) => {
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
    
    const flow = statusFlow[serviceType] || statusFlow['dry_cleaning'];
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

  const getNextStatusLabel = (currentStatus, serviceType = 'dry_cleaning', item = null) => {
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
    if (isAuthenticated() && getUserRole() === 'admin') {
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
        const result = await updateDryCleaningOrderItem(itemId, {
          approvalStatus: 'accepted',
          finalPrice: estimatedPrice
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
      const result = await updateDryCleaningOrderItem(priceConfirmationItem.item_id, {
        approvalStatus: 'price_confirmation',
        finalPrice: finalPrice
      });
      if (result.success) {
        await loadDryCleaningOrders();
        
        if (viewFilter !== 'all') {
          setViewFilter('price-confirmation');
        }
        showToast("Dry cleaning request moved to price confirmation!", "success");
        setShowPriceConfirmationModal(false);
        setPriceConfirmationItem(null);
        setPriceConfirmationPrice('');
      } else {
        showToast(result.message || "Failed to accept request", "error");
      }
    } catch (err) {
      console.error("Accept error:", err);
      showToast("Failed to accept request", "error");
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
          const result = await updateDryCleaningOrderItem(itemId, {
            approvalStatus: status
          });
          if (result.success) {
            await loadDryCleaningOrders();

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
      },
      'Confirm',
      'blue'
    );
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

    try {
      const result = await recordPayment(selectedOrder.item_id, amount);
      if (result.success) {
        const remaining = result.payment?.remaining_balance || 0;
        showToast(`Payment of ₱${amount.toFixed(2)} recorded successfully. ${remaining > 0 ? `Remaining balance: ₱${remaining.toFixed(2)}` : 'Payment complete!'}`, 'success');
        setShowPaymentModal(false);
        setPaymentAmount('');
        await loadDryCleaningOrders();
      } else {
        showToast(result.message || 'Failed to record payment', 'error');
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      showToast('Error recording payment', 'error');
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
            </div>
            <div className="stat-number">{stats.pending}</div>
          </div>
          <div className="stat-card">
            <div className="stat-header">
              <span>In Progress</span>
            </div>
            <div className="stat-number">{stats.inProgress}</div>
          </div>
          <div className="stat-card">
            <div className="stat-header">
              <span>To Pick up</span>
            </div>
            <div className="stat-number">{stats.toPickup}</div>
          </div>
          <div className="stat-card">
            <div className="stat-header">
              <span>Completed</span>
            </div>
            <div className="stat-number">{stats.completed}</div>
          </div>
          <div className="stat-card">
            <div className="stat-header">
              <span>Rejected</span>
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
                        ? `${item.specific_data.garments.length} garment${item.specific_data.garments.length > 1 ? 's' : ''}`
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
                          {item.approval_status !== 'completed' && item.approval_status !== 'cancelled' && (
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
                        </div>
                      ) : (
                        <div className="action-buttons">
                          {getNextStatus(item.approval_status, 'dry_cleaning', item) && (
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
                          {item.approval_status !== 'completed' && item.approval_status !== 'cancelled' && (
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
              <div className="detail-row"><strong>Date Received:</strong> {new Date(selectedOrder.order_date).toLocaleDateString()}</div>
              <div className="detail-row"><strong>Price:</strong> ₱{parseFloat(selectedOrder.final_price || 0).toLocaleString()}</div>
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
      {showPriceConfirmationModal && priceConfirmationItem && priceConfirmationItem.order_type !== 'walk_in' && (
        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowPriceConfirmationModal(false)}>
          <div className="modal-content">
            <div className="modal-header">
              <h2>Price Confirmation</h2>
              <span className="close-modal" onClick={() => setShowPriceConfirmationModal(false)}>×</span>
            </div>
            <div className="modal-body">
              <div className="detail-row"><strong>Order ID:</strong> #{priceConfirmationItem.order_id}</div>
              <div className="detail-row"><strong>Service:</strong> {priceConfirmationItem.specific_data?.serviceName || 'N/A'}</div>
              {/* Multiple garments support */}
              {priceConfirmationItem.specific_data?.garments && priceConfirmationItem.specific_data.garments.length > 0 ? (
                <>
                  <div className="detail-row"><strong>Garments:</strong> {priceConfirmationItem.specific_data.garments.length} item{priceConfirmationItem.specific_data.garments.length > 1 ? 's' : ''}</div>
                  {priceConfirmationItem.specific_data.garments.map((garment, idx) => (
                    <div key={idx} style={{ marginLeft: '20px', paddingLeft: '10px', borderLeft: '2px solid #e0e0e0', marginBottom: '4px' }}>
                      <span>{garment.garmentType ? (garment.garmentType.charAt(0).toUpperCase() + garment.garmentType.slice(1)) : 'N/A'} ({garment.brand || 'N/A'}) × {garment.quantity || 1}</span>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div className="detail-row"><strong>Garment Type:</strong> {priceConfirmationItem.specific_data?.garmentType || 'N/A'}</div>
                  <div className="detail-row"><strong>Quantity:</strong> {priceConfirmationItem.specific_data?.quantity || 1}</div>
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
    </div>
  );
};

export default DryCleaning;
