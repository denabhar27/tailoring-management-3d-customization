const db = require('../config/db');

exports.getCompletedItems = (req, res) => {
  
  if (req.user.role !== 'admin' && req.user.role !== 'clerk') {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only."
    });
  }

  const checkColumnSql = `
    SELECT COUNT(*) as column_exists
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'order_items'
    AND COLUMN_NAME = 'completed_item_image'
  `;

  db.query(checkColumnSql, (checkErr, checkResults) => {
    if (checkErr) {
      console.error('Error checking column existence:', checkErr);
      
    }

    const columnExists = checkResults && checkResults[0] && checkResults[0].column_exists > 0;

    let sql;
    if (columnExists) {
      sql = `
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
          oi.completed_item_image,
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
        WHERE oi.service_type != 'rental' 
        AND (oi.approval_status = 'completed' OR o.status = 'completed')
        ORDER BY o.order_date DESC
      `;
    } else {
      sql = `
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
          NULL as completed_item_image,
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
        WHERE oi.service_type != 'rental' 
        AND (oi.approval_status = 'completed' OR o.status = 'completed')
        ORDER BY o.order_date DESC
      `;
    }

    db.query(sql, (err, results) => {
      if (err) {
        console.error('Database query error:', err);
        return res.status(500).json({
          success: false,
          message: "Database error",
          error: err.message || err
        });
      }

    const inventoryItems = results.map(item => {
      
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
        default:
          serviceTypeDisplay = item.service_type.charAt(0).toUpperCase() + item.service_type.slice(1);
      }

      return {
        id: item.item_id,
        orderId: item.order_id,
        uniqueNo: uniqueNo,
        customerName: item.order_type === 'walk_in' 
          ? (item.walk_in_customer_name || 'Walk-in Customer')
          : `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'N/A',
        customerEmail: item.order_type === 'walk_in' 
          ? (item.walk_in_customer_email || '')
          : (item.email || ''),
        customerPhone: item.order_type === 'walk_in' 
          ? (item.walk_in_customer_phone || '')
          : (item.phone_number || ''),
        orderType: item.order_type || 'online',
        serviceType: item.service_type,
        serviceTypeDisplay: serviceTypeDisplay,
        date: item.order_date ? new Date(item.order_date).toISOString().split('T')[0] : 'N/A',
        price: parseFloat(item.final_price || 0),
        basePrice: parseFloat(item.base_price || 0),
        status: item.approval_status || item.order_status,
        specificData: specificData,
        pricingFactors: pricingFactors,
        completedItemImage: item.completed_item_image || null
      };
    });

      res.json({
        success: true,
        message: "Inventory items retrieved successfully",
        items: inventoryItems
      });
    });
  });
};

exports.getItemsByServiceType = (req, res) => {
  const { serviceType } = req.params;

  if (req.user.role !== 'admin' && req.user.role !== 'clerk') {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only."
    });
  }

  if (!serviceType) {
    return res.status(400).json({
      success: false,
      message: "Service type is required"
    });
  }

  const checkColumnSql = `
    SELECT COUNT(*) as column_exists
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'order_items'
    AND COLUMN_NAME = 'completed_item_image'
  `;

  db.query(checkColumnSql, (checkErr, checkResults) => {
    if (checkErr) {
      console.error('Error checking column existence:', checkErr);
      
    }

    const columnExists = checkResults && checkResults[0] && checkResults[0].column_exists > 0;

    let sql;
    if (columnExists) {
      sql = `
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
          oi.completed_item_image,
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
        WHERE oi.service_type = ? 
        AND oi.service_type != 'rental'
        AND (oi.approval_status = 'completed' OR o.status = 'completed')
        ORDER BY o.order_date DESC
      `;
    } else {
      sql = `
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
          NULL as completed_item_image,
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
        WHERE oi.service_type = ? 
        AND oi.service_type != 'rental'
        AND (oi.approval_status = 'completed' OR o.status = 'completed')
        ORDER BY o.order_date DESC
      `;
    }

    db.query(sql, [serviceType], (err, results) => {
      if (err) {
        console.error('Database query error:', err);
        return res.status(500).json({
          success: false,
          message: "Database error",
          error: err.message || err
        });
      }

    const inventoryItems = results.map(item => {
      
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
        default:
          serviceTypeDisplay = item.service_type.charAt(0).toUpperCase() + item.service_type.slice(1);
      }

      return {
        id: item.item_id,
        orderId: item.order_id,
        uniqueNo: uniqueNo,
        customerName: item.order_type === 'walk_in' 
          ? (item.walk_in_customer_name || 'Walk-in Customer')
          : `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'N/A',
        customerEmail: item.order_type === 'walk_in' 
          ? (item.walk_in_customer_email || '')
          : (item.email || ''),
        customerPhone: item.order_type === 'walk_in' 
          ? (item.walk_in_customer_phone || '')
          : (item.phone_number || ''),
        orderType: item.order_type || 'online',
        serviceType: item.service_type,
        serviceTypeDisplay: serviceTypeDisplay,
        date: item.order_date ? new Date(item.order_date).toISOString().split('T')[0] : 'N/A',
        price: parseFloat(item.final_price || 0),
        basePrice: parseFloat(item.base_price || 0),
        status: item.approval_status || item.order_status,
        specificData: specificData,
        pricingFactors: pricingFactors,
        completedItemImage: item.completed_item_image || null
      };
    });

      res.json({
        success: true,
        message: `Inventory items for ${serviceType} retrieved successfully`,
        items: inventoryItems
      });
    });
  });
};

exports.getInventoryStats = (req, res) => {
  
  if (req.user.role !== 'admin' && req.user.role !== 'clerk') {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only."
    });
  }

  const statsSql = `
    SELECT 
      COUNT(*) as total_items,
      SUM(CASE WHEN oi.service_type = 'customization' OR oi.service_type = 'customize' THEN 1 ELSE 0 END) as customization_count,
      SUM(CASE WHEN oi.service_type LIKE '%dry%' THEN 1 ELSE 0 END) as dry_cleaning_count,
      SUM(CASE WHEN oi.service_type = 'repair' THEN 1 ELSE 0 END) as repair_count,
      SUM(oi.final_price) as total_value
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.order_id
    WHERE oi.service_type != 'rental' 
    AND (oi.approval_status = 'completed' OR o.status = 'completed')
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
      message: "Inventory statistics retrieved successfully",
      stats: {
        total: parseInt(stats.total_items) || 0,
        customization: parseInt(stats.customization_count) || 0,
        dryCleaning: parseInt(stats.dry_cleaning_count) || 0,
        repair: parseInt(stats.repair_count) || 0,
        totalValue: parseFloat(stats.total_value) || 0
      }
    });
  });
};