# Rental Deposit System - Ready-to-Use Code Snippets

## 1. Cart API Updates

### File: `src/api/CartApi.js`

Add this function to handle rental cart items with deposits:

```javascript
export async function addRentalToCart(userId, rentalItem, selectedSizes, rentalDates) {
  try {
    // Calculate totals including deposit
    const totalPrice = selectedSizes.reduce((sum, size) => 
      sum + (parseFloat(size.price || 0) * parseInt(size.quantity || 0)), 0);
    
    const totalDeposit = selectedSizes.reduce((sum, size) => 
      sum + (parseFloat(size.deposit || 0) * parseInt(size.quantity || 0)), 0);
    
    const cartData = {
      user_id: userId,
      service_type: 'rental',
      service_id: rentalItem.item_id,
      quantity: selectedSizes.reduce((sum, s) => sum + parseInt(s.quantity || 0), 0),
      base_price: totalPrice,
      final_price: totalPrice + totalDeposit,
      specific_data: {
        item_name: rentalItem.item_name,
        selected_sizes: selectedSizes,
        rental_deposit: totalDeposit,
        rental_price: totalPrice
      },
      rental_start_date: rentalDates.startDate,
      rental_end_date: rentalDates.endDate
    };

    const response = await axios.post(`${API_URL}/cart`, cartData, {
      headers: getAuthHeaders()
    });

    return response.data;
  } catch (error) {
    console.error("Add rental to cart error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error adding rental to cart"
    };
  }
}
```

## 2. Rental Display Component

### File: `src/user/components/RentalClothes.jsx`

Add this component to display rental with deposit:

```jsx
const RentalItemCard = ({ item, onAddToCart }) => {
  const [selectedSize, setSelectedSize] = useState(null);
  const [quantity, setQuantity] = useState(1);

  const rentalPrice = parseFloat(item.price || 0);
  const depositAmount = parseFloat(item.deposit || 0);
  const totalRequired = rentalPrice + depositAmount;

  const handleAddToCart = () => {
    if (!selectedSize) {
      alert('Please select a size');
      return;
    }

    onAddToCart({
      item,
      selectedSize,
      quantity,
      rentalPrice,
      depositAmount,
      totalRequired
    });
  };

  return (
    <div className="rental-item-card">
      <img src={item.image_url} alt={item.item_name} />
      
      <h3>{item.item_name}</h3>
      <p className="brand">{item.brand}</p>
      
      <div className="rental-pricing-section">
        <div className="price-row">
          <span className="label">Rental Price:</span>
          <span className="amount">₱{rentalPrice.toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
        </div>
        
        <div className="deposit-row">
          <span className="label">Deposit (Refundable):</span>
          <span className="amount deposit">₱{depositAmount.toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
        </div>
        
        <div className="total-row">
          <span className="label">Total Required:</span>
          <span className="amount total">₱{totalRequired.toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
        </div>
      </div>

      <div className="size-selector">
        <label>Select Size:</label>
        <select value={selectedSize || ''} onChange={(e) => setSelectedSize(e.target.value)}>
          <option value="">Choose a size...</option>
          {item.available_sizes?.map(size => (
            <option key={size.sizeKey} value={size.sizeKey}>
              {size.label} (Qty: {size.quantity})
            </option>
          ))}
        </select>
      </div>

      <div className="quantity-selector">
        <label>Quantity:</label>
        <input 
          type="number" 
          min="1" 
          value={quantity}
          onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
        />
      </div>

      <button className="add-to-cart-btn" onClick={handleAddToCart}>
        Add to Cart - ₱{(totalRequired * quantity).toLocaleString('en-PH', {minimumFractionDigits: 2})}
      </button>

      <div className="deposit-info">
        <p className="info-text">
          💡 The deposit of ₱{depositAmount.toLocaleString('en-PH', {minimumFractionDigits: 2})} is fully refundable upon return of the item in good condition.
        </p>
      </div>
    </div>
  );
};
```

## 3. Cart Summary Component

### File: `src/user/components/CartSummary.jsx`

Add this to show deposit breakdown in cart:

```jsx
const CartSummary = ({ cartItems }) => {
  const calculateTotals = () => {
    let rentalPrice = 0;
    let depositAmount = 0;

    cartItems.forEach(item => {
      if (item.service_type === 'rental') {
        const specific = item.specific_data || {};
        rentalPrice += parseFloat(specific.rental_price || 0);
        depositAmount += parseFloat(specific.rental_deposit || 0);
      }
    });

    return {
      rentalPrice,
      depositAmount,
      total: rentalPrice + depositAmount
    };
  };

  const totals = calculateTotals();

  return (
    <div className="cart-summary">
      <h3>Order Summary</h3>
      
      <div className="summary-row">
        <span>Rental Price:</span>
        <span>₱{totals.rentalPrice.toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
      </div>

      <div className="summary-row deposit-row">
        <span>Deposit (Refundable):</span>
        <span>₱{totals.depositAmount.toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
      </div>

      <div className="summary-row total-row">
        <span className="bold">Total Payment Required:</span>
        <span className="bold">₱{totals.total.toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
      </div>

      <div className="deposit-notice">
        <p>
          ✓ You will pay ₱{totals.total.toLocaleString('en-PH', {minimumFractionDigits: 2})} now (rental + deposit)
        </p>
        <p>
          ✓ The deposit of ₱{totals.depositAmount.toLocaleString('en-PH', {minimumFractionDigits: 2})} will be refunded when you return the item
        </p>
      </div>
    </div>
  );
};
```

## 4. Checkout Payment Component

### File: `src/user/components/CheckoutPayment.jsx`

Add this for payment processing with deposit:

```jsx
const CheckoutPayment = ({ order, onPaymentSuccess }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('card');

  const calculatePaymentBreakdown = () => {
    let rentalTotal = 0;
    let depositTotal = 0;

    order.items?.forEach(item => {
      if (item.service_type === 'rental') {
        const specific = item.specific_data || {};
        rentalTotal += parseFloat(specific.rental_price || 0);
        depositTotal += parseFloat(specific.rental_deposit || 0);
      }
    });

    return {
      rentalTotal,
      depositTotal,
      grandTotal: rentalTotal + depositTotal
    };
  };

  const breakdown = calculatePaymentBreakdown();

  const handlePayment = async () => {
    setIsProcessing(true);

    try {
      // Process payment for rental + deposit
      const paymentData = {
        order_id: order.order_id,
        amount: breakdown.grandTotal,
        payment_method: paymentMethod,
        breakdown: {
          rental_price: breakdown.rentalTotal,
          deposit_amount: breakdown.depositTotal
        }
      };

      const response = await axios.post(`${API_URL}/billing/process-payment`, paymentData, {
        headers: getAuthHeaders()
      });

      if (response.data.success) {
        // Update order items with deposit info
        await axios.put(`${API_URL}/orders/${order.order_id}/deposit-info`, {
          items: order.items.map(item => ({
            item_id: item.item_id,
            rental_deposit: item.specific_data?.rental_deposit || 0
          }))
        }, { headers: getAuthHeaders() });

        onPaymentSuccess(response.data);
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert('Payment failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="checkout-payment">
      <h2>Payment Details</h2>

      <div className="payment-breakdown">
        <div className="breakdown-item">
          <span>Rental Price:</span>
          <span>₱{breakdown.rentalTotal.toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
        </div>

        <div className="breakdown-item deposit">
          <span>Deposit (Refundable):</span>
          <span>₱{breakdown.depositTotal.toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
        </div>

        <div className="breakdown-item total">
          <span className="bold">Total Amount Due:</span>
          <span className="bold">₱{breakdown.grandTotal.toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
        </div>
      </div>

      <div className="payment-method-section">
        <label>Payment Method:</label>
        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
          <option value="card">Credit/Debit Card</option>
          <option value="gcash">GCash</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="cash">Cash on Pickup</option>
        </select>
      </div>

      <div className="deposit-terms">
        <h4>Deposit Terms:</h4>
        <ul>
          <li>✓ Deposit is fully refundable upon return of item in good condition</li>
          <li>✓ Refund will be processed within 24 hours of item return</li>
          <li>✓ Damaged items may result in partial or no refund</li>
          <li>✓ Refund will be credited to your original payment method</li>
        </ul>
      </div>

      <button 
        className="pay-button" 
        onClick={handlePayment}
        disabled={isProcessing}
      >
        {isProcessing ? 'Processing...' : `Pay ₱${breakdown.grandTotal.toLocaleString('en-PH', {minimumFractionDigits: 2})}`}
      </button>
    </div>
  );
};
```

## 5. Order Tracking with Deposit Status

### File: `src/user/components/OrderTracking.jsx`

Add this to show deposit refund status:

```jsx
const RentalOrderTracking = ({ orderItem }) => {
  const rentalDeposit = parseFloat(orderItem.rental_deposit || 0);
  const depositRefunded = parseFloat(orderItem.deposit_refunded || 0);
  const depositRefundDate = orderItem.deposit_refund_date;

  const getDepositStatus = () => {
    if (orderItem.approval_status === 'returned') {
      if (depositRefunded > 0) {
        return {
          status: 'Refunded',
          amount: depositRefunded,
          date: depositRefundDate,
          color: 'green'
        };
      } else {
        return {
          status: 'Pending Refund',
          amount: rentalDeposit,
          date: null,
          color: 'orange'
        };
      }
    } else if (orderItem.approval_status === 'rented') {
      return {
        status: 'Held',
        amount: rentalDeposit,
        date: null,
        color: 'blue'
      };
    } else {
      return {
        status: 'Not Yet Applicable',
        amount: rentalDeposit,
        date: null,
        color: 'gray'
      };
    }
  };

  const depositStatus = getDepositStatus();

  return (
    <div className="rental-order-tracking">
      <div className="tracking-section">
        <h3>Rental Details</h3>
        <div className="detail-row">
          <span>Item:</span>
          <span>{orderItem.item_name}</span>
        </div>
        <div className="detail-row">
          <span>Rental Price:</span>
          <span>₱{(orderItem.price || 0).toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
        </div>
        <div className="detail-row">
          <span>Rental Period:</span>
          <span>{orderItem.rental_start_date} to {orderItem.rental_end_date}</span>
        </div>
      </div>

      <div className="deposit-section">
        <h3>Deposit Status</h3>
        <div className={`deposit-status ${depositStatus.color}`}>
          <div className="status-header">
            <span className="status-label">{depositStatus.status}</span>
            <span className="status-amount">₱{depositStatus.amount.toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
          </div>
          
          {depositStatus.date && (
            <div className="status-date">
              Refunded on: {new Date(depositStatus.date).toLocaleDateString('en-PH')}
            </div>
          )}

          {depositStatus.status === 'Pending Refund' && (
            <div className="status-note">
              Your deposit will be refunded within 24 hours of item return inspection.
            </div>
          )}
        </div>
      </div>

      <div className="tracking-timeline">
        <h3>Order Timeline</h3>
        <div className="timeline">
          <div className={`timeline-item ${orderItem.approval_status === 'confirmed' ? 'active' : ''}`}>
            <span className="timeline-marker">✓</span>
            <span className="timeline-label">Payment Confirmed</span>
          </div>
          <div className={`timeline-item ${orderItem.approval_status === 'ready_to_pickup' ? 'active' : ''}`}>
            <span className="timeline-marker">📦</span>
            <span className="timeline-label">Ready for Pickup</span>
          </div>
          <div className={`timeline-item ${orderItem.approval_status === 'rented' ? 'active' : ''}`}>
            <span className="timeline-marker">👕</span>
            <span className="timeline-label">Rented</span>
          </div>
          <div className={`timeline-item ${orderItem.approval_status === 'returned' ? 'active' : ''}`}>
            <span className="timeline-marker">↩️</span>
            <span className="timeline-label">Returned</span>
          </div>
          <div className={`timeline-item ${depositRefunded > 0 ? 'active' : ''}`}>
            <span className="timeline-marker">💰</span>
            <span className="timeline-label">Deposit Refunded</span>
          </div>
        </div>
      </div>
    </div>
  );
};
```

## 6. Admin Deposit Refund Processing

### File: `src/admin/components/RentalManagement.jsx`

Add this for admin to process refunds:

```jsx
const ProcessDepositRefund = ({ orderItem, onRefundProcessed }) => {
  const [damageLevel, setDamageLevel] = useState('none');
  const [refundNote, setRefundNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const rentalDeposit = parseFloat(orderItem.rental_deposit || 0);

  const refundPercentages = {
    'none': 1.0,      // 100% refund
    'minor': 0.75,    // 75% refund
    'moderate': 0.5,  // 50% refund
    'severe': 0.0     // 0% refund
  };

  const refundAmount = rentalDeposit * (refundPercentages[damageLevel] || 0);

  const handleProcessRefund = async () => {
    setIsProcessing(true);

    try {
      const response = await axios.post(
        `${API_URL}/rentals/${orderItem.rental_item_id}/process-refund`,
        {
          order_item_id: orderItem.item_id,
          damage_level: damageLevel,
          refund_amount: refundAmount,
          refund_note: refundNote
        },
        { headers: getAuthHeaders() }
      );

      if (response.data.success) {
        alert(`Deposit refund of ₱${refundAmount.toFixed(2)} processed successfully!`);
        onRefundProcessed(response.data);
      }
    } catch (error) {
      console.error('Refund processing error:', error);
      alert('Error processing refund: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="process-refund-modal">
      <h3>Process Deposit Refund</h3>

      <div className="refund-info">
        <p>Original Deposit: ₱{rentalDeposit.toLocaleString('en-PH', {minimumFractionDigits: 2})}</p>
      </div>

      <div className="form-group">
        <label>Item Condition:</label>
        <select value={damageLevel} onChange={(e) => setDamageLevel(e.target.value)}>
          <option value="none">No Damage - 100% Refund</option>
          <option value="minor">Minor Damage - 75% Refund</option>
          <option value="moderate">Moderate Damage - 50% Refund</option>
          <option value="severe">Severe Damage - 0% Refund</option>
        </select>
      </div>

      <div className="refund-amount">
        <p>Refund Amount: <strong>₱{refundAmount.toLocaleString('en-PH', {minimumFractionDigits: 2})}</strong></p>
      </div>

      <div className="form-group">
        <label>Refund Note:</label>
        <textarea 
          value={refundNote}
          onChange={(e) => setRefundNote(e.target.value)}
          placeholder="Add any notes about the item condition or refund..."
          rows="3"
        />
      </div>

      <div className="button-group">
        <button 
          className="process-btn"
          onClick={handleProcessRefund}
          disabled={isProcessing}
        >
          {isProcessing ? 'Processing...' : 'Process Refund'}
        </button>
      </div>
    </div>
  );
};
```

## 7. CSS Styling

### File: `src/styles/rental-deposit.css`

```css
/* Rental Pricing Display */
.rental-pricing-section {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 15px;
  margin: 15px 0;
  border-left: 4px solid #8B4513;
}

.price-row, .deposit-row, .total-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 14px;
}

.deposit-row {
  color: #d9534f;
  font-weight: 600;
}

.total-row {
  border-top: 2px solid #ddd;
  padding-top: 12px;
  margin-top: 12px;
  font-size: 16px;
  font-weight: bold;
  color: #333;
}

.amount {
  font-weight: 600;
  color: #333;
}

.amount.deposit {
  color: #d9534f;
}

.amount.total {
  color: #28a745;
}

/* Deposit Info */
.deposit-info {
  background: #e8f4f8;
  border-left: 4px solid #17a2b8;
  padding: 12px;
  border-radius: 4px;
  margin-top: 15px;
}

.info-text {
  margin: 0;
  font-size: 13px;
  color: #0c5460;
  line-height: 1.5;
}

/* Cart Summary */
.cart-summary {
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #eee;
}

.summary-row.deposit-row {
  color: #d9534f;
  font-weight: 600;
}

.summary-row.total-row {
  border-bottom: none;
  border-top: 2px solid #333;
  padding-top: 15px;
  margin-top: 15px;
  font-size: 16px;
  font-weight: bold;
}

.deposit-notice {
  background: #d4edda;
  border: 1px solid #c3e6cb;
  border-radius: 4px;
  padding: 12px;
  margin-top: 15px;
  font-size: 13px;
  color: #155724;
}

.deposit-notice p {
  margin: 5px 0;
}

/* Deposit Status */
.deposit-section {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 15px;
  margin: 15px 0;
}

.deposit-status {
  border-left: 4px solid #6c757d;
  padding: 12px;
  background: white;
  border-radius: 4px;
}

.deposit-status.green {
  border-left-color: #28a745;
  background: #d4edda;
}

.deposit-status.orange {
  border-left-color: #ffc107;
  background: #fff3cd;
}

.deposit-status.blue {
  border-left-color: #17a2b8;
  background: #d1ecf1;
}

.status-header {
  display: flex;
  justify-content: space-between;
  font-weight: 600;
  margin-bottom: 8px;
}

.status-label {
  font-size: 14px;
}

.status-amount {
  font-size: 16px;
}

.status-date {
  font-size: 12px;
  margin-top: 8px;
  opacity: 0.8;
}

.status-note {
  font-size: 12px;
  margin-top: 8px;
  font-style: italic;
}

/* Timeline */
.tracking-timeline {
  margin-top: 20px;
}

.timeline {
  display: flex;
  justify-content: space-between;
  position: relative;
  padding: 20px 0;
}

.timeline::before {
  content: '';
  position: absolute;
  top: 30px;
  left: 0;
  right: 0;
  height: 2px;
  background: #ddd;
  z-index: 0;
}

.timeline-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  z-index: 1;
  flex: 1;
}

.timeline-marker {
  width: 40px;
  height: 40px;
  background: white;
  border: 2px solid #ddd;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  margin-bottom: 10px;
}

.timeline-item.active .timeline-marker {
  background: #28a745;
  border-color: #28a745;
  color: white;
}

.timeline-label {
  font-size: 12px;
  text-align: center;
  color: #666;
}

.timeline-item.active .timeline-label {
  color: #28a745;
  font-weight: 600;
}
```

## Implementation Checklist

- [ ] Add CartApi functions for rental with deposit
- [ ] Update RentalClothes component to display deposit
- [ ] Create CartSummary component with deposit breakdown
- [ ] Implement CheckoutPayment with deposit calculation
- [ ] Add OrderTracking with deposit status
- [ ] Create admin refund processing component
- [ ] Add CSS styling for deposit display
- [ ] Test all payment flows with deposit
- [ ] Test deposit refund processing
- [ ] Update React Native components
- [ ] Test on mobile devices
- [ ] Deploy to production

## Notes

- All amounts are in PHP (₱)
- Deposit calculations use DECIMAL(10,2) for precision
- Refund percentages can be adjusted based on damage level
- All transactions should be logged for audit trail
- Email notifications should be sent for refund processing
