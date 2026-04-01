# Rental Deposit System Implementation Prompt

## Overview
Modify the rental system to use **deposit** instead of **downpayment**. When users rent clothes, they must pay both the rental price AND the deposit amount upfront. The deposit is refundable upon return of the item.

## Key Changes Required

### 1. Admin PostRent.jsx Component Changes
**File**: `src/admin/PostRent.jsx`

#### Form Structure Updates:
- Add a **deposit** input field alongside the existing **price** field for each size entry
- Update the size entry form to show both "Price" and "Deposit" columns
- Modify the form validation to require both price and deposit values

#### Specific UI Changes:
In the size entries section (around line 913-922), add deposit field:
```jsx
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
<!-- ADD THIS DEPOSIT FIELD -->
<label style={{ fontSize: '12px', color: '#555', whiteSpace: 'nowrap', marginLeft: '10px' }}>Deposit:</label>
<input
  type="number"
  min="0"
  step="0.01"
  value={entry.deposit}
  onChange={(e) => handleEntryChange(entry.id, 'deposit', e.target.value)}
  placeholder="0.00"
  style={{ width: '90px', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', color: '#000', fontSize: '13px' }}
/>
```

### 2. API Updates

#### RentalApi.js Changes
**File**: `src/api/RentalApi.js`

Update the `createRental` and `updateRental` functions to handle deposit data in the size entries payload. The deposit should be included in each size entry object.

#### RentalOrderApi.js Changes
**File**: `src/api/RentalOrderApi.js`

Update payment calculation logic to include both price + deposit for initial payment.

### 3. Admin Rental Management Changes
**File**: `src/admin/Rental.jsx`

#### Payment Logic Updates:
- Replace all downpayment calculations (50% of price) with **full price + deposit**
- Update payment modals to show: "Required Payment: ₱(price + deposit)"
- Modify status flow to require full payment before marking as "rented"

#### Specific Code Changes:
- Replace `downpayment = totalPrice * 0.5` with `requiredPayment = totalPrice + totalDeposit`
- Update payment confirmation messages
- Modify payment recording logic

### 4. User-Facing Components

#### RentalClothes.jsx Updates
**File**: `src/user/components/RentalClothes.jsx`

- Update price display to show: "Price: ₱X + Deposit: ₱Y"
- Modify cart addition logic to include both price and deposit
- Update payment flow to require full amount

#### Cart and Payment Updates
**Files**: `src/api/CartApi.js`, payment-related components

- Update cart calculations to include deposit amounts
- Modify checkout process to handle deposit payments
- Update order confirmation to show deposit breakdown

### 5. Order Tracking Updates
**Files**: Order tracking components, admin rental management

- Update payment status displays to show deposit information
- Modify refund logic for deposit returns
- Update order details to show deposit amounts

### 6. React Native Components
**Files**: React Native rental components (locate in mobile app structure)

- Apply same changes to native rental forms
- Update payment logic in mobile checkout
- Modify order tracking in mobile app

## Implementation Notes

### Payment Calculation Logic
```javascript
// OLD: Required downpayment = 50% of total price
const downpayment = totalPrice * 0.5;

// NEW: Required payment = full price + full deposit
const totalDeposit = sizeEntries.reduce((sum, entry) => 
  sum + (parseFloat(entry.deposit) * parseInt(entry.quantity)), 0);
const requiredPayment = totalPrice + totalDeposit;
```

### Database Schema Considerations
- Ensure size_entries table/model includes `deposit` field
- Update rental orders to store deposit amounts separately
- Add deposit tracking to payment records

### User Experience Flow
1. User selects rental item and size
2. System displays: "Rental Price: ₱500, Deposit: ₱1000"
3. User pays: ₱1500 upfront
4. Upon return: User gets ₱1000 deposit back (if item undamaged)

### Validation Rules
- Both price and deposit must be positive numbers
- Deposit should typically be higher than rental price
- Quantity validation should apply to both price and deposit calculations

## Testing Requirements
1. Test admin form with deposit field validation
2. Test rental order creation with deposit calculation
3. Test payment flow with new deposit logic
4. Test deposit refund process upon item return
5. Test React Native equivalents

### Database Schema & Migration Requirements

#### Critical: Automatic Migration Setup
**All database changes MUST include automatic migration scripts** - no manual XAMPP intervention required.

#### 1. Size Entries Table Migration
```sql
-- Add deposit column to size_entries table
ALTER TABLE size_entries ADD COLUMN deposit DECIMAL(10,2) DEFAULT 0.00 AFTER price;

-- Update existing entries to have default deposit (50% of price as fallback)
UPDATE size_entries SET deposit = (price * 0.5) WHERE deposit = 0.00 AND price > 0;
```

#### 2. Rental Orders Table Migration
```sql
-- Add deposit tracking columns
ALTER TABLE rental_orders ADD COLUMN total_deposit DECIMAL(10,2) DEFAULT 0.00 AFTER total_price;
ALTER TABLE rental_orders ADD COLUMN deposit_refunded DECIMAL(10,2) DEFAULT 0.00 AFTER total_deposit;
ALTER TABLE rental_orders ADD COLUMN deposit_refund_date DATETIME NULL AFTER deposit_refunded;

-- Calculate and update existing orders with deposit amounts
UPDATE rental_orders ro 
SET total_deposit = (
    SELECT COALESCE(SUM(se.deposit * se.quantity), 0) 
    FROM size_entries se 
    WHERE se.rental_order_id = ro.order_id
)
WHERE total_deposit = 0.00;
```

#### 3. Payment Records Migration
```sql
-- Add deposit tracking to payment records
ALTER TABLE payments ADD COLUMN payment_type ENUM('rental_payment', 'deposit_refund', 'penalty_fee') DEFAULT 'rental_payment' AFTER payment_method;
ALTER TABLE payments ADD COLUMN deposit_amount DECIMAL(10,2) DEFAULT 0.00 AFTER payment_type;
```

#### 4. Migration Script Implementation
**Create migration file**: `src/database/migrations/add_rental_deposits.php`

```php
<?php
class AddRentalDeposits {
    public function up() {
        $pdo = $this->getConnection();
        
        try {
            // Add deposit column to size_entries
            $pdo->exec("ALTER TABLE size_entries ADD COLUMN deposit DECIMAL(10,2) DEFAULT 0.00 AFTER price");
            
            // Add deposit tracking to rental_orders
            $pdo->exec("ALTER TABLE rental_orders ADD COLUMN total_deposit DECIMAL(10,2) DEFAULT 0.00 AFTER total_price");
            $pdo->exec("ALTER TABLE rental_orders ADD COLUMN deposit_refunded DECIMAL(10,2) DEFAULT 0.00 AFTER total_deposit");
            $pdo->exec("ALTER TABLE rental_orders ADD COLUMN deposit_refund_date DATETIME NULL AFTER deposit_refunded");
            
            // Add payment type tracking
            $pdo->exec("ALTER TABLE payments ADD COLUMN payment_type ENUM('rental_payment', 'deposit_refund', 'penalty_fee') DEFAULT 'rental_payment' AFTER payment_method");
            $pdo->exec("ALTER TABLE payments ADD COLUMN deposit_amount DECIMAL(10,2) DEFAULT 0.00 AFTER payment_type");
            
            // Migrate existing data
            $pdo->exec("UPDATE size_entries SET deposit = (price * 0.5) WHERE deposit = 0.00 AND price > 0");
            
            // Update existing orders
            $pdo->exec("
                UPDATE rental_orders ro 
                SET total_deposit = (
                    SELECT COALESCE(SUM(se.deposit * se.quantity), 0) 
                    FROM size_entries se 
                    WHERE se.rental_order_id = ro.order_id
                )
                WHERE total_deposit = 0.00
            ");
            
            echo "Migration completed successfully!\n";
            return true;
            
        } catch (Exception $e) {
            echo "Migration failed: " . $e->getMessage() . "\n";
            return false;
        }
    }
    
    private function getConnection() {
        // Your database connection logic
        return new PDO('mysql:host=localhost;dbname=your_db', 'username', 'password');
    }
}

// Auto-run migration
$migration = new AddRentalDeposits();
$migration->up();
?>
```

#### 5. API Integration with Migration
**Update RentalApi.js** to check and run migrations:

```javascript
// Add to createRental function
const ensureDepositColumn = async () => {
  try {
    await axios.post(`${API_URL}/migrations/ensure-deposit-columns`);
  } catch (error) {
    console.warn('Migration check failed:', error);
  }
};

// Call before creating/updating rentals
await ensureDepositColumn();
```

#### 6. Backend Migration Endpoint
**Create**: `src/api/migrations.php`

```php
<?php
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $_GET['action'] === 'ensure-deposit-columns') {
    $migration = new AddRentalDeposits();
    $success = $migration->up();
    
    echo json_encode([
        'success' => $success,
        'message' => $success ? 'Migration completed' : 'Migration failed'
    ]);
}
?>
```

## Important Notes
- **NO MANUAL XAMPP INTERVENTION** - all migrations run automatically
- Migration scripts execute on first API call after deployment
- Backward compatibility maintained for existing data
- Database changes are idempotent (safe to run multiple times)
- All new tables/columns include proper defaults
- Migration status logged for debugging

This change affects the entire rental ecosystem - ensure all components are updated consistently to avoid payment calculation errors.
