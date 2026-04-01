# Rental Deposit System - Next Implementation Phases

## Phase 2: User-Facing Display & Payment

### Files to Update:

#### 1. `tailoring-management-user/src/user/components/RentalClothes.jsx`
**Changes needed:**
- Display deposit amount alongside price
- Show: "Price: ₱X + Deposit: ₱Y"
- Update cart addition logic to include deposit

**Code template:**
```jsx
// Display deposit in rental item card
<div className="rental-pricing">
  <p>Price: ₱{parseFloat(item.price).toFixed(2)}</p>
  <p>Deposit: ₱{parseFloat(item.deposit || 0).toFixed(2)}</p>
  <p className="total-required">
    Total Required: ₱{(parseFloat(item.price) + parseFloat(item.deposit || 0)).toFixed(2)}
  </p>
</div>
```

#### 2. `tailoring-management-user/src/api/CartApi.js`
**Changes needed:**
- Update cart item structure to include deposit
- Calculate total with deposit in cart calculations

**Code template:**
```javascript
// When adding rental to cart
const cartItem = {
  service_type: 'rental',
  service_id: item.item_id,
  base_price: item.price,
  rental_deposit: item.deposit,
  final_price: parseFloat(item.price) + parseFloat(item.deposit || 0),
  specific_data: {
    selected_sizes: selectedSizes,
    rental_deposit: item.deposit
  }
};
```

#### 3. Cart Display Component
**Changes needed:**
- Show deposit breakdown in cart
- Display: "Price: ₱X, Deposit: ₱Y, Total: ₱Z"

#### 4. Checkout/Payment Component
**Changes needed:**
- Calculate total payment including deposit
- Update payment confirmation to show deposit
- Display: "You will pay ₱(price + deposit) now"

**Code template:**
```javascript
const calculateRentalTotal = (cartItems) => {
  return cartItems
    .filter(item => item.service_type === 'rental')
    .reduce((total, item) => {
      const price = parseFloat(item.base_price || 0);
      const deposit = parseFloat(item.rental_deposit || 0);
      return total + price + deposit;
    }, 0);
};
```

## Phase 3: Order Tracking & Deposit Refund

### Files to Update:

#### 1. Order Tracking Components
**Changes needed:**
- Display deposit amount in order details
- Show deposit refund status
- Track deposit refund date

#### 2. Admin Rental Management
**Changes needed:**
- Update payment logic to require full price + deposit
- Modify status flow to require full payment before "rented"
- Add deposit refund button on item return

**Code template:**
```javascript
// Calculate required payment for rental
const calculateRequiredPayment = (rentalItem, selectedSizes) => {
  const totalPrice = selectedSizes.reduce((sum, size) => 
    sum + (parseFloat(size.price) * parseInt(size.quantity)), 0);
  
  const totalDeposit = selectedSizes.reduce((sum, size) => 
    sum + (parseFloat(size.deposit) * parseInt(size.quantity)), 0);
  
  return {
    price: totalPrice,
    deposit: totalDeposit,
    total: totalPrice + totalDeposit
  };
};
```

#### 3. Deposit Refund Logic
**Changes needed:**
- Create endpoint to process deposit refund
- Check item condition before refunding
- Update order_items.deposit_refunded and deposit_refund_date

**Code template:**
```javascript
// Process deposit refund
const processDepositRefund = async (orderItemId, damageLevel = 'none') => {
  const refundPercentage = {
    'none': 1.0,      // 100% refund
    'minor': 0.75,    // 75% refund
    'moderate': 0.5,  // 50% refund
    'severe': 0.0     // 0% refund
  };
  
  const refundAmount = rentalDeposit * (refundPercentage[damageLevel] || 0);
  
  // Update order_items
  // Create refund transaction
  // Send notification to user
};
```

## Phase 4: React Native Implementation

### Files to Create/Update:

#### 1. React Native Rental Components
- Mirror all changes from web components
- Update rental display screens
- Update checkout flow
- Update order tracking

#### 2. React Native API Integration
- Ensure deposit data is included in all rental API calls
- Update cart calculations for mobile

## Phase 5: Admin Dashboard Enhancements

### Files to Update:

#### 1. Rental Analytics
**Changes needed:**
- Track total deposits collected
- Track deposit refunds issued
- Show deposit-related metrics

#### 2. Payment Management
**Changes needed:**
- Show deposit breakdown in payment records
- Track deposit refund transactions separately
- Generate deposit refund reports

## Database Queries Reference

### Get rental with deposit info:
```sql
SELECT item_id, item_name, price, deposit, 
       (price + deposit) as total_required
FROM rental_inventory
WHERE item_id = ?;
```

### Get order with deposit tracking:
```sql
SELECT oi.item_id, oi.price, oi.rental_deposit, 
       oi.deposit_refunded, oi.deposit_refund_date
FROM order_items oi
WHERE oi.service_type = 'rental' AND oi.order_id = ?;
```

### Calculate total deposits collected:
```sql
SELECT SUM(rental_deposit) as total_deposits_collected,
       SUM(deposit_refunded) as total_deposits_refunded
FROM order_items
WHERE service_type = 'rental' AND approval_status IN ('rented', 'returned');
```

## API Endpoints to Create/Update

### Existing (Already Updated):
- `POST /api/rentals` - Create rental with deposit
- `PUT /api/rentals/:id` - Update rental with deposit

### To Create:
- `POST /api/rentals/:id/process-refund` - Process deposit refund
- `GET /api/rentals/deposits/analytics` - Get deposit analytics
- `GET /api/orders/:id/deposit-status` - Get order deposit status

## Testing Scenarios

### Admin Testing:
1. Create rental item with price ₱500 and deposit ₱1000
2. Edit rental item to change deposit amount
3. Verify deposit is saved and retrieved correctly

### User Testing:
1. View rental item - should show price and deposit
2. Add to cart - deposit should be included in total
3. Checkout - payment should be price + deposit
4. Return item - deposit should be refunded (if no damage)

### Edge Cases:
1. Item with 0 deposit
2. Item with deposit > price
3. Partial damage - partial refund
4. Multiple sizes with different deposits
5. Bulk rental with multiple items

## Implementation Priority

1. **High Priority:**
   - User display of deposit amount
   - Payment calculation including deposit
   - Deposit refund on return

2. **Medium Priority:**
   - Deposit analytics
   - Damage-based refund calculation
   - React Native implementation

3. **Low Priority:**
   - Advanced reporting
   - Deposit forecasting
   - Historical analysis

## Notes

- All deposit amounts are in PHP (₱)
- Deposits are stored as DECIMAL(10,2) for precision
- Refunds should be processed within 24 hours of return
- Damage assessment should be done before refund processing
- All deposit transactions should be logged for audit trail
