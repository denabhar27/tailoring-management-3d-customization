# Prompt: Combine Billing and Inventory into Unified Dashboard

## Overview
Create a unified dashboard page that combines billing and inventory functionality with a clean, scrollable layout. This page will replace the separate billing and inventory pages with a single, efficient interface that displays completed orders, statistics, and rental inventory management.

## Page Structure and Layout

### 1) New Unified Page
- **Page Name**: "Orders & Inventory" (in sidebar navigation)
- **Route**: `/admin/orders-inventory`
- **Purpose**: Single page for billing/completed orders and rental inventory management

### 2) Top Section: Combined Statistics Cards
- **Position**: Fixed at top of page (sticky header)
- **Content**: 
  - Total Orders (from billing)
  - Total Revenue (from billing orders)
  - Active Rentals (from inventory)
  - Available Items (from inventory)
  - Pending Orders (from billing)
  - In Progress Orders (from billing)
  - Total Inventory Items (from inventory)
  - Monthly Revenue (from billing)
- **Layout**: Grid layout (2x4 or 4x2 depending on screen size)
- **Cards**: Compact, with icons and numbers, consistent with existing admin theme
- **Note**: Combine all relevant billing and inventory metrics into one unified analytics section
- **Completed Status Click**: When clicking "Completed" status for inventory items in the combined table, open the same modal/details view as the original inventory page

### 3) Middle Section: Combined Billing & Inventory Table
- **Position**: Below stats, scrollable with fixed height
- **Content**: 
  - Combined billing orders and inventory items in one table
  - Columns: ID, Customer/Item Name, Type (Order/Inventory), Service/Category, Amount/Price, Date/Added Date, Status
  - **Status Filter**: Dropdown/toggle to filter by:
    - All
    - Completed (includes both completed orders and inventory items)
    - Pending
    - In Progress
    - Cancelled
    - Available (inventory only)
    - Rented (inventory only)
- **Default View**: Show "Completed" status items by default
- **Data Source**: 
  - Billing orders from `/api/admin/billing/orders`
  - Inventory items from `/api/admin/inventory/rental-items`
  - Merge both datasets with type distinction
- **Scrolling**: 
  - Fixed height (e.g., max-height: 400px)
  - Vertical scroll within table container
  - Header remains visible while scrolling
- **Features**: 
  - Search functionality
  - Sort by date/amount
  - Quick view/order details
  - Status change actions (if applicable)
  - Type indicators (Order vs Inventory)

### 4) Bottom Section: Rental Post Management
- **Position**: Below the combined table
- **Content**: 
  - Copy of rental post functionality
  - Available rental items management
  - Item status (Available, Rented, Maintenance)
  - Quick actions (Rent, Return, Edit)
- **Layout**: 
  - Grid or card-based display
  - Responsive layout
  - Similar styling to existing rental post section
- **Functionality**: 
  - Same actions as original rental post (Rent, Return, Edit)
  - Do not remove or modify the original rental post functionality
  - This is an additional copy of the rental post below the combined table

## Technical Implementation Details

### Frontend (React/Next.js)

#### Component Structure
```jsx
// /pages/admin/orders-inventory.js or /components/admin/OrdersInventoryDashboard.js
<OrdersInventoryDashboard>
  <StatsCards />
  <CombinedBillingInventoryTable />
  <RentalPostManagement />
</OrdersInventoryDashboard>
```

#### Key Features
- **Responsive Design**: Works on desktop and tablets
- **Scrollable Table**: CSS `overflow-y: auto` with fixed height
- **State Management**: Use existing admin state management pattern
- **API Integration**: Reuse existing billing and inventory APIs

#### Styling Requirements
- **Consistent Theme**: Match existing admin panel colors and fonts
- **Card Heights**: Stats cards fixed height, table scrollable
- **Spacing**: Proper margins between sections
- **Loading States**: Skeleton loaders for data fetching

### Backend (Node.js/Express)

#### API Endpoints (reuse existing)
- `/api/admin/billing/orders` (with status filter parameter)
- `/api/admin/inventory/rental-items`
- `/api/admin/inventory/update-status`

#### Backend Updates Needed
- Create combined endpoint or merge data client-side:
  - Option A: New endpoint `/api/admin/billing-inventory/combined` that merges both datasets
  - Option B: Client-side merge of existing endpoints
- Support query parameter: `?status=completed|pending|in-progress|cancelled|available|rented|all`
- Return combined dataset with type distinction (Order vs Inventory)
- Unified status filtering across both data types

## Walk-in Orders Form Layout Update

### Current Issue
Customer information and service details are stacked vertically, requiring scrolling to see all fields.

### New Layout Requirements
- **Side-by-side layout**: Customer info left, service details right
- **Responsive**: Stack vertically on mobile/tablet
- **Compact sizing**: Reduce form field sizes slightly to fit both sections
- **Same functionality**: All existing features remain unchanged

### Implementation
```jsx
// /components/admin/WalkInOrdersForm.js
<div className="walk-in-form-container">
  <div className="customer-info-section">
    {/* Customer information fields */}
  </div>
  <div className="service-details-section">
    {/* Service details fields */}
  </div>
</div>
```

### CSS Requirements
- **Desktop**: Two-column layout (50/50 or 60/40 split)
- **Mobile/Tablet**: Single column with proper breakpoints
- **Form Sizing**: Slightly reduced padding/margins to fit content
- **Accessibility**: Maintain proper tab order and labels

## Navigation and Routing

### Sidebar Updates
- **Remove**: Separate "Billing" and "Inventory" menu items
- **Add**: "Orders & Inventory" menu item
- **Icon**: Choose appropriate icon (e.g., clipboard-list or package)

### Route Changes
- **Old Routes**: Keep for backward compatibility or redirect
- **New Route**: `/admin/orders-inventory`
- **Breadcrumbs**: Update to reflect new page structure

## Success Criteria

### Functional Requirements
- [ ] Combined table displays both billing orders and inventory items
- [ ] Status filter works for all options (All, Completed, Pending, In Progress, Cancelled, Available, Rented)
- [ ] "Completed" filter shows both completed orders and inventory items
- [ ] Type distinction visible (Order vs Inventory)
- [ ] Combined statistics cards show all billing and inventory metrics in one section
- [ ] Rental post management section below table with Rent, Return, Edit actions
- [ ] Original rental post functionality remains unchanged
- [ ] Walk-in form shows side-by-side on desktop
- [ ] All existing features work unchanged

### UI/UX Requirements
- [ ] Page loads quickly with proper loading states
- [ ] Table scrolls smoothly with fixed header
- [ ] Responsive design works on all screen sizes
- [ ] Consistent styling with existing admin panel
- [ ] No horizontal overflow on any screen size

### Performance Requirements
- [ ] Page load time under 2 seconds
- [ ] Smooth scrolling with large datasets
- [ ] Efficient API calls (no duplicate requests)

## Implementation Priority

### Phase 1: Core Dashboard
1. Create unified Orders & Inventory page
2. Implement statistics cards
3. Build scrollable completed orders table
4. Add rental inventory section

### Phase 2: Walk-in Form Update
1. Update walk-in form layout to side-by-side
2. Ensure responsive design
3. Test functionality

### Phase 3: Navigation & Cleanup
1. Update sidebar navigation
2. Handle old routes (redirect or remove)
3. Test all admin workflows

## Notes and Considerations

### Data Management
- Use existing API endpoints
- Add client-side filtering for completed status
- Implement efficient data fetching with proper loading states

### User Experience
- Maintain familiar admin workflow
- Reduce clicks between pages
- Improve information density without overwhelming users

### Technical Debt
- Remove duplicate code from separate billing/inventory pages
- Consolidate related functionality
- Improve maintainability

### Future Enhancements
- Add advanced filtering to orders table
- Implement bulk actions for inventory
- Add export functionality for reports

## Testing Checklist

### Manual Testing
- [ ] Verify combined table shows both billing orders and inventory items
- [ ] Test status filter for all options (All, Completed, Pending, In Progress, Cancelled, Available, Rented)
- [ ] Verify "Completed" filter shows both completed orders and inventory items
- [ ] Test rental post management section below table
- [ ] Test Rent, Return, Edit actions in rental post section
- [ ] Verify table scrolling with large datasets
- [ ] Verify statistics cards update correctly
- [ ] Test walk-in form side-by-side layout
- [ ] Verify responsive design on mobile/tablet
- [ ] Test all existing admin workflows
- [ ] Verify original rental post functionality remains unchanged

### Automated Testing
- [ ] Unit tests for new components
- [ ] Integration tests for API calls
- [ ] Responsive design tests
- [ ] Accessibility tests (WCAG compliance)

## Browser Compatibility
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)
