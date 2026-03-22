import React, { useState, useEffect } from 'react';

import '../adminStyle/bill.css';

import AdminHeader from './AdminHeader';

import Sidebar from './Sidebar';

import { getAllBillingRecords, getBillingStats, updateBillingRecordStatus } from '../api/BillingApi';

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
    const fullPrice = parseFloat(bill.price || 0);
    const amountPaid = parseFloat(bill.pricingFactors?.amount_paid || 0);
    const remainingBalance = fullPrice - amountPaid;
    const serviceType = (bill.serviceType || '').toLowerCase();

    // For rental, show downpayment info
    if (serviceType === 'rental') {
      const downPayment = amountPaid || parseFloat(bill.pricingFactors?.downpayment ||
                         bill.pricingFactors?.down_payment ||
                         bill.pricingFactors?.downPayment ||
                         bill.specificData?.downpayment || 0);
      
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '14px' }}>Paid: ₱{parseFloat(downPayment).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span style={{ fontSize: '14px' }}>Full Price: ₱{fullPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          {remainingBalance > 0 && (
            <span style={{ fontSize: '12px', color: '#f44336' }}>Balance: ₱{remainingBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          )}
        </div>
      );
    }

    // For other services (dry cleaning, repair, customization)
    if (amountPaid > 0 && amountPaid < fullPrice) {
      // Partial payment
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '14px' }}>Paid: ₱{amountPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span style={{ fontSize: '14px' }}>Full Price: ₱{fullPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span style={{ fontSize: '12px', color: '#f44336' }}>Balance: ₱{remainingBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      );
    }

    // Fully paid or unpaid - show single price
    return `₱${fullPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

      'Down-payment': { backgroundColor: '#fff3e0', color: '#e65100' }

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

                            {bill.status !== 'Paid' && bill.status !== 'Fully Paid' && (
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
              {selectedBill.status !== 'Paid' && selectedBill.status !== 'Fully Paid' && (
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

