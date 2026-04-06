const AppointmentSlot = require('../model/AppointmentSlotModel');
const ShopSchedule = require('../model/ShopScheduleModel');
const db = require('../config/db');

const ensureTableExists = (callback) => {
  
  const createTimeSlotsSQL = `
    CREATE TABLE IF NOT EXISTS time_slots (
      slot_id INT AUTO_INCREMENT PRIMARY KEY,
      time_slot TIME NOT NULL UNIQUE COMMENT 'Time in HH:MM:SS format (e.g., 10:30:00)',
      capacity INT NOT NULL DEFAULT 5 COMMENT 'Maximum number of appointments allowed at this time',
      is_active TINYINT(1) DEFAULT 1 COMMENT 'Whether this time slot is active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_time_slot (time_slot),
      INDEX idx_is_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;
  
  db.query(createTimeSlotsSQL, (err) => {
    if (err) {
      console.error('Error creating time_slots table:', err);
      return callback(err);
    }

    const insertDefaultSlotsSQL = `
      INSERT IGNORE INTO time_slots (time_slot, capacity, is_active) VALUES
      ('08:00:00', 5, 1), ('08:30:00', 5, 1), ('09:00:00', 5, 1), ('09:30:00', 5, 1),
      ('10:00:00', 5, 1), ('10:30:00', 5, 1), ('11:00:00', 5, 1), ('11:30:00', 5, 1),
      ('12:00:00', 5, 1), ('12:30:00', 5, 1), ('13:00:00', 5, 1), ('13:30:00', 5, 1),
      ('14:00:00', 5, 1), ('14:30:00', 5, 1), ('15:00:00', 5, 1), ('15:30:00', 5, 1),
      ('16:00:00', 5, 1), ('16:30:00', 5, 1), ('17:00:00', 5, 1)
    `;
    
    db.query(insertDefaultSlotsSQL, (err) => {
      if (err) {
        console.error('Error inserting default time slots:', err);
        
      }

      const createAppointmentSlotsSQL = `
        CREATE TABLE IF NOT EXISTS appointment_slots (
          slot_id INT AUTO_INCREMENT PRIMARY KEY,
          service_type ENUM('dry_cleaning', 'repair', 'customization') NOT NULL,
          appointment_date DATE NOT NULL,
          appointment_time TIME NOT NULL,
          user_id INT NOT NULL,
          order_item_id INT NULL COMMENT 'Reference to the order item when order is created',
          cart_item_id INT NULL COMMENT 'Reference to cart item if still in cart',
          status ENUM('booked', 'completed', 'cancelled') DEFAULT 'booked',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          
          INDEX idx_service_date (service_type, appointment_date),
          INDEX idx_user_id (user_id),
          INDEX idx_status (status),
          INDEX idx_appointment_datetime (appointment_date, appointment_time),
          INDEX idx_service_date_time (service_type, appointment_date, appointment_time, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `;
      
      db.query(createAppointmentSlotsSQL, (err) => {
        if (err) {
          console.error('Error creating appointment_slots table:', err);
          return callback(err);
        }

        db.query(`ALTER TABLE appointment_slots DROP INDEX unique_slot`, (err) => {

          if (err && err.code !== 'ER_CANT_DROP_FIELD_OR_KEY') {
            console.warn('Warning: Could not drop unique_slot index:', err.message);
          }
          callback(null);
        });
      });
    });
  });
};

exports.getAvailableSlots = (req, res) => {
  const { serviceType, date } = req.query;

  if (!serviceType || !date) {
    return res.status(400).json({
      success: false,
      message: "Service type and date are required"
    });
  }

  if (!['dry_cleaning', 'repair', 'customization'].includes(serviceType)) {
    return res.status(400).json({
      success: false,
      message: "Invalid service type. Must be: dry_cleaning, repair, or customization"
    });
  }

  ensureTableExists((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Database error. Please contact administrator.'
      });
    }

    AppointmentSlot.isValidDate(date, (err, isValid) => {
      if (err) {
        console.error('[APPOINTMENT SLOT] Error validating date:', date, err);
        return res.status(500).json({
          success: false,
          message: "Error checking date availability. Please try again."
        });
      }
      
      if (!isValid) {
        console.log('[APPOINTMENT SLOT] Date not available:', date);
        return res.status(400).json({
          success: false,
          message: "Appointments are not available on this date. Please select another date."
        });
      }
    
      console.log('[APPOINTMENT SLOT] Date is valid, fetching slots for:', serviceType, date);
      AppointmentSlot.getAvailableSlots(serviceType, date, (err, slots) => {
    if (err) {
      console.error('Error fetching available slots:', err);
      console.error('Error details:', {
        code: err.code,
        errno: err.errno,
        sqlMessage: err.sqlMessage,
        sqlState: err.sqlState
      });

      if (err.code === 'ER_NO_SUCH_TABLE') {
        return res.status(500).json({
          success: false,
          message: "Database table 'appointment_slots' does not exist. Please run the migration script to create it.",
          error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      }
      
      return res.status(500).json({
        success: false,
        message: "Error fetching available slots",
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }

    const formattedSlots = slots.map(slot => {
      const [hours, minutes] = slot.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return {
        value: slot,
        display: `${displayHour}:${minutes} ${ampm}`
      };
    });

      res.json({
        success: true,
        message: "Available slots retrieved successfully",
        slots: formattedSlots
      });
    });
    });
  });
};

exports.getAllSlotsWithAvailability = (req, res) => {
  const { serviceType, date } = req.query;

  if (!serviceType || !date) {
    return res.status(400).json({
      success: false,
      message: "Service type and date are required"
    });
  }

  if (!['dry_cleaning', 'repair', 'customization'].includes(serviceType)) {
    return res.status(400).json({
      success: false,
      message: "Invalid service type. Must be: dry_cleaning, repair, or customization"
    });
  }

  ensureTableExists((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Database error. Please contact administrator.'
      });
    }

    AppointmentSlot.isValidDate(date, (err, isValid) => {
      if (err) {
        console.error('[APPOINTMENT SLOT] Error validating date:', date, err);
        return res.status(500).json({
          success: false,
          message: "Error checking date availability. Please try again."
        });
      }
      
      if (!isValid) {
        return res.json({
          success: true,
          message: "Shop is closed on this date",
          isShopOpen: false,
          date: date,
          slots: []
        });
      }

      // Get available_times for this day of week
      const dateParts = date.split('-');
      let dayOfWeek;
      if (dateParts.length === 3) {
        const year = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const day = parseInt(dateParts[2], 10);
        dayOfWeek = new Date(year, month, day).getDay();
      } else {
        dayOfWeek = new Date(date).getDay();
      }

      ShopSchedule.getByDay(dayOfWeek, (schedErr, daySchedule) => {
        const dayAvailableTimes = daySchedule?.available_times || null;
        
        // Debug logging
        console.log('[SLOT AVAILABILITY] Day of week:', dayOfWeek, '(0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat)');
        console.log('[SLOT AVAILABILITY] Day schedule:', daySchedule);
        console.log('[SLOT AVAILABILITY] Available times for day:', dayAvailableTimes);

      const slotsSql = `
        SELECT MIN(slot_id) as slot_id, time_slot, MAX(capacity) as capacity, MAX(is_active) as is_active 
        FROM time_slots 
        GROUP BY time_slot 
        ORDER BY time_slot
      `;
      db.query(slotsSql, [], (err, slotsResults) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: "Error fetching time slots",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
          });
        }

        const bookingsSql = `
          SELECT appointment_time, COUNT(*) as booked_count
          FROM appointment_slots
          WHERE appointment_date = ? AND status = 'booked' AND order_item_id IS NOT NULL
          GROUP BY appointment_time
        `;
        db.query(bookingsSql, [date], (err, bookingsResults) => {
          if (err) {
            return res.status(500).json({
              success: false,
              message: "Error fetching bookings",
              error: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
          }

          console.log(`[SLOT AVAILABILITY] Date: ${date}, Found ${bookingsResults?.length || 0} time slots with orders`);
          if (bookingsResults && bookingsResults.length > 0) {
            console.log('[SLOT AVAILABILITY] Booked slots:', bookingsResults.map(r => ({ time: r.appointment_time, count: r.booked_count })));
          }

          const verifySql = `
            SELECT appointment_time, COUNT(*) as total_count, 
                   GROUP_CONCAT(slot_id ORDER BY slot_id) as slot_ids
            FROM appointment_slots
            WHERE appointment_date = ? AND status = 'booked' AND order_item_id IS NOT NULL
            GROUP BY appointment_time
          `;
          db.query(verifySql, [date], (verifyErr, verifyResults) => {
            if (!verifyErr && verifyResults && verifyResults.length > 0) {
              console.log('[SLOT AVAILABILITY] Verification - All slots with order_item_id:', 
                verifyResults.map(r => ({ time: r.appointment_time, total: r.total_count, slot_ids: r.slot_ids })));
            }
          });

          const bookedCounts = {};
          if (bookingsResults && Array.isArray(bookingsResults)) {
            bookingsResults.forEach(row => {
              const time = row.appointment_time;
              let timeStr = '';

              if (typeof time === 'string') {
                timeStr = time.trim();
              } else if (time && typeof time === 'object') {
                
                timeStr = time.toString().trim();
              } else if (time) {
                timeStr = time.toString().trim();
              }

              if (timeStr) {
                
                if (timeStr.match(/^\d{2}:\d{2}$/)) {
                  timeStr = timeStr + ':00';
                }
                
                else if (timeStr.match(/^\d{2}:\d{2}:\d{2}/)) {
                  timeStr = timeStr.substring(0, 8);
                }

                if (timeStr.match(/^\d{2}:\d{2}:\d{2}$/)) {
                  bookedCounts[timeStr] = (bookedCounts[timeStr] || 0) + (row.booked_count || 0);
                }
              }
            });
          }
          
          console.log(`[SLOT AVAILABILITY] Normalized booked counts:`, bookedCounts);

          const seenTimes = new Set();
          const slotsWithAvailability = slotsResults
            .filter(slot => {
              const time = slot.time_slot;
              let timeStr = typeof time === 'string' ? time : time.toString();
              if (!timeStr.match(/^\d{2}:\d{2}:\d{2}$/)) {
                if (timeStr.match(/^\d{2}:\d{2}$/)) {
                  timeStr = timeStr + ':00';
                }
              }
              
              if (seenTimes.has(timeStr)) {
                return false;
              }
              seenTimes.add(timeStr);
              return true;
            })
            .map(slot => {
            const time = slot.time_slot;
            let timeStr = '';

            if (typeof time === 'string') {
              timeStr = time.trim();
            } else if (time && typeof time === 'object') {
              
              timeStr = time.toString().trim();
            } else if (time) {
              timeStr = time.toString().trim();
            }

            if (timeStr) {
              
              if (timeStr.match(/^\d{2}:\d{2}$/)) {
                timeStr = timeStr + ':00';
              }
              
              else if (timeStr.match(/^\d{2}:\d{2}:\d{2}/)) {
                timeStr = timeStr.substring(0, 8);
              }
            }
            
            const booked = bookedCounts[timeStr] || 0;
            const capacity = slot.capacity || 5; 
            const available = capacity - booked;
            const isActive = slot.is_active === 1;

            if (timeStr && booked > 0) {
              console.log(`[SLOT AVAILABILITY] ${timeStr}: capacity=${capacity}, booked=${booked}, available=${available}`);
            }

            let status, statusLabel, color;
            if (!isActive) {
              status = 'inactive';
              statusLabel = 'Unavailable';
              color = 'gray';
            } else if (booked >= capacity) {
              status = 'full';
              statusLabel = 'Fully Booked';
              color = 'red';
            } else if (available === 1) {
              status = 'limited';
              statusLabel = `1 Spot`;
              color = 'orange';
            } else {
              status = 'available';
              statusLabel = `${available} Spots`;
              color = 'green';
            }

            const [hours, minutes] = timeStr.split(':');
            const hour = parseInt(hours);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour % 12 || 12;
            const displayTime = `${displayHour}:${minutes} ${ampm}`;

            return {
              slot_id: slot.slot_id,
              time_slot: timeStr,
              display_time: displayTime,
              capacity: capacity,
              booked: booked,
              available: available,
              is_active: isActive,
              status: status,
              statusLabel: statusLabel,
              color: color,
              isClickable: isActive && booked < capacity
            };
          });

          // Filter by day-specific available times if configured
          let filteredSlots = slotsWithAvailability;
          if (dayAvailableTimes && Array.isArray(dayAvailableTimes) && dayAvailableTimes.length > 0) {
            console.log('[SLOT AVAILABILITY] Filtering by available times:', dayAvailableTimes);
            console.log('[SLOT AVAILABILITY] Slots before filter:', slotsWithAvailability.map(s => s.time_slot));
            
            // Normalize available times to both formats for comparison
            const normalizedAvailableTimes = new Set();
            dayAvailableTimes.forEach(t => {
              const timeStr = String(t).trim();
              normalizedAvailableTimes.add(timeStr); // Full format: "08:00:00"
              normalizedAvailableTimes.add(timeStr.substring(0, 5)); // Short format: "08:00"
            });
            console.log('[SLOT AVAILABILITY] Normalized available times set:', [...normalizedAvailableTimes]);
            
            filteredSlots = slotsWithAvailability.filter(slot => {
              const slotTimeFull = String(slot.time_slot).trim(); // "08:00:00"
              const slotTimeShort = slotTimeFull.substring(0, 5); // "08:00"
              const match = normalizedAvailableTimes.has(slotTimeFull) || normalizedAvailableTimes.has(slotTimeShort);
              console.log(`[SLOT AVAILABILITY] Checking slot ${slotTimeFull} (short: ${slotTimeShort}) - match: ${match}`);
              return match;
            });
            console.log('[SLOT AVAILABILITY] Slots after filter:', filteredSlots.map(s => s.time_slot));
          } else {
            console.log('[SLOT AVAILABILITY] No day-specific times configured, returning all slots');
          }

          res.json({
            success: true,
            message: "Slots with availability retrieved successfully",
            isShopOpen: true,
            date: date,
            slots: filteredSlots
          });
        });
      });
      }); // close ShopSchedule.getByDay
    }); // close isValidDate
  });
};

exports.checkSlotAvailability = (req, res) => {
  const { serviceType, date, time } = req.query;

  if (!serviceType || !date || !time) {
    return res.status(400).json({
      success: false,
      message: "Service type, date, and time are required"
    });
  }

  ensureTableExists((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Database error. Please contact administrator.'
      });
    }
    
    AppointmentSlot.isSlotAvailable(serviceType, date, time, (err, isAvailable) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Error checking slot availability",
          error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      }

      res.json({
        success: true,
        available: isAvailable
      });
    });
  });
};

exports.bookSlot = (req, res) => {
  const { serviceType, date, time, cartItemId } = req.body;
  const userId = req.user?.id; 

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "User authentication required"
    });
  }

  if (!serviceType || !date || !time) {
    return res.status(400).json({
      success: false,
      message: "Service type, date, and time are required"
    });
  }

  if (!['dry_cleaning', 'repair', 'customization'].includes(serviceType)) {
    return res.status(400).json({
      success: false,
      message: "Invalid service type"
    });
  }

  ensureTableExists((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Database error. Please contact administrator.'
      });
    }

    AppointmentSlot.isValidDate(date, (err, isValid) => {
      if (err || !isValid) {
        return res.status(400).json({
          success: false,
          message: "Appointments are not available on this date. Please select another date."
        });
      }

      AppointmentSlot.isSlotAvailable(serviceType, date, time, (err, isAvailable) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Error checking slot availability",
        error: err
      });
    }

    if (!isAvailable) {
      return res.status(409).json({
        success: false,
        message: "This time slot is full. Please select another time."
      });
    }

    AppointmentSlot.bookSlot(serviceType, date, time, userId, cartItemId || null, (err, result) => {
      if (err) {
        
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({
            success: false,
            message: "This time slot was just booked by another user"
          });
        }
        return res.status(500).json({
          success: false,
          message: "Error booking slot",
          error: err
        });
      }

      res.json({
        success: true,
        message: "Slot booked successfully",
        slotId: result.insertId
      });
    });
    });
    });
  });
};

exports.cancelSlot = (req, res) => {
  const { slotId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "User authentication required"
    });
  }

  AppointmentSlot.cancelSlot(slotId, (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Error cancelling slot",
        error: err
      });
    }

    res.json({
      success: true,
      message: "Slot cancelled successfully"
    });
  });
};

exports.getUserSlots = (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "User authentication required"
    });
  }

  ensureTableExists((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Database error. Please contact administrator.'
      });
    }
    
    AppointmentSlot.getUserSlots(userId, (err, slots) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Error fetching user slots",
          error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      }

      res.json({
        success: true,
        message: "User slots retrieved successfully",
        slots: slots
      });
    });
  });
};

exports.getAllTimeSlots = (req, res) => {
  ensureTableExists((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Database error. Please contact administrator.'
      });
    }
    
    const sql = `SELECT * FROM time_slots ORDER BY time_slot`;
    db.query(sql, [], (err, results) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Error fetching time slots",
          error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      }

      res.json({
        success: true,
        message: "Time slots retrieved successfully",
        slots: results
      });
    });
  });
};

exports.updateTimeSlotCapacity = (req, res) => {
  const { slotId, capacity, isActive } = req.body;

  if (!slotId || capacity === undefined) {
    return res.status(400).json({
      success: false,
      message: "Slot ID and capacity are required"
    });
  }

  if (capacity < 0) {
    return res.status(400).json({
      success: false,
      message: "Capacity must be 0 or greater"
    });
  }

  ensureTableExists((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Database error. Please contact administrator.'
      });
    }
    
    const updates = [];
    const values = [];
    
    if (capacity !== undefined) {
      updates.push('capacity = ?');
      values.push(capacity);
    }
    
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(isActive ? 1 : 0);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update"
      });
    }
    
    values.push(slotId);
    
    const sql = `UPDATE time_slots SET ${updates.join(', ')} WHERE slot_id = ?`;
    db.query(sql, values, (err, result) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Error updating time slot",
          error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      }

      res.json({
        success: true,
        message: "Time slot updated successfully"
      });
    });
  });
};

exports.getAppointmentsByDate = (req, res) => {
  const { date, serviceType } = req.query;

  if (!date) {
    return res.status(400).json({ success: false, message: 'Date is required' });
  }

  const serviceFilter = serviceType ? 'AND a.service_type = ?' : '';
  const params = serviceType ? [date, serviceType] : [date];

  const sql = `
    SELECT 
      a.slot_id,
      a.appointment_time,
      a.service_type,
      a.status,
      a.user_id,
      a.order_item_id,
      TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))) AS customer_name,
      u.email,
      u.phone_number
    FROM appointment_slots a
    LEFT JOIN user u ON a.user_id = u.user_id
    WHERE a.appointment_date = ? AND a.status = 'booked' ${serviceFilter}
    ORDER BY a.appointment_time ASC
  `;

  db.query(sql, params, (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Error fetching appointments', error: err.message });
    }

    // Group by time slot
    const grouped = {};
    results.forEach(row => {
      let t = typeof row.appointment_time === 'string' ? row.appointment_time : row.appointment_time.toString();
      if (t.length === 8) {
        const [h, m] = t.split(':');
        const hr = parseInt(h);
        const ampm = hr >= 12 ? 'PM' : 'AM';
        const display = `${hr % 12 || 12}:${m} ${ampm}`;
        if (!grouped[display]) grouped[display] = [];
        grouped[display].push({
          slot_id: row.slot_id,
          customer_name: row.customer_name?.trim() || 'Unknown',
          email: row.email,
          phone: row.phone_number,
          service_type: row.service_type,
          order_item_id: row.order_item_id
        });
      }
    });

    res.json({ success: true, date, appointments: grouped });
  });
};

exports.getTimeSlotAvailability = (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({
      success: false,
      message: "Date is required"
    });
  }

  ensureTableExists((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Database error. Please contact administrator.'
      });
    }

    const slotsSql = `SELECT slot_id, time_slot, capacity, is_active FROM time_slots ORDER BY time_slot`;
    
    db.query(slotsSql, [], (err, slotsResults) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Error fetching time slots",
          error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      }

      const bookingsSql = `
        SELECT appointment_time, COUNT(*) as booked_count
        FROM appointment_slots 
        WHERE appointment_date = ? AND status = 'booked'
        GROUP BY appointment_time
      `;
      
      db.query(bookingsSql, [date], (err, bookingsResults) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: "Error fetching bookings",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
          });
        }

        const bookedCounts = {};
        if (bookingsResults && Array.isArray(bookingsResults)) {
          bookingsResults.forEach(row => {
            const time = row.appointment_time;
            let timeStr = typeof time === 'string' ? time : time.toString();
            if (!timeStr.match(/^\d{2}:\d{2}:\d{2}$/)) {
              if (timeStr.match(/^\d{2}:\d{2}$/)) {
                timeStr = timeStr + ':00';
              }
            }
            bookedCounts[timeStr] = row.booked_count || 0;
          });
        }

        const availability = slotsResults.map(slot => {
          const time = slot.time_slot;
          let timeStr = typeof time === 'string' ? time : time.toString();
          if (!timeStr.match(/^\d{2}:\d{2}:\d{2}$/)) {
            if (timeStr.match(/^\d{2}:\d{2}$/)) {
              timeStr = timeStr + ':00';
            }
          }
          
          const booked = bookedCounts[timeStr] || 0;
          const available = slot.is_active && booked < slot.capacity;
          
          return {
            slot_id: slot.slot_id,
            time_slot: timeStr,
            capacity: slot.capacity,
            booked: booked,
            available: slot.capacity - booked,
            is_active: slot.is_active === 1,
            is_full: booked >= slot.capacity
          };
        });

        res.json({
          success: true,
          message: "Time slot availability retrieved successfully",
          date: date,
          slots: availability
        });
      });
    });
  });
};

