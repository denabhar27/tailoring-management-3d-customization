const TransactionLog = require('../model/TransactionLogModel');
const db = require('../config/db');
const billingHelper = require('../utils/billingHelper');

exports.getTransactionLogsByOrderItem = (req, res) => {
  const { orderItemId } = req.params;

  if (req.user.role !== 'admin') {
    
    const Order = require('../model/OrderModel');
    Order.getOrderItemById(orderItemId, (err, item) => {
      if (err || !item) {
        return res.status(500).json({
          success: false,
          message: "Error fetching order item"
        });
      }
      
      if (item.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }

      TransactionLog.getByOrderItemId(orderItemId, (logErr, logs) => {
        if (logErr) {
          return res.status(500).json({
            success: false,
            message: "Error fetching transaction logs",
            error: logErr
          });
        }
        
        res.json({
          success: true,
          message: "Transaction logs retrieved successfully",
          logs: logs || []
        });
      });
    });
  } else {
    
    TransactionLog.getByOrderItemId(orderItemId, (err, logs) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Error fetching transaction logs",
          error: err
        });
      }
      
      res.json({
        success: true,
        message: "Transaction logs retrieved successfully",
        logs: logs || []
      });
    });
  }
};

exports.getMyTransactionLogs = (req, res) => {
  const userId = req.user.id;
  
  TransactionLog.getByUserId(userId, (err, logs) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Error fetching transaction logs",
        error: err
      });
    }
    
    res.json({
      success: true,
      message: "Transaction logs retrieved successfully",
      logs: logs || []
    });
  });
};

exports.getAllTransactionLogs = (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'clerk') {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin or clerk only."
    });
  }
  
  TransactionLog.getAll((err, logs) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Error fetching transaction logs",
        error: err
      });
    }
    
    res.json({
      success: true,
      message: "Transaction logs retrieved successfully",
      logs: logs || []
    });
  });
};

exports.getTransactionSummary = (req, res) => {
  const { orderItemId } = req.params;

  if (req.user.role !== 'admin') {
    const Order = require('../model/OrderModel');
    Order.getOrderItemById(orderItemId, (err, item) => {
      if (err || !item) {
        return res.status(500).json({
          success: false,
          message: "Error fetching order item"
        });
      }
      
      if (item.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }
      
      TransactionLog.getSummaryByOrderItemId(orderItemId, (summaryErr, summary) => {
        if (summaryErr) {
          return res.status(500).json({
            success: false,
            message: "Error fetching transaction summary",
            error: summaryErr
          });
        }
        
        res.json({
          success: true,
          message: "Transaction summary retrieved successfully",
          summary: summary[0] || { total_transactions: 0, total_amount: 0, last_transaction_date: null }
        });
      });
    });
  } else {
    TransactionLog.getSummaryByOrderItemId(orderItemId, (err, summary) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Error fetching transaction summary",
          error: err
        });
      }
      
      res.json({
        success: true,
        message: "Transaction summary retrieved successfully",
        summary: summary[0] || { total_transactions: 0, total_amount: 0, last_transaction_date: null }
      });
    });
  }
};

exports.makePayment = (req, res) => {
  const { orderItemId } = req.params;
  const { amount, payment_method, notes, cashReceived } = req.body;

  const paymentAmount = parseFloat(amount);
  if (!paymentAmount || paymentAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid payment amount. Amount must be greater than 0."
    });
  }

  const cashTenderedRaw = cashReceived !== undefined && cashReceived !== null && cashReceived !== ''
    ? cashReceived
    : amount;
  const cashTendered = parseFloat(cashTenderedRaw);
  if (!cashTendered || cashTendered <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid cash received. Cash received must be greater than 0."
    });
  }

  if (cashTendered < paymentAmount) {
    return res.status(400).json({
      success: false,
      message: `Cash received (₱${cashTendered.toFixed(2)}) cannot be less than payment amount (₱${paymentAmount.toFixed(2)}).`
    });
  }

  const getItemSql = `
    SELECT 
      oi.item_id,
      oi.final_price, 
      oi.payment_status, 
      oi.service_type,
      oi.order_id,
      o.user_id
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.order_id
    WHERE oi.item_id = ?
  `;
  
  db.query(getItemSql, [orderItemId], (getErr, items) => {
    if (getErr || !items || items.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order item not found"
      });
    }
    
    const item = items[0];

    if (req.user.role !== 'admin' && item.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    TransactionLog.getSummaryByOrderItemId(orderItemId, (summaryErr, summary) => {
      if (summaryErr) {
        return res.status(500).json({
          success: false,
          message: "Error fetching payment summary",
          error: summaryErr
        });
      }
      
      const totalPaid = parseFloat(summary[0]?.total_amount || 0);
      const finalPrice = parseFloat(item.final_price || 0);
      const newTotalPaid = totalPaid + paymentAmount;
      const changeAmount = cashTendered - paymentAmount;

      if (newTotalPaid > finalPrice) {
        return res.status(400).json({
          success: false,
          message: `Payment amount exceeds remaining balance. Total price: ₱${finalPrice.toFixed(2)}, Already paid: ₱${totalPaid.toFixed(2)}, Remaining: ₱${(finalPrice - totalPaid).toFixed(2)}`
        });
      }

      let newPaymentStatus = item.payment_status || 'unpaid';
      const normalizedServiceType = (item.service_type || '').toLowerCase().trim();
      const logUserId = item.user_id || req.user?.id || null;

      if (!logUserId) {
        return res.status(500).json({
          success: false,
          message: 'Unable to record transaction log: missing user reference for this order.'
        });
      }
      
      if (normalizedServiceType === 'rental') {
        
        const downpaymentAmount = finalPrice * 0.5;
        if (newTotalPaid >= finalPrice) {
          newPaymentStatus = 'fully_paid';
        } else if (newTotalPaid >= downpaymentAmount) {
          newPaymentStatus = 'down-payment';
        } else {
          newPaymentStatus = 'partial_payment';
        }
      } else {
        
        if (newTotalPaid >= finalPrice) {
          newPaymentStatus = 'paid';
        } else {
          newPaymentStatus = 'partial_payment';
        }
      }

      const actorName = req.user?.username || `${req.user?.first_name || ''} ${req.user?.last_name || ''}`.trim() || req.user?.role || 'admin';
      const methodLabel = payment_method || 'cash';

      TransactionLog.create({
        order_item_id: orderItemId,
        user_id: logUserId,
        transaction_type: 'payment',
        amount: paymentAmount,
        previous_payment_status: item.payment_status || 'unpaid',
        new_payment_status: newPaymentStatus,
        payment_method: payment_method || 'cash',
        notes: notes || `${actorName} recorded payment of ₱${paymentAmount.toFixed(2)}. Total paid: ₱${newTotalPaid.toFixed(2)} of ₱${finalPrice.toFixed(2)}. Cash received: ₱${cashTendered.toFixed(2)}. Change: ₱${changeAmount.toFixed(2)}. Method: ${methodLabel}`,
        created_by: actorName
      }, (logErr, logResult) => {
        
        if (!logErr) {
          
          const db = require('../config/db');
          const getUserSql = `SELECT first_name, last_name FROM user WHERE user_id = ?`;
          db.query(getUserSql, [item.user_id], (userErr, userResults) => {
            const customerName = userResults && userResults.length > 0 
              ? `${userResults[0].first_name} ${userResults[0].last_name}`
              : 'Customer';
            
          const ActionLog = require('../model/ActionLogModel');
          const paymentMethodLabel = payment_method === 'cash' ? 'Cash' : 
                                     payment_method === 'card' ? 'Card' : 
                                     payment_method === 'online' ? 'Online' : 
                                     payment_method || 'Cash';
          ActionLog.create({
            order_item_id: orderItemId,
            user_id: item.user_id,
            action_type: 'payment',
            action_by: req.user.role === 'admin' ? 'admin' : req.user.role === 'clerk' ? 'clerk' : 'user',
            previous_status: item.payment_status || 'unpaid',
            new_status: newPaymentStatus,
            reason: null,
              notes: `Payment of ₱${paymentAmount.toFixed(2)} via ${paymentMethodLabel}. Customer: ${customerName}`
          }, (actionLogErr) => {
            if (actionLogErr) {
              console.error('Error creating payment action log:', actionLogErr);
            } else {
              console.log('Payment action log created successfully');
            }
            });
          });
        }

        if (!logErr && item.user_id) {
          const Notification = require('../model/NotificationModel');
          const serviceType = (item.service_type || 'customize').toLowerCase().trim();
          Notification.createPaymentSuccessNotification(
            item.user_id,
            orderItemId,
            paymentAmount,
            payment_method || 'cash',
            serviceType,
            (notifErr) => {
              if (notifErr) {
                console.error('[NOTIFICATION] Failed to create payment success notification:', notifErr);
              } else {
                console.log('[NOTIFICATION] Payment success notification created');
              }
            }
          );
        }
        
        if (logErr) {
          return res.status(500).json({
            success: false,
            message: "Error creating transaction log",
            error: logErr
          });
        }

        const updateSql = `
          UPDATE order_items 
          SET payment_status = ?,
              pricing_factors = JSON_SET(
                COALESCE(pricing_factors, '{}'),
                '$.amount_paid', ?
              )
          WHERE item_id = ?
        `;
        db.query(updateSql, [newPaymentStatus, newTotalPaid.toString(), orderItemId], (updateErr, updateResult) => {
          if (updateErr) {
            return res.status(500).json({
              success: false,
              message: "Error updating payment status",
              error: updateErr
            });
          }

          TransactionLog.getSummaryByOrderItemId(orderItemId, (finalSummaryErr, finalSummary) => {
            const finalTotalPaid = parseFloat(finalSummary[0]?.total_amount || 0);
            const remaining = finalPrice - finalTotalPaid;
            
            res.json({
              success: true,
              message: "Payment recorded successfully",
              payment: {
                amount: paymentAmount,
                total_paid: finalTotalPaid,
                remaining: Math.max(0, remaining),
                cash_received: cashTendered,
                change_amount: Math.max(0, changeAmount),
                payment_status: newPaymentStatus,
                transaction_id: logResult.insertId
              }
            });
          });
        });
      });
    });
  });
};

