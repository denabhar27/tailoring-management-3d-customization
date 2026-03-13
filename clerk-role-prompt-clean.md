# Prompt: Add Clerk Role with Restricted Access

## Overview
Create a new user role called "Clerk" with limited administrative access. The Clerk role can manage specific operational functions but is restricted from financial and high-level administrative features. Admin users can create Clerk accounts through the dashboard.

## Role-Based Access Control Requirements

### 1) Admin Role (Existing - Unchanged)
- **Full Access**: All features including dashboard, billing, combined inventory/orders, service management, rental management, customer lists
- **User Management**: Can create Clerk accounts
- **Financial Access**: Can view and manage billing, revenue, and financial reports
- **System Settings**: Full access to all administrative settings

### 2) Clerk Role (New - Restricted Access)
- **Service Management**: Full access to service creation, editing, and status management
- **Post Rental**: Full access to rental post functionality (Rent, Return, Edit)
- **Inventory for Rental Clothes**: Full access to rental inventory management
- **Walk-in Management**: Full access to walk-in order creation and management
- **Customer Lists**: View and manage customer information
- **Service Status Updates**: Can change service order statuses (Pending → In Progress → Completed)

### 3) Clerk Restrictions (What Clerk CANNOT Access)
- **Dashboard**: Cannot access main dashboard with analytics and statistics
- **Billing**: Cannot access billing pages or financial information
- **Combined Inventory & Orders**: Cannot access the unified billing/inventory page
- **Financial Reports**: Cannot view revenue, costs, or financial data
- **User Management**: Cannot create other users (only Admin can create Clerks)
- **System Settings**: Cannot access system-wide settings

## Clerk Account Creation in Admin Dashboard

### Location: Admin Dashboard → User Management Section

### Creation Form Fields
- **First Name** (required)
- **Last Name** (required) 
- **Middle Name** (optional)
- **Email** (required, unique)
- **Phone Number** (required)
- **Role** (pre-selected as "Clerk", not editable)

### Form Validation
- **Email**: Must be unique email format validation
- **Phone**: Phone number format validation
- **Required Fields**: First Name, Last Name, Email, Phone Number must be filled

### Account Creation Process
1. Admin navigates to Dashboard → User Management
2. Admin clicks "Create New Clerk" button
3. Admin fills out the clerk creation form
4. System validates inputs
5. System creates clerk account with "Clerk" role
6. System sends welcome email to clerk with login credentials
7. Admin can view, edit, or deactivate clerk accounts

## Navigation and Menu Structure

### Admin Menu (Unchanged)
- Dashboard
- Billing
- Orders & Inventory (Combined)
- Service Management
- Post Rental
- Inventory (Rental Clothes)
- Walk-in Orders
- Customer Lists
- User Management (New section for Clerk management)

### Clerk Menu (Restricted)
- Service Management
- Post Rental
- Inventory (Rental Clothes)
- Walk-in Orders
- Customer Lists

### Hidden from Clerk Menu
- Dashboard (with analytics)
- Billing
- Orders in orders and inventory

## Dashboard Updates for Clerk Management

### Admin Dashboard Layout
1. **Top Section**: Existing analytics cards and statistics
2. **Middle Section**: Existing dashboard tables/charts
3. **Bottom Section**: New Clerk Management Table

### Clerk Management Table (Below Dashboard Tables)
- **Position**: Below existing dashboard content
- **Header**: "Clerk Accounts Management"
- **Create Button**: "Create New Clerk" button at top of table (opens modal)
- **Table Columns**:
  - ID
  - Full Name (First + Last + Middle)
  - Email
  - Phone Number
  - Status (Active/Inactive)
  - Created Date
  - Actions (Edit, Deactivate, Reset Password)

### Clerk Creation Modal
- **Trigger**: "Create New Clerk" button
- **Modal Content**: Clerk creation form with all required fields
- **Modal Fields**:
  - First Name (required)
  - Last Name (required)
  - Middle Name (optional)
  - Email (required, unique)
  - Phone Number (required)
- **Modal Actions**:
  - Create Clerk (submit form)
  - Cancel (close modal)
- **Modal Behavior**:
  - Overlay background
  - Close on X button or outside click
  - Form validation before submission
  - Success message and auto-close on successful creation

## Technical Implementation Details

### Backend (Node.js/Express)

#### Database Schema Changes
- Add role column to users table with default 'admin'
- Add clerk profile fields: first_name, last_name, middle_name, phone_number
- Add indexes for role-based queries
- Handle null values for new fields in existing admin users

#### API Endpoints
- **Clerk Management (Admin only)**:
  - POST /api/admin/clerks - Create new clerk
  - GET /api/admin/clerks - List all clerks
  - PUT /api/admin/clerks/:id - Update clerk info
  - DELETE /api/admin/clerks/:id - Deactivate clerk
  - POST /api/admin/clerks/:id/reset-password - Reset clerk password

- **Authentication with role checking**:
  - POST /api/auth/login - Login with role response
  - GET /api/auth/profile - Get user profile with role

#### Middleware for Role-Based Access
- Create role-based access middleware
- Validate user role for protected endpoints
- Return 403 for unauthorized access attempts

#### User Model Updates
- Add role field with enum ['admin', 'clerk']
- Add clerk profile fields (firstName, lastName, middleName, phoneNumber)
- Add isActive field for clerk account status
- Add timestamps for audit trail

### Frontend (React/Next.js)

#### Authentication Context Updates
- Add role management to auth context
- Create permission checking utilities
- Update login flow to handle role-based routing

#### Navigation Component
- Create role-based navigation filtering
- Hide/show menu items based on user permissions
- Maintain consistent styling with existing navigation

#### Dashboard Component Updates
- Add clerk management section below existing content
- Implement modal for clerk creation
- Handle clerk list state management
- Add real-time updates after clerk creation

#### Clerk Management Components
- **Clerk Creation Form**: Form with validation and error handling
- **Clerk Management Table**: Table with clerk list and actions
- **Modal Component**: Reusable modal for clerk creation
- **Status Management**: Activate/deactivate clerk accounts

#### Route Protection
- Wrap all admin routes with permission checking
- Show appropriate "Access Denied" messages
- Implement server-side validation for all routes

## Service Status Management for Clerks

### Clerk Permissions for Service Status
- **Can Change Status**: Pending → In Progress → Completed
- **Cannot Delete Services**: Only Admin can delete services
- **Cannot Change Pricing**: Only Admin can modify service pricing
- **Can View All Services**: Full visibility of service catalog

### Status Update Workflow
1. Clerk views service orders in Service Management
2. Clerk can update status using dropdown/buttons
3. System logs status changes with user attribution
4. Customers receive status update notifications
5. Admin can view all status changes in audit trail

## Security Considerations

### Authentication Security
- **Password Requirements**: Minimum 8 characters, include numbers and letters
- **Session Management**: Secure session handling with timeout
- **Login Attempts**: Limit failed login attempts
- **Password Reset**: Secure password reset flow for clerks

### Data Access Control
- **API Security**: All endpoints validate user role
- **Database Security**: Role-based queries at database level
- **Frontend Security**: Hide restricted UI elements, but also validate server-side
- **Audit Trail**: Log all clerk actions for accountability

### Privacy Protection
- **Customer Data**: Clerks can view customer info but cannot export bulk data
- **Financial Data**: Clerks cannot access any financial information
- **System Settings**: Clerks cannot modify system configurations

## Success Criteria

### Functional Requirements
- [ ] Admin can create Clerk accounts with required fields
- [ ] Clerk accounts have restricted menu access
- [ ] Clerks cannot access dashboard, billing, or combined orders
- [ ] Clerks can access services, rental, inventory, walk-in, customers
- [ ] Clerks can change service statuses (Pending → In Progress → Completed)
- [ ] Role-based access control works on all pages
- [ ] Form validation works for clerk creation
- [ ] Admin can manage (edit/deactivate) clerk accounts
- [ ] Dashboard includes clerk management table below existing content
- [ ] Clerk creation modal opens from "Create New Clerk" button
- [ ] Modal has proper validation and error handling

### Security Requirements
- [ ] API endpoints properly validate user roles
- [ ] Frontend hides restricted navigation items
- [ ] Server-side validation prevents unauthorized access
- [ ] Audit trail logs all clerk actions
- [ ] Password security implemented

### UI/UX Requirements
- [ ] Clerk creation form is intuitive and user-friendly
- [ ] Navigation adapts based on user role
- [ ] Error messages are clear and helpful
- [ ] Loading states and feedback are appropriate
- [ ] Mobile responsive design works for clerk interface
- [ ] Modal overlay and close behavior works correctly
- [ ] Dashboard layout accommodates clerk table without breaking existing design

## Implementation Priority

### Phase 1: Backend Foundation
1. Update database schema with role and clerk fields
2. Implement role-based authentication middleware
3. Create clerk management API endpoints
4. Update existing endpoints with role validation

### Phase 2: Frontend Implementation
1. Update authentication context with role management
2. Implement role-based navigation component
3. Create clerk management UI components
4. Add route protection to all admin pages

### Phase 3: Testing & Security
1. Implement form validation and security measures
2. Add audit trail logging
3. Test all role-based access scenarios
4. Security testing and penetration testing

### Phase 4: Deployment & Training
1. Deploy role-based system
2. Create documentation for Admin users
3. Test clerk account creation and login
4. Train Admin users on clerk management

## Notes and Considerations

### Database Migration
- Ensure existing admin users maintain their admin role
- Handle null values for new clerk profile fields
- Create database indexes for role-based queries

### Email Notifications
- Send welcome emails to new clerks with login instructions
- Notify admins when clerks are created/deactivated
- Include role information in email templates

### Future Enhancements
- Add more granular permissions (e.g., Clerk can view but not edit certain data)
- Implement permission groups for different clerk types
- Add clerk activity reporting for Admin oversight
- Implement clerk shift scheduling or time tracking

## Testing Checklist

### Manual Testing
- [ ] Test Admin creates Clerk account with all required fields
- [ ] Test Clerk login and restricted menu access
- [ ] Test Clerk cannot access dashboard/billing/combined orders
- [ ] Test Clerk can access services/rental/inventory/walkin/customers
- [ ] Test Clerk can change service statuses
- [ ] Test Admin can edit/deactivate Clerk accounts
- [ ] Test form validation for invalid inputs
- [ ] Test role-based API endpoint security
- [ ] Test audit trail logging
- [ ] Test Dashboard clerk management table displays correctly
- [ ] Test "Create New Clerk" button opens modal
- [ ] Test modal validation and error handling
- [ ] Test modal close on X button, outside click, and cancel
- [ ] Test successful clerk creation updates table

### Automated Testing
- [ ] Unit tests for role-based middleware
- [ ] Integration tests for clerk management APIs
- [ ] Frontend component tests for role-based UI
- [ ] Security tests for unauthorized access attempts

## Browser Compatibility
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)
