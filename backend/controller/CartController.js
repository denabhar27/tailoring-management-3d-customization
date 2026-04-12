const Cart = require('../model/CartModel');
const Order = require('../model/OrderModel');
const AppointmentSlot = require('../model/AppointmentSlotModel');
const db = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

function linkAppointmentSlotToCart(userId, serviceType, specificData, cartItemId) {
  
  if (!['dry_cleaning', 'repair', 'customization'].includes(serviceType)) {
    return;
  }

  const appointmentDate = specificData?.pickupDate || specificData?.preferredDate || specificData?.datetime;
  const appointmentTime = specificData?.appointmentTime || specificData?.preferredTime; 
  
  if (!appointmentDate) return;

  let date, time;

  if (appointmentDate.includes('T')) {
    const [datePart, timePart] = appointmentDate.split('T');
    date = datePart;
    
    const timeMatch = timePart.match(/(\d{2}):(\d{2})/);
    if (timeMatch) {
      time = `${timeMatch[1]}:${timeMatch[2]}:00`;
    }
  } else if (appointmentTime) {
    
    date = appointmentDate.split('T')[0]; 
    
    const timeMatch = appointmentTime.match(/(\d{2}):(\d{2})/);
    if (timeMatch) {
      time = `${timeMatch[1]}:${timeMatch[2]}:00`;
    } else if (appointmentTime.match(/^\d{2}:\d{2}:\d{2}$/)) {
      
      time = appointmentTime;
    }
  }

  if (date && time) {

    const sql = `
      UPDATE appointment_slots 
      SET cart_item_id = ? 
      WHERE user_id = ? 
      AND service_type = ? 
      AND appointment_date = ? 
      AND appointment_time = ? 
      AND cart_item_id IS NULL 
      AND order_item_id IS NULL
      AND status = 'booked'
      LIMIT 1
    `;
    db.query(sql, [cartItemId, userId, serviceType, date, time], (err) => {
      if (err) {
        console.error('Error linking appointment slot to cart item:', err);
      }
    });
  }
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/cart-items/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'cart-' + req.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 
  }
});

const parseMaybeJson = (value, fallback = {}) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const toDateOnly = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
};

const normalizeDuration = (value) => {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 3;
  return Math.max(1, Math.min(30, parsed));
};

const normalizeOverdueRate = (value) => {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(0, parsed);
};

const addRentalDays = (startDate, duration) => {
  const start = toDateOnly(startDate);
  if (!start) return null;
  const d = new Date(`${start}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const safeDuration = normalizeDuration(duration);
  d.setDate(d.getDate() + safeDuration - 1);
  return d.toISOString().split('T')[0];
};

const normalizeSelectedSizesForRental = (selectedSizes, startDate, fallbackDuration, fallbackRate, fallbackDueDate) => {
  if (!Array.isArray(selectedSizes)) {
    return { selectedSizes: [], durations: [], rates: [], dueDates: [] };
  }

  const durations = [];
  const rates = [];
  const dueDates = [];

  const normalized = selectedSizes.map((entry = {}) => {
    const rentalDuration = normalizeDuration(entry.rental_duration ?? entry.duration ?? fallbackDuration);
    const overdueAmount = normalizeOverdueRate(entry.overdue_amount ?? entry.overdue_rate ?? fallbackRate);
    const dueDate = toDateOnly(entry.due_date)
      || addRentalDays(startDate, rentalDuration)
      || toDateOnly(fallbackDueDate)
      || null;

    durations.push(rentalDuration);
    rates.push(overdueAmount);
    if (dueDate) dueDates.push(dueDate);

    return {
      ...entry,
      rental_duration: rentalDuration,
      overdue_amount: overdueAmount,
      overdue_rate: overdueAmount,
      due_date: dueDate
    };
  });

  return { selectedSizes: normalized, durations, rates, dueDates };
};

const normalizeRentalCartPayload = (pricingFactorsRaw, specificDataRaw, rentalDatesRaw) => {
  const pricingFactors = parseMaybeJson(pricingFactorsRaw, {});
  const specificData = parseMaybeJson(specificDataRaw, {});
  const rentalDates = parseMaybeJson(rentalDatesRaw, {});

  const startDate = toDateOnly(rentalDates.startDate || specificData.rental_start_date || specificData.rentalDates?.startDate);
  const fallbackDuration = normalizeDuration(pricingFactors.rental_duration ?? pricingFactors.duration ?? rentalDates.duration ?? 3);
  const fallbackRate = normalizeOverdueRate(pricingFactors.overdue_rate ?? pricingFactors.overdue_amount ?? 50);
  const fallbackDueDate = toDateOnly(rentalDates.endDate || specificData.rental_end_date || pricingFactors.due_date)
    || addRentalDays(startDate, fallbackDuration);

  const aggregateDurations = [];
  const aggregateRates = [];
  const aggregateDueDates = [];

  if (specificData.is_bundle === true && Array.isArray(specificData.bundle_items)) {
    specificData.bundle_items = specificData.bundle_items.map((bundleItem = {}) => {
      const selectedSizes = bundleItem.selected_sizes || bundleItem.selectedSizes || [];
      const normalized = normalizeSelectedSizesForRental(
        selectedSizes,
        bundleItem.rental_start_date || startDate,
        fallbackDuration,
        fallbackRate,
        bundleItem.rental_end_date || fallbackDueDate
      );

      aggregateDurations.push(...normalized.durations);
      aggregateRates.push(...normalized.rates);
      aggregateDueDates.push(...normalized.dueDates);

      const bundleDueDate = normalized.dueDates.length > 0
        ? normalized.dueDates.reduce((latest, current) => (current > latest ? current : latest), normalized.dueDates[0])
        : (toDateOnly(bundleItem.rental_end_date) || fallbackDueDate);

      return {
        ...bundleItem,
        selected_sizes: normalized.selectedSizes,
        selectedSizes: normalized.selectedSizes,
        rental_duration: normalized.durations.length > 0 ? Math.max(...normalized.durations) : fallbackDuration,
        overdue_rate: normalized.rates.length > 0 ? Math.max(...normalized.rates) : fallbackRate,
        due_date: bundleDueDate,
        rental_end_date: bundleDueDate
      };
    });
  } else {
    const selectedSizes = specificData.selected_sizes || specificData.selectedSizes || [];
    const normalized = normalizeSelectedSizesForRental(selectedSizes, startDate, fallbackDuration, fallbackRate, fallbackDueDate);
    specificData.selected_sizes = normalized.selectedSizes;
    specificData.selectedSizes = normalized.selectedSizes;
    aggregateDurations.push(...normalized.durations);
    aggregateRates.push(...normalized.rates);
    aggregateDueDates.push(...normalized.dueDates);
  }

  const duration = aggregateDurations.length > 0 ? Math.max(...aggregateDurations) : fallbackDuration;
  const overdueRate = aggregateRates.length > 0 ? Math.max(...aggregateRates) : fallbackRate;
  const endDate = aggregateDueDates.length > 0
    ? aggregateDueDates.reduce((latest, current) => (current > latest ? current : latest), aggregateDueDates[0])
    : (fallbackDueDate || addRentalDays(startDate, duration));

  pricingFactors.duration = duration;
  pricingFactors.rental_duration = duration;
  pricingFactors.overdue_rate = overdueRate;
  pricingFactors.due_date = endDate;

  specificData.rental_duration = duration;
  specificData.overdue_rate = overdueRate;
  specificData.due_date = endDate;
  specificData.rental_start_date = startDate;
  specificData.rental_end_date = endDate;

  return {
    pricingFactors,
    specificData,
    rentalDates: {
      ...rentalDates,
      startDate,
      endDate,
      duration
    }
  };
};

exports.getUserCart = (req, res) => {
  const userId = req.user.id;
  
  Cart.getUserCart(userId, (err, results) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: "Database error", 
        error: err 
      });
    }

    const items = results.map(item => ({
      ...item,
      pricing_factors: JSON.parse(item.pricing_factors || '{}'),
      specific_data: JSON.parse(item.specific_data || '{}')
    }));

    res.json({
      success: true,
      message: "Cart retrieved successfully",
      items: items
    });
  });
};

exports.addToCart = (req, res) => {
  const userId = req.user.id;
  const { 
    serviceType, 
    serviceId, 
    quantity, 
    basePrice, 
    finalPrice, 
    pricingFactors, 
    specificData,
    rentalDates 
  } = req.body;

  if (!serviceType) {
    return res.status(400).json({ 
      success: false, 
      message: "Service type is required" 
    });
  }

  let normalizedPricingFactors = pricingFactors;
  let normalizedSpecificData = specificData;
  let normalizedRentalDates = rentalDates;

  if (serviceType === 'rental') {
    const normalizedRentalPayload = normalizeRentalCartPayload(pricingFactors, specificData, rentalDates);
    normalizedPricingFactors = normalizedRentalPayload.pricingFactors;
    normalizedSpecificData = normalizedRentalPayload.specificData;
    normalizedRentalDates = normalizedRentalPayload.rentalDates;
  }

  const ServiceIdGenerator = require('../model/ServiceIdGenerator');

  const needsIncrementalId = ['dry_cleaning', 'repair', 'customization'].includes(serviceType);
  
  if (needsIncrementalId && (!serviceId || serviceId === 1 || serviceId === '1' || (typeof serviceId === 'number' && serviceId > 1000000000))) {
    
    ServiceIdGenerator.getNextServiceIdFromOrders(serviceType, (err, nextId) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: "Error generating service ID", 
          error: err 
        });
      }

      const finalServiceId = nextId;
      
      Cart.addToCart(
        userId, 
        serviceType, 
        finalServiceId, 
        quantity, 
        basePrice, 
        finalPrice, 
        normalizedPricingFactors, 
        normalizedSpecificData, 
        normalizedRentalDates,
        (err, result) => {
          if (err) {
            return res.status(500).json({ 
              success: false, 
              message: "Error adding item to cart", 
              error: err 
            });
          }

          const cartItemId = result.insertId;

          linkAppointmentSlotToCart(userId, serviceType, specificData, cartItemId);

          res.json({
            success: true,
            message: "Item added to cart successfully",
            cartId: cartItemId,
            serviceId: finalServiceId
          });
        }
      );
    });
  } else {
    
    Cart.addToCart(
      userId, 
      serviceType, 
      serviceId || 1, 
      quantity, 
      basePrice, 
      finalPrice, 
      normalizedPricingFactors, 
      normalizedSpecificData, 
      normalizedRentalDates,
      (err, result) => {
        if (err) {
          return res.status(500).json({ 
            success: false, 
            message: "Error adding item to cart", 
            error: err 
          });
        }

        const cartItemId = result.insertId;

        linkAppointmentSlotToCart(userId, serviceType, specificData, cartItemId);

        res.json({
          success: true,
          message: "Item added to cart successfully",
          cartId: cartItemId
        });
      }
    );
  }
};

exports.updateCartItem = (req, res) => {
  const userId = req.user.id;
  const cartItemId = req.params.id;
  const updates = req.body;

  Cart.getCartItemById(cartItemId, userId, (err, itemResult) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: "Database error", 
        error: err 
      });
    }

    if (itemResult.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Cart item not found" 
      });
    }

    Cart.updateCartItem(cartItemId, userId, updates, (err, result) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: "Error updating cart item", 
          error: err 
        });
      }

      res.json({
        success: true,
        message: "Cart item updated successfully"
      });
    });
  });
};

exports.removeFromCart = (req, res) => {
  const userId = req.user.id;
  const cartItemId = req.params.id;

  Cart.getCartItemById(cartItemId, userId, (err, itemResult) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: "Database error", 
        error: err 
      });
    }

    if (itemResult.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Cart item not found" 
      });
    }

    const cancelSlotSql = `
      UPDATE appointment_slots 
      SET status = 'cancelled' 
      WHERE cart_item_id = ? AND status = 'booked'
    `;
    db.query(cancelSlotSql, [cartItemId], (slotErr) => {
      if (slotErr) {
        console.error('Error cancelling appointment slot:', slotErr);
      }
    });

    Cart.removeFromCart(cartItemId, userId, (err, result) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: "Error removing item from cart", 
          error: err 
        });
      }

      res.json({
        success: true,
        message: "Item removed from cart successfully"
      });
    });
  });
};

exports.clearCart = (req, res) => {
  const userId = req.user.id;

  Cart.clearCart(userId, (err, result) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: "Error clearing cart", 
        error: err 
      });
    }

    res.json({
      success: true,
      message: "Cart cleared successfully"
    });
  });
};

exports.getCartSummary = (req, res) => {
  const userId = req.user.id;

  Cart.getCartSummary(userId, (err, results) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: "Database error", 
        error: err 
      });
    }

    const summary = results[0] || { item_count: 0, total_amount: 0 };

    res.json({
      success: true,
      message: "Cart summary retrieved successfully",
      itemCount: summary.item_count || 0,
      totalAmount: parseFloat(summary.total_amount) || 0
    });
  });
};

exports.submitCart = (req, res) => {
  const userId = req.user.id;
  const { notes, selectedCartIds } = req.body;

  Cart.getCartItemsForOrder(userId, (err, cartItems) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: "Error fetching cart items", 
        error: err 
      });
    }

    let filteredItems = cartItems;
    if (selectedCartIds && Array.isArray(selectedCartIds) && selectedCartIds.length > 0) {
      filteredItems = cartItems.filter(item => selectedCartIds.includes(item.cart_id));
    }

    if (filteredItems.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "No items selected or cart is empty" 
      });
    }

    const totalPrice = filteredItems.reduce((total, item) => {
      return total + (parseFloat(item.final_price) * (item.quantity || 1));
    }, 0);

    Order.createFromCart(userId, filteredItems, totalPrice.toString(), notes, (err, orderResult) => {
      if (err) {
        return res.status(err.statusCode || 500).json({ 
          success: false, 
          message: err.message || "Error creating order", 
          error: err.message || err 
        });
      }

      if (selectedCartIds && Array.isArray(selectedCartIds) && selectedCartIds.length > 0) {
        Cart.markSelectedCartItemsAsProcessed(userId, selectedCartIds, (markErr) => {
          if (markErr) {
            console.error('Error marking cart items as processed:', markErr);
          }
        });
      } else {
        
        Cart.markCartItemsAsProcessed(userId, (markErr) => {
          if (markErr) {
            console.error('Error marking cart items as processed:', markErr);
          }
        });
      }

      res.json({
        success: true,
        message: "Order created successfully",
        orderId: orderResult.orderId,
        childOrderIds: orderResult.childOrderIds || []
      });
    });
  });
};

exports.uploadCartItemFile = (req, res) => {
  const userId = req.user.id;
  const cartItemId = req.body.itemId;

  console.log('Cart upload request:', {
    userId,
    cartItemId,
    body: req.body,
    file: req.file
  });

  if (!cartItemId) {
    return res.status(400).json({ 
      success: false, 
      message: "Item ID is required" 
    });
  }

  Cart.getCartItemById(cartItemId, userId, (err, itemResult) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: "Database error", 
        error: err 
      });
    }

    if (itemResult.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Cart item not found" 
      });
    }

    upload.single('file')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ 
          success: false, 
          message: "File upload error", 
          error: err.message 
        });
      }

      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          message: "No file uploaded" 
        });
      }

      const fileUrl = `/uploads/cart-items/${req.file.filename}`;

      res.json({
        success: true,
        message: "File uploaded successfully",
        fileUrl: fileUrl
      });
    });
  });
};

exports.upload = upload;
