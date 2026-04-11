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
          SET size = ?
          WHERE item_id = ?
        `;
        db.query(rollbackSql, [row.previousSize, row.itemId], () => rollbackNext());
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
        SET size = ?
        WHERE item_id = ?
      `;

      db.query(updateSql, [nextSizePayload, reservation.itemId], (updateErr, updateResult) => {
        if (updateErr) {
          return rollbackApplied(() => callback(updateErr));
        }

        applied.push({ itemId: reservation.itemId, qty: reservation.qty, previousSize: row.size });
        applyNext();
      });
    };

    applyNext();
  });
}

function toNumber(value, fallback = 0) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeRentalDuration(value) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 3;
  return Math.max(1, Math.min(30, parsed));
}

function normalizeOverdueRate(value) {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(0, parsed);
}

function toDateOnly(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function addDaysToDate(startDate, days) {
  const dateOnly = toDateOnly(startDate);
  if (!dateOnly) return null;
  const d = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const safeDays = Math.max(1, parseInt(days, 10) || 1);
  d.setDate(d.getDate() + safeDays - 1);
  return d.toISOString().split('T')[0];
}

function normalizeSelectedSizesWithTerms(selectedSizes, startDate, fallbackDuration, fallbackOverdueRate, fallbackDueDate) {
  if (!Array.isArray(selectedSizes)) {
    return { selectedSizes: [], duration: fallbackDuration, overdueRate: fallbackOverdueRate, dueDate: fallbackDueDate };
  }

  const durations = [];
  const overdueRates = [];
  const dueDates = [];

  const normalized = selectedSizes.map((entry = {}) => {
    const rentalDuration = normalizeRentalDuration(entry.rental_duration ?? entry.duration ?? fallbackDuration);
    const overdueAmount = normalizeOverdueRate(entry.overdue_amount ?? entry.overdue_rate ?? fallbackOverdueRate);
    const dueDate = toDateOnly(entry.due_date)
      || addDaysToDate(startDate, rentalDuration)
      || toDateOnly(fallbackDueDate)
      || null;

    durations.push(rentalDuration);
    overdueRates.push(overdueAmount);
    if (dueDate) dueDates.push(dueDate);

    return {
      ...entry,
      rental_duration: rentalDuration,
      overdue_amount: overdueAmount,
      overdue_rate: overdueAmount,
      due_date: dueDate
    };
  });

  const duration = durations.length > 0 ? Math.max(...durations) : fallbackDuration;
  const overdueRate = overdueRates.length > 0 ? Math.max(...overdueRates) : fallbackOverdueRate;
  const dueDate = dueDates.length > 0
    ? dueDates.reduce((latest, current) => (current > latest ? current : latest), dueDates[0])
    : (toDateOnly(fallbackDueDate) || addDaysToDate(startDate, duration));

  return { selectedSizes: normalized, duration, overdueRate, dueDate };
}

function buildRentalTermsFromSpecificData(specificData = {}, rentalStartDate, fallbackDuration, fallbackOverdueRate, fallbackDueDate) {
  const nextSpecificData = { ...specificData };

  if (nextSpecificData?.is_bundle && Array.isArray(nextSpecificData.bundle_items)) {
    const durations = [];
    const rates = [];
    const dueDates = [];

    nextSpecificData.bundle_items = nextSpecificData.bundle_items.map((bundleItem = {}) => {
      const selectedSizes = bundleItem.selected_sizes || bundleItem.selectedSizes || [];
      const normalized = normalizeSelectedSizesWithTerms(
        selectedSizes,
        bundleItem.rental_start_date || rentalStartDate,
        fallbackDuration,
        fallbackOverdueRate,
        bundleItem.rental_end_date || fallbackDueDate
      );

      durations.push(normalized.duration);
      rates.push(normalized.overdueRate);
      if (normalized.dueDate) dueDates.push(normalized.dueDate);

      return {
        ...bundleItem,
        selected_sizes: normalized.selectedSizes,
        selectedSizes: normalized.selectedSizes,
        rental_duration: normalized.duration,
        overdue_rate: normalized.overdueRate,
        due_date: normalized.dueDate,
        rental_end_date: normalized.dueDate || bundleItem.rental_end_date || null
      };
    });

    const duration = durations.length > 0 ? Math.max(...durations) : fallbackDuration;
    const overdueRate = rates.length > 0 ? Math.max(...rates) : fallbackOverdueRate;
    const dueDate = dueDates.length > 0
      ? dueDates.reduce((latest, current) => (current > latest ? current : latest), dueDates[0])
      : (toDateOnly(fallbackDueDate) || addDaysToDate(rentalStartDate, duration));

    nextSpecificData.rental_duration = duration;
    nextSpecificData.overdue_rate = overdueRate;
    nextSpecificData.due_date = dueDate;
    nextSpecificData.rental_end_date = dueDate;

    return { specificData: nextSpecificData, duration, overdueRate, dueDate };
  }

  const selectedSizes = nextSpecificData.selected_sizes || nextSpecificData.selectedSizes || [];
  const normalized = normalizeSelectedSizesWithTerms(
    selectedSizes,
    rentalStartDate,
    fallbackDuration,
    fallbackOverdueRate,
    fallbackDueDate
  );

  nextSpecificData.selected_sizes = normalized.selectedSizes;
  nextSpecificData.selectedSizes = normalized.selectedSizes;
  nextSpecificData.rental_duration = normalized.duration;
  nextSpecificData.overdue_rate = normalized.overdueRate;
  nextSpecificData.due_date = normalized.dueDate;
  nextSpecificData.rental_end_date = normalized.dueDate;

  return {
    specificData: nextSpecificData,
    duration: normalized.duration,
    overdueRate: normalized.overdueRate,
    dueDate: normalized.dueDate
  };
}

function buildPreparedOrderItemsFromCart(cartItems = []) {
  const supportedServices = new Set(['dry_cleaning', 'repair', 'customization', 'customize']);
  const preparedItems = [];

  cartItems.forEach((rawItem) => {
    if (!rawItem) return;

    const specificData = parseJsonSafely(rawItem.specific_data, {});
    const pricingFactors = parseJsonSafely(rawItem.pricing_factors, {});
    const garments = Array.isArray(specificData.garments) ? specificData.garments.filter(Boolean) : [];
    const sourceCartId = rawItem.cart_id || null;

    if (rawItem.service_type === 'rental' && specificData?.is_bundle && Array.isArray(specificData.bundle_items) && specificData.bundle_items.length > 0) {
      const preparedCountBeforeBundle = preparedItems.length;
      const bundleItems = specificData.bundle_items.filter(Boolean);
      const fallbackLinePrice = toNumber(rawItem.final_price, toNumber(rawItem.base_price, 0));
      const totalBundleSelectedSizes = bundleItems.reduce((sum, bundleItem = {}) => {
        const sizes = Array.isArray(bundleItem.selected_sizes) ? bundleItem.selected_sizes : (Array.isArray(bundleItem.selectedSizes) ? bundleItem.selectedSizes : []);
        return sum + Math.max(0, sizes.length);
      }, 0);
      const splitFallback = fallbackLinePrice / Math.max(totalBundleSelectedSizes, 1);

      bundleItems.forEach((bundleItem = {}, bundleIndex) => {
        const bundleItemId = parseInt(bundleItem.item_id ?? bundleItem.id ?? bundleItem.service_id, 10);
        if (!bundleItemId) return;

        const sizeOptions = bundleItem.size_options || bundleItem.sizeOptions || {};
        const selectedSizesRaw = Array.isArray(bundleItem.selected_sizes)
          ? bundleItem.selected_sizes.filter(Boolean)
          : (Array.isArray(bundleItem.selectedSizes) ? bundleItem.selectedSizes.filter(Boolean) : []);

        selectedSizesRaw.forEach((entry = {}, index) => {
          const sizeKey = entry.sizeKey || entry.size_key || null;
          const sizeLabel = entry.label || entry.sizeLabel || sizeKey || `Size ${index + 1}`;
          const sizeQty = Math.max(1, parseInt(entry.quantity, 10) || 1);

          const option = sizeKey ? (sizeOptions[sizeKey] || {}) : {};
          const unitPrice = toNumber(entry.price, toNumber(option.price, 0));
          const cycleDays = normalizeRentalDuration(option.rental_duration ?? option.rentalDuration ?? entry.billing_cycle ?? 3);
          const selectedDays = normalizeRentalDuration(entry.rental_duration ?? entry.rentalDuration ?? cycleDays);
          const cycleCount = Math.max(1, Math.ceil(selectedDays / Math.max(1, cycleDays)));
          const computedLinePrice = unitPrice > 0 ? (sizeQty * unitPrice * cycleCount) : splitFallback;
          const linePrice = toNumber(computedLinePrice, splitFallback);

          const unitDeposit = toNumber(entry.deposit, toNumber(option.deposit, 0));
          const lineDeposit = Math.max(0, sizeQty * unitDeposit);
          const overdueAmount = normalizeOverdueRate(entry.overdue_amount ?? entry.overdueRate ?? option.overdue_amount ?? option.overdueRate ?? 50);
          const dueDate = toDateOnly(entry.due_date || entry.dueDate || bundleItem.rental_end_date || rawItem.rental_end_date) || addDaysToDate(rawItem.rental_start_date, selectedDays);

          const childSpecificData = {
            ...specificData,
            is_bundle: false,
            category: 'rental',
            service_id: bundleItemId,
            item_id: bundleItemId,
            item_name: bundleItem.item_name || `Bundle Item ${bundleIndex + 1}`,
            image_url: bundleItem.image_url || bundleItem.imageUrl || bundleItem.img || specificData.image_url || specificData.imageUrl || null,
            img: bundleItem.img || bundleItem.image_url || bundleItem.imageUrl || specificData.img || specificData.image_url || specificData.imageUrl || null,
            front_image: bundleItem.front_image || bundleItem.frontImage || specificData.front_image || specificData.frontImage || null,
            back_image: bundleItem.back_image || bundleItem.backImage || specificData.back_image || specificData.backImage || null,
            side_image: bundleItem.side_image || bundleItem.sideImage || specificData.side_image || specificData.sideImage || null,
            size: `${sizeLabel} x${sizeQty}`,
            selected_size: sizeKey,
            selected_sizes: [{
              ...entry,
              sizeKey,
              label: sizeLabel,
              quantity: sizeQty,
              price: unitPrice > 0 ? unitPrice : entry.price,
              deposit: unitDeposit,
              rental_duration: selectedDays,
              overdue_amount: overdueAmount,
              due_date: dueDate
            }],
            selectedSizes: [{
              ...entry,
              sizeKey,
              label: sizeLabel,
              quantity: sizeQty,
              price: unitPrice > 0 ? unitPrice : entry.price,
              deposit: unitDeposit,
              rental_duration: selectedDays,
              overdue_amount: overdueAmount,
              due_date: dueDate
            }],
            size_options: sizeOptions,
            rental_duration: selectedDays,
            overdue_rate: overdueAmount,
            due_date: dueDate,
            rental_end_date: dueDate,
            __sourceCartId: sourceCartId
          };

          const childPricingFactors = {
            ...pricingFactors,
            is_bundle: false,
            price: linePrice,
            duration: selectedDays,
            rental_duration: selectedDays,
            overdue_rate: overdueAmount,
            due_date: dueDate,
            downpayment: lineDeposit.toString(),
            deposit: lineDeposit.toString(),
            total_due_on_pickup: (linePrice + lineDeposit).toString()
          };

          preparedItems.push({
            ...rawItem,
            service_id: bundleItemId,
            quantity: sizeQty,
            base_price: linePrice,
            final_price: linePrice,
            rental_end_date: dueDate,
            pricing_factors: childPricingFactors,
            specific_data: childSpecificData
          });
        });
      });

      if (preparedItems.length > preparedCountBeforeBundle) {
        return;
      }
    }

    if (rawItem.service_type === 'rental' && !specificData?.is_bundle) {
      const selectedSizesRaw = Array.isArray(specificData.selected_sizes)
        ? specificData.selected_sizes.filter(Boolean)
        : (Array.isArray(specificData.selectedSizes) ? specificData.selectedSizes.filter(Boolean) : []);

      if (selectedSizesRaw.length > 0) {
        const sizeOptions = specificData.size_options || specificData.sizeOptions || {};
        const fallbackLinePrice = toNumber(rawItem.final_price, toNumber(rawItem.base_price, 0));
        const splitFallback = fallbackLinePrice / Math.max(selectedSizesRaw.length, 1);

        selectedSizesRaw.forEach((entry = {}, index) => {
          const sizeKey = entry.sizeKey || entry.size_key || null;
          const sizeLabel = entry.label || entry.sizeLabel || sizeKey || `Size ${index + 1}`;
          const sizeQty = Math.max(1, parseInt(entry.quantity, 10) || 1);

          const option = sizeKey ? (sizeOptions[sizeKey] || {}) : {};
          const unitPrice = toNumber(entry.price, toNumber(option.price, 0));
          const cycleDays = normalizeRentalDuration(option.rental_duration ?? option.rentalDuration ?? entry.billing_cycle ?? 3);
          const selectedDays = normalizeRentalDuration(entry.rental_duration ?? entry.rentalDuration ?? cycleDays);
          const cycleCount = Math.max(1, Math.ceil(selectedDays / Math.max(1, cycleDays)));
          const computedLinePrice = unitPrice > 0 ? (sizeQty * unitPrice * cycleCount) : splitFallback;
          const linePrice = toNumber(computedLinePrice, splitFallback);

          const unitDeposit = toNumber(entry.deposit, toNumber(option.deposit, 0));
          const lineDeposit = Math.max(0, sizeQty * unitDeposit);
          const overdueAmount = normalizeOverdueRate(entry.overdue_amount ?? entry.overdueRate ?? option.overdue_amount ?? option.overdueRate ?? 50);
          const dueDate = toDateOnly(entry.due_date || entry.dueDate || rawItem.rental_end_date) || addDaysToDate(rawItem.rental_start_date, selectedDays);

          const childSpecificData = {
            ...specificData,
            size: `${sizeLabel} x${sizeQty}`,
            selected_size: sizeKey,
            selected_sizes: [{
              ...entry,
              sizeKey,
              label: sizeLabel,
              quantity: sizeQty,
              price: unitPrice > 0 ? unitPrice : entry.price,
              deposit: unitDeposit,
              rental_duration: selectedDays,
              overdue_amount: overdueAmount,
              due_date: dueDate
            }],
            selectedSizes: [{
              ...entry,
              sizeKey,
              label: sizeLabel,
              quantity: sizeQty,
              price: unitPrice > 0 ? unitPrice : entry.price,
              deposit: unitDeposit,
              rental_duration: selectedDays,
              overdue_amount: overdueAmount,
              due_date: dueDate
            }],
            rental_duration: selectedDays,
            overdue_rate: overdueAmount,
            due_date: dueDate,
            rental_end_date: dueDate,
            __sourceCartId: sourceCartId
          };

          const childPricingFactors = {
            ...pricingFactors,
            price: linePrice,
            duration: selectedDays,
            rental_duration: selectedDays,
            overdue_rate: overdueAmount,
            due_date: dueDate,
            downpayment: lineDeposit.toString(),
            deposit: lineDeposit.toString(),
            total_due_on_pickup: (linePrice + lineDeposit).toString()
          };

          preparedItems.push({
            ...rawItem,
            quantity: sizeQty,
            base_price: linePrice,
            final_price: linePrice,
            rental_end_date: dueDate,
            pricing_factors: childPricingFactors,
            specific_data: childSpecificData
          });
        });

        return;
      }
    }

    if (!supportedServices.has(rawItem.service_type) || garments.length <= 1) {
      preparedItems.push({
        ...rawItem,
        quantity: Math.max(1, parseInt(rawItem.quantity, 10) || 1),
        base_price: toNumber(rawItem.base_price, toNumber(rawItem.final_price, 0)),
        final_price: toNumber(rawItem.final_price, toNumber(rawItem.base_price, 0)),
        pricing_factors: pricingFactors,
        specific_data: {
          ...specificData,
          __sourceCartId: sourceCartId
        }
      });
      return;
    }

    garments.forEach((garment, index) => {
      const childSpecificData = {
        ...specificData,
        garments: [garment],
        isMultipleGarments: false,
        parentGarmentCount: garments.length,
        childGarmentIndex: index + 1,
        __sourceCartId: sourceCartId
      };

      const childPricingFactors = { ...pricingFactors };
      let childQuantity = 1;
      let childBasePrice = 0;
      let childFinalPrice = 0;

      if (rawItem.service_type === 'dry_cleaning') {
        childQuantity = Math.max(1, parseInt(garment.quantity, 10) || 1);
        const pricePerItem = toNumber(garment.pricePerItem, toNumber(childPricingFactors.pricePerItem, 0));
        const splitFallback = toNumber(rawItem.final_price, 0) / Math.max(garments.length, 1);

        childBasePrice = pricePerItem > 0 ? (pricePerItem * childQuantity) : splitFallback;
        childFinalPrice = childBasePrice;

        childSpecificData.garmentType = garment.garmentType || childSpecificData.garmentType;
        childSpecificData.brand = garment.brand || childSpecificData.brand;
        childSpecificData.quantity = childQuantity;
        childSpecificData.pricePerItem = pricePerItem > 0 ? pricePerItem : (childSpecificData.pricePerItem || null);
        childSpecificData.isEstimatedPrice = Boolean(garment.isEstimated || specificData.isEstimatedPrice);

        childPricingFactors.quantity = childQuantity;
        if (pricePerItem > 0) {
          childPricingFactors.pricePerItem = pricePerItem;
        }
      } else if (rawItem.service_type === 'repair') {
        const garmentBasePrice = toNumber(garment.basePrice, 0);
        const splitFallback = toNumber(rawItem.final_price, 0) / Math.max(garments.length, 1);

        childQuantity = 1;
        childBasePrice = garmentBasePrice > 0 ? garmentBasePrice : splitFallback;
        childFinalPrice = childBasePrice;

        childSpecificData.garmentType = garment.garmentType || childSpecificData.garmentType;
        childSpecificData.damageLevel = garment.damageLevel || childSpecificData.damageLevel;
        childSpecificData.damageLevelId = garment.damageLevelId ?? childSpecificData.damageLevelId;
        childSpecificData.damageLevelDescription = garment.damageLevelDescription || childSpecificData.damageLevelDescription;
        childSpecificData.size = garment.size || childSpecificData.size;
        childSpecificData.damageDescription = garment.notes || childSpecificData.damageDescription;
        childSpecificData.notes = garment.notes || childSpecificData.notes;
      } else {
        const estimatedPrice = toNumber(garment.estimatedPrice, 0);
        const splitFallback = toNumber(rawItem.final_price, 0) / Math.max(garments.length, 1);

        childQuantity = 1;
        childBasePrice = estimatedPrice > 0 ? estimatedPrice : splitFallback;
        childFinalPrice = childBasePrice;

        childSpecificData.fabricType = garment.fabricType || childSpecificData.fabricType;
        childSpecificData.garmentType = garment.garmentType || childSpecificData.garmentType;
        childSpecificData.imageUrl = garment.imageUrl || childSpecificData.imageUrl;
        childSpecificData.designData = garment.designData || childSpecificData.designData || {};
        childSpecificData.isUniform = garment.isUniform === true;

        childPricingFactors.isUniform = garment.isUniform === true;
      }

      preparedItems.push({
        ...rawItem,
        quantity: childQuantity,
        base_price: childBasePrice,
        final_price: childFinalPrice,
        pricing_factors: childPricingFactors,
        specific_data: childSpecificData
      });
    });
  });

  return preparedItems;
}

const Order = {
  
  createFromCart: (userId, cartItems, totalPrice, notes, callback) => {
    const preparedCartItems = buildPreparedOrderItemsFromCart(cartItems);
    const normalizedTotalPrice = preparedCartItems.reduce((sum, item) => {
      return sum + toNumber(item.final_price, 0);
    }, 0);

    const orderSql = `
      INSERT INTO orders (user_id, total_price, status, order_date, notes)
      VALUES (?, ?, 'pending', NOW(), ?)
    `;

    db.query(orderSql, [userId, normalizedTotalPrice.toString(), notes], (err, orderResult) => {
      if (err) {
        return callback(err, null);
      }

      const orderId = orderResult.insertId;

      const itemValues = preparedCartItems.map(item => {
        let specificData = parseJsonSafely(item.specific_data, {});
        const factors = parseJsonSafely(item.pricing_factors, {});
        let rentalDuration = null;
        let overdueRate = null;
        let dueDate = null;

        if (item.service_type === 'rental') {
          try {
            const itemTotalPrice = parseFloat(item.final_price || 0);
            const expectedDownpayment = itemTotalPrice * 0.5;

            const fallbackDuration = normalizeRentalDuration(factors.rental_duration ?? factors.duration ?? 3);
            const fallbackOverdueRate = normalizeOverdueRate(factors.overdue_rate ?? factors.overdue_amount ?? 50);
            const fallbackDueDate = toDateOnly(item.rental_end_date) || addDaysToDate(item.rental_start_date, fallbackDuration);

            const terms = buildRentalTermsFromSpecificData(
              specificData,
              item.rental_start_date,
              fallbackDuration,
              fallbackOverdueRate,
              fallbackDueDate
            );

            specificData = terms.specificData;
            rentalDuration = terms.duration;
            overdueRate = terms.overdueRate;
            dueDate = terms.dueDate;

            factors.downpayment = expectedDownpayment.toString();
            factors.down_payment = expectedDownpayment.toString();
            factors.rental_duration = rentalDuration;
            factors.duration = rentalDuration;
            factors.overdue_rate = overdueRate;
            factors.due_date = dueDate;
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
          dueDate || item.rental_end_date,
          rentalDuration,
          overdueRate,
          dueDate || item.rental_end_date,
          JSON.stringify(factors),
          JSON.stringify(specificData)
        ];
      });

      const itemSql = `
        INSERT INTO order_items (
          order_id, service_type, service_id, quantity, base_price, final_price,
          appointment_date, rental_start_date, rental_end_date, rental_duration, overdue_rate, due_date,
          pricing_factors, specific_data
        ) VALUES ?
      `;

      db.query(itemSql, [itemValues], (itemErr, itemResult) => {
        if (itemErr) {
          return callback(itemErr, null);
        }

        reserveRentalInventoryFromCartItems(preparedCartItems, (reserveErr) => {
          console.log('[INVENTORY] ===== RENTAL INVENTORY RESERVATION =====');
          console.log('[INVENTORY] Cart items:', JSON.stringify(preparedCartItems.map(item => ({
            service_type: item.service_type,
            service_id: item.service_id,
            quantity: item.quantity,
            specific_data: item.specific_data
          })), null, 2));
          if (reserveErr) {
            console.error('[INVENTORY] ===== RESERVATION FAILED =====');
            console.error('[INVENTORY] Error:', reserveErr.message);
            const cleanupItemsSql = `DELETE FROM order_items WHERE order_id = ?`;
            db.query(cleanupItemsSql, [orderId], () => {
              const cleanupOrderSql = `DELETE FROM orders WHERE order_id = ?`;
              db.query(cleanupOrderSql, [orderId], () => {
                return callback(reserveErr, null);
              });
            });
            return;
          }

          console.log('[INVENTORY] ===== RESERVATION SUCCESSFUL =====');
          console.log('[INVENTORY] Inventory has been deducted for rental items');

          const getOrderItemsSql = `
            SELECT item_id, service_type, appointment_date, specific_data
            FROM order_items
            WHERE order_id = ?
            ORDER BY item_id ASC
          `;
        
          db.query(getOrderItemsSql, [orderId], (getItemsErr, orderItems) => {
          
          const AppointmentSlot = require('./AppointmentSlotModel');

          let linkedCount = 0;
          const appointmentCartItems = (cartItems || []).filter(item =>
            ['dry_cleaning', 'repair', 'customization'].includes(item.service_type)
          );
          const totalAppointmentItems = appointmentCartItems.length;

          const linkSlotPromises = [];
          
          if (!getItemsErr && orderItems) {
            const orderItemBySourceCartId = new Map();

            orderItems.forEach((orderItem) => {
              const itemSpecificData = parseJsonSafely(orderItem.specific_data, {});
              const sourceCartId = itemSpecificData.__sourceCartId;

              if (sourceCartId !== null && sourceCartId !== undefined && sourceCartId !== '' && !orderItemBySourceCartId.has(Number(sourceCartId))) {
                orderItemBySourceCartId.set(Number(sourceCartId), orderItem);
              }
            });
            
            appointmentCartItems.forEach((cartItem, index) => {
              if (!cartItem || !cartItem.cart_id) return;
              
              const orderItem = orderItemBySourceCartId.get(Number(cartItem.cart_id)) || orderItems[index];
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
                childOrderIds: orderItems.map((item) => item.item_id),
                orderResult: orderResult,
                itemResult: itemResult
              });
            }).catch((err) => {
              console.error('[ORDER] Error during slot linking:', err);
              
              callback(null, {
                orderId: orderId,
                childOrderIds: orderItems.map((item) => item.item_id),
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
              childOrderIds: orderItems ? orderItems.map((item) => item.item_id) : preparedCartItems.map((_, index) => itemResult.insertId + index),
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
        let specificData = parseJsonSafely(item.specific_data, {});
        let rentalDuration = null;
        let overdueRate = null;
        let dueDate = null;

        if (item.service_type === 'rental') {
          try {
            const factors = typeof pricingFactors === 'string' ? JSON.parse(pricingFactors) : pricingFactors;
            const totalPrice = parseFloat(item.final_price || 0);
            const expectedDownpayment = totalPrice * 0.5;

            const fallbackDuration = normalizeRentalDuration(factors.rental_duration ?? factors.duration ?? item.rental_duration ?? 3);
            const fallbackOverdueRate = normalizeOverdueRate(factors.overdue_rate ?? factors.overdue_amount ?? item.overdue_rate ?? 50);
            const fallbackDueDate = toDateOnly(item.due_date) || toDateOnly(item.rental_end_date) || addDaysToDate(item.rental_start_date, fallbackDuration);

            const terms = buildRentalTermsFromSpecificData(
              specificData,
              item.rental_start_date,
              fallbackDuration,
              fallbackOverdueRate,
              fallbackDueDate
            );

            specificData = terms.specificData;
            rentalDuration = terms.duration;
            overdueRate = terms.overdueRate;
            dueDate = terms.dueDate;
            
            factors.downpayment = expectedDownpayment.toString();
            factors.down_payment = expectedDownpayment.toString();
            factors.rental_duration = rentalDuration;
            factors.duration = rentalDuration;
            factors.overdue_rate = overdueRate;
            factors.due_date = dueDate;
            
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
          dueDate || item.rental_end_date,
          rentalDuration,
          overdueRate,
          dueDate || item.rental_end_date,
          pricingFactors,
          JSON.stringify(specificData)
        ];
      });

      const itemSql = `
        INSERT INTO order_items (
          order_id, service_type, service_id, quantity, base_price, final_price,
          appointment_date, rental_start_date, rental_end_date, rental_duration, overdue_rate, due_date,
          pricing_factors, specific_data,
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
            const childOrderIds = Array.isArray(items)
              ? items.map((_, index) => itemResult.insertId + index)
              : [];
          console.log('[ORDER MODEL] ✅ Order created successfully, orderId:', orderId);
            callback(null, { orderId: orderId, childOrderIds, orderResult: orderResult, itemResult: itemResult });
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
      ORDER BY COALESCE((SELECT MAX(al.created_at) FROM action_logs al WHERE al.order_item_id = oi.item_id), o.order_date) DESC
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
      ORDER BY COALESCE((SELECT MAX(al.created_at) FROM action_logs al WHERE al.order_item_id = oi.item_id), o.order_date) DESC
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
        o.order_id as parent_order_id,
        oi.item_id as child_order_id,
        DATE_FORMAT(oi.appointment_date, '%Y-%m-%d %H:%i:%s') as appointment_date,
        DATE_FORMAT(oi.rental_start_date, '%Y-%m-%d') as rental_start_date,
        DATE_FORMAT(oi.rental_end_date, '%Y-%m-%d') as rental_end_date
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      WHERE oi.order_id = ?
      ORDER BY oi.item_id ASC
    `;
    db.query(sql, [orderId], callback);
  },

  getOrderItemById: (itemId, callback) => {
    const sql = `
      SELECT oi.*, o.user_id, DATE_FORMAT(o.order_date, '%Y-%m-%d %H:%i:%s') as order_date,
             o.order_id as parent_order_id,
             oi.item_id as child_order_id,
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
      ORDER BY COALESCE((SELECT MAX(al.created_at) FROM action_logs al WHERE al.order_item_id = oi.item_id), o.order_date) DESC
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
      ORDER BY COALESCE((SELECT MAX(al.created_at) FROM action_logs al WHERE al.order_item_id = oi.item_id), o.order_date) DESC
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
      ORDER BY COALESCE((SELECT MAX(al.created_at) FROM action_logs al WHERE al.order_item_id = oi.item_id), o.order_date) DESC
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
      ORDER BY COALESCE((SELECT MAX(al.created_at) FROM action_logs al WHERE al.order_item_id = oi.item_id), o.order_date) DESC
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
      ORDER BY COALESCE((SELECT MAX(al.created_at) FROM action_logs al WHERE al.order_item_id = oi.item_id), o.order_date) DESC
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
      DATE_FORMAT(oi.due_date, '%Y-%m-%d') as due_date,
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
    ORDER BY COALESCE((SELECT MAX(al.created_at) FROM action_logs al WHERE al.order_item_id = oi.item_id), o.order_date) DESC
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
      DATE_FORMAT(oi.rental_end_date, '%Y-%m-%d') as rental_end_date,
      DATE_FORMAT(oi.due_date, '%Y-%m-%d') as due_date
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.order_id
    LEFT JOIN user u ON o.user_id = u.user_id
    LEFT JOIN walk_in_customers wc ON o.walk_in_customer_id = wc.id
    WHERE oi.service_type = 'rental' 
    AND (o.status = ? OR oi.approval_status = ?)
    ORDER BY COALESCE((SELECT MAX(al.created_at) FROM action_logs al WHERE al.order_item_id = oi.item_id), o.order_date) DESC
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

