const User = require('../model/UserModel');
const CustomerMeasurements = require('../model/CustomerMeasurementsModel');

exports.getAllCustomers = (req, res) => {
  User.getAllCustomers((err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Error fetching customers",
        error: err
      });
    }

    res.json({
      success: true,
      message: "Customers retrieved successfully",
      customers: results
    });
  });
};

exports.getCustomerById = (req, res) => {
  const { id } = req.params;
  const { customer_type } = req.query; 

  if (customer_type === 'walk_in') {
    const WalkInCustomer = require('../model/WalkInCustomerModel');
    WalkInCustomer.getById(id, (err, walkInCustomer) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Error fetching walk-in customer",
          error: err
        });
      }

      if (!walkInCustomer) {
        return res.status(404).json({
          success: false,
          message: "Walk-in customer not found"
        });
      }

      CustomerMeasurements.getByWalkInCustomerId(id, (measErr, measurements) => {
        if (measErr) {
          console.error('Error fetching measurements:', measErr);
        }

        // Split the name into first_name and last_name
        const nameParts = (walkInCustomer.name || '').trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        res.json({
          success: true,
          message: "Walk-in customer retrieved successfully",
          customer: {
            ...walkInCustomer,
            customer_type: 'walk_in',
            customer_id: walkInCustomer.id,
            full_name: walkInCustomer.name,
            phone_number: walkInCustomer.phone || '',
            user_id: null,
            first_name: firstName,
            last_name: lastName
          },
          measurements: measurements && measurements.length > 0 ? measurements[0] : null
        });
      });
    });
  } else {
    
    User.getCustomerById(id, (err, results) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Error fetching customer",
          error: err
        });
      }

      if (results.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Customer not found"
        });
      }

      CustomerMeasurements.getByCustomerId(id, (measErr, measurements) => {
        if (measErr) {
          console.error('Error fetching measurements:', measErr);
        }

        res.json({
          success: true,
          message: "Customer retrieved successfully",
          customer: results[0],
          measurements: measurements && measurements.length > 0 ? measurements[0] : null
        });
      });
    });
  }
};

exports.updateCustomer = (req, res) => {
  const { id } = req.params;
  const { first_name, middle_name = null, last_name, email, phone_number, status, customer_type } = req.body;

  // Handle walk-in customer update
  if (customer_type === 'walk_in') {
    const WalkInCustomer = require('../model/WalkInCustomerModel');
    
    // For walk-in customers, combine first_name and last_name into name
    const fullName = last_name ? `${first_name} ${last_name}`.trim() : first_name;
    
    if (!fullName) {
      return res.status(400).json({
        success: false,
        message: "Name is required for walk-in customer"
      });
    }

    WalkInCustomer.update(id, {
      name: fullName,
      email: email || null,
      phone: phone_number
    }, (err, result) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Error updating walk-in customer",
          error: err
        });
      }

      res.json({
        success: true,
        message: "Walk-in customer updated successfully"
      });
    });
    return;
  }

  // Handle regular user update
  if (!first_name || !last_name || !email || !phone_number) {
    return res.status(400).json({
      success: false,
      message: "First name, last name, email, and phone number are required"
    });
  }

  User.updateCustomer(id, first_name, middle_name, last_name, email, phone_number, status || 'active', (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Error updating customer",
        error: err
      });
    }

    res.json({
      success: true,
      message: "Customer updated successfully"
    });
  });
};

exports.updateCustomerStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['active', 'inactive'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Valid status (active/inactive) is required"
    });
  }

  User.updateStatus(id, status, (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Error updating customer status",
        error: err
      });
    }

    res.json({
      success: true,
      message: "Customer status updated successfully"
    });
  });
};

exports.saveMeasurements = (req, res) => {
  const { id } = req.params;
  const { top_measurements, bottom_measurements, notes, isWalkIn, orderId, itemId, customer_name } = req.body;
  
  const top = top_measurements || req.body.top;
  const bottom = bottom_measurements || req.body.bottom;
  const adminId = req.user.id;
  const customerType = req.body.customer_type;
  
  const isWalkInCustomer = isWalkIn === true || customerType === 'walk_in';

  if (isWalkInCustomer && itemId) {
    const db = require('../config/db');

    db.query('SELECT specific_data FROM order_items WHERE item_id = ?', [itemId], (err, results) => {
      if (err) {
        console.error('Error getting order item specific_data:', err);
      } else if (results && results.length > 0) {
        let specificData = {};
        try {
          specificData = typeof results[0].specific_data === 'string' 
            ? JSON.parse(results[0].specific_data) 
            : (results[0].specific_data || {});
        } catch (e) {
          console.error('Error parsing specific_data:', e);
        }

        specificData.measurements = {
          top: top || {},
          bottom: bottom || {},
          notes: notes || ''
        };

        db.query(
          'UPDATE order_items SET specific_data = ? WHERE item_id = ?',
          [JSON.stringify(specificData), itemId],
          (updateErr) => {
            if (updateErr) {
              console.error('Error updating order item specific_data:', updateErr);
            } else {
              console.log('[MEASUREMENTS] Updated order item specific_data with measurements');
            }
          }
        );
      }
    });
  }

  CustomerMeasurements.getByCustomerId(id, (checkErr, existing) => {
    if (checkErr) {
      console.error('Error checking existing measurements:', checkErr);
    }

    const isUpdate = existing && existing.length > 0;

    CustomerMeasurements.upsert(id, { top, bottom, notes, isWalkIn: isWalkInCustomer }, (err, result) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Error saving measurements",
          error: err
        });
      }

      const measurementSummary = [];
      if (top && Object.keys(top).length > 0) {
        measurementSummary.push(`Top: ${Object.keys(top).length} measurements`);
      }
      if (bottom && Object.keys(bottom).length > 0) {
        measurementSummary.push(`Bottom: ${Object.keys(bottom).length} measurements`);
      }
      if (notes) {
        measurementSummary.push(`Notes: ${notes.substring(0, 50)}${notes.length > 50 ? '...' : ''}`);
      }

      const ActionLog = require('../model/ActionLogModel');
      const customerDisplayName = customer_name || (isWalkInCustomer ? `Walk-in Customer #${id}` : `Customer #${id}`);
      ActionLog.create({
        order_item_id: itemId || null, 
        user_id: adminId,
        action_type: 'add_measurements',
        action_by: 'admin',
        previous_status: null,
        new_status: null,
        reason: null,
        notes: `${isUpdate ? 'Updated' : 'Added'} measurements for ${customerDisplayName}`
      }, (logErr) => {
        if (logErr) {
          console.error('Error logging measurement action:', logErr);
          
        }
      });

      if (!isWalkInCustomer) {
        const Notification = require('../model/NotificationModel');
        Notification.createMeasurementUpdateNotification(id, isUpdate, (notifErr) => {
          if (notifErr) {
            console.error('[NOTIFICATION] Failed to create measurement update notification:', notifErr);
          } else {
            console.log('[NOTIFICATION] Measurement update notification created');
          }
        });
      }

      res.json({
        success: true,
        message: "Measurements saved successfully"
      });
    });
  });
};

exports.getMeasurements = (req, res) => {
  const { id } = req.params;

  CustomerMeasurements.getByCustomerId(id, (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Error fetching measurements",
        error: err
      });
    }

    res.json({
      success: true,
      message: "Measurements retrieved successfully",
      measurements: results && results.length > 0 ? results[0] : null
    });
  });
};

