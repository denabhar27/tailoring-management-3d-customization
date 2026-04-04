# Action Log "Changed by" Field Fix

## Issue
When a clerk changed the status of a customization order (e.g., from pending to accepted), the action log in the dashboard showed "Changed by: admin" instead of "Changed by: clerk".

## Root Cause
The `action_by` field in the ActionLog.create() calls was hardcoded to 'admin' in several controllers, regardless of whether the user making the change was an admin or a clerk.

## Files Modified

### 1. CustomizationController.js
**Location:** `c:\Users\den-a\SE\backend\controller\CustomizationController.js`

**Changes:**
- Line ~213: Changed `action_by: 'admin'` to `action_by: req.user?.role || 'admin'`
- Line ~413: Changed `action_by: 'admin'` to `action_by: req.user?.role || 'admin'`
- Updated notes message to reflect the actual role

**Before:**
```javascript
ActionLog.create({
  order_item_id: itemId,
  user_id: adminUserId,
  action_type: 'status_update',
  action_by: 'admin',  // ❌ Hardcoded
  previous_status: previousStatus,
  new_status: newStatus,
  ...
```

**After:**
```javascript
ActionLog.create({
  order_item_id: itemId,
  user_id: adminUserId,
  action_type: 'status_update',
  action_by: req.user?.role || 'admin',  // ✅ Uses actual role
  previous_status: previousStatus,
  new_status: newStatus,
  ...
```

### 2. CustomerController.js
**Location:** `c:\Users\den-a\SE\backend\controller\CustomerController.js`

**Changes:**
- Line ~268: Changed `action_by: 'admin'` to `action_by: req.user?.role || 'admin'`

**Before:**
```javascript
ActionLog.create({
  order_item_id: itemId || null,
  user_id: adminId,
  action_type: 'add_measurements',
  action_by: 'admin',  // ❌ Hardcoded
  ...
```

**After:**
```javascript
ActionLog.create({
  order_item_id: itemId || null,
  user_id: adminId,
  action_type: 'add_measurements',
  action_by: req.user?.role || 'admin',  // ✅ Uses actual role
  ...
```

### 3. TransactionLogController.js
**Location:** `c:\Users\den-a\SE\backend\controller\TransactionLogController.js`

**Changes:**
- Line ~313: Changed `action_by: req.user.role === 'admin' ? 'admin' : 'user'` to properly handle clerk role

**Before:**
```javascript
ActionLog.create({
  order_item_id: orderItemId,
  user_id: item.user_id,
  action_type: 'payment',
  action_by: req.user.role === 'admin' ? 'admin' : 'user',  // ❌ Clerk shows as 'user'
  ...
```

**After:**
```javascript
ActionLog.create({
  order_item_id: orderItemId,
  user_id: item.user_id,
  action_type: 'payment',
  action_by: req.user.role === 'admin' ? 'admin' : req.user.role === 'clerk' ? 'clerk' : 'user',  // ✅ Properly handles clerk
  ...
```

## How It Works

1. **Authentication Middleware** (`AuthToken.js`):
   - When a user logs in, their JWT token contains their role ('admin', 'clerk', or 'user')
   - The `verifyToken` middleware decodes this and sets `req.user.role`

2. **Action Logging**:
   - When creating action logs, the code now uses `req.user?.role` to get the actual role
   - Falls back to 'admin' if role is not available (for backward compatibility)

3. **Frontend Display** (`AdminPage.jsx`):
   - The frontend already correctly displays the `actionBy` field
   - No frontend changes were needed

## Testing

To verify the fix:

1. Log in as a clerk
2. Change the status of a customization order (e.g., accept a pending order)
3. Check the dashboard action log
4. The "Changed by:" field should now show "clerk" instead of "admin"

## Impact

- ✅ Clerk actions are now properly attributed to clerks
- ✅ Admin actions continue to be attributed to admins
- ✅ Backward compatible (falls back to 'admin' if role is undefined)
- ✅ No database migration needed
- ✅ No frontend changes needed

## Related Files (No Changes Needed)

- `OrderController.js` - Already handles clerk role correctly
- `AdminDashboardController.js` - Correctly passes through action_by field
- `AdminPage.jsx` - Correctly displays actionBy field
- `ActionLogModel.js` - No changes needed
