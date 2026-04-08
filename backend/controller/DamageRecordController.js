const DamageRecord = require('../model/DamageRecordModel');

exports.createDamageRecord = (req, res) => {
  const {
    inventory_item_id,
    customer_name,
    walk_in_customer_id,
    user_id,
    damage_type,
    damage_description,
    repair_cost,
    repair_status
  } = req.body;

  if (!inventory_item_id || !customer_name || !damage_type) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: inventory_item_id, customer_name, damage_type'
    });
  }

  DamageRecord.create({
    inventory_item_id,
    customer_name,
    walk_in_customer_id: walk_in_customer_id || null,
    user_id: user_id || null,
    damage_type,
    damage_description: damage_description || null,
    repair_cost: repair_cost || 0,
    repair_status: repair_status || 'pending'
  }, (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error creating damage record',
        error: err
      });
    }

    res.json({
      success: true,
      message: 'Damage record created successfully',
      damageRecord: result
    });
  });
};

exports.getAllDamageRecords = (req, res) => {
  DamageRecord.getAll((err, records) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error fetching damage records',
        error: err
      });
    }

    res.json({
      success: true,
      damageRecords: records
    });
  });
};

exports.getDamageRecordsByItem = (req, res) => {
  const { itemId } = req.params;

  DamageRecord.getByInventoryItem(itemId, (err, records) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error fetching damage records',
        error: err
      });
    }

    res.json({
      success: true,
      damageRecords: records
    });
  });
};

exports.getDamageRecordById = (req, res) => {
  const { id } = req.params;

  DamageRecord.getById(id, (err, record) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error fetching damage record',
        error: err
      });
    }

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Damage record not found'
      });
    }

    res.json({
      success: true,
      damageRecord: record
    });
  });
};

exports.updateDamageRecord = (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  DamageRecord.update(id, updateData, (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error updating damage record',
        error: err
      });
    }

    res.json({
      success: true,
      message: 'Damage record updated successfully',
      result: result
    });
  });
};

exports.deleteDamageRecord = (req, res) => {
  const { id } = req.params;

  DamageRecord.delete(id, (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error deleting damage record',
        error: err
      });
    }

    res.json({
      success: true,
      message: 'Damage record deleted successfully'
    });
  });
};

exports.createCompensationIncident = (req, res) => {
  const {
    order_item_id,
    order_id,
    service_type,
    customer_name,
    responsible_party,
    damage_type,
    damage_description,
    total_quantity,
    damaged_quantity,
    damaged_garment_type,
    compensation_amount,
    compensation_type,
    clothe_description,
    notes
  } = req.body;

  if (!order_item_id || !service_type || !customer_name || !damage_type) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: order_item_id, service_type, customer_name, damage_type'
    });
  }

  const amount = Number.isFinite(parseFloat(compensation_amount)) ? parseFloat(compensation_amount) : 0;
  const parsedTotalQuantity = total_quantity !== undefined && total_quantity !== null && total_quantity !== ''
    ? parseInt(total_quantity, 10)
    : null;
  const parsedDamagedQuantity = damaged_quantity !== undefined && damaged_quantity !== null && damaged_quantity !== ''
    ? parseInt(damaged_quantity, 10)
    : null;

  let normalizedTotalQuantity = parsedTotalQuantity;
  let normalizedDamagedQuantity = parsedDamagedQuantity;

  if ((service_type || '').toLowerCase() === 'dry_cleaning') {
    normalizedTotalQuantity = parsedTotalQuantity || 1;
    normalizedDamagedQuantity = parsedDamagedQuantity || 1;
  }

  if (normalizedTotalQuantity !== null || normalizedDamagedQuantity !== null) {
    if (!Number.isInteger(normalizedTotalQuantity) || normalizedTotalQuantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid total_quantity. Must be a whole number greater than 0.'
      });
    }

    if (!Number.isInteger(normalizedDamagedQuantity) || normalizedDamagedQuantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid damaged_quantity. Must be a whole number greater than 0.'
      });
    }

    if (normalizedDamagedQuantity > normalizedTotalQuantity) {
      return res.status(400).json({
        success: false,
        message: 'damaged_quantity cannot be greater than total_quantity.'
      });
    }
  }

  // Get the logged-in user info
  const reportedByUserId = req.user?.id || req.user?.user_id || null;
  const reportedByRole = req.user?.role || null;

  DamageRecord.createCompensationRecord({
    order_item_id,
    order_id: order_id || null,
    service_type,
    customer_name,
    reported_by_user_id: reportedByUserId,
    reported_by_role: reportedByRole,
    responsible_party: responsible_party || null,
    damage_type,
    damage_description: damage_description || null,
    total_quantity: normalizedTotalQuantity,
    damaged_quantity: normalizedDamagedQuantity,
    damaged_garment_type: damaged_garment_type || null,
    compensation_amount: amount,
    compensation_type: compensation_type || 'money',
    clothe_description: clothe_description || null,
    notes: notes || null,
    liability_status: 'pending',
    compensation_status: 'unpaid'
  }, (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error creating compensation incident',
        error: err
      });
    }

    // Create action log for the compensation incident creation
    const ActionLog = require('../model/ActionLogModel');
    const actorRole = req.user?.role || 'admin';
    const actorName = req.user?.username || `${req.user?.first_name || ''} ${req.user?.last_name || ''}`.trim() || actorRole;
    const serviceTypeLower = (service_type || '').toLowerCase();
    const actionType = serviceTypeLower === 'rental' ? 'rental_damage_compensation' : 'damage_compensation';
    
    ActionLog.create({
      order_item_id,
      user_id: reportedByUserId,
      action_type: actionType,
      action_by: actorRole,
      previous_status: null,
      new_status: 'pending',
      reason: null,
      notes: `Damage compensation reported by ${actorName}. Customer: ${customer_name}. Damage type: ${damage_type}.${normalizedDamagedQuantity && normalizedTotalQuantity ? ` Qty damaged: ${normalizedDamagedQuantity}/${normalizedTotalQuantity}.` : ''} Amount: ₱${amount}${responsible_party ? `. Damaged by: ${responsible_party}` : ''}`
    }, (logErr) => {
      if (logErr) {
        console.error('Error logging damage compensation creation:', logErr);
      }
    });

    res.json({
      success: true,
      message: 'Damage compensation incident recorded',
      incident: result
    });
  });
};

exports.updateLiabilityDecision = (req, res) => {
  const { id } = req.params;
  const { liability_status, compensation_amount, responsible_party, compensation_type, clothe_description, notes, total_quantity, damaged_quantity } = req.body;

  if (!['pending', 'approved', 'rejected'].includes(liability_status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid liability_status. Use pending, approved, or rejected.'
    });
  }

  const amount = Number.isFinite(parseFloat(compensation_amount)) ? parseFloat(compensation_amount) : undefined;
  const parsedTotalQuantity = total_quantity !== undefined && total_quantity !== null && total_quantity !== ''
    ? parseInt(total_quantity, 10)
    : undefined;
  const parsedDamagedQuantity = damaged_quantity !== undefined && damaged_quantity !== null && damaged_quantity !== ''
    ? parseInt(damaged_quantity, 10)
    : undefined;

  if (parsedTotalQuantity !== undefined || parsedDamagedQuantity !== undefined) {
    const total = parsedTotalQuantity !== undefined ? parsedTotalQuantity : null;
    const damaged = parsedDamagedQuantity !== undefined ? parsedDamagedQuantity : null;

    if (total !== null && (!Number.isInteger(total) || total < 1)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid total_quantity. Must be a whole number greater than 0.'
      });
    }

    if (damaged !== null && (!Number.isInteger(damaged) || damaged < 1)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid damaged_quantity. Must be a whole number greater than 0.'
      });
    }

    if (total !== null && damaged !== null && damaged > total) {
      return res.status(400).json({
        success: false,
        message: 'damaged_quantity cannot be greater than total_quantity.'
      });
    }
  }

  const updatePayload = {
    liability_status,
    responsible_party,
    compensation_type,
    clothe_description,
    notes
  };

  if (amount !== undefined) {
    updatePayload.compensation_amount = amount;
  }
  if (parsedTotalQuantity !== undefined) {
    updatePayload.total_quantity = parsedTotalQuantity;
  }
  if (parsedDamagedQuantity !== undefined) {
    updatePayload.damaged_quantity = parsedDamagedQuantity;
  }

  if (liability_status === 'rejected') {
    updatePayload.compensation_status = 'unpaid';
  }

  DamageRecord.updateCompensationRecord(id, updatePayload, (err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error updating liability decision',
        error: err
      });
    }

    // Get the compensation record to log the action
    DamageRecord.getCompensationById(id, (getErr, record) => {
      if (!getErr && record && record.order_item_id) {
        const ActionLog = require('../model/ActionLogModel');
        const actorRole = req.user?.role || 'admin';
        const actorName = req.user?.username || `${req.user?.first_name || ''} ${req.user?.last_name || ''}`.trim() || actorRole;
        const serviceType = (record.service_type || '').toLowerCase();
        const actionType = serviceType === 'rental' ? 'rental_damage_compensation' : 'damage_compensation';
        
        ActionLog.create({
          order_item_id: record.order_item_id,
          user_id: req.user?.id || null,
          action_type: actionType,
          action_by: actorRole,
          previous_status: null,
          new_status: liability_status,
          reason: null,
          notes: `Damage compensation liability ${liability_status} by ${actorName}. Customer: ${record.customer_name || 'Customer'}. Amount: ₱${amount || record.compensation_amount || 0}`
        }, (logErr) => {
          if (logErr) {
            console.error('Error logging damage compensation action:', logErr);
          }
        });
      }
    });

    res.json({
      success: true,
      message: 'Liability decision updated successfully'
    });
  });
};

exports.recordCompensationSettlement = (req, res) => {
  const { id } = req.params;
  const { payment_reference, notes, refund_amount } = req.body;
  DamageRecord.getCompensationById(id, (findErr, record) => {
    if (findErr) {
      return res.status(500).json({
        success: false,
        message: 'Error fetching compensation incident',
        error: findErr
      });
    }

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Compensation incident not found'
      });
    }

    if (record.liability_status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Compensation can only be settled after liability is approved'
      });
    }

    DamageRecord.updateCompensationRecord(id, {
      compensation_status: 'paid',
      compensation_paid_at: new Date(),
      payment_reference: payment_reference || null,
      notes: notes !== undefined ? notes : record.notes,
      refund_amount: (refund_amount !== undefined && refund_amount !== "") ? (parseFloat(refund_amount) || null) : null,
    }, (updateErr) => {
      if (updateErr) {
        return res.status(500).json({
          success: false,
          message: 'Error recording compensation settlement',
          error: updateErr
        });
      }

      // Log the settlement action
      if (record.order_item_id) {
        const ActionLog = require('../model/ActionLogModel');
        const actorRole = req.user?.role || 'admin';
        const actorName = req.user?.username || `${req.user?.first_name || ''} ${req.user?.last_name || ''}`.trim() || actorRole;
        const serviceType = (record.service_type || '').toLowerCase();
        const actionType = serviceType === 'rental' ? 'rental_damage_compensation' : 'damage_compensation';
        
        ActionLog.create({
          order_item_id: record.order_item_id,
          user_id: req.user?.id || null,
          action_type: actionType,
          action_by: actorRole,
          previous_status: 'unpaid',
          new_status: 'paid',
          reason: null,
          notes: `Damage compensation settled by ${actorName}. Customer: ${record.customer_name || 'Customer'}. Amount: ₱${record.compensation_amount || 0}${payment_reference ? `. Ref: ${payment_reference}` : ''}`
        }, (logErr) => {
          if (logErr) {
            console.error('Error logging damage compensation settlement:', logErr);
          }
        });
        
        // For rental damage compensation, create a transaction log as revenue
        if (serviceType === 'rental') {
          const TransactionLog = require('../model/TransactionLogModel');
          const compensationAmount = parseFloat(record.compensation_amount || 0);
          
          if (compensationAmount > 0) {
            TransactionLog.create({
              order_item_id: record.order_item_id,
              user_id: req.user?.id || null,
              transaction_type: 'revenue',
              amount: compensationAmount,
              previous_payment_status: null,
              new_payment_status: null,
              payment_method: 'rental_damage_compensation',
              notes: `Rental damage compensation received from customer: ${record.customer_name || 'Customer'}. Damage type: ${record.damage_type || 'N/A'}. ${payment_reference ? `Ref: ${payment_reference}` : ''}`,
              created_by: actorName
            }, (transLogErr) => {
              if (transLogErr) {
                console.error('[RENTAL COMPENSATION] Failed to create transaction log:', transLogErr);
              } else {
                console.log(`[RENTAL COMPENSATION] Recorded ₱${compensationAmount.toFixed(2)} as revenue from rental damage compensation`);
              }
            });
          }
        }
      }

      res.json({
        success: true,
        message: 'Compensation settlement recorded successfully'
      });
    });
  });
};

exports.getCompensationIncidents = (req, res) => {
  const filters = {
    service_type: req.query.service_type || undefined,
    liability_status: req.query.liability_status || undefined,
    compensation_status: req.query.compensation_status || undefined,
    order_item_id: req.query.order_item_id || undefined,
    customer_user_id: req.query.my_only === 'true' ? req.user?.id : undefined
  };

  DamageRecord.getCompensationRecords(filters, (err, records) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error fetching compensation incidents',
        error: err
      });
    }

    res.json({
      success: true,
      incidents: records
    });
  });
};

exports.customerLiabilityDecision = (req, res) => {
  const { id } = req.params;
  const { liability_status, customer_compensation_choice, customer_proceed_choice, notes } = req.body;

  if (!req.user?.id) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (!['approved', 'rejected'].includes(liability_status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid liability_status. Use approved or rejected.'
    });
  }

  DamageRecord.getCompensationByIdForUser(id, req.user.id, (findErr, record) => {
    if (findErr) {
      return res.status(500).json({
        success: false,
        message: 'Error fetching compensation incident',
        error: findErr
      });
    }

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Compensation incident not found for this account'
      });
    }

    if (record.liability_status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Liability decision has already been submitted'
      });
    }

    const existingNotes = (record.notes || '').trim();
    const customerDecisionNote = `Customer decision: ${liability_status}${notes ? ` (${String(notes).trim()})` : ''}`;
    const mergedNotes = existingNotes ? `${existingNotes}\n${customerDecisionNote}` : customerDecisionNote;

    const updatePayload = {
      liability_status,
      notes: mergedNotes
    };

    if (customer_compensation_choice && ['money', 'clothe'].includes(customer_compensation_choice)) {
      updatePayload.customer_compensation_choice = customer_compensation_choice;
    }

    if (customer_proceed_choice && ['proceed', 'dont_proceed'].includes(customer_proceed_choice)) {
      updatePayload.customer_proceed_choice = customer_proceed_choice;
    }

    if (liability_status === 'rejected') {
      updatePayload.compensation_status = 'unpaid';
    }

    DamageRecord.updateCompensationRecord(id, updatePayload, (updateErr) => {
      if (updateErr) {
        return res.status(500).json({
          success: false,
          message: 'Error submitting liability decision',
          error: updateErr
        });
      }

      return res.json({
        success: true,
        message: `Liability ${liability_status} by customer`
      });
    });
  });
};

exports.getCompensationStats = (req, res) => {
  DamageRecord.getCompensationStats((err, stats) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error fetching compensation stats',
        error: err
      });
    }

    res.json({
      success: true,
      stats
    });
  });
};

