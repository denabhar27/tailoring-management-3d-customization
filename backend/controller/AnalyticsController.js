const db = require('../config/db');

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}

// Revenue = actual amount paid (from pricing_factors.amount_paid)
// This includes partial payments for all services
const getRevenueExpression = () => `
  COALESCE(
    CAST(JSON_UNQUOTE(JSON_EXTRACT(oi.pricing_factors, '$.amount_paid')) AS DECIMAL(10,2)),
    CASE 
      WHEN oi.payment_status IN ('paid', 'fully_paid') THEN oi.final_price
      ELSE 0
    END
  )
`;

exports.getRevenueOverview = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin only.'
    });
  }

  // Include all orders that have any payment (partial or full)
  const paidCondition = `(
    oi.payment_status IN ('paid', 'fully_paid', 'down-payment', 'partial_payment', 'partial')
    OR COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(oi.pricing_factors, '$.amount_paid')) AS DECIMAL(10,2)), 0) > 0
  )`;
  const revenueExpr = getRevenueExpression();

  try {
    
    const todayRevenue = await query(`
      SELECT COALESCE(SUM(${revenueExpr}), 0) AS total
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      WHERE ${paidCondition}
        AND DATE(o.order_date) = CURDATE()
    `);

    const yesterdayRevenue = await query(`
      SELECT COALESCE(SUM(${revenueExpr}), 0) AS total
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      WHERE ${paidCondition}
        AND DATE(o.order_date) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
    `);

    const weeklyRevenue = await query(`
      SELECT COALESCE(SUM(${revenueExpr}), 0) AS total
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      WHERE ${paidCondition}
        AND YEARWEEK(o.order_date, 1) = YEARWEEK(CURDATE(), 1)
    `);

    const lastWeekRevenue = await query(`
      SELECT COALESCE(SUM(${revenueExpr}), 0) AS total
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      WHERE ${paidCondition}
        AND YEARWEEK(o.order_date, 1) = YEARWEEK(DATE_SUB(CURDATE(), INTERVAL 1 WEEK), 1)
    `);

    const monthlyRevenue = await query(`
      SELECT COALESCE(SUM(${revenueExpr}), 0) AS total
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      WHERE ${paidCondition}
        AND YEAR(o.order_date) = YEAR(CURDATE())
        AND MONTH(o.order_date) = MONTH(CURDATE())
    `);

    const lastMonthRevenue = await query(`
      SELECT COALESCE(SUM(${revenueExpr}), 0) AS total
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      WHERE ${paidCondition}
        AND YEAR(o.order_date) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
        AND MONTH(o.order_date) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
    `);

    const yearlyRevenue = await query(`
      SELECT COALESCE(SUM(${revenueExpr}), 0) AS total
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      WHERE ${paidCondition}
        AND YEAR(o.order_date) = YEAR(CURDATE())
    `);

    const lastYearRevenue = await query(`
      SELECT COALESCE(SUM(${revenueExpr}), 0) AS total
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      WHERE ${paidCondition}
        AND YEAR(o.order_date) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 YEAR))
    `);

    const avgOrderValue = await query(`
      SELECT COALESCE(AVG(${revenueExpr}), 0) AS average
      FROM order_items oi
      WHERE ${paidCondition}
    `);

    const totalOrders = await query(`
      SELECT COUNT(*) AS count
      FROM order_items oi
      WHERE ${paidCondition}
    `);

    const calculateGrowth = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous * 100).toFixed(1);
    };

    res.json({
      success: true,
      data: {
        daily: {
          revenue: parseFloat(todayRevenue[0].total),
          previousRevenue: parseFloat(yesterdayRevenue[0].total),
          growth: parseFloat(calculateGrowth(todayRevenue[0].total, yesterdayRevenue[0].total))
        },
        weekly: {
          revenue: parseFloat(weeklyRevenue[0].total),
          previousRevenue: parseFloat(lastWeekRevenue[0].total),
          growth: parseFloat(calculateGrowth(weeklyRevenue[0].total, lastWeekRevenue[0].total))
        },
        monthly: {
          revenue: parseFloat(monthlyRevenue[0].total),
          previousRevenue: parseFloat(lastMonthRevenue[0].total),
          growth: parseFloat(calculateGrowth(monthlyRevenue[0].total, lastMonthRevenue[0].total))
        },
        yearly: {
          revenue: parseFloat(yearlyRevenue[0].total),
          previousRevenue: parseFloat(lastYearRevenue[0].total),
          growth: parseFloat(calculateGrowth(yearlyRevenue[0].total, lastYearRevenue[0].total))
        },
        averageOrderValue: parseFloat(avgOrderValue[0].average),
        totalOrders: parseInt(totalOrders[0].count)
      }
    });
  } catch (error) {
    console.error('Error fetching revenue overview:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching revenue overview',
      error: error.message
    });
  }
};

exports.getRevenueTrend = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin only.'
    });
  }

  const { period = 'monthly', startDate, endDate, serviceTypes } = req.query;

  try {
    let dateFormat, groupBy, dateCondition;
    
    switch (period) {
      case 'daily':
        dateFormat = '%Y-%m-%d';
        groupBy = 'DATE(o.order_date)';
        dateCondition = startDate && endDate 
          ? `AND DATE(o.order_date) BETWEEN '${startDate}' AND '${endDate}'`
          : 'AND o.order_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
        break;
      case 'weekly':
        dateFormat = '%Y-W%v';
        groupBy = 'YEARWEEK(o.order_date, 1)';
        dateCondition = startDate && endDate 
          ? `AND DATE(o.order_date) BETWEEN '${startDate}' AND '${endDate}'`
          : 'AND o.order_date >= DATE_SUB(CURDATE(), INTERVAL 12 WEEK)';
        break;
      case 'monthly':
      default:
        dateFormat = '%Y-%m';
        groupBy = 'YEAR(o.order_date), MONTH(o.order_date)';
        dateCondition = startDate && endDate 
          ? `AND DATE(o.order_date) BETWEEN '${startDate}' AND '${endDate}'`
          : 'AND o.order_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)';
        break;
      case 'yearly':
        dateFormat = '%Y';
        groupBy = 'YEAR(o.order_date)';
        dateCondition = 'AND o.order_date >= DATE_SUB(CURDATE(), INTERVAL 5 YEAR)';
        break;
    }

    let serviceCondition = '';
    if (serviceTypes && serviceTypes.length > 0) {
      const types = Array.isArray(serviceTypes) ? serviceTypes : [serviceTypes];
      const normalizedTypes = types.map(t => {
        const lower = t.toLowerCase();
        if (lower === 'customization') return "'customize', 'customization'";
        if (lower === 'dry cleaning' || lower === 'dry_cleaning') return "'dry_cleaning', 'dry-cleaning', 'drycleaning', 'dry cleaning'";
        return `'${t}'`;
      });
      serviceCondition = `AND LOWER(oi.service_type) IN (${normalizedTypes.join(', ')})`;
    }

    const revenueExpr = getRevenueExpression();

    const trendData = await query(`
      SELECT 
        DATE_FORMAT(o.order_date, '${dateFormat}') AS period,
        ${groupBy} AS period_group,
        COALESCE(SUM(${revenueExpr}), 0) AS revenue,
        COUNT(*) AS order_count
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      WHERE (
        oi.payment_status IN ('paid', 'fully_paid', 'down-payment', 'partial_payment', 'partial')
        OR COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(oi.pricing_factors, '$.amount_paid')) AS DECIMAL(10,2)), 0) > 0
      )
        ${dateCondition}
        ${serviceCondition}
      GROUP BY period, period_group
      ORDER BY period_group ASC
    `);

    res.json({
      success: true,
      period,
      data: trendData.map(row => ({
        period: row.period,
        revenue: parseFloat(row.revenue),
        orderCount: parseInt(row.order_count)
      }))
    });
  } catch (error) {
    console.error('Error fetching revenue trend:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching revenue trend',
      error: error.message
    });
  }
};

exports.getRevenueByService = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin only.'
    });
  }

  const { startDate, endDate, paymentStatus, serviceTypes } = req.query;

  try {
    let dateCondition = '';
    if (startDate && endDate) {
      dateCondition = `AND DATE(o.order_date) BETWEEN '${startDate}' AND '${endDate}'`;
    }

    // Include all orders with any payment (partial or full)
    let paymentCondition = `AND (
      oi.payment_status IN ('paid', 'fully_paid', 'down-payment', 'partial_payment', 'partial')
      OR COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(oi.pricing_factors, '$.amount_paid')) AS DECIMAL(10,2)), 0) > 0
    )`;
    if (paymentStatus && paymentStatus !== 'all') {
      if (paymentStatus === 'paid') {
        paymentCondition = `AND (
          oi.payment_status IN ('paid', 'fully_paid', 'down-payment', 'partial_payment', 'partial')
          OR COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(oi.pricing_factors, '$.amount_paid')) AS DECIMAL(10,2)), 0) > 0
        )`;
      } else {
        paymentCondition = `AND oi.payment_status = '${paymentStatus}'`;
      }
    }

    let serviceTypeCondition = '';
    if (serviceTypes) {
      const types = Array.isArray(serviceTypes) ? serviceTypes : [serviceTypes];
      if (types.length > 0) {
        const mappedTypes = types.map(t => {
          const lower = t.toLowerCase();
          if (lower === 'customization') return "'customize', 'customization'";
          if (lower === 'dry cleaning') return "'dry_cleaning', 'dry-cleaning', 'drycleaning', 'dry cleaning'";
          if (lower === 'repair') return "'repair'";
          if (lower === 'rental') return "'rental'";
          return `'${lower}'`;
        });
        serviceTypeCondition = `AND LOWER(oi.service_type) IN (${mappedTypes.join(', ')})`;
      }
    }

    const revenueExpr = getRevenueExpression();

    const serviceData = await query(`
      SELECT 
        CASE 
          WHEN LOWER(oi.service_type) IN ('customize', 'customization') THEN 'Customization'
          WHEN LOWER(oi.service_type) IN ('dry_cleaning', 'dry-cleaning', 'drycleaning', 'dry cleaning') THEN 'Dry Cleaning'
          WHEN LOWER(oi.service_type) = 'repair' THEN 'Repair'
          WHEN LOWER(oi.service_type) = 'rental' THEN 'Rental'
          ELSE 'Other'
        END AS service_type,
        COALESCE(SUM(${revenueExpr}), 0) AS revenue,
        COUNT(*) AS order_count,
        COALESCE(AVG(${revenueExpr}), 0) AS avg_order_value
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      WHERE 1=1
        ${paymentCondition}
        ${dateCondition}
        ${serviceTypeCondition}
      GROUP BY 
        CASE 
          WHEN LOWER(oi.service_type) IN ('customize', 'customization') THEN 'Customization'
          WHEN LOWER(oi.service_type) IN ('dry_cleaning', 'dry-cleaning', 'drycleaning', 'dry cleaning') THEN 'Dry Cleaning'
          WHEN LOWER(oi.service_type) = 'repair' THEN 'Repair'
          WHEN LOWER(oi.service_type) = 'rental' THEN 'Rental'
          ELSE 'Other'
        END
      ORDER BY revenue DESC
    `);

    const totalRevenue = serviceData.reduce((sum, s) => sum + parseFloat(s.revenue), 0);

    res.json({
      success: true,
      data: serviceData.map(row => ({
        serviceType: row.service_type,
        revenue: parseFloat(row.revenue),
        orderCount: parseInt(row.order_count),
        avgOrderValue: parseFloat(row.avg_order_value),
        percentage: totalRevenue > 0 ? ((parseFloat(row.revenue) / totalRevenue) * 100).toFixed(1) : 0
      })),
      totalRevenue
    });
  } catch (error) {
    console.error('Error fetching revenue by service:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching revenue by service',
      error: error.message
    });
  }
};

exports.getTopServices = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin only.'
    });
  }

  const { startDate, endDate, limit = 10, serviceTypes } = req.query;

  try {
    let dateCondition = '';
    if (startDate && endDate) {
      dateCondition = `AND DATE(o.order_date) BETWEEN '${startDate}' AND '${endDate}'`;
    }

    let serviceTypeCondition = '';
    if (serviceTypes) {
      const types = Array.isArray(serviceTypes) ? serviceTypes : [serviceTypes];
      if (types.length > 0) {
        const mappedTypes = types.map(t => {
          const lower = t.toLowerCase();
          if (lower === 'customization') return "'customize', 'customization'";
          if (lower === 'dry cleaning') return "'dry_cleaning', 'dry-cleaning', 'drycleaning', 'dry cleaning'";
          if (lower === 'repair') return "'repair'";
          if (lower === 'rental') return "'rental'";
          return `'${lower}'`;
        });
        serviceTypeCondition = `AND LOWER(oi.service_type) IN (${mappedTypes.join(', ')})`;
      }
    }

    const revenueExpr = getRevenueExpression();

    const topServices = await query(`
      SELECT 
        CASE 
          WHEN LOWER(oi.service_type) IN ('customize', 'customization') THEN 'Customization'
          WHEN LOWER(oi.service_type) IN ('dry_cleaning', 'dry-cleaning', 'drycleaning', 'dry cleaning') THEN 'Dry Cleaning'
          WHEN LOWER(oi.service_type) = 'repair' THEN 'Repair'
          WHEN LOWER(oi.service_type) = 'rental' THEN 'Rental'
          ELSE 'Other'
        END AS service_type,
        COALESCE(SUM(${revenueExpr}), 0) AS total_revenue,
        COUNT(*) AS order_count,
        COALESCE(AVG(${revenueExpr}), 0) AS avg_order_value
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      WHERE (oi.payment_status = 'paid' OR (LOWER(oi.service_type) = 'rental' AND oi.payment_status NOT IN ('unpaid', 'pending', 'cancelled')))
        ${dateCondition}
        ${serviceTypeCondition}
      GROUP BY 
        CASE 
          WHEN LOWER(oi.service_type) IN ('customize', 'customization') THEN 'Customization'
          WHEN LOWER(oi.service_type) IN ('dry_cleaning', 'dry-cleaning', 'drycleaning', 'dry cleaning') THEN 'Dry Cleaning'
          WHEN LOWER(oi.service_type) = 'repair' THEN 'Repair'
          WHEN LOWER(oi.service_type) = 'rental' THEN 'Rental'
          ELSE 'Other'
        END
      ORDER BY total_revenue DESC
      LIMIT ${parseInt(limit)}
    `);

    res.json({
      success: true,
      data: topServices.map(row => ({
        serviceType: row.service_type,
        totalRevenue: parseFloat(row.total_revenue),
        orderCount: parseInt(row.order_count),
        avgOrderValue: parseFloat(row.avg_order_value)
      }))
    });
  } catch (error) {
    console.error('Error fetching top services:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching top services',
      error: error.message
    });
  }
};

exports.getRevenueComparison = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin only.'
    });
  }

  const { period = 'monthly' } = req.query;

  try {
    let currentPeriodCondition, previousPeriodCondition, periodLabel;

    switch (period) {
      case 'daily':
        currentPeriodCondition = 'DATE(o.order_date) = CURDATE()';
        previousPeriodCondition = 'DATE(o.order_date) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)';
        periodLabel = { current: 'Today', previous: 'Yesterday' };
        break;
      case 'weekly':
        currentPeriodCondition = 'YEARWEEK(o.order_date, 1) = YEARWEEK(CURDATE(), 1)';
        previousPeriodCondition = 'YEARWEEK(o.order_date, 1) = YEARWEEK(DATE_SUB(CURDATE(), INTERVAL 1 WEEK), 1)';
        periodLabel = { current: 'This Week', previous: 'Last Week' };
        break;
      case 'monthly':
      default:
        currentPeriodCondition = 'YEAR(o.order_date) = YEAR(CURDATE()) AND MONTH(o.order_date) = MONTH(CURDATE())';
        previousPeriodCondition = 'YEAR(o.order_date) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND MONTH(o.order_date) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))';
        periodLabel = { current: 'This Month', previous: 'Last Month' };
        break;
      case 'yearly':
        currentPeriodCondition = 'YEAR(o.order_date) = YEAR(CURDATE())';
        previousPeriodCondition = 'YEAR(o.order_date) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 YEAR))';
        periodLabel = { current: 'This Year', previous: 'Last Year' };
        break;
    }

    const revenueExpr = getRevenueExpression();

    const currentData = await query(`
      SELECT 
        CASE 
          WHEN LOWER(oi.service_type) IN ('customize', 'customization') THEN 'Customization'
          WHEN LOWER(oi.service_type) IN ('dry_cleaning', 'dry-cleaning', 'drycleaning', 'dry cleaning') THEN 'Dry Cleaning'
          WHEN LOWER(oi.service_type) = 'repair' THEN 'Repair'
          WHEN LOWER(oi.service_type) = 'rental' THEN 'Rental'
          ELSE 'Other'
        END AS service_type,
        COALESCE(SUM(${revenueExpr}), 0) AS revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      WHERE (oi.payment_status = 'paid' OR (LOWER(oi.service_type) = 'rental' AND oi.payment_status NOT IN ('unpaid', 'pending', 'cancelled')))
        AND ${currentPeriodCondition}
      GROUP BY 
        CASE 
          WHEN LOWER(oi.service_type) IN ('customize', 'customization') THEN 'Customization'
          WHEN LOWER(oi.service_type) IN ('dry_cleaning', 'dry-cleaning', 'drycleaning', 'dry cleaning') THEN 'Dry Cleaning'
          WHEN LOWER(oi.service_type) = 'repair' THEN 'Repair'
          WHEN LOWER(oi.service_type) = 'rental' THEN 'Rental'
          ELSE 'Other'
        END
    `);

    const previousData = await query(`
      SELECT 
        CASE 
          WHEN LOWER(oi.service_type) IN ('customize', 'customization') THEN 'Customization'
          WHEN LOWER(oi.service_type) IN ('dry_cleaning', 'dry-cleaning', 'drycleaning', 'dry cleaning') THEN 'Dry Cleaning'
          WHEN LOWER(oi.service_type) = 'repair' THEN 'Repair'
          WHEN LOWER(oi.service_type) = 'rental' THEN 'Rental'
          ELSE 'Other'
        END AS service_type,
        COALESCE(SUM(${revenueExpr}), 0) AS revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      WHERE (oi.payment_status = 'paid' OR (LOWER(oi.service_type) = 'rental' AND oi.payment_status NOT IN ('unpaid', 'pending', 'cancelled')))
        AND ${previousPeriodCondition}
      GROUP BY 
        CASE 
          WHEN LOWER(oi.service_type) IN ('customize', 'customization') THEN 'Customization'
          WHEN LOWER(oi.service_type) IN ('dry_cleaning', 'dry-cleaning', 'drycleaning', 'dry cleaning') THEN 'Dry Cleaning'
          WHEN LOWER(oi.service_type) = 'repair' THEN 'Repair'
          WHEN LOWER(oi.service_type) = 'rental' THEN 'Rental'
          ELSE 'Other'
        END
    `);

    const services = ['Customization', 'Dry Cleaning', 'Repair', 'Rental'];
    const comparisonData = services.map(service => {
      const current = currentData.find(d => d.service_type === service);
      const previous = previousData.find(d => d.service_type === service);
      return {
        serviceType: service,
        currentRevenue: current ? parseFloat(current.revenue) : 0,
        previousRevenue: previous ? parseFloat(previous.revenue) : 0
      };
    });

    res.json({
      success: true,
      period,
      periodLabel,
      data: comparisonData
    });
  } catch (error) {
    console.error('Error fetching revenue comparison:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching revenue comparison',
      error: error.message
    });
  }
};

exports.getTopCustomers = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin only.'
    });
  }

  const { startDate, endDate, limit = 10 } = req.query;

  try {
    let dateCondition = '';
    if (startDate && endDate) {
      dateCondition = `AND DATE(o.order_date) BETWEEN '${startDate}' AND '${endDate}'`;
    }

    const revenueExpr = getRevenueExpression();

    const topCustomers = await query(`
      SELECT 
        COALESCE(u.user_id, CONCAT('walkin_', o.walk_in_customer_id)) AS customer_id,
        COALESCE(CONCAT(u.first_name, ' ', u.last_name), wc.name, 'Unknown') AS customer_name,
        COALESCE(u.email, wc.email, 'N/A') AS email,
        CASE WHEN u.user_id IS NOT NULL THEN 'registered' ELSE 'walk-in' END AS customer_type,
        COALESCE(SUM(${revenueExpr}), 0) AS total_revenue,
        COUNT(*) AS order_count,
        COALESCE(AVG(${revenueExpr}), 0) AS avg_order_value
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      LEFT JOIN user u ON o.user_id = u.user_id
      LEFT JOIN walk_in_customers wc ON o.walk_in_customer_id = wc.id
      WHERE (oi.payment_status = 'paid' OR (LOWER(oi.service_type) = 'rental' AND oi.payment_status NOT IN ('unpaid', 'pending', 'cancelled')))
        ${dateCondition}
      GROUP BY 
        COALESCE(u.user_id, CONCAT('walkin_', o.walk_in_customer_id)),
        COALESCE(CONCAT(u.first_name, ' ', u.last_name), wc.name, 'Unknown'),
        COALESCE(u.email, wc.email, 'N/A'),
        CASE WHEN u.user_id IS NOT NULL THEN 'registered' ELSE 'walk-in' END
      ORDER BY total_revenue DESC
      LIMIT ${parseInt(limit)}
    `);

    res.json({
      success: true,
      data: topCustomers.map(row => ({
        customerId: row.customer_id,
        customerName: row.customer_name,
        email: row.email,
        customerType: row.customer_type,
        totalRevenue: parseFloat(row.total_revenue),
        orderCount: parseInt(row.order_count),
        avgOrderValue: parseFloat(row.avg_order_value)
      }))
    });
  } catch (error) {
    console.error('Error fetching top customers:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching top customers',
      error: error.message
    });
  }
};

exports.getDetailedAnalytics = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin only.'
    });
  }

  const { startDate, endDate, serviceTypes, paymentStatus, orderType } = req.query;

  try {
    let conditions = ["(oi.payment_status = 'paid' OR (LOWER(oi.service_type) = 'rental' AND oi.payment_status NOT IN ('unpaid', 'pending', 'cancelled')))"];
    
    if (startDate && endDate) {
      conditions.push(`DATE(o.order_date) BETWEEN '${startDate}' AND '${endDate}'`);
    }
    
    if (paymentStatus && paymentStatus !== 'all') {
      conditions.push(`oi.payment_status = '${paymentStatus}'`);
    }

    if (orderType && orderType !== 'all') {
      conditions.push(`o.order_type = '${orderType}'`);
    }

    if (serviceTypes && serviceTypes.length > 0) {
      const types = Array.isArray(serviceTypes) ? serviceTypes : [serviceTypes];
      const normalizedTypes = types.flatMap(t => {
        const lower = t.toLowerCase();
        if (lower === 'customization') return ["'customize'", "'customization'"];
        if (lower === 'dry cleaning' || lower === 'dry_cleaning') return ["'dry_cleaning'", "'dry-cleaning'", "'drycleaning'", "'dry cleaning'"];
        return [`'${t}'`];
      });
      conditions.push(`LOWER(oi.service_type) IN (${normalizedTypes.join(', ')})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const revenueExpr = getRevenueExpression();

    const analytics = await query(`
      SELECT 
        oi.item_id,
        oi.order_id,
        CASE 
          WHEN LOWER(oi.service_type) IN ('customize', 'customization') THEN 'Customization'
          WHEN LOWER(oi.service_type) IN ('dry_cleaning', 'dry-cleaning', 'drycleaning', 'dry cleaning') THEN 'Dry Cleaning'
          WHEN LOWER(oi.service_type) = 'repair' THEN 'Repair'
          WHEN LOWER(oi.service_type) = 'rental' THEN 'Rental'
          ELSE 'Other'
        END AS service_type,
        ${revenueExpr} AS actual_revenue,
        oi.final_price,
        oi.payment_status,
        o.order_date,
        o.order_type,
        COALESCE(CONCAT(u.first_name, ' ', u.last_name), wc.name, 'Unknown') AS customer_name
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      LEFT JOIN user u ON o.user_id = u.user_id
      LEFT JOIN walk_in_customers wc ON o.walk_in_customer_id = wc.id
      ${whereClause}
      ORDER BY o.order_date DESC
      LIMIT 100
    `);

    const totalRevenue = analytics.reduce((sum, a) => sum + parseFloat(a.actual_revenue || 0), 0);
    const avgOrderValue = analytics.length > 0 ? totalRevenue / analytics.length : 0;

    res.json({
      success: true,
      summary: {
        totalRecords: analytics.length,
        totalRevenue,
        avgOrderValue
      },
      data: analytics.map(row => ({
        itemId: row.item_id,
        orderId: row.order_id,
        serviceType: row.service_type,
        amount: parseFloat(row.actual_revenue || 0),
        paymentStatus: row.payment_status,
        orderDate: row.order_date,
        orderType: row.order_type,
        customerName: row.customer_name
      }))
    });
  } catch (error) {
    console.error('Error fetching detailed analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching detailed analytics',
      error: error.message
    });
  }
};
