import React, { useState, useEffect } from 'react';
import '../adminStyle/inventory.css';
import AdminHeader from './AdminHeader';
import Sidebar from './Sidebar';
import { getCompletedItems, getItemsByServiceType, getInventoryStats } from '../api/InventoryApi';
import ImagePreviewModal from '../components/ImagePreviewModal';
import { API_BASE_URL } from '../api/config';

const Inventory = () => {
  const [allItems, setAllItems] = useState([]);
  const [inventoryStats, setInventoryStats] = useState({
    total: 0,
    customization: 0,
    dryCleaning: 0,
    repair: 0,
    totalValue: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [imagePreview, setImagePreview] = useState({ isOpen: false, imageUrl: '', altText: '' });

  useEffect(() => {
    const fetchData = async () => {
      try {

        const itemsResponse = await getCompletedItems();
        if (itemsResponse.success) {
          setAllItems(itemsResponse.items);
        }

        const statsResponse = await getInventoryStats();
        if (statsResponse.success) {
          setInventoryStats(statsResponse.stats);
        }
      } catch (error) {
        console.error('Error fetching inventory data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredItems = allItems.filter(item => {
    const matchesSearch =
      item.uniqueNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.customerName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesService = serviceFilter ? (item.serviceTypeDisplay || item.serviceType) === serviceFilter : true;

    return matchesSearch && matchesService;
  });

  const handleServiceFilterChange = async (e) => {
    const serviceType = e.target.value;
    setServiceFilter(serviceType);

    if (serviceType === '') {

      setLoading(true);
      const response = await getCompletedItems();
      if (response.success) {
        setAllItems(response.items);
      }
      setLoading(false);
    } else {

      setLoading(true);
      const response = await getItemsByServiceType(serviceType);
      if (response.success) {
        setAllItems(response.items);
      }
      setLoading(false);
    }
  };

  const handleRowClick = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const getServiceImageUrl = (item) => {

    if (item.completedItemImage && item.completedItemImage !== 'no-image') {
      if (item.completedItemImage.startsWith('http')) {
        return item.completedItemImage;
      }
      return `${API_BASE_URL}${item.completedItemImage}`;
    }

    if (item.specificData) {
      const imageUrl = item.specificData.imageUrl || item.specificData.completed_image || item.specificData.completedImage;
      if (imageUrl && imageUrl !== 'no-image') {
        if (imageUrl.startsWith('http')) {
          return imageUrl;
        }
        return `${API_BASE_URL}${imageUrl}`;
      }
    }

    return null;
  };

  const getServiceDescription = (item) => {
    if (!item.specificData) return null;
    const data = item.specificData;
    const serviceType = (item.serviceType || '').toLowerCase();

    if (serviceType === 'dry_cleaning' || serviceType === 'dry-cleaning' || serviceType === 'drycleaning') {
      return `${data.garmentType || 'Garment'} - Brand: ${data.brand || 'N/A'} - Quantity: ${data.quantity || 1}`;
    } else if (serviceType === 'repair') {
      return `${data.serviceName || 'Repair'} - ${data.damageDescription || 'No description'}`;
    } else if (serviceType === 'customization' || serviceType === 'customize') {
      return `${data.garmentType || 'Custom'} - ${data.fabricType || 'N/A'} fabric`;
    }

    return data.description || data.notes || 'Service details';
  };

  const openImagePreview = (imageUrl, altText) => {
    setImagePreview({ isOpen: true, imageUrl, altText });
  };

  const closeImagePreview = () => {
    setImagePreview({ isOpen: false, imageUrl: '', altText: '' });
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

  return (
    <div className="inventory-management">
      <Sidebar />
      <AdminHeader />

      <div className="content">
        <div className="dashboard-title">
          <div>
            <h2>Inventory Management</h2>
            <p>Track completed service items</p>
          </div>
        </div>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-header">
              <span>Total Items</span>
              <div className="stat-icon" style={{ background: '#e3f2fd', color: '#2196f3' }}>
                <i className="fas fa-box"></i>
              </div>
            </div>
            <div className="stat-number">{inventoryStats.total}</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>Customization</span>
              <div className="stat-icon" style={{ background: '#fff3e0', color: '#ff9800' }}>
                <i className="fas fa-tshirt"></i>
              </div>
            </div>
            <div className="stat-number">{inventoryStats.customization}</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>Dry Cleaning</span>
              <div className="stat-icon" style={{ background: '#e8f5e9', color: '#4caf50' }}>
                <i className="fas fa-tint"></i>
              </div>
            </div>
            <div className="stat-number">{inventoryStats.dryCleaning}</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>Repair</span>
              <div className="stat-icon" style={{ background: '#ffebee', color: '#f44336' }}>
                <i className="fas fa-cut"></i>
              </div>
            </div>
            <div className="stat-number">{inventoryStats.repair}</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>Total Value</span>
              <div className="stat-icon" style={{ background: '#f3e5f5', color: '#9c27b0' }}>
                <i className="fas fa-dollar-sign"></i>
              </div>
            </div>
            <div className="stat-number" style={{ fontSize: '24px' }}>
              ₱{inventoryStats.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
        <div className="search-container">
          <input
            type="text"
            placeholder="Search by Unique No. or Customer Name"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select value={serviceFilter} onChange={handleServiceFilterChange}>
            <option value="">All Services</option>
            <option value="Customization">Customization</option>
            <option value="Dry Cleaning">Dry Cleaning</option>
            <option value="Repair">Repair</option>
            <option value="Alteration">Alteration</option>
            <option value="Consultation">Consultation</option>
          </select>
        </div>
        <div className="table-container">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}>
              Loading inventory items...
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Unique No.</th>
                  <th>Customer Name</th>
                  <th>Service Type</th>
                  <th>Date Completed</th>
                  <th>Price</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                      No inventory items found
                    </td>
                  </tr>
                ) : (
                  filteredItems.map(item => (
                    <tr
                      key={item.id}
                      onClick={() => handleRowClick(item)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td><strong>{item.uniqueNo}</strong></td>
                      <td>{item.customerName}</td>
                      <td>
                        <span className="service-type-badge" data-service-type={(item.serviceType || '').toLowerCase()}>
                          {item.serviceTypeDisplay || item.serviceType}
                        </span>
                      </td>
                      <td>{item.date}</td>
                      <td style={{ fontWeight: '600', color: '#2e7d32' }}>
                        ₱{parseFloat(item.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td>
                        <span style={{
                          padding: '6px 12px',
                          borderRadius: '20px',
                          fontSize: '13px',
                          fontWeight: '600',
                          backgroundColor: '#e8f5e9',
                          color: '#2e7d32'
                        }}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {showDetailModal && selectedItem && (
        <div
          className="modal-overlay active"
          onClick={(e) => {
            if (e.target.classList.contains('modal-overlay')) setShowDetailModal(false);
          }}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>Completed Item Details</h2>
              <span className="close-modal" onClick={() => setShowDetailModal(false)}>×</span>
            </div>
            <div className="modal-body">
              <div className="detail-row">
                <strong>Unique No:</strong>
                <span>{selectedItem.uniqueNo}</span>
              </div>
              <div className="detail-row">
                <strong>Order ID:</strong>
                <span>#{selectedItem.orderId}</span>
              </div>
              <div className="detail-row">
                <strong>Customer Name:</strong>
                <span>{selectedItem.customerName}</span>
              </div>
              {selectedItem.customerEmail && (
                <div className="detail-row">
                  <strong>Email:</strong>
                  <span>{selectedItem.customerEmail}</span>
                </div>
              )}
              {selectedItem.customerPhone && (
                <div className="detail-row">
                  <strong>Phone:</strong>
                  <span>{selectedItem.customerPhone}</span>
                </div>
              )}
              <div className="detail-row">
                <strong>Service Type:</strong>
                <span className="service-type-badge" data-service-type={(selectedItem.serviceType || '').toLowerCase()}>
                  {selectedItem.serviceTypeDisplay || selectedItem.serviceType}
                </span>
              </div>
              <div className="detail-row">
                <strong>Date Completed:</strong>
                <span>{selectedItem.date}</span>
              </div>
              <div className="detail-row">
                <strong>Price:</strong>
                <span style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: '18px' }}>
                  ₱{parseFloat(selectedItem.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="detail-row">
                <strong>Status:</strong>
                <span style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontWeight: '600',
                  fontSize: '14px',
                  backgroundColor: '#e8f5e9',
                  color: '#2e7d32'
                }}>
                  {selectedItem.status}
                </span>
              </div>
              {getServiceDescription(selectedItem) && (
                <div className="detail-row">
                  <strong>Description:</strong>
                  <span>{getServiceDescription(selectedItem)}</span>
                </div>
              )}
              {selectedItem.specificData && (
                <>
                  {selectedItem.serviceType?.toLowerCase() === 'dry_cleaning' || selectedItem.serviceType?.toLowerCase() === 'dry-cleaning' || selectedItem.serviceType?.toLowerCase() === 'drycleaning' ? (
                    <>
                      {selectedItem.specificData.garmentType && (
                        <div className="detail-row">
                          <strong>Garment Type:</strong>
                          <span>{selectedItem.specificData.garmentType}</span>
                        </div>
                      )}
                      {selectedItem.specificData.brand && (
                        <div className="detail-row">
                          <strong>Brand:</strong>
                          <span>{selectedItem.specificData.brand}</span>
                        </div>
                      )}
                      {selectedItem.specificData.quantity && (
                        <div className="detail-row">
                          <strong>Quantity:</strong>
                          <span>{selectedItem.specificData.quantity}</span>
                        </div>
                      )}
                    </>
                  ) : selectedItem.serviceType?.toLowerCase() === 'repair' ? (
                    <>
                      {selectedItem.specificData.serviceName && (
                        <div className="detail-row">
                          <strong>Service Name:</strong>
                          <span>{selectedItem.specificData.serviceName}</span>
                        </div>
                      )}
                      {selectedItem.specificData.damageLevel && (
                        <div className="detail-row">
                          <strong>Damage Level:</strong>
                          <span>{selectedItem.specificData.damageLevel}</span>
                        </div>
                      )}
                      {selectedItem.specificData.damageDescription && (
                        <div className="detail-row">
                          <strong>Damage Description:</strong>
                          <span>{selectedItem.specificData.damageDescription}</span>
                        </div>
                      )}
                    </>
                  ) : selectedItem.serviceType?.toLowerCase() === 'customization' || selectedItem.serviceType?.toLowerCase() === 'customize' ? (
                    <>
                      {selectedItem.specificData.garmentType && (
                        <div className="detail-row">
                          <strong>Garment Type:</strong>
                          <span>{selectedItem.specificData.garmentType}</span>
                        </div>
                      )}
                      {selectedItem.specificData.fabricType && (
                        <div className="detail-row">
                          <strong>Fabric Type:</strong>
                          <span>{selectedItem.specificData.fabricType}</span>
                        </div>
                      )}
                    </>
                  ) : null}
                </>
              )}
              {getServiceImageUrl(selectedItem) && (
                <div className="detail-row">
                  <strong>Completed Item Image:</strong>
                  <div style={{ marginTop: '8px' }}>
                    <img
                      src={getServiceImageUrl(selectedItem)}
                      alt="Completed Item"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '400px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                      onClick={() => openImagePreview(getServiceImageUrl(selectedItem), `${selectedItem.serviceTypeDisplay || selectedItem.serviceType} - Completed Item`)}
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
              {selectedItem.pricingFactors?.adminNotes && (
                <div className="detail-row">
                  <strong>Admin Notes:</strong>
                  <span>{selectedItem.pricingFactors.adminNotes}</span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="close-btn" onClick={() => setShowDetailModal(false)}>
                Close
              </button>
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

export default Inventory;
