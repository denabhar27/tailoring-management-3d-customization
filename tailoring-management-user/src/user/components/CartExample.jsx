import React, { useState } from 'react';
import Cart from './Cart';
import { addToCart } from '../../api/CartApi';

const exampleServices = [
  {
    serviceType: 'rental',
    serviceId: 1,
    basePrice: '1000.00',
    finalPrice: '1200.00',
    name: 'Formal Suit Rental'
  },
  {
    serviceType: 'repair',
    serviceId: 1,
    basePrice: '500.00',
    finalPrice: '500.00',
    name: 'Jacket Repair'
  },
  {
    serviceType: 'customization',
    serviceId: 1,
    basePrice: '800.00',
    finalPrice: '950.00',
    name: 'Suit Customization'
  },
  {
    serviceType: 'dry_cleaning',
    serviceId: 1,
    basePrice: '300.00',
    finalPrice: '300.00',
    name: 'Dry Cleaning Service'
  }
];

const CartExample = () => {
  const [cartOpen, setCartOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleAddToCart = async (service) => {
    setLoading(true);
    setMessage('');

    try {
      const itemData = {
        serviceType: service.serviceType,
        serviceId: service.serviceId,
        quantity: 1,
        basePrice: service.basePrice,
        finalPrice: service.finalPrice,
        pricingFactors: {},
        specificData: {
          name: service.name,
          addedAt: new Date().toISOString()
        }
      };

      if (service.serviceType === 'rental') {
        itemData.rentalDates = {
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        };
      }

      const result = await addToCart(itemData);

      if (result.success) {
        setMessage(`✅ ${service.name} added to cart!`);
        setCartOpen(true);
      } else {
        setMessage(`❌ Error: ${result.message}`);
      }
    } catch (error) {
      setMessage('❌ Failed to add item to cart');
      console.error('Add to cart error:', error);
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleCartUpdate = () => {
    console.log('Cart was updated!');
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Cart Integration Example</h1>
      <p>This is a demo page to test the cart functionality.</p>
      {message && (
        <div style={{
          padding: '12px',
          margin: '20px 0',
          borderRadius: '6px',
          backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da',
          color: message.includes('✅') ? '#155724' : '#721c24',
          border: `1px solid ${message.includes('✅') ? '#c3e6cb' : '#f5c6cb'}`
        }}>
          {message}
        </div>
      )}
      <div style={{ marginBottom: '30px', textAlign: 'center' }}>
        <button
          onClick={() => setCartOpen(!cartOpen)}
          style={{
            padding: '12px 24px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          {cartOpen ? 'Close Cart' : 'Open Cart'}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
        {exampleServices.map((service) => (
          <div
            key={`${service.serviceType}-${service.serviceId}`}
            style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '20px',
              backgroundColor: '#f8f9fa'
            }}
          >
            <h3>{service.name}</h3>
            <p><strong>Type:</strong> {service.serviceType}</p>
            <p><strong>Price:</strong> ₱{parseFloat(service.finalPrice).toFixed(2)}</p>

            <button
              onClick={() => handleAddToCart(service)}
              disabled={loading}
              style={{
                marginTop: '15px',
                padding: '10px 16px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? 'Adding...' : 'Add to Cart'}
            </button>
          </div>
        ))}
      </div>
      <div style={{ marginTop: '40px', padding: '20px', backgroundColor: '#e9ecef', borderRadius: '8px' }}>
        <h3>How to Test:</h3>
        <ol style={{ lineHeight: '1.6' }}>
          <li>Click "Add to Cart" on any service above</li>
          <li>The cart will open automatically showing the added item</li>
          <li>Try adding multiple items to the cart</li>
          <li>Test quantity updates, file uploads (for repair/customization)</li>
          <li>Try removing items or clearing the cart</li>
          <li>Submit the order to test the full flow</li>
        </ol>

        <h4 style={{ marginTop: '20px' }}>Features to Test:</h4>
        <ul style={{ lineHeight: '1.6' }}>
          <li>✅ Add items to cart</li>
          <li>✅ Update item quantities</li>
          <li>✅ Remove individual items</li>
          <li>✅ Clear entire cart</li>
          <li>✅ File uploads for repair/customization</li>
          <li>✅ Order submission with notes</li>
          <li>✅ Cart summary with totals</li>
          <li>✅ Error handling and loading states</li>
        </ul>
      </div>
      <Cart
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        onCartUpdate={handleCartUpdate}
      />
    </div>
  );
};

export default CartExample;
