import React, { useState, useEffect, useRef } from 'react';
import AdminHeader from './AdminHeader';
import Sidebar from './Sidebar';
import '../adminStyle/rent.css';
import '../adminStyle/dryclean.css';
import { getAllRentalOrders, getRentalOrdersByStatus, updateRentalOrderItem, recordRentalPayment } from '../api/RentalOrderApi';
import { markRentalItemDamaged, restockReturnedRentalSizes, getRentalImageUrl } from '../api/RentalApi';
import { useAlert } from '../context/AlertContext';
import { deleteOrderItem } from '../api/OrderApi';
import SimpleImageCarousel from '../components/SimpleImageCarousel';

function Rental() {
  const { alert, confirm, prompt } = useAlert();
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewFilter, setViewFilter] = useState('all');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedRental, setSelectedRental] = useState(null);
  const [editData, setEditData] = useState({
    approvalStatus: '',
    adminNotes: '',
    damageNotes: ''
  });
  const [paymentAmount, setPaymentAmount] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [pendingRentedStatus, setPendingRentedStatus] = useState(null);
  const [showDamageFormModal, setShowDamageFormModal] = useState(false);
  const [damageFormContext, setDamageFormContext] = useState({ displayName: '', rows: [] });
  const [damageFormRows, setDamageFormRows] = useState([]);
  const damageFormResolverRef = useRef(null);

  const parseSizeEntries = (rawSize) => {
    if (!rawSize) return [];
    try {
      const parsed = typeof rawSize === 'string' ? JSON.parse(rawSize) : rawSize;
      if (!parsed || typeof parsed !== 'object') return [];
      if (Array.isArray(parsed.size_entries)) {
        return parsed.size_entries.map((entry) => ({
          key: entry?.sizeKey || entry?.size_key || '',
          label: entry?.label || entry?.sizeKey || 'Unknown',
          quantity: Math.max(0, parseInt(entry?.quantity, 10) || 0)
        })).filter((entry) => !!entry.key);
      }
    } catch {
      return [];
    }
    return [];
  };

  const parseSizeEntriesFromSelections = (selectedSizes) => {
    if (!Array.isArray(selectedSizes) || selectedSizes.length === 0) return [];
    const byKey = new Map();
    selectedSizes.forEach((entry) => {
      const key = String(entry?.sizeKey || entry?.size_key || '').trim();
      if (!key) return;
      const qty = Math.max(0, parseInt(entry?.quantity, 10) || 0);
      const label = entry?.label || key;
      const prev = byKey.get(key);
      if (!prev) {
        byKey.set(key, { key, label, quantity: qty });
      } else {
        byKey.set(key, { ...prev, quantity: prev.quantity + qty });
      }
    });
    return Array.from(byKey.values());
  };

  const mergeSizeRows = (rawSize, selectedSizes = []) => {
    const parsedRows = parseSizeEntries(rawSize);
    const selectedRows = parseSizeEntriesFromSelections(selectedSizes);
    if (selectedRows.length > 0) {
      const labelByKey = new Map(parsedRows.map((row) => [row.key, row.label]));
      return selectedRows.map((row) => ({
        key: row.key,
        label: labelByKey.get(row.key) || row.label,
        quantity: row.quantity
      }));
    }
    return parsedRows;
  };

  const parseSizeTextFallback = (rawSize) => {
    const text = String(rawSize || '').trim();
    if (!text) return [];
    return text
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const match = part.match(/^(.*?)(?:\s*[xX]\s*(\d+))?$/);
        const label = (match?.[1] || part).trim();
        const quantity = Math.max(0, parseInt(match?.[2], 10) || 1);
        return { label, quantity };
      });
  };

  const getCustomerSelectedSizes = (selectedSizes, fallbackSize) => {
    const rows = parseSizeEntriesFromSelections(selectedSizes);
    if (rows.length > 0) return rows;
    return parseSizeTextFallback(fallbackSize);
  };

  const formatCustomerSizeSummary = (selectedSizes, fallbackSize) => {
    const rows = getCustomerSelectedSizes(selectedSizes, fallbackSize);
    if (!rows.length) return 'N/A';
    return rows
      .filter((row) => row.quantity > 0)
      .map((row) => `${row.label} x${row.quantity}`)
      .join(', ') || 'N/A';
  };

  const openDamageForm = (displayName, sizeRows) => {
    setDamageFormContext({ displayName, rows: sizeRows });
    setDamageFormRows(sizeRows.map((row) => ({
      size_key: row.key,
      size_label: row.label,
      max_quantity: Math.max(0, parseInt(row.quantity, 10) || 0),
      is_damaged: false,
      quantity: 1,
      damage_level: 'minor',
      damage_note: ''
    })));
    setShowDamageFormModal(true);
  };

  const collectDamageInputsFromForm = async (displayName, rawSize, selectedSizes = []) => {
    const hasDamage = await confirm(
      `Is "${displayName}" damaged?`,
      'Check for Damage',
      'question',
      { confirmText: 'Yes', cancelText: 'No' }
    );
    if (!hasDamage) return [];

    const sizeRows = mergeSizeRows(rawSize, selectedSizes).filter((row) => row.quantity > 0);
    if (sizeRows.length === 0) {
      await alert(`Cannot mark damage for "${displayName}" because no return size quantity was found.`, 'Error', 'error');
      return null;
    }

    return await new Promise((resolve) => {
      damageFormResolverRef.current = resolve;
      openDamageForm(displayName, sizeRows);
    });
  };

  const updateDamageFormRow = (sizeKey, updates) => {
    setDamageFormRows((prev) => prev.map((row) => (
      row.size_key === sizeKey ? { ...row, ...updates } : row
    )));
  };

  const handleDamageFormCancel = () => {
    setShowDamageFormModal(false);
    const resolver = damageFormResolverRef.current;
    damageFormResolverRef.current = null;
    if (resolver) resolver(null);
  };

  const handleDamageFormSubmit = async () => {
    const selectedRows = damageFormRows.filter((row) => row.is_damaged);
    for (const row of selectedRows) {
      const qty = Math.max(0, parseInt(row.quantity, 10) || 0);
      if (qty <= 0 || qty > row.max_quantity) {
        await alert(`Invalid quantity for ${row.size_label}. Enter 1 to ${row.max_quantity}.`, 'Warning', 'warning');
        return;
      }
      const level = String(row.damage_level || '').trim().toLowerCase();
      if (!['minor', 'moderate', 'severe'].includes(level)) {
        await alert(`Invalid damage level for ${row.size_label}.`, 'Warning', 'warning');
        return;
      }
      if (!String(row.damage_note || '').trim()) {
        await alert(`Damage note is required for ${row.size_label}.`, 'Warning', 'warning');
        return;
      }
    }

    const payload = selectedRows.map((row) => ({
      size_key: row.size_key,
      size_label: row.size_label,
      quantity: Math.max(0, parseInt(row.quantity, 10) || 0),
      damage_level: String(row.damage_level || '').trim().toLowerCase(),
      damage_note: String(row.damage_note || '').trim()
    }));

    setShowDamageFormModal(false);
    const resolver = damageFormResolverRef.current;
    damageFormResolverRef.current = null;
    if (resolver) resolver(payload);
  };

  useEffect(() => {
    loadRentalOrders();
  }, []);

  const loadRentalOrders = async () => {
    setLoading(true);
    try {
      const result = await getAllRentalOrders();
      if (result.success) {

        setRentals([...result.orders]);
      } else {
        console.error('Failed to load rental orders:', result.message);
      }
    } catch (error) {
      console.error('Error loading rental orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    pending: rentals.filter(r => r.approval_status === 'pending' || r.approval_status === 'pending_review').length,
    ready_to_pickup: rentals.filter(r =>
      r.approval_status === 'ready_to_pickup' ||
      r.approval_status === 'ready_for_pickup' ||
      r.approval_status === 'accepted'
    ).length,
    rented: rentals.filter(r => r.approval_status === 'rented').length,
    returned: rentals.filter(r => r.approval_status === 'returned').length,
    rejected: rentals.filter(r => r.approval_status === 'cancelled').length
  };

  const getFilteredRentalsByView = () => {
    switch (viewFilter) {
      case 'pending':
        return rentals.filter(r => r.approval_status === 'pending' || r.approval_status === 'pending_review');
      case 'ready-to-pickup':
        return rentals.filter(r =>
          r.approval_status === 'ready_to_pickup' ||
          r.approval_status === 'ready_for_pickup' ||
          r.approval_status === 'accepted'
        );
      case 'rented':
        return rentals.filter(r => r.approval_status === 'rented');
      case 'returned':
        return rentals.filter(r => r.approval_status === 'returned');
      case 'rejected':
        return rentals.filter(r => r.approval_status === 'cancelled');
      default:
        return rentals;
    }
  };

  const filteredRentals = getFilteredRentalsByView().filter(rental => {
    const matchesSearch =
      rental.item_id?.toString().includes(searchTerm) ||
      rental.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rental.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (rental.walk_in_customer_name && rental.walk_in_customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (rental.walk_in_customer_email && rental.walk_in_customer_email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      rental.specific_data?.item_name?.toLowerCase().includes(searchTerm.toLowerCase());

    let normalizedStatus = rental.approval_status;
    if (rental.approval_status === 'pending_review') {
      normalizedStatus = 'pending';
    } else if (rental.approval_status === 'ready_for_pickup') {
      normalizedStatus = 'ready_to_pickup';
    } else if (rental.approval_status === 'accepted') {
      normalizedStatus = 'ready_to_pickup';
    } else if (rental.approval_status === 'cancelled') {
      normalizedStatus = 'cancelled';
    }

    const matchesStatus = !statusFilter || normalizedStatus === statusFilter;

    return matchesSearch && matchesStatus;
  }).sort((a, b) => {

    const isPendingA = a.approval_status === 'pending' || a.approval_status === 'pending_review' || !a.approval_status;
    const isPendingB = b.approval_status === 'pending' || b.approval_status === 'pending_review' || !b.approval_status;

    if (isPendingA && !isPendingB) return -1;
    if (!isPendingA && isPendingB) return 1;
    return 0;
  });

  const handleAccept = async (rental) => {
    const confirmed = await confirm(`Accept rental order ORD-${rental.order_id}?`, 'Accept Rental', 'warning');
    if (!confirmed) return;

    try {

      const isWalkIn = rental.order_type === 'walk_in';
      const nextStatus = isWalkIn ? 'rented' : 'ready_to_pickup';
      const successMessage = isWalkIn
        ? 'Walk-in rental accepted! Status changed to "Rented" (customer is already in-person)'
        : 'Rental accepted! Status changed to "Ready to Pick Up"';

      const result = await updateRentalOrderItem(rental.item_id, {
        approvalStatus: nextStatus
      });

      if (result.success) {
        await alert(successMessage, 'Success', 'success');
        await loadRentalOrders();
      } else {
        await alert(result.message || 'Failed to accept rental', 'Error', 'error');
      }
    } catch (error) {
      console.error('Error accepting rental:', error);
      await alert('Error accepting rental', 'Error', 'error');
    }
  };

  const handleDecline = async (rental) => {
    try {
      console.log('[DECLINE] Button clicked for rental:', rental.item_id, rental);

    const reason = await prompt('Please enter reason for declining this rental:', 'Decline Rental', 'Enter reason...');
      console.log('[DECLINE] Prompt returned:', reason);

      if (reason === null || reason === undefined) {
        console.log('[DECLINE] User cancelled the prompt');
        return;
      }

      if (!reason || reason.trim() === '') {
        console.log('[DECLINE] Empty reason provided');
        await alert('Please provide a reason for declining the rental', 'Warning', 'warning');
        return;
      }

      console.log('[DECLINE] Updating rental with reason:', reason.trim());
      const result = await updateRentalOrderItem(rental.item_id, {
        approvalStatus: 'cancelled',
        adminNotes: `Declined: ${reason.trim()}`
      });

      console.log('[DECLINE] Update result:', result);

      if (result.success) {
        await alert('Rental declined and cancelled', 'Success', 'success');
        await loadRentalOrders();
      } else {
        await alert(result.message || 'Failed to decline rental', 'Error', 'error');
      }
    } catch (error) {
      console.error('[DECLINE] Error declining rental:', error);
      await alert(`Error declining rental: ${error.message || 'Unknown error'}`, 'Error', 'error');
    }
  };

  const handleViewDetails = (rental) => {
    setSelectedRental(rental);
    setShowDetailModal(true);
  };

  const handleEditClick = (rental) => {
    setSelectedRental(rental);
    setEditData({
      approvalStatus: rental.approval_status,
      adminNotes: rental.specific_data?.adminNotes || '',
      damageNotes: rental.specific_data?.damageNotes || ''
    });
    setShowEditModal(true);
  };

  const handleDeleteOrder = async (rental) => {
    const statusText = rental.approval_status === 'cancelled' ? 'rejected' : 'completed';
    const confirmed = await confirm(
      `Are you sure you want to delete this ${statusText} rental order (ORD-${rental.order_id})?\n\nThis action cannot be undone.`,
      'Delete Order',
      'danger',
      { confirmText: 'Delete', cancelText: 'Cancel' }
    );

    if (!confirmed) return;

    try {
      const result = await deleteOrderItem(rental.item_id);
      if (result.success) {
        await alert('Order deleted successfully', 'Success', 'success');
        loadRentalOrders();
      } else {
        await alert(result.message || 'Failed to delete order', 'Error', 'error');
      }
    } catch (error) {
      console.error('Error deleting order:', error);
      await alert('Error deleting order', 'Error', 'error');
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedRental) return;

    if (editData.approvalStatus === 'rented') {
      const paidAmount = parseFloat(selectedRental?.specific_data?.paid_amount || selectedRental?.paid_amount || 0);
      const totalPrice = parseFloat(selectedRental?.specific_data?.total_price || selectedRental?.total_price || 0);
      const downpayment = totalPrice * 0.5;

      if (paidAmount < downpayment) {
        const recordPayment = await confirm(
          `Before marking as "Rented", you need to record the downpayment.\n\nRequired Downpayment: ₱${downpayment.toFixed(2)}\nAmount Paid: ₱${paidAmount.toFixed(2)}\n\nWould you like to record the payment now?`,
          'Payment Required',
          'warning',
          { confirmText: 'Record Payment', cancelText: 'Cancel' }
        );

        if (recordPayment) {

          setShowEditModal(false);
          setPaymentAmount(downpayment.toFixed(2));
          setCashReceived(downpayment.toFixed(2));
          setPendingRentedStatus(selectedRental.item_id);
          setShowPaymentModal(true);
          return;
        } else {
          return;
        }
      }
    }

    const updateData = {
      approvalStatus: editData.approvalStatus,
      adminNotes: editData.adminNotes
    };

    if (editData.approvalStatus === 'returned' && editData.damageNotes && editData.damageNotes.trim()) {
      updateData.damageNotes = editData.damageNotes.trim();
    } else if (editData.approvalStatus === 'returned' && (!editData.damageNotes || !editData.damageNotes.trim())) {

      updateData.damageNotes = null;
    }

    try {
      const result = await updateRentalOrderItem(selectedRental.item_id, updateData);

      if (result.success) {
        const message = editData.approvalStatus === 'returned' && editData.damageNotes && editData.damageNotes.trim()
          ? `Rental status updated to "${getStatusLabel(editData.approvalStatus)}". Damage noted - item set to maintenance.`
          : `Rental status updated to "${getStatusLabel(editData.approvalStatus)}"`;
        await alert(message, 'Success', 'success');
        setShowEditModal(false);
        await loadRentalOrders();
      } else {
        await alert(result.message || 'Failed to update rental', 'Error', 'error');
      }
    } catch (error) {
      console.error('Error updating rental:', error);
      await alert('Error updating rental', 'Error', 'error');
    }
  };

  const handleStatusUpdate = async (itemId, newStatus, rental = null) => {

    if (newStatus === 'rented') {

      const currentRental = rental || rentals.find(r => r.item_id === itemId);
      const paidAmount = parseFloat(currentRental?.specific_data?.paid_amount || currentRental?.paid_amount || 0);
      const totalPrice = parseFloat(currentRental?.specific_data?.total_price || currentRental?.total_price || 0);
      const downpayment = totalPrice * 0.5;

      if (paidAmount < downpayment) {

        const recordPayment = await confirm(
          `Before marking as "Rented", you need to record the downpayment.\n\nRequired Downpayment: ₱${downpayment.toFixed(2)}\nAmount Paid: ₱${paidAmount.toFixed(2)}\n\nWould you like to record the payment now?`,
          'Payment Required',
          'warning',
          { confirmText: 'Record Payment', cancelText: 'Cancel' }
        );

        if (recordPayment) {

          setSelectedRental(currentRental);
          setPaymentAmount(downpayment.toFixed(2));
          setCashReceived(downpayment.toFixed(2));
          setShowPaymentModal(true);
          setPendingRentedStatus(itemId);
          return;
        } else {
          return;
        }
      }
    }

    const confirmed = await confirm(`Update status to "${getStatusLabel(newStatus)}"?`, 'Update Status', 'warning');
    if (!confirmed) return;

    let damageNotes = null;
    const damageRequests = [];
    const restockRequests = [];

    if (newStatus === 'returned') {
      if (rental && rental.specific_data) {
        const isBundle = rental.specific_data?.is_bundle === true || rental.specific_data?.category === 'rental_bundle';
        const bundleItems = rental.specific_data?.bundle_items || [];

        if (isBundle && bundleItems.length > 0) {
          for (const bundleItem of bundleItems) {
            const selectedSizes = bundleItem.selected_sizes || bundleItem.selectedSizes || [];
            restockRequests.push({
              item_id: bundleItem.item_id || bundleItem.id,
              selected_sizes: selectedSizes
            });
            const damageInputs = await collectDamageInputsFromForm(
              bundleItem.item_name,
              bundleItem.size,
              selectedSizes
            );
            if (damageInputs === null) return;
            if (Array.isArray(damageInputs) && damageInputs.length > 0) {
              damageInputs.forEach((input) => {
                damageRequests.push({
                  item_id: bundleItem.item_id || bundleItem.id,
                  item_name: bundleItem.item_name,
                  damaged_customer_name: `${String(rental?.first_name || '').trim()} ${String(rental?.last_name || '').trim()}`.trim() || String(rental?.walk_in_customer_name || '').trim() || 'Customer',
                  ...input
                });
              });
            }
          }
        } else {
          const selectedSizes = rental?.specific_data?.selected_sizes || rental?.specific_data?.selectedSizes || [];
          restockRequests.push({
            item_id: rental?.service_id,
            selected_sizes: selectedSizes
          });
          const damageInputs = await collectDamageInputsFromForm(
            rental?.specific_data?.item_name || `Item #${rental?.service_id || rental?.item_id}`,
            rental?.specific_data?.size,
            selectedSizes
          );
          if (damageInputs === null) return;
          if (Array.isArray(damageInputs) && damageInputs.length > 0) {
            damageInputs.forEach((input) => {
              damageRequests.push({
                item_id: rental?.service_id,
                item_name: rental?.specific_data?.item_name || 'Rental Item',
                damaged_customer_name: `${String(rental?.first_name || '').trim()} ${String(rental?.last_name || '').trim()}`.trim() || String(rental?.walk_in_customer_name || '').trim() || 'Customer',
                ...input
              });
            });
          }
        }
      }
      damageNotes = damageRequests.length > 0 ? JSON.stringify(damageRequests) : null;
    }

    try {
      const updateData = {
        approvalStatus: newStatus
      };

      if (damageNotes) {
        updateData.damageNotes = damageNotes;
      }

      const result = await updateRentalOrderItem(itemId, updateData);

      if (result.success) {
        const message = damageNotes
          ? `Status updated to "${getStatusLabel(newStatus)}". Damage noted - item set to maintenance.`
          : `Status updated to "${getStatusLabel(newStatus)}"`;
        await alert(message, 'Success', 'success');

        if (newStatus === 'returned') {
          for (const restock of restockRequests) {
            try {
              await restockReturnedRentalSizes(restock.item_id, restock.selected_sizes || []);
            } catch (error) {
              console.warn('Failed to restock returned sizes:', error);
            }
          }

          for (const request of damageRequests) {
            try {
              const damageResult = await markRentalItemDamaged(request.item_id, {
                size_key: request.size_key,
                size_label: request.size_label,
                quantity: request.quantity,
                damage_level: request.damage_level,
                damage_note: request.damage_note,
                damaged_customer_name: request.damaged_customer_name
              });
              if (!damageResult?.success) {
                console.warn(`Failed to mark damaged item ${request.item_name}:`, damageResult?.message);
              }
            } catch (error) {
              console.warn(`Failed to mark damaged item ${request.item_name}:`, error);
            }
          }
        }

        setTimeout(() => {
          loadRentalOrders();
        }, 100);
      } else {
        await alert(result.message || 'Failed to update status', 'Error', 'error');
      }
    } catch (error) {
      console.error("Error updating status:", error);
      await alert('Error updating status', 'Error', 'error');
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedRental || !paymentAmount) {
      await alert('Please enter a payment amount', 'Error', 'error');
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      await alert('Please enter a valid payment amount', 'Error', 'error');
      return;
    }

    const pricingFactors = typeof selectedRental.pricing_factors === 'string'
      ? JSON.parse(selectedRental.pricing_factors || '{}')
      : (selectedRental.pricing_factors || {});
    const amountPaid = parseFloat(pricingFactors.amount_paid || 0);
    const finalPrice = parseFloat(selectedRental.final_price || 0);
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
      const result = await recordRentalPayment(selectedRental.item_id, amount, cashGiven, 'cash');
      if (result.success) {
        const changeAmount = parseFloat(result.payment?.change_amount || 0);
        await alert(`Payment of ₱${amount.toFixed(2)} recorded successfully. Change: ₱${changeAmount.toFixed(2)}. Remaining balance: ₱${result.payment.remaining_balance.toFixed(2)}`, 'Success', 'success');
        setShowPaymentModal(false);
        setPaymentAmount('');
        setCashReceived('');

        if (pendingRentedStatus) {
          const itemIdToUpdate = pendingRentedStatus;
          setPendingRentedStatus(null);

          const statusResult = await updateRentalOrderItem(itemIdToUpdate, {
            approvalStatus: 'rented'
          });

          if (statusResult.success) {
            await alert('Payment recorded and status updated to "Rented"', 'Success', 'success');
          } else {
            await alert('Payment recorded but failed to update status. Please update manually.', 'Warning', 'warning');
          }
        }

        await loadRentalOrders();
      } else {
        await alert(result.message || 'Failed to record payment', 'Error', 'error');
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      await alert('Error recording payment', 'Error', 'error');
    }
  };

  const getStatusClass = (status) => {

    let normalizedStatus = status === 'accepted' ? 'ready_to_pickup' : status;

    normalizedStatus = normalizedStatus === 'ready_for_pickup' ? 'ready_to_pickup' : normalizedStatus;

    normalizedStatus = normalizedStatus === 'cancelled' ? 'rejected' : normalizedStatus;

    const statusMap = {
      'pending': 'pending',
      'pending_review': 'pending',
      'ready_to_pickup': 'ready-to-pickup',
      'ready_for_pickup': 'ready-to-pickup',
      'picked_up': 'picked-up',
      'rented': 'rented',
      'returned': 'returned',
      'completed': 'completed',
      'cancelled': 'rejected',
      'rejected': 'rejected'
    };
    return statusMap[normalizedStatus] || 'unknown';
  };

  const getStatusLabel = (status) => {

    let normalizedStatus = status === 'accepted' ? 'ready_to_pickup' : status;
    normalizedStatus = normalizedStatus === 'ready_for_pickup' ? 'ready_to_pickup' : normalizedStatus;

    normalizedStatus = normalizedStatus === 'cancelled' ? 'rejected' : normalizedStatus;

    const labelMap = {
      'pending': 'Pending',
      'pending_review': 'Pending',
      'ready_to_pickup': 'Ready to Pick Up',
      'ready_for_pickup': 'Ready to Pick Up',
      'picked_up': 'Picked Up',
      'rented': 'Rented',
      'returned': 'Returned',
      'completed': 'Completed',
      'cancelled': 'Rejected',
      'rejected': 'Rejected'
    };
    return labelMap[normalizedStatus] || normalizedStatus;
  };

  const getNextStatus = (currentStatus, serviceType = 'rental', item = null) => {

    if (serviceType === 'rental') {

      const isWalkIn = item?.order_type === 'walk_in';

      if (!currentStatus || currentStatus === 'pending_review' || currentStatus === 'pending') {

        return isWalkIn ? 'rented' : 'ready_to_pickup';
      }

      let normalizedStatus = currentStatus;
      if (currentStatus === 'ready_for_pickup' || currentStatus === 'accepted') {
        normalizedStatus = 'ready_to_pickup';
      }

      if (normalizedStatus === 'ready_to_pickup') {
        return 'rented';
      } else if (normalizedStatus === 'rented') {
        return 'returned';
      } else if (normalizedStatus === 'returned') {
        return 'completed';
      }
      return null;
    }

    const statusFlow = {
      'repair': ['pending', 'accepted', 'price_confirmation', 'confirmed', 'ready_for_pickup', 'completed'],
      'customization': ['pending', 'accepted', 'price_confirmation', 'confirmed', 'ready_for_pickup', 'completed'],
      'dry_cleaning': ['pending', 'accepted', 'price_confirmation', 'confirmed', 'ready_for_pickup', 'completed']
    };

    const flow = statusFlow[serviceType];
    if (!flow) return null;

    const currentIndex = flow.indexOf(currentStatus);

    if (currentIndex === -1 || currentIndex === flow.length - 1) {
      return null;
    }

    return flow[currentIndex + 1];
  };

  const getNextStatusLabel = (currentStatus, serviceType = 'rental') => {
    const nextStatus = getNextStatus(currentStatus, serviceType);
    if (!nextStatus) return null;

    const labelMap = {
      'price_confirmation': 'Price Confirm',
      'confirmed': 'Start Progress',
      'ready_for_pickup': 'Ready for Pickup',
      'ready_to_pickup': 'Ready for Pickup',
      'completed': 'Complete',
      'picked_up': 'Mark Picked Up',
      'rented': 'Mark Rented',
      'returned': 'Mark Returned'
    };

    return labelMap[nextStatus] || getStatusLabel(nextStatus);
  };

  return (
    <div className="dry-cleaning-management">
      <Sidebar />
      <AdminHeader />

      <div className="content">
        <div className="dashboard-title">
          <div>
            <h2>Rental Management</h2>
            <p>Track and manage all rental orders</p>
          </div>
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
              <span>Ready to Pick Up</span>
              <div className="stat-icon" style={{ background: '#e3f2fd', color: '#2196f3' }}>
                <i className="fas fa-box"></i>
              </div>
            </div>
            <div className="stat-number">{stats.ready_to_pickup}</div>
          </div>
          <div className="stat-card">
            <div className="stat-header">
              <span>Rented</span>
              <div className="stat-icon" style={{ background: '#f3e5f5', color: '#9c27b0' }}>
                <i className="fas fa-tshirt"></i>
              </div>
            </div>
            <div className="stat-number">{stats.rented}</div>
          </div>
          <div className="stat-card">
            <div className="stat-header">
              <span>Returned</span>
              <div className="stat-icon" style={{ background: '#e8f5e9', color: '#4caf50' }}>
                <i className="fas fa-check"></i>
              </div>
            </div>
            <div className="stat-number">{stats.returned}</div>
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
            placeholder="Search by ID, Name, or Item"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select className="status-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="ready_to_pickup">Ready to Pick Up</option>
            <option value="rented">Rented</option>
            <option value="returned">Returned</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Rejected</option>
          </select>
        </div>

        <div className="table-container">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}>
              Loading rental orders...
            </div>
          ) : (
            <div className="table-scroll-viewport">
            <table>
              <thead>
                <tr className="tr-rental">
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Rented Item</th>
                  <th>Rental Period</th>
                  <th>Total Price</th>
                  <th>Payment Status</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRentals.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '60px', color: '#888' }}>
                      No rental orders found
                    </td>
                  </tr>
                ) : (
                  filteredRentals.map(rental => {
                    const isPending = rental.approval_status === 'pending' || rental.approval_status === 'pending_review';
                    const downpaymentAmount = rental.pricing_factors?.downpayment || rental.specific_data?.downpayment || 0;

                    const pricingFactors = typeof rental.pricing_factors === 'string'
                      ? JSON.parse(rental.pricing_factors || '{}')
                      : (rental.pricing_factors || {});
                    const amountPaid = parseFloat(pricingFactors.amount_paid || 0);
                    const finalPrice = parseFloat(rental.final_price || 0);
                    const remainingBalance = finalPrice - amountPaid;

                    return (
                      <tr key={rental.item_id} className="clickable-row" onClick={() => handleViewDetails(rental)}>
                        <td><strong>ORD-{rental.order_id}</strong></td>
                        <td>
                          {rental.order_type === 'walk_in' ? (
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
                              {rental.walk_in_customer_name || 'Walk-in Customer'}
                            </span>
                          ) : (
                            `${rental.first_name || ''} ${rental.last_name || ''}`.trim() || 'N/A'
                          )}
                        </td>
                        <td style={{ color: '#8B4513', fontWeight: '600' }}>{rental.specific_data?.item_name || 'N/A'}</td>
                        <td>
                          {rental.rental_start_date && rental.rental_end_date ? (
                            <>
                              <div>{rental.rental_start_date} to {rental.rental_end_date}</div>
                              {(rental.approval_status === 'rented' || rental.approval_status === 'picked_up') && (() => {
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                const endDate = new Date(rental.rental_end_date);
                                endDate.setHours(0, 0, 0, 0);
                                const diffTime = endDate - today;
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                                if (diffDays < 0) {
                                  const daysOverdue = Math.abs(diffDays);
                                  return (
                                    <div style={{
                                      backgroundColor: '#f8d7da',
                                      color: '#721c24',
                                      fontSize: '11px',
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      marginTop: '4px',
                                      fontWeight: '600'
                                    }}>
                                      🚨 {daysOverdue}d OVERDUE (₱{daysOverdue * 100})
                                    </div>
                                  );
                                } else if (diffDays === 0) {
                                  return (
                                    <div style={{
                                      backgroundColor: '#fff3cd',
                                      color: '#856404',
                                      fontSize: '11px',
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      marginTop: '4px',
                                      fontWeight: '600'
                                    }}>
                                      ⏰ DUE TODAY
                                    </div>
                                  );
                                } else if (diffDays <= 3) {
                                  return (
                                    <div style={{
                                      backgroundColor: '#e7f3ff',
                                      color: '#004085',
                                      fontSize: '11px',
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      marginTop: '4px',
                                      fontWeight: '500'
                                    }}>
                                      📅 Due in {diffDays}d
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </>
                          ) : 'N/A'}
                        </td>
                        <td style={{
                          textDecoration: rental.approval_status === 'cancelled' ? 'line-through' : 'none',
                          color: rental.approval_status === 'cancelled' ? '#999' : 'inherit'
                        }}>
                          ₱{finalPrice.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </td>
                        <td>
                          <div style={{ fontSize: '12px' }}>
                            <div>Paid: ₱{amountPaid.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                            <div style={{ color: remainingBalance > 0 ? '#ff9800' : '#4caf50', fontWeight: 'bold' }}>
                              Remaining: ₱{Math.max(0, remainingBalance).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                            </div>
                          </div>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <span
                            className={`status-badge ${getStatusClass(rental.approval_status || 'pending')}`}
                            style={{
                              display: 'inline-block',
                              visibility: 'visible',
                              opacity: 1,
                              minWidth: '120px',
                              textAlign: 'center'
                            }}
                          >
                            {getStatusLabel(rental.approval_status || 'pending')}
                          </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            const isCompleted = rental.approval_status === 'completed';
                            const isRejected = rental.approval_status === 'cancelled';

                            if (isCompleted) {
                              return (
                                <div className="action-buttons">
                                  <button
                                    className="icon-btn delete"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteOrder(rental);
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
                                </div>
                              );
                            }

                            if (isRejected) {
                              return (
                                <div className="action-buttons">
                                  <button
                                    className="icon-btn delete"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteOrder(rental);
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
                                </div>
                              );
                            }

                            return (
                            <div className="action-buttons">
                                {(() => {
                                  const currentStatus = rental.approval_status || 'pending';
                                  const nextStatus = getNextStatus(currentStatus, 'rental', rental);
                                  if (!nextStatus) return null;
                                  const nextStatusLabel = getNextStatusLabel(currentStatus, 'rental');

                                  const isMovingToRented = nextStatus === 'rented';
                                  const hasNoPayment = amountPaid <= 0;
                                  const isWalkIn = rental.order_type === 'walk_in';

                                  const isCurrentlyRented = currentStatus === 'rented';
                                  const hasRemainingBalance = remainingBalance > 0;

                                  const shouldDisable = (!isWalkIn && isMovingToRented && hasNoPayment) || (isCurrentlyRented && hasRemainingBalance);

                                  let disableMessage = '';
                                  if (!isWalkIn && isMovingToRented && hasNoPayment) {
                                    disableMessage = `Record payment first before moving to ${nextStatusLabel}`;
                                  } else if (isCurrentlyRented && hasRemainingBalance) {
                                    disableMessage = `Full payment required (₱${remainingBalance.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})} remaining) before moving to ${nextStatusLabel}`;
                                  }

                                  return (
                                    <button
                                      className="icon-btn next-status"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (shouldDisable) {

                                          return;
                                        }
                                        handleStatusUpdate(rental.item_id, nextStatus, rental);
                                      }}
                                      title={shouldDisable ? disableMessage : `Move to ${nextStatusLabel}`}
                                      disabled={shouldDisable}
                                      style={{
                                        backgroundColor: shouldDisable ? '#ccc' : '#4CAF50',
                                        color: 'white',
                                        zIndex: 10,
                                        cursor: shouldDisable ? 'not-allowed' : 'pointer',
                                        opacity: shouldDisable ? 0.6 : 1
                                      }}
                                    >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="9 18 15 12 9 6"></polyline>
                                </svg>
                              </button>
                                  );
                                })()}
                                {isPending && (
                                  <button
                                    className="icon-btn decline"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      console.log('[DECLINE] Button clicked, isPending:', isPending, 'rental:', rental);
                                      handleDecline(rental).catch(err => {
                                        console.error('[DECLINE] Unhandled error:', err);
                                        alert('An unexpected error occurred while declining the rental', 'Error', 'error');
                                      });
                                    }}
                                    title="Decline"
                                    type="button"
                                    style={{ cursor: 'pointer', zIndex: 10, position: 'relative' }}
                                  >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18"></line>
                                  <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                              </button>
                                )}
                                {rental.approval_status !== 'cancelled' && rental.approval_status !== 'pending' && rental.approval_status !== 'pending_review' && rental.approval_status !== 'price_confirmation' && !isPending && (
                                <button
                                    className="icon-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedRental(rental);
                                      setPaymentAmount('');
                                      setCashReceived('');
                                      setShowPaymentModal(true);
                                    }}
                                    title="Record Payment"
                                    style={{
                                      backgroundColor: '#2196F3',
                                      color: 'white'
                                    }}
                                  >
                                    💰
                                </button>
                              )}
                            </div>
                            );
                          })()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>
      {showEditModal && selectedRental && (
        <div className="modal-overlay active" onClick={(e) => {
          if (e.target.classList.contains('modal-overlay')) setShowEditModal(false);
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Rental Order</h2>
              <span className="close-modal" onClick={() => setShowEditModal(false)}>×</span>
            </div>
            <div className="modal-body">
              <div className="detail-row">
                <strong>Order ID:</strong>
                <span>ORD-{selectedRental.order_id}</span>
              </div>
              <div className="detail-row">
                <strong>Customer:</strong>
                <span>{selectedRental.first_name} {selectedRental.last_name}</span>
              </div>
              <div className="detail-row">
                <strong>Item:</strong>
                <span>{selectedRental.specific_data?.item_name || 'N/A'}</span>
              </div>
              <div className="detail-row">
                <strong>Current Status:</strong>
                <span className={`status-badge ${getStatusClass(selectedRental.approval_status)}`}>
                  {getStatusLabel(selectedRental.approval_status)}
                </span>
              </div>

              <div className="form-group" style={{ marginTop: '20px' }}>
                <label>Update Status</label>
                <select
                  value={editData.approvalStatus}
                  onChange={(e) => {

                    const newStatus = e.target.value;
                    const isWalkIn = selectedRental.order_type === 'walk_in';
                    if (isWalkIn && (newStatus === 'ready_to_pickup' || newStatus === 'ready_for_pickup')) {
                      alert('Walk-in rentals skip "Ready to Pick Up" status. Status set to "Rented".', 'Info', 'info');
                      setEditData({ ...editData, approvalStatus: 'rented' });
                    } else {
                      setEditData({ ...editData, approvalStatus: newStatus });
                    }
                  }}
                  className="form-control"
                >
                  {selectedRental.order_type !== 'walk_in' && (
                    <option value="ready_for_pickup">Ready to Pick Up</option>
                  )}
                  <option value="rented">Rented</option>
                  <option value="returned">Returned</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Rejected</option>
                </select>
                {selectedRental.order_type === 'walk_in' && (
                  <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#fff3cd', borderRadius: '4px', fontSize: '0.9em', color: '#856404' }}>
                    ℹ️ Walk-in rentals skip "Ready to Pick Up" (customer is already in-person).
                  </div>
                )}
              </div>

              {editData.approvalStatus === 'returned' && (
                <div className="form-group">
                  <label>Damage Notes (Optional)</label>
                  <textarea
                    value={editData.damageNotes}
                    onChange={(e) => setEditData({ ...editData, damageNotes: e.target.value })}
                    className="form-control"
                    rows="3"
                    placeholder="Describe any damage to the item. If damage is noted, the item will be set to maintenance status..."
                  />
                  <small style={{ color: '#666', marginTop: '5px', display: 'block' }}>
                    If damage is noted, the rental item will be automatically set to "maintenance" status.
                  </small>
                </div>
              )}
              <div className="form-group">
                <label>Admin Notes (Optional)</label>
                <textarea
                  value={editData.adminNotes}
                  onChange={(e) => setEditData({ ...editData, adminNotes: e.target.value })}
                  className="form-control"
                  rows="3"
                  placeholder="Add any notes about this rental..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowEditModal(false)}>
                Cancel
              </button>
              <button className="btn-save" onClick={handleSaveEdit}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
      {showDamageFormModal && (
        <div className="modal-overlay active" onClick={(e) => {
          if (e.target.classList.contains('modal-overlay')) handleDamageFormCancel();
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '820px' }}>
            <div className="modal-header">
              <h2>Damage Form - {damageFormContext.displayName}</h2>
              <span className="close-modal" onClick={handleDamageFormCancel}>×</span>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '10px', color: '#555' }}>
                Fill out only sizes that are damaged. Unchecked sizes are treated as no damage.
              </p>
              <div style={{ border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#fafafa' }}>
                      <th style={{ textAlign: 'center', padding: '8px' }}>Damaged?</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Size</th>
                      <th style={{ textAlign: 'center', padding: '8px' }}>Returned Qty</th>
                      <th style={{ textAlign: 'center', padding: '8px' }}>Damaged Qty</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Level</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Damage Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {damageFormRows.map((row, idx) => (
                      <tr key={row.size_key} style={{ borderTop: idx === 0 ? 'none' : '1px solid #f1f1f1' }}>
                        <td style={{ textAlign: 'center', padding: '8px' }}>
                          <input
                            type="checkbox"
                            checked={row.is_damaged}
                            onChange={(e) => updateDamageFormRow(row.size_key, { is_damaged: e.target.checked })}
                          />
                        </td>
                        <td style={{ padding: '8px', fontWeight: 600 }}>{row.size_label}</td>
                        <td style={{ textAlign: 'center', padding: '8px', fontWeight: 700 }}>{row.max_quantity}</td>
                        <td style={{ textAlign: 'center', padding: '8px' }}>
                          <input
                            type="number"
                            min="1"
                            max={row.max_quantity}
                            disabled={!row.is_damaged}
                            value={row.quantity}
                            onChange={(e) => updateDamageFormRow(row.size_key, { quantity: e.target.value })}
                            style={{ width: '80px' }}
                          />
                        </td>
                        <td style={{ padding: '8px' }}>
                          <select
                            disabled={!row.is_damaged}
                            value={row.damage_level}
                            onChange={(e) => updateDamageFormRow(row.size_key, { damage_level: e.target.value })}
                          >
                            <option value="minor">Minor</option>
                            <option value="moderate">Moderate</option>
                            <option value="severe">Severe</option>
                          </select>
                        </td>
                        <td style={{ padding: '8px' }}>
                          <input
                            type="text"
                            disabled={!row.is_damaged}
                            value={row.damage_note}
                            onChange={(e) => updateDamageFormRow(row.size_key, { damage_note: e.target.value })}
                            placeholder="Describe the damage"
                            style={{ width: '100%' }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer-centered">
              <button className="btn-cancel" onClick={handleDamageFormCancel}>Cancel</button>
              <button className="btn-save" onClick={handleDamageFormSubmit}>Apply Damage</button>
            </div>
          </div>
        </div>
      )}
      {showPaymentModal && selectedRental && (
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
                <span>ORD-{selectedRental.order_id}</span>
              </div>
              <div className="detail-row">
                <strong>Customer:</strong>
                <span>{selectedRental.first_name} {selectedRental.last_name}</span>
              </div>
              <div className="detail-row">
                <strong>Item:</strong>
                <span>{selectedRental.specific_data?.item_name || 'N/A'}</span>
              </div>
              <div className="detail-row">
                <strong>Total Price:</strong>
                <span style={{
                  textDecoration: selectedRental.approval_status === 'cancelled' ? 'line-through' : 'none',
                  color: selectedRental.approval_status === 'cancelled' ? '#999' : 'inherit'
                }}>
                  ₱{parseFloat(selectedRental.final_price || 0).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </span>
              </div>
              {(() => {
                const pricingFactors = typeof selectedRental.pricing_factors === 'string'
                  ? JSON.parse(selectedRental.pricing_factors || '{}')
                  : (selectedRental.pricing_factors || {});
                const amountPaid = parseFloat(pricingFactors.amount_paid || 0);
                const finalPrice = parseFloat(selectedRental.final_price || 0);
                const remaining = finalPrice - amountPaid;
                const penalty = parseFloat(pricingFactors.penalty || 0);
                const penaltyDays = parseInt(pricingFactors.penaltyDays || 0);

                return (
                  <>
                    {penalty > 0 && penaltyDays > 0 && (
                      <div className="detail-row" style={{
                        backgroundColor: '#fff3cd',
                        padding: '12px',
                        borderRadius: '6px',
                        border: '1px solid #ffc107',
                        marginBottom: '10px'
                      }}>
                        <strong style={{ color: '#856404' }}>⚠️ Late Return Penalty:</strong>
                        <span style={{ color: '#856404', fontWeight: 'bold' }}>
                          ₱{penalty.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ({penaltyDays} day{penaltyDays > 1 ? 's' : ''} exceeded)
                        </span>
                      </div>
                    )}
                    <div className="detail-row">
                      <strong>Amount Paid:</strong>
                      <span style={{ color: '#4caf50', fontWeight: 'bold' }}>
                        ₱{amountPaid.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </span>
                    </div>
                    <div className="detail-row">
                      <strong>Remaining Balance:</strong>
                      <span style={{ color: remaining > 0 ? '#ff9800' : '#4caf50', fontWeight: 'bold' }}>
                        ₱{Math.max(0, remaining).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </span>
                    </div>
                  </>
                );
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
      {showDetailModal && selectedRental && (
        <div className="modal-overlay active" onClick={(e) => {
          if (e.target.classList.contains('modal-overlay')) setShowDetailModal(false);
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Rental Details</h2>
              <span className="close-modal" onClick={() => setShowDetailModal(false)}>×</span>
            </div>
            <div className="modal-body">
              {(() => {
                const isBundle = selectedRental.specific_data?.is_bundle === true || selectedRental.specific_data?.category === 'rental_bundle';
                const bundleItems = selectedRental.specific_data?.bundle_items || [];

                if (isBundle && bundleItems.length > 0) {
                  return (
                    <>
                      <div className="detail-row" style={{ marginBottom: '20px' }}>
                        <strong style={{ display: 'block', marginBottom: '10px' }}>Rental Items:</strong>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                          {bundleItems.map((bundleItem, idx) => {

                            const itemImages = [
                              bundleItem.front_image && { url: getRentalImageUrl(bundleItem.front_image), label: 'Front' },
                              bundleItem.back_image && { url: getRentalImageUrl(bundleItem.back_image), label: 'Back' },
                              bundleItem.side_image && { url: getRentalImageUrl(bundleItem.side_image), label: 'Side' },
                              bundleItem.image_url && bundleItem.image_url !== 'no-image' && { url: getRentalImageUrl(bundleItem.image_url), label: 'Main' }
                            ].filter(Boolean);

                            return (
                              <div key={idx} style={{
                                border: '1px solid #e0e0e0',
                                borderRadius: '8px',
                                padding: '15px',
                                backgroundColor: '#f9f9f9'
                              }}>
                                <strong style={{ display: 'block', marginBottom: '10px', color: '#333' }}>
                                  {bundleItem.item_name || `Item ${idx + 1}`}
                                </strong>
                                {itemImages.length > 0 && (
                                  <SimpleImageCarousel
                                    images={itemImages}
                                    itemName={bundleItem.item_name}
                                    height="180px"
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="detail-row">
                        <strong>Rented Item:</strong>
                        <span>{bundleItems.map(item => item.item_name).join(', ') || 'N/A'}</span>
                      </div>
                      <div className="detail-row">
                        <strong>Category:</strong>
                        <span>{[...new Set(bundleItems.map(item => item.category || 'rental'))].join(', ') || 'N/A'}</span>
                      </div>
                      <div className="detail-row">
                        <strong>Order Details:</strong>
                        <span>
                          {bundleItems.map((item) => `${item.item_name || 'Rental Item'} (${formatCustomerSizeSummary(item.selected_sizes || item.selectedSizes, item.size)})`).join('; ')}
                        </span>
                      </div>
                    </>
                  );
                } else {

                  const singleItemImages = [
                    selectedRental.specific_data?.front_image && { url: getRentalImageUrl(selectedRental.specific_data.front_image), label: 'Front' },
                    selectedRental.specific_data?.back_image && { url: getRentalImageUrl(selectedRental.specific_data.back_image), label: 'Back' },
                    selectedRental.specific_data?.side_image && { url: getRentalImageUrl(selectedRental.specific_data.side_image), label: 'Side' },
                    selectedRental.specific_data?.image_url && { url: getRentalImageUrl(selectedRental.specific_data.image_url), label: 'Main' }
                  ].filter(Boolean);

                  return (
                    <>
                      {singleItemImages.length > 0 && (
                        <div className="detail-row" style={{ marginBottom: '15px' }}>
                          <strong style={{ display: 'block', marginBottom: '10px' }}>Item Photos:</strong>
                          <SimpleImageCarousel
                            images={singleItemImages}
                            itemName={selectedRental.specific_data?.item_name}
                            height="200px"
                          />
                        </div>
                      )}
                      <div className="detail-row">
                        <strong>Rented Item:</strong>
                        <span>{selectedRental.specific_data?.item_name || 'N/A'}</span>
                      </div>
                      <div className="detail-row">
                        <strong>Category:</strong>
                        <span>{(selectedRental.specific_data?.category || 'N/A').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                      </div>
                      <div className="detail-row">
                        <strong>Order Details:</strong>
                        <span>
                          {`${selectedRental.specific_data?.item_name || 'Rental Item'} (${formatCustomerSizeSummary(selectedRental.specific_data?.selected_sizes || selectedRental.specific_data?.selectedSizes, selectedRental.specific_data?.size)})`}
                        </span>
                      </div>
                    </>
                  );
                }
              })()}
              <div className="detail-row">
                <strong>Order ID:</strong>
                <span>ORD-{selectedRental.order_id}</span>
              </div>
              {selectedRental.order_type === 'walk_in' && (
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
                  {selectedRental.order_type === 'walk_in'
                    ? (selectedRental.walk_in_customer_name || 'Walk-in Customer')
                    : `${selectedRental.first_name || ''} ${selectedRental.last_name || ''}`.trim() || 'N/A'}
                </span>
              </div>
              {selectedRental.order_type === 'walk_in' ? (
                <>
                  {selectedRental.walk_in_customer_email && (
                    <div className="detail-row"><strong>Email:</strong> <span>{selectedRental.walk_in_customer_email}</span></div>
                  )}
                  {selectedRental.walk_in_customer_phone && (
                    <div className="detail-row"><strong>Phone:</strong> <span>{selectedRental.walk_in_customer_phone}</span></div>
                  )}
                </>
              ) : (
                <>
                  <div className="detail-row">
                    <strong>Email:</strong>
                    <span>{selectedRental.email || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <strong>Phone:</strong>
                    <span>{selectedRental.phone_number || 'N/A'}</span>
                  </div>
                </>
              )}
              <div className="detail-row" style={{ alignItems: 'flex-start', flexDirection: 'column' }}>
                <strong style={{ marginBottom: '10px', textAlign: 'left', display: 'block', width: '100%' }}>Customer Selected Sizes:</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', alignItems: 'stretch' }}>
                  {(() => {
                    const isBundle = selectedRental.specific_data?.is_bundle === true || selectedRental.specific_data?.category === 'rental_bundle';
                    const bundleItems = selectedRental.specific_data?.bundle_items || [];

                    if (isBundle && bundleItems.length > 0) {
                      return bundleItems.map((item, idx) => {
                        const sizeData = getCustomerSelectedSizes(item.selected_sizes || item.selectedSizes, item.size);
                        return (
                          <div key={idx} style={{
                            fontSize: '0.9rem',
                            lineHeight: '1.8',
                            padding: '12px 16px',
                            backgroundColor: '#f5f5f5',
                            borderRadius: '6px',
                            border: '1px solid #e0e0e0',
                            width: '100%',
                            maxWidth: '100%'
                          }}>
                            <strong style={{ color: '#333', display: 'block', marginBottom: '10px', borderBottom: '1px solid #ddd', paddingBottom: '8px', textAlign: 'left' }}>
                              {item.item_name || `Item ${idx + 1}`}:
                            </strong>
                            {sizeData && Array.isArray(sizeData) ? (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 16px', color: '#666' }}>
                                {sizeData.map((sizeEntry, mIdx) => (
                                  <React.Fragment key={mIdx}>
                                    <span style={{ fontWeight: '500', textAlign: 'left' }}>{sizeEntry.label}</span>
                                    <span style={{ textAlign: 'right' }}>x{sizeEntry.quantity}</span>
                                  </React.Fragment>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: '#666', textAlign: 'left', display: 'block' }}>N/A</span>
                            )}
                          </div>
                        );
                      });
                    } else {
                      const sizeData = getCustomerSelectedSizes(
                        selectedRental.specific_data?.selected_sizes || selectedRental.specific_data?.selectedSizes,
                        selectedRental.specific_data?.size
                      );
                      if (sizeData && Array.isArray(sizeData)) {
                        return (
                          <div style={{
                            fontSize: '0.9rem',
                            lineHeight: '1.8',
                            padding: '12px 16px',
                            backgroundColor: '#f5f5f5',
                            borderRadius: '6px',
                            border: '1px solid #e0e0e0',
                            width: '100%',
                            maxWidth: '100%'
                          }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 16px', color: '#666' }}>
                              {sizeData.map((sizeEntry, mIdx) => (
                                <React.Fragment key={mIdx}>
                                  <span style={{ fontWeight: '500', textAlign: 'left' }}>{sizeEntry.label}</span>
                                  <span style={{ textAlign: 'right' }}>x{sizeEntry.quantity}</span>
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return <span style={{ color: '#666', textAlign: 'left', display: 'block' }}>N/A</span>;
                    }
                  })()}
                </div>
              </div>
              <div className="detail-row">
                <strong>Rental Period:</strong>
                <span>
                  {selectedRental.rental_start_date && selectedRental.rental_end_date
                    ? `${selectedRental.rental_start_date} to ${selectedRental.rental_end_date}`
                    : 'N/A'}
                </span>
              </div>
              {(selectedRental.approval_status === 'rented' || selectedRental.approval_status === 'picked_up') &&
               selectedRental.rental_end_date && (() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const endDate = new Date(selectedRental.rental_end_date);
                endDate.setHours(0, 0, 0, 0);
                const diffTime = endDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays < 0) {
                  const daysOverdue = Math.abs(diffDays);
                  const currentPenalty = daysOverdue * 100;
                  return (
                    <div style={{
                      backgroundColor: '#f8d7da',
                      border: '1px solid #f5c6cb',
                      borderRadius: '8px',
                      padding: '16px',
                      marginBottom: '15px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '28px' }}>🚨</span>
                        <div>
                          <div style={{ color: '#721c24', fontWeight: '700', fontSize: '16px' }}>
                            OVERDUE: {daysOverdue} Day{daysOverdue > 1 ? 's' : ''} Past Due Date!
                          </div>
                          <div style={{ color: '#721c24', fontSize: '14px', marginTop: '4px' }}>
                            Expected penalty: <strong>₱{currentPenalty.toLocaleString()}</strong> (₱100/day)
                          </div>
                        </div>
                      </div>
                      <div style={{ color: '#856404', fontSize: '13px', backgroundColor: '#fff3cd', padding: '8px 12px', borderRadius: '4px' }}>
                        📧 Automated email notifications are being sent to the customer about this overdue rental.
                      </div>
                    </div>
                  );
                } else if (diffDays === 0) {
                  return (
                    <div style={{
                      backgroundColor: '#fff3cd',
                      border: '1px solid #ffc107',
                      borderRadius: '8px',
                      padding: '16px',
                      marginBottom: '15px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '28px' }}>⏰</span>
                        <div>
                          <div style={{ color: '#856404', fontWeight: '700', fontSize: '16px' }}>
                            DUE TODAY! Rental must be returned today.
                          </div>
                          <div style={{ color: '#856404', fontSize: '13px', marginTop: '4px' }}>
                            Late returns will incur a penalty of ₱100 per day starting tomorrow.
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                } else if (diffDays <= 3) {
                  return (
                    <div style={{
                      backgroundColor: '#e7f3ff',
                      border: '1px solid #b3d7ff',
                      borderRadius: '8px',
                      padding: '16px',
                      marginBottom: '15px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '28px' }}>📅</span>
                        <div>
                          <div style={{ color: '#004085', fontWeight: '600', fontSize: '15px' }}>
                            Due in {diffDays} Day{diffDays > 1 ? 's' : ''} ({new Date(selectedRental.rental_end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})
                          </div>
                          <div style={{ color: '#004085', fontSize: '13px', marginTop: '4px' }}>
                            Reminder emails have been sent to the customer.
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="detail-row">
                <strong>Order Date:</strong>
                <span>{selectedRental.order_date || 'N/A'}</span>
              </div>
              <div className="detail-row">
                <strong>Total Price:</strong>
                <span style={{
                  color: selectedRental.approval_status === 'cancelled' ? '#999' : '#2e7d32',
                  fontWeight: 'bold',
                  textDecoration: selectedRental.approval_status === 'cancelled' ? 'line-through' : 'none'
                }}>
                  ₱{parseFloat(selectedRental.final_price || 0).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </span>
              </div>
              {(() => {
                const pricingFactors = typeof selectedRental.pricing_factors === 'string'
                  ? JSON.parse(selectedRental.pricing_factors || '{}')
                  : (selectedRental.pricing_factors || {});
                const amountPaid = parseFloat(pricingFactors.amount_paid || 0);
                const finalPrice = parseFloat(selectedRental.final_price || 0);
                const remaining = finalPrice - amountPaid;
                const penalty = parseFloat(pricingFactors.penalty || 0);
                const penaltyDays = parseInt(pricingFactors.penaltyDays || 0);

                return (
                  <>
                    {penalty > 0 && penaltyDays > 0 && (
                      <div className="detail-row" style={{
                        backgroundColor: '#fff3cd',
                        padding: '12px',
                        borderRadius: '6px',
                        border: '1px solid #ffc107',
                        marginBottom: '10px'
                      }}>
                        <strong style={{ color: '#856404' }}>⚠️ Late Return Penalty:</strong>
                        <span style={{ color: '#856404', fontWeight: 'bold' }}>
                          ₱{penalty.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ({penaltyDays} day{penaltyDays > 1 ? 's' : ''} exceeded)
                        </span>
                      </div>
                    )}
              <div className="detail-row">
                      <strong>Amount Paid:</strong>
                      <span style={{ color: '#4caf50', fontWeight: 'bold' }}>
                        ₱{amountPaid.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </span>
              </div>
                    <div className="detail-row">
                      <strong>Remaining Balance:</strong>
                      <span style={{ color: remaining > 0 ? '#ff9800' : '#4caf50', fontWeight: 'bold' }}>
                        ₱{Math.max(0, remaining).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        {remaining <= 0 && finalPrice > 0 && ' (Fully Paid)'}
                      </span>
                    </div>
                  </>
                );
              })()}
              <div className="detail-row">
                <strong>Status:</strong>
                <span className={`status-badge ${getStatusClass(selectedRental.approval_status)}`}>
                  {getStatusLabel(selectedRental.approval_status)}
                </span>
              </div>
              {selectedRental.specific_data?.notes && (
                <div className="detail-row">
                  <strong>Customer Notes:</strong>
                  <span>{selectedRental.specific_data.notes}</span>
                </div>
              )}
              {selectedRental.specific_data?.adminNotes && (
                <div className="detail-row">
                  <strong>Admin Notes:</strong>
                  <span>{selectedRental.specific_data.adminNotes}</span>
                </div>
              )}
              {selectedRental.specific_data?.damageNotes && (
                <div className="detail-row" style={{
                  backgroundColor: '#ffebee',
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid #f44336',
                  marginTop: '10px'
                }}>
                  <strong style={{ color: '#c62828' }}>⚠️ Damage Notes:</strong>
                  <span style={{ color: '#c62828', fontWeight: '500', display: 'block', marginTop: '5px' }}>
                    {selectedRental.specific_data.damageNotes}
                  </span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowDetailModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Rental;