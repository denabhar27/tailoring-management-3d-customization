import React, { useState } from 'react';
import '../../adminStyle/PriceEditModal.css';

const CustomizationPriceEditModal = ({ order, onClose, onSave }) => {
  const [newPrice, setNewPrice] = useState(order.final_price || '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const price = parseFloat(newPrice);
    const oldPrice = parseFloat(order.final_price || 0);

    if (isNaN(price) || price <= 0) {
      setError('Please enter a valid price greater than 0');
      return;
    }

    if (price > 100000) {
      setError('Price cannot exceed ₱100,000');
      return;
    }

    if (Math.abs(price - oldPrice) < 0.01) {
      setError('New price must be different from current price');
      return;
    }

    if (!reason.trim()) {
      setError('Please provide a reason for the price change');
      return;
    }

    setLoading(true);
    try {
      await onSave(order.item_id, price, reason);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update price');
    } finally {
      setLoading(false);
    }
  };

  const priceDifference = parseFloat(newPrice || 0) - parseFloat(order.final_price || 0);

  return (
    <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content price-edit-modal">
        <div className="modal-header">
          <h2>Edit Order Price</h2>
          <span className="close-modal" onClick={onClose}>×</span>
        </div>
        
        <div className="modal-body">
          <div className="order-info">
            <div className="order-info-item">
              <div className="order-info-label">Order ID</div>
              <div className="order-info-value">#{order.order_id || order.item_id}</div>
            </div>
            <div className="order-info-item">
              <div className="order-info-label">Service</div>
              <div className="order-info-value">customization</div>
            </div>
            <div className="order-info-item">
              <div className="order-info-label">Current Price</div>
              <div className="order-info-value">₱{parseFloat(order.final_price || 0).toFixed(2)}</div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="newPrice">New Price (₱) *</label>
              <input
                type="number"
                id="newPrice"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                step="0.01"
                min="0.01"
                max="100000"
                required
                placeholder="Enter new price"
              />
              {priceDifference !== 0 && !isNaN(priceDifference) && (
                <small className={priceDifference > 0 ? 'price-increase' : 'price-decrease'}>
                  {priceDifference > 0 ? '+' : ''}₱{Math.abs(priceDifference).toFixed(2)} 
                  ({priceDifference > 0 ? 'increase' : 'decrease'})
                </small>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="reason">Reason for Price Change *</label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows="3"
                required
                placeholder="e.g., Additional materials required, Complexity adjustment, etc."
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="modal-actions price-edit-actions">
              <button type="button" className="btn-secondary price-edit-btn-secondary" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="btn-primary price-edit-btn-primary" disabled={loading}>
                {loading ? 'Updating...' : 'Update Price'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CustomizationPriceEditModal;
