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
    compensation_amount,
    notes
  } = req.body;

  if (!order_item_id || !service_type || !customer_name || !damage_type) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: order_item_id, service_type, customer_name, damage_type'
    });
  }

  const amount = Number.isFinite(parseFloat(compensation_amount)) ? parseFloat(compensation_amount) : 0;

  DamageRecord.createCompensationRecord({
    order_item_id,
    order_id: order_id || null,
    service_type,
    customer_name,
    reported_by_user_id: req.user?.id || null,
    reported_by_role: req.user?.role || null,
    responsible_party: responsible_party || null,
    damage_type,
    damage_description: damage_description || null,
    compensation_amount: amount,
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

    res.json({
      success: true,
      message: 'Damage compensation incident recorded',
      incident: result
    });
  });
};

exports.updateLiabilityDecision = (req, res) => {
  const { id } = req.params;
  const { liability_status, compensation_amount, responsible_party, notes } = req.body;

  if (!['pending', 'approved', 'rejected'].includes(liability_status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid liability_status. Use pending, approved, or rejected.'
    });
  }

  const amount = Number.isFinite(parseFloat(compensation_amount)) ? parseFloat(compensation_amount) : undefined;

  const updatePayload = {
    liability_status,
    responsible_party,
    notes
  };

  if (amount !== undefined) {
    updatePayload.compensation_amount = amount;
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

    res.json({
      success: true,
      message: 'Liability decision updated successfully'
    });
  });
};

exports.recordCompensationSettlement = (req, res) => {
  const { id } = req.params;
  const { payment_reference, notes } = req.body;

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
      notes: notes !== undefined ? notes : record.notes
    }, (updateErr) => {
      if (updateErr) {
        return res.status(500).json({
          success: false,
          message: 'Error recording compensation settlement',
          error: updateErr
        });
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
  const { liability_status, notes } = req.body;

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

