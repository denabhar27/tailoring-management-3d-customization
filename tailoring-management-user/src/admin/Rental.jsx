import React, { useState, useEffect, useRef } from 'react';

import AdminHeader from './AdminHeader';

import Sidebar from './Sidebar';

import '../adminStyle/rent.css';

import '../adminStyle/dryclean.css';

import { getAllRentalOrders, getRentalOrdersByStatus, updateRentalOrderItem, recordRentalPayment, recordRentalDepositReturn } from '../api/RentalOrderApi';

import { markRentalItemDamaged, restockReturnedRentalSizes, getRentalImageUrl, getRentalById } from '../api/RentalApi';

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

  const [showDepositReturnModal, setShowDepositReturnModal] = useState(false);

  const [selectedRental, setSelectedRental] = useState(null);

  const [selectedRentalWithMeasurements, setSelectedRentalWithMeasurements] = useState(null);

  const [editData, setEditData] = useState({

    approvalStatus: '',

    adminNotes: '',

    damageNotes: ''

  });

  const [paymentAmount, setPaymentAmount] = useState('');

  const [cashReceived, setCashReceived] = useState('');

  const [requiredPaymentAmount, setRequiredPaymentAmount] = useState(0);

  const [pendingRentedStatus, setPendingRentedStatus] = useState(null);

  const [depositReturnAmount, setDepositReturnAmount] = useState('');

  const [showPricingSetupModal, setShowPricingSetupModal] = useState(false);

  const [pendingPricingRental, setPendingPricingRental] = useState(null);

  const [pendingPricingData, setPendingPricingData] = useState({

    paymentMode: 'regular',

    finalPrice: '',

    flatRateUntilDate: ''

  });

  const [showDamageFormModal, setShowDamageFormModal] = useState(false);

  const [damageFormContext, setDamageFormContext] = useState({ displayName: '', rows: [] });

  const [damageFormRows, setDamageFormRows] = useState([]);

  const damageFormResolverRef = useRef(null);

  const flatRateMinDate = new Date().toISOString().split('T')[0];

  const parsePricingFactors = (rawPricingFactors) => {
    try {
      return typeof rawPricingFactors === 'string'
        ? JSON.parse(rawPricingFactors || '{}')
        : (rawPricingFactors || {});
    } catch {
      return {};
    }
  };

  const getRentalPaymentSnapshot = (rental) => {
    const pricingFactors = parsePricingFactors(rental?.pricing_factors);
    const finalPrice = parseFloat(rental?.final_price || 0);
    
    // Calculate deposit from selected sizes
    const selectedSizes = rental?.specific_data?.selected_sizes || rental?.specific_data?.selectedSizes || [];
    const depositFromSizes = selectedSizes.reduce((total, size) => {
      const quantity = parseInt(size.quantity || 0, 10);
      const deposit = parseFloat(size.deposit || 0);
      return total + (quantity * deposit);
    }, 0);
    const depositAmount = depositFromSizes > 0 ? depositFromSizes : parseFloat(pricingFactors?.downpayment || pricingFactors?.deposit_amount || rental?.specific_data?.downpayment || 0);
    
    const amountPaid = parseFloat(pricingFactors?.amount_paid || 0);
    const totalPayment = finalPrice + depositAmount;

    return {
      finalPrice,
      depositAmount,
      amountPaid,
      totalPayment,
      requiredDepositNow: Math.max(0, depositAmount - amountPaid),
      remainingBalance: Math.max(0, totalPayment - amountPaid)
    };
  };

  const getDepositReturnSnapshot = (rental) => {
    const pricingFactors = parsePricingFactors(rental?.pricing_factors);
    
    // Calculate deposit from selected sizes
    const selectedSizes = rental?.specific_data?.selected_sizes || rental?.specific_data?.selectedSizes || [];
    const depositFromSizes = selectedSizes.reduce((total, size) => {
      const quantity = parseInt(size.quantity || 0, 10);
      const deposit = parseFloat(size.deposit || 0);
      return total + (quantity * deposit);
    }, 0);
    const depositAmount = depositFromSizes > 0 ? depositFromSizes : parseFloat(pricingFactors?.downpayment || pricingFactors?.deposit_amount || rental?.specific_data?.downpayment || 0);
    
    const refundedAmount = parseFloat(rental?.deposit_refunded || pricingFactors?.deposit_refunded_amount || 0);
    
    // Parse damage notes to get damaged sizes
    let damagedSizes = [];
    let damagedDepositAmount = 0;
    let nonRefundableNotes = [];
    
    try {
      const damageNotes = rental?.specific_data?.damageNotes;
      if (damageNotes) {
        const damageData = typeof damageNotes === 'string' ? JSON.parse(damageNotes) : damageNotes;
        if (Array.isArray(damageData)) {
          damageData.forEach(damage => {
            const sizeKey = damage.size_key || damage.sizeKey;
            const damagedQty = parseInt(damage.quantity || 0, 10);
            
            // Find matching size in selected sizes
            const matchingSize = selectedSizes.find(s => 
              (s.sizeKey || s.size_key) === sizeKey
            );
            
            if (matchingSize && damagedQty > 0) {
              const depositPerUnit = parseFloat(matchingSize.deposit || 0);
              const damagedAmount = depositPerUnit * damagedQty;
              damagedDepositAmount += damagedAmount;
              
              damagedSizes.push({
                sizeKey: sizeKey,
                label: matchingSize.label || damage.size_label,
                quantity: damagedQty,
                depositPerUnit: depositPerUnit,
                totalDamaged: damagedAmount,
                reason: `${damage.size_label} is damaged (${damage.damage_type || 'damage'}) - deposit cannot be returned`
              });
              
              nonRefundableNotes.push(
                `${matchingSize.label || damage.size_label} ×${damagedQty}: ₱${damagedAmount.toFixed(2)} (${damage.damage_type || 'damage'})`
              );
            }
          });
        }
      }
    } catch (e) {
      console.error('Error parsing damage notes:', e);
    }
    
    // Calculate refundable amount (excluding damaged deposits)
    const refundableRemaining = Math.max(0, depositAmount - refundedAmount - damagedDepositAmount);

    return {
      depositAmount,
      refundedAmount,
      damagedDepositAmount,
      refundableRemaining,
      refundedAt: rental?.deposit_refund_date || pricingFactors?.deposit_refunded_at || null,
      damagedSizes,
      nonRefundableNotes
    };
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentAmount('');
    setCashReceived('');
    setRequiredPaymentAmount(0);
    setPendingRentedStatus(null);
  };

  const closeDepositReturnModal = () => {
    setShowDepositReturnModal(false);
    setDepositReturnAmount('');
  };



  const parseSizeEntries = (rawSize) => {

    if (!rawSize) return [];

    try {

      const parsed = typeof rawSize === 'string' ? JSON.parse(rawSize) : rawSize;

      if (!parsed || typeof parsed !== 'object') return [];

      if (Array.isArray(parsed.size_entries)) {

        return parsed.size_entries.map((entry) => {

          const measurements = entry?.measurements || entry?.measurement_profile || entry?.measurementProfile || null;

          return {

            key: entry?.sizeKey || entry?.size_key || '',

            label: entry?.label || entry?.sizeKey || 'Unknown',

            quantity: Math.max(0, parseInt(entry?.quantity, 10) || 0),

            measurements: measurements

          };

        }).filter((entry) => !!entry.key);

      }

    } catch {

      return [];

    }

    return [];

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



  const getComputedStatus = (rental) => {

    if (rental?.rental_start_date && isToday(rental.rental_start_date)) {

      return 'appointment-today';

    }

    if (rental?.rental_end_date && isToday(rental.rental_end_date)) {

      return 'due-today';

    }

    return null;

  };



  const parseSizeEntriesFromSelections = (selectedSizes) => {

    if (!Array.isArray(selectedSizes) || selectedSizes.length === 0) return [];

    const byKey = new Map();

    selectedSizes.forEach((entry) => {

      const key = String(entry?.sizeKey || entry?.size_key || '').trim();

      if (!key) return;

      const qty = Math.max(0, parseInt(entry?.quantity, 10) || 0);

      const label = entry?.label || key;

      const measurements = entry?.measurements || null;

      const prev = byKey.get(key);

      if (!prev) {

        byKey.set(key, { key, label, quantity: qty, measurements });

      } else {

        byKey.set(key, { ...prev, quantity: prev.quantity + qty, measurements: measurements || prev.measurements });

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

      damage_choice: 'damage',

      damage_level: 'minor',


      comment_text: ''

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

      row.size_key === sizeKey

        ? (() => {

          const nextRow = { ...row, ...updates };

          if (Object.prototype.hasOwnProperty.call(updates, 'is_damaged') && !updates.is_damaged) {

            nextRow.damage_choice = 'damage';

            nextRow.damage_level = 'minor';

            nextRow.comment_text = '';

          }

          if (Object.prototype.hasOwnProperty.call(updates, 'damage_choice') && updates.damage_choice !== 'damage') {

            nextRow.damage_level = 'minor';

          }

          return nextRow;

        })()

        : row

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

      const damageChoice = String(row.damage_choice || 'damage').trim().toLowerCase();

      if (!['damage', 'lost', 'replaced'].includes(damageChoice)) {

        await alert(`Invalid issue choice for ${row.size_label}.`, 'Warning', 'warning');

        return;

      }

      if (damageChoice === 'damage') {

        const level = String(row.damage_level || '').trim().toLowerCase();

        if (!['minor', 'moderate', 'severe'].includes(level)) {

          await alert(`Invalid damage level for ${row.size_label}.`, 'Warning', 'warning');

          return;

        }

      }

      if (!String(row.comment_text || '').trim()) {

        await alert(`Comment text is required for ${row.size_label}.`, 'Warning', 'warning');

        return;

      }

    }



    const payload = selectedRows.map((row) => ({

      damage_type: String(row.damage_choice || 'damage').trim().toLowerCase(),

      size_key: row.size_key,

      size_label: row.size_label,

      quantity: Math.max(0, parseInt(row.quantity, 10) || 0),

      damage_level: String(row.damage_choice || 'damage').trim().toLowerCase() === 'damage'

        ? String(row.damage_level || '').trim().toLowerCase()

        : 'minor',

      damage_note: String(row.comment_text || '').trim()

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



    const computedStatus = getComputedStatus(rental);

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



    const matchesStatus = !statusFilter || computedStatus === statusFilter || normalizedStatus === statusFilter;



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

  const openPendingPricingSetup = (rental) => {

    const currentFinalPrice = parseFloat(rental?.final_price || 0);

    let currentPricingFactors = {};

    try {

      currentPricingFactors = typeof rental?.pricing_factors === 'string'

        ? JSON.parse(rental.pricing_factors || '{}')

        : (rental?.pricing_factors || {});

    } catch (e) {

      currentPricingFactors = {};

    }

    // Calculate deposit from selected sizes
    const selectedSizes = rental?.specific_data?.selected_sizes || rental?.specific_data?.selectedSizes || [];
    const depositFromSizes = selectedSizes.reduce((total, size) => {
      const quantity = parseInt(size.quantity || 0, 10);
      const deposit = parseFloat(size.deposit || 0);
      return total + (quantity * deposit);
    }, 0);
    const depositAmount = depositFromSizes > 0 ? depositFromSizes : parseFloat(currentPricingFactors?.downpayment || rental?.specific_data?.downpayment || 0);

    const fallbackPrice = parseFloat(rental?.specific_data?.total_price || 0);

    // Default price should be total_price (rental + deposit) from user's order
    const defaultPrice = fallbackPrice > 0 ? fallbackPrice : (currentFinalPrice + depositAmount);

    const currentPaymentMode = String(currentPricingFactors?.rental_payment_mode || 'regular').toLowerCase();
    const currentFlatRateUntilDate = String(currentPricingFactors?.flat_rate_until_date || '');



    setPendingPricingRental(rental);

    setPendingPricingData({

      paymentMode: currentPaymentMode === 'flat_rate' ? 'flat_rate' : 'regular',

      finalPrice: defaultPrice > 0 ? defaultPrice.toFixed(2) : '',

      flatRateUntilDate: currentFlatRateUntilDate

    });

    setShowPricingSetupModal(true);

  };



  const submitPendingPricingSetup = async () => {

    if (!pendingPricingRental) return;



    const parsedPrice = parseFloat(pendingPricingData.finalPrice);

    if (Number.isNaN(parsedPrice) || parsedPrice <= 0) {

      await alert('Please enter a valid payment amount greater than 0.', 'Invalid Amount', 'warning');

      return;

    }

    if (pendingPricingData.paymentMode === 'flat_rate' && !pendingPricingData.flatRateUntilDate) {

      await alert('Please select the calendar date until when flat rate applies.', 'Flat Rate Date Required', 'warning');

      return;

    }



    // Calculate deposit from selected sizes
    const selectedSizes = pendingPricingRental?.specific_data?.selected_sizes || pendingPricingRental?.specific_data?.selectedSizes || [];
    const depositFromSizes = selectedSizes.reduce((total, size) => {
      const quantity = parseInt(size.quantity || 0, 10);
      const deposit = parseFloat(size.deposit || 0);
      return total + (quantity * deposit);
    }, 0);
    let currentPricingFactors = {};
    try {
      currentPricingFactors = typeof pendingPricingRental?.pricing_factors === 'string'
        ? JSON.parse(pendingPricingRental.pricing_factors || '{}')
        : (pendingPricingRental?.pricing_factors || {});
    } catch (e) {
      currentPricingFactors = {};
    }
    const depositAmount = depositFromSizes > 0 ? depositFromSizes : parseFloat(currentPricingFactors?.downpayment || pendingPricingRental?.specific_data?.downpayment || 0);
    const rentalPriceOnly = parsedPrice - depositAmount;

    const isWalkIn = pendingPricingRental.order_type === 'walk_in';

    const nextStatus = isWalkIn ? 'rented' : 'ready_to_pickup';



    try {

      const result = await updateRentalOrderItem(pendingPricingRental.item_id, {

        approvalStatus: nextStatus,

        finalPrice: rentalPriceOnly,

        paymentMode: pendingPricingData.paymentMode,

        flatRateUntilDate: pendingPricingData.paymentMode === 'flat_rate' ? pendingPricingData.flatRateUntilDate : null

      });



      if (result.success) {

        setShowPricingSetupModal(false);

        setPendingPricingRental(null);

        setPendingPricingData({ paymentMode: 'regular', finalPrice: '', flatRateUntilDate: '' });

        await alert('Rental pricing option saved and status updated.', 'Success', 'success');

        await loadRentalOrders();

      } else {

        await alert(result.message || 'Failed to save pricing setup', 'Error', 'error');

      }

    } catch (error) {

      console.error('Error saving pending pricing setup:', error);

      await alert('Failed to save pricing setup', 'Error', 'error');

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



  const handleViewDetails = async (rental) => {

    setSelectedRental(rental);

    setShowDetailModal(true);

    

    // Try to fetch measurements from the rental item

    // Check multiple possible ID fields

    const rentalItemId = rental.service_id || rental.specific_data?.service_id || rental.specific_data?.item_id || rental.specific_data?.id;

    const isBundle = rental.specific_data?.is_bundle === true || rental.specific_data?.category === 'rental_bundle';

    const bundleItems = rental.specific_data?.bundle_items || [];

    

    console.log('Attempting to fetch rental item:', rentalItemId, 'from rental:', rental);

    

    if (isBundle && bundleItems.length > 0) {

      // Fetch measurements for each bundle item

      try {

        const enrichedBundleItems = await Promise.all(

          bundleItems.map(async (item) => {

            const itemId = item.item_id || item.id;
            console.log('Processing bundle item:', item.item_name, 'itemId:', itemId);

            if (!itemId) return item;

            

            try {

              const result = await getRentalById(itemId);
              console.log('Fetched result for', item.item_name, ':', result);

              if (result.item && result.item.size) {

                const sizeConfig = parseSizeEntries(result.item.size);
                console.log('Size config for', item.item_name, ':', sizeConfig);

                const measurementsBySizeKey = {};

                sizeConfig.forEach(sizeEntry => {

                  if (sizeEntry.measurements) {

                    measurementsBySizeKey[sizeEntry.key] = sizeEntry.measurements;

                  }

                });
                console.log('Measurements by size key for', item.item_name, ':', measurementsBySizeKey);

                return { ...item, measurementsBySizeKey };

              }

            } catch (error) {

              console.error(`Error fetching measurements for bundle item ${itemId}:`, error);

            }

            return item;

          })

        );
        console.log('All enriched bundle items:', enrichedBundleItems);

        

        const enrichedRental = {

          ...rental,

          specific_data: {

            ...rental.specific_data,

            bundle_items: enrichedBundleItems

          }

        };

        

        setSelectedRentalWithMeasurements(enrichedRental);

      } catch (error) {

        console.error('Error fetching bundle measurements:', error);

        setSelectedRentalWithMeasurements(rental);

      }

    } else if (rentalItemId) {

      try {

        const result = await getRentalById(rentalItemId);

        console.log('Fetched rental item result:', result);

        

        if (result.item && result.item.size) {

          const sizeConfig = parseSizeEntries(result.item.size);

          console.log('Parsed size config:', sizeConfig);

          

          // Create a map of measurements by size key

          const measurementsBySizeKey = {};

          sizeConfig.forEach(sizeEntry => {

            if (sizeEntry.measurements) {

              measurementsBySizeKey[sizeEntry.key] = sizeEntry.measurements;

            }

          });

          

          console.log('Measurements by size key:', measurementsBySizeKey);

          

          // Merge measurements into the rental data

          const enrichedRental = { ...rental };

          

          // Handle bundle items

          if (rental.specific_data?.is_bundle && rental.specific_data?.bundle_items) {

            enrichedRental.specific_data = {

              ...rental.specific_data,

              bundle_items: rental.specific_data.bundle_items.map(item => ({

                ...item,

                measurementsBySizeKey

              }))

            };

          } else {

            // Handle single item

            enrichedRental.specific_data = {

              ...rental.specific_data,

              measurementsBySizeKey

            };

          }

          

          setSelectedRentalWithMeasurements(enrichedRental);

        }

      } catch (error) {

        console.error('Error fetching rental measurements:', error);

        console.log('Will display without measurements');

        // Set the rental without measurements so the modal still works

        setSelectedRentalWithMeasurements(rental);

      }

    } else {

      console.log('No rental item ID found, displaying without measurements');

      setSelectedRentalWithMeasurements(rental);

    }

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

      const paymentSnapshot = getRentalPaymentSnapshot(selectedRental);



      if (paymentSnapshot.requiredDepositNow > 0) {

        const recordPayment = await confirm(

          `Before marking as "Rented", record the deposit payment first.\n\nRequired Deposit: ₱${paymentSnapshot.depositAmount.toFixed(2)}\nAlready Paid: ₱${paymentSnapshot.amountPaid.toFixed(2)}\nTo Collect Now: ₱${paymentSnapshot.requiredDepositNow.toFixed(2)}\n\nWould you like to record this payment now?`,

          'Payment Required',

          'warning',

          { confirmText: 'Record Payment', cancelText: 'Cancel' }

        );



        if (recordPayment) {



          setShowEditModal(false);

          setPaymentAmount(paymentSnapshot.totalPayment.toFixed(2));

          setCashReceived('');

          setRequiredPaymentAmount(paymentSnapshot.totalPayment);

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

      const paymentSnapshot = getRentalPaymentSnapshot(currentRental);



      if (paymentSnapshot.requiredDepositNow > 0) {



        const recordPayment = await confirm(

          `Before marking as "Rented", record the deposit payment first.\n\nRequired Deposit: ₱${paymentSnapshot.depositAmount.toFixed(2)}\nAlready Paid: ₱${paymentSnapshot.amountPaid.toFixed(2)}\nTo Collect Now: ₱${paymentSnapshot.requiredDepositNow.toFixed(2)}\n\nWould you like to record this payment now?`,

          'Payment Required',

          'warning',

          { confirmText: 'Record Payment', cancelText: 'Cancel' }

        );



        if (recordPayment) {



          setSelectedRental(currentRental);

          setPaymentAmount(paymentSnapshot.totalPayment.toFixed(2));

          setCashReceived('');

          setRequiredPaymentAmount(paymentSnapshot.totalPayment);

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

                  order_item_id: rental?.item_id || null,

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

                order_item_id: rental?.item_id || null,

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

                order_item_id: request.order_item_id,

                size_key: request.size_key,

                size_label: request.size_label,

                quantity: request.quantity,

                damage_type: request.damage_type,

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



    const minimumRequiredNow = pendingRentedStatus ? Math.max(0, parseFloat(requiredPaymentAmount || 0)) : 0;
    if (minimumRequiredNow > 0 && amount < minimumRequiredNow) {
      await alert(`Payment amount must be at least ₱${minimumRequiredNow.toFixed(2)} to complete the required deposit payment.`, 'Error', 'error');
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

        setRequiredPaymentAmount(0);



        if (pendingRentedStatus) {

          const itemIdToUpdate = pendingRentedStatus;

          setPendingRentedStatus(null);



          const statusResult = await updateRentalOrderItem(itemIdToUpdate, {

            approvalStatus: 'rented'

          });



          if (statusResult.success) {

            await alert('Deposit payment recorded and status updated to "Rented"', 'Success', 'success');

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

  const handleRecordDepositReturn = async () => {
    if (!selectedRental || !depositReturnAmount) {
      await alert('Please enter a deposit return amount', 'Error', 'error');
      return;
    }

    const amount = parseFloat(depositReturnAmount);
    if (isNaN(amount) || amount <= 0) {
      await alert('Please enter a valid deposit return amount', 'Error', 'error');
      return;
    }

    const snapshot = getDepositReturnSnapshot(selectedRental);
    if (amount > snapshot.refundableRemaining) {
      await alert(`Amount exceeds refundable balance of ₱${snapshot.refundableRemaining.toFixed(2)}.`, 'Error', 'error');
      return;
    }

    try {
      const result = await recordRentalDepositReturn(selectedRental.item_id, amount, snapshot.damagedSizes);
      if (result.success) {
        await alert(
          `Deposit return of ₱${amount.toFixed(2)} recorded successfully. Remaining refundable deposit: ₱${parseFloat(result.refund?.refundable_remaining || 0).toFixed(2)}.`,
          'Success',
          'success'
        );
        closeDepositReturnModal();
        await loadRentalOrders();
      } else {
        await alert(result.message || 'Failed to record deposit return', 'Error', 'error');
      }
    } catch (error) {
      console.error('Error recording deposit return:', error);
      await alert('Error recording deposit return', 'Error', 'error');
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

            <option value="appointment-today">Appointment Today</option>

            <option value="due-today">Due Today</option>

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

                    // Calculate total deposit from selected sizes
                    const selectedSizes = rental.specific_data?.selected_sizes || rental.specific_data?.selectedSizes || [];
                    const depositFromSizes = selectedSizes.reduce((total, size) => {
                      const quantity = parseInt(size.quantity || 0, 10);
                      const deposit = parseFloat(size.deposit || 0);
                      return total + (quantity * deposit);
                    }, 0);
                    const downpaymentAmount = depositFromSizes > 0 ? depositFromSizes : (rental.pricing_factors?.downpayment || rental.specific_data?.downpayment || 0);



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

                            <div>Rental: ₱{finalPrice.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>

                            <div style={{ color: '#ff9800', fontWeight: 'bold' }}>

                              Deposit: ₱{downpaymentAmount.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}

                            </div>

                            <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '4px', marginTop: '4px', fontWeight: 'bold' }}>

                              Total: ₱{(finalPrice + parseFloat(downpaymentAmount)).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}

                            </div>

                            <div style={{ marginTop: '4px', color: '#555' }}>

                              Mode: {String(pricingFactors.rental_payment_mode || 'regular') === 'flat_rate' ? 'Flat Rate' : 'Regular'}

                            </div>

                            {String(pricingFactors.rental_payment_mode || 'regular') === 'flat_rate' && pricingFactors.flat_rate_until_date && (

                              <div style={{ marginTop: '2px', color: '#7a3b12', fontWeight: 600 }}>

                                Flat Rate Until: {pricingFactors.flat_rate_until_date}

                              </div>

                            )}

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

                                  const requiredDepositAmount = Math.max(0, parseFloat(downpaymentAmount || 0));
                                  const hasNoDepositPayment = amountPaid < requiredDepositAmount;

                                  const isCurrentlyRented = currentStatus === 'rented';

                                  const hasRemainingBalance = remainingBalance > 0;



                                  const shouldDisable = (isMovingToRented && hasNoDepositPayment) || (isCurrentlyRented && hasRemainingBalance);



                                  let disableMessage = '';

                                  if (isMovingToRented && hasNoDepositPayment) {

                                    disableMessage = `Record deposit first before moving to ${nextStatusLabel}`;

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

                                        if (currentStatus === 'pending' || currentStatus === 'pending_review') {

                                          openPendingPricingSetup(rental);

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

                                {rental.approval_status !== 'cancelled' && rental.approval_status !== 'pending' && rental.approval_status !== 'pending_review' && rental.approval_status !== 'price_confirmation' && rental.approval_status !== 'returned' && !isPending && (

                                <button

                                    className="icon-btn"

                                    onClick={(e) => {

                                      e.stopPropagation();

                                      setSelectedRental(rental);

                                      const paymentSnapshot = getRentalPaymentSnapshot(rental);

                                      setPaymentAmount(paymentSnapshot.totalPayment > 0 ? paymentSnapshot.totalPayment.toFixed(2) : '');

                                      setRequiredPaymentAmount(paymentSnapshot.totalPayment);

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

                              {(() => {
                                const refundSnapshot = getDepositReturnSnapshot(rental);
                                const canRecordRefund = rental.approval_status === 'returned' && refundSnapshot.refundableRemaining > 0;
                                if (!canRecordRefund) return null;

                                return (
                                  <button
                                    className="icon-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedRental(rental);
                                      setDepositReturnAmount(refundSnapshot.refundableRemaining.toFixed(2));
                                      setShowDepositReturnModal(true);
                                    }}
                                    title="Record Deposit Return"
                                    style={{
                                      backgroundColor: '#ffffff',
                                      color: '#2e7d32',
                                      border: '1px solid #2e7d32'
                                    }}
                                  >
                                    <i className="fas fa-hand-holding-usd" aria-hidden="true"></i>
                                  </button>
                                );
                              })()}

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

      {showPricingSetupModal && pendingPricingRental && (

        <div className="modal-overlay active" onClick={(e) => {

          if (e.target.classList.contains('modal-overlay')) {

            setShowPricingSetupModal(false);

            setPendingPricingRental(null);

            setPendingPricingData({ paymentMode: 'regular', finalPrice: '', flatRateUntilDate: '' });

          }

        }}>

          <div

            className="modal-content pricing-setup-modal"

            onClick={(e) => e.stopPropagation()}

          >

            <div className="modal-header pricing-setup-header">

              <h2>Set Rental Payment Option</h2>

              <span className="close-modal" onClick={() => {

                setShowPricingSetupModal(false);

                setPendingPricingRental(null);

                setPendingPricingData({ paymentMode: 'regular', finalPrice: '', flatRateUntilDate: '' });

              }}>×</span>

            </div>

            <div className="pricing-setup-modal-body">

              <div className="detail-row pricing-meta-card">

                <strong>Order ID:</strong>

                <span>ORD-{pendingPricingRental.order_id}</span>

              </div>

              <div className="detail-row pricing-meta-card">

                <strong>Item:</strong>

                <span>{pendingPricingRental.specific_data?.item_name || 'N/A'}</span>

              </div>



              <div className="pricing-form-group">

                <label>Payment Option</label>

                <div className="pricing-option-row">

                  <label className="pricing-option-label">

                    <input

                      type="radio"

                      name="rental-payment-mode"

                      value="regular"

                      checked={pendingPricingData.paymentMode === 'regular'}

                      onChange={(e) => setPendingPricingData({

                        ...pendingPricingData,

                        paymentMode: e.target.value,

                        flatRateUntilDate: ''

                      })}

                    />

                    Regular

                  </label>

                  <label className="pricing-option-label">

                    <input

                      type="radio"

                      name="rental-payment-mode"

                      value="flat_rate"

                      checked={pendingPricingData.paymentMode === 'flat_rate'}

                      onChange={(e) => setPendingPricingData({

                        ...pendingPricingData,

                        paymentMode: e.target.value

                      })}

                    />

                    Flat Rate

                  </label>

                </div>

                {pendingPricingData.paymentMode === 'flat_rate' && (

                  <small className="pricing-modal-note">

                    Flat rate keeps this rental amount fixed while the item remains with the customer.

                  </small>

                )}

              </div>



              <div className="pricing-form-group">

                <label>Rental Payment Amount</label>

                <input

                  type="number"

                  min="0"

                  step="0.01"

                  className="pricing-input"

                  value={pendingPricingData.finalPrice}

                  onChange={(e) => setPendingPricingData({ ...pendingPricingData, finalPrice: e.target.value })}

                  placeholder="Enter rental amount"

                />

              </div>

              {pendingPricingData.paymentMode === 'flat_rate' && (

                <div className="pricing-form-group">

                  <label>Flat Rate Until Date</label>

                  <input

                    type="date"

                    min={flatRateMinDate}

                    className="pricing-input"

                    value={pendingPricingData.flatRateUntilDate}

                    onChange={(e) => setPendingPricingData({ ...pendingPricingData, flatRateUntilDate: e.target.value })}

                  />

                </div>

              )}

            </div>

            <div className="pricing-modal-actions">

              <button

                className="btn-cancel pricing-cancel-btn"

                onClick={() => {

                  setShowPricingSetupModal(false);

                  setPendingPricingRental(null);

                  setPendingPricingData({ paymentMode: 'regular', finalPrice: '', flatRateUntilDate: '' });

                }}

              >

                Cancel

              </button>

              <button className="btn-save pricing-save-btn" onClick={submitPendingPricingSetup}>

                Save and Continue

              </button>

            </div>

          </div>

        </div>

      )}

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

          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '98vw', maxWidth: '1240px' }}>

            <div className="modal-header">

              <h2>Damage Form - {damageFormContext.displayName}</h2>

              <span className="close-modal" onClick={handleDamageFormCancel}>×</span>

            </div>

            <div className="modal-body">

              <p style={{ marginBottom: '10px', color: '#555' }}>

                Fill out only sizes with an issue. Unchecked sizes are treated as no issue.

              </p>

              <div style={{ border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden' }}>

                <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>

                  <thead>

                    <tr style={{ background: '#fafafa' }}>

                      <th style={{ textAlign: 'center', padding: '8px', width: '70px' }}>Damaged?</th>

                      <th style={{ textAlign: 'left', padding: '8px', width: '16%' }}>Size</th>

                      <th style={{ textAlign: 'center', padding: '8px', width: '110px' }}>Returned Qty</th>

                      <th style={{ textAlign: 'center', padding: '8px', width: '110px' }}>Damaged Qty</th>

                      <th style={{ textAlign: 'left', padding: '8px', width: '130px' }}>Choice</th>

                      <th style={{ textAlign: 'left', padding: '8px', width: '130px' }}>Level</th>

                      <th style={{ textAlign: 'left', padding: '8px', width: '34%' }}>Comment Text</th>

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

                            value={row.damage_choice || 'damage'}

                            onChange={(e) => updateDamageFormRow(row.size_key, { damage_choice: e.target.value })}

                          >

                            <option value="damage">Damage</option>

                            <option value="lost">Lost</option>

                            <option value="replaced">Replaced</option>

                          </select>

                        </td>

                        <td style={{ padding: '8px' }}>

                          <select

                            disabled={!row.is_damaged || (row.damage_choice || 'damage') !== 'damage'}

                            value={row.damage_level}

                            onChange={(e) => updateDamageFormRow(row.size_key, { damage_level: e.target.value })}

                          >

                            <option value="minor">Minor</option>

                            <option value="moderate">Moderate</option>

                            <option value="severe">Severe</option>

                          </select>

                        </td>

                        <td style={{ padding: '8px', width: '34%' }}>

                          <textarea

                            disabled={!row.is_damaged}

                            value={row.comment_text || ''}

                            onChange={(e) => updateDamageFormRow(row.size_key, { comment_text: e.target.value })}

                            placeholder="Write a comment"

                            rows={3}

                            style={{ width: '100%', minHeight: '84px', padding: '8px 10px', resize: 'vertical', fontFamily: 'inherit' }}

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

          if (e.target.classList.contains('modal-overlay')) closePaymentModal();

        }}>

          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>

            <div className="modal-header">

              <h2>Record Payment</h2>

              <span className="close-modal" onClick={closePaymentModal}>×</span>

            </div>

            <div className="modal-body">

              <div className="detail-row">

                <strong>Order ID:</strong>

                <span>ORD-{selectedRental.order_id}</span>

              </div>

              <div className="detail-row">

                <strong>Customer:</strong>

                <span>

                  {selectedRental.order_type === 'walk_in'

                    ? (selectedRental.walk_in_customer_name || 'Walk-in Customer')

                    : `${selectedRental.first_name || ''} ${selectedRental.last_name || ''}`.trim() || 'N/A'}

                </span>

              </div>

              <div className="detail-row">

                <strong>Item:</strong>

                <span>{selectedRental.specific_data?.item_name || 'N/A'}</span>

              </div>

              <div className="detail-row">

                <strong>Rental Price:</strong>

                <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>

                  ₱{parseFloat(selectedRental.final_price || 0).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}

                </span>

              </div>

              <div className="detail-row">

                <strong>Deposit (Refundable):</strong>

                <span style={{ color: '#ff9800', fontWeight: 'bold' }}>

                  ₱{(() => {
                    const selectedSizes = selectedRental?.specific_data?.selected_sizes || selectedRental?.specific_data?.selectedSizes || [];
                    const depositFromSizes = selectedSizes.reduce((total, size) => {
                      const quantity = parseInt(size.quantity || 0, 10);
                      const deposit = parseFloat(size.deposit || 0);
                      return total + (quantity * deposit);
                    }, 0);
                    const depositAmount = depositFromSizes > 0 ? depositFromSizes : parseFloat(selectedRental.pricing_factors?.downpayment || selectedRental.specific_data?.downpayment || 0);
                    return depositAmount.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                  })()}

                </span>

              </div>

              <div className="detail-row" style={{ borderTop: '2px solid #e0e0e0', paddingTop: '8px', marginTop: '8px' }}>

                <strong>Total Payment:</strong>

                <span style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: '16px' }}>

                  ₱{(() => {
                    const selectedSizes = selectedRental?.specific_data?.selected_sizes || selectedRental?.specific_data?.selectedSizes || [];
                    const depositFromSizes = selectedSizes.reduce((total, size) => {
                      const quantity = parseInt(size.quantity || 0, 10);
                      const deposit = parseFloat(size.deposit || 0);
                      return total + (quantity * deposit);
                    }, 0);
                    const depositAmount = depositFromSizes > 0 ? depositFromSizes : parseFloat(selectedRental.pricing_factors?.downpayment || selectedRental.specific_data?.downpayment || 0);
                    return (parseFloat(selectedRental.final_price || 0) + depositAmount).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                  })()}

                </span>

              </div>

              {pendingRentedStatus && (
                <div className="detail-row" style={{ borderTop: '1px dashed #d7ccc8', paddingTop: '8px', marginTop: '8px' }}>
                  <strong>Required Deposit To Proceed:</strong>
                  <span style={{ color: '#8B4513', fontWeight: 'bold' }}>
                    ₱{Math.max(0, parseFloat(requiredPaymentAmount || 0)).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}



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

                  {pendingRentedStatus ? 'Enter the deposit amount to collect before marking as rented' : 'Enter the amount the customer is paying now'}

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

                closePaymentModal();

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

      {showDepositReturnModal && selectedRental && (

        <div className="modal-overlay active" onClick={(e) => {

          if (e.target.classList.contains('modal-overlay')) closeDepositReturnModal();

        }}>

          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>

            <div className="modal-header">

              <h2>Record Deposit Return</h2>

              <span className="close-modal" onClick={closeDepositReturnModal}>×</span>

            </div>

            <div className="modal-body">

              {(() => {
                const snapshot = getDepositReturnSnapshot(selectedRental);
                return (
                  <>
                    <div className="detail-row">
                      <strong>Order ID:</strong>
                      <span>ORD-{selectedRental.order_id}</span>
                    </div>

                    <div className="detail-row">
                      <strong>Customer:</strong>
                      <span>
                        {selectedRental.order_type === 'walk_in'
                          ? (selectedRental.walk_in_customer_name || 'Walk-in Customer')
                          : `${selectedRental.first_name || ''} ${selectedRental.last_name || ''}`.trim() || 'N/A'}
                      </span>
                    </div>

                    <div className="detail-row">
                      <strong>Item:</strong>
                      <span>{selectedRental.specific_data?.item_name || 'N/A'}</span>
                    </div>

                    <div className="detail-row">
                      <strong>Total Deposit:</strong>
                      <span style={{ color: '#ff9800', fontWeight: 'bold' }}>
                        ₱{snapshot.depositAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="detail-row">
                      <strong>Already Refunded:</strong>
                      <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>
                        ₱{snapshot.refundedAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    {snapshot.damagedDepositAmount > 0 && (
                      <div className="detail-row">
                        <strong>Withheld for Damage:</strong>
                        <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>
                          ₱{snapshot.damagedDepositAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    <div className="detail-row" style={{ borderTop: '2px solid #e0e0e0', paddingTop: '8px', marginTop: '8px' }}>
                      <strong>Refundable Remaining:</strong>
                      <span style={{ color: '#1565c0', fontWeight: 'bold', fontSize: '16px' }}>
                        ₱{snapshot.refundableRemaining.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    {snapshot.nonRefundableNotes.length > 0 && (
                      <div style={{
                        backgroundColor: '#ffebee',
                        padding: '12px',
                        borderRadius: '6px',
                        border: '1px solid #f44336',
                        marginTop: '12px'
                      }}>
                        <strong style={{ color: '#c62828', display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>⚠️ Non-Refundable Deposits:</strong>
                        <div style={{ fontSize: '0.85rem', color: '#555', lineHeight: '1.6' }}>
                          {snapshot.nonRefundableNotes.map((note, idx) => (
                            <div key={idx} style={{ marginBottom: '4px' }}>• {note}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              <div className="payment-form-group">
                <label>Deposit Return Amount *</label>
                <input
                  type="number"
                  value={depositReturnAmount}
                  onChange={(e) => setDepositReturnAmount(e.target.value)}
                  className="form-control"
                  placeholder="Enter deposit return amount"
                  min="0"
                  step="0.01"
                  autoFocus
                />
              </div>

            </div>

            <div className="modal-footer-centered">

              <button className="btn-cancel" onClick={closeDepositReturnModal}>

                Cancel

              </button>

              <button className="btn-save" onClick={handleRecordDepositReturn}>

                Record Deposit Return

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
                        console.log('Bundle item display - item:', item.item_name, 'sizeData:', sizeData, 'measurementsBySizeKey:', item.measurementsBySizeKey);

                        

                        // Enrich size data with measurements from the fetched data

                        const normalizeKey = (key) => String(key || '').toLowerCase().replace(/\s+/g, '').replace(/[()]/g, '');

                        

                        const enrichedSizeData = sizeData.map(sizeEntry => {

                          // Try exact match first

                          let measurements = item.measurementsBySizeKey?.[sizeEntry.key] || sizeEntry.measurements;

                          

                          // If no exact match, try normalized matching

                          if (!measurements && item.measurementsBySizeKey) {

                            const normalizedKey = normalizeKey(sizeEntry.key);

                            const matchingKey = Object.keys(item.measurementsBySizeKey).find(key => 

                              normalizeKey(key) === normalizedKey

                            );

                            if (matchingKey) {

                              measurements = item.measurementsBySizeKey[matchingKey];

                            }

                          }

                          

                          return { ...sizeEntry, measurements };

                        });

                        

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

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                                {enrichedSizeData.map((sizeEntry, mIdx) => {

                                  const measurements = sizeEntry.measurements;

                                  const hasMeasurements = measurements && typeof measurements === 'object' && Object.keys(measurements).length > 0;

                                  return (

                                    <div key={mIdx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>

                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 16px', color: '#666' }}>

                                        <span style={{ fontWeight: '500', textAlign: 'left' }}>{sizeEntry.label}</span>

                                        <span style={{ textAlign: 'right' }}>x{sizeEntry.quantity}</span>

                                      </div>

                                      {hasMeasurements && (

                                        <div style={{ paddingLeft: '16px', fontSize: '0.85rem', color: '#888', lineHeight: '1.6', marginTop: '4px' }}>

                                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>

                                            <thead>

                                              <tr style={{ borderBottom: '1px solid #e0e0e0' }}>

                                                <th style={{ textAlign: 'left', padding: '4px 8px 4px 0', fontWeight: '600', color: '#666' }}>Measurement</th>

                                                <th style={{ textAlign: 'right', padding: '4px 0 4px 8px', fontWeight: '600', color: '#666' }}>Inches</th>

                                                <th style={{ textAlign: 'right', padding: '4px 0 4px 8px', fontWeight: '600', color: '#666' }}>Centimeters</th>

                                              </tr>

                                            </thead>

                                            <tbody>

                                              {Object.entries(measurements).map(([key, value]) => {

                                                if (!value) return null;

                                                // Handle both object format {inch: "38", cm: "96.52"} and string format "38"

                                                const isObject = typeof value === 'object' && value !== null;

                                                if (isObject && !value.inch && !value.cm) return null;

                                                

                                                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());

                                                const inchValue = isObject ? (value.inch || '-') : (value || '-');

                                                const cmValue = isObject ? (value.cm || '-') : '-';

                                                

                                                return (

                                                  <tr key={key} style={{ borderBottom: '1px solid #f0f0f0' }}>

                                                    <td style={{ padding: '4px 8px 4px 0', color: '#555' }}>{label}</td>

                                                    <td style={{ textAlign: 'right', padding: '4px 0 4px 8px', color: '#555' }}>{inchValue}</td>

                                                    <td style={{ textAlign: 'right', padding: '4px 0 4px 8px', color: '#555' }}>{cmValue}</td>

                                                  </tr>

                                                );

                                              })}

                                            </tbody>

                                          </table>

                                        </div>

                                      )}

                                    </div>

                                  );

                                })}

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

                      

                      // Enrich size data with measurements from the fetched data

                      const measurementsBySizeKey = selectedRentalWithMeasurements?.specific_data?.measurementsBySizeKey || {};

                      console.log('measurementsBySizeKey:', measurementsBySizeKey);

                      console.log('sizeData before enrichment:', sizeData);

                      

                      // Normalize keys for matching (remove spaces, lowercase)

                      const normalizeKey = (key) => String(key || '').toLowerCase().replace(/\s+/g, '').replace(/[()]/g, '');

                      

                      const enrichedSizeData = sizeData.map(sizeEntry => {

                        console.log(`Looking for measurements for key: ${sizeEntry.key}`);

                        

                        // Try exact match first

                        let measurements = measurementsBySizeKey[sizeEntry.key] || sizeEntry.measurements;

                        

                        // If no exact match, try normalized matching

                        if (!measurements) {

                          const normalizedKey = normalizeKey(sizeEntry.key);

                          const matchingKey = Object.keys(measurementsBySizeKey).find(key => 

                            normalizeKey(key) === normalizedKey

                          );

                          if (matchingKey) {

                            measurements = measurementsBySizeKey[matchingKey];

                            console.log(`Found measurements via normalized matching: ${sizeEntry.key} -> ${matchingKey}`);

                          }

                        }

                        

                        console.log(`Found measurements:`, measurements);

                        return { ...sizeEntry, measurements };

                      });

                      

                      if (enrichedSizeData && Array.isArray(enrichedSizeData)) {

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

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                              {enrichedSizeData.map((sizeEntry, mIdx) => {

                                const measurements = sizeEntry.measurements;

                                const hasMeasurements = measurements && typeof measurements === 'object' && Object.keys(measurements).length > 0;

                                return (

                                  <div key={mIdx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 16px', color: '#666' }}>

                                      <span style={{ fontWeight: '500', textAlign: 'left' }}>{sizeEntry.label}</span>

                                      <span style={{ textAlign: 'right' }}>x{sizeEntry.quantity}</span>

                                    </div>

                                    {hasMeasurements && (

                                      <div style={{ paddingLeft: '16px', fontSize: '0.85rem', color: '#888', lineHeight: '1.6', marginTop: '4px' }}>

                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>

                                          <thead>

                                            <tr style={{ borderBottom: '1px solid #e0e0e0' }}>

                                              <th style={{ textAlign: 'left', padding: '4px 8px 4px 0', fontWeight: '600', color: '#666' }}>Measurement</th>

                                              <th style={{ textAlign: 'right', padding: '4px 0 4px 8px', fontWeight: '600', color: '#666' }}>Inches</th>

                                              <th style={{ textAlign: 'right', padding: '4px 0 4px 8px', fontWeight: '600', color: '#666' }}>Centimeters</th>

                                            </tr>

                                          </thead>

                                          <tbody>

                                            {Object.entries(measurements).map(([key, value]) => {

                                              if (!value || (typeof value === 'object' && !value.inch && !value.cm)) return null;

                                              const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());

                                              const inchValue = typeof value === 'object' ? (value.inch || '-') : value;

                                              const cmValue = typeof value === 'object' ? (value.cm || '-') : '-';

                                              return (

                                                <tr key={key} style={{ borderBottom: '1px solid #f0f0f0' }}>

                                                  <td style={{ padding: '4px 8px 4px 0', color: '#555' }}>{label}</td>

                                                  <td style={{ textAlign: 'right', padding: '4px 0 4px 8px', color: '#555' }}>{inchValue}</td>

                                                  <td style={{ textAlign: 'right', padding: '4px 0 4px 8px', color: '#555' }}>{cmValue}</td>

                                                </tr>

                                              );

                                            })}

                                          </tbody>

                                        </table>

                                      </div>

                                    )}

                                  </div>

                                );

                              })}

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

                <strong>Rental Price:</strong>

                <span style={{

                  color: selectedRental.approval_status === 'cancelled' ? '#999' : '#2e7d32',

                  fontWeight: 'bold',

                  textDecoration: selectedRental.approval_status === 'cancelled' ? 'line-through' : 'none'

                }}>

                  ₱{parseFloat(selectedRental.final_price || 0).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}

                </span>

              </div>

              <div className="detail-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>

                <strong style={{ marginBottom: '8px' }}>Deposit (Refundable):</strong>

                {(() => {
                  const selectedSizes = selectedRental?.specific_data?.selected_sizes || selectedRental?.specific_data?.selectedSizes || [];
                  const depositFromSizes = selectedSizes.reduce((total, size) => {
                    const quantity = parseInt(size.quantity || 0, 10);
                    const deposit = parseFloat(size.deposit || 0);
                    return total + (quantity * deposit);
                  }, 0);
                  const depositAmount = depositFromSizes > 0 ? depositFromSizes : parseFloat(selectedRental.pricing_factors?.downpayment || selectedRental.specific_data?.downpayment || 0);

                  if (selectedSizes.length > 0 && depositFromSizes > 0) {
                    return (
                      <div style={{ width: '100%' }}>
                        {selectedSizes.map((size, idx) => {
                          const qty = parseInt(size.quantity || 0, 10);
                          const dep = parseFloat(size.deposit || 0);
                          const lineDeposit = qty * dep;
                          if (lineDeposit <= 0) return null;
                          return (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '14px', color: '#666' }}>
                              <span>{size.label || size.sizeKey} ×{qty} Deposit:</span>
                              <span style={{ color: '#ff9800', fontWeight: '600' }}>₱{lineDeposit.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                            </div>
                          );
                        })}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #e0e0e0', marginTop: '4px' }}>
                          <span style={{ fontWeight: 'bold' }}>Total Deposit:</span>
                          <span style={{ color: '#ff9800', fontWeight: 'bold' }}>₱{depositAmount.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <span style={{ color: '#ff9800', fontWeight: 'bold' }}>
                      ₱{depositAmount.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </span>
                  );
                })()}

              </div>

              <div className="detail-row" style={{ borderTop: '2px solid #e0e0e0', paddingTop: '8px', marginTop: '8px' }}>

                <strong>Total Payment:</strong>

                <span style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: '16px' }}>

                  ₱{(() => {
                    const selectedSizes = selectedRental?.specific_data?.selected_sizes || selectedRental?.specific_data?.selectedSizes || [];
                    const depositFromSizes = selectedSizes.reduce((total, size) => {
                      const quantity = parseInt(size.quantity || 0, 10);
                      const deposit = parseFloat(size.deposit || 0);
                      return total + (quantity * deposit);
                    }, 0);
                    const depositAmount = depositFromSizes > 0 ? depositFromSizes : parseFloat(selectedRental.pricing_factors?.downpayment || selectedRental.specific_data?.downpayment || 0);
                    return (parseFloat(selectedRental.final_price || 0) + depositAmount).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                  })()}

                </span>

              </div>

              {(() => {
                let detailPricingFactors = {};
                try {
                  detailPricingFactors = typeof selectedRental.pricing_factors === 'string'
                    ? JSON.parse(selectedRental.pricing_factors || '{}')
                    : (selectedRental.pricing_factors || {});
                } catch {
                  detailPricingFactors = {};
                }

                const detailPaymentMode = String(detailPricingFactors?.rental_payment_mode || 'regular').toLowerCase();
                const detailFlatRateUntilDate = detailPricingFactors?.flat_rate_until_date || null;

                return (
                  <>
                    <div className="detail-row">
                      <strong>Payment Mode:</strong>
                      <span style={{ fontWeight: 600, color: '#8B4513' }}>
                        {detailPaymentMode === 'flat_rate' ? 'Flat Rate' : 'Regular'}
                      </span>
                    </div>

                    {detailPaymentMode === 'flat_rate' && detailFlatRateUntilDate && (
                      <div className="detail-row">
                        <strong>Flat Rate Until:</strong>
                        <span>{detailFlatRateUntilDate}</span>
                      </div>
                    )}
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

              {selectedRental.specific_data?.damageNotes && (() => {

                let damageData = [];

                try {

                  damageData = typeof selectedRental.specific_data.damageNotes === 'string'

                    ? JSON.parse(selectedRental.specific_data.damageNotes)

                    : selectedRental.specific_data.damageNotes;

                  if (!Array.isArray(damageData)) damageData = [];

                } catch {

                  damageData = [];

                }



                if (damageData.length === 0) return null;



                return (

                  <div style={{

                    backgroundColor: '#ffebee',

                    padding: '16px',

                    borderRadius: '8px',

                    border: '1px solid #f44336',

                    marginTop: '15px'

                  }}>

                    <strong style={{ color: '#c62828', display: 'block', marginBottom: '12px', fontSize: '1rem' }}>⚠️ Damage Report</strong>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                      {damageData.map((damage, idx) => (

                        <div key={idx} style={{

                          backgroundColor: '#fff',

                          padding: '12px',

                          borderRadius: '6px',

                          border: '1px solid #ffcdd2'

                        }}>

                          <div style={{ marginBottom: '8px' }}>

                            <strong style={{ color: '#d32f2f' }}>{damage.item_name || 'Item'}</strong>

                            <span style={{ marginLeft: '8px', color: '#666', fontSize: '0.9rem' }}>({damage.size_label})</span>

                          </div>

                          <div style={{ fontSize: '0.9rem', color: '#555', lineHeight: '1.6' }}>

                            <div><strong>Issue Type:</strong> <span style={{ textTransform: 'capitalize' }}>{String(damage.damage_type || 'damage')}</span></div>

                            <div><strong>Quantity:</strong> {damage.quantity}</div>


                            {String(damage.damage_type || 'damage').toLowerCase() === 'damage' && (

                              <div><strong>Damage Level:</strong> <span style={{ textTransform: 'capitalize', color: damage.damage_level === 'severe' ? '#d32f2f' : damage.damage_level === 'moderate' ? '#f57c00' : '#fbc02d' }}>{damage.damage_level}</span></div>

                            )}


                            <div><strong>Comment:</strong> {damage.damage_note}</div>

                            {damage.damaged_customer_name && (

                              <div style={{ marginTop: '4px', fontSize: '0.85rem', color: '#888' }}>

                                <em>Damaged by: {damage.damaged_customer_name}</em>

                              </div>

                            )}

                          </div>

                        </div>

                      ))}

                    </div>

                  </div>

                );

              })()}

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


