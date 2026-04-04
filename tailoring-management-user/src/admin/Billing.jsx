import React, { useState, useEffect } from 'react';

import '../adminStyle/bill.css';

import AdminHeader from './AdminHeader';

import Sidebar from './Sidebar';

import { getAllBillingRecords, getBillingStats, updateBillingRecordStatus } from '../api/BillingApi';

import { getCompensationIncidents } from '../api/DamageCompensationApi';

import { useAlert } from '../context/AlertContext';

import ImagePreviewModal from '../components/ImagePreviewModal';

import SimpleImageCarousel from '../components/SimpleImageCarousel';

import { API_BASE_URL } from '../api/config';
import { getUserRole } from '../api/AuthApi';
import { useNavigate } from 'react-router-dom';

const Billing = () => {

  const navigate = useNavigate();

  const { alert } = useAlert();

  const [allBills, setAllBills] = useState([]);

  const [billingStats, setBillingStats] = useState({

    total: 0,

    paid: 0,

    unpaid: 0,

    totalRevenue: 0,

    pendingRevenue: 0

  });

  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');

  const [statusFilter, setStatusFilter] = useState('');

  const [serviceFilter, setServiceFilter] = useState('');

  const [showDetailModal, setShowDetailModal] = useState(false);

  const [selectedBill, setSelectedBill] = useState(null);

  const [showSettlementModal, setShowSettlementModal] = useState(false);

  const [selectedSettlement, setSelectedSettlement] = useState(null);

  const [imagePreview, setImagePreview] = useState({ isOpen: false, imageUrl: '', altText: '' });

  useEffect(() => {

    const role = getUserRole();
    if (role !== 'admin') {
      navigate('/customize', { replace: true });
      return;
    }

    const fetchData = async () => {

      try {

        const recordsResponse = await getAllBillingRecords();

        if (recordsResponse.success) {

          setAllBills(recordsResponse.records);

        }

        const statsResponse = await getBillingStats();

        if (statsResponse.success) {

          setBillingStats(statsResponse.stats);

        }

      } catch (error) {

        console.error('Error fetching billing data:', error);

      } finally {

        setLoading(false);

      }

    };

    fetchData();

    const refreshInterval = setInterval(fetchData, 5000);

    return () => clearInterval(refreshInterval);

  }, []);

  const getFilteredBills = () => {

    let bills = allBills;

    bills = bills.filter(bill => {

      const matchesSearch = searchTerm === "" ||

        bill.uniqueNo.toLowerCase().includes(searchTerm.toLowerCase()) ||

        bill.customerName.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSearch;

    });

    if (statusFilter) {

      bills = bills.filter(bill => bill.status === statusFilter);

    }

    if (serviceFilter) {

      bills = bills.filter(bill => (bill.serviceTypeDisplay || bill.serviceType) === serviceFilter);

    }

    return bills;

  };

  const filteredBills = getFilteredBills();

  const getNextPaymentStatus = (bill) => {

    const serviceType = (bill.serviceType || '').toLowerCase();

    const currentStatus = bill.status;

    if (serviceType === 'rental') {

      if (currentStatus === 'Down-payment') {

        return 'Fully Paid';

      }

      return 'Down-payment';

    }

    if (currentStatus === 'Unpaid') {

      return 'Paid';

    }

    return 'Unpaid';

  };

  const updatePaymentStatus = async (billId, newStatus) => {

    try {

      const response = await updateBillingRecordStatus(billId, newStatus);

      if (response.success) {

        const recordsResponse = await getAllBillingRecords();

        if (recordsResponse.success) {

          setAllBills(recordsResponse.records);

        }

        const statsResponse = await getBillingStats();

        if (statsResponse.success) {

          setBillingStats(statsResponse.stats);

        }

        const bill = allBills.find(b => b.id === billId);

        if (bill) {

          await alert(`Payment status for ${bill.uniqueNo} manually updated to ${newStatus}!`, 'Success', 'success');

        } else {

          await alert(`Payment status updated to ${newStatus}!`, 'Success', 'success');

        }

      } else {

        await alert(response.message || 'Failed to update payment status', 'Error', 'error');

      }

    } catch (error) {

      console.error('Error updating payment status:', error);

      await alert('Error updating payment status', 'Error', 'error');

    }

  };

  const handleViewDetails = (id) => {

    const bill = allBills.find(b => b.id === id);

    setSelectedBill(bill);

    setShowDetailModal(true);

  };

  const handleViewSettlement = async (billId) => {

    try {

      const result = await getCompensationIncidents({ order_item_id: billId });

      if (result.success && result.incidents && result.incidents.length > 0) {

        const paidIncident = result.incidents.find(inc => inc.compensation_status === 'paid');

        if (paidIncident) {

          setSelectedSettlement(paidIncident);

          setShowSettlementModal(true);

        } else {

          await alert('No settled compensation found for this order', 'Info', 'info');

        }

      } else {

        await alert('No compensation incidents found', 'Info', 'info');

      }

    } catch (error) {

      console.error('Error fetching settlement details:', error);

      await alert('Error fetching settlement details', 'Error', 'error');

    }

  };

  const openImagePreview = (imageUrl, altText) => {

    setImagePreview({ isOpen: true, imageUrl, altText });

  };

  const closeImagePreview = () => {

    setImagePreview({ isOpen: false, imageUrl: '', altText: '' });

  };

  const getServiceImageUrl = (bill) => {

    if (!bill.specificData) return null;

    const imageUrl = bill.specificData.imageUrl;

    if (!imageUrl || imageUrl === 'no-image') return null;

    if (imageUrl.startsWith('http')) {

      return imageUrl;

    }

    return `${API_BASE_URL}${imageUrl}`;

  };

  const getServiceImageUrls = (bill) => {
    if (!bill.specificData?.imageUrls || bill.specificData.imageUrls.length === 0) return null;
    return bill.specificData.imageUrls.map(url => 
      url.startsWith('http') ? url : `${API_BASE_URL}${url}`
    );
  };

  const getServiceDescription = (bill) => {

    if (!bill.specificData) return null;

    const data = bill.specificData;

    const serviceType = (bill.serviceType || '').toLowerCase();

    if (serviceType === 'rental') {

      const bundleItems = data.bundle_items || [];

      if (bundleItems.length > 0) {

        return bundleItems.map(item => `${item.name || 'Rental Item'} - ${item.description || 'No description'}`).join(', ');

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

  const getRentalPriceDisplay = (bill) => {
    const serviceType = (bill.serviceType || '').toLowerCase();

    // For rental, show rental price, deposit, and total
    if (serviceType === 'rental') {
      const totalPrice = parseFloat(bill.price || 0);
      const isPaidOrCompleted = bill.status === 'Paid' || bill.status === 'Fully Paid';
      
      // Calculate deposit for breakdown display
      let depositAmount = 0;
      
      // Try to get deposit from selected_sizes first
      if (bill.specificData?.selected_sizes || bill.specificData?.selectedSizes) {
        const selectedSizes = bill.specificData.selected_sizes || bill.specificData.selectedSizes;
        depositAmount = selectedSizes.reduce((total, size) => {
          const quantity = parseInt(size.quantity || 0, 10);
          const deposit = parseFloat(size.deposit || 0);
          return total + (quantity * deposit);
        }, 0);
      }
      
      // Fallback to pricing factors if no deposit from sizes
      if (depositAmount === 0) {
        depositAmount = parseFloat(
          bill.pricingFactors?.deposit_amount ||
          bill.pricingFactors?.downpayment ||
          bill.pricingFactors?.down_payment ||
          bill.pricingFactors?.downPayment ||
          bill.specificData?.downpayment || 0
        );
      }
      
      // If still no deposit and rental is paid, estimate 20% as deposit
      if (depositAmount === 0 && isPaidOrCompleted && totalPrice > 0) {
        depositAmount = totalPrice * 0.2;
      }
      
      const rentalPrice = totalPrice - depositAmount;
      const refundedDeposit = parseFloat(bill.depositRefunded || bill.pricingFactors?.deposit_refunded_amount || 0);
      const isDepositFullyRefunded = depositAmount > 0 && refundedDeposit >= depositAmount;
      
      // If rental is paid/completed OR deposit is fully refunded, show only rental price
      if (isPaidOrCompleted || isDepositFullyRefunded) {
        return (
          <span style={{ fontSize: '14px', fontWeight: '600', color: 'blue' }}>
            ₱{rentalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        );
      }
      
      // If no deposit found, just show total price
      if (depositAmount === 0) {
        return (
          <span style={{ fontSize: '14px', fontWeight: '600' }}>
            ₱{totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        );
      }
      
      // Show breakdown: rental price + deposit = total
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '13px', color: '#666' }}>₱{rentalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span style={{ fontSize: '12px', color: '#ff9800' }}>Deposit: ₱{depositAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span style={{ fontSize: '14px', fontWeight: '600', borderTop: '1px solid #ddd', paddingTop: '2px', marginTop: '2px' }}>Total: ₱{totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      );
    }

    // For other services (dry cleaning, repair, customization)
    const fullPrice = parseFloat(bill.price || 0);
    const amountPaid = parseFloat(bill.pricingFactors?.amount_paid || 0);
    const remainingBalance = fullPrice - amountPaid;
    
    if (amountPaid > 0 && amountPaid < fullPrice) {
      // Partial payment
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '14px', fontWeight: '600' }}>₱{fullPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span style={{ fontSize: '12px', color: '#f44336' }}>Bal: ₱{remainingBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      );
    }

    // Fully paid or unpaid - show single price
    return (
      <span style={{ fontSize: '14px', fontWeight: '600' }}>
        ₱{fullPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    );
  };

  const getServiceTypeColor = (serviceType) => {

    const colors = {

      'Customization': '#9c27b0',

      'Dry Cleaning': '#2196f3',

      'Repair': '#ff9800',

      'Rental': '#4caf50',

      'Alteration': '#f44336',

      'Consultation': '#795548',

      'Other': '#607d8b'

    };

    return colors[serviceType] || '#666';

  };

  const getStatusButtonStyle = (status) => {

    const styles = {

      'Paid': { backgroundColor: '#e8f5e9', color: '#2e7d32' },

      'Fully Paid': { backgroundColor: '#c8e6c9', color: '#1b5e20' },

      'Unpaid': { backgroundColor: '#ffebee', color: '#d32f2f' },

      'Down-payment': { backgroundColor: '#fff3e0', color: '#e65100' },

      'Damage': { backgroundColor: '#fce4ec', color: '#ad1457' }

    };

    return styles[status] || styles['Unpaid'];

  };

  return (

    <div className="billing-management">

      <Sidebar />

      <AdminHeader />

      <div className="content">

        <div className="dashboard-title">

          <div>

            <h2>Billing Management</h2>

            <p>Track payments and manage billing</p>

          </div>

        </div>
        <div className="search-container">

          <input

            type="text"

            placeholder="Search by Order ID or Customer Name"

            value={searchTerm}

            onChange={(e) => setSearchTerm(e.target.value)}

          />

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>

            <option value="">All Payment Status</option>

            <option value="Paid">Paid</option>

            <option value="Fully Paid">Fully Paid</option>

            <option value="Unpaid">Unpaid</option>

            <option value="Down-payment">Down-payment</option>

            <option value="Damage">Damage</option>

          </select>

          <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>

            <option value="">All Services</option>

            <option value="Customization">Customization</option>

            <option value="Dry Cleaning">Dry Cleaning</option>

            <option value="Repair">Repair</option>

            <option value="Rental">Rental</option>

          </select>

        </div>
        <div className="table-container">

          {loading ? (

            <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}>

              Loading billing records...

            </div>

          ) : (

            <table>

              <thead>

                <tr>

                  <th>Order ID</th>

                  <th>Customer Name</th>

                  <th>Service Type</th>

                  <th>Date</th>

                  <th>Price</th>

                  <th>Payment Status</th>

                  <th>Actions</th>

                </tr>

              </thead>

              <tbody>

                {filteredBills.length === 0 ? (

                  <tr>

                    <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>

                      No bills found

                    </td>

                  </tr>

                ) : (

                  filteredBills.map(bill => {

                    const nextStatus = getNextPaymentStatus(bill);

                    const statusStyle = getStatusButtonStyle(bill.status);

                    return (

                      <tr key={bill.id} onClick={() => handleViewDetails(bill.id)} style={{ cursor: 'pointer' }}>

                        <td><strong>{bill.uniqueNo}</strong></td>

                        <td>{bill.customerName}</td>

                        <td>

                          <span className="service-type-badge" data-service-type={(bill.serviceType || '').toLowerCase()}>

                            {bill.serviceTypeDisplay || bill.serviceType}

                          </span>

                        </td>

                        <td>{bill.date}</td>

                        <td style={{ fontWeight: '600', color: '#2e7d32' }}>

                          {getRentalPriceDisplay(bill)}

                        </td>

                        <td>

                          <span className={`status-badge ${bill.status.toLowerCase().replace(' ', '-')}`}

                            style={{

                              padding: '6px 14px',

                              borderRadius: '20px',

                              fontWeight: '600',

                              fontSize: '14px',

                              display: 'inline-block',

                              ...statusStyle

                            }}

                          >

                            {bill.status}

                          </span>

                        </td>

                        <td onClick={(e) => e.stopPropagation()}>

                          <div className="action-buttons">

                            {bill.status === 'Damage' && bill.hasPaidDamage && (
                            <button

                              className="icon-btn settlement-view"

                              onClick={(e) => {

                                e.stopPropagation();

                                handleViewSettlement(bill.id);

                              }}

                              title="View Settlement Details"

                              style={{ backgroundColor: '#1565c0', color: 'white' }}

                            >

                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">

                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10z"></path>

                                <polyline points="14 2 14 10 22 10"></polyline>

                                <line x1="12" y1="19" x2="12" y2="13"></line>

                                <line x1="9" y1="16" x2="15" y2="16"></line>

                              </svg>

                            </button>
                            )}

                            {bill.status !== 'Paid' && bill.status !== 'Fully Paid' && bill.status !== 'Damage' && (bill.serviceType || '').toLowerCase() !== 'rental' && (
                            <button

                              className="icon-btn next-status"

                              onClick={async (e) => {

                                e.stopPropagation();

                                await updatePaymentStatus(bill.id, nextStatus);

                              }}

                              title={`Manually move to ${nextStatus} (Note: Payment status auto-updates when service status changes in management pages)`}

                              style={{ backgroundColor: '#4CAF50', color: 'white', zIndex: 10 }}

                            >

                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">

                                <polyline points="9 18 15 12 9 6"></polyline>

                              </svg>

                            </button>
                            )}

                          </div>

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
      {showSettlementModal && selectedSettlement && (

        <div

          className="modal-overlay active"

          onClick={(e) => {

            if (e.target.classList.contains('modal-overlay')) setShowSettlementModal(false);

          }}

        >

          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }}>

            <div className="modal-header">

              <h2>Settlement Details</h2>

              <span className="close-modal" onClick={() => setShowSettlementModal(false)}>×</span>

            </div>

            <div className="modal-body">

              <div className="detail-row">

                <strong>Service Type:</strong>

                <span>{selectedSettlement.service_type || 'N/A'}</span>

              </div>

              <div className="detail-row">

                <strong>Damage Type:</strong>

                <span>{selectedSettlement.damage_type || 'N/A'}</span>

              </div>

              <div className="detail-row">

                <strong>Description:</strong>

                <span>{selectedSettlement.damage_description || 'No description provided'}</span>

              </div>

              <div className="detail-row">

                <strong>Liability Status:</strong>

                <span style={{

                  padding: '4px 8px',

                  borderRadius: '4px',

                  backgroundColor: selectedSettlement.liability_status === 'approved' ? '#c8e6c9' : selectedSettlement.liability_status === 'rejected' ? '#ffcdd2' : '#fff9c4',

                  color: selectedSettlement.liability_status === 'approved' ? '#1b5e20' : selectedSettlement.liability_status === 'rejected' ? '#b71c1c' : '#f57f17',

                  fontWeight: '600'

                }}>

                  {selectedSettlement.liability_status?.charAt(0).toUpperCase() + selectedSettlement.liability_status?.slice(1) || 'N/A'}

                </span>

              </div>

              <div className="detail-row">

                <strong>Compensation Amount:</strong>

                <span style={{ color: '#d32f2f', fontWeight: 'bold', fontSize: '16px' }}>₱{parseFloat(selectedSettlement.compensation_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>

              </div>

              <div className="detail-row">

                <strong>Settlement Status:</strong>

                <span style={{

                  padding: '4px 8px',

                  borderRadius: '4px',

                  backgroundColor: selectedSettlement.compensation_status === 'paid' ? '#c8e6c9' : '#ffebee',

                  color: selectedSettlement.compensation_status === 'paid' ? '#1b5e20' : '#d32f2f',

                  fontWeight: '600'

                }}>

                  {selectedSettlement.compensation_status?.charAt(0).toUpperCase() + selectedSettlement.compensation_status?.slice(1) || 'N/A'}

                </span>

              </div>

              {selectedSettlement.compensation_paid_at && (

                <div className="detail-row">

                  <strong>Settlement Date:</strong>

                  <span>{new Date(selectedSettlement.compensation_paid_at).toLocaleDateString()}</span>

                </div>

              )}

              {selectedSettlement.payment_reference && (

                <div className="detail-row">

                  <strong>Payment Reference:</strong>

                  <span>{selectedSettlement.payment_reference}</span>

                </div>

              )}

              {selectedSettlement.notes && (

                <div className="detail-row">

                  <strong>Notes:</strong>

                  <span style={{ whiteSpace: 'pre-wrap' }}>{selectedSettlement.notes}</span>

                </div>

              )}

            </div>

          </div>

        </div>

      )}

      {showDetailModal && selectedBill && (

        <div

          className="modal-overlay active"

          onClick={(e) => {

            if (e.target.classList.contains('modal-overlay')) setShowDetailModal(false);

          }}

        >

          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>

            <div className="modal-header">

              <h2>Bill Details</h2>

              <span className="close-modal" onClick={() => setShowDetailModal(false)}>×</span>

            </div>

            <div className="modal-body">

              <div className="detail-row">

                <strong>Order ID:</strong>

                <span>{selectedBill.uniqueNo}</span>

              </div>

              <div className="detail-row">

                <strong>Customer Name:</strong>

                <span>{selectedBill.customerName}</span>

              </div>

              <div className="detail-row">

                <strong>Service Type:</strong>

                <span className="service-type-badge" data-service-type={(selectedBill.serviceType || '').toLowerCase()}>

                  {selectedBill.serviceTypeDisplay || selectedBill.serviceType}

                </span>

              </div>

              <div className="detail-row">

                <strong>Date:</strong>

                <span>{selectedBill.date}</span>

              </div>

              <div className="detail-row">

                <strong>Price:</strong>

                <span style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: '18px' }}>

                  {getRentalPriceDisplay(selectedBill)}

                </span>

              </div>

              <div className="detail-row">

                <strong>Payment Status:</strong>

                <span className={`status-badge ${selectedBill.status.toLowerCase().replace(' ', '-')}`}

                  style={{

                    padding: '6px 14px',

                    borderRadius: '20px',

                    fontWeight: '600',

                    fontSize: '14px',

                    ...getStatusButtonStyle(selectedBill.status)

                  }}

                >

                  {selectedBill.status}

                </span>

              </div>
              {getServiceDescription(selectedBill) && (

                <div className="detail-row">

                  <strong>Description:</strong>

                  <span>{getServiceDescription(selectedBill)}</span>

                </div>

              )}
              {/* Support multiple images */}
              {getServiceImageUrls(selectedBill) ? (

                <div className="detail-row">

                  <strong>Service Images ({getServiceImageUrls(selectedBill).length}):</strong>

                  <div style={{ marginTop: '8px' }}>
                    <SimpleImageCarousel
                      images={getServiceImageUrls(selectedBill).map((url, idx) => ({ url, label: `Photo ${idx + 1}/${getServiceImageUrls(selectedBill).length}` }))}
                      itemName="Service Photo"
                      height="300px"
                    />
                  </div>

                </div>
              ) : getServiceImageUrl(selectedBill) && (

                <div className="detail-row">

                  <strong>Service Image:</strong>

                  <div style={{ marginTop: '8px' }}>

                    <img

                      src={getServiceImageUrl(selectedBill)}

                      alt="Service"

                      style={{

                        maxWidth: '300px',

                        maxHeight: '300px',

                        border: '1px solid #ddd',

                        borderRadius: '4px',

                        cursor: 'pointer'

                      }}

                      onClick={() => openImagePreview(getServiceImageUrl(selectedBill), `${selectedBill.serviceTypeDisplay || selectedBill.serviceType} Image`)}

                      onError={(e) => {

                        e.target.style.display = 'none';

                      }}

                    />

                    <small style={{ display: 'block', fontSize: '11px', color: '#888', marginTop: '4px' }}>

                      Click to enlarge

                    </small>

                  </div>

                </div>

              )}
              {(selectedBill.serviceType || '').toLowerCase() === 'rental' && (

                <>

                  {parseFloat(selectedBill.depositRefunded || 0) > 0 && (

                    <div className="detail-row">

                      <strong>Deposit Refunded:</strong>

                      <span style={{ color: '#2e7d32', fontWeight: '600' }}>

                        ₱{parseFloat(selectedBill.depositRefunded || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

                      </span>

                    </div>

                  )}

                  {selectedBill.depositRefundDate && (

                    <div className="detail-row">

                      <strong>Deposit Refund Date:</strong>

                      <span>{new Date(selectedBill.depositRefundDate).toLocaleString()}</span>

                    </div>

                  )}

                  {selectedBill.rentalStartDate && (

                    <div className="detail-row">

                      <strong>Rental Start Date:</strong>

                      <span>{new Date(selectedBill.rentalStartDate).toLocaleDateString()}</span>

                    </div>

                  )}

                  {selectedBill.rentalEndDate && (

                    <div className="detail-row">

                      <strong>Rental End Date:</strong>

                      <span>{new Date(selectedBill.rentalEndDate).toLocaleDateString()}</span>

                    </div>

                  )}

                </>

              )}

            </div>

            <div className="modal-footer">
              <button
                className="close-btn"
                onClick={() => setShowDetailModal(false)}
              >
                Close
              </button>
              {selectedBill.status !== 'Paid' && selectedBill.status !== 'Fully Paid' && (selectedBill.serviceType || '').toLowerCase() !== 'rental' && (
              <button
                className="btn-save-list"
                onClick={async () => {
                  const nextStatus = getNextPaymentStatus(selectedBill);
                  await updatePaymentStatus(selectedBill.id, nextStatus);
                  setShowDetailModal(false);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '14px' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
                Mark as {getNextPaymentStatus(selectedBill)}
              </button>
              )}
            </div>

          </div>

        </div>

      )}
      <ImagePreviewModal

        isOpen={imagePreview.isOpen}

        imageUrl={imagePreview.imageUrl}

        altText={imagePreview.altText}

        onClose={closeImagePreview}

      />

    </div>

  );

};

export default Billing;

