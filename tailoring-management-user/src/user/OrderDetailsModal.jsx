import React, { useState, useEffect } from 'react';
import { getOrderItemDetails } from '../api/OrderApi';

const OrderDetailsModal = ({ isOpen, onClose, orderItemId }) => {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && orderItemId) {
      fetchOrderDetails();
    }
  }, [isOpen, orderItemId]);

  const fetchOrderDetails = async () => {
    setLoading(true);
    setError('');
    try {
      console.log('Fetching order details for order_item_id:', orderItemId);
      const result = await getOrderItemDetails(orderItemId);
      if (result.success) {
        setOrder(result.order_item);
      } else {
        setError(result.message || 'Failed to load order details');
      }
    } catch (err) {
      setError('Failed to load order details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="auth-container">
          <div className="auth-header">
            <h2>Order Details</h2>
            <p className="auth-subtitle">Order Item ID: {orderItemId}</p>
          </div>
          <div style={{ padding: '16px' }}>
            {loading && <div style={{ textAlign: 'center', padding: '40px 0' }}>Loading...</div>}
            {error && <div style={{ color: 'red', textAlign: 'center' }}>{error}</div>}
            {order && (
              <div style={{ display: 'grid', gap: '12px' }}>
                <div><strong>Parent Order ID:</strong> {order.parent_order_id || order.order_id}</div>
                <div><strong>Child Order ID:</strong> {order.child_order_id || order.item_id}</div>
                <div><strong>Order Item ID:</strong> {order.item_id}</div>
                <div><strong>Service Type:</strong> {order.service_type ? order.service_type.charAt(0).toUpperCase() + order.service_type.slice(1).replace('_', ' ') : 'N/A'}</div>
                <div><strong>Status:</strong> {order.approval_status ? order.approval_status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'N/A'}</div>
                <div><strong>Final Price:</strong> ₱{order.final_price ? parseFloat(order.final_price).toLocaleString() : 'N/A'}</div>
                <div><strong>Created:</strong> {order.order_date ? new Date(order.order_date).toLocaleString() : 'N/A'}</div>
                {order.appointment_date && (
                  <div><strong>Appointment Date:</strong> {new Date(order.appointment_date).toLocaleString()}</div>
                )}
                {order.rental_start_date && order.rental_end_date && (
                  <div><strong>Rental Period:</strong> {new Date(order.rental_start_date).toLocaleDateString()} - {new Date(order.rental_end_date).toLocaleDateString()}</div>
                )}
              </div>
            )}
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailsModal;
