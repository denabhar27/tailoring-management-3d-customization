const Order = require('../model/OrderModel');

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
        const updateFunction = (serviceType === 'dry_cleaning' || serviceType === 'drycleaning' || serviceType === 'dry-cleaning')
          ? Order.updateDryCleaningOrderItem
          : Order.updateRepairOrderItem;

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

const declinePrice = async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user.id;

    console.log("Declining price for item:", itemId, "by user:", userId);

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
        const updateFunction = (serviceType === 'dry_cleaning' || serviceType === 'drycleaning' || serviceType === 'dry-cleaning')
          ? Order.updateDryCleaningOrderItem
          : Order.updateRepairOrderItem;

        updateFunction(itemId, {
          approvalStatus: 'price_declined'
        }, (updateErr, result) => {
          if (updateErr) {
            console.error("Error updating order status:", updateErr);
            return res.status(500).json({
              success: false,
              message: 'Error updating order status'
            });
          }

          console.log("Successfully updated order status to price_declined for service type:", serviceType);
          res.json({
            success: true,
            message: 'Price declined. Order has been cancelled.'
          });
        });
      });
    });
  } catch (error) {
    console.error('Decline price error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  acceptPrice,
  declinePrice
};
