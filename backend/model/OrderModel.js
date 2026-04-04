const db = require('../config/db');

function parseJsonSafely(value, fallback = {}) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function buildRentalReservations(cartItems) {
  const reservations = new Map();

  const upsertReservation = (itemId, qty, selectedSizes = []) => {
    if (!itemId || qty < 0) return;

    const existing = reservations.get(itemId) || {
      itemId,
      qty: 0,
      sizeSelections: {}
    };

    let derivedQtyFromSizes = 0;

    if (Array.isArray(selectedSizes) && selectedSizes.length > 0) {
      selectedSizes.forEach((entry) => {
        let key = String(entry?.sizeKey ?? entry?.size_key ?? '').trim();
        if (!key && entry?.label) {
          const label = String(entry.label).toLowerCase();
          if (label.includes('small') || label.trim() === 's') key = 'small';
          else if (label.includes('medium') || label.trim() === 'm') key = 'medium';
          else if (label.includes('large') || label.trim() === 'l') key = 'large';
          else if (label.includes('extra') || label.includes('xl') || label.trim() === 'xl') key = 'extra_large';
        }
        const sizeQty = Math.max(0, parseInt(entry?.quantity, 10) || 0);
        if (!key || sizeQty <= 0) return;
        existing.sizeSelections[key] = (existing.sizeSelections[key] || 0) + sizeQty;
        derivedQtyFromSizes += sizeQty;
      });
    }

    // Keep total_available consistent with per-size deductions when size selections exist.
    existing.qty += derivedQtyFromSizes > 0 ? derivedQtyFromSizes : qty;

    reservations.set(itemId, existing);
  };

  (cartItems || []).forEach((cartItem) => {
    if (!cartItem || cartItem.service_type !== 'rental') return;

    const specificData = parseJsonSafely(cartItem.specific_data, {});

    if (specificData?.is_bundle && Array.isArray(specificData.bundle_items) && specificData.bundle_items.length > 0) {
      specificData.bundle_items.forEach((bundleItem) => {
        const bundleItemId = parseInt(bundleItem?.item_id ?? bundleItem?.id ?? bundleItem?.service_id, 10);
        const bundleQtyRaw = parseInt(bundleItem?.quantity, 10);
        const bundleQty = Number.isNaN(bundleQtyRaw) ? 1 : Math.max(0, bundleQtyRaw);

        const selectedSizes =
          Array.isArray(bundleItem?.selected_sizes) ? bundleItem.selected_sizes :
          (Array.isArray(bundleItem?.selectedSizes) ? bundleItem.selectedSizes : []);

        upsertReservation(bundleItemId, bundleQty, selectedSizes);
      });
      return;
    }

    const itemId = parseInt(cartItem.service_id, 10);
    const qtyRaw = parseInt(cartItem.quantity, 10);
    const qty = Number.isNaN(qtyRaw) ? 1 : Math.max(0, qtyRaw);
    const selectedSizes = Array.isArray(specificData?.selected_sizes) ? specificData.selected_sizes : [];
    upsertReservation(itemId, qty, selectedSizes);
  });

  return Array.from(reservations.values());
}

function reserveRentalInventoryFromCartItems(cartItems, callback) {
  const reservations = buildRentalReservations(cartItems);

  if (reservations.length === 0) {
    return callback(null);
  }

  const itemIds = reservations.map((r) => r.itemId);
  const placeholders = itemIds.map(() => '?').join(',');

  const selectSql = `
    SELECT item_id, item_name, total_available, size
    FROM rental_inventory
    WHERE item_id IN (${placeholders})
  `;

  db.query(selectSql, itemIds, (selectErr, rows) => {
    if (selectErr) return callback(selectErr);

    const rowMap = new Map((rows || []).map((row) => [Number(row.item_id), row]));
    const updatedSizeByItem = new Map();

    for (const reservation of reservations) {
      const row = rowMap.get(Number(reservation.itemId));
      if (!row) {
        const err = new Error(`Rental item ${reservation.itemId} not found.`);
        err.statusCode = 400;
        return callback(err);
      }

      const currentAvailable = parseInt(row.total_available, 10) || 0;
      if (currentAvailable < reservation.qty) {
        const err = new Error(`Not enough stock for ${row.item_name || `item ${reservation.itemId}`}. Available: ${currentAvailable}, requested: ${reservation.qty}.`);
        err.statusCode = 400;
        return callback(err);
      }

      const sizeSelectionEntries = Object.entries(reservation.sizeSelections || {});
      if (sizeSelectionEntries.length > 0) {
        const sizePayload = parseJsonSafely(row.size, null);
        if (!sizePayload || sizePayload.format !== 'rental_size_v2' || !Array.isArray(sizePayload.size_entries)) {
          const err = new Error(`Size profile missing for ${row.item_name || `item ${reservation.itemId}`}. Please re-save the rental item in admin.`);
          err.statusCode = 400;
          return callback(err);
        }

        const normalizedEntries = sizePayload.size_entries.map((entry) => ({ ...entry }));

        for (const [selectedKey, requestedQty] of sizeSelectionEntries) {
          const entryIndex = normalizedEntries.findIndex((entry) => {
            if (entry.sizeKey === selectedKey) return true;
            if (entry.sizeKey === 'custom' && String(entry.customLabel || '').trim().toLowerCase() === selectedKey.toLowerCase()) return true;
            return false;
          });

          if (entryIndex === -1) {
            const err = new Error(`Selected size "${selectedKey}" not found for ${row.item_name || `item ${reservation.itemId}`}.`);
            err.statusCode = 400;
            return callback(err);
          }

          const currentSizeQty = Math.max(0, parseInt(normalizedEntries[entryIndex].quantity, 10) || 0);
          if (currentSizeQty < requestedQty) {
            const err = new Error(`Not enough stock for size "${selectedKey}" of ${row.item_name || `item ${reservation.itemId}`}. Available: ${currentSizeQty}, requested: ${requestedQty}.`);
            err.statusCode = 400;
            return callback(err);
          }

          normalizedEntries[entryIndex].quantity = currentSizeQty - requestedQty;
        }

        updatedSizeByItem.set(reservation.itemId, JSON.stringify({ ...sizePayload, size_entries: normalizedEntries }));
      }
    }

    const applied = [];

    const rollbackApplied = (done) => {
      if (applied.length === 0) return done();

      let idx = 0;
      const rollbackNext = () => {
        if (idx >= applied.length) return done();
        const row = applied[idx++];
        const rollbackSql = `
          UPDATE rental_inventory
          SET total_available = total_available + ?,
              size = ?,
              status = CASE WHEN total_available + ? > 0 AND status = 'unavailable' THEN 'available' ELSE status END
          WHERE item_id = ?
        `;
        db.query(rollbackSql, [row.qty, row.previousSize, row.qty, row.itemId], () => rollbackNext());
      };
      rollbackNext();
    };

    let applyIndex = 0;
    const applyNext = () => {
      if (applyIndex >= reservations.length) return callback(null);

      const reservation = reservations[applyIndex++];
      const row = rowMap.get(Number(reservation.itemId));
      const nextSizePayload = updatedSizeByItem.has(reservation.itemId)
        ? updatedSizeByItem.get(reservation.itemId)
        : row.size;

      const updateSql = `
        UPDATE rental_inventory
        SET total_available = total_available - ?,
            size = ?,
            status = CASE WHEN total_available - ? <= 0 THEN 'unavailable' ELSE status END
        WHERE item_id = ? AND total_available >= ?
      `;

      db.query(updateSql, [reservation.qty, nextSizePayload, reservation.qty, reservation.itemId, reservation.qty], (updateErr, updateResult) => {
        if (updateErr) {
          return rollbackApplied(() => callback(updateErr));
        }

        if (!updateResult || updateResult.affectedRows === 0) {
          const err = new Error(`Stock changed while processing rental item ${reservation.itemId}. Please try again.`);
          err.statusCode = 409;
          return rollbackApplied(() => callback(err));
        }

        applied.push({ itemId: reservation.itemId, qty: reservation.qty, previousSize: row.size });
        applyNext();
      });
    };

    applyNext();
  });
}

const Order = {
  
  createFromCart: (userId, cartItems, totalPrice, notes, callback) => {
    const orderSql = `
      INSERT INTO orders (user_id, total_price, status, order_date, notes)
      VALUES (?, ?, 'pending', NOW(), ?)
    `;

    db.query(orderSql, [userId, totalPrice, notes], (err, orderResult) => {
      if (err) {
        return callback(err, null);
      }

      const orderId = orderResult.insertId;

      const itemValues = cartItems.map(item => {
        let pricingFactors = item.pricing_factors || '{}';

        if (item.service_type === 'rental') {
          try {
            const factors = typeof pricingFactors === 'string' ? JSON.parse(pricingFactors) : pricingFactors;
            const totalPrice = parseFloat(item.final_price || 0);
            const expectedDownpayment = totalPrice * 0.5;

            factors.downpayment = expectedDownpayment.toString();
            factors.down_payment = expectedDownpayment.toString();
            
            pricingFactors = JSON.stringify(factors);
          } catch (e) {
            console.error('Error parsing pricing factors for rental:', e);
          }
        }
        
        return [
          orderId,
          item.service_type,
          item.service_id,
          item.quantity || 1,
          item.base_price,
          item.final_price,
          item.appointment_date,
          item.rental_start_date,
          item.rental_end_date,
          pricingFactors,
          item.specific_data || '{}'
        ];
      });

      const itemSql = `
        INSERT INTO order_items (
          order_id, service_type, service_id, quantity, base_price, final_price,
          appointment_date, rental_start_date, rental_end_date, pricing_factors, specific_data
        ) VALUES ?
      `;

      db.query(itemSql, [itemValues], (itemErr, itemResult) => {
        if (itemErr) {
          return callback(itemErr, null);
        }

        reserveRentalInventoryFromCartItems(cartItems, (reserveErr) => {
          if (reserveErr) {
            const cleanupItemsSql = `DELETE FROM order_items WHERE order_id = ?`;
            db.query(cleanupItemsSql, [orderId], () => {
              const cleanupOrderSql = `DELETE FROM orders WHERE order_id = ?`;
              db.query(cleanupOrderSql, [orderId], () => {
                return callback(reserveErr, null);
              });
            });
            return;
          }

          const getOrderItemsSql = `
            SELECT item_id, service_type, appointment_date, specific_data
            FROM order_items
            WHERE order_id = ?
            ORDER BY item_id ASC
          `;
        
          db.query(getOrderItemsSql, [orderId], (getItemsErr, orderItems) => {
          
          const AppointmentSlot = require('./AppointmentSlotModel');

          let linkedCount = 0;
          const totalAppointmentItems = cartItems.filter(item => 
            ['dry_cleaning', 'repair', 'customization'].includes(item.service_type)
          ).length;

          const linkSlotPromises = [];
          
          if (!getItemsErr && orderItems) {
            
            cartItems.forEach((cartItem, index) => {
              if (!cartItem || !cartItem.cart_id) return;
              
              const orderItem = orderItems[index];
              if (!orderItem) return;

              if (['dry_cleaning', 'repair', 'customization'].includes(cartItem.service_type)) {
                
                const linkPromise = new Promise((resolve) => {
                  
                  AppointmentSlot.getSlotByCartItem(cartItem.cart_id, (slotErr, slots) => {
                    if (slotErr) {
                      console.error(`[ORDER] Error getting slot by cart item ${cartItem.cart_id}:`, slotErr);
                      resolve(false);
                      return;
                    }

                    const unlinkedSlots = slots ? slots.filter(s => !s.order_item_id) : [];
                    
                    if (!unlinkedSlots || unlinkedSlots.length === 0) {
                      console.warn(`[ORDER] ⚠️ No slot found for cart_item_id ${cartItem.cart_id}, service_type: ${cartItem.service_type}`);
                      console.warn(`[ORDER] This means the slot was not linked to cart item. Checking for unlinked slots...`);

                      const appointmentDate = cartItem.specific_data?.pickupDate || cartItem.specific_data?.preferredDate;
                      const appointmentTime = cartItem.specific_data?.appointmentTime || cartItem.specific_data?.pickupDate?.split('T')[1]?.substring(0, 8);
                      
                      if (appointmentDate && appointmentTime) {
                        const datePart = appointmentDate.includes('T') ? appointmentDate.split('T')[0] : appointmentDate;
                        const timePart = appointmentTime.includes(':') && appointmentTime.split(':').length === 3 
                          ? appointmentTime 
                          : appointmentTime + ':00';
                        
                        console.log(`[ORDER] Attempting to find slot by date/time: ${datePart}, ${timePart}`);

                        const db = require('../config/db');
                        const findSlotSql = `
                          SELECT * FROM appointment_slots 
                          WHERE user_id = ? 
                          AND service_type = ? 
                          AND appointment_date = ? 
                          AND appointment_time = ? 
                          AND (cart_item_id = ? OR (cart_item_id IS NULL AND order_item_id IS NULL))
                          AND status = 'booked'
                          ORDER BY created_at DESC
                          LIMIT 1
                        `;
                        db.query(findSlotSql, [cartItem.user_id || null, cartItem.service_type, datePart, timePart, cartItem.cart_id], (findErr, foundSlots) => {
                          if (findErr || !foundSlots || foundSlots.length === 0) {
                            console.error(`[ORDER] Could not find any matching slot for cart_item_id ${cartItem.cart_id}`);
                            resolve(false);
                          } else {
                            const slot = foundSlots[0];
                            console.log(`[ORDER] Found unlinked slot ${slot.slot_id} for cart_item_id ${cartItem.cart_id}`);
                            AppointmentSlot.updateSlotWithOrder(slot.slot_id, orderItem.item_id, (linkErr, updateResult) => {
                              if (linkErr) {
                                console.error(`[ORDER] Error linking slot ${slot.slot_id} to order item ${orderItem.item_id}:`, linkErr);
                                resolve(false);
                              } else {
                                linkedCount++;
                                console.log(`[ORDER] ✅ Linked slot ${slot.slot_id} to order item ${orderItem.item_id} (fallback method)`);
                                resolve(true);
                              }
                            });
                          }
                        });
                      } else {
                        resolve(false);
                      }
                      return;
                    }
                    
                    const slot = unlinkedSlots[0];
                    console.log(`[ORDER] Found slot ${slot.slot_id} for cart_item_id ${cartItem.cart_id}`);
                    console.log(`[ORDER] Slot details: slot_id=${slot.slot_id}, date=${slot.appointment_date}, time=${slot.appointment_time}, service_type=${slot.service_type}, current_order_item_id=${slot.order_item_id || 'NULL'}, current_cart_item_id=${slot.cart_item_id || 'NULL'}`);

                    AppointmentSlot.updateSlotWithOrder(slot.slot_id, orderItem.item_id, (linkErr, updateResult) => {
                      if (linkErr) {
                        console.error(`[ORDER] Error linking slot ${slot.slot_id} to order item ${orderItem.item_id}:`, linkErr);
                        resolve(false);
                      } else {
                        linkedCount++;
                        console.log(`[ORDER] ✅ Linked slot ${slot.slot_id} (${slot.appointment_date} ${slot.appointment_time}) to order item ${orderItem.item_id} (from cart_item_id ${cartItem.cart_id})`);
                        console.log(`[ORDER] Update result:`, updateResult?.affectedRows || 'unknown');
                        resolve(true);
                      }
                    });
                  });
                });
                
                linkSlotPromises.push(linkPromise);
              }
            });
          }

          if (linkSlotPromises.length > 0) {
            Promise.all(linkSlotPromises).then(() => {
              console.log(`[ORDER] Slot linking completed. Linked ${linkedCount} out of ${totalAppointmentItems} appointment slots.`);

              const OrderTracking = require('./OrderTrackingModel');
              const trackingItems = orderItems ? orderItems.map((item) => ({
                order_item_id: item.item_id,
                service_type: item.service_type
              })) : cartItems.map((item, index) => ({
                order_item_id: itemResult.insertId + index, 
                service_type: item.service_type
              }));

              OrderTracking.initializeOrderTracking(trackingItems, (trackingErr) => {
                if (trackingErr) {
                  console.error('Error initializing order tracking:', trackingErr);
                }
              });

              callback(null, {
                orderId: orderId,
                orderResult: orderResult,
                itemResult: itemResult
              });
            }).catch((err) => {
              console.error('[ORDER] Error during slot linking:', err);
              
              callback(null, {
                orderId: orderId,
                orderResult: orderResult,
                itemResult: itemResult
              });
            });
          } else {
            
            const OrderTracking = require('./OrderTrackingModel');
            const trackingItems = orderItems ? orderItems.map((item) => ({
              order_item_id: item.item_id,
              service_type: item.service_type
            })) : cartItems.map((item, index) => ({
              order_item_id: itemResult.insertId + index, 
              service_type: item.service_type
            }));

            OrderTracking.initializeOrderTracking(trackingItems, (trackingErr) => {
              if (trackingErr) {
                console.error('Error initializing order tracking:', trackingErr);
              }
            });

            callback(null, {
              orderId: orderId,
              orderResult: orderResult,
              itemResult: itemResult
            });
          }
          });
        });
      });
    });
  },

  createWalkInOrder: (orderData, callback) => {
    const { user_id, walk_in_customer_id, order_type, total_price, notes, items } = orderData;

    const orderSql = `
      INSERT INTO orders (user_id, walk_in_customer_id, order_type, total_price, status, order_date, notes)
      VALUES (?, ?, ?, ?, 'pending', NOW(), ?)
    `;

    console.log('[ORDER MODEL] Creating walk-in order with data:', {
      user_id,
      walk_in_customer_id,
      order_type,
      total_price,
      notes,
      items_count: items?.length || 0
    });

    db.query(orderSql, [user_id, walk_in_customer_id, order_type, total_price, notes], (err, orderResult) => {
      if (err) {
        console.error('[ORDER MODEL] ❌ Error inserting order:', err);
        console.error('[ORDER MODEL] SQL:', orderSql);
        console.error('[ORDER MODEL] Values:', [user_id, walk_in_customer_id, order_type, total_price, notes]);
        return callback(err, null);
      }

      const orderId = orderResult.insertId;

      if (!items || items.length === 0) {
        return callback(null, { orderId: orderId });
      }

      const itemValues = items.map(item => {
        let pricingFactors = item.pricing_factors || '{}';

        if (item.service_type === 'rental') {
          try {
            const factors = typeof pricingFactors === 'string' ? JSON.parse(pricingFactors) : pricingFactors;
            const totalPrice = parseFloat(item.final_price || 0);
            const expectedDownpayment = totalPrice * 0.5;
            
            factors.downpayment = expectedDownpayment.toString();
            factors.down_payment = expectedDownpayment.toString();
            
            pricingFactors = JSON.stringify(factors);
          } catch (e) {
            console.error('Error parsing pricing factors for rental:', e);
          }
        }
        
        return [
          orderId,
          item.service_type,
          item.service_id,
          item.quantity || 1,
          item.base_price,
          item.final_price,
          item.appointment_date,
          item.rental_start_date,
          item.rental_end_date,
          pricingFactors,
          item.specific_data || '{}'
        ];
      });

      const itemSql = `
        INSERT INTO order_items (
          order_id, service_type, service_id, quantity, base_price, final_price,
          appointment_date, rental_start_date, rental_end_date, pricing_factors, specific_data,
          approval_status
        ) VALUES ?
      `;

      const itemValuesWithStatus = itemValues.map(item => {
        
        const serviceType = item[1]; 
        
        const status = (serviceType === 'rental') ? 'rented' : 'accepted';
        return [...item, status];
      });

      db.query(itemSql, [itemValuesWithStatus], (itemErr, itemResult) => {
        if (itemErr) {
          return callback(itemErr, null);
        }

        const OrderTracking = require('./OrderTrackingModel');
        const trackingItems = items.map((item, index) => ({
          order_item_id: itemResult.insertId + index,
          service_type: item.service_type
        }));

        OrderTracking.initializeOrderTracking(trackingItems, (trackingErr) => {
          if (trackingErr) {
            console.error('Error initializing order tracking:', trackingErr);
          }
          console.log('[ORDER MODEL] ✅ Order created successfully, orderId:', orderId);
          callback(null, { orderId: orderId, orderResult: orderResult, itemResult: itemResult });
        });
      });
    });
  },

  getByUser: (userId, callback) => {
    const sql = `
      SELECT 
        o.*,
        DATE_FORMAT(o.order_date, '%Y-%m-%d %H:%i:%s') as order_date,
        u.first_name,
        u.last_name,
        u.email
      FROM orders o
      JOIN user u ON o.user_id = u.user_id
      WHERE o.user_id = ?
      ORDER BY o.order_date DESC
    `;
    db.query(sql, [userId], callback);
  },

  getAll: (callback) => {
    const sql = `
      SELECT 
        o.*,
        DATE_FORMAT(o.order_date, '%Y-%m-%d %H:%i:%s') as order_date,
        u.first_name,
        u.last_name,
        u.email,
        u.phone_number,
        wc.name as walk_in_customer_name,
        wc.email as walk_in_customer_email,
        wc.phone as walk_in_customer_phone
      FROM orders o
      LEFT JOIN user u ON o.user_id = u.user_id
      LEFT JOIN walk_in_customers wc ON o.walk_in_customer_id = wc.id
      ORDER BY o.order_date DESC
    `;
    db.query(sql, callback);
  },

  getById: (orderId, callback) => {
    const sql = `
      SELECT 
        o.*,
        DATE_FORMAT(o.order_date, '%Y-%m-%d %H:%i:%s') as order_date,
        u.first_name,
        u.last_name,
        u.email
      FROM orders o
      JOIN user u ON o.user_id = u.user_id
      WHERE o.order_id = ?
    `;
    db.query(sql, [orderId], callback);
  },

  getOrderItems: (orderId, callback) => {
    const sql = `
      SELECT 
        oi.*,
        DATE_FORMAT(oi.appointment_date, '%Y-%m-%d %H:%i:%s') as appointment_date,
        DATE_FORMAT(oi.rental_start_date, '%Y-%m-%d') as rental_start_date,
        DATE_FORMAT(oi.rental_end_date, '%Y-%m-%d') as rental_end_date
      FROM order_items oi
      WHERE oi.order_id = ?
      ORDER BY oi.item_id ASC
    `;
    db.query(sql, [orderId], callback);
  },

  getOrderItemById: (itemId, callback) => {
    const sql = `
      SELECT oi.*, o.user_id, DATE_FORMAT(o.order_date, '%Y-%m-%d %H:%i:%s') as order_date,
             u.first_name, u.last_name
      FROM order_items oi 
      JOIN orders o ON oi.order_id = o.order_id 
      LEFT JOIN user u ON o.user_id = u.user_id
      WHERE oi.item_id = ?
    `;
    db.query(sql, [itemId], (err, results) => {
      if (err) return callback(err, null);
      if (results.length === 0) return callback(null, null);
      callback(null, results[0]);
    });
  },

  getFullOrderById: (orderId, callback) => {
    Order.getById(orderId, (err, orderResult) => {
      if (err) {
        return callback(err, null);
      }

      if (orderResult.length === 0) {
        return callback(null, null);
      }

      const order = orderResult[0];

      Order.getOrderItems(orderId, (itemErr, itemResults) => {
        if (itemErr) {
          return callback(itemErr, null);
        }

        const items = itemResults.map(item => ({
          ...item,
          pricing_factors: JSON.parse(item.pricing_factors || '{}'),
          specific_data: JSON.parse(item.specific_data || '{}')
        }));

        order.items = items;
        callback(null, order);
      });
    });
  },

  updateStatus: (orderId, status, callback) => {
    const sql = `
      UPDATE orders 
      SET status = ?
      WHERE order_id = ?
    `;
    db.query(sql, [status, orderId], callback);
  },

  cancelOrder: (orderId, reason, callback) => {
    const sql = `
      UPDATE orders 
      SET status = 'cancelled', notes = CONCAT(IFNULL(notes, ''), ' | Cancelled: ', ?)
      WHERE order_id = ?
    `;
    db.query(sql, [reason, orderId], callback);
  },

  updateItemApprovalStatus: (itemId, status, callback) => {
    const sql = `
      UPDATE order_items 
      SET approval_status = ?
      WHERE item_id = ?
    `;
    db.query(sql, [status, itemId], callback);
  },

  cancelOrderItem: (itemId, reason, callback) => {
    
    Order.getOrderItemById(itemId, (err, item) => {
      if (err) {
        return callback(err, null);
      }
      if (!item) {
        return callback(new Error('Order item not found'), null);
      }

      const previousStatus = item.approval_status || item.status || 'pending';

      const sql = `
        UPDATE order_items 
        SET approval_status = 'cancelled'
        WHERE item_id = ?
      `;
      db.query(sql, [itemId], (updateErr, updateResult) => {
        if (updateErr) {
          return callback(updateErr, null);
        }
        callback(null, { previousStatus, updateResult });
      });
    });
  },

  getByStatus: (status, callback) => {
    const sql = `
      SELECT 
        o.*,
        DATE_FORMAT(o.order_date, '%Y-%m-%d %H:%i:%s') as order_date,
        u.first_name,
        u.last_name,
        u.email
      FROM orders o
      JOIN user u ON o.user_id = u.user_id
      WHERE o.status = ?
      ORDER BY o.order_date DESC
    `;
    db.query(sql, [status], callback);
  },

  getPendingApprovalItems: (callback) => {
    const sql = `
      SELECT 
        oi.*,
        o.order_id,
        o.user_id,
        u.first_name,
        u.last_name,
        u.email,
        DATE_FORMAT(oi.appointment_date, '%Y-%m-%d %H:%i:%s') as appointment_date,
        DATE_FORMAT(oi.rental_start_date, '%Y-%m-%d') as rental_start_date,
        DATE_FORMAT(oi.rental_end_date, '%Y-%m-%d') as rental_end_date
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      JOIN user u ON o.user_id = u.user_id
      WHERE oi.approval_status = 'pending_review'
      ORDER BY oi.item_id ASC
    `;
    db.query(sql, callback);
  },

  getRepairOrders: (callback) => {
    const sql = `
      SELECT 
        oi.*,
        o.order_id,
        o.user_id,
        o.order_type,
        o.walk_in_customer_id,
        o.status as order_status,
        o.notes as order_notes,
        COALESCE(u.first_name, wc.name) as customer_first_name,
        COALESCE(u.last_name, '') as customer_last_name,
        COALESCE(u.email, wc.email) as customer_email,
        COALESCE(u.phone_number, wc.phone) as customer_phone,
        u.first_name,
        u.last_name,
        u.email,
        u.phone_number,
        wc.name as walk_in_customer_name,
        wc.email as walk_in_customer_email,
        wc.phone as walk_in_customer_phone,
        DATE_FORMAT(o.order_date, '%Y-%m-%d %H:%i:%s') as order_date,
        DATE_FORMAT(oi.appointment_date, '%Y-%m-%d %H:%i:%s') as appointment_date,
        DATE_FORMAT(oi.rental_start_date, '%Y-%m-%d') as rental_start_date,
        DATE_FORMAT(oi.rental_end_date, '%Y-%m-%d') as rental_end_date
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      LEFT JOIN user u ON o.user_id = u.user_id
      LEFT JOIN walk_in_customers wc ON o.walk_in_customer_id = wc.id
      WHERE oi.service_type = 'repair'
      ORDER BY o.order_date DESC
    `;
    db.query(sql, callback);
  },

  getRepairOrdersByStatus: (status, callback) => {
    const sql = `
      SELECT 
        oi.*,
        o.order_id,
        o.user_id,
        o.order_type,
        o.walk_in_customer_id,
        o.status as order_status,
        o.notes as order_notes,
        COALESCE(u.first_name, wc.name) as customer_first_name,
        COALESCE(u.last_name, '') as customer_last_name,
        COALESCE(u.email, wc.email) as customer_email,
        COALESCE(u.phone_number, wc.phone) as customer_phone,
        u.first_name,
        u.last_name,
        u.email,
        u.phone_number,
        wc.name as walk_in_customer_name,
        wc.email as walk_in_customer_email,
        wc.phone as walk_in_customer_phone,
        DATE_FORMAT(o.order_date, '%Y-%m-%d %H:%i:%s') as order_date,
        DATE_FORMAT(oi.appointment_date, '%Y-%m-%d %H:%i:%s') as appointment_date,
        DATE_FORMAT(oi.rental_start_date, '%Y-%m-%d') as rental_start_date,
        DATE_FORMAT(oi.rental_end_date, '%Y-%m-%d') as rental_end_date
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      LEFT JOIN user u ON o.user_id = u.user_id
      LEFT JOIN walk_in_customers wc ON o.walk_in_customer_id = wc.id
      WHERE oi.service_type = 'repair' AND (o.status = ? OR oi.approval_status = ?)
      ORDER BY o.order_date DESC
    `;
    db.query(sql, [status, status], callback);
  },

  getDryCleaningOrders: (callback) => {
    const sql = `
      SELECT 
        oi.*,
        o.order_id,
        o.user_id,
        o.order_type,
        o.walk_in_customer_id,
        o.status as order_status,
        o.notes as order_notes,
        u.first_name,
        u.last_name,
        u.email,
        u.phone_number,
        wc.name as walk_in_customer_name,
        wc.email as walk_in_customer_email,
        wc.phone as walk_in_customer_phone,
        COALESCE(u.first_name, wc.name) as customer_first_name,
        COALESCE(u.last_name, '') as customer_last_name,
        COALESCE(u.email, wc.email) as customer_email,
        COALESCE(u.phone_number, wc.phone) as customer_phone,
        DATE_FORMAT(o.order_date, '%Y-%m-%d %H:%i:%s') as order_date,
        DATE_FORMAT(oi.appointment_date, '%Y-%m-%d %H:%i:%s') as appointment_date,
        DATE_FORMAT(oi.rental_start_date, '%Y-%m-%d') as rental_start_date,
        DATE_FORMAT(oi.rental_end_date, '%Y-%m-%d') as rental_end_date
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      LEFT JOIN user u ON o.user_id = u.user_id
      LEFT JOIN walk_in_customers wc ON o.walk_in_customer_id = wc.id
      WHERE oi.service_type IN ('dry_cleaning', 'drycleaning', 'dry-cleaning', 'dry cleaning')
      ORDER BY o.order_date DESC
    `;
    db.query(sql, callback);
  },

  getDryCleaningOrdersByStatus: (status, callback) => {
    const sql = `
      SELECT 
        oi.*,
        o.order_id,
        o.user_id,
        o.order_type,
        o.walk_in_customer_id,
        o.status as order_status,
        o.notes as order_notes,
        u.first_name,
        u.last_name,
        u.email,
        u.phone_number,
        wc.name as walk_in_customer_name,
        wc.email as walk_in_customer_email,
        wc.phone as walk_in_customer_phone,
        COALESCE(u.first_name, wc.name) as customer_first_name,
        COALESCE(u.last_name, '') as customer_last_name,
        COALESCE(u.email, wc.email) as customer_email,
        COALESCE(u.phone_number, wc.phone) as customer_phone,
        DATE_FORMAT(o.order_date, '%Y-%m-%d %H:%i:%s') as order_date,
        DATE_FORMAT(oi.appointment_date, '%Y-%m-%d %H:%i:%s') as appointment_date,
        DATE_FORMAT(oi.rental_start_date, '%Y-%m-%d') as rental_start_date,
        DATE_FORMAT(oi.rental_end_date, '%Y-%m-%d') as rental_end_date
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      LEFT JOIN user u ON o.user_id = u.user_id
      LEFT JOIN walk_in_customers wc ON o.walk_in_customer_id = wc.id
      WHERE oi.service_type IN ('dry_cleaning', 'drycleaning', 'dry-cleaning', 'dry cleaning') 
      AND (o.status = ? OR oi.approval_status = ?)
      ORDER BY o.order_date DESC
    `;
    db.query(sql, [status, status], callback);
  },

  updateDryCleaningOrderItem: (itemId, updateData, callback) => {
    
    Order.updateRepairOrderItem(itemId, updateData, callback);
  },

  updateRepairOrderItem: (itemId, updateData, callback) => {
    const { finalPrice, approvalStatus, adminNotes, estimatedCompletionDate, pricingFactors } = updateData;
    const normalizedEstimatedCompletionDate =
      estimatedCompletionDate ||
      pricingFactors?.estimatedCompletionDate ||
      pricingFactors?.estimated_completion_date ||
      null;

    console.log("Model - Updating item:", itemId, updateData);

    let updates = [];
    let values = [];

    if (finalPrice !== undefined) {
      updates.push('final_price = ?');
      values.push(finalPrice);
      console.log("Adding final_price update:", finalPrice);
    }

    if (approvalStatus !== undefined) {
      updates.push('approval_status = ?');
      values.push(approvalStatus);
      console.log("Adding approval_status update:", approvalStatus);
    }

    if (adminNotes !== undefined) {
      updates.push('pricing_factors = JSON_SET(pricing_factors, \'$.adminNotes\', ?)');
      values.push(adminNotes || '');
      console.log("Adding adminNotes update:", adminNotes);
    }

    if (estimatedCompletionDate !== undefined) {
      // Store as a simple YYYY-MM-DD string (or NULL when cleared) inside pricing_factors.
      updates.push('pricing_factors = JSON_SET(COALESCE(pricing_factors, \'{}\'), \'$.estimatedCompletionDate\', ?)');
      values.push(estimatedCompletionDate || null);
    }

    if (pricingFactors) {
      Object.keys(pricingFactors).forEach((key) => {
        updates.push(`pricing_factors = JSON_SET(COALESCE(pricing_factors, '{}'), '$.${key}', ?)`);
        values.push(pricingFactors[key]);
      });
    }

    if (finalPrice !== undefined) {
      updates.push('pricing_factors = JSON_SET(pricing_factors, \'$.adminPriceUpdated\', true)');
      console.log("Setting adminPriceUpdated flag");
    }

    if (updates.length === 0) {
      return callback(new Error('No fields to update'));
    }

    values.push(itemId);

    const sql = `UPDATE order_items SET ${updates.join(', ')} WHERE item_id = ?`;
    console.log("Model - SQL:", sql);
    console.log("Model - Values:", values);

    db.query(sql, values, (err, result) => {
      console.log("Model - Query result:", err, result);

      if (err) {
        return callback(err);
      }

      const getOrderSql = `
        SELECT oi.*, o.user_id 
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.order_id
        WHERE oi.item_id = ?
      `;
      
      db.query(getOrderSql, [itemId], (orderErr, orderResults) => {
        if (!orderErr && orderResults && orderResults.length > 0) {
          const orderItem = orderResults[0];
          const userId = orderItem.user_id;
          const Notification = require('./NotificationModel');

          if (finalPrice !== undefined && approvalStatus === 'price_confirmation') {
            Notification.createPriceConfirmationNotification(userId, itemId, finalPrice, (notifErr) => {
              if (notifErr) console.error('Failed to create price confirmation notification:', notifErr);
            });
          }

          if (approvalStatus === 'accepted') {
            Notification.createAcceptedNotification(userId, itemId, orderItem.service_type, (notifErr) => {
              if (notifErr) console.error('Failed to create accepted notification:', notifErr);
            });
          }

          if (normalizedEstimatedCompletionDate) {
            Notification.createEstimatedCompletionDateNotification(
              userId,
              itemId,
              normalizedEstimatedCompletionDate,
              orderItem.service_type,
              (notifErr) => {
                if (notifErr) console.error('Failed to create estimated completion date notification:', notifErr);
              }
            );
          }

          if (pricingFactors?.enhancementUpdatedAt) {
            Notification.createEnhancementNotification(
              userId,
              itemId,
              orderItem.service_type,
              pricingFactors?.enhancementNotes || '',
              pricingFactors?.enhancementAdditionalCost || 0,
              (notifErr) => {
                if (notifErr) console.error('Failed to create enhancement notification:', notifErr);
              }
            );
          }

          const statusNotificationStatuses = [
            'confirmed',
            'in_progress',
            'ready_for_pickup',
            'ready_to_pickup',
            'completed'
          ];

          if (approvalStatus && statusNotificationStatuses.includes(approvalStatus)) {
            
            const statusForNotification =
              approvalStatus === 'confirmed' ? 'in_progress' :
              approvalStatus === 'ready_for_pickup' ? 'ready_to_pickup' :
              approvalStatus === 'ready_to_pickup' ? 'ready_to_pickup' :
              approvalStatus;

            const serviceType = (orderItem.service_type || 'repair').toLowerCase().trim();
            Notification.createStatusUpdateNotification(
              userId,
              itemId,
              statusForNotification,
              null,
              serviceType,
              (notifErr) => {
                if (notifErr) console.error('Failed to create status update notification:', notifErr);
              }
            );
          }
        }

        continueWithTracking();
      });

      function continueWithTracking() {

      if (approvalStatus !== undefined) {
        console.log("Approval status was updated, syncing to tracking table...");
        const OrderTracking = require('./OrderTrackingModel');

        const statusMap = {
          'pending_review': 'pending',
          'pending': 'pending',
          'accepted': 'accepted',
          'price_confirmation': 'price_confirmation',
          'confirmed': 'in_progress',
          'ready_for_pickup': 'ready_to_pickup',
          'completed': 'completed',
          'cancelled': 'cancelled',
          'price_declined': 'cancelled'
        };

        const trackingStatus = statusMap[approvalStatus] || 'pending';
        const notes = getStatusNote(approvalStatus);

        console.log("Syncing to tracking table:", itemId, "from", approvalStatus, "to", trackingStatus);
        console.log("Status map:", statusMap);
        console.log("Approval status:", approvalStatus);
        console.log("Tracking status:", trackingStatus);

        OrderTracking.getByOrderItemId(itemId, (err, existingTracking) => {
        
          if (err) {
            console.error("Error checking existing tracking:", err);
            callback(null, result);
            return;
          }

          console.log("Existing tracking:", existingTracking);

          if (existingTracking && existingTracking.length > 0) {
            
            console.log("Updating existing tracking entry...");
            OrderTracking.updateStatus(itemId, trackingStatus, notes, null, (trackingErr, trackingResult) => {
              if (trackingErr) {
                console.error("Failed to update tracking table:", trackingErr);
              } else {
                console.log("Successfully updated tracking table:", trackingResult);
              }
              callback(null, result);
            });
          } else {
            
            console.log("Creating new tracking entry...");
            OrderTracking.addTracking(itemId, trackingStatus, notes, null, (trackingErr, trackingResult) => {
              if (trackingErr) {
                console.error("Failed to create tracking entry:", trackingErr);
              } else {
                console.log("Successfully created tracking entry");
              }
              callback(null, result);
            });
          }
        });
      } else {
        
        callback(null, result);
      }
      } 
    });
  }
};

function getStatusNote(approvalStatus) {
  const notesMap = {
    'pending_review': 'Order pending review',
    'pending': 'Order pending review',
    'accepted': 'Order accepted by admin',
    'price_confirmation': 'Price confirmation needed from user',
    'confirmed': 'Order approved and in progress',
    'ready_for_pickup': 'Order ready for pickup',
    'completed': 'Order completed',
    'cancelled': 'Order cancelled',
    'price_declined': 'User declined the proposed price'
  };
  return notesMap[approvalStatus] || 'Status updated';
}

Order.getRentalOrders = (callback) => {
  const sql = `
    SELECT 
      oi.*,
      o.order_id,
      o.user_id,
      o.order_type,
      o.walk_in_customer_id,
      o.status as order_status,
      o.notes as order_notes,
      COALESCE(u.first_name, wc.name) as customer_first_name,
      COALESCE(u.last_name, '') as customer_last_name,
      COALESCE(u.email, wc.email) as customer_email,
      COALESCE(u.phone_number, wc.phone) as customer_phone,
      u.first_name,
      u.last_name,
      u.email,
      u.phone_number,
      wc.name as walk_in_customer_name,
      wc.email as walk_in_customer_email,
      wc.phone as walk_in_customer_phone,
      DATE_FORMAT(o.order_date, '%Y-%m-%d %H:%i:%s') as order_date,
      DATE_FORMAT(oi.appointment_date, '%Y-%m-%d %H:%i:%s') as appointment_date,
      DATE_FORMAT(oi.rental_start_date, '%Y-%m-%d') as rental_start_date,
      DATE_FORMAT(oi.rental_end_date, '%Y-%m-%d') as rental_end_date,
      COALESCE(
        (SELECT ot.status 
         FROM order_tracking ot 
         WHERE ot.order_item_id = oi.item_id 
         ORDER BY ot.created_at DESC 
         LIMIT 1), 
        oi.approval_status
      ) as approval_status
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.order_id
    LEFT JOIN user u ON o.user_id = u.user_id
    LEFT JOIN walk_in_customers wc ON o.walk_in_customer_id = wc.id
    WHERE oi.service_type = 'rental'
    ORDER BY o.order_date DESC
  `;
  db.query(sql, callback);
};

Order.getRentalOrdersByStatus = (status, callback) => {
  const sql = `
    SELECT 
      oi.*,
      o.order_id,
      o.user_id,
      o.order_type,
      o.walk_in_customer_id,
      o.status as order_status,
      o.notes as order_notes,
      COALESCE(u.first_name, wc.name) as customer_first_name,
      COALESCE(u.last_name, '') as customer_last_name,
      COALESCE(u.email, wc.email) as customer_email,
      COALESCE(u.phone_number, wc.phone) as customer_phone,
      u.first_name,
      u.last_name,
      u.email,
      u.phone_number,
      wc.name as walk_in_customer_name,
      wc.email as walk_in_customer_email,
      wc.phone as walk_in_customer_phone,
      DATE_FORMAT(o.order_date, '%Y-%m-%d %H:%i:%s') as order_date,
      DATE_FORMAT(oi.appointment_date, '%Y-%m-%d %H:%i:%s') as appointment_date,
      DATE_FORMAT(oi.rental_start_date, '%Y-%m-%d') as rental_start_date,
      DATE_FORMAT(oi.rental_end_date, '%Y-%m-%d') as rental_end_date
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.order_id
    LEFT JOIN user u ON o.user_id = u.user_id
    LEFT JOIN walk_in_customers wc ON o.walk_in_customer_id = wc.id
    WHERE oi.service_type = 'rental' 
    AND (o.status = ? OR oi.approval_status = ?)
    ORDER BY o.order_date DESC
  `;
  db.query(sql, [status, status], callback);
};

Order.updateRentalOrderItem = (itemId, updateData, callback) => {
  const { finalPrice, approvalStatus, adminNotes, penaltyData, damageNotes, paymentMode, flatRateUntilDate } = updateData;

  console.log("Model - Updating rental item:", itemId, updateData);

  let updates = [];
  let values = [];

  if (approvalStatus !== undefined) {
    updates.push('approval_status = ?');
    values.push(approvalStatus);
    console.log("Adding approval_status update:", approvalStatus);
  }

  if (adminNotes !== undefined) {
    updates.push('pricing_factors = JSON_SET(COALESCE(pricing_factors, \'{}\'), \'$.adminNotes\', ?)');
    values.push(adminNotes || '');
    console.log("Adding adminNotes update:", adminNotes);
  }

  if (paymentMode !== undefined) {
    updates.push('pricing_factors = JSON_SET(COALESCE(pricing_factors, \'{}\'), \'$.rental_payment_mode\', ?)');
    values.push(paymentMode);
    updates.push('pricing_factors = JSON_SET(pricing_factors, \'$.flat_rate_locked\', IF(? = \'flat_rate\', true, false))');
    values.push(paymentMode);
    console.log("Adding paymentMode update:", paymentMode);
  }

  if (flatRateUntilDate !== undefined) {
    if (flatRateUntilDate === null || flatRateUntilDate === '') {
      updates.push('pricing_factors = JSON_REMOVE(COALESCE(pricing_factors, \'{}\'), \'$.flat_rate_until_date\')');
      console.log("Clearing flat_rate_until_date");
    } else {
      updates.push('pricing_factors = JSON_SET(COALESCE(pricing_factors, \'{}\'), \'$.flat_rate_until_date\', ?)');
      values.push(flatRateUntilDate);
      console.log("Adding flatRateUntilDate update:", flatRateUntilDate);
    }
  }

  if (damageNotes !== undefined) {
    if (damageNotes === null || damageNotes === '') {
      
      updates.push('specific_data = JSON_REMOVE(COALESCE(specific_data, \'{}\'), \'$.damageNotes\')');
      console.log("Removing damageNotes from specific_data");
    } else {
      updates.push('specific_data = JSON_SET(COALESCE(specific_data, \'{}\'), \'$.damageNotes\', ?)');
      values.push(damageNotes);
      console.log("Adding damageNotes update:", damageNotes);
    }
  }

  if (penaltyData !== undefined) {
    
    updates.push('pricing_factors = JSON_SET(COALESCE(pricing_factors, \'{}\'), \'$.penalty\', CAST(? AS DECIMAL(10,2)))');
    values.push(penaltyData.penalty || 0);
    updates.push('pricing_factors = JSON_SET(pricing_factors, \'$.penaltyDays\', ?)');
    values.push(penaltyData.penaltyDays || 0);
    if (penaltyData.penaltyAppliedDate) {
      updates.push('pricing_factors = JSON_SET(pricing_factors, \'$.penaltyAppliedDate\', ?)');
      values.push(penaltyData.penaltyAppliedDate);
    }
    console.log("Adding penalty data to pricing_factors:", penaltyData);
  }

  if (finalPrice !== undefined) {
    updates.push('final_price = ?');
    values.push(finalPrice);
    updates.push('pricing_factors = JSON_SET(COALESCE(pricing_factors, \'{}\'), \'$.adminPriceUpdated\', true)');
    console.log("Updating final_price to:", finalPrice);
  }

  if (updates.length === 0) {
    return callback(new Error('No fields to update'));
  }

  values.push(itemId);

  const sql = `UPDATE order_items SET ${updates.join(', ')} WHERE item_id = ?`;
  console.log("Model - SQL:", sql);
  console.log("Model - Values:", values);

  db.query(sql, values, (err, result) => {
    console.log("Model - Query result:", err, result);

    if (err) {
      return callback(err);
    }

    const getOrderSql = `
      SELECT oi.*, o.user_id 
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      WHERE oi.item_id = ?
    `;
    
    db.query(getOrderSql, [itemId], (orderErr, orderResults) => {
      if (!orderErr && orderResults && orderResults.length > 0) {
        const orderItem = orderResults[0];
        const userId = orderItem.user_id;
        const Notification = require('./NotificationModel');

        if (finalPrice !== undefined && approvalStatus === 'price_confirmation') {
          Notification.createPriceConfirmationNotification(userId, itemId, finalPrice, (notifErr) => {
            if (notifErr) console.error('Failed to create price confirmation notification:', notifErr);
          });
        }

        if (approvalStatus === 'accepted') {
          Notification.createAcceptedNotification(userId, itemId, orderItem.service_type, (notifErr) => {
            if (notifErr) console.error('Failed to create accepted notification:', notifErr);
          });
        }

        const statusNotificationStatuses = [
          'confirmed',
          'in_progress',
          'ready_for_pickup',
          'ready_to_pickup',
          'rented',
          'returned',
          'completed'
        ];

        if (approvalStatus && statusNotificationStatuses.includes(approvalStatus)) {
          const statusForNotification =
            approvalStatus === 'confirmed' ? 'in_progress' :
            approvalStatus === 'ready_for_pickup' ? 'ready_to_pickup' :
            approvalStatus === 'ready_to_pickup' ? 'ready_to_pickup' :
            approvalStatus;

          const serviceType = (orderItem.service_type || 'rental').toLowerCase().trim();
          Notification.createStatusUpdateNotification(
            userId,
            itemId,
            statusForNotification,
            null,
            serviceType,
            (notifErr) => {
              if (notifErr) console.error('Failed to create status update notification:', notifErr);
            }
          );
        }
      }

      continueWithTracking();
    });

    function continueWithTracking() {
      
      if (approvalStatus !== undefined) {
        console.log("Approval status was updated, syncing to tracking table...");
        const OrderTracking = require('./OrderTrackingModel');

        const statusMap = {
          'pending': 'pending',
          'ready_to_pickup': 'ready_to_pickup',
          'ready_for_pickup': 'ready_to_pickup',
          'picked_up': 'picked_up',
          'rented': 'rented',
          'returned': 'returned',
          'completed': 'completed',
          'cancelled': 'cancelled'
        };

        const trackingStatus = statusMap[approvalStatus] || 'pending';
        let notes = getRentalStatusNote(approvalStatus);

        if (updateData.penaltyData && updateData.penaltyData.penalty > 0) {
          notes += ` | Penalty: ₱${updateData.penaltyData.penalty} (${updateData.penaltyData.penaltyDays} day${updateData.penaltyData.penaltyDays > 1 ? 's' : ''} exceeded)`;
        }

        console.log("Syncing to tracking table:", itemId, "from", approvalStatus, "to", trackingStatus);

        OrderTracking.getByOrderItemId(itemId, (err, existingTracking) => {
          if (err) {
            console.error("Error checking existing tracking:", err);
            callback(null, result);
            return;
          }

          console.log("Existing tracking:", existingTracking);

          if (existingTracking && existingTracking.length > 0) {
            console.log("Updating existing tracking entry...");
            OrderTracking.updateStatus(itemId, trackingStatus, notes, null, (trackingErr, trackingResult) => {
              if (trackingErr) {
                console.error("Failed to update tracking table:", trackingErr);
              } else {
                console.log("Successfully updated tracking table:", trackingResult);
              }
              callback(null, result);
            });
          } else {
            console.log("Creating new tracking entry...");
            OrderTracking.addTracking(itemId, trackingStatus, notes, null, (trackingErr, trackingResult) => {
              if (trackingErr) {
                console.error("Failed to create tracking entry:", trackingErr);
              } else {
                console.log("Successfully created tracking entry");
              }
              callback(null, result);
            });
          }
        });
      } else {
        callback(null, result);
      }
    }
  });
};

function getRentalStatusNote(approvalStatus) {
  const notesMap = {
    'pending': 'Rental order placed',
    'ready_to_pickup': 'Rental approved - Ready to pick up',
    'ready_for_pickup': 'Rental approved - Ready to pick up',
    'picked_up': 'Item picked up from store',
    'rented': 'Item currently rented',
    'returned': 'Item returned to store',
    'completed': 'Rental completed',
    'cancelled': 'Rental cancelled'
  };
  return notesMap[approvalStatus] || 'Status updated';
}

module.exports = Order;
