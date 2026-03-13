import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import '../adminStyle/admin.css';
import AdminHeader from './AdminHeader';
import { getAdminDashboardOverview } from '../api/AdminDashboardApi';
import { getAllTransactionLogs } from '../api/TransactionLogApi';
import { getBillingStats } from '../api/BillingApi';
import { format, subMonths } from 'date-fns';
import ClerkModal from './ClerkModal';
import ClerkTable from './ClerkTable';
import { getClerks, createClerk, deactivateClerk, updateClerk } from '../api/ClerkApi';
import './ClerkTable.css';
import { getUserRole } from '../api/AuthApi';

function AdminPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState([]);
  const [billingStats, setBillingStats] = useState({});
  const [recentActivities, setRecentActivities] = useState([]);
  const [allActivities, setAllActivities] = useState([]);
  const [allPayments, setAllPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [clerks, setClerks] = useState([]);
  const [clerkLoading, setClerkLoading] = useState(false);
  const [showClerkModal, setShowClerkModal] = useState(false);
  const [creatingClerk, setCreatingClerk] = useState(false);
  const [editingClerk, setEditingClerk] = useState(null);

  useEffect(() => {
    const role = getUserRole();
    if (role !== 'admin') {
      navigate('/customize', { replace: true });
    }
  }, [navigate]);

  const [serviceFilter, setServiceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState(format(subMonths(new Date(), 1), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError(null);
        const [data, billingData] = await Promise.all([
          getAdminDashboardOverview(),
          getBillingStats()
        ]);

        if (data?.success) {
          setStats(data.stats || []);
          setAllActivities(data.recentActivities || []);
          setRecentActivities(data.recentActivities || []);
        } else {
          setError(data.message || 'Failed to load dashboard data');
        }

        if (billingData?.success) {
          setBillingStats(billingData.stats || {});
        }
      } catch (err) {
        console.error('Error loading admin dashboard:', err);
        setError('An unexpected error occurred while loading dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  useEffect(() => {
    const fetchClerks = async () => {
      try {
        setClerkLoading(true);
        const res = await getClerks();
        if (res.success) {
          setClerks(res.clerks || []);
        }
      } catch (err) {
        console.error('Error loading clerks:', err);
      } finally {
        setClerkLoading(false);
      }
    };

    fetchClerks();
  }, []);

  useEffect(() => {
    const fetchAllPayments = async () => {
      if (statusFilter === 'payment') {
        try {
          setLoading(true);
          const result = await getAllTransactionLogs();
          if (result.success && result.logs) {

            const sortedLogs = [...result.logs].sort((a, b) => {
              if (a.order_item_id !== b.order_item_id) {
                return a.order_item_id - b.order_item_id;
              }
              return new Date(a.created_at) - new Date(b.created_at);
            });

            const cumulativeTotals = {};
            sortedLogs.forEach(tx => {
              const itemId = tx.order_item_id;
              if (!cumulativeTotals[itemId]) {
                cumulativeTotals[itemId] = 0;
              }
              cumulativeTotals[itemId] += parseFloat(tx.amount || 0);
            });

            const runningTotals = {};

            const paymentActivities = sortedLogs.map(tx => {
              const orderDate = tx.created_at instanceof Date
                ? tx.created_at
                : new Date(tx.created_at);

              const formatDate = (date) => {
                const d = date instanceof Date ? date : new Date(date);
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const hours = String(d.getHours()).padStart(2, '0');
                const minutes = String(d.getMinutes()).padStart(2, '0');
                return `${year}-${month}-${day} ${hours}:${minutes}`;
              };

              const mapService = (serviceType) => {
                const serviceMap = {
                  'rental': 'Rental',
                  'dry_cleaning': 'Dry Cleaning',
                  'dry-cleaning': 'Dry Cleaning',
                  'drycleaning': 'Dry Cleaning',
                  'repair': 'Repair',
                  'customization': 'Customization',
                  'customize': 'Customization'
                };
                return serviceMap[serviceType?.toLowerCase()] || serviceType || 'Other';
              };

              const customerName = `${tx.first_name || ''} ${tx.last_name || ''}`.trim() || 'Customer';
              const paymentAmount = parseFloat(tx.amount || 0);

              const itemId = tx.order_item_id;
              if (!runningTotals[itemId]) {
                runningTotals[itemId] = 0;
              }
              runningTotals[itemId] += paymentAmount;
              const totalPaid = runningTotals[itemId];

              const paymentMethod = tx.payment_method === 'system_auto' ? 'cash' : (tx.payment_method || 'cash');

              return {
                customer: customerName,
                service: mapService(tx.service_type),
                status: tx.new_payment_status || 'paid',
                statusText: tx.new_payment_status === 'paid' ? 'Paid' :
                           tx.new_payment_status === 'fully_paid' ? 'Fully Paid' :
                           tx.new_payment_status === 'down-payment' ? 'Down Payment' :
                           tx.new_payment_status === 'partial_payment' ? 'Partial Payment' : 'Payment',
                time: formatDate(orderDate),
                reason: null,
                actionType: 'payment',
                actionBy: tx.created_by || 'admin',
                notes: `Admin recorded payment of ₱${paymentAmount.toFixed(2)}. Total paid: ₱${totalPaid.toFixed(2)}. Customer: ${customerName}`,
                isPayment: true,
                paymentInfo: {
                  amount: paymentAmount,
                  payment_method: paymentMethod,
                  payment_status: tx.new_payment_status || 'paid',
                  total_paid: totalPaid
                }
              };
            });

            paymentActivities.sort((a, b) => new Date(b.time) - new Date(a.time));

            setAllPayments(paymentActivities);
          }
        } catch (err) {
          console.error('Error fetching all payments:', err);
          setError('Failed to load payment history');
        } finally {
          setLoading(false);
        }
      } else {

        setRecentActivities(allActivities);
        setAllPayments([]);
        setPaymentStatusFilter('all');
      }
    };

    fetchAllPayments();
  }, [statusFilter, allActivities]);

  useEffect(() => {
    if (statusFilter === 'payment' && allPayments.length > 0) {
      let filtered = [...allPayments];

      if (serviceFilter !== 'all') {
        filtered = filtered.filter(activity => {
          const service = activity.service?.toLowerCase() || '';
          const filter = serviceFilter.toLowerCase();
          return service.includes(filter) ||
                 (filter === 'dry' && service.includes('dry')) ||
                 (filter === 'dry_cleaning' && service.includes('dry')) ||
                 (filter === 'custom' && (service.includes('custom') || service.includes('customize')));
        });
      }

      if (paymentStatusFilter !== 'all') {
        filtered = filtered.filter(activity => {
          const paymentStatus = activity.paymentInfo?.payment_status || activity.status || '';
          const normalizedStatus = paymentStatus.toLowerCase().replace(/-/g, '_');
          const filter = paymentStatusFilter.toLowerCase().replace(/-/g, '_');

          if (filter === 'paid') {
            return normalizedStatus === 'paid' || normalizedStatus === 'fully_paid';
          } else if (filter === 'down_payment') {
            return normalizedStatus === 'down_payment' || normalizedStatus === 'downpayment' || normalizedStatus === 'down-payment';
          } else if (filter === 'partial_payment') {
            return normalizedStatus === 'partial_payment' || normalizedStatus === 'partialpayment' || normalizedStatus === 'partial-payment';
          }
          return false;
        });
      }

      setRecentActivities(filtered);
    } else if (statusFilter === 'payment' && allPayments.length === 0) {

      setRecentActivities([]);
    }
  }, [paymentStatusFilter, statusFilter, allPayments, serviceFilter]);

  useEffect(() => {
    if (statusFilter === 'payment') {

      return;
    }

    let filtered = [...allActivities];

    if (serviceFilter !== 'all') {
      filtered = filtered.filter(activity => {
        const service = activity.service?.toLowerCase() || '';
        const filter = serviceFilter.toLowerCase();
        return service.includes(filter) ||
               (filter === 'dry' && service.includes('dry')) ||
               (filter === 'custom' && (service.includes('custom') || service.includes('customize')));
      });
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(activity => {
        const status = activity.status?.toLowerCase() || '';
        const statusText = activity.statusText?.toLowerCase() || '';
        const filter = statusFilter.toLowerCase();
        return status === filter || statusText.includes(filter);
      });
    }

    if (startDate || endDate) {
      filtered = filtered.filter(activity => {
        const timeStr = activity.time || '';
        if (!timeStr) return true;

        try {
          const activityDate = new Date(timeStr);
          const activityDateOnly = new Date(activityDate.getFullYear(), activityDate.getMonth(), activityDate.getDate());

          if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            return activityDateOnly >= start && activityDateOnly <= end;
          } else if (startDate) {
            const start = new Date(startDate);
            return activityDateOnly >= start;
          } else if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            return activityDateOnly <= end;
          }
        } catch (e) {
          console.error('Error parsing date:', timeStr, e);
        }
        return true;
      });
    }

    setRecentActivities(filtered);
  }, [serviceFilter, statusFilter, startDate, endDate, allActivities]);

  return (
    <div className="admin-page">
      <Sidebar />
      <AdminHeader />

      <div className="content">
        <div className="dashboard-title">
          <h2>Dashboard Overview</h2>
        </div>

        {error && (
          <div className="error-message">
            <p>Error: {error}</p>
          </div>
        )}

        <div className="stats-grid">
          {loading && stats.length === 0 ? (
            <div className="stat-card">
              <h3>Loading dashboard...</h3>
            </div>
          ) : (
            <>
              {stats.map((stat, index) => {

                const getIconAndColor = (title) => {
                  switch(title?.toLowerCase()) {
                    case 'total orders':
                    case 'orders':
                      return { icon: 'fa-solid fa-box', color: '#e3f2fd', textColor: '#2196f3' };
                    case 'pending':
                    case 'pending orders':
                      return { icon: 'fa-solid fa-clock', color: '#fff3e0', textColor: '#ff9800' };
                    case 'in progress':
                    case 'in-progress':
                      return { icon: 'fa-solid fa-spinner', color: '#e8f5e9', textColor: '#4caf50' };
                    case 'completed':
                    case 'completed orders':
                      return { icon: 'fa-solid fa-circle-check', color: '#e8f5e9', textColor: '#4caf50' };
                    case 'customers':
                      return { icon: 'fa-solid fa-users', color: '#f3e5f5', textColor: '#9c27b0' };
                    case 'monthly revenue':
                      return { icon: 'fa-solid fa-peso-sign', color: '#e8f5e9', textColor: '#4caf50' };
                    case 'repair':
                      return { icon: 'fa-solid fa-screwdriver-wrench', color: '#ffebee', textColor: '#f44336' };
                    case 'dry cleaning':
                    case 'dry clean':
                      return { icon: 'fa-solid fa-jug-detergent', color: '#e3f2fd', textColor: '#2196f3' };
                    case 'customization':
                    case 'custom':
                      return { icon: 'fa-solid fa-palette', color: '#fff3e0', textColor: '#ff9800' };
                    case 'rental':
                      return { icon: 'fa-solid fa-shirt', color: '#f3e5f5', textColor: '#9c27b0' };
                    default:
                      return { icon: 'fa-solid fa-chart-simple', color: '#f5f5f5', textColor: '#666' };
                  }
                };

                const { icon, color, textColor } = getIconAndColor(stat.title);

                return (
                  <div className="stat-card" key={index}>
                    <div className="stat-header">
                      <span>{stat.title}</span>
                      <div className="stat-icon" style={{ background: color, color: textColor }}>
                        <i className={icon}></i>
                      </div>
                    </div>
                    <div className="stat-number">{stat.number}</div>
                    {stat.info && <small>{stat.info}</small>}
                  </div>
                );
              })}

              <div className="stat-card">
                <div className="stat-header">
                  <span>Total Revenue</span>
                  <div className="stat-icon" style={{ background: '#e8f5e9', color: '#4caf50' }}>
                    <i className="fa-solid fa-peso-sign"></i>
                  </div>
                </div>
                <div className="stat-number" style={{ fontSize: '28px' }}>
                  ₱{(billingStats.totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              {/* Pending Revenue Container */}
              <div className="stat-card">
                <div className="stat-header">
                  <span>Pending</span>
                  <div className="stat-icon" style={{ background: '#fff3e0', color: '#ff9800' }}>
                    <i className="fa-solid fa-hourglass-half"></i>
                  </div>
                </div>
                <div className="stat-number" style={{ fontSize: '28px' }}>
                  ₱{(billingStats.pendingRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="filter-dropdowns">
          <div className="filter-dropdown">
            <label>Service:</label>
            <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} className="filter-select">
              <option value="all">All Services</option>
              <option value="repair">Repair</option>
              <option value="dry">Dry Clean</option>
              <option value="custom">Custom</option>
              <option value="rental">Rental</option>
            </select>
          </div>

          <div className="filter-dropdown">
            <label>Status:</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select">
              <option value="all">All Status</option>
              <option value="payment">Paid</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="filter-dropdown date-range-filter">
            <label>Date:</label>
            <div className="date-range-inputs">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="date-input"
              />
              <span className="date-separator">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="date-input"
              />
            </div>
          </div>
          {statusFilter === 'payment' && (
            <div className="filter-dropdown">
              <label>Payment:</label>
              <select value={paymentStatusFilter} onChange={(e) => setPaymentStatusFilter(e.target.value)} className="filter-select">
                <option value="all">All Payments</option>
                <option value="paid">Paid</option>
              <option value="down-payment">Down Payment</option>
                <option value="partial-payment">Partial Payment</option>
              </select>
            </div>
          )}

          {(serviceFilter !== 'all' || statusFilter !== 'all' || startDate || endDate || paymentStatusFilter !== 'all') && (
            <button className="clear-btn-dropdown" onClick={() => {
              setServiceFilter('all');
              setStatusFilter('all');
              setStartDate('');
              setEndDate('');
              setPaymentStatusFilter('all');
            }}>Clear Filters</button>
          )}
        </div>

        <div className="recent-activity">
          <table className="activity-table">
            <thead>
              <tr className="tr-activity">
                <th>Customer</th>
                <th>Type of Service</th>
                <th>Status / Payment</th>
                <th>Details / Payment Record</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="loading-cell">
                    Loading recent activities...
                  </td>
                </tr>
              ) : recentActivities.length > 0 ? (
                recentActivities.map((activity, index) => (
                  <tr key={index}>
                    <td className="customer">{activity.customer}</td>
                    <td>{activity.service}</td>
                    <td>
                      {activity.isPayment ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span className={`status ${activity.paymentInfo?.payment_status || activity.status}`} style={{
                            backgroundColor: activity.paymentInfo?.payment_status === 'paid' || activity.paymentInfo?.payment_status === 'fully_paid'
                              ? '#d4edda'
                              : activity.paymentInfo?.payment_status === 'down-payment'
                              ? '#fff3cd'
                              : '#f8d7da',
                            color: activity.paymentInfo?.payment_status === 'paid' || activity.paymentInfo?.payment_status === 'fully_paid'
                              ? '#155724'
                              : activity.paymentInfo?.payment_status === 'down-payment'
                              ? '#856404'
                              : '#721c24',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            Payment: {activity.paymentInfo?.payment_status === 'paid' ? 'Paid' :
                                         activity.paymentInfo?.payment_status === 'fully_paid' ? 'Fully Paid' :
                                         activity.paymentInfo?.payment_status === 'down-payment' ? 'Down Payment' :
                                         activity.paymentInfo?.payment_status === 'partial_payment' ? 'Partial Payment' :
                                         activity.paymentInfo?.payment_status || 'Payment'}
                          </span>
                          {activity.paymentInfo?.amount && (
                            <span style={{ fontSize: '11px', color: '#28a745', fontWeight: 'bold' }}>
                              Amount: ₱{parseFloat(activity.paymentInfo.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className={`status ${activity.status}`}>
                          {activity.statusText}
                        </span>
                      )}
                    </td>
                    <td style={{
                      color: activity.reason || activity.notes ? '#666' : '#999',
                      fontStyle: activity.reason || activity.notes ? 'normal' : 'italic',
                      maxWidth: '200px',
                      wordWrap: 'break-word',
                      fontSize: activity.isPayment ? '12px' : '14px'
                    }}>
                      {activity.isPayment ? (
                        <div>
                          {activity.notes && (
                            <div style={{ marginBottom: '4px' }}>{activity.notes}</div>
                          )}
                          {activity.paymentInfo?.payment_method && (
                            <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                              Method: {activity.paymentInfo.payment_method === 'system_auto' ? 'cash' : activity.paymentInfo.payment_method}
                            </div>
                          )}
                        </div>
                      ) : (
                        activity.reason || activity.notes || '-'
                      )}
                    </td>
                    <td>{activity.time}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="no-data-cell">
                    No recent activities found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="clerk-management">
          <div className="clerk-table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0 }}>Clerk Accounts Management</h2>
              <p className="clerk-subtitle" style={{ margin: 0 }}>Clerks have operational access only. Billing and analytics are hidden.</p>
            </div>
            <button className="btn-primary-shared" onClick={() => setShowClerkModal(true)}>Create New Clerk</button>
          </div>
          <ClerkTable
            clerks={clerks}
            onDeactivate={async (clerk) => {
              const res = await deactivateClerk(clerk.user_id || clerk.id);
              if (res.success) {
                setClerks((prev) => prev.map((c) => (c.user_id === (clerk.user_id || clerk.id) ? { ...c, status: 'inactive' } : c)));
              } else {
                window.alert(res.message || 'Failed to update clerk');
              }
            }}
            onEdit={(clerk) => {
              setEditingClerk(clerk);
              setShowClerkModal(true);
            }}
          />
          {clerkLoading && <p style={{ padding: '12px 16px' }}>Loading clerks...</p>}
        </div>
      </div>

      <ClerkModal
        isOpen={showClerkModal}
        onClose={() => {
          setShowClerkModal(false);
          setEditingClerk(null);
        }}
        submitting={creatingClerk}
        initialData={editingClerk}
        mode={editingClerk ? 'edit' : 'create'}
        onSubmit={async (payload) => {
          setCreatingClerk(true);
          if (editingClerk) {
            const res = await updateClerk(editingClerk.user_id || editingClerk.id, payload);
            setCreatingClerk(false);
            if (res.success) {
              setClerks((prev) => prev.map((c) => (c.user_id === (editingClerk.user_id || editingClerk.id) ? { ...c, ...payload, status: c.status } : c)));
              setShowClerkModal(false);
              setEditingClerk(null);
            } else {
              window.alert(res.message || 'Failed to update clerk');
            }
          } else {
            const res = await createClerk(payload);
            setCreatingClerk(false);
            if (res.success) {
              setClerks((prev) => [res.clerk, ...prev]);
              setShowClerkModal(false);
            } else {
              window.alert(res.message || 'Failed to create clerk');
            }
          }
        }}
      />
    </div>
  );
}

export default AdminPage;