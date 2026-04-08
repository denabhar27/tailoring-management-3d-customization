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
  if (raw.includes('pending')) {
    return { status: 'pending', statusText: 'Pending' };
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
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'clerk')) {
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
       LEFT JOIN transaction_logs tl ON oi.item_id = tl.order_item_id
       WHERE (
         oi.payment_status IN ('paid', 'fully_paid', 'down-payment', 'partial_payment', 'partial')
         OR COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(oi.pricing_factors, '$.amount_paid')) AS DECIMAL(10,2)), 0) > 0
       )
         AND DATE(COALESCE(tl.created_at, o.order_date)) = CURDATE()`
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
       LEFT JOIN transaction_logs tl ON oi.item_id = tl.order_item_id
       WHERE (
         oi.payment_status IN ('paid', 'fully_paid', 'down-payment', 'partial_payment', 'partial')
         OR COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(oi.pricing_factors, '$.amount_paid')) AS DECIMAL(10,2)), 0) > 0
       )
         AND DATE(COALESCE(tl.created_at, o.order_date)) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`
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
       LEFT JOIN transaction_logs tl ON oi.item_id = tl.order_item_id
       WHERE (
         oi.payment_status IN ('paid', 'fully_paid', 'down-payment', 'partial_payment', 'partial')
         OR COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(oi.pricing_factors, '$.amount_paid')) AS DECIMAL(10,2)), 0) > 0
       )
         AND YEAR(COALESCE(tl.created_at, o.order_date)) = YEAR(CURDATE())
         AND MONTH(COALESCE(tl.created_at, o.order_date)) = MONTH(CURDATE())`
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
       LEFT JOIN transaction_logs tl ON oi.item_id = tl.order_item_id
       WHERE (
         oi.payment_status IN ('paid', 'fully_paid', 'down-payment', 'partial_payment', 'partial')
         OR COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(oi.pricing_factors, '$.amount_paid')) AS DECIMAL(10,2)), 0) > 0
       )
         AND YEAR(COALESCE(tl.created_at, o.order_date)) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
         AND MONTH(COALESCE(tl.created_at, o.order_date)) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))`
    ).catch(err => {
      console.error('Error in previousMonthRevenueQuery:', err);
      return [{ total: 0 }];
    });

    const ActionLog = require('../model/ActionLogModel');
    const TransactionLog = require('../model/TransactionLogModel');
    const recentActivityQuery = Promise.all([
      
      new Promise((resolve) => {
        ActionLog.getAll(500, (err, logs) => {
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
              payment_status: tx.new_payment_status,
              cash_received: tx.notes?.match(/Cash received:\s*₱([\d,]+\.?\d*)/i)?.[1]?.replace(/,/g, '') || null,
              change_amount: tx.notes?.match(/Change:\s*₱([\d,]+\.?\d*)/i)?.[1]?.replace(/,/g, '') || null
            }));
            resolve(paymentActivities);
          }
        });
      }),

      query(
        `SELECT
           dcr.id AS compensation_incident_id,
           dcr.order_item_id,
           dcr.service_type,
           COALESCE(NULLIF(dcr.customer_name, ''), 'Customer') AS customer_name,
           dcr.damage_type,
           dcr.compensation_amount,
           dcr.compensation_status,
           dcr.responsible_party,
           dcr.notes,
           dcr.created_at,
           dcr.updated_at
         FROM damage_compensation_records dcr
         ORDER BY dcr.updated_at DESC
         LIMIT 200`
      ).catch(err => {
        const message = String(err?.message || '').toLowerCase();
        if (message.includes("doesn't exist") || message.includes('unknown table')) {
          return [];
        }
        console.error('Error fetching compensation incidents for dashboard activity:', err);
        return [];
      }),
      
      query(
        `SELECT 
           oi.item_id,
           oi.service_type,
           oi.approval_status,
           o.status AS order_status,
           o.order_date,
           oi.appointment_date,
            oi.rental_start_date,
           oi.rental_end_date,
            oi.pricing_factors,
            oi.specific_data,
           COALESCE(wc.name, CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS customer_name,
           u.first_name,
           u.last_name,
           wc.name AS walk_in_customer_name,
           NULL as reason,
           'status_update' as action_type,
           'admin' as action_by,
           NULL as notes
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.order_id
         LEFT JOIN user u ON o.user_id = u.user_id
         LEFT JOIN walk_in_customers wc ON o.walk_in_customer_id = wc.id
         WHERE oi.approval_status IS NOT NULL
         ORDER BY COALESCE((SELECT MAX(al.created_at) FROM action_logs al WHERE al.order_item_id = oi.item_id), o.order_date) DESC, oi.item_id DESC
         LIMIT 200`
      ).catch(err => {
        console.error('Error in order items query:', err);
        return [];
      })
    ]).then(([logs, paymentActivities, compensationActivities, orderItems]) => {
      
      const activityMap = new Map();
      const orderItemById = new Map();

      logs.forEach(log => {
        const key = `${log.order_item_id || 'null'}_${log.created_at}`;
        const walkInName = (log.walk_in_customer_name || '').trim();
        const customerFirstName = walkInName || log.customer_first_name || log.first_name || log.actor_first_name;
        const customerLastName = walkInName ? '' : (log.customer_last_name || log.last_name || log.actor_last_name);
        const logNotes = String(log.notes || '');
        const serviceLineMatch = logNotes.match(/(?:^|\n)Service:\s*([^\n|]+)/i);
        const serviceHint = String(serviceLineMatch?.[1] || '').trim();
        const normalizedServiceHint = serviceHint ? serviceHint.toLowerCase().replace(/\s+/g, '_') : '';
        const compensationFallbackService = normalizedServiceHint || (log.action_type === 'rental_damage_compensation' ? 'rental' : '');
        activityMap.set(key, {
          item_id: log.item_id || log.order_item_id || null,
          order_item_id: log.order_item_id || log.item_id || null,
          service_type: log.service_type || (log.action_type === 'add_measurements' ? 'Measurements' : (compensationFallbackService || 'N/A')),
          approval_status: log.new_status || log.previous_status || log.action_type,
          order_status: log.new_status || log.previous_status || log.action_type,
          order_date: log.created_at,
          first_name: customerFirstName,
          last_name: customerLastName,
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

      (compensationActivities || []).forEach((incident) => {
        const eventDate = incident.updated_at || incident.created_at;
        const key = `comp_${incident.compensation_incident_id || incident.order_item_id || 'null'}_${eventDate}`;
        if (!activityMap.has(key)) {
          const serviceTypeRaw = String(incident.service_type || '').trim().toLowerCase();
          const actionType = serviceTypeRaw === 'rental' ? 'rental_damage_compensation' : 'damage_compensation';
          const serviceLabel = mapService(incident.service_type || 'rental');
          const issueType = String(incident.damage_type || 'damage').replace(/_/g, ' ');
          const amount = parseFloat(incident.compensation_amount || 0) || 0;
          const baseServiceLine = `Service: ${serviceLabel}`;
          const reportedByName = incident.handled_by || 'admin';
          const damagedByName = incident.responsible_party || 'Unknown';
          let notes = String(incident.notes || '').trim();
          if (!notes) {
            notes = [
              baseServiceLine,
              `Reported from ${serviceLabel} management`,
              `Customer: ${incident.customer_name || 'Customer'}`,
              `Damaged by: ${damagedByName}`,
              `Damage type: ${issueType}`,
              `Amount to pay: ₱${amount.toFixed(2)}`,
              `Payment status: ${incident.compensation_status || 'unpaid'}`
            ].join('\n');
          } else if (!/(?:^|\n)Service:\s*/i.test(notes)) {
            notes = `${baseServiceLine}\n${notes}`;
          }

          activityMap.set(key, {
            item_id: incident.order_item_id || null,
            order_item_id: incident.order_item_id || null,
            service_type: incident.service_type || 'rental',
            approval_status: incident.compensation_status || 'unpaid',
            order_status: incident.compensation_status || 'unpaid',
            order_date: eventDate,
            first_name: incident.customer_name || 'Customer',
            last_name: '',
            reason: null,
            action_type: actionType,
            action_by: reportedByName,
            notes,
            is_payment: false,
            amount
          });
        }
      });

      orderItems.forEach(item => {
        const timestamp = item.order_date;
        const key = `${item.item_id}_${timestamp}`;
        orderItemById.set(String(item.item_id), item);
        const walkInName = (item.walk_in_customer_name || '').trim();
        const derivedCustomer = (item.customer_name || '').trim();
        const fallbackParts = String(derivedCustomer || '').split(/\s+/).filter(Boolean);
        const fallbackFirstName = fallbackParts.length > 0 ? fallbackParts[0] : (item.first_name || 'Customer');
        const fallbackLastName = fallbackParts.length > 1 ? fallbackParts.slice(1).join(' ') : (item.last_name || '');
        if (!activityMap.has(key)) {
          activityMap.set(key, {
            item_id: item.item_id,
            order_item_id: item.item_id,
            service_type: item.service_type,
            approval_status: item.approval_status,
            order_status: item.order_status,
            order_date: timestamp,
            appointment_date: item.appointment_date,
            rental_start_date: item.rental_start_date,
            rental_end_date: item.rental_end_date,
            pricing_factors: item.pricing_factors,
            specific_data: item.specific_data,
            first_name: walkInName || fallbackFirstName,
            last_name: walkInName ? '' : fallbackLastName,
            reason: item.reason,
            action_type: item.action_type || 'status_update',
            action_by: item.action_by || 'admin',
            notes: item.notes
          });
        }
      });

      activityMap.forEach((entry) => {
        const refKey = entry.item_id || entry.order_item_id;
        const ref = refKey ? orderItemById.get(String(refKey)) : null;
        if (!ref) return;
        entry.appointment_date = entry.appointment_date || ref.appointment_date || null;
        entry.rental_start_date = entry.rental_start_date || ref.rental_start_date || null;
        entry.rental_end_date = entry.rental_end_date || ref.rental_end_date || null;
        entry.pricing_factors = entry.pricing_factors || ref.pricing_factors || null;
        entry.specific_data = entry.specific_data || ref.specific_data || null;
      });

      const activities = Array.from(activityMap.values())
        .sort((a, b) => {
          const dateA = new Date(a.order_date || a.created_at || 0);
          const dateB = new Date(b.order_date || b.created_at || 0);
          return dateB - dateA;
        })
        .slice(0, 500);
      
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
        paymentInfo: paymentInfo,
        appointmentDate: row.appointment_date || null,
        rentalStartDate: row.rental_start_date || null,
        rentalEndDate: row.rental_end_date || null,
        pricingFactors: row.pricing_factors || null,
        specificData: row.specific_data || null
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
