const db = require('../config/db');

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}

function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function mapStatus(status, orderStatus) {
  const raw = (status || orderStatus || '').toLowerCase();
  if (!raw) {
    return { status: 'pending', statusText: 'Pending' };
  }
  if (raw === 'add_measurements') {
    return { status: 'add_measurements', statusText: 'Add Measurements' };
  }
  if (raw.includes('cancel')) {
    return { status: 'cancelled', statusText: 'Cancelled' };
  }
  if (raw.includes('return')) {
    return { status: 'returned', statusText: 'Returned' };
  }
  if (raw.includes('complete')) {
    return { status: 'completed', statusText: 'Completed' };
  }
  if (raw.includes('ready')) {
    return { status: 'pickup', statusText: 'To Pick up' };
  }
  if (raw.includes('rent') || raw === 'rented') {
    return { status: 'rented', statusText: 'Rented' };
  }
  if (raw === 'accepted' || raw.includes('accept')) {
    return { status: 'accepted', statusText: 'Accepted' };
  }
  if (raw.includes('progress') || raw.includes('confirm') || raw.includes('pending')) {
    return { status: 'in-progress', statusText: 'In Progress' };
  }
  return { status: raw, statusText: raw.charAt(0).toUpperCase() + raw.slice(1) };
}

function mapService(serviceType) {
  const type = (serviceType || '').toLowerCase();
  if (type === 'rental') return 'Rental';
  if (type === 'repair') return 'Repair';
  if (type === 'customize' || type === 'customization') return 'Customization';
  if (type.includes('dry')) return 'Dry Cleaning';
  return serviceType || 'Service';
}

exports.getDashboardOverview = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin only.'
    });
  }

  try {

    const todayAppointmentsQuery = query(
      `SELECT COUNT(*) AS count 
       FROM appointment_slots 
       WHERE DATE(appointment_date) = CURDATE() 
       AND status = 'booked'`
    ).catch(err => {
      console.error('Error in todayAppointmentsQuery:', err);
      return [{ count: 0 }];
    });

    const yesterdayAppointmentsQuery = query(
      `SELECT COUNT(*) AS count 
       FROM appointment_slots 
       WHERE DATE(appointment_date) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
       AND status = 'booked'`
    ).catch(err => {
      console.error('Error in yesterdayAppointmentsQuery:', err);
      return [{ count: 0 }];
    });

    const pendingOrdersQuery = query(
      `SELECT COUNT(*) AS count 
       FROM order_items 
       WHERE approval_status IN ('pending_review', 'pending', 'price_confirmation')`
    ).catch(err => {
      console.error('Error in pendingOrdersQuery:', err);
      return [{ count: 0 }];
    });

    const totalOrdersQuery = query(
      `SELECT COUNT(DISTINCT o.order_id) AS count 
       FROM orders o
       JOIN order_items oi ON o.order_id = oi.order_id
       WHERE oi.approval_status NOT IN ('cancelled', 'rejected')`
    ).catch(err => {
      console.error('Error in totalOrdersQuery:', err);
      return [{ count: 0 }];
    });

    const ordersByServiceQuery = query(
      `SELECT 
         service_type,
         COUNT(*) AS count
       FROM order_items
       WHERE approval_status NOT IN ('cancelled', 'rejected')
       GROUP BY service_type`
    ).catch(err => {
      console.error('Error in ordersByServiceQuery:', err);
      return [];
    });

    const todayRevenueQuery = query(
      `SELECT COALESCE(SUM(
        COALESCE(
          CAST(JSON_UNQUOTE(JSON_EXTRACT(oi.pricing_factors, '$.amount_paid')) AS DECIMAL(10,2)),
          CASE WHEN oi.payment_status IN ('paid', 'fully_paid') THEN oi.final_price ELSE 0 END
        )
      ), 0) AS total
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.order_id
       WHERE (
         oi.payment_status IN ('paid', 'fully_paid', 'down-payment', 'partial_payment', 'partial')
         OR COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(oi.pricing_factors, '$.amount_paid')) AS DECIMAL(10,2)), 0) > 0
       )
         AND DATE(o.order_date) = CURDATE()`
    ).catch(err => {
      console.error('Error in todayRevenueQuery:', err);
      return [{ total: 0 }];
    });

    const yesterdayRevenueQuery = query(
      `SELECT COALESCE(SUM(
        COALESCE(
          CAST(JSON_UNQUOTE(JSON_EXTRACT(oi.pricing_factors, '$.amount_paid')) AS DECIMAL(10,2)),
          CASE WHEN oi.payment_status IN ('paid', 'fully_paid') THEN oi.final_price ELSE 0 END
        )
      ), 0) AS total
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.order_id
       WHERE (
         oi.payment_status IN ('paid', 'fully_paid', 'down-payment', 'partial_payment', 'partial')
         OR COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(oi.pricing_factors, '$.amount_paid')) AS DECIMAL(10,2)), 0) > 0
       )
         AND DATE(o.order_date) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`
    ).catch(err => {
      console.error('Error in yesterdayRevenueQuery:', err);
      return [{ total: 0 }];
    });

    const currentMonthRevenueQuery = query(
      `SELECT COALESCE(SUM(
        COALESCE(
          CAST(JSON_UNQUOTE(JSON_EXTRACT(oi.pricing_factors, '$.amount_paid')) AS DECIMAL(10,2)),
          CASE WHEN oi.payment_status IN ('paid', 'fully_paid') THEN oi.final_price ELSE 0 END
        )
      ), 0) AS total
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.order_id
       WHERE (
         oi.payment_status IN ('paid', 'fully_paid', 'down-payment', 'partial_payment', 'partial')
         OR COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(oi.pricing_factors, '$.amount_paid')) AS DECIMAL(10,2)), 0) > 0
       )
         AND YEAR(o.order_date) = YEAR(CURDATE())
         AND MONTH(o.order_date) = MONTH(CURDATE())`
    ).catch(err => {
      console.error('Error in currentMonthRevenueQuery:', err);
      return [{ total: 0 }];
    });

    const previousMonthRevenueQuery = query(
      `SELECT COALESCE(SUM(
        COALESCE(
          CAST(JSON_UNQUOTE(JSON_EXTRACT(oi.pricing_factors, '$.amount_paid')) AS DECIMAL(10,2)),
          CASE WHEN oi.payment_status IN ('paid', 'fully_paid') THEN oi.final_price ELSE 0 END
        )
      ), 0) AS total
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.order_id
       WHERE (
         oi.payment_status IN ('paid', 'fully_paid', 'down-payment', 'partial_payment', 'partial')
         OR COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(oi.pricing_factors, '$.amount_paid')) AS DECIMAL(10,2)), 0) > 0
       )
         AND YEAR(o.order_date) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
         AND MONTH(o.order_date) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))`
    ).catch(err => {
      console.error('Error in previousMonthRevenueQuery:', err);
      return [{ total: 0 }];
    });

    const ActionLog = require('../model/ActionLogModel');
    const TransactionLog = require('../model/TransactionLogModel');
    const recentActivityQuery = Promise.all([
      
      new Promise((resolve) => {
        ActionLog.getAll(30, (err, logs) => {
          if (err) {
            console.error('Error fetching action logs:', err);
            resolve([]);
          } else {
            resolve(logs || []);
          }
        });
      }),
      
      new Promise((resolve) => {
        TransactionLog.getAll((err, transactions) => {
          if (err) {
            console.error('Error fetching transaction logs:', err);
            resolve([]);
          } else {
            
            const paymentActivities = (transactions || []).slice(0, 20).map(tx => ({
              item_id: tx.item_id || tx.order_item_id,
              order_item_id: tx.order_item_id,
              service_type: tx.service_type,
              approval_status: tx.new_payment_status,
              order_status: tx.new_payment_status,
              order_date: tx.created_at,
              first_name: tx.first_name,
              last_name: tx.last_name,
              reason: null,
              action_type: 'payment',
              action_by: tx.created_by || 'admin',
              notes: `Payment: ₱${parseFloat(tx.amount || 0).toFixed(2)} via ${tx.payment_method || 'cash'}. Status: ${tx.previous_payment_status || 'unpaid'} → ${tx.new_payment_status}`,
              amount: tx.amount,
              payment_method: tx.payment_method,
              payment_status: tx.new_payment_status
            }));
            resolve(paymentActivities);
          }
        });
      }),
      
      query(
        `SELECT 
           oi.item_id,
           oi.service_type,
           oi.approval_status,
           o.status AS order_status,
           o.order_date,
           u.first_name,
           u.last_name,
           NULL as reason,
           'status_update' as action_type,
           'admin' as action_by,
           NULL as notes
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.order_id
         JOIN user u ON o.user_id = u.user_id
         WHERE oi.approval_status IS NOT NULL
         ORDER BY o.order_date DESC, oi.item_id DESC
         LIMIT 20`
      ).catch(err => {
        console.error('Error in order items query:', err);
        return [];
      })
    ]).then(([logs, paymentActivities, orderItems]) => {
      
      const activityMap = new Map();

      logs.forEach(log => {
        const key = `${log.order_item_id || 'null'}_${log.created_at}`;
        activityMap.set(key, {
          item_id: log.item_id || null,
          service_type: log.service_type || (log.action_type === 'add_measurements' ? 'Measurements' : 'N/A'),
          approval_status: log.new_status || log.previous_status || log.action_type,
          order_status: log.new_status || log.previous_status || log.action_type,
          order_date: log.created_at,
          first_name: log.first_name,
          last_name: log.last_name,
          reason: log.reason,
          action_type: log.action_type,
          action_by: log.action_by,
          notes: log.notes,
          is_payment: log.action_type === 'payment',
          amount: log.action_type === 'payment' ? (log.notes?.match(/₱([\d,]+\.?\d*)/)?.[1]?.replace(/,/g, '') || null) : null
        });
      });

      paymentActivities.forEach(payment => {
        const key = `${payment.order_item_id || 'null'}_${payment.order_date}`;
        if (!activityMap.has(key)) {
          activityMap.set(key, payment);
        }
      });

      orderItems.forEach(item => {
        const timestamp = item.order_date;
        const key = `${item.item_id}_${timestamp}`;
        if (!activityMap.has(key)) {
          activityMap.set(key, {
            item_id: item.item_id,
            service_type: item.service_type,
            approval_status: item.approval_status,
            order_status: item.order_status,
            order_date: timestamp,
            first_name: item.first_name,
            last_name: item.last_name,
            reason: item.reason,
            action_type: item.action_type || 'status_update',
            action_by: item.action_by || 'admin',
            notes: item.notes
          });
        }
      });

      const activities = Array.from(activityMap.values())
        .sort((a, b) => new Date(b.order_date) - new Date(a.order_date))
        .slice(0, 20); 
      
      return activities;
    }).catch(err => {
      console.error('Error in recentActivityQuery:', err);
      return [];
    });

    const [
      todayAppointmentsRows,
      yesterdayAppointmentsRows,
      pendingOrdersRows,
      totalOrdersRows,
      ordersByServiceRows,
      todayRevenueRows,
      yesterdayRevenueRows,
      currentMonthRevenueRows,
      previousMonthRevenueRows,
      recentActivityRows
    ] = await Promise.all([
      todayAppointmentsQuery,
      yesterdayAppointmentsQuery,
      pendingOrdersQuery,
      totalOrdersQuery,
      ordersByServiceQuery,
      todayRevenueQuery,
      yesterdayRevenueQuery,
      currentMonthRevenueQuery,
      previousMonthRevenueQuery,
      recentActivityQuery
    ]);

    const todaysAppointments = todayAppointmentsRows[0]?.count || 0;
    const yesterdayAppointments = yesterdayAppointmentsRows[0]?.count || 0;
    const apptDiff = todaysAppointments - yesterdayAppointments;
    const apptInfo =
      yesterdayAppointments === 0
        ? ''
        : `${apptDiff >= 0 ? '+' : ''}${apptDiff} from yesterday`;

    const pendingOrders = pendingOrdersRows[0]?.count || 0;
    const pendingInfo =
      pendingOrders === 0 ? '' : `${pendingOrders} awaiting processing`;

    const totalOrders = totalOrdersRows[0]?.count || 0;

    const serviceCounts = {};
    ordersByServiceRows.forEach(row => {
      const serviceType = row.service_type || 'unknown';
      serviceCounts[serviceType] = row.count || 0;
    });

    const todayRevenue = Number(todayRevenueRows[0]?.total || 0);
    const yesterdayRevenue = Number(yesterdayRevenueRows[0]?.total || 0);
    const revenueDiff = todayRevenue - yesterdayRevenue;
    const revenueInfo =
      yesterdayRevenue === 0
        ? ''
        : `${revenueDiff >= 0 ? '+' : ''}₱${Math.abs(revenueDiff).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} vs yesterday`;

    const currentMonthRevenue = Number(currentMonthRevenueRows[0]?.total || 0);
    const previousMonthRevenue = Number(previousMonthRevenueRows[0]?.total || 0);
    let growthPercent = 0;
    if (previousMonthRevenue > 0) {
      growthPercent = ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100;
    }

    const formatMoney = (amount) => {
      return amount.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    };

    const stats = [
      {
        title: "Today's Appointments",
        number: String(todaysAppointments),
        info: apptInfo
      },
      {
        title: 'Pending Orders',
        number: String(pendingOrders),
        info: pendingInfo
      },
      {
        title: 'Total Orders',
        number: String(totalOrders),
        info: 'All active orders'
      }
    ];

    const recentActivities = recentActivityRows.map(row => {
      const mappedStatus = mapStatus(row.approval_status, row.order_status);
      const orderDate = row.order_date instanceof Date
        ? row.order_date
        : new Date(row.order_date);

      let paymentInfo = null;
      if (row.action_type === 'payment' || row.is_payment) {
        const amount = row.amount || (row.notes?.match(/₱([\d,]+\.?\d*)/)?.[1]?.replace(/,/g, '') || null);
        const paymentMethod = row.payment_method || (row.notes?.match(/via (\w+)/i)?.[1] || 'cash');
        const paymentStatus = row.payment_status || row.approval_status || 'paid';
        
        paymentInfo = {
          amount: amount ? parseFloat(amount) : null,
          payment_method: paymentMethod,
          payment_status: paymentStatus
        };
      }
      
      return {
        customer: `${row.first_name} ${row.last_name}`,
        service: mapService(row.service_type),
        status: mappedStatus.status,
        statusText: mappedStatus.statusText,
        time: formatDate(orderDate),
        reason: row.reason || null,
        actionType: row.action_type || null,
        actionBy: row.action_by || null,
        notes: row.notes || null,
        isPayment: row.action_type === 'payment' || row.is_payment || false,
        paymentInfo: paymentInfo
      };
    });

    res.json({
      success: true,
      stats,
      recentActivities
    });
  } catch (err) {
    console.error('Error fetching admin dashboard data:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data: ' + err.message
    });
  }
};