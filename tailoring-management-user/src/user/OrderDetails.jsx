import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { notificationApi } from '../api/NotificationApi';

const OrderDetails = () => {
  const { orderItemId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
 
    const fetchOrder = async () => {
      try {
  
        console.log('Fetching order details for order_item_id:', orderItemId);
        setOrder({ id: orderItemId, status: 'Loading...' });
      } catch (err) {
        setError('Failed to load order details');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderItemId]);

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading order details...</div>;
  if (error) return <div style={{ padding: '20px', color: 'red' }}>{error}</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <button onClick={() => navigate(-1)} style={{ marginBottom: '16px', padding: '8px 16px' }}>
        ← Back
      </button>
      <h2>Order Details</h2>
      <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '16px', marginTop: '16px' }}>
        <p><strong>Order Item ID:</strong> {orderItemId}</p>
        <p><strong>Status:</strong> {order?.status || 'Unknown'}</p>
      
      </div>
    </div>
  );
};

export default OrderDetails;
