import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import '../adminStyle/admin.css';
import AdminHeader from './AdminHeader';
import { getAdminDashboardOverview } from '../api/AdminDashboardApi';
import { getAllTransactionLogs } from '../api/TransactionLogApi';
import { getBillingStats } from '../api/BillingApi';
import AnalyticsDashboard from '../components/analytics/AnalyticsDashboard';
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

  useEffect(() => {
    const role = getUserRole();
    if (role !== 'admin') {
      navigate('/customize', { replace: true });
    }
  }, [navigate]);

  const [serviceFilter, setServiceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');

  const normalizeFilterValue = (value) => String(value || '').toLowerCase().replace(/[_\s-]/g, '');

  const isToday = (dateStr) => {
    if (!dateStr) return false;
    try {
      const today = new Date();
      const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const raw = String(dateStr).trim();
      const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
      if (match?.[1]) return match[1] === todayKey;

      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) return false;
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return dateKey === todayKey;
    } catch (e) {
      return false;
    }
  };

  const parseMaybeJson = (value) => {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  };

  const getEstimatedDateFromActivity = (activity) => {
    const pricingFactors = parseMaybeJson(activity?.pricingFactors);
    const specificData = parseMaybeJson(activity?.specificData);
    return (
      pricingFactors?.estimatedCompletionDate ||
      pricingFactors?.estimated_completion_date ||
      specificData?.estimatedCompletionDate ||
      specificData?.estimated_completion_date ||
      null
    );
  };

  const getComputedStatus = (activity) => {
    const service = (activity?.service || '').toLowerCase();
    const isRental = service.includes('rental');
    const isAppointment = service.includes('dry') || service.includes('repair') || service.includes('custom');
    const specificData = parseMaybeJson(activity?.specificData);

    const appointmentDate =
      activity?.appointmentDate ||
      specificData?.appointment_date ||
      specificData?.appointmentDate ||
      specificData?.pickupDate ||
      specificData?.preferredDate ||
      specificData?.date;

    if (isRental && activity?.rentalStartDate && isToday(activity.rentalStartDate)) {
      return 'appointment-today';
    }
    if (isRental && activity?.rentalEndDate && isToday(activity.rentalEndDate)) {
      return 'due-today';
    }
    if (isAppointment && appointmentDate && isToday(appointmentDate)) {
      return 'appointment-today';
    }
    if (isAppointment) {
      const estimatedDate = getEstimatedDateFromActivity(activity);
      if (estimatedDate && isToday(estimatedDate)) {
        return 'estimated-today';
      }
    }
    return null;
  };

  const isAcceptedOrderActivity = (activity) => {
    const status = normalizeFilterValue(activity?.status);
    const statusText = normalizeFilterValue(activity?.statusText);
    const actionType = activity?.actionType || activity?.action_type || '';
    if (actionType === 'price_change') return true;
    return Boolean(status || statusText);
  };

  const extractPaymentMetaFromNotes = (notes = '') => {
    const text = String(notes || '');
    const handledByMatch = text.match(/^([^\n.]+?)\s+recorded payment/i);
    const customerMatch = text.match(/Customer:\s*([^\n.]+?)(?:\.|\n|\s+Method:|$)/i);
    const cashMatch = text.match(/Cash\s*received:\s*₱([\d,]+\.?\d*)/i);
    const changeMatch = text.match(/Change:\s*₱([\d,]+\.?\d*)/i);

    return {
      handledBy: handledByMatch?.[1]?.trim() || null,
      customerName: customerMatch?.[1]?.trim() || null,
      cashReceived: cashMatch ? parseFloat(cashMatch[1].replace(/,/g, '')) : null,
      changeAmount: changeMatch ? parseFloat(changeMatch[1].replace(/,/g, '')) : null
    };
  };

  const formatStatusDetails = (activity) => {
    const raw = String(activity?.reason || activity?.notes || '').trim();
    if (!raw) return ['-'];

    const lines = raw
      .replace(/\s+\|\s+/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const normalizedLines = [];
    let extractedActor = null;

    lines.forEach((line) => {
      const bySuffixMatch = line.match(/\s*\(by\s+([^\)]+)\)\s*$/i);
      if (bySuffixMatch?.[1]) {
        const cleanedLine = line.replace(/\s*\(by\s+([^\)]+)\)\s*$/i, '').trim();
        if (cleanedLine) normalizedLines.push(cleanedLine);
        extractedActor = extractedActor || bySuffixMatch[1].trim();
      } else {
        normalizedLines.push(line);
      }
    });

    const hasCustomerLine = normalizedLines.some((line) => /^customer\s*:/i.test(line));
    if (activity?.customer && !hasCustomerLine) {
      normalizedLines.push(`Customer: ${activity.customer}`);
    }

    const hasActorLine = normalizedLines.some((line) => /^(changed|handled|updated|processed|recorded)\s+by\s*:/i.test(line));
    if (extractedActor && !hasActorLine) {
      normalizedLines.push(`Changed by: ${extractedActor}`);
    }

    return normalizedLines;
  };

  const extractActorFromNotes = (notes = '') => {
    const text = String(notes || '');
    const labeledMatch = text.match(/(?:Changed|Handled|Updated|Processed|Recorded)\s+by:\s*([^|.\n]+)/i);
    if (labeledMatch?.[1]) return labeledMatch[1].trim();

    const parentheticalMatch = text.match(/\(by\s+([^\)]+)\)/i);
    if (parentheticalMatch?.[1]) return parentheticalMatch[1].trim();

    return null;
  };

  const fetchDashboard = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
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
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard(false);

    const intervalId = setInterval(() => {
      fetchDashboard(true);
    }, 30000);

    const handleWindowFocus = () => fetchDashboard(true);
    const handleVisibilityChange = () => {
      if (!document.hidden) fetchDashboard(true);
    };

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchDashboard]);

  useEffect(() => {
    const fetchAllPayments = async () => {
      if (statusFilter === 'transaction') {
        try {
          setLoading(true);
          const result = await getAllTransactionLogs();
          if (result.success && Array.isArray(result.logs) && result.logs.length > 0) {

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
              const actionBy = tx.created_by || 'admin';
              const cashReceived = tx.cash_received !== null && tx.cash_received !== undefined
                ? parseFloat(tx.cash_received)
                : parseFloat((tx.notes?.match(/Cash received:\s*₱([\d,]+\.?\d*)/i)?.[1] || '0').replace(/,/g, ''));
              const changeAmount = tx.change_amount !== null && tx.change_amount !== undefined
                ? parseFloat(tx.change_amount)
                : parseFloat((tx.notes?.match(/Change:\s*₱([\d,]+\.?\d*)/i)?.[1] || '0').replace(/,/g, ''));

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
                actionBy,
                notes: `${actionBy} recorded payment of ₱${paymentAmount.toFixed(2)}. Total paid: ₱${totalPaid.toFixed(2)}. Customer: ${customerName}${cashReceived > 0 ? `. Cash received: ₱${cashReceived.toFixed(2)}.` : ''}${changeAmount > 0 ? ` Change: ₱${changeAmount.toFixed(2)}.` : ''}`,
                isPayment: true,
                paymentInfo: {
                  amount: paymentAmount,
                  payment_method: paymentMethod,
                  payment_status: tx.new_payment_status || 'paid',
                  total_paid: totalPaid,
                  cash_received: Number.isNaN(cashReceived) ? null : cashReceived,
                  change_amount: Number.isNaN(changeAmount) ? null : changeAmount
                }
              };
            });

            paymentActivities.sort((a, b) => new Date(b.time) - new Date(a.time));

            const fallbackPayments = (allActivities || []).filter((activity) => activity?.isPayment);
            const priceChangeActivities = (allActivities || []).filter((activity) => {
              const actionType = String(activity?.actionType || activity?.action_type || '').toLowerCase();
              return actionType === 'price_change';
            });
            const mergedPayments = [...paymentActivities, ...fallbackPayments, ...priceChangeActivities];
            const seen = new Set();
            const dedupedPayments = mergedPayments.filter((entry) => {
              const key = [
                entry.time || '',
                entry.customer || '',
                entry.service || '',
                Number(entry.paymentInfo?.amount || 0).toFixed(2),
                (entry.paymentInfo?.payment_status || entry.status || entry.actionType || entry.action_type || '').toLowerCase()
              ].join('|');
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
            dedupedPayments.sort((a, b) => new Date(b.time) - new Date(a.time));

            setAllPayments(dedupedPayments);
          } else {
            const fallbackPayments = (allActivities || []).filter((activity) => activity?.isPayment);
            setAllPayments(fallbackPayments);
          }
        } catch (err) {
          console.error('Error fetching all payments:', err);
          const fallbackPayments = (allActivities || []).filter((activity) => activity?.isPayment);
          setAllPayments(fallbackPayments);
          if (fallbackPayments.length === 0) {
            setError('Failed to load payment history');
          }
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
    if (statusFilter === 'transaction' && allPayments.length > 0) {
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
          } else if (filter === 'price_change') {
            return (activity.actionType || activity.action_type || '').toLowerCase() === 'price_change';
          }
          return false;
        });
      }

      setRecentActivities(filtered);
    } else if (statusFilter === 'transaction' && allPayments.length === 0) {

      setRecentActivities([]);
    }
  }, [paymentStatusFilter, statusFilter, allPayments, serviceFilter]);

  useEffect(() => {
    if (statusFilter === 'transaction') {

      return;
    }

    // For dashboard status filters, start from all activity statuses.
    let filtered = allActivities.filter((activity) => {
      if (activity?.isPayment) return true;
      if ((activity?.actionType || activity?.action_type) === 'price_change') return true;
      return isAcceptedOrderActivity(activity);
    });

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
          const computedStatus = getComputedStatus(activity);
          const computedStatusNormalized = normalizeFilterValue(computedStatus);
          const status = normalizeFilterValue(activity.status);
          const statusText = normalizeFilterValue(activity.statusText);
          const filter = normalizeFilterValue(statusFilter);
          return computedStatusNormalized === filter || status === filter || statusText.includes(filter);
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

        <AnalyticsDashboard />

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
              <option value="transaction">Transaction</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="due-today">Due Today</option>
              <option value="appointment-today">Appointment Today</option>
              <option value="estimated-today">Estimated Release Today</option>
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
          {statusFilter === 'transaction' && (
            <div className="filter-dropdown">
              <label>Payment:</label>
              <select value={paymentStatusFilter} onChange={(e) => setPaymentStatusFilter(e.target.value)} className="filter-select">
                <option value="all">All Payments</option>
                <option value="paid">Paid</option>
                <option value="down-payment">Down Payment</option>
                <option value="partial-payment">Partial Payment</option>
                <option value="price-change">Price Change</option>
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

        <div className="recent-activity scrollable">
          <table className="activity-table">
            <thead>
              <tr className="tr-activity">
                <th>Name</th>
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
                    {(() => {
                      const parsed = extractPaymentMetaFromNotes(activity.notes || '');
                      const actorName = activity.actionBy || activity.action_by || parsed.handledBy || extractActorFromNotes(activity.notes || '');
                      const displayCustomer = parsed.customerName || activity.customer;
                      const statusLines = formatStatusDetails({ ...activity, customer: displayCustomer });
                      const hasActorLine = statusLines.some((line) => /^(changed|handled|updated|processed|recorded)\s+by\s*:/i.test(line));
                      const cashReceived = activity.paymentInfo?.cash_received !== null && activity.paymentInfo?.cash_received !== undefined
                        ? parseFloat(activity.paymentInfo.cash_received)
                        : parsed.cashReceived;
                      const changeAmount = activity.paymentInfo?.change_amount !== null && activity.paymentInfo?.change_amount !== undefined
                        ? parseFloat(activity.paymentInfo.change_amount)
                        : parsed.changeAmount;

                      return (
                        <>
                    <td className="customer">{displayCustomer}</td>
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
                        </div>
                      ) : activity.actionType === 'price_change' ? (
                        <span style={{
                          backgroundColor: '#e3f2fd',
                          color: '#1976d2',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '600',
                          display: 'inline-block'
                        }}>
                          PRICE CHANGE
                        </span>
                      ) : (
                        <span className={`status ${activity.status}`}>
                          {(() => {
                            const computedStatus = getComputedStatus(activity);
                            if (computedStatus === 'due-today') return 'Due Today';
                            if (computedStatus === 'appointment-today') return 'Appointment Today';
                            if (computedStatus === 'estimated-today') return 'Estimated Release Today';
                            return activity.statusText;
                          })()}
                        </span>
                      )}
                    </td>
                    <td style={{
                      color: activity.reason || activity.notes ? '#666' : '#999',
                      fontStyle: activity.reason || activity.notes ? 'normal' : 'italic',
                      maxWidth: '240px',
                      wordWrap: 'break-word',
                      fontSize: activity.isPayment ? '11px' : '12px',
                      lineHeight: '1.35'
                    }}>
                      {activity.isPayment ? (
                        <div>
                          {actorName && (
                            <div style={{ marginBottom: '4px' }}>Changed by: {actorName}</div>
                          )}
                          {activity.paymentInfo?.amount !== undefined && activity.paymentInfo?.amount !== null && (
                            <div style={{ marginBottom: '4px' }}>
                              Payment: ₱{parseFloat(activity.paymentInfo.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          )}
                          {activity.paymentInfo?.total_paid !== undefined && activity.paymentInfo?.total_paid !== null && (
                            <div style={{ marginBottom: '4px' }}>
                              Total paid: ₱{parseFloat(activity.paymentInfo.total_paid).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          )}
                          {displayCustomer && (
                            <div style={{ marginBottom: '4px' }}>Customer: {displayCustomer}</div>
                          )}
                          {activity.paymentInfo?.cash_received !== null && activity.paymentInfo?.cash_received !== undefined && (
                            <div style={{ marginBottom: '4px' }}>
                              Cash received: ₱{parseFloat(activity.paymentInfo.cash_received).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          )}
                          {(activity.paymentInfo?.cash_received === null || activity.paymentInfo?.cash_received === undefined) && cashReceived !== null && !Number.isNaN(cashReceived) && (
                            <div style={{ marginBottom: '4px' }}>
                              Cash received: ₱{cashReceived.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          )}
                          {activity.paymentInfo?.change_amount !== null && activity.paymentInfo?.change_amount !== undefined && (
                            <div style={{ marginBottom: '4px' }}>
                              Change: ₱{parseFloat(activity.paymentInfo.change_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          )}
                          {(activity.paymentInfo?.change_amount === null || activity.paymentInfo?.change_amount === undefined) && changeAmount !== null && !Number.isNaN(changeAmount) && (
                            <div style={{ marginBottom: '4px' }}>
                              Change: ₱{changeAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          )}
                          {activity.paymentInfo?.payment_method && (
                            <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                              Method: {activity.paymentInfo.payment_method === 'system_auto' ? 'cash' : activity.paymentInfo.payment_method}
                            </div>
                          )}
                        </div>
                      ) : activity.actionType === 'price_change' ? (
                        <div>
                          {(() => {
                            const notes = activity.notes || '';
                            const priceMatch = notes.match(/Price Change:\s*₱([\d,]+\.?\d*)\s*→\s*₱([\d,]+\.?\d*)/);
                            const reasonMatch = notes.match(/Reason:\s*([^|]+)/);
                            const changedByMatch = notes.match(/Changed by:\s*([^|]+)/);
                            const customerMatch = notes.match(/Customer:\s*([^|]+)/);
                            const orderIdMatch = notes.match(/Order ID:\s*(ORD-\d+)/);
                            
                            return (
                              <>
                                {priceMatch && (
                                  <div style={{ marginBottom: '4px' }}>
                                    Price: ₱{priceMatch[1]} → ₱{priceMatch[2]}
                                  </div>
                                )}
                                {reasonMatch && (
                                  <div style={{ marginBottom: '4px' }}>
                                    Reason: {reasonMatch[1].trim()}
                                  </div>
                                )}
                                {changedByMatch && (
                                  <div style={{ marginBottom: '4px' }}>
                                    Changed by: {changedByMatch[1].trim()}
                                  </div>
                                )}
                                {!changedByMatch && actorName && (
                                  <div style={{ marginBottom: '4px' }}>
                                    Changed by: {actorName}
                                  </div>
                                )}
                                {customerMatch && (
                                  <div style={{ marginBottom: '4px' }}>
                                    Customer: {customerMatch[1].trim()}
                                  </div>
                                )}
                                {orderIdMatch && (
                                  <div style={{ marginBottom: '4px' }}>
                                    Order ID: {orderIdMatch[1]}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      ) : (
                        <div>
                          {actorName && !hasActorLine && (
                            <div style={{ marginBottom: '4px' }}>
                              Changed by: {actorName}
                            </div>
                          )}
                          {statusLines.map((line, lineIndex) => (
                            <div key={`${index}-${lineIndex}`} style={{ marginBottom: lineIndex < statusLines.length - 1 ? '4px' : 0 }}>
                              {line}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>{activity.time}</td>
                        </>
                      );
                    })()}
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

      </div>
    </div>
  );
}

export default AdminPage;