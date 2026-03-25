import React, { useState, useEffect } from 'react';
import '../adminStyle/inventory.css';
import AdminHeader from './AdminHeader';
import Sidebar from './Sidebar';
import { getAvailableRentals, getRentalImageUrl } from '../api/RentalApi';
import ImagePreviewModal from '../components/ImagePreviewModal';

const SIZE_LABELS = {
  small: 'Small (S)',
  medium: 'Medium (M)',
  large: 'Large (L)',
  extra_large: 'Extra Large (XL)'
};

const parseSizeOptions = (rawSize) => {
  if (!rawSize) return {};

  try {
    const parsed = typeof rawSize === 'string' ? JSON.parse(rawSize) : rawSize;

    // v2 format: size_entries
    if (parsed?.format === 'rental_size_v2' && Array.isArray(parsed.size_entries)) {
      const result = {};
      parsed.size_entries.forEach(entry => {
        const key = entry.sizeKey !== 'custom' ? entry.sizeKey : (entry.customLabel || 'custom');
        const quantity = parseInt(entry.quantity, 10);
        result[key] = { inch: '', cm: '', quantity: Number.isNaN(quantity) ? 0 : Math.max(0, quantity) };
      });
      return result;
    }

    const source = parsed?.size_options || parsed?.sizeOptions || {};

    if (!source || typeof source !== 'object') return {};

    const normalized = {};
    Object.keys(SIZE_LABELS).forEach((key) => {
      const option = source[key];
      if (!option || typeof option !== 'object') return;

      const quantity = parseInt(option.quantity, 10);
      normalized[key] = {
        inch: option.inch || '',
        cm: option.cm || '',
        quantity: Number.isNaN(quantity) ? 0 : Math.max(0, quantity)
      };
    });

    return normalized;
  } catch (e) {
    return {};
  }
};

const getAvailableSizesText = (sizeOptions) => {
  const entries = Object.entries(sizeOptions || {});
  if (entries.length === 0) return 'No sizes configured';
  return entries
    .map(([key, option]) => `${SIZE_LABELS[key] || key}: ${option?.quantity || 0}`)
    .join(', ');
};

const Inventory = () => {
  const [allItems, setAllItems] = useState([]);
  const [inventoryStats, setInventoryStats] = useState({
    total: 0,
    available: 0,
    rented: 0,
    repair: 0,
    totalValue: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [imagePreview, setImagePreview] = useState({ isOpen: false, imageUrl: '', altText: '' });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const rentalResponse = await getAvailableRentals();
        const rentals = rentalResponse?.items || [];

        const mapped = rentals.map((item) => {
          const sizeOptions = parseSizeOptions(item.size);
          const totalBySizes = Object.values(sizeOptions).reduce((sum, option) => sum + (option.quantity || 0), 0);
          const availableQty = totalBySizes > 0 ? totalBySizes : (parseInt(item.total_available, 10) || 0);

          return {
            ...item,
            id: item.item_id,
            sizeOptions,
            availableQty,
            image: item.front_image ? getRentalImageUrl(item.front_image) : getRentalImageUrl(item.image_url),
            displayCategory: item.category ? item.category.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') : 'N/A'
          };
        });

        setAllItems(mapped);

        const stats = {
          total: mapped.length,
          available: mapped.filter((item) => (item.status || 'available') === 'available').length,
          rented: mapped.filter((item) => (item.status || '').toLowerCase() === 'rented').length,
          repair: mapped.filter((item) => (item.status || '').toLowerCase() === 'maintenance').length,
          totalValue: mapped.reduce((sum, item) => sum + ((parseFloat(item.price) || 0) * (item.availableQty || 0)), 0)
        };

        setInventoryStats(stats);
      } catch (error) {
        console.error('Error fetching inventory data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredItems = allItems.filter((item) => {
    const haystack = `${item.item_name || ''} ${item.brand || ''} ${item.displayCategory || ''}`.toLowerCase();
    const matchesSearch = haystack.includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter ? item.category === categoryFilter : true;
    return matchesSearch && matchesCategory;
  });

  const uniqueCategories = [...new Set(allItems.map((item) => item.category).filter(Boolean))];

  const handleRowClick = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const openImagePreview = (imageUrl, altText) => {
    setImagePreview({ isOpen: true, imageUrl, altText });
  };

  const closeImagePreview = () => {
    setImagePreview({ isOpen: false, imageUrl: '', altText: '' });
  };

  return (
    <div className="inventory-management">
      <Sidebar />
      <AdminHeader />

      <div className="content">
        <div className="dashboard-title">
          <div>
            <h2>Inventory Management</h2>
            <p>Track available rental clothes</p>
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
              <span>Available Items</span>
              <div className="stat-icon" style={{ background: '#e8f5e9', color: '#2e7d32' }}>
                <i className="fas fa-check-circle"></i>
              </div>
            </div>
            <div className="stat-number">{inventoryStats.available}</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>Rented Items</span>
              <div className="stat-icon" style={{ background: '#fff3e0', color: '#ef6c00' }}>
                <i className="fas fa-user-clock"></i>
              </div>
            </div>
            <div className="stat-number">{inventoryStats.rented}</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>Maintenance</span>
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
            placeholder="Search by item name, brand, or category"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All Categories</option>
            {uniqueCategories.map((category) => (
              <option key={category} value={category}>
                {category.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')}
              </option>
            ))}
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
                  <th>Item Name</th>
                  <th>Category</th>
                  <th>Brand</th>
                  <th>Available Sizes</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>
                      No rental inventory items found
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => handleRowClick(item)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td><strong>{item.item_name}</strong></td>
                      <td>{item.displayCategory}</td>
                      <td>{item.brand || 'N/A'}</td>
                      <td>{getAvailableSizesText(item.sizeOptions)}</td>
                      <td>{item.availableQty}</td>
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
              <h2>Rental Inventory Details</h2>
              <span className="close-modal" onClick={() => setShowDetailModal(false)}>×</span>
            </div>
            <div className="modal-body">
              <div className="detail-row">
                <strong>Item:</strong>
                <span>{selectedItem.item_name}</span>
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
              <div className="detail-row">
                <strong>Category:</strong>
                <span>{selectedItem.displayCategory}</span>
              </div>
              <div className="detail-row">
                <strong>Brand:</strong>
                <span>{selectedItem.brand || 'N/A'}</span>
              </div>
              <div className="detail-row">
                <strong>Material:</strong>
                <span>{selectedItem.material || 'N/A'}</span>
              </div>
              <div className="detail-row">
                <strong>Total Quantity:</strong>
                <span>{selectedItem.availableQty}</span>
              </div>
              {selectedItem.description && (
                <div className="detail-row">
                  <strong>Description:</strong>
                  <span>{selectedItem.description}</span>
                </div>
              )}

              {Object.keys(selectedItem.sizeOptions || {}).length > 0 && (
                <div className="detail-row" style={{ display: 'block' }}>
                  <strong>Size Availability:</strong>
                  <div style={{ marginTop: '8px' }}>
                    {Object.entries(selectedItem.sizeOptions)
                      .map(([key, option]) => (
                        <div key={key} style={{ padding: '6px 0', borderBottom: '1px solid #eee' }}>
                          <strong>{SIZE_LABELS[key] || key}</strong> - Qty: {option.quantity}
                          <span style={{
                            marginLeft: '8px',
                            color: (option.quantity || 0) <= 0 ? '#b71c1c' : '#2e7d32',
                            fontWeight: 700
                          }}>
                            {(option.quantity || 0) <= 0 ? 'Unavailable' : 'Available'}
                          </span>
                          {(option.cm || option.inch) ? ` (${option.cm || '-'} cm / ${option.inch || '-'} in)` : ''}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {selectedItem.image && (
                <div className="detail-row">
                  <strong>Item Image:</strong>
                  <div style={{ marginTop: '8px' }}>
                    <img
                      src={selectedItem.image}
                      alt="Rental Item"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '400px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                      onClick={() => openImagePreview(selectedItem.image, `${selectedItem.item_name} - Rental Item`)}
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
