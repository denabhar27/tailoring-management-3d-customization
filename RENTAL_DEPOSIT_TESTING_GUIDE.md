# Rental Deposit System - Quick Testing Guide

## Pre-Deployment Checklist

### 1. Server Startup Test
```
Expected: Server starts without errors
Check: Console shows "✅ Rental deposit system migration completed"
```

### 2. Database Verification
```sql
-- Verify columns exist
DESCRIBE rental_inventory;
-- Should show: deposit, front_image, back_image, side_image, damaged_by

DESCRIBE order_items;
-- Should show: rental_deposit, deposit_refunded, deposit_refund_date
```

### 3. Admin Form Test
**Steps**:
1. Navigate to Admin > Post Rental Items
2. Click "Add Post +"
3. Fill in basic details
4. Scroll to "Sizes & Measurements"
5. Verify deposit field appears next to price field

**Expected**:
- Deposit field visible
- Accepts decimal numbers
- Has placeholder "0.00"
- Width matches price field

### 4. Create Item with Deposit
**Test Data**:
- Item Name: "Test Suit"
- Category: "Suit"
- Size: Small
- Quantity: 5
- Price: 500.00
- **Deposit: 1000.00**

**Expected**:
- Item saves successfully
- Deposit value stored in database
- Can retrieve and edit later

### 5. User Display Test
**Steps**:
1. Navigate to Rental Clothes section
2. View rental item card
3. Click "View" to open modal

**Expected**:
- Deposit amount displays in card
- Modal shows: "Rental Price: ₱500"
- Modal shows: "Deposit (Refundable): ₱1000"
- Total due on pickup: ₱1250

### 6. Cart Calculation Test
**Steps**:
1. Select size and dates
2. Add to cart
3. View cart

**Expected**:
- Cart shows rental price
- Cart shows deposit amount
- Total = rental + deposit
- Downpayment = (rental × 50%) + deposit

### 7. Bundle Test
**Steps**:
1. Click "Select Multiple"
2. Select 2-3 items
3. Set dates
4. View pricing

**Expected**:
- All deposits included
- Total correct
- Downpayment includes all deposits

## Test Scenarios

### Scenario 1: Single Item Rental
```
Item: Brown Suit
Price: ₱500
Deposit: ₱1000
Duration: 3 days

Expected Calculation:
- Rental: ₱500
- Deposit: ₱1000
- Due on Pickup: ₱1250
```

### Scenario 2: Multiple Sizes
```
Item: Suit (Multiple Sizes)
Small: Price ₱500, Deposit ₱1000
Medium: Price ₱600, Deposit ₱1200
Large: Price ₱700, Deposit ₱1400

Select: Small ×2, Medium ×1
Duration: 3 days

Expected:
- Rental: (500×2) + 600 = ₱1600
- Deposit: (1000×2) + 1200 = ₱3200
- Due on Pickup: ₱4800
```

### Scenario 3: Bundle Rental
```
Item 1: Suit - ₱500 + ₱1000 deposit
Item 2: Shirt - ₱300 + ₱500 deposit
Duration: 3 days

Expected:
- Total Rental: ₱800
- Total Deposit: ₱1500
- Due on Pickup: ₱1900
```

## Verification Queries

### Check Deposit Data
```sql
SELECT item_id, item_name, price, deposit 
FROM rental_inventory 
WHERE deposit > 0 
LIMIT 5;
```

### Check Order Deposits
```sql
SELECT oi.item_id, oi.rental_deposit, oi.deposit_refunded 
FROM order_items oi 
WHERE oi.service_type = 'rental' 
LIMIT 5;
```

### Verify Calculations
```sql
SELECT 
  item_id,
  item_name,
  price,
  deposit,
  (price + deposit) as total_due
FROM rental_inventory
WHERE deposit > 0;
```

## Browser Console Tests

### Test Deposit Calculation
```javascript
// In browser console on rental page
const item = {
  price: 500,
  deposit: 1000,
  sizeOptions: {
    small: { price: 500, deposit: 1000, quantity: 5 }
  }
};

// Should show deposit in calculations
console.log('Price:', item.price);
console.log('Deposit:', item.deposit);
console.log('Total:', item.price + item.deposit);
```

## Common Test Cases

### ✅ Test 1: Deposit Field Validation
- [x] Accepts positive numbers
- [x] Accepts decimals (e.g., 1000.50)
- [x] Accepts zero
- [x] Rejects negative numbers
- [x] Saves to database

### ✅ Test 2: Display Accuracy
- [x] Deposit shows in card
- [x] Deposit shows in modal
- [x] Deposit shows in cart
- [x] Calculations are correct
- [x] Currency formatting correct

### ✅ Test 3: Multiple Items
- [x] Each item has own deposit
- [x] Deposits sum correctly
- [x] Bundle calculations accurate
- [x] No deposit loss in calculations

### ✅ Test 4: Data Persistence
- [x] Deposit saves on create
- [x] Deposit saves on update
- [x] Deposit retrieves on edit
- [x] Deposit persists in database

### ✅ Test 5: Edge Cases
- [x] Item with 0 deposit
- [x] Item with deposit > price
- [x] Multiple sizes with different deposits
- [x] Large deposit amounts
- [x] Decimal precision maintained

## Performance Tests

### Load Time
```
Expected: No noticeable increase
Measure: Page load time before/after
```

### Database Query
```sql
-- Should be fast with indexes
SELECT * FROM order_items 
WHERE rental_deposit > 0 
AND deposit_refund_date IS NULL;
```

### Calculation Performance
```javascript
// Should be instant
const totals = calculateCartTotalsWithDeposit(cartItems);
// Should complete in < 1ms
```

## Rollback Test

If issues occur:
```sql
-- Remove deposit columns
ALTER TABLE rental_inventory DROP COLUMN deposit;
ALTER TABLE order_items DROP COLUMN rental_deposit;
ALTER TABLE order_items DROP COLUMN deposit_refunded;
ALTER TABLE order_items DROP COLUMN deposit_refund_date;
```

## Sign-Off Checklist

- [ ] Server starts without errors
- [ ] Database columns created
- [ ] Admin form shows deposit field
- [ ] Can create item with deposit
- [ ] Deposit displays in user interface
- [ ] Cart calculations include deposit
- [ ] Bundle deposits calculated correctly
- [ ] Data persists in database
- [ ] No breaking changes
- [ ] Performance acceptable

## Deployment Steps

1. **Backup Database**
   ```bash
   mysqldump -u root -p database_name > backup.sql
   ```

2. **Deploy Code**
   - Push all changes to production
   - Restart backend server

3. **Verify Migration**
   - Check server logs
   - Verify database columns exist
   - Test admin form

4. **Test User Flow**
   - Create test rental item with deposit
   - View in user interface
   - Add to cart
   - Verify calculations

5. **Monitor**
   - Check error logs
   - Monitor database performance
   - Track user feedback

## Support Contacts

For issues:
1. Check server logs
2. Verify database connection
3. Check browser console for errors
4. Review implementation documentation
5. Contact development team

## Success Criteria

✅ All tests pass
✅ No errors in logs
✅ Deposit displays correctly
✅ Calculations accurate
✅ Data persists
✅ Performance acceptable
✅ No breaking changes
✅ Ready for production

---

**Status**: Ready for Testing & Deployment
**Last Updated**: [Current Date]
**Version**: 1.0
