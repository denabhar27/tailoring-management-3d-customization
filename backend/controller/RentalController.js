const RentalInventory = require('../model/RentalInventoryModel');

exports.createRental = (req, res) => {
  const { item_name, description, brand, size, color, category, price, deposit, downpayment, total_available, image_url, material, care_instructions, damage_notes } = req.body;

  let frontImage = null;
  let backImage = null;
  let sideImage = null;
  let mainImageUrl = null;

  if (req.files) {
    
    if (req.files.front_image && req.files.front_image[0]) {
      frontImage = `/uploads/rental-images/${req.files.front_image[0].filename}`;
      mainImageUrl = frontImage; 
    }
    if (req.files.back_image && req.files.back_image[0]) {
      backImage = `/uploads/rental-images/${req.files.back_image[0].filename}`;
    }
    if (req.files.side_image && req.files.side_image[0]) {
      sideImage = `/uploads/rental-images/${req.files.side_image[0].filename}`;
    }
    
    if (req.files.image && req.files.image[0]) {
      mainImageUrl = `/uploads/rental-images/${req.files.image[0].filename}`;
    }
  } else if (req.file) {
    
    mainImageUrl = `/uploads/rental-images/${req.file.filename}`;
  }

  if (!item_name || !price) {
    return res.status(400).json({ 
      message: "Item name and price are required" 
    });
  }

  const rentalData = {
    item_name,
    description,
    brand,
    size,
    color,
    category,
    price,
    deposit,
    downpayment,
    total_available,
    image_url: mainImageUrl, 
    front_image: frontImage,
    back_image: backImage,
    side_image: sideImage,
    material,
    care_instructions,
    damage_notes
  };

  RentalInventory.create(rentalData, (err, result) => {
    if (err) {
      console.error("Error creating rental item:", err);
      return res.status(500).json({ 
        message: "Error creating rental item", 
        error: err 
      });
    }

    res.status(201).json({
      message: "Rental item created successfully",
      item_id: result.insertId,
      image_url: mainImageUrl,
      front_image: frontImage,
      back_image: backImage,
      side_image: sideImage,
      ...rentalData
    });
  });
};

exports.getAllRentals = (req, res) => {
  RentalInventory.getAll((err, results) => {
    if (err) {
      console.error("Error fetching rental items:", err);
      return res.status(500).json({ 
        message: "Error fetching rental items", 
        error: err 
      });
    }

    res.json({
      message: "Rental items retrieved successfully",
      items: results
    });
  });
};

exports.getRentalById = (req, res) => {
  const { item_id } = req.params;

  RentalInventory.findById(item_id, (err, results) => {
    if (err) {
      console.error("Error fetching rental item:", err);
      return res.status(500).json({ 
        message: "Error fetching rental item", 
        error: err 
      });
    }

    if (results.length === 0) {
      return res.status(404).json({ 
        message: "Rental item not found" 
      });
    }

    res.json({
      message: "Rental item retrieved successfully",
      item: results[0]
    });
  });
};

exports.getAvailableRentals = (req, res) => {
  RentalInventory.getAvailableItems({}, (err, results) => {
    if (err) {
      console.error("Error fetching available rentals:", err);
      return res.status(500).json({ 
        message: "Error fetching available rentals", 
        error: err 
      });
    }

    res.json({
      message: "Available rentals retrieved successfully",
      items: results
    });
  });
};

exports.getRentalsByCategory = (req, res) => {
  const { category } = req.params;

  RentalInventory.getByCategory(category, (err, results) => {
    if (err) {
      console.error("Error fetching rentals by category:", err);
      return res.status(500).json({ 
        message: "Error fetching rentals by category", 
        error: err 
      });
    }

    res.json({
      message: `Rentals in ${category} category retrieved successfully`,
      items: results
    });
  });
};

exports.updateRental = (req, res) => {
  const { item_id } = req.params;
  const { item_name, description, brand, size, color, category, price, deposit, downpayment, total_available, image_url, front_image, back_image, side_image, material, care_instructions, damage_notes, status } = req.body;

  let frontImageUrl = front_image || null;
  let backImageUrl = back_image || null;
  let sideImageUrl = side_image || null;
  let mainImageUrl = image_url || null;

  if (req.files) {
    
    if (req.files.front_image && req.files.front_image[0]) {
      frontImageUrl = `/uploads/rental-images/${req.files.front_image[0].filename}`;
    }
    if (req.files.back_image && req.files.back_image[0]) {
      backImageUrl = `/uploads/rental-images/${req.files.back_image[0].filename}`;
    }
    if (req.files.side_image && req.files.side_image[0]) {
      sideImageUrl = `/uploads/rental-images/${req.files.side_image[0].filename}`;
    }
    
    if (req.files.image && req.files.image[0]) {
      mainImageUrl = `/uploads/rental-images/${req.files.image[0].filename}`;
    }
  } else if (req.file) {
    
    mainImageUrl = `/uploads/rental-images/${req.file.filename}`;
  }

  RentalInventory.findById(item_id, (err, existingItem) => {
    if (err) {
      console.error("Error checking rental item:", err);
      return res.status(500).json({ 
        message: "Error checking rental item", 
        error: err 
      });
    }

    if (existingItem.length === 0) {
      return res.status(404).json({ 
        message: "Rental item not found" 
      });
    }

    if (!mainImageUrl && existingItem[0].image_url) {
      mainImageUrl = existingItem[0].image_url;
    }
    if (!frontImageUrl && existingItem[0].front_image) {
      frontImageUrl = existingItem[0].front_image;
    }
    if (!backImageUrl && existingItem[0].back_image) {
      backImageUrl = existingItem[0].back_image;
    }
    if (!sideImageUrl && existingItem[0].side_image) {
      sideImageUrl = existingItem[0].side_image;
    }

    if (frontImageUrl && !mainImageUrl) {
      mainImageUrl = frontImageUrl;
    }

    const updateData = {
      item_name,
      description,
      brand,
      size,
      color,
      category,
      price,
      deposit,
      downpayment,
      total_available,
      image_url: mainImageUrl,
      front_image: frontImageUrl,
      back_image: backImageUrl,
      side_image: sideImageUrl,
      material,
      care_instructions,
      damage_notes,
      status
    };

    RentalInventory.update(item_id, updateData, (err, result) => {
      if (err) {
        console.error("Error updating rental item:", err);
        return res.status(500).json({ 
          message: "Error updating rental item", 
          error: err 
        });
      }

      res.json({
        message: "Rental item updated successfully",
        item_id: parseInt(item_id),
        image_url: mainImageUrl,
        front_image: frontImageUrl,
        back_image: backImageUrl,
        side_image: sideImageUrl,
        ...updateData
      });
    });
  });
};

exports.updateRentalStatus = (req, res) => {
  const { item_id } = req.params;
  const { status, damage_notes, damaged_by } = req.body;

  if (!['available', 'rented', 'maintenance'].includes(status)) {
    return res.status(400).json({ 
      message: "Invalid status. Must be: available, rented, or maintenance" 
    });
  }

  if (damage_notes !== undefined) {
    RentalInventory.updateStatusWithDamageNotes(item_id, status, damage_notes || null, damaged_by || null, (err, result) => {
      if (err) {
        console.error("Error updating rental status with damage notes:", err);
        return res.status(500).json({ 
          message: "Error updating rental status with damage notes", 
          error: err 
        });
      }

      res.json({
        message: `Rental item status updated to ${status}${damage_notes ? ' with damage notes' : ''}`,
        item_id: parseInt(item_id),
        status,
        damage_notes: damage_notes || null,
        damaged_by: damaged_by || null
      });
    });
  } else {
    RentalInventory.updateStatus(item_id, status, (err, result) => {
      if (err) {
        console.error("Error updating rental status:", err);
        return res.status(500).json({ 
          message: "Error updating rental status", 
          error: err 
        });
      }

      res.json({
        message: `Rental item status updated to ${status}`,
        item_id: parseInt(item_id),
        status
      });
    });
  }
};

exports.markRentalItemDamaged = (req, res) => {
  const { item_id } = req.params;
  const {
    order_item_id,
    size_key,
    size_label,
    quantity,
    damage_type,
    damage_level,
    damage_note,
    damaged_customer_name
  } = req.body;

  if (!size_key && !size_label) {
    return res.status(400).json({ message: 'Size is required.' });
  }

  RentalInventory.markSizeDamaged(item_id, {
    order_item_id: order_item_id || null,
    size_key: size_key || null,
    size_label: size_label || null,
    quantity,
    damage_type,
    damage_level,
    damage_note,
    damaged_customer_name,
    processed_by_user_id: req.user?.id || null,
    processed_by_role: req.user?.role || 'admin',
    processed_by_name: req.user?.username || null
  }, (err, result) => {
    if (err) {
      return res.status(err.statusCode || 500).json({
        message: err.message || 'Error marking rental item as damaged',
        error: err
      });
    }

    res.json({
      success: true,
      message: 'Damage logged and inventory updated successfully',
      data: result
    });
  });
};

exports.updateDamageCompensation = (req, res) => {
  const { item_id, log_id } = req.params;
  const { compensation_amount, payment_status } = req.body;

  const amount = parseFloat(compensation_amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({
      success: false,
      message: 'Compensation amount must be a valid non-negative number.'
    });
  }

  const normalizedStatus = String(payment_status || 'unpaid').trim().toLowerCase();
  if (!['paid', 'unpaid'].includes(normalizedStatus)) {
    return res.status(400).json({
      success: false,
      message: 'Payment status must be either "paid" or "unpaid".'
    });
  }

  RentalInventory.updateDamageCompensation(item_id, log_id, {
    compensation_amount: amount,
    payment_status: normalizedStatus,
    updated_by_user_id: req.user?.id || null,
    updated_by_role: req.user?.role || 'admin',
    updated_by_name: req.user?.username || null
  }, (err, result) => {
    if (err) {
      return res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Error updating damage compensation',
        error: err
      });
    }

    res.json({
      success: true,
      message: 'Damage compensation updated successfully',
      data: result
    });
  });
};

exports.restockReturnedRentalSizes = (req, res) => {
  const { item_id } = req.params;
  const selectedSizes = Array.isArray(req.body?.selected_sizes) ? req.body.selected_sizes : [];
  RentalInventory.restockReturnedSizes(item_id, selectedSizes, (err, result) => {
    if (err) {
      return res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Error restocking returned rental sizes',
        error: err
      });
    }

    res.json({
      success: true,
      message: 'Returned sizes restocked successfully',
      data: result
    });
  });
};

exports.resolveMaintenance = (req, res) => {
  const { item_id, log_id } = req.params;
  const { quantity, resolution_note } = req.body;

  if (!quantity || parseInt(quantity, 10) <= 0) {
    return res.status(400).json({ message: 'Valid quantity is required.' });
  }

  RentalInventory.resolveMaintenance(item_id, log_id, {
    quantity: parseInt(quantity, 10),
    resolution_note: resolution_note || 'Fixed and returned to available'
  }, (err, result) => {
    if (err) {
      return res.status(err.statusCode || 500).json({
        message: err.message || 'Error resolving maintenance',
        error: err
      });
    }

    res.json({
      success: true,
      message: 'Maintenance resolved successfully',
      data: result
    });
  });
};

exports.getRentalSizeActivity = (req, res) => {
  const { item_id, size_key } = req.params;
  RentalInventory.getSizeActivity(item_id, size_key, (err, result) => {
    if (err) {
      return res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Error fetching size activity',
        error: err
      });
    }

    res.json({
      success: true,
      message: 'Size activity retrieved successfully',
      data: result
    });
  });
};

exports.deleteRental = (req, res) => {
  const { item_id } = req.params;

  RentalInventory.findById(item_id, (err, existingItem) => {
    if (err) {
      console.error("Error checking rental item:", err);
      return res.status(500).json({ 
        message: "Error checking rental item", 
        error: err 
      });
    }

    if (existingItem.length === 0) {
      return res.status(404).json({ 
        message: "Rental item not found" 
      });
    }

    RentalInventory.delete(item_id, (err, result) => {
      if (err) {
        console.error("Error deleting rental item:", err);
        return res.status(500).json({ 
          message: "Error deleting rental item", 
          error: err 
        });
      }

      res.json({
        message: "Rental item deleted successfully",
        item_id: parseInt(item_id)
      });
    });
  });
};

exports.searchRentals = (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ 
      message: "Search query is required" 
    });
  }

  RentalInventory.search(q, (err, results) => {
    if (err) {
      console.error("Error searching rental items:", err);
      return res.status(500).json({ 
        message: "Error searching rental items", 
        error: err 
      });
    }

    res.json({
      message: `Search results for "${q}"`,
      items: results,
      search_term: q
    });
  });
};

exports.getCategories = (req, res) => {
  RentalInventory.getCategories((err, results) => {
    if (err) {
      console.error("Error fetching categories:", err);
      return res.status(500).json({ 
        message: "Error fetching categories", 
        error: err 
      });
    }

    res.json({
      message: "Categories retrieved successfully",
      categories: results.map(row => row.category)
    });
  });
};

exports.getAvailableQuantity = (req, res) => {
  const { item_id } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ 
      message: "User not authenticated" 
    });
  }

  RentalInventory.findById(item_id, (err, results) => {
    if (err) {
      console.error("Error fetching rental item:", err);
      return res.status(500).json({ 
        message: "Error fetching rental item", 
        error: err 
      });
    }

    if (results.length === 0) {
      return res.status(404).json({ 
        message: "Rental item not found" 
      });
    }

    const item = results[0];
    let sizePayload;
    try {
      sizePayload = typeof item.size === 'string' ? JSON.parse(item.size) : item.size;
    } catch (e) {
      return res.status(500).json({ 
        message: "Invalid size data" 
      });
    }

    const sizeEntries = Array.isArray(sizePayload?.size_entries) ? sizePayload.size_entries : [];

    // Get quantities in ALL users' carts (not just current user)
    const cartSql = `
      SELECT specific_data 
      FROM cart 
      WHERE service_type = 'rental' 
        AND (service_id = ? OR JSON_EXTRACT(specific_data, '$.bundle_items[*].id') LIKE ?)
        AND (expires_at IS NULL OR expires_at > NOW())
    `;

    const db = require('../config/db');
    db.query(cartSql, [item_id, `%${item_id}%`], (cartErr, cartRows) => {
      if (cartErr) {
        console.error("Error fetching cart items:", cartErr);
        return res.status(500).json({ 
          message: "Error checking cart", 
          error: cartErr 
        });
      }

      // Get quantities in ALL users' pending/active orders (not just current user)
      const orderSql = `
        SELECT oi.specific_data
        FROM order_items oi
        WHERE oi.service_type = 'rental'
          AND (oi.service_id = ? OR JSON_EXTRACT(oi.specific_data, '$.bundle_items[*].id') LIKE ?)
          AND oi.approval_status IN ('pending', 'ready_to_pickup', 'picked_up', 'rented')
      `;

      db.query(orderSql, [item_id, `%${item_id}%`], (orderErr, orderRows) => {
        if (orderErr) {
          console.error("Error fetching order items:", orderErr);
          return res.status(500).json({ 
            message: "Error checking orders", 
            error: orderErr 
          });
        }

        // Calculate reserved quantities per size
        const reservedBySizeKey = {};

        const processRows = (rows) => {
          rows.forEach(row => {
            let specificData;
            try {
              specificData = typeof row.specific_data === 'string' 
                ? JSON.parse(row.specific_data) 
                : row.specific_data;
            } catch (e) {
              return;
            }

            if (!specificData) return;

            // Handle bundle items
            if (specificData.is_bundle && Array.isArray(specificData.bundle_items)) {
              specificData.bundle_items.forEach(bundleItem => {
                const bundleItemId = parseInt(bundleItem.id || bundleItem.item_id, 10);
                if (bundleItemId !== parseInt(item_id, 10)) return;

                const selectedSizes = bundleItem.selected_sizes || [];
                selectedSizes.forEach(sizeSelection => {
                  const sizeKey = sizeSelection.sizeKey || sizeSelection.size_key;
                  const qty = parseInt(sizeSelection.quantity, 10) || 0;
                  reservedBySizeKey[sizeKey] = (reservedBySizeKey[sizeKey] || 0) + qty;
                });
              });
            } else {
              // Handle single item
              const selectedSizes = specificData.selected_sizes || [];
              selectedSizes.forEach(sizeSelection => {
                const sizeKey = sizeSelection.sizeKey || sizeSelection.size_key;
                const qty = parseInt(sizeSelection.quantity, 10) || 0;
                reservedBySizeKey[sizeKey] = (reservedBySizeKey[sizeKey] || 0) + qty;
              });
            }
          });
        };

        processRows(cartRows);
        processRows(orderRows);

        // Calculate available quantities
        const availableQuantities = {};
        sizeEntries.forEach(entry => {
          const sizeKey = entry.sizeKey;
          const totalQty = parseInt(entry.quantity, 10) || 0;
          const reserved = reservedBySizeKey[sizeKey] || 0;
          availableQuantities[sizeKey] = Math.max(0, totalQty - reserved);
        });

        res.json({
          message: "Available quantities retrieved successfully",
          item_id: parseInt(item_id, 10),
          available_quantities: availableQuantities,
          reserved_quantities: reservedBySizeKey
        });
      });
    });
  });
};
