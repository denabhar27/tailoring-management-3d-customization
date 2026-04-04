import React, { useState, useEffect } from 'react';

import '../adminStyle/dryclean.css';

import AdminHeader from './AdminHeader';

import Sidebar from './Sidebar';

import { getAllCustomers, updateCustomer, updateCustomerStatus, getCustomerById, getMeasurements, saveMeasurements } from '../api/CustomerApi';

import { getUserRole } from '../api/AuthApi';

import { useAlert } from '../context/AlertContext';

const CustomerList = () => {

  const { alert, confirm } = useAlert();

  const [customers, setCustomers] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');

  const [statusFilter, setStatusFilter] = useState('');

  const [customerTypeFilter, setCustomerTypeFilter] = useState('');

  const [showEditModal, setShowEditModal] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [editForm, setEditForm] = useState({

    first_name: '',

    middle_name: '',

    last_name: '',

    email: '',

    phone_number: '',

    status: 'active'

  });

  const [measurements, setMeasurements] = useState({

    top: {},

    bottom: {},

    notes: ''

  });

  const [measurementsLoading, setMeasurementsLoading] = useState(false);

  useEffect(() => {

    loadCustomers();

  }, []);

  const loadCustomers = async () => {

    try {

      setLoading(true);

      const result = await getAllCustomers();

      if (result.success) {

        setCustomers(result.customers || []);

      } else {

        setError(result.message || 'Failed to load customers');

      }

    } catch (err) {

      setError('Failed to load customers');

      console.error(err);

    } finally {

      setLoading(false);

    }

  };

  const handleEditCustomer = async (customer) => {
    console.log('handleEditCustomer called with customer:', customer);

    const isWalkIn = customer.customer_type === 'walk_in';

    const customerId = customer.customer_id || customer.user_id;
    console.log('isWalkIn:', isWalkIn, 'customerId:', customerId);

    const customerType = isWalkIn ? 'walk_in' : 'online';

    const result = await getCustomerById(customerId, customerType);
    console.log('getCustomerById result:', result);

    if (result.success) {

      setSelectedCustomer({ ...result.customer, customer_type: customerType });

      setEditForm({

        first_name: result.customer.first_name || result.customer.full_name || '',

        middle_name: result.customer.middle_name || '',

        last_name: result.customer.last_name || '',

        email: result.customer.email || '',

        phone_number: result.customer.phone_number || '',

        status: result.customer.status || 'active'

      });

      if (result.measurements) {

        setMeasurements({

          top: typeof result.measurements.top_measurements === 'string'

            ? JSON.parse(result.measurements.top_measurements)

            : result.measurements.top_measurements || {},

          bottom: typeof result.measurements.bottom_measurements === 'string'

            ? JSON.parse(result.measurements.bottom_measurements)

            : result.measurements.bottom_measurements || {},

          notes: result.measurements.notes || ''

        });

      } else {

        setMeasurementsLoading(true);

        const measResult = await getMeasurements(customerId, customerType);

        if (measResult.success && measResult.measurements) {

          setMeasurements({

            top: typeof measResult.measurements.top_measurements === 'string'

              ? JSON.parse(measResult.measurements.top_measurements)

              : measResult.measurements.top_measurements || {},

            bottom: typeof measResult.measurements.bottom_measurements === 'string'

              ? JSON.parse(measResult.measurements.bottom_measurements)

              : measResult.measurements.bottom_measurements || {},

            notes: measResult.measurements.notes || ''

          });

        } else {

          setMeasurements({ top: {}, bottom: {}, notes: '' });

        }

        setMeasurementsLoading(false);

      }

      setShowEditModal(true);

    } else {

      await alert(result.message || 'Failed to load customer details', 'Error', 'error');

    }

  };

  const handleSaveEdit = async () => {

    if (!selectedCustomer) return;

    try {

      const isWalkIn = selectedCustomer.customer_type === 'walk_in';
      const customerId = selectedCustomer.user_id || selectedCustomer.customer_id;

      // Include customer_type in the update request
      const updateData = {
        ...editForm,
        customer_type: isWalkIn ? 'walk_in' : 'online'
      };

      const result = await updateCustomer(customerId, updateData);

      if (result.success) {

        const hasMeasurements = Object.keys(measurements.top).length > 0 ||

                                Object.keys(measurements.bottom).length > 0 ||

                                measurements.notes.trim() !== '';

        if (hasMeasurements) {

          const customerName = isWalkIn
            ? selectedCustomer.full_name
            : `${selectedCustomer.first_name || ''} ${selectedCustomer.middle_name || ''} ${selectedCustomer.last_name || ''}`.replace(/\s+/g, ' ').trim() || editForm.first_name;

          const measurementsData = {
            ...measurements,
            isWalkIn: isWalkIn,
            customer_type: isWalkIn ? 'walk_in' : 'online',
            customer_name: customerName
          };

          const measResult = await saveMeasurements(customerId, measurementsData);

          if (!measResult.success) {

            console.error('Failed to save measurements:', measResult.message);

          }

        }

        await alert('Customer updated successfully!', 'Success', 'success');

        setShowEditModal(false);

        loadCustomers();

      } else {

        await alert(result.message || 'Failed to update customer', 'Error', 'error');

      }

    } catch (err) {

      await alert('Failed to update customer', 'Error', 'error');

      console.error(err);

    }

  };

  const handleStatusChange = async (customerId, newStatus) => {

    try {

      const result = await updateCustomerStatus(customerId, newStatus);

      if (result.success) {

        await alert('Customer status updated successfully!', 'Success', 'success');

        loadCustomers();

      } else {

        await alert(result.message || 'Failed to update status', 'Error', 'error');

      }

    } catch (err) {

      await alert('Failed to update status', 'Error', 'error');

      console.error(err);

    }

  };

  const getFilteredCustomers = () => {

    return customers.filter(customer => {

      const isWalkIn = customer.customer_type === 'walk_in';

      const fullName = isWalkIn

        ? (customer.full_name || customer.name || '').toLowerCase()

        : `${customer.first_name || ''} ${customer.middle_name || ''} ${customer.last_name || ''}`.replace(/\s+/g, ' ').toLowerCase();

      const matchesSearch =

        fullName.includes(searchTerm.toLowerCase()) ||

        customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||

        customer.phone_number?.includes(searchTerm);

      const matchesStatus = !statusFilter || customer.status === statusFilter;

      const matchesType = !customerTypeFilter || customer.customer_type === customerTypeFilter;

      return matchesSearch && matchesStatus && matchesType;

    });

  };

  const getStatusClass = (status) => {

    return status === 'active' ? 'accepted' : 'rejected';

  };

  const formatDate = (dateString) => {

    if (!dateString) return 'N/A';

    const date = new Date(dateString);

    return date.toLocaleDateString('en-US', {

      year: 'numeric',

      month: 'short',

      day: 'numeric'

    });

  };

  return (

    <div className="admin-page">

      <Sidebar />

      <AdminHeader />

      <div className="content">

        <div className="dashboard-title">

          <div>

            <h2>Customer List</h2>

            <p>Manage customer information and status</p>

          </div>

          {error && <div className="error-message" style={{ color: 'red', marginBottom: '20px' }}>{error}</div>}

        </div>
        <div className="search-container">

          <input

            type="text"

            placeholder="Search by name, email, or phone"

            value={searchTerm}

            onChange={(e) => setSearchTerm(e.target.value)}

          />

          <select value={customerTypeFilter} onChange={(e) => setCustomerTypeFilter(e.target.value)}>

            <option value="">All Customers</option>

            <option value="online">Online Customers</option>

            <option value="walk_in">Walk-in Customers</option>

          </select>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>

            <option value="">All Status</option>

            <option value="active">Active</option>

            <option value="inactive">Inactive</option>

          </select>

        </div>
        <div className="table-container">

          <div className="table-scroll-viewport" style={{ maxHeight: '500px' }}>
          <table>

            <thead>

              <tr>

                <th>Full Name</th>

                <th>Email</th>

                <th>Phone Number</th>

                <th>Total Orders</th>

                <th>Date Created</th>

                <th>Status</th>

                <th>Actions</th>

              </tr>

            </thead>

            <tbody>

              {loading ? (

                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>Loading customers...</td></tr>

              ) : getFilteredCustomers().length === 0 ? (

                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>No customers found</td></tr>

              ) : (

                getFilteredCustomers().map((customer, index) => {

                  const isWalkIn = customer.customer_type === 'walk_in';

                  const customerId = isWalkIn ? customer.customer_id : customer.user_id;

                  const fullName = isWalkIn ? customer.full_name : `${customer.first_name || ''} ${customer.middle_name || ''} ${customer.last_name || ''}`.replace(/\s+/g, ' ').trim();

                  const email = isWalkIn ? customer.email : customer.email;

                  const phone = isWalkIn ? customer.phone_number : customer.phone_number;

                  return (

                    <tr key={`${customer.customer_type}-${customerId || customer.user_id || index}`}>

                      <td>

                        <strong>{fullName || 'N/A'}</strong>

                        {isWalkIn && (

                          <span style={{

                            display: 'inline-block',

                            backgroundColor: '#ff9800',

                            color: 'white',

                            padding: '2px 8px',

                            borderRadius: '3px',

                            fontSize: '0.75em',

                            marginLeft: '8px',

                            fontWeight: 'bold'

                          }}>WALK-IN</span>

                        )}

                      </td>

                      <td>{email || 'N/A'}</td>

                      <td>{phone || 'N/A'}</td>

                      <td>{customer.total_orders || 0}</td>

                      <td>{formatDate(customer.created_at)}</td>

                      <td>

                        <span className={`status-badge ${getStatusClass(customer.status || 'active')}`}>

                          {(customer.status || 'active').charAt(0).toUpperCase() + (customer.status || 'active').slice(1)}

                        </span>

                      </td>

                      <td>

                        <div className="action-buttons">

                          <button className="icon-btn edit" onClick={(e) => { e.stopPropagation(); handleEditCustomer(customer); }} title="Edit">

                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">

                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>

                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>

                            </svg>

                          </button>

                          {(customer.status === 'active' || !customer.status || customer.status === null) ? (

                            <button

                              className="icon-btn decline"

                              onClick={async (e) => {

                                e.stopPropagation();

                                const customerName = isWalkIn ? fullName : `${customer.first_name || ''} ${customer.middle_name || ''} ${customer.last_name || ''}`.replace(/\s+/g, ' ').trim();

                                const confirmed = await confirm(`Are you sure you want to deactivate ${customerName}?`, 'Confirm Deactivation', 'warning');

                                if (confirmed) {

                                  if (!isWalkIn) {

                                    handleStatusChange(customer.customer_id || customer.user_id, 'inactive');

                                  } else {

                                    await alert('Walk-in customers cannot be deactivated this way', 'Info', 'info');

                                  }

                                }

                              }}

                              title="Deactivate"

                            >

                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">

                                <line x1="18" y1="6" x2="6" y2="18"></line>

                                <line x1="6" y1="6" x2="18" y2="18"></line>

                              </svg>

                            </button>

                          ) : (

                            <button

                              className="icon-btn accept"

                              onClick={async (e) => {

                                e.stopPropagation();

                                const customerName = isWalkIn ? fullName : `${customer.first_name || ''} ${customer.middle_name || ''} ${customer.last_name || ''}`.replace(/\s+/g, ' ').trim();

                                const confirmed = await confirm(`Are you sure you want to activate ${customerName}?`, 'Confirm Activation', 'warning');

                                if (confirmed) {

                                  if (!isWalkIn) {

                                    handleStatusChange(customer.customer_id || customer.user_id, 'active');

                                  } else {

                                    await alert('Walk-in customers cannot be activated this way', 'Info', 'info');

                                  }

                                }

                              }}

                              title="Activate"

                            >

                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">

                                <polyline points="20 6 9 17 4 12"></polyline>

                              </svg>

                            </button>

                          )}

                        </div>

                      </td>

                    </tr>

                  );

                })

              )}

            </tbody>

          </table>
          </div>

        </div>

      </div>
      {showEditModal && selectedCustomer && (

        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowEditModal(false)}>

          <div className="modal-content" style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>

            <div className="modal-header">

              <h2>Edit Customer</h2>

              <span className="close-modal" onClick={() => setShowEditModal(false)}>×</span>

            </div>

            <div className="modal-body">
  <div className="form-row-three-cols">

    <div className="form-group">

      <label>First Name *</label>

      <input

        type="text"

        value={editForm.first_name}

        onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}

        required

      />

    </div>

    <div className="form-group">

      <label>Middle Name</label>

      <input

        type="text"

        value={editForm.middle_name}

        onChange={(e) => setEditForm({ ...editForm, middle_name: e.target.value })}

      />

    </div>

    <div className="form-group">

      <label>Last Name *</label>

      <input

        type="text"

        value={editForm.last_name}

        onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}

        required

      />

    </div>

    <div className="form-group">

      <label>Email *</label>

      <input

        type="email"

        value={editForm.email}

        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}

        required

      />

    </div>

    <div className="form-group">

      <label>Phone Number *</label>

      <input

        type="text"

        value={editForm.phone_number || ''}

        onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}

        required

      />

    </div>

    <div className="form-group">

      <label>Status *</label>

      <select

        value={editForm.status}

        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}

        required

      >

        <option value="active">Active</option>

        <option value="inactive">Inactive</option>

      </select>

    </div>

  </div>
   <div style={{ marginTop: '5px', paddingTop: '10px', borderTop: '2px solid #eee' }}>
  <div style={{ display: 'flex', gap: '20px', marginTop: '15px' }}>
    <div style={{ flex: 1, padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
<p style={{ marginTop: 0, marginBottom: '15px', color: '#000', textAlign: 'left', fontWeight: '600', fontSize: '16px' }}>Top Measurements</p>      <div className="measurements-grid">
        <div className="measurement-field">
          <label style={{ display: 'block', textAlign: 'left', width: '100%' }}>Chest (inches)</label>
          <input
            type="number"
            step="0.1"
            value={measurements.top.chest || ''}
            onChange={(e) => setMeasurements({ ...measurements, top: { ...measurements.top, chest: e.target.value } })}
            placeholder="Enter chest measurement"
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'left' }}
          />
        </div>
        <div className="measurement-field">
          <label style={{ display: 'block', textAlign: 'left', width: '100%' }}>Shoulders (inches)</label>
          <input
            type="number"
            step="0.1"
            value={measurements.top.shoulders || ''}
            onChange={(e) => setMeasurements({ ...measurements, top: { ...measurements.top, shoulders: e.target.value } })}
            placeholder="Enter shoulder measurement"
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'left' }}
          />
        </div>
        <div className="measurement-field">
          <label style={{ display: 'block', textAlign: 'left', width: '100%' }}>Sleeve (inches)</label>
          <input
            type="number"
            step="0.1"
            value={measurements.top.sleeve_length || ''}
            onChange={(e) => setMeasurements({ ...measurements, top: { ...measurements.top, sleeve_length: e.target.value } })}
            placeholder="Enter sleeve length"
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'left' }}
          />
        </div>
        <div className="measurement-field">
          <label style={{ display: 'block', textAlign: 'left', width: '100%' }}>Neck (inches)</label>
          <input
            type="number"
            step="0.1"
            value={measurements.top.neck || ''}
            onChange={(e) => setMeasurements({ ...measurements, top: { ...measurements.top, neck: e.target.value } })}
            placeholder="Enter neck measurement"
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'left' }}
          />
        </div>
        <div className="measurement-field">
          <label style={{ display: 'block', textAlign: 'left', width: '100%' }}>Waist (inches)</label>
          <input
            type="number"
            step="0.1"
            value={measurements.top.waist || ''}
            onChange={(e) => setMeasurements({ ...measurements, top: { ...measurements.top, waist: e.target.value } })}
            placeholder="Enter waist measurement"
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'left' }}
          />
        </div>
        <div className="measurement-field">
          <label style={{ display: 'block', textAlign: 'left', width: '100%' }}>Length (inches)</label>
          <input
            type="number"
            step="0.1"
            value={measurements.top.length || ''}
            onChange={(e) => setMeasurements({ ...measurements, top: { ...measurements.top, length: e.target.value } })}
            placeholder="Enter length measurement"
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'left' }}
          />
        </div>
      </div>
    </div>
    <div style={{ flex: 1, padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
      <p style={{ marginTop: 0, marginBottom: '15px', color: '#000', textAlign: 'left', fontWeight: '600', fontSize: '16px', display: 'block', width: '100%' }}>Bottom Measurements</p>
      <div className="measurements-grid">
        <div className="measurement-field">
          <label style={{ display: 'block', textAlign: 'left', width: '100%' }}>Waist (inches)</label>
          <input
            type="number"
            step="0.1"
            value={measurements.bottom.waist || ''}
            onChange={(e) => setMeasurements({ ...measurements, bottom: { ...measurements.bottom, waist: e.target.value } })}
            placeholder="Enter waist measurement"
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'left' }}
          />
        </div>
        <div className="measurement-field">
          <label style={{ display: 'block', textAlign: 'left', width: '100%' }}>Hips (inches)</label>
          <input
            type="number"
            step="0.1"
            value={measurements.bottom.hips || ''}
            onChange={(e) => setMeasurements({ ...measurements, bottom: { ...measurements.bottom, hips: e.target.value } })}
            placeholder="Enter hip measurement"
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'left' }}
          />
        </div>
        <div className="measurement-field">
          <label style={{ display: 'block', textAlign: 'left', width: '100%' }}>Inseam (inches)</label>
          <input
            type="number"
            step="0.1"
            value={measurements.bottom.inseam || ''}
            onChange={(e) => setMeasurements({ ...measurements, bottom: { ...measurements.bottom, inseam: e.target.value } })}
            placeholder="Enter inseam measurement"
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'left' }}
          />
        </div>
        <div className="measurement-field">
          <label style={{ display: 'block', textAlign: 'left', width: '100%' }}>Length (inches)</label>
          <input
            type="number"
            step="0.1"
            value={measurements.bottom.length || ''}
            onChange={(e) => setMeasurements({ ...measurements, bottom: { ...measurements.bottom, length: e.target.value } })}
            placeholder="Enter length measurement"
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'left' }}
          />
        </div>
        <div className="measurement-field">
          <label style={{ display: 'block', textAlign: 'left', width: '100%' }}>Thigh (inches)</label>
          <input
            type="number"
            step="0.1"
            value={measurements.bottom.thigh || ''}
            onChange={(e) => setMeasurements({ ...measurements, bottom: { ...measurements.bottom, thigh: e.target.value } })}
            placeholder="Enter thigh measurement"
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'left' }}
          />
        </div>
        <div className="measurement-field">
          <label style={{ display: 'block', textAlign: 'left', width: '100%' }}>Outseam (inches)</label>
          <input
            type="number"
            step="0.1"
            value={measurements.bottom.outseam || ''}
            onChange={(e) => setMeasurements({ ...measurements, bottom: { ...measurements.bottom, outseam: e.target.value } })}
            placeholder="Enter outseam measurement"
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'left' }}
          />
        </div>
      </div>
    </div>
  </div>
  <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#fff3e0', borderRadius: '8px', border: '1px solid #ffcc80' }}>
    <label style={{ display: 'block', marginBottom: '10px', color: '#000', fontWeight: '600', fontSize: '16px', textAlign: 'left', width: '100%' }}>Notes</label>
    <textarea
      style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', textAlign: 'left' }}
      value={measurements.notes}
      onChange={(e) => setMeasurements({ ...measurements, notes: e.target.value })}
      placeholder="Add any additional notes about measurements..."
      rows={3}
    />
  </div>
</div>

            </div>

            <div className="modal-footer-centered">

              <button className="btn-cancel-list" onClick={() => setShowEditModal(false)}>Cancel</button>

              <button className="btn-save-list" onClick={handleSaveEdit}>Save</button>

            </div>

          </div>

        </div>

      )}

    </div>

  );

};

export default CustomerList;

