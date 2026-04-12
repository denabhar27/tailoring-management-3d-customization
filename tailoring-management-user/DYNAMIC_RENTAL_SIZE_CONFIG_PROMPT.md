# Dynamic Rental Size Configuration Implementation Prompt

## Overview
Implement **dynamic overdue amounts and rental duration per size** instead of fixed values. Each size (Small, Medium, Large, XL, etc.) will have its own:
- **Rental duration** (number of days)
- **Overdue amount** (penalty per day after due date)
- 

## Key Changes Required

### 1. Admin PostRent.jsx Component Updates
**File**: `src/admin/PostRent.jsx`

#### Form Structure Updates:
Add **rental_duration** and **overdue_amount** fields alongside existing price/deposit fields for each size entry.

#### Specific UI Changes:
In the size entries section, add new input fields:

```jsx
<!-- Existing fields -->
<label style={{ fontSize: '12px', color: '#555', whiteSpace: 'nowrap' }}>Price:</label>
<input
  type="number"
  min="0"
  step="0.01"
  value={entry.price}
  onChange={(e) => handleEntryChange(entry.id, 'price', e.target.value)}
  placeholder="0.00"
  style={{ width: '90px', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', color: '#000', fontSize: '13px' }}
/>

<label style={{ fontSize: '12px', color: '#555', whiteSpace: 'nowrap' }}>Deposit:</label>
<input
  type="number"
  min="0"
  step="0.01"
  value={entry.deposit}
  onChange={(e) => handleEntryChange(entry.id, 'deposit', e.target.value)}
  placeholder="0.00"
  style={{ width: '90px', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', color: '#000', fontSize: '13px' }}
/>

<!-- ADD THESE NEW FIELDS -->
<label style={{ fontSize: '12px', color: '#555', whiteSpace: 'nowrap' }}>Duration:</label>
<input
  type="number"
  min="1"
  value={entry.rental_duration || ''}
  onChange={(e) => handleEntryChange(entry.id, 'rental_duration', e.target.value)}
  placeholder="3"
  style={{ width: '70px', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', color: '#000', fontSize: '13px' }}
/>
<span style={{ fontSize: '10px', color: '#888', marginLeft: '2px' }}>days</span>

<label style={{ fontSize: '12px', color: '#555', whiteSpace: 'nowrap' }}>Overdue:</label>
<input
  type="number"
  min="0"
  step="0.01"
  value={entry.overdue_amount || ''}
  onChange={(e) => handleEntryChange(entry.id, 'overdue_amount', e.target.value)}
  placeholder="50.00"
  style={{ width: '80px', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', color: '#000', fontSize: '13px' }}
/>
<span style={{ fontSize: '10px', color: '#888', marginLeft: '2px' }}/day</span>
```

#### Data Structure Updates:
Update `createDefaultSizeEntry` function:

```javascript
const createDefaultSizeEntry = (sizeKey, extraId = '') => ({
  id: `${sizeKey || 'custom'}_${Date.now()}${extraId}`,
  sizeKey: sizeKey || 'custom',
  customLabel: '',
  quantity: '',
  price: '',
  deposit: '',
  rental_duration: '3', // Default 3 days
  overdue_amount: '50.00', // Default 50 per day
  activeTab: 'top',
  isOpen: false,
  measurements: EMPTY_MEASUREMENTS()
});
```

Update parsing functions to include new fields:
```javascript
return {
  id: `entry_${idx}_${Date.now()}`,
  sizeKey: entry.sizeKey || 'custom',
  customLabel: entry.customLabel || '',
  quantity: entry.quantity !== undefined ? String(entry.quantity) : '',
  price: entry.price !== undefined ? String(entry.price) : '',
  deposit: entry.deposit !== undefined ? String(entry.deposit) : '',
  rental_duration: entry.rental_duration !== undefined ? String(entry.rental_duration) : '3',
  overdue_amount: entry.overdue_amount !== undefined ? String(entry.overdue_amount) : '50.00',
  activeTab: 'top',
  isOpen: false,
  measurements
};
```

### 2. Database Schema & Migration

#### Critical: Automatic Migration Setup
**All database changes MUST include automatic migration scripts** - no manual XAMPP intervention required.

#### Size Entries Table Migration
```sql
-- Add rental duration and overdue amount columns
ALTER TABLE size_entries ADD COLUMN rental_duration INT DEFAULT 3 AFTER deposit;
ALTER TABLE size_entries ADD COLUMN overdue_amount DECIMAL(10,2) DEFAULT 50.00 AFTER rental_duration;

-- Update existing entries with defaults
UPDATE size_entries SET rental_duration = 3 WHERE rental_duration IS NULL;
UPDATE size_entries SET overdue_amount = 50.00 WHERE overdue_amount IS NULL;
```

#### Rental Orders Table Updates
```sql
-- Add columns to track size-specific rental info
ALTER TABLE rental_orders ADD COLUMN rental_duration INT DEFAULT 3 AFTER total_deposit;
ALTER TABLE rental_orders ADD COLUMN overdue_rate DECIMAL(10,2) DEFAULT 50.00 AFTER rental_duration;
ALTER TABLE rental_orders ADD COLUMN due_date DATE AFTER overdue_rate;
```

#### Migration Script Implementation
**Create**: `src/database/migrations/add_dynamic_rental_config.php`

```php
<?php
class AddDynamicRentalConfig {
    public function up() {
        $pdo = $this->getConnection();
        
        try {
            // Add rental duration and overdue amount to size_entries
            $pdo->exec("ALTER TABLE size_entries ADD COLUMN rental_duration INT DEFAULT 3 AFTER deposit");
            $pdo->exec("ALTER TABLE size_entries ADD COLUMN overdue_amount DECIMAL(10,2) DEFAULT 50.00 AFTER rental_duration");
            
            // Add rental tracking to rental_orders
            $pdo->exec("ALTER TABLE rental_orders ADD COLUMN rental_duration INT DEFAULT 3 AFTER total_deposit");
            $pdo->exec("ALTER TABLE rental_orders ADD COLUMN overdue_rate DECIMAL(10,2) DEFAULT 50.00 AFTER rental_duration");
            $pdo->exec("ALTER TABLE rental_orders ADD COLUMN due_date DATE AFTER overdue_rate");
            
            // Update existing entries with defaults
            $pdo->exec("UPDATE size_entries SET rental_duration = 3 WHERE rental_duration IS NULL");
            $pdo->exec("UPDATE size_entries SET overdue_amount = 50.00 WHERE overdue_amount IS NULL");
            $pdo->exec("UPDATE rental_orders SET rental_duration = 3 WHERE rental_duration IS NULL");
            $pdo->exec("UPDATE rental_orders SET overdue_rate = 50.00 WHERE overdue_rate IS NULL");
            
            echo "Dynamic rental config migration completed successfully!\n";
            return true;
            
        } catch (Exception $e) {
            echo "Migration failed: " . $e->getMessage() . "\n";
            return false;
        }
    }
    
    private function getConnection() {
        return new PDO('mysql:host=localhost;dbname=your_db', 'username', 'password');
    }
}

// Auto-run migration
$migration = new AddDynamicRentalConfig();
$migration->up();
?>
```

### 3. API Updates

#### RentalApi.js Changes
Update `createRental` and `updateRental` functions to handle new fields in size entries payload.

#### RentalOrderApi.js Changes
Update rental order creation to:
- Calculate due_date based on size-specific rental duration
- Store overdue_rate from the selected size
- Handle size-specific overdue calculations

#### Overdue Calculation Logic
```javascript
// NEW: Size-specific overdue calculation
const calculateOverdueAmount = (rentalOrder, selectedSize) => {
  const today = new Date();
  const dueDate = new Date(rentalOrder.due_date);
  const daysOverdue = Math.max(0, Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24)));
  
  // Get overdue amount for the specific size
  const sizeEntry = rentalOrder.size_entries.find(entry => entry.sizeKey === selectedSize.sizeKey);
  const overdueRate = parseFloat(sizeEntry?.overdue_amount || rentalOrder.overdue_rate || 50);
  
  return daysOverdue * overdueRate;
};
```

### 4. Admin Rental Management Updates
**File**: `src/admin/Rental.jsx`

#### Due Date Calculation Updates:
```javascript
// NEW: Calculate due date based on size-specific duration
const calculateDueDate = (rentalStartDate, selectedSize) => {
  const rentalDuration = parseInt(selectedSize.rental_duration) || 3;
  const dueDate = new Date(rentalStartDate);
  dueDate.setDate(dueDate.getDate() + rentalDuration);
  return dueDate;
};
```

#### Overdue Display Updates:
- Show size-specific overdue rates in order details
- Calculate overdue penalties per size
- Update payment modals to show correct overdue amounts

#### Order Details Display:
```jsx
<div className="detail-row">
  <strong>Rental Duration:</strong>
  <span>{selectedSize.rental_duration} days</span>
</div>
<div className="detail-row">
  <strong>Overdue Rate:</strong>
  <span>¥{selectedSize.overdue_amount}/day after due date</span>
</div>
<div className="detail-row">
  <strong>Due Date:</strong>
  <span>{new Date(rentalOrder.due_date).toLocaleDateString()}</span>
</div>
```

### 5. User-Facing Components

#### RentalClothes.jsx Updates
**File**: `src/user/components/RentalClothes.jsx`

- Display rental duration and overdue rates per size
- Update cart to include size-specific rental terms
- Show due date calculations during checkout

#### Cart and Checkout Updates
- Calculate due dates based on selected size's rental duration
- Display size-specific overdue policies
- Update order confirmation to show rental terms per item

#### Order Tracking Updates
- Show due dates and overdue amounts per size
- Display size-specific rental terms in order history
- Update return process with size-specific calculations

### 6. React Native Components
Apply same changes to:
- Rental item forms
- Cart and checkout flows
- Order tracking screens
- Payment calculations

## Implementation Examples

### Size Configuration Examples:
```javascript
// Example size configurations for a business suit:
const sizeConfigs = {
  small: {
    price: '500.00',
    deposit: '1000.00',
    rental_duration: '2', // 2 days only
    overdue_amount: '75.00' // Higher overdue rate for short rental
  },
  medium: {
    price: '600.00',
    deposit: '1200.00',
    rental_duration: '3', // Standard 3 days
    overdue_amount: '50.00' // Standard overdue rate
  },
  large: {
    price: '700.00',
    deposit: '1400.00',
    rental_duration: '5', // Extended 5 days
    overdue_amount: '40.00' // Lower overdue rate for longer rental
  },
  extra_large: {
    price: '800.00',
    deposit: '1600.00',
    rental_duration: '7', // Full week rental
    overdue_amount: '35.00' // Lowest overdue rate
  }
};
```

### Payment Flow Example:
1. User selects Large size (5 days, ¥40/day overdue)
2. Due date calculated: Order date + 5 days
3. If returned 3 days late: 3 × ¥40 = ¥120 overdue fee
4. Total due: Rental price + deposit + overdue fees

## Validation Rules

### Form Validation:
- **rental_duration**: Must be positive integer (1-30 days recommended)
- **overdue_amount**: Must be positive decimal (>= 0)
- Both fields required for each size with quantity > 0

### Business Logic Validation:
- Larger sizes can have longer rental durations
- Overdue rates can be inversely proportional to rental duration
- Minimum rental duration: 1 day
- Maximum rental duration: 30 days (configurable)

## Testing Requirements

1. **Admin Form Testing**:
   - Test rental duration input validation
   - Test overdue amount input validation
   - Test form submission with new fields

2. **Order Creation Testing**:
   - Test due date calculation per size
   - Test overdue calculation per size
   - Test rental order creation with size-specific terms

3. **Payment Flow Testing**:
   - Test overdue fee calculations
   - Test payment processing with size-specific fees
   - Test deposit refunds with overdue deductions

4. **User Interface Testing**:
   - Test rental duration display per size
   - Test overdue rate display per size
   - Test due date calculations in user flow

5. **React Native Testing**:
   - Test mobile rental forms
   - Test mobile checkout flow
   - Test mobile order tracking

## Important Notes

- **Backward Compatibility**: Existing rentals maintain 3-day default and ¥50/day overdue
- **Migration Safety**: All new fields have sensible defaults
- **User Experience**: Clearly display rental terms per size during selection
- **Business Logic**: Ensure overdue calculations are consistent across all components
- **Performance**: Optimize due date and overdue calculations for bulk operations

## Migration Strategy

1. **Phase 1**: Database migration with automatic defaults
2. **Phase 2**: Admin form updates with new fields
3. **Phase 3**: API updates for new data handling
4. **Phase 4**: User interface updates
5. **Phase 5**: React Native updates
6. **Phase 6**: Testing and validation

This implementation provides maximum flexibility for rental businesses to set different rental terms based on garment sizes, improving inventory management and customer satisfaction.
