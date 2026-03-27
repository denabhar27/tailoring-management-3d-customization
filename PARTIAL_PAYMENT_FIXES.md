# Partial Payment Status Fixes

## Issues Identified

1. **Reports (OrdersInventory) Page**: Partial payments were being grouped with "Down-payment" status, losing the distinction
2. **Billing Stats**: Didn't track partial payments separately from down payments
3. **Status Filter**: Missing "Partial Payment" option in the reports filter dropdown
4. **Status Badge Styling**: No visual styling for "Partial Payment" status

## Root Cause

In `BillingController.js`, the `getAllBillingRecords` method was mapping both `partial_payment` and `down-payment` database statuses to the same "Down-payment" display status:

```javascript
// OLD CODE (INCORRECT)
else if (dbPaymentStatus === 'down-payment' || dbPaymentStatus === 'downpayment' || 
         dbPaymentStatus === 'partial_payment' || dbPaymentStatus === 'partial') {
  paymentStatus = 'Down-payment';  // ❌ Both mapped to same status
}
```

## Fixes Applied

### 1. Backend - BillingController.js

**Fixed Payment Status Mapping** (getAllBillingRecords):
```javascript
// NEW CODE (CORRECT)
else if (dbPaymentStatus === 'partial_payment' || dbPaymentStatus === 'partial') {
  paymentStatus = 'Partial Payment';  // ✅ Separate status
} else if (dbPaymentStatus === 'down-payment' || dbPaymentStatus === 'downpayment') {
  paymentStatus = 'Down-payment';
} else if (amountPaid > 0 && remainingBalance > 0) {
  // Auto-detect based on amount paid
  const halfPrice = finalPrice * 0.5;
  if (amountPaid >= halfPrice) {
    paymentStatus = 'Partial Payment';  // ✅ >= 50% paid
  } else {
    paymentStatus = 'Down-payment';     // ✅ < 50% paid
  }
}
```

**Enhanced Billing Stats Query** (getBillingStats):
- Added separate counting for `partial_payment_count`
- Distinguished between down-payment (< 50% paid) and partial payment (>= 50% paid)
- Updated response to include both counts:

```javascript
stats: {
  total: parseInt(stats.total_records) || 0,
  paid: parseInt(stats.paid_count) || 0,
  downpayment: parseInt(stats.downpayment_count) || 0,
  partialPayment: parseInt(stats.partial_payment_count) || 0,  // ✅ NEW
  unpaid: parseInt(stats.unpaid_count) || 0,
  totalRevenue: parseFloat(stats.total_revenue) || 0,
  pendingRevenue: parseFloat(stats.pending_revenue) || 0
}
```

### 2. Frontend - OrdersInventory.jsx

**Added Partial Payment to Status Filter**:
```javascript
<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
  <option value="all">All Status</option>
  <option value="Completed">Completed</option>
  <option value="Paid">Paid</option>
  <option value="Fully Paid">Fully Paid</option>
  <option value="Partial Payment">Partial Payment</option>  // ✅ NEW
  <option value="Unpaid">Unpaid</option>
  <option value="Down-payment">Down-payment</option>
  <option value="Cancelled">Cancelled</option>
</select>
```

**Added Status Badge Styling**:
```javascript
const styles = {
  // ... other statuses
  'partial payment': { 
    backgroundColor: '#e1f5fe',  // Light blue
    color: '#0277bd'             // Dark blue
  },
  // ...
};
```

## Payment Status Definitions

| Status | Criteria | Display Color |
|--------|----------|---------------|
| **Unpaid** | No payment made | Red (#ffebee / #d32f2f) |
| **Down-payment** | < 50% of total paid | Orange (#fff8e1 / #f57c00) |
| **Partial Payment** | >= 50% but < 100% paid | Blue (#e1f5fe / #0277bd) |
| **Paid / Fully Paid** | 100% paid | Green (#e8f5e9 / #2e7d32) |

## Revenue Analytics

**Already Working Correctly** ✅

The analytics dashboard (`AnalyticsController.js`) was already including partial payments in revenue calculations:

```javascript
paymentCondition = `AND (
  oi.payment_status IN ('paid', 'fully_paid', 'down-payment', 'partial_payment', 'partial')
  OR COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(oi.pricing_factors, '$.amount_paid')) AS DECIMAL(10,2)), 0) > 0
)`;
```

This means:
- ✅ Partial payments ARE included in total revenue
- ✅ Partial payments ARE counted in service revenue distribution
- ✅ Partial payments ARE included in revenue trends

## Testing Checklist

- [x] Backend: Partial payment status correctly mapped
- [x] Backend: Billing stats include partial payment count
- [x] Frontend: Partial Payment option in filter dropdown
- [x] Frontend: Partial Payment badge styling applied
- [x] Reports: Partial payments show as separate status
- [x] Analytics: Partial payments included in revenue (already working)
- [x] Dashboard: Partial payments visible in transaction history (already working)

## Files Modified

### Backend
1. `backend/controller/BillingController.js`
   - Fixed `getAllBillingRecords` payment status mapping
   - Enhanced `getBillingStats` query to count partial payments separately
   - Updated stats response to include `partialPayment` count

### Frontend
1. `src/admin/OrdersInventory.jsx`
   - Added "Partial Payment" to status filter dropdown
   - Added styling for "Partial Payment" status badge

## Impact

### Before Fix
- Partial payments grouped with down-payments
- No way to filter partial payments separately
- Confusing for admins tracking payment progress
- Stats didn't distinguish between 10% paid and 90% paid

### After Fix
- ✅ Clear distinction between down-payment and partial payment
- ✅ Separate filter option for partial payments
- ✅ Visual distinction with blue badge color
- ✅ Better tracking of payment progress
- ✅ More accurate billing statistics

## Example Scenarios

### Scenario 1: Rental with 50% Paid
- Total Price: ₱1,000
- Amount Paid: ₱500
- **Status**: Partial Payment (blue badge)
- **Included in**: Total Revenue, Pending Revenue (₱500)

### Scenario 2: Rental with 30% Paid
- Total Price: ₱1,000
- Amount Paid: ₱300
- **Status**: Down-payment (orange badge)
- **Included in**: Total Revenue, Pending Revenue (₱700)

### Scenario 3: Rental with 100% Paid
- Total Price: ₱1,000
- Amount Paid: ₱1,000
- **Status**: Paid (green badge)
- **Included in**: Total Revenue only

## Conclusion

The partial payment status is now properly tracked and displayed throughout the system:
- ✅ Shows in Dashboard transaction history
- ✅ Shows in Reports (OrdersInventory) with correct status
- ✅ Included in Revenue Analytics
- ✅ Tracked separately in Billing Stats
- ✅ Filterable in Reports page
- ✅ Visually distinct with blue badge

All partial payments are correctly included in revenue calculations and are now properly distinguished from down-payments in the UI.
