const WalkInCustomer = require('../model/WalkInCustomerModel');
const Order = require('../model/OrderModel');
const RentalInventory = require('../model/RentalInventoryModel');
const db = require('../config/db');

exports.createDryCleaningOrder = async (req, res) => {
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      garmentType,
      quantity,
      specialInstructions,
      preferredPickupDate,
      preferredPickupTime,
      pricingFactors,
      notes
    } = req.body;

    if (!customerName || !customerPhone || !garmentType || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: customerName, customerPhone, garmentType, quantity'
      });
    }

    WalkInCustomer.findOrCreate({
      name: customerName,
      email: customerEmail,
      phone: customerPhone
    }, (err, customer) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Error creating/finding customer',
          error: err
        });
      }

      const pricePerItem = pricingFactors?.pricePerItem || 200; 
      const totalPrice = parseFloat(pricePerItem) * parseInt(quantity);

      const orderItem = {
        service_type: 'dry_cleaning',
        service_id: null,
        quantity: parseInt(quantity),
        base_price: pricePerItem.toString(),
        final_price: totalPrice.toString(),
        appointment_date: preferredPickupDate && preferredPickupTime 
          ? `${preferredPickupDate} ${preferredPickupTime}:00`
          : null,
        pricing_factors: JSON.stringify({
          pricePerItem: pricePerItem.toString(),
          quantity: quantity.toString(),
          ...pricingFactors
        }),
        specific_data: JSON.stringify({
          serviceName: `${garmentType} Dry Cleaning`,
          garmentType: garmentType,
          quantity: quantity.toString(),
          notes: specialInstructions || '',
          preferredPickupDate: preferredPickupDate,
          preferredPickupTime: preferredPickupTime
        })
      };

      const orderData = {
        user_id: null, 
        walk_in_customer_id: customer.id,
        order_type: 'walk_in',
        total_price: totalPrice.toString(),
        notes: notes || '',
        items: [orderItem]
      };

      Order.createWalkInOrder(orderData, (orderErr, orderResult) => {
        if (orderErr) {
          return res.status(500).json({
            success: false,
            message: 'Error creating order',
            error: orderErr
          });
        }

        res.json({
          success: true,
          message: 'Walk-in dry cleaning order created successfully',
          order: {
            orderId: orderResult.orderId,
            customer: customer,
            totalPrice: totalPrice
          }
        });
      });
    });
  } catch (error) {
    console.error('Error in createDryCleaningOrder:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

exports.createRentalOrder = async (req, res) => {
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      rentalItemId, 
      rentalItemIds, 
      rentalDuration,
      eventDate,
      damageDeposit,
      isBundle,
      notes
    } = req.body;

    const itemIds = rentalItemIds && Array.isArray(rentalItemIds) ? rentalItemIds : 
                    (rentalItemId ? [rentalItemId] : []);

    if (!customerName || !customerPhone || itemIds.length === 0 || !rentalDuration) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: customerName, customerPhone, rentalItemId(s), rentalDuration'
      });
    }

    WalkInCustomer.findOrCreate({
      name: customerName,
      email: customerEmail,
      phone: customerPhone
    }, (err, customer) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Error creating/finding customer',
          error: err
        });
      }

      const db = require('../config/db');
      const placeholders = itemIds.map(() => '?').join(',');
      const checkItemsSql = `SELECT * FROM rental_inventory WHERE item_id IN (${placeholders})`;
      
      console.log('[WALK-IN RENTAL] Fetching rental items with SQL:', checkItemsSql);
      console.log('[WALK-IN RENTAL] Item IDs:', itemIds);
      
      db.query(checkItemsSql, itemIds, (inventoryErr, rentalItems) => {
        if (inventoryErr || !rentalItems || rentalItems.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'One or more rental items not found'
          });
        }

        const unavailableItems = rentalItems.filter(item => item.status !== 'available');
        if (unavailableItems.length > 0) {
          return res.status(400).json({
            success: false,
            message: `Some items are not available: ${unavailableItems.map(i => i.item_name).join(', ')}`
          });
        }

        const startDate = eventDate ? new Date(eventDate) : new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + parseInt(rentalDuration) - 1);

        let totalPrice = 0;
        let totalDownpayment = 0;
        const orderItems = [];
        const bundleItems = [];

        rentalItems.forEach((rentalItem) => {
          const basePrice = parseFloat(rentalItem.price || 0); // Price is per 3 days
          const durationMultiplier = Math.ceil(parseInt(rentalDuration) / 3); // Calculate how many 3-day periods
          const itemPrice = basePrice * durationMultiplier;
          const itemDownpayment = parseFloat(rentalItem.downpayment || 0);
          
          totalPrice += itemPrice;
          totalDownpayment += itemDownpayment;

          bundleItems.push({
            id: rentalItem.item_id,
            item_name: rentalItem.item_name,
            brand: rentalItem.brand || '',
            size: rentalItem.size || '',
            category: rentalItem.category || '',
            image_url: rentalItem.image_url || '',
            front_image: rentalItem.front_image || '',
            back_image: rentalItem.back_image || '',
            side_image: rentalItem.side_image || '',
            individual_cost: itemPrice
          });

          orderItems.push({
            service_type: 'rental',
            service_id: rentalItem.item_id,
            quantity: 1,
            base_price: basePrice.toString(),
            final_price: itemPrice.toString(),
            rental_start_date: startDate.toISOString().split('T')[0],
            rental_end_date: endDate.toISOString().split('T')[0],
            pricing_factors: JSON.stringify({
              rental_duration: rentalDuration.toString(),
              base_price_per_3_days: basePrice.toString(),
              deposit_amount: itemDownpayment.toString(),
              downpayment: itemDownpayment.toString()
            }),
            specific_data: JSON.stringify({
              item_name: rentalItem.item_name,
              brand: rentalItem.brand || '',
              size: rentalItem.size || '',
              category: rentalItem.category || '',
              image_url: rentalItem.image_url || '',
              front_image: rentalItem.front_image || '',
              back_image: rentalItem.back_image || '',
              side_image: rentalItem.side_image || '',
              event_date: eventDate,
              is_bundle: isBundle && itemIds.length > 1,
              bundle_items: isBundle && itemIds.length > 1 ? bundleItems : null
            })
          });
        });

        const finalDownpayment = parseFloat(damageDeposit || totalDownpayment.toString());

        const orderData = {
          user_id: null,
          walk_in_customer_id: customer.id,
          order_type: 'walk_in',
          total_price: totalPrice.toString(),
          notes: notes || '',
          items: orderItems
        };

        Order.createWalkInOrder(orderData, (orderErr, orderResult) => {
          if (orderErr) {
            console.error('❌ Error creating walk-in rental order:', orderErr);
            console.error('Order data:', JSON.stringify(orderData, null, 2));
            return res.status(500).json({
              success: false,
              message: 'Error creating order',
              error: orderErr.message || orderErr
            });
          }

          const updatePlaceholders = itemIds.map(() => '?').join(',');
          const updateInventorySql = `
            UPDATE rental_inventory 
            SET status = 'rented',
                rented_by_customer_id = ?,
                rented_date = NOW()
            WHERE item_id IN (${updatePlaceholders})
          `;
          
          const updateValues = [customer.id, ...itemIds];
          console.log('[WALK-IN RENTAL] Updating inventory with SQL:', updateInventorySql);
          console.log('[WALK-IN RENTAL] Update values:', updateValues);
          
          db.query(updateInventorySql, updateValues, (updateErr, updateResult) => {
            if (updateErr) {
              console.error('[WALK-IN RENTAL] ❌ Error updating rental inventory:', updateErr);
              console.error('[WALK-IN RENTAL] SQL:', updateInventorySql);
              console.error('[WALK-IN RENTAL] Values:', updateValues);
              
            } else {
              console.log('[WALK-IN RENTAL] ✅ Inventory updated, affected rows:', updateResult?.affectedRows);
            }

            console.log('[WALK-IN RENTAL] ✅ Order created successfully');
            console.log('[WALK-IN RENTAL] Order result:', JSON.stringify(orderResult, null, 2));
            
            const orderId = orderResult?.orderId || orderResult?.order_id || null;
            if (!orderId) {
              console.error('[WALK-IN RENTAL] ❌ Order ID not found in result:', orderResult);
              return res.status(500).json({
                success: false,
                message: 'Order created but order ID not found in result',
                error: 'Invalid order result structure'
              });
            }
            
            res.json({
              success: true,
              message: `Walk-in rental order created successfully${isBundle && itemIds.length > 1 ? ' (bundle)' : ''}`,
              order: {
                orderId: orderId,
                customer: customer,
                totalPrice: totalPrice,
                rentalItems: rentalItems.map(item => ({
                  id: item.item_id,
                  name: item.item_name
                }))
              }
            });
          });
        });
      });
    });
  } catch (error) {
    console.error('Error in createRentalOrder:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

exports.createRepairOrder = async (req, res) => {
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      garmentType,
      damageLevel,
      description,
      preferredDate,
      preferredTime,
      estimatedPrice,
      notes
    } = req.body;

    if (!customerName || !customerPhone || !garmentType || !damageLevel || !description) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: customerName, customerPhone, garmentType, damageLevel, description'
      });
    }

    WalkInCustomer.findOrCreate({
      name: customerName,
      email: customerEmail,
      phone: customerPhone
    }, (err, customer) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Error creating/finding customer',
          error: err
        });
      }

      const totalPrice = parseFloat(estimatedPrice || 0);

      const orderItem = {
        service_type: 'repair',
        service_id: null,
        quantity: 1,
        base_price: totalPrice.toString(),
        final_price: totalPrice.toString(),
        appointment_date: preferredDate && preferredTime 
          ? `${preferredDate} ${preferredTime}:00`
          : null,
        pricing_factors: JSON.stringify({
          estimatedPrice: totalPrice.toString()
        }),
        specific_data: JSON.stringify({
          serviceName: `${garmentType} Repair`,
          garmentType: garmentType,
          damageLevel: damageLevel,
          description: description,
          preferredDate: preferredDate,
          preferredTime: preferredTime
        })
      };

      const orderData = {
        user_id: null,
        walk_in_customer_id: customer.id,
        order_type: 'walk_in',
        total_price: totalPrice.toString(),
        notes: notes || '',
        items: [orderItem]
      };

      Order.createWalkInOrder(orderData, (orderErr, orderResult) => {
        if (orderErr) {
          return res.status(500).json({
            success: false,
            message: 'Error creating order',
            error: orderErr
          });
        }

        res.json({
          success: true,
          message: 'Walk-in repair order created successfully',
          order: {
            orderId: orderResult.orderId,
            customer: customer,
            totalPrice: totalPrice
          }
        });
      });
    });
  } catch (error) {
    console.error('Error in createRepairOrder:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

exports.createCustomizationOrder = async (req, res) => {
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      garmentType,
      fabricType,
      patternType,
      preferredDate,
      preferredTime,
      estimatedPrice,
      notes
    } = req.body;

    let measurements = req.body.measurements;
    if (typeof measurements === 'string') {
      try {
        measurements = JSON.parse(measurements);
      } catch (e) {
        measurements = {};
      }
    }

    const referenceImagePath = req.file ? req.file.path.replace(/\\/g, '/') : null;

    if (!customerName || !customerPhone || !garmentType) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: customerName, customerPhone, garmentType'
      });
    }

    WalkInCustomer.findOrCreate({
      name: customerName,
      email: customerEmail,
      phone: customerPhone
    }, (err, customer) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Error creating/finding customer',
          error: err
        });
      }

      const totalPrice = parseFloat(estimatedPrice || 0);

      const orderItem = {
        service_type: 'customization',
        service_id: null,
        quantity: 1,
        base_price: totalPrice.toString(),
        final_price: totalPrice.toString(),
        appointment_date: preferredDate && preferredTime 
          ? `${preferredDate} ${preferredTime}:00`
          : null,
        pricing_factors: JSON.stringify({
          estimatedPrice: totalPrice.toString()
        }),
        specific_data: JSON.stringify({
          serviceName: `${garmentType} Customization`,
          garmentType: garmentType,
          fabricType: fabricType || '',
          patternType: patternType || '',
          measurements: measurements || {},
          preferredDate: preferredDate,
          preferredTime: preferredTime,
          referenceImage: referenceImagePath
        })
      };

      const orderData = {
        user_id: null,
        walk_in_customer_id: customer.id,
        order_type: 'walk_in',
        total_price: totalPrice.toString(),
        notes: notes || '',
        items: [orderItem]
      };

      Order.createWalkInOrder(orderData, (orderErr, orderResult) => {
        if (orderErr) {
          return res.status(500).json({
            success: false,
            message: 'Error creating order',
            error: orderErr
          });
        }

        // Save measurements to customer_measurements table if provided
        if (measurements && (measurements.top || measurements.bottom)) {
          const CustomerMeasurements = require('../model/CustomerMeasurementsModel');
          CustomerMeasurements.upsert(customer.id, {
            top: measurements.top || {},
            bottom: measurements.bottom || {},
            notes: measurements.notes || notes || '',
            isWalkIn: true
          }, (measErr) => {
            if (measErr) {
              console.error('[WALK-IN CUSTOMIZATION] Error saving measurements:', measErr);
            } else {
              console.log('[WALK-IN CUSTOMIZATION] Measurements saved for customer:', customer.id);
            }
          });
        }

        res.json({
          success: true,
          message: 'Walk-in customization order created successfully',
          order: {
            orderId: orderResult.orderId,
            customer: customer,
            totalPrice: totalPrice,
            referenceImage: referenceImagePath
          }
        });
      });
    });
  } catch (error) {
    console.error('Error in createCustomizationOrder:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

exports.getAllWalkInOrders = (req, res) => {
  const sql = `
    SELECT 
      o.*,
      wc.name as customer_name,
      wc.email as customer_email,
      wc.phone as customer_phone,
      COUNT(oi.item_id) as item_count
    FROM orders o
    INNER JOIN walk_in_customers wc ON o.walk_in_customer_id = wc.id
    LEFT JOIN order_items oi ON oi.order_id = o.order_id
    WHERE o.order_type = 'walk_in'
    GROUP BY o.order_id
    ORDER BY o.order_date DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error fetching walk-in orders',
        error: err
      });
    }

    res.json({
      success: true,
      orders: results
    });
  });
};

exports.getWalkInOrderById = (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT 
      o.*,
      wc.name as customer_name,
      wc.email as customer_email,
      wc.phone as customer_phone,
      oi.*
    FROM orders o
    INNER JOIN walk_in_customers wc ON o.walk_in_customer_id = wc.id
    LEFT JOIN order_items oi ON oi.order_id = o.order_id
    WHERE o.order_id = ? AND o.order_type = 'walk_in'
  `;

  db.query(sql, [id], (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error fetching walk-in order',
        error: err
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Walk-in order not found'
      });
    }

    const order = {
      ...results[0],
      items: results.map(row => ({
        item_id: row.item_id,
        service_type: row.service_type,
        quantity: row.quantity,
        price: row.final_price,
        specific_data: row.specific_data
      }))
    };

    res.json({
      success: true,
      order: order
    });
  });
};

exports.searchWalkInCustomers = (req, res) => {
  const { search } = req.query;

  if (!search) {
    return res.status(400).json({
      success: false,
      message: 'Search term is required'
    });
  }

  WalkInCustomer.search(search, (err, customers) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error searching customers',
        error: err
      });
    }

    res.json({
      success: true,
      customers: customers
    });
  });
};

