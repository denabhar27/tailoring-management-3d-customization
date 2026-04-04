# Damage Compensation Dashboard Fix

## Issues Fixed

### 1. "Changed by" showing wrong user (e.g., "ned stark" instead of admin)
**Problem**: The dashboard was displaying `responsible_party` (the staff/admin who caused the damage) as the "Changed by" field instead of showing who actually reported/created the compensation record.

**Solution**: 
- Updated `AdminDashboardController.js` to use `incident.handled_by` (which comes from `reported_by_user_id`) instead of `incident.responsible_party` for the `action_by` field
- The `handled_by` field is populated from the JOIN with the `user` table on `reported_by_user_id`

### 2. Missing "Damaged by" information
**Problem**: The dashboard didn't show who was responsible for causing the damage (the staff/admin input from "Responsible staff/admin" field).

**Solution**:
- Added "Damaged by: {responsible_party}" line in the compensation activity notes
- Changed "Handled by" to "Reported from {service} management" to clarify this is where the report came from
- The `responsible_party` field now properly shows who caused the damage in the notes

## Changes Made

### File: `backend/controller/AdminDashboardController.js`

**Line ~260-290**: Updated compensation activity mapping
```javascript
// Before:
notes = [
  baseServiceLine,
  `Customer: ${incident.customer_name || 'Customer'}`,
  `Handled by: ${incident.responsible_party || 'admin'}`,  // WRONG - this is who damaged it
  ...
].join('\n');

activityMap.set(key, {
  ...
  action_by: incident.responsible_party || 'admin',  // WRONG
  ...
});

// After:
const reportedByName = incident.handled_by || 'admin';  // Who reported it
const damagedByName = incident.responsible_party || 'Unknown';  // Who caused damage

notes = [
  baseServiceLine,
  `Reported from ${serviceLabel} management`,
  `Customer: ${incident.customer_name || 'Customer'}`,
  `Damaged by: ${damagedByName}`,  // NEW - shows who caused damage
  ...
].join('\n');

activityMap.set(key, {
  ...
  action_by: reportedByName,  // FIXED - shows who reported it
  ...
});
```

### File: `backend/controller/DamageRecordController.js`

**Line ~160-170**: Added clarifying comment
```javascript
// Get the logged-in user info
const reportedByUserId = req.user?.id || req.user?.user_id || null;
const reportedByRole = req.user?.role || null;
```

## How It Works Now

When a damage compensation is created:

1. **reported_by_user_id**: Captures the logged-in admin/clerk who is creating the compensation record
   - This is shown as "Changed by" in the dashboard
   
2. **responsible_party**: Captures the staff/admin who caused the damage (from the "Responsible staff/admin" input field)
   - This is shown as "Damaged by" in the activity notes

## Example Dashboard Display

**Before:**
```
Name: kakkel mamiala
Type of Service: Dry Cleaning
Status: DAMAGE COMPENSATION
Details:
  Service: Dry Cleaning
  Customer: kakkel mamiala
  Handled by: ned stark  ❌ (Wrong - this was who damaged it!)
  Damage type: damage
  Amount to pay: ₱500.00
  Payment status: unpaid
Changed by: ned stark  ❌ (Wrong!)
```

**After:**
```
Name: kakkel mamiala
Type of Service: Dry Cleaning
Status: DAMAGE COMPENSATION
Details:
  Changed by: admin  ✅ (Who reported/created the record)
  Damaged by: ned stark  ✅ (Who caused the damage - in RED)
  Service: Dry Cleaning
  Customer: kakkel mamiala
  Damage type: damage
  Amount to pay: ₱500.00
  Payment status: unpaid
```

The "Damaged by" field now appears:
- **In the Details column** (4th column)
- **In bold red text** to make it stand out
- **Right after "Changed by"** for easy comparison

## Testing

To verify the fix:
1. Log in as admin
2. Create a new damage compensation for dry cleaning or repair
3. In the "Responsible staff/admin" field, enter a staff name (e.g., "clerk john")
4. Submit the compensation
5. Check the dashboard - "Changed by" should show your admin username, and "Damaged by: clerk john" should appear in the details

## Database Fields Reference

**damage_compensation_records table:**
- `reported_by_user_id`: FK to user table - who created the record (admin/clerk)
- `reported_by_role`: Role of the person who created the record
- `responsible_party`: Text field - who caused the damage (can be clerk, admin, or any staff name)
- `customer_name`: Who will pay for the damage
