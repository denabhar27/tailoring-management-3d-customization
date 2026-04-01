# Rental Deposit System - Verification & Testing Guide

## Phase 1 Implementation Verification ✅

### Database Changes
- [x] Migration file created: `backend/migrations/add_rental_deposits.sql`
- [x] Migration runner created: `backend/migrations/runDepositMigration.js`
- [x] Server integration added to `backend/server.js`
- [x] Columns added to `rental_inventory` table:
  - [x] `deposit` (DECIMAL 10,2)
  - [x] `front_image` (VARCHAR 500)
  - [x] `back_image` (VARCHAR 500)
  - [x] `side_image` (VARCHAR 500)
  - [x] `damaged_by` (VARCHAR 255)
- [x] Columns added to `order_items` table:
  - [x] `rental_deposit` (DECIMAL 10,2)
  - [x] `deposit_refunded` (DECIMAL 10,2)
  - [x] `deposit_refund_date` (DATETIME)

### Backend Updates
- [x] `RentalInventoryModel.js` - create() method updated
- [x] `RentalInventoryModel.js` - update() method updated
- [x] `RentalController.js` - createRental() updated
- [x] `RentalController.js` - updateRental() updated

### Frontend Admin Updates
- [x] `PostRent.jsx` - createDefaultSizeEntry() updated
- [x] `PostRent.jsx` - parseSizeEntriesFromPayload() updated
- [x] `PostRent.jsx` - Deposit input field added to form
- [x] `PostRent.jsx` - Form validation includes deposit

### API Integration
- [x] `RentalApi.js` - No changes needed (already handles all form data)

## Testing Procedures

### 1. Database Migration Test

**Steps:**
1. Start the backend server
2. Check console for migration messages
3. Verify no errors in console output

**Expected Output:**
```
[SERVER] ✅ Rental deposit system migration completed
```

**Verification Query:**
```sql
-- Check if columns exist
DESCRIBE rental_inventory;
-- Should show: deposit, front_image, back_image, side_image, damaged_by

DESCRIBE order_items;
-- Should show: rental_deposit, deposit_refunded, deposit_refund_date
```

### 2. Admin Form Test

**Steps:**
1. Navigate to Admin > Post Rental Items
2. Click "Add Post +"
3. Fill in item details
4. Scroll to "Sizes & Measurements" section
5. Verify deposit field appears next to price field

**Expected Behavior:**
- Deposit field is visible and editable
- Deposit field accepts decimal numbers
- Deposit field has placeholder "0.00"
- Deposit field has min="0" and step="0.01"

**Test Data:**
- Item Name: "Test Suit"
- Category: "Suit"
- Size: Small
- Quantity: 5
- Price: 500.00
- **Deposit: 1000.00** ← New field

### 3. Create Rental Item Test

**Steps:**
1. Fill in all required fields including deposit
2. Click "Post Item"
3. Wait for success message
4. Check database

**Expected Result:**
```sql
SELECT item_id, item_name, price, deposit FROM rental_inventory 
WHERE item_name = 'Test Suit';

-- Should return:
-- item_id: 1
-- item_name: Test Suit
-- price: 500.00
-- deposit: 1000.00
```

### 4. Edit Rental Item Test

**Steps:**
1. Click "Edit" on an existing rental item
2. Verify deposit field is populated with existing value
3. Change deposit amount
4. Click "Update Item"
5. Verify changes in database

**Expected Result:**
- Deposit value is retrieved correctly
- Deposit value can be modified
- Changes are saved to database

### 5. Multiple Sizes with Different Deposits Test

**Steps:**
1. Create rental item with multiple sizes
2. Set different prices and deposits for each size:
   - Small: Price 500, Deposit 1000
   - Medium: Price 600, Deposit 1200
   - Large: Price 700, Deposit 1400
3. Save item
4. Edit item and verify all deposits are saved

**Expected Result:**
- Each size entry maintains its own deposit value
- All deposits are saved and retrieved correctly

### 6. Size Entry Parsing Test

**Steps:**
1. Create item with sizes and deposits
2. Edit the item
3. Verify form loads with all size entries and deposits

**Expected Result:**
- All size entries load correctly
- All deposit values are populated
- Form is ready for editing

## Data Validation Tests

### Test 1: Deposit Field Validation
```javascript
// Test: Deposit accepts positive numbers
Input: 1000.50
Expected: ✓ Accepted

// Test: Deposit accepts zero
Input: 0
Expected: ✓ Accepted

// Test: Deposit rejects negative numbers
Input: -100
Expected: ✓ Rejected (min="0")

// Test: Deposit accepts decimals
Input: 1000.99
Expected: ✓ Accepted
```

### Test 2: Form Submission Validation
```javascript
// Test: Submit with all fields including deposit
Expected: ✓ Success

// Test: Submit with deposit = 0
Expected: ✓ Success (optional field)

// Test: Submit with missing price
Expected: ✗ Error (required field)

// Test: Submit with missing deposit
Expected: ✓ Success (defaults to 0)
```

## Database Integrity Tests

### Test 1: Backward Compatibility
```sql
-- Existing items without deposit should work
SELECT * FROM rental_inventory WHERE deposit IS NULL;
-- Should return items with NULL or 0 deposit

-- Existing orders should work
SELECT * FROM order_items WHERE rental_deposit IS NULL;
-- Should return items with NULL or 0 rental_deposit
```

### Test 2: Data Type Verification
```sql
-- Verify column types
SHOW COLUMNS FROM rental_inventory WHERE Field = 'deposit';
-- Type: decimal(10,2)

SHOW COLUMNS FROM order_items WHERE Field = 'rental_deposit';
-- Type: decimal(10,2)
```

### Test 3: Index Performance
```sql
-- Verify indexes exist
SHOW INDEXES FROM order_items WHERE Column_name IN ('rental_deposit', 'deposit_refund_date');
-- Should show idx_rental_deposit and idx_deposit_refund_date
```

## API Response Tests

### Test 1: Create Rental Response
```bash
curl -X POST http://localhost:5000/api/rentals \
  -H "Content-Type: application/json" \
  -d '{
    "item_name": "Test Suit",
    "price": 500,
    "deposit": 1000,
    "total_available": 5,
    "size": "{\"size_entries\": [{\"sizeKey\": \"small\", \"quantity\": 5, \"price\": 500, \"deposit\": 1000}]}"
  }'
```

**Expected Response:**
```json
{
  "message": "Rental item created successfully",
  "item_id": 1,
  "item_name": "Test Suit",
  "price": 500,
  "deposit": 1000,
  "total_available": 5
}
```

### Test 2: Get Rental Response
```bash
curl http://localhost:5000/api/rentals/1
```

**Expected Response:**
```json
{
  "message": "Rental item retrieved successfully",
  "item": {
    "item_id": 1,
    "item_name": "Test Suit",
    "price": 500,
    "deposit": 1000,
    "size": "{\"size_entries\": [{...}]}"
  }
}
```

## Migration Safety Tests

### Test 1: Idempotent Migration
**Steps:**
1. Run migration (first time)
2. Check for success message
3. Restart server
4. Run migration again (second time)
5. Check for success message (should skip existing columns)

**Expected Result:**
- First run: Creates columns
- Second run: Skips with "column already exists" message
- No errors on either run

### Test 2: Existing Data Preservation
**Steps:**
1. Create rental item before migration
2. Run migration
3. Query the item

**Expected Result:**
- Item data is preserved
- New columns are added with default values
- No data loss

## Performance Tests

### Test 1: Query Performance
```sql
-- Test deposit query performance
EXPLAIN SELECT * FROM rental_inventory WHERE deposit > 0;
-- Should use index efficiently

EXPLAIN SELECT * FROM order_items WHERE rental_deposit > 0;
-- Should use index efficiently
```

### Test 2: Large Dataset Test
```sql
-- Insert 1000 test items
INSERT INTO rental_inventory (item_name, price, deposit, total_available)
SELECT CONCAT('Item_', @row:=@row+1), 500, 1000, 5
FROM (SELECT @row:=0) t
LIMIT 1000;

-- Query performance should remain acceptable
SELECT COUNT(*) FROM rental_inventory WHERE deposit > 0;
```

## Rollback Procedure (If Needed)

If issues occur, rollback with:
```sql
-- Remove deposit columns
ALTER TABLE rental_inventory DROP COLUMN deposit;
ALTER TABLE rental_inventory DROP COLUMN front_image;
ALTER TABLE rental_inventory DROP COLUMN back_image;
ALTER TABLE rental_inventory DROP COLUMN side_image;
ALTER TABLE rental_inventory DROP COLUMN damaged_by;

ALTER TABLE order_items DROP COLUMN rental_deposit;
ALTER TABLE order_items DROP COLUMN deposit_refunded;
ALTER TABLE order_items DROP COLUMN deposit_refund_date;

-- Drop indexes
DROP INDEX idx_rental_deposit ON order_items;
DROP INDEX idx_deposit_refund_date ON order_items;
```

## Sign-Off Checklist

### Phase 1 Complete ✅
- [x] Database migration created and tested
- [x] Backend models updated
- [x] Backend controllers updated
- [x] Admin form updated with deposit field
- [x] API integration verified
- [x] Migration runs automatically on server startup
- [x] No breaking changes to existing functionality
- [x] Backward compatibility maintained
- [x] Documentation created

### Ready for Phase 2
- [ ] User-facing rental display components
- [ ] Cart and payment integration
- [ ] Deposit refund logic
- [ ] Order tracking updates
- [ ] React Native implementation

## Known Limitations & Future Enhancements

### Current Limitations:
1. Deposit display not yet implemented in user interface
2. Payment calculation doesn't include deposit yet
3. Deposit refund logic not yet implemented
4. No damage assessment integration yet
5. React Native components not yet updated

### Future Enhancements:
1. Automatic deposit refund processing
2. Damage-based refund calculation
3. Deposit analytics dashboard
4. Automated refund notifications
5. Partial refund support
6. Deposit payment plans
7. Deposit insurance options

## Support & Troubleshooting

### Issue: Migration doesn't run
**Solution:**
1. Check server logs for errors
2. Verify database connection
3. Check file permissions on migration files
4. Manually run migration SQL

### Issue: Deposit field not showing in form
**Solution:**
1. Clear browser cache
2. Restart development server
3. Check browser console for errors
4. Verify PostRent.jsx changes were saved

### Issue: Deposit not saving to database
**Solution:**
1. Check network tab in browser dev tools
2. Verify API response
3. Check backend logs
4. Verify database columns exist

## Contact & Questions

For issues or questions about the rental deposit system implementation:
1. Check the documentation files
2. Review code comments
3. Check database schema
4. Review API responses
5. Check browser/server console logs

## Version History

- **v1.0** (Current) - Initial deposit system implementation
  - Database schema updates
  - Admin form updates
  - Backend integration
  - Automatic migration

- **v1.1** (Planned) - User-facing features
  - Deposit display
  - Payment integration
  - Refund processing

- **v2.0** (Planned) - Advanced features
  - Analytics dashboard
  - Automated refunds
  - Damage assessment
