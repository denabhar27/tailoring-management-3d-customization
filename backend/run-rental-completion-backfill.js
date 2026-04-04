const db = require('./config/db');

function parseJsonSafely(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapSizeInputToKey(sizeInput = '', entries = []) {
  const raw = String(sizeInput || '').trim().toLowerCase();
  if (!raw) return '';

  const aliasMap = {
    s: 'small',
    small: 'small',
    m: 'medium',
    medium: 'medium',
    l: 'large',
    large: 'large',
    xl: 'extra_large',
    'extra large': 'extra_large',
    extra_large: 'extra_large'
  };

  if (aliasMap[raw]) return aliasMap[raw];

  const byExact = entries.find((e) => String(e?.sizeKey || '').trim().toLowerCase() === raw);
  if (byExact) return String(byExact.sizeKey).trim();

  const byLabel = entries.find((e) => String(e?.label || '').trim().toLowerCase() === raw);
  if (byLabel) return String(byLabel.sizeKey || '').trim();

  return raw;
}

function normalizeSelectionKey(entry = {}, itemSizeEntries = []) {
  const direct = String(
    entry?.sizeKey || entry?.size_key || entry?.size || entry?.size_label || ''
  ).trim();

  if (direct) {
    return mapSizeInputToKey(direct, itemSizeEntries);
  }

  const label = String(entry?.label || '').trim();
  if (label) {
    return mapSizeInputToKey(label, itemSizeEntries);
  }

  return '';
}

function getSelectionRows(rawSelections = [], itemSizeEntries = []) {
  if (!Array.isArray(rawSelections)) return [];

  return rawSelections
    .map((entry) => {
      const sizeKey = normalizeSelectionKey(entry, itemSizeEntries);
      const quantity = Math.max(0, parseInt(entry?.quantity, 10) || 0);
      if (!sizeKey || quantity <= 0) return null;
      return { sizeKey, quantity };
    })
    .filter(Boolean);
}

async function run() {
  const startedAt = Date.now();
  const conn = db.promise();

  const ensureColumn = async (columnName, ddl) => {
    const [rows] = await conn.query(
      `
        SELECT 1 AS present
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'rental_inventory'
          AND column_name = ?
        LIMIT 1
      `,
      [columnName]
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      await conn.query(ddl);
      console.log(`Added missing column: rental_inventory.${columnName}`);
    }
  };

  await ensureColumn('times_rented', 'ALTER TABLE rental_inventory ADD COLUMN times_rented INT NOT NULL DEFAULT 0 AFTER total_available');
  await ensureColumn('size_rental_counts', 'ALTER TABLE rental_inventory ADD COLUMN size_rental_counts LONGTEXT NULL AFTER times_rented');

  const [inventoryRows] = await conn.query(
    'SELECT item_id, size FROM rental_inventory ORDER BY item_id ASC'
  );

  const itemSizeEntriesMap = new Map();
  const itemIds = [];

  for (const row of inventoryRows) {
    const itemId = Number(row.item_id);
    itemIds.push(itemId);

    const sizePayload = parseJsonSafely(row.size, {});
    const sizeEntries = Array.isArray(sizePayload?.size_entries) ? sizePayload.size_entries : [];
    itemSizeEntriesMap.set(itemId, sizeEntries);
  }

  const [orderRows] = await conn.query(
    `
      SELECT item_id, service_id, quantity, specific_data, approval_status
      FROM order_items
      WHERE service_type = 'rental'
        AND approval_status IN ('returned', 'completed')
    `
  );

  const totalsByItem = new Map();

  const ensureItem = (itemId) => {
    if (!totalsByItem.has(itemId)) {
      totalsByItem.set(itemId, { timesRented: 0, sizeCounts: {} });
    }
    return totalsByItem.get(itemId);
  };

  const applySelection = (itemId, selectedSizes = [], fallbackQty = 1) => {
    if (!itemId) return;

    const sizeEntries = itemSizeEntriesMap.get(itemId) || [];
    const rows = getSelectionRows(selectedSizes, sizeEntries);
    const qtyFromSizes = rows.reduce((sum, row) => sum + row.quantity, 0);
    const quantity = qtyFromSizes > 0 ? qtyFromSizes : Math.max(1, parseInt(fallbackQty, 10) || 1);

    const itemTotals = ensureItem(itemId);
    itemTotals.timesRented += quantity;

    for (const row of rows) {
      itemTotals.sizeCounts[row.sizeKey] = (itemTotals.sizeCounts[row.sizeKey] || 0) + row.quantity;
    }
  };

  for (const row of orderRows) {
    const specificData = parseJsonSafely(row.specific_data, {});
    const fallbackOrderQty = Math.max(1, parseInt(row.quantity, 10) || 1);

    const isBundle = specificData?.is_bundle === true || specificData?.category === 'rental_bundle';

    if (isBundle && Array.isArray(specificData.bundle_items)) {
      for (const bundleItem of specificData.bundle_items) {
        const bundleItemId = parseInt(bundleItem?.item_id || bundleItem?.id || bundleItem?.service_id, 10);
        if (!bundleItemId) continue;

        const selectedSizes =
          (Array.isArray(bundleItem?.selected_sizes) && bundleItem.selected_sizes) ||
          (Array.isArray(bundleItem?.selectedSizes) && bundleItem.selectedSizes) ||
          [];

        const fallbackQty = Math.max(1, parseInt(bundleItem?.quantity, 10) || fallbackOrderQty);
        applySelection(bundleItemId, selectedSizes, fallbackQty);
      }
      continue;
    }

    const rentalItemId = parseInt(row.service_id, 10);
    if (!rentalItemId) continue;

    const selectedSizes =
      (Array.isArray(specificData?.selected_sizes) && specificData.selected_sizes) ||
      (Array.isArray(specificData?.selectedSizes) && specificData.selectedSizes) ||
      [];

    applySelection(rentalItemId, selectedSizes, fallbackOrderQty);
  }

  await conn.query('START TRANSACTION');

  try {
    let updatedItems = 0;

    for (const itemId of itemIds) {
      const totals = totalsByItem.get(itemId) || { timesRented: 0, sizeCounts: {} };
      const timesRented = Math.max(0, parseInt(totals.timesRented, 10) || 0);
      const sizeCountsJson = JSON.stringify(totals.sizeCounts || {});

      await conn.query(
        `
          UPDATE rental_inventory
          SET times_rented = ?,
              size_rental_counts = ?
          WHERE item_id = ?
        `,
        [timesRented, sizeCountsJson, itemId]
      );

      updatedItems += 1;
    }

    await conn.query('COMMIT');

    const elapsedMs = Date.now() - startedAt;
    console.log('Backfill complete.');
    console.log(`Inventory items scanned: ${itemIds.length}`);
    console.log(`Completed rental rows scanned: ${orderRows.length}`);
    console.log(`Inventory items updated: ${updatedItems}`);
    console.log(`Elapsed: ${elapsedMs}ms`);
  } catch (err) {
    await conn.query('ROLLBACK');
    throw err;
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backfill failed:', err?.message || err);
    process.exit(1);
  });
