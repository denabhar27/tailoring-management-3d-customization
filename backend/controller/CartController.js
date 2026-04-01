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
        pricingFactors, 
        specificData, 
        rentalDates,
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
      pricingFactors, 
      specificData, 
      rentalDates,
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
          message: "Error creating order", 
          error: err 
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
        orderId: orderResult.orderId
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
