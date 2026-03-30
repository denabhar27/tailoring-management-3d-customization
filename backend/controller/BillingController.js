const Order = require('../model/OrderModel');
const db = require('../config/db');

exports.getAllBillingRecords = (req, res) => {
  
  if (req.user.role !== 'admin' && req.user.role !== 'clerk') {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only."
    });
  }

  const sql = `
    SELECT 
      oi.item_id,
      oi.order_id,
      oi.service_type,
      oi.final_price,
      oi.base_price,
      oi.approval_status,
      oi.payment_status,
      oi.specific_data,
      oi.pricing_factors,
      oi.rental_start_date,
      oi.rental_end_date,
      o.status as order_status,
      o.order_type,
      o.walk_in_customer_id,
      o.order_date,
      u.user_id,
      u.first_name,
      u.last_name,
      u.email,
      u.phone_number,
      wc.name as walk_in_customer_name,
      wc.email as walk_in_customer_email,
      wc.phone as walk_in_customer_phone
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.order_id
    LEFT JOIN user u ON o.user_id = u.user_id
    LEFT JOIN walk_in_customers wc ON o.walk_in_customer_id = wc.id
    WHERE oi.approval_status NOT IN ('cancelled', 'pending', 'pending_review')
      AND oi.approval_status IS NOT NULL
      AND oi.approval_status != ''
    ORDER BY o.order_date DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Database error",
        error: err
      });
    }

    const billingRecords = results.map(item => {
      
      let uniqueNo = "";
      switch(item.service_type.toLowerCase()) {
        case 'customize':
        case 'customization':
          uniqueNo = `C${item.item_id}${Math.floor(Math.random() * 1000)}`;
          break;
        case 'dry_cleaning':
        case 'drycleaning':
        case 'dry-cleaning':
        case 'dry cleaning':
          uniqueNo = `D${item.item_id}${Math.floor(Math.random() * 1000)}`;
          break;
        case 'repair':
          uniqueNo = `R${item.item_id}${Math.floor(Math.random() * 1000)}`;
          break;
        case 'rental':
          uniqueNo = `RN${item.item_id}${Math.floor(Math.random() * 1000)}`;
          break;
        default:
          uniqueNo = `S${item.item_id}${Math.floor(Math.random() * 1000)}`;
      }

      let specificData = {};
      let pricingFactors = {};
      try {
        specificData = item.specific_data ? JSON.parse(item.specific_data) : {};
        pricingFactors = item.pricing_factors ? JSON.parse(item.pricing_factors) : {};
      } catch (e) {
        console.error('Error parsing JSON fields:', e);
      }

      let paymentStatus = 'Unpaid';
      const normalizedServiceType = (item.service_type || '').toLowerCase().trim();
      const dbPaymentStatus = (item.payment_status || '').toLowerCase().trim();

      const amountPaid = parseFloat(pricingFactors.amount_paid || pricingFactors.downpayment || 0);
      const finalPrice = parseFloat(item.final_price || 0);
      const remainingBalance = finalPrice - amountPaid;

      if (dbPaymentStatus === 'fully_paid' || dbPaymentStatus === 'paid') {
        paymentStatus = 'Paid';
      } else if (remainingBalance <= 0 && finalPrice > 0 && amountPaid > 0) {
        paymentStatus = 'Paid';
      } else if (dbPaymentStatus === 'partial_payment' || dbPaymentStatus === 'partial') {
        paymentStatus = 'Partial Payment';
      } else if (dbPaymentStatus === 'down-payment' || dbPaymentStatus === 'downpayment') {
        paymentStatus = 'Down-payment';
      } else if (amountPaid > 0 && remainingBalance > 0) {
        // If there's a payment but not full, check if it's a downpayment or partial
        const halfPrice = finalPrice * 0.5;
        if (amountPaid >= halfPrice) {
          paymentStatus = 'Partial Payment';
        } else {
          paymentStatus = 'Down-payment';
        }
      } else if (dbPaymentStatus === 'cancelled') {
        paymentStatus = 'Cancelled';
      } else {
        paymentStatus = 'Unpaid';
      }

      let serviceTypeDisplay = item.service_type;
      switch(item.service_type.toLowerCase()) {
        case 'dry_cleaning':
        case 'drycleaning':
        case 'dry-cleaning':
          serviceTypeDisplay = 'Dry Cleaning';
          break;
        case 'customize':
        case 'customization':
          serviceTypeDisplay = 'Customization';
          break;
        case 'repair':
          serviceTypeDisplay = 'Repair';
          break;
        case 'rental':
          serviceTypeDisplay = 'Rental';
          break;
        default:
          serviceTypeDisplay = item.service_type.charAt(0).toUpperCase() + item.service_type.slice(1);
      }

      return {
        id: item.item_id,
        uniqueNo: uniqueNo,
        customerName: item.order_type === 'walk_in' 
          ? (item.walk_in_customer_name || 'Walk-in Customer')
          : `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'N/A',
        orderType: item.order_type || 'online',
        serviceType: item.service_type,
        serviceTypeDisplay: serviceTypeDisplay,
        date: item.order_date ? new Date(item.order_date).toISOString().split('T')[0] : 'N/A',
        price: parseFloat(item.final_price || 0),
        basePrice: parseFloat(item.base_price || 0),
        status: paymentStatus,
        specificData: specificData,
        pricingFactors: pricingFactors,
        rentalStartDate: item.rental_start_date,
        rentalEndDate: item.rental_end_date
      };
    });

    res.json({
      success: true,
      message: "Billing records retrieved successfully",
      records: billingRecords
    });
  });
};

exports.getBillingRecordsByStatus = (req, res) => {
  const { status } = req.params;

  if (req.user.role !== 'admin' && req.user.role !== 'clerk') {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only."
    });
  }

  if (!status) {
    return res.status(400).json({
      success: false,
      message: "Status is required"
    });
  }

  const sql = `
    SELECT 
      oi.item_id,
      oi.order_id,
      oi.service_type,
      oi.final_price,
      oi.base_price,
      oi.approval_status,
      oi.payment_status,
      oi.specific_data,
      oi.pricing_factors,
      oi.rental_start_date,
      oi.rental_end_date,
      o.status as order_status,
      o.order_date,
      u.user_id,
      u.first_name,
      u.last_name,
      u.email,
      u.phone_number
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.order_id
    JOIN user u ON o.user_id = u.user_id
    WHERE (o.status = ? OR oi.approval_status = ?)
      AND oi.approval_status != 'cancelled'
    ORDER BY o.order_date DESC
  `;

  db.query(sql, [status, status], (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Database error",
        error: err
      });
    }

    const billingRecords = results.map(item => {
      
      let uniqueNo = "";
      switch(item.service_type.toLowerCase()) {
        case 'customize':
        case 'customization':
          uniqueNo = `C${item.item_id}${Math.floor(Math.random() * 1000)}`;
          break;
        case 'dry_cleaning':
        case 'drycleaning':
        case 'dry-cleaning':
        case 'dry cleaning':
          uniqueNo = `D${item.item_id}${Math.floor(Math.random() * 1000)}`;
          break;
        case 'repair':
          uniqueNo = `R${item.item_id}${Math.floor(Math.random() * 1000)}`;
          break;
        case 'rental':
          uniqueNo = `RN${item.item_id}${Math.floor(Math.random() * 1000)}`;
          break;
        default:
          uniqueNo = `S${item.item_id}${Math.floor(Math.random() * 1000)}`;
      }

      let paymentStatus = 'Unpaid';
      if (item.payment_status === 'paid') {
        paymentStatus = 'Paid';
      } else if (item.payment_status === 'cancelled') {
        paymentStatus = 'Cancelled';
      } else if (item.payment_status === 'down-payment') {
        paymentStatus = 'Down-payment';
      } else if (item.payment_status === 'fully_paid') {
        paymentStatus = 'Fully Paid';
      }

      let specificData = {};
      let pricingFactors = {};
      try {
        specificData = item.specific_data ? JSON.parse(item.specific_data) : {};
        pricingFactors = item.pricing_factors ? JSON.parse(item.pricing_factors) : {};
      } catch (e) {
        console.error('Error parsing JSON fields:', e);
      }

      let serviceTypeDisplay = item.service_type;
      switch(item.service_type.toLowerCase()) {
        case 'dry_cleaning':
        case 'drycleaning':
        case 'dry-cleaning':
          serviceTypeDisplay = 'Dry Cleaning';
          break;
        case 'customize':
        case 'customization':
          serviceTypeDisplay = 'Customization';
          break;
        case 'repair':
          serviceTypeDisplay = 'Repair';
          break;
        case 'rental':
          serviceTypeDisplay = 'Rental';
          break;
        default:
          serviceTypeDisplay = item.service_type.charAt(0).toUpperCase() + item.service_type.slice(1);
      }

      return {
        id: item.item_id,
        uniqueNo: uniqueNo,
        customerName: item.order_type === 'walk_in' 
          ? (item.walk_in_customer_name || 'Walk-in Customer')
          : `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'N/A',
        orderType: item.order_type || 'online',
        serviceType: item.service_type,
        serviceTypeDisplay: serviceTypeDisplay,
        date: item.order_date ? new Date(item.order_date).toISOString().split('T')[0] : 'N/A',
        price: parseFloat(item.final_price || 0),
        basePrice: parseFloat(item.base_price || 0),
        status: paymentStatus,
        specificData: specificData,
        pricingFactors: pricingFactors,
        rentalStartDate: item.rental_start_date,
        rentalEndDate: item.rental_end_date
      };
    });

    res.json({
      success: true,
      message: `Billing records with status '${status}' retrieved successfully`,
      records: billingRecords
    });
  });
};

exports.updateBillingRecordStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'clerk') {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only."
    });
  }

  if (!status) {
    return res.status(400).json({
      success: false,
      message: "Status is required"
    });
  }

  const validStatuses = ['Paid', 'Unpaid', 'Cancelled', 'Down-payment', 'Fully Paid'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid status. Must be: Paid, Unpaid, Cancelled, Down-payment, or Fully Paid"
    });
  }

  let dbStatus = 'unpaid';
  if (status === 'Paid') {
    dbStatus = 'paid';
  } else if (status === 'Cancelled') {
    dbStatus = 'cancelled';
  } else if (status === 'Down-payment') {
    dbStatus = 'down-payment';
  } else if (status === 'Fully Paid') {
    dbStatus = 'fully_paid';
  }

  const sql = `UPDATE order_items SET payment_status = ? WHERE item_id = ?`;
  db.query(sql, [dbStatus, id], (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Database error updating payment status",
        error: err
      });
    }

    res.json({
      success: true,
      message: `Billing record status updated to ${status}`
    });
  });
};

exports.getBillingStats = (req, res) => {
  
  if (req.user.role !== 'admin' && req.user.role !== 'clerk') {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only."
    });
  }

  const statsSql = `
    SELECT 
      COUNT(*) as total_records,
      SUM(
        CASE 
          WHEN oi.payment_status IN ('paid', 'fully_paid') THEN 1
          WHEN LOWER(oi.service_type) = 'rental' 
            AND COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(oi.pricing_factors, '$.amount_paid')) AS DECIMAL(10,2)), 0) > 0 
            AND COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(oi.pricing_factors, '$.amount_paid')) AS DECIMAL(10,2)), 0) >= oi.final_price THEN 1
          ELSE 0 
        END
      ) as paid_count,
      SUM(
        CASE 
          WHEN oi.payment_status IN ('down-payment', 'downpayment') THEN 1
          WHEN LOWER(oi.service_type) = 'rental' 
            AND COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(oi.pricing_factors, '$.amount_paid')) AS DECIMAL(10,2)), 0) > 0 
            AND COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(oi.pricing_factors, '$.amount_paid')) AS DECIMAL(10,2)), 0) < (oi.final_price * 0.5) THEN 1
          ELSE 0
        END
      ) as downpayment_count,
      SUM(
        CASE 
          WHEN oi.payment_status IN ('partial_payment', 'partial') THEN 1
          WHEN LOWER(oi.service_type) = 'rental' 
            AND COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(oi.pricing_factors, '$.amount_paid')) AS DECIMAL(10,2)), 0) >= (oi.final_price * 0.5)
            AND COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(oi.pricing_factors, '$.amount_paid')) AS DECIMAL(10,2)), 0) < oi.final_price THEN 1
          ELSE 0
        END
      ) as partial_payment_count,
      SUM(
        CASE 
          WHEN oi.payment_status IN ('unpaid', 'pending', '') OR oi.payment_status IS NULL THEN 1
          ELSE 0 
        END
      ) as unpaid_count,
      SUM(
        COALESCE(
          CAST(JSON_UNQUOTE(JSON_EXTRACT(oi.pricing_factors, '$.amount_paid')) AS DECIMAL(10,2)),
          CASE 
            WHEN oi.payment_status IN ('paid', 'fully_paid') THEN oi.final_price
            ELSE 0
          END
        )
      ) as total_revenue,
      SUM(
        CASE 
          WHEN oi.payment_status NOT IN ('paid', 'fully_paid') OR oi.payment_status IS NULL THEN 
            oi.final_price - COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(oi.pricing_factors, '$.amount_paid')) AS DECIMAL(10,2)), 0)
          ELSE 0
        END
      ) as pending_revenue
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.order_id
    WHERE oi.approval_status NOT IN ('cancelled', 'pending', 'pending_review')
      AND oi.approval_status IS NOT NULL
      AND oi.approval_status != ''
  `;

  db.query(statsSql, (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Database error",
        error: err
      });
    }

    const stats = results[0];

    res.json({
      success: true,
      message: "Billing statistics retrieved successfully",
      stats: {
        total: parseInt(stats.total_records) || 0,
        paid: parseInt(stats.paid_count) || 0,
        downpayment: parseInt(stats.downpayment_count) || 0,
        partialPayment: parseInt(stats.partial_payment_count) || 0,
        unpaid: parseInt(stats.unpaid_count) || 0,
        totalRevenue: parseFloat(stats.total_revenue) || 0,
        pendingRevenue: parseFloat(stats.pending_revenue) || 0
      }
    });
  });
};