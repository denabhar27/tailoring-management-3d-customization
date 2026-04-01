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
    size_key,
    size_label,
    quantity,
    damage_level,
    damage_note,
    damaged_customer_name
  } = req.body;

  if (!size_key && !size_label) {
    return res.status(400).json({ message: 'Size is required.' });
  }

  RentalInventory.markSizeDamaged(item_id, {
    size_key: size_key || null,
    size_label: size_label || null,
    quantity,
    damage_level,
    damage_note,
    damaged_customer_name,
    processed_by_user_id: req.user?.id || null,
    processed_by_role: req.user?.role || 'admin'
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
