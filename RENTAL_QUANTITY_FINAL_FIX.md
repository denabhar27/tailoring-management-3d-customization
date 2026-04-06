# Rental Quantity Fix - FINAL COMPLETE SOLUTION

## Problem Description

### Issue 1: Overbooking
Users could select rental items that were already reserved by other users in their carts or pending orders.

### Issue 2: Items Disappearing
Items disappeared from the home page even when some quantities were still available.

### Issue 3: Incorrect Quantity Display (MAIN ISSUE)
**Example:**
- Database: Small (S) = 2 quantity
- Customer 1 orders Small (S) x1 (status: PENDING)
- Customer 2 opens the item modal
- **WRONG:** Shows Small (S) with max quantity = 2
- **CORRECT:** Should show Small (S) with max quantity = 1

The system was fetching real-time availability but NOT using it to limit the quantity selector.

## Complete Solution

### Backend Changes

#### 1. Global Availability Check
**File:** `backend/controller/RentalController.js`

Added `getAvailableQuantity` endpoint:
```javascript
// Checks ALL users' carts (no user_id filter)
const cartSql = `
  SELECT specific_data 
  FROM cart 
  WHERE service_type = 'rental' 
    AND status = 'active'
`;

// Checks ALL users' orders (no user_id filter)
const orderSql = `
  SELECT oi.specific_data
  FROM order_items oi
  WHERE oi.service_type = 'rental'
    AND oi.approval_status IN ('pending', 'ready_to_pickup', 'picked_up', 'rented')
`;

// Calculate available = total - reserved
availableQuantities[sizeKey] = Math.max(0, totalQty - reserved);
```

**Key Point:** Includes `'pending'` status, so pending orders reduce availability immediately!

#### 2. Remove Database Filters
**File:** `backend/model/RentalInventoryModel.js`

Removed `AND total_available > 0` from all queries:
- `getAvailableItems`
- `getAvailableItemsCount`
- `searchItems`
- `getSearchCount`
- `getByCategoryPaginated`
- `getCategoryCount`
- `getFeaturedItems`
- `getSimilarItems`

**Why:** Items should always show in listings. Real-time availability is checked when users open the modal.

### Frontend Changes

#### 1. API Integration
**File:** `tailoring-management-user/src/api/RentalApi.js`

Added:
```javascript
export async function getAvailableQuantity(item_id) {
  const response = await axios.get(`${BASE_URL}/rentals/${item_id}/available-quantity`, {
    headers: getAuthHeaders()
  });
  return response.data;
}
```

#### 2. Real-Time Availability in Modal
**File:** `tailoring-management-user/src/user/components/RentalClothes.jsx`

**Changes:**
1. Added state: `realTimeAvailability`
2. Fetch availability when opening modal:
```javascript
const openModal = async (item) => {
  // ... existing code ...
  
  // Fetch real-time availability
  const availabilityData = await getAvailableQuantity(item.id || item.item_id);
  if (availabilityData && availabilityData.available_quantities) {
    setRealTimeAvailability(availabilityData.available_quantities);
  }
};
```

3. Use real-time availability as max quantity:
```javascript
const realTimeQty = realTimeAvailability[sizeKey];
const maxQty = realTimeQty !== undefined 
  ? realTimeQty  // Use real-time availability
  : opt.quantity; // Fallback to database
```

4. Reset selection if exceeds availability:
```javascript
if (realTimeQty !== undefined && currentQty > realTimeQty) {
  setSizeSelections(prev => ({ ...prev, [sizeKey]: realTimeQty }));
}
```

5. Show availability indicator:
```javascript
{realTimeQty !== undefined && (
  <span style={{ fontSize: '12px', color: realTimeQty === 0 ? '#d32f2f' : '#666' }}>
    {realTimeQty === 0 ? 'Out of stock' : `${realTimeQty} available`}
  </span>
)}
```

#### 3. Bundle Modal Updates
Same changes applied to bundle modal for multi-item selection.

## How It Works Now - Complete Flow

### Scenario: 2 Small (S) suits in database

**Step 1: Customer 1 Orders**
- Customer 1 adds Small (S) x1 to cart
- Customer 1 submits order → Status: PENDING
- Database: Small (S) = 2 (unchanged)
- Reserved: Small (S) = 1 (in pending order)
- Available: Small (S) = 1 (2 - 1)

**Step 2: Customer 2 Views Item**
- Item shows in home page ✓
- Customer 2 clicks "View"
- Modal opens
- Frontend calls: `GET /rentals/{item_id}/available-quantity`
- Backend checks:
  - Carts (all users): 0
  - Orders (all users, pending/ready/picked_up/rented): 1
  - Reserved: 1
  - Available: 2 - 1 = 1
- Frontend receives: `{ small: 1 }`
- Modal shows:
  ```
  Small (S)
  ₱ 100.00 / 3 days
  Deposit: ₱ 10.00
  − 0 +    1 available  ← Shows real-time availability
  ```
- Max quantity = 1 (not 2!) ✓
- + button disabled when quantity reaches 1 ✓

**Step 3: Customer 2 Orders**
- Customer 2 adds Small (S) x1 to cart
- Customer 2 submits order → Status: PENDING
- Reserved: Small (S) = 2 (both pending orders)
- Available: Small (S) = 0 (2 - 2)

**Step 4: Customer 3 Views Item**
- Item shows in home page ✓
- Customer 3 clicks "View"
- Frontend calls: `GET /rentals/{item_id}/available-quantity`
- Backend returns: `{ small: 0 }`
- Modal shows:
  ```
  Small (S)
  ₱ 100.00 / 3 days
  Deposit: ₱ 10.00
  − 0 +    Out of stock  ← Shows out of stock
  ```
- + button disabled ✓
- Cannot add to cart ✓

## Visual Indicators

### When Available
```
Small (S)
₱ 100.00 / 3 days
Deposit: ₱ 10.00
− 1 +    1 available
```

### When Out of Stock
```
Small (S)
₱ 100.00 / 3 days
Deposit: ₱ 10.00
− 0 +    Out of stock
```

## Testing Checklist

### Test 1: Pending Order Reduces Availability ✓
- [x] Database: Small = 2
- [x] Customer 1 orders Small x1 (PENDING)
- [x] Customer 2 opens modal
- [x] Sees max quantity = 1 (not 2) ✓
- [x] Sees "1 available" indicator ✓

### Test 2: Multiple Pending Orders ✓
- [x] Customer 1 orders Small x1 (PENDING)
- [x] Customer 2 orders Small x1 (PENDING)
- [x] Customer 3 opens modal
- [x] Sees max quantity = 0 ✓
- [x] Sees "Out of stock" indicator ✓
- [x] + button is disabled ✓

### Test 3: Item Visibility ✓
- [x] Item with pending orders STILL shows in home page ✓
- [x] Item with all quantities reserved STILL shows in home page ✓
- [x] Real-time check happens only when modal opens ✓

### Test 4: Cart + Pending Orders ✓
- [x] Customer 1 adds Small x1 to cart (not submitted)
- [x] Customer 2 submits order Small x1 (PENDING)
- [x] Customer 3 opens modal
- [x] Sees max quantity = 0 (both cart and order counted) ✓

## Files Modified

### Backend (3 files)
1. `backend/controller/RentalController.js` - Added `getAvailableQuantity` endpoint
2. `backend/routes/RentalRoutes.js` - Added route
3. `backend/model/RentalInventoryModel.js` - Removed database filters

### Frontend (2 files)
1. `tailoring-management-user/src/api/RentalApi.js` - Added API function
2. `tailoring-management-user/src/user/components/RentalClothes.jsx` - Integrated real-time checks

## Key Features

✅ **Pending Orders Count** - Pending status immediately reduces availability
✅ **Global Check** - Checks ALL users, not just current user
✅ **Visual Feedback** - Shows "X available" or "Out of stock"
✅ **Disabled Controls** - + button disabled when max reached
✅ **Auto-Reset** - If selection exceeds availability, automatically resets
✅ **Items Always Visible** - Never disappear from home page
✅ **Real-Time Accuracy** - Fetches on modal open

## Important Notes

- ✅ Pending orders reduce availability IMMEDIATELY
- ✅ Items always show in listings (better UX)
- ✅ Real-time check happens when modal opens
- ✅ Visual indicators show exact availability
- ✅ Prevents overbooking across all users
- ✅ Works for both single items and bundles
