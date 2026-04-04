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
      rentalItemSelections,
      rentalDuration,
      eventDate,
      damageDeposit,
      paymentMode,
      flatRateUntilDate,
      isBundle,
      notes
    } = req.body;

    const normalizedPaymentMode = String(paymentMode || 'regular').toLowerCase();
    if (!['regular', 'flat_rate'].includes(normalizedPaymentMode)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment mode. Use regular or flat_rate.'
      });
    }

    let normalizedFlatRateUntilDate = null;
    if (normalizedPaymentMode === 'flat_rate') {
      if (!flatRateUntilDate) {
        return res.status(400).json({
          success: false,
          message: 'Flat rate until date is required for flat rate mode'
        });
      }

      const parsedFlatRateDate = new Date(flatRateUntilDate);
      if (Number.isNaN(parsedFlatRateDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid flat rate until date'
        });
      }
      normalizedFlatRateUntilDate = String(flatRateUntilDate).slice(0, 10);
    }

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

        const parsedDuration = Math.max(1, parseInt(rentalDuration, 10) || 1);
        const durationMultiplier = Math.ceil(parsedDuration / 3);

        const normalizeSelectionMap = () => {
          const map = new Map();
          if (!Array.isArray(rentalItemSelections)) return map;
          rentalItemSelections.forEach((entry) => {
            const itemId = parseInt(entry?.itemId || entry?.item_id || entry?.id, 10);
            if (!itemId) return;
            const sizes = Array.isArray(entry?.selected_sizes)
              ? entry.selected_sizes
              : (Array.isArray(entry?.selectedSizes) ? entry.selectedSizes : []);
            const normalizedSizes = sizes
              .map((size) => {
                const sizeKey = String(size?.sizeKey || size?.size_key || '').trim();
                const label = String(size?.label || sizeKey).trim();
                const quantity = Math.max(0, parseInt(size?.quantity, 10) || 0);
                const price = Math.max(0, parseFloat(size?.price || 0));
                if (!sizeKey || quantity <= 0) return null;
                return { sizeKey, label, quantity, price };
              })
              .filter(Boolean);

            const quantityFromSizes = normalizedSizes.reduce((sum, s) => sum + s.quantity, 0);
            const quantity = Math.max(0, parseInt(entry?.quantity, 10) || quantityFromSizes || 1);
            map.set(itemId, { quantity, selected_sizes: normalizedSizes });
          });
          return map;
        };

        const selectionMap = normalizeSelectionMap();

        let totalPrice = 0;
        let totalDownpayment = 0;
        const orderItems = [];
        const bundleItems = [];
        const inventoryUpdates = [];
        let validationError = null;

        rentalItems.forEach((rentalItem) => {
          const basePrice = parseFloat(rentalItem.price || 0);
          const itemDownpaymentBase = parseFloat(rentalItem.downpayment || 0);
          const selectedEntry = selectionMap.get(parseInt(rentalItem.item_id, 10)) || null;

          let parsedSize = null;
          try {
            parsedSize = rentalItem.size && typeof rentalItem.size === 'string'
              ? JSON.parse(rentalItem.size)
              : rentalItem.size;
          } catch {
            parsedSize = null;
          }

          const sizeEntries = Array.isArray(parsedSize?.size_entries) ? parsedSize.size_entries : [];
          const hasSizeProfile = sizeEntries.length > 0;

          let normalizedSelectedSizes = [];
          let itemQuantity = 1;

          if (hasSizeProfile) {
            const requestedSizes = selectedEntry?.selected_sizes || [];
            if (!requestedSizes.length) {
              validationError = `Please select size and quantity for "${rentalItem.item_name}".`;
              return;
            }

            const byKey = new Map();
            sizeEntries.forEach((entry) => {
              const key = String(entry?.sizeKey || '').trim();
              if (!key) return;
              byKey.set(key, {
                key,
                label: entry?.label || key,
                available: Math.max(0, parseInt(entry?.quantity, 10) || 0),
                price: Math.max(0, parseFloat(entry?.price || 0))
              });
            });

            requestedSizes.forEach((sel) => {
              const key = String(sel.sizeKey || '').trim();
              const qty = Math.max(0, parseInt(sel.quantity, 10) || 0);
              if (!key || qty <= 0) return;
              const source = byKey.get(key);
              if (!source) {
                validationError = `Size "${sel.label || key}" not found for "${rentalItem.item_name}".`;
                return;
              }
              if (qty > source.available) {
                validationError = `Not enough stock for "${source.label}" in "${rentalItem.item_name}". Available: ${source.available}, requested: ${qty}.`;
                return;
              }
              normalizedSelectedSizes.push({
                sizeKey: key,
                label: source.label,
                quantity: qty,
                price: source.price > 0 ? source.price : basePrice
              });
            });

            itemQuantity = normalizedSelectedSizes.reduce((sum, sel) => sum + sel.quantity, 0);
            if (itemQuantity <= 0) {
              validationError = `Please select at least one quantity for "${rentalItem.item_name}".`;
              return;
            }
          } else {
            itemQuantity = Math.max(1, parseInt(selectedEntry?.quantity, 10) || 1);
          }

          const itemPrice = hasSizeProfile
            ? normalizedSelectedSizes.reduce((sum, sel) => sum + (sel.quantity * (sel.price > 0 ? sel.price : basePrice) * durationMultiplier), 0)
            : (basePrice * durationMultiplier * itemQuantity);
          const itemDownpayment = itemDownpaymentBase * itemQuantity;
          
          totalPrice += itemPrice;
          totalDownpayment += itemDownpayment;

          const sizeSummary = hasSizeProfile
            ? normalizedSelectedSizes.map((sel) => `${sel.label} x${sel.quantity}`).join(', ')
            : (rentalItem.size || 'N/A');

          if (hasSizeProfile) {
            inventoryUpdates.push({
              item_id: rentalItem.item_id,
              parsedSize,
              selected_sizes: normalizedSelectedSizes
            });
          } else {
            inventoryUpdates.push({
              item_id: rentalItem.item_id,
              quantity: itemQuantity,
              total_available: Math.max(0, parseInt(rentalItem.total_available, 10) || 0)
            });
          }

          bundleItems.push({
            id: rentalItem.item_id,
            item_name: rentalItem.item_name,
            brand: rentalItem.brand || '',
            size: sizeSummary,
            category: rentalItem.category || '',
            image_url: rentalItem.image_url || '',
            front_image: rentalItem.front_image || '',
            back_image: rentalItem.back_image || '',
            side_image: rentalItem.side_image || '',
            selected_sizes: normalizedSelectedSizes,
            individual_cost: itemPrice
          });

          orderItems.push({
            service_type: 'rental',
            service_id: rentalItem.item_id,
            quantity: itemQuantity,
            base_price: basePrice.toString(),
            final_price: itemPrice.toString(),
            rental_start_date: startDate.toISOString().split('T')[0],
            rental_end_date: endDate.toISOString().split('T')[0],
            pricing_factors: JSON.stringify({
              rental_duration: parsedDuration.toString(),
              base_price_per_3_days: basePrice.toString(),
              duration_multiplier: durationMultiplier.toString(),
              deposit_amount: itemDownpayment.toString(),
              downpayment: itemDownpayment.toString(),
              rental_payment_mode: normalizedPaymentMode,
              ...(normalizedFlatRateUntilDate ? { flat_rate_until_date: normalizedFlatRateUntilDate } : {})
            }),
            specific_data: JSON.stringify({
              item_name: rentalItem.item_name,
              brand: rentalItem.brand || '',
              size: sizeSummary,
              selected_sizes: normalizedSelectedSizes,
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

        if (validationError) {
          return res.status(400).json({
            success: false,
            message: validationError
          });
        }

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

          const orderId = orderResult?.orderId || orderResult?.order_id || null;
          if (!orderId) {
            return res.status(500).json({
              success: false,
              message: 'Order created but order ID not found in result',
              error: 'Invalid order result structure'
            });
          }

          const applyInventoryUpdates = (index = 0) => {
            if (index >= inventoryUpdates.length) {
              console.log('[WALK-IN RENTAL] ✅ Inventory updates completed');
              return res.json({
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
            }

            const updateEntry = inventoryUpdates[index];

            if (updateEntry.parsedSize && Array.isArray(updateEntry.parsedSize.size_entries)) {
              const nextSizePayload = { ...updateEntry.parsedSize, size_entries: [...updateEntry.parsedSize.size_entries] };
              const byKey = new Map();
              nextSizePayload.size_entries.forEach((entry, idx) => {
                const key = String(entry?.sizeKey || '').trim();
                if (key) byKey.set(key, idx);
              });

              updateEntry.selected_sizes.forEach((sel) => {
                const idxSize = byKey.get(String(sel.sizeKey || '').trim());
                if (idxSize === undefined) return;
                const current = Math.max(0, parseInt(nextSizePayload.size_entries[idxSize].quantity, 10) || 0);
                nextSizePayload.size_entries[idxSize].quantity = Math.max(0, current - sel.quantity);
              });

              const nextTotal = nextSizePayload.size_entries.reduce((sum, entry) => {
                return sum + Math.max(0, parseInt(entry?.quantity, 10) || 0);
              }, 0);
              const nextStatus = nextTotal > 0 ? 'available' : 'rented';

              const updateSql = `
                UPDATE rental_inventory
                SET size = ?, total_available = ?, status = ?, rented_by_customer_id = ?, rented_date = NOW()
                WHERE item_id = ?
              `;
              const values = [JSON.stringify(nextSizePayload), nextTotal, nextStatus, customer.id, updateEntry.item_id];

              return db.query(updateSql, values, (invErr) => {
                if (invErr) {
                  console.error('[WALK-IN RENTAL] ❌ Error updating size inventory:', invErr);
                  return res.status(500).json({
                    success: false,
                    message: 'Order created but failed to update rental size inventory',
                    error: invErr.message || invErr
                  });
                }
                applyInventoryUpdates(index + 1);
              });
            }

            const currentAvailable = Math.max(0, parseInt(updateEntry.total_available, 10) || 0);
            const nextAvailable = Math.max(0, currentAvailable - Math.max(1, parseInt(updateEntry.quantity, 10) || 1));
            const nextStatus = nextAvailable > 0 ? 'available' : 'rented';
            const updateSql = `
              UPDATE rental_inventory
              SET total_available = ?, status = ?, rented_by_customer_id = ?, rented_date = NOW()
              WHERE item_id = ?
            `;
            const values = [nextAvailable, nextStatus, customer.id, updateEntry.item_id];
            db.query(updateSql, values, (invErr) => {
              if (invErr) {
                console.error('[WALK-IN RENTAL] ❌ Error updating inventory:', invErr);
                return res.status(500).json({
                  success: false,
                  message: 'Order created but failed to update rental inventory',
                  error: invErr.message || invErr
                });
              }
              applyInventoryUpdates(index + 1);
            });
          };

          applyInventoryUpdates(0);
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

