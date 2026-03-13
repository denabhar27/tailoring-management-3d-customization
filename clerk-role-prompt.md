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
```sql
-- Add role column to users table if not exists
ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'admin';

-- Add additional clerk profile fields
ALTER TABLE users ADD COLUMN first_name VARCHAR(100);
ALTER TABLE users ADD COLUMN last_name VARCHAR(100);
ALTER TABLE users ADD COLUMN middle_name VARCHAR(100) NULL;
ALTER TABLE users ADD COLUMN phone_number VARCHAR(20);
```

#### API Endpoints
```javascript
// Clerk Management (Admin only)
POST   /api/admin/clerks              // Create new clerk
GET    /api/admin/clerks              // List all clerks
PUT    /api/admin/clerks/:id          // Update clerk info
DELETE /api/admin/clerks/:id          // Deactivate clerk
POST   /api/admin/clerks/:id/reset-password // Reset clerk password

// Authentication with role checking
POST   /api/auth/login                // Login with role response
GET    /api/auth/profile              // Get user profile with role
```

#### Middleware for Role-Based Access
```javascript
// Role-based access middleware
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
};

// Usage examples
app.get('/api/admin/dashboard', requireRole(['admin']), dashboardController);
app.get('/api/billing', requireRole(['admin']), billingController);
app.get('/api/services', requireRole(['admin', 'clerk']), serviceController);
```

#### User Model Updates
```javascript
// User model with role and clerk fields
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'clerk'], default: 'admin' },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  middleName: { type: String },
  phoneNumber: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});
```

### Frontend (React/Next.js)

#### Authentication Context Updates
```javascript
// Auth context with role management
const AuthContext = createContext({
  user: null,
  role: null,
  login: async (credentials) => { /* ... */ },
  logout: () => { /* ... */ },
  hasPermission: (permission) => { /* ... */ }
});

// Permission checking utility
const usePermissions = () => {
  const { role } = useContext(AuthContext);
  
  const canAccess = (resource) => {
    const permissions = {
      admin: ['dashboard', 'billing', 'orders-inventory', 'services', 'rental', 'inventory', 'walkin', 'customers', 'users'],
      clerk: ['services', 'rental', 'inventory', 'walkin', 'customers']
    };
    
    return permissions[role]?.includes(resource) || false;
  };
  
  return { canAccess };
};
```

#### Navigation Component with Role-Based Rendering
```jsx
// Navigation component
const Navigation = () => {
  const { role } = useAuth();
  const { canAccess } = usePermissions();
  
  const menuItems = [
    { path: '/admin/dashboard', label: 'Dashboard', permission: 'dashboard' },
    { path: '/admin/billing', label: 'Billing', permission: 'billing' },
    { path: '/admin/orders-inventory', label: 'Orders & Inventory', permission: 'orders-inventory' },
    { path: '/admin/services', label: 'Service Management', permission: 'services' },
    { path: '/admin/rental', label: 'Post Rental', permission: 'rental' },
    { path: '/admin/inventory', label: 'Inventory', permission: 'inventory' },
    { path: '/admin/walkin', label: 'Walk-in Orders', permission: 'walkin' },
    { path: '/admin/customers', label: 'Customer Lists', permission: 'customers' },
    { path: '/admin/users', label: 'User Management', permission: 'users' }
  ];
  
  return (
    <nav>
      {menuItems.filter(item => canAccess(item.permission)).map(item => (
        <NavLink key={item.path} to={item.path}>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
};
```

#### Dashboard Component Updates
```jsx
// Enhanced Admin Dashboard with Clerk Management
const AdminDashboard = () => {
  const [showClerkModal, setShowClerkModal] = useState(false);
  const [clerks, setClerks] = useState([]);
  
  return (
    <div className="admin-dashboard">
      {/* Existing Analytics Cards */}
      <AnalyticsCards />
      
      {/* Existing Dashboard Tables */}
      <DashboardTables />
      
      {/* New Clerk Management Section */}
      <div className="clerk-management-section">
        <div className="section-header">
          <h2>Clerk Accounts Management</h2>
          <button 
            className="create-clerk-btn"
            onClick={() => setShowClerkModal(true)}
          >
            Create New Clerk
          </button>
        </div>
        
        <ClerkManagementTable clerks={clerks} setClerks={setClerks} />
        
        {showClerkModal && (
          <ClerkCreationModal 
            onClose={() => setShowClerkModal(false)}
            onSuccess={(newClerk) => {
              setClerks([...clerks, newClerk]);
              setShowClerkModal(false);
            }}
          />
        )}
      </div>
    </div>
  );
};

// Clerk Management Table Component
const ClerkManagementTable = ({ clerks, setClerks }) => {
  const handleDeactivate = async (clerkId) => {
    try {
      await api.put(`/api/admin/clerks/${clerkId}`, { isActive: false });
      setClerks(clerks.map(c => c.id === clerkId ? {...c, isActive: false} : c));
    } catch (error) {
      // Handle error
    }
  };
  
  return (
    <div className="clerk-table-container">
      <table className="clerk-management-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Full Name</th>
            <th>Email</th>
            <th>Phone Number</th>
            <th>Status</th>
            <th>Created Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {clerks.map(clerk => (
            <tr key={clerk.id}>
              <td>{clerk.id}</td>
              <td>
                {clerk.firstName} {clerk.middleName && `${clerk.middleName} `}{clerk.lastName}
              </td>
              <td>{clerk.email}</td>
              <td>{clerk.phoneNumber}</td>
              <td>
                <span className={`status-badge ${clerk.isActive ? 'active' : 'inactive'}`}>
                  {clerk.isActive ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td>{new Date(clerk.createdAt).toLocaleDateString()}</td>
              <td>
                <button className="edit-btn">Edit</button>
                <button 
                  className="deactivate-btn"
                  onClick={() => handleDeactivate(clerk.id)}
                >
                  {clerk.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button className="reset-btn">Reset Password</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Clerk Creation Modal Component
const ClerkCreationModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    middleName: '',
    email: '',
    phoneNumber: ''
  });
  const [errors, setErrors] = useState({});
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    const newErrors = {};
    if (!formData.firstName) newErrors.firstName = 'First name is required';
    if (!formData.lastName) newErrors.lastName = 'Last name is required';
    if (!formData.email) newErrors.email = 'Email is required';
    if (!formData.phoneNumber) newErrors.phoneNumber = 'Phone number is required';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    try {
      const response = await api.post('/api/admin/clerks', formData);
      onSuccess(response.data);
      setFormData({ firstName: '', lastName: '', middleName: '', email: '', phoneNumber: '' });
    } catch (error) {
      setErrors({ submit: error.response?.data?.message || 'Failed to create clerk' });
    }
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="clerk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Create New Clerk Account</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="clerk-form">
          <div className="form-row">
            <div className="form-group">
              <label>First Name *</label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                className={errors.firstName ? 'error' : ''}
              />
              {errors.firstName && <span className="error-message">{errors.firstName}</span>}
            </div>
            
            <div className="form-group">
              <label>Last Name *</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                className={errors.lastName ? 'error' : ''}
              />
              {errors.lastName && <span className="error-message">{errors.lastName}</span>}
            </div>
          </div>
          
          <div className="form-group">
            <label>Middle Name (Optional)</label>
            <input
              type="text"
              value={formData.middleName}
              onChange={(e) => setFormData({...formData, middleName: e.target.value})}
            />
          </div>
          
          <div className="form-group">
            <label>Email *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className={errors.email ? 'error' : ''}
            />
            {errors.email && <span className="error-message">{errors.email}</span>}
          </div>
          
          <div className="form-group">
            <label>Phone Number *</label>
            <input
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
              className={errors.phoneNumber ? 'error' : ''}
            />
            {errors.phoneNumber && <span className="error-message">{errors.phoneNumber}</span>}
          </div>
          
          {errors.submit && <div className="error-message">{errors.submit}</div>}
          
          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="submit-btn">Create Clerk</button>
          </div>
        </form>
      </div>
    </div>
  );
};
```

#### Route Protection
```jsx
// Protected route component
const ProtectedRoute = ({ children, requiredPermission }) => {
  const { canAccess } = usePermissions();
  
  if (!canAccess(requiredPermission)) {
    return <div>Access Denied</div>;
  }
  
  return children;
};

// Route configuration
const AppRoutes = () => (
  <Routes>
    <Route path="/admin/dashboard" element={
      <ProtectedRoute requiredPermission="dashboard">
        <Dashboard />
      </ProtectedRoute>
    } />
    <Route path="/admin/billing" element={
      <ProtectedRoute requiredPermission="billing">
        <Billing />
      </ProtectedRoute>
    } />
    <Route path="/admin/services" element={
      <ProtectedRoute requiredPermission="services">
        <ServiceManagement />
      </ProtectedRoute>
    } />
    {/* Other routes with protection */}
  </Routes>
);
```

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

### Testing Checklist

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
