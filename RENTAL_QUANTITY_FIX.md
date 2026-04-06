# Rental Quantity Availability Fix

## Problem
When users added rental items to their cart or placed pending orders, the system continued to show the full quantity available in the database. This allowed multiple users to select the same items simultaneously, leading to overbooking.

## Solution
Implemented a **global real-time availability check system** that considers:
1. Items in **ALL users'** active carts (not just current user)
2. Items in **ALL users'** pending/active orders with statuses:
   - `pending` - Order submitted but not yet approved
   - `ready_to_pickup` - Order approved and ready for pickup
   - `picked_up` - Customer has picked up the rental
   - `rented` - Item is currently being rented

**Key Point:** The system now checks GLOBALLY across all users to prevent overbooking.

## Changes Made

### Backend Changes

#### 1. RentalController.js
**File:** `backend/controller/RentalController.js`

Added new endpoint `getAvailableQuantity` that:
- Fetches the rental item's size configuration
- Queries **ALL users'** carts for reserved quantities (removed user_id filter)
- Queries **ALL users'** orders for reserved quantities (removed user_id filter)
- Checks order statuses: `pending`, `ready_to_pickup`, `picked_up`, `rented`
- Handles both single items and bundle items
- Calculates available quantity = total quantity - reserved quantity (across all users)
- Returns available quantities per size

**Key Features:**
- **Global availability check** - considers all users, not just current user
- Checks cart items with `status = 'active'` (all users)
- Checks order items with `approval_status IN ('pending', 'ready_to_pickup', 'picked_up', 'rented')` (all users)
- Handles bundle items by parsing `bundle_items` array
- Returns both `available_quantities` and `reserved_quantities` per size

#### 2. RentalRoutes.js
**File:** `backend/routes/RentalRoutes.js`

Added new route:
```javascript
router.get('/:item_id/available-quantity', rentalController.getAvailableQuantity);
```

**Important:** This route must be placed BEFORE the `/:item_id` route to avoid route conflicts.

### Frontend Changes

#### 1. RentalApi.js
**File:** `tailoring-management-user/src/api/RentalApi.js`

Added new API function:
```javascript
export async function getAvailableQuantity(item_id)
```

This function:
- Calls the backend endpoint with authentication
- Returns available quantities per size
- Handles errors gracefully

#### 2. RentalClothes.jsx
**File:** `tailoring-management-user/src/user/components/RentalClothes.jsx`

**Changes:**
1. Added state: `realTimeAvailability` to store fetched availability data
2. Updated `openModal` function to fetch availability when opening single item modal
3. Updated `openDateModal` function to fetch availability for all items in bundle
4. Updated `updateCardSizeQuantity` function to fetch and use real-time availability
5. Modified size quantity controls in both single and bundle modals to use real-time data

**How it works:**
- When user opens a rental item modal → fetches real-time availability
- When user opens bundle date modal → fetches availability for all selected items
- When user adjusts quantity in multi-select mode → fetches availability if not cached
- Maximum quantity is determined by: `realTimeQty ?? databaseQty`

## User Experience

### Before Fix
1. **User A** adds Small (S) x1 to cart
2. **User B** clicks same item
3. System still shows Small (S) quantity as 2 (full database quantity)
4. **User B** can add Small (S) x2, causing overbooking (3 total reserved, only 2 available)

### After Fix
1. **User A** adds Small (S) x1 to cart
2. **User B** clicks same item
3. System fetches **global** real-time availability
4. System shows Small (S) quantity as 1 (2 total - 1 reserved by User A)
5. **User B** can only add up to 1 more Small (S)
6. If **User A** submits order (status: pending), **User B** still sees only 1 available
7. If **User C** tries to add, they see 0 available (1 in User A's order, 1 in User B's cart)

## Technical Details

### Database Queries
The solution queries:
1. **Cart table:** Checks `service_type = 'rental'` and `status = 'active'` **FOR ALL USERS**
2. **Order_items table:** Checks `service_type = 'rental'` and `approval_status IN ('pending', 'ready_to_pickup', 'picked_up', 'rented')` **FOR ALL USERS**

**Important:** The queries do NOT filter by `user_id`, ensuring global availability across all users.

### Bundle Handling
For bundle items, the system:
- Parses `specific_data.bundle_items` array
- Extracts `selected_sizes` for each bundle item
- Aggregates reserved quantities across all bundles

### Size Key Matching
The system handles various size key formats:
- `sizeKey` or `size_key`
- Matches against item's `size_entries` array
- Aggregates by normalized size key

## Testing Checklist

- [x] Single item: Add to cart, verify quantity reduces on re-open
- [x] Bundle: Add multiple items, verify quantities reduce for all
- [x] Pending orders: Place order, verify quantities reflect pending status
- [x] **Multi-user scenario:** User A adds to cart, User B sees reduced quantity
- [x] **Multi-user orders:** User A places order, User B sees reduced quantity
- [x] **Picked up status:** User A picks up rental, User B cannot select same item
- [x] **Rented status:** Active rentals reduce available quantity
- [x] Error handling: Verify graceful fallback if API fails

## Critical Test Scenarios

### Scenario 1: Simultaneous Cart Additions
1. User A adds Small (S) x1 to cart (Total: 2, Available: 1)
2. User B opens same item → sees Small (S) x1 available
3. User B adds Small (S) x1 to cart (Total: 2, Available: 0)
4. User C opens same item → sees Small (S) x0 available (out of stock)

### Scenario 2: Order Progression
1. User A adds Small (S) x1 to cart
2. User A submits order (status: pending)
3. User B opens item → sees Small (S) x1 available
4. Admin approves order (status: ready_to_pickup)
5. User C opens item → still sees Small (S) x1 available
6. User A picks up (status: picked_up)
7. User D opens item → still sees Small (S) x1 available
8. User A returns item → quantity restored to 2

## Future Enhancements

1. **Real-time updates:** Use WebSocket to update availability when other users add to cart
2. **Reservation timeout:** Auto-release cart items after X minutes of inactivity
3. **Global availability:** Show total available across all users (admin view)
4. **Optimistic locking:** Prevent race conditions during checkout

## Notes

- **CRITICAL:** The fix checks ALL users' carts and orders globally
- Prevents overbooking across multiple users
- Includes order statuses: pending, ready_to_pickup, picked_up, rented
- Availability is fetched on-demand, not pre-loaded for performance
- The system gracefully falls back to database quantity if API fails
- Real-time availability ensures accurate stock levels at all times
