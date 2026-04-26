const Order = require('../model/OrderModel');
const db = require('../config/db');

const insertTracking = (itemId, status, notes, userId) => {
  db.query(
    `INSERT INTO order_tracking (order_item_id, status, notes, updated_by) VALUES (?, ?, ?, ?)`,
    [itemId, status, notes, userId || null],
    (err) => { if (err) console.error('Error inserting tracking entry:', err); }
  );
};

const acceptPrice = async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user.id;

    console.log("Accepting price for item:", itemId, "by user:", userId);

    Order.getOrderItemById(itemId, (err, item) => {
      if (err) {
        console.error("Error fetching order item:", err);
        return res.status(500).json({
          success: false,
          message: 'Error fetching order item'
        });
      }

      if (!item) {
        console.error("Order item not found:", itemId);
        return res.status(404).json({
          success: false,
          message: 'Order item not found'
        });
      }

      Order.getById(item.order_id, (orderErr, orderResult) => {
        if (orderErr) {
          console.error("Error fetching order:", orderErr);
          return res.status(500).json({
            success: false,
            message: 'Error fetching order'
          });
        }

        if (!orderResult || orderResult.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Order not found'
          });
        }

        const order = orderResult[0];

        if (order.user_id !== userId) {
          console.error("User unauthorized:", userId, "Order owner:", order.user_id);
          return res.status(403).json({
            success: false,
            message: 'Unauthorized access to this order'
          });
        }

        const serviceType = String(item.service_type || '').toLowerCase().trim();
        let updateFunction;
        if (serviceType === 'dry_cleaning' || serviceType === 'drycleaning' || serviceType === 'dry-cleaning') {
          updateFunction = Order.updateDryCleaningOrderItem;
        } else if (serviceType === 'customization' || serviceType === 'customize') {
          const Customization = require('../model/CustomizationModel');
          updateFunction = (id, data, cb) => Customization.updateOrderItem(id, data, cb);
        } else {
          updateFunction = Order.updateRepairOrderItem;
        }

        updateFunction(itemId, {
          approvalStatus: 'accepted'
        }, (updateErr, result) => {
          if (updateErr) {
            console.error("Error updating order status:", updateErr);
            return res.status(500).json({
              success: false,
              message: 'Error updating order status'
            });
          }

          insertTracking(itemId, 'accepted', 'Price confirmed by customer. Order is now accepted.', userId);
          console.log("Successfully updated order status to accepted for service type:", serviceType);
          res.json({
            success: true,
            message: 'Price accepted successfully. Order is now accepted.'
          });
        });
      });
    });
  } catch (error) {
    console.error('Accept price error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

const hagglePrice = async (req, res) => {
  try {
    const maxHaggleAttempts = 2;
    const { itemId } = req.params;
    const userId = req.user.id;
    const offeredPriceRaw = req.body?.offeredPrice;
    const offeredPrice = parseFloat(offeredPriceRaw);

    if (!Number.isFinite(offeredPrice) || offeredPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid haggle price.'
      });
    }

    Order.getOrderItemById(itemId, (err, item) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Error fetching order item' });
      }

      if (!item) {
        return res.status(404).json({ success: false, message: 'Order item not found' });
      }

      Order.getById(item.order_id, (orderErr, orderResult) => {
        if (orderErr || !orderResult || orderResult.length === 0) {
          return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const order = orderResult[0];
        if (order.user_id !== userId) {
          return res.status(403).json({ success: false, message: 'Unauthorized access to this order' });
        }

        if (String(item.approval_status || '').toLowerCase() !== 'price_confirmation') {
          return res.status(400).json({
            success: false,
            message: 'Haggle is only available while the order is in price confirmation.'
          });
        }

        let pricingFactors = {};
        try {
          pricingFactors = item.pricing_factors
            ? (typeof item.pricing_factors === 'string' ? JSON.parse(item.pricing_factors) : item.pricing_factors)
            : {};
        } catch {
          pricingFactors = {};
        }

        const existingHaggleCountRaw = pricingFactors?.haggleCount;
        const existingHaggleCount = Number.isFinite(Number(existingHaggleCountRaw))
          ? Number(existingHaggleCountRaw)
          : (pricingFactors.haggleUsed === true ? 1 : 0);

        if (existingHaggleCount >= maxHaggleAttempts) {
          return res.status(400).json({
            success: false,
            message: 'You have already used your 2 haggle attempts for this item.'
          });
        }

        const nextHaggleCount = existingHaggleCount + 1;

        const serviceType = String(item.service_type || '').toLowerCase().trim();
        const updateData = {
          pricingFactors: {
            ...pricingFactors,
            haggleOffer: offeredPrice,
            haggleUsed: true,
            haggleCount: nextHaggleCount,
            haggleOfferedAt: new Date().toISOString(),
            haggleOfferedBy: userId
          }
        };

        const updateFunction =
          serviceType === 'dry_cleaning' || serviceType === 'drycleaning' || serviceType === 'dry-cleaning'
            ? Order.updateDryCleaningOrderItem
            : serviceType === 'customization' || serviceType === 'customize'
              ? (id, data, cb) => require('../model/CustomizationModel').updateOrderItem(id, data, cb)
              : Order.updateRepairOrderItem;

        updateFunction(itemId, updateData, (updateErr) => {
          if (updateErr) {
            return res.status(500).json({ success: false, message: 'Error saving haggle price' });
          }

          db.query(
            `INSERT INTO order_tracking (order_item_id, status, notes, updated_by) VALUES (?, ?, ?, ?)`,
            [itemId, 'price_confirmation', `Customer haggled price to ₱${offeredPrice.toFixed(2)}`, userId],
            (trackErr) => {
              if (trackErr) {
                console.error('Error logging haggle tracking entry:', trackErr);
              }

              res.json({
                success: true,
                message: 'Haggle price submitted successfully.',
                offeredPrice
              });
            }
          );
        });
      });
    });
  } catch (error) {
    console.error('Haggle price error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const declinePrice = async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user.id;
    const { reason } = req.body || {};

    console.log("Declining price for item:", itemId, "by user:", userId);

    Order.getOrderItemById(itemId, (err, item) => {
      if (err) {
        console.error("Error fetching order item:", err);
        return res.status(500).json({ success: false, message: 'Error fetching order item' });
      }
      if (!item) {
        return res.status(404).json({ success: false, message: 'Order item not found' });
      }

      Order.getById(item.order_id, (orderErr, orderResult) => {
        if (orderErr) return res.status(500).json({ success: false, message: 'Error fetching order' });
        if (!orderResult || orderResult.length === 0) return res.status(404).json({ success: false, message: 'Order not found' });

        const order = orderResult[0];
        if (order.user_id !== userId) {
          return res.status(403).json({ success: false, message: 'Unauthorized access to this order' });
        }

        const serviceType = String(item.service_type || '').toLowerCase().trim();
        let updateFunction;
        if (serviceType === 'dry_cleaning' || serviceType === 'drycleaning' || serviceType === 'dry-cleaning') {
          updateFunction = Order.updateDryCleaningOrderItem;
        } else if (serviceType === 'customization' || serviceType === 'customize') {
          const Customization = require('../model/CustomizationModel');
          updateFunction = (id, data, cb) => Customization.updateOrderItem(id, data, cb);
        } else {
          updateFunction = Order.updateRepairOrderItem;
        }

        // Check if this is an accessories enhancement decline
        let pricingFactors = {};
        try {
          pricingFactors = item.pricing_factors
            ? (typeof item.pricing_factors === 'string' ? JSON.parse(item.pricing_factors) : item.pricing_factors)
            : {};
        } catch (e) {}

        const isAccessoriesDecline = pricingFactors.addAccessories === true && pricingFactors.enhancementRequest === true;

        if (isAccessoriesDecline) {
          // Restore final_price to the base price before accessories were added
          const basePrice = parseFloat(pricingFactors.accessoriesBasePrice || item.final_price || 0);
          // Send back to pending for admin to adjust/cancel
          updateFunction(itemId, {
            approvalStatus: 'pending',
            finalPrice: basePrice,
            pricingFactors: {
              ...pricingFactors,
              enhancementPendingAdminReview: true,
              accessoriesDeclineReason: reason || 'Customer declined the accessories price.',
              accessoriesDeclinedAt: new Date().toISOString(),
              accessoriesPrice: null,
              accessoriesBasePrice: null
            }
          }, (updateErr) => {
            if (updateErr) return res.status(500).json({ success: false, message: 'Error updating order status' });
            insertTracking(itemId, 'pending', `Customer declined accessories price. Reason: ${reason || 'No reason provided'}`, userId);
            res.json({ success: true, message: 'Accessories price declined. Admin will review and adjust.', isAccessoriesDecline: true });
          });
        } else {
          updateFunction(itemId, { approvalStatus: 'price_declined' }, (updateErr) => {
            if (updateErr) return res.status(500).json({ success: false, message: 'Error updating order status' });
            insertTracking(itemId, 'price_declined', `Price declined by customer.${reason ? ' Reason: ' + reason : ''}`, userId);
            res.json({ success: true, message: 'Price declined. Order has been cancelled.' });
          });
        }
      });
    });
  } catch (error) {
    console.error('Decline price error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  acceptPrice,
  declinePrice,
  hagglePrice
};
