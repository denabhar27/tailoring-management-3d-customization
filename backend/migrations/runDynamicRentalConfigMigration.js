const fs = require('fs');
const path = require('path');
const db = require('../config/db');

const DEFAULT_RENTAL_DURATION = 3;
const DEFAULT_OVERDUE_RATE = 50;

const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    });
  });
};

const toDateOnly = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  return match[1];
};

const addRentalDays = (startDate, duration) => {
  const start = toDateOnly(startDate);
  if (!start) return null;
  const d = new Date(`${start}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const safeDuration = Math.max(1, parseInt(duration, 10) || DEFAULT_RENTAL_DURATION);
  d.setDate(d.getDate() + safeDuration - 1);
  return d.toISOString().split('T')[0];
};

const parseMaybeJson = (value, fallback = null) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeDuration = (value) => {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_RENTAL_DURATION;
  return Math.max(1, Math.min(30, parsed));
};

const normalizeOverdueRate = (value) => {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) return DEFAULT_OVERDUE_RATE;
  return Math.max(0, parsed);
};

const runSqlMigrationStatements = async () => {
  const migrationPath = path.join(__dirname, 'add_dynamic_rental_config.sql');
  if (!fs.existsSync(migrationPath)) {
    console.log('[DYNAMIC RENTAL MIGRATION] SQL file not found, skipping SQL step');
    return;
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    try {
      await runQuery(statement);
    } catch (err) {
      const msg = String(err.message || '').toLowerCase();
      if (msg.includes('duplicate column') || msg.includes('already exists')) {
        continue;
      }
      throw err;
    }
  }
};

const normalizeRentalInventorySizeProfiles = async () => {
  const rows = await runQuery('SELECT item_id, size FROM rental_inventory WHERE size IS NOT NULL');
  let updatedCount = 0;

  for (const row of rows || []) {
    const parsed = parseMaybeJson(row.size, null);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.size_entries)) {
      continue;
    }

    let changed = false;
    const nextEntries = parsed.size_entries.map((entry = {}) => {
      const nextDuration = normalizeDuration(entry.rental_duration);
      const nextOverdue = normalizeOverdueRate(entry.overdue_amount);

      if (entry.rental_duration !== nextDuration || entry.overdue_amount !== nextOverdue) {
        changed = true;
      }

      return {
        ...entry,
        rental_duration: nextDuration,
        overdue_amount: nextOverdue
      };
    });

    if (!changed) continue;

    const nextPayload = {
      ...parsed,
      size_entries: nextEntries
    };

    await runQuery('UPDATE rental_inventory SET size = ? WHERE item_id = ?', [JSON.stringify(nextPayload), row.item_id]);
    updatedCount += 1;
  }

  return updatedCount;
};

const normalizeSelectedSizeTerms = (selectedSizes, startDate, fallbackDueDate, fallbackDuration, fallbackOverdue) => {
  if (!Array.isArray(selectedSizes)) {
    return { normalized: selectedSizes, changed: false, dueDates: [], durations: [], rates: [] };
  }

  let changed = false;
  const dueDates = [];
  const durations = [];
  const rates = [];

  const normalized = selectedSizes.map((entry = {}) => {
    const duration = normalizeDuration(entry.rental_duration ?? entry.duration ?? fallbackDuration);
    const overdueRate = normalizeOverdueRate(entry.overdue_amount ?? entry.overdue_rate ?? fallbackOverdue);

    const dueDate = toDateOnly(entry.due_date)
      || addRentalDays(startDate, duration)
      || toDateOnly(fallbackDueDate)
      || null;

    durations.push(duration);
    rates.push(overdueRate);
    if (dueDate) dueDates.push(dueDate);

    if (
      entry.rental_duration !== duration ||
      parseFloat(entry.overdue_amount) !== overdueRate ||
      toDateOnly(entry.due_date) !== dueDate ||
      parseFloat(entry.overdue_rate) !== overdueRate
    ) {
      changed = true;
    }

    return {
      ...entry,
      rental_duration: duration,
      overdue_amount: overdueRate,
      overdue_rate: overdueRate,
      due_date: dueDate
    };
  });

  return { normalized, changed, dueDates, durations, rates };
};

const maxDate = (dates = []) => {
  if (!Array.isArray(dates) || dates.length === 0) return null;
  return dates.reduce((latest, current) => {
    if (!latest) return current;
    return current > latest ? current : latest;
  }, null);
};

const normalizeRentalOrderTerms = async () => {
  const rows = await runQuery(`
    SELECT
      item_id,
      specific_data,
      pricing_factors,
      rental_start_date,
      rental_end_date,
      rental_duration,
      overdue_rate,
      due_date
    FROM order_items
    WHERE service_type = 'rental'
  `);

  let updatedCount = 0;

  for (const row of rows || []) {
    const specificData = parseMaybeJson(row.specific_data, {}) || {};
    const pricingFactors = parseMaybeJson(row.pricing_factors, {}) || {};

    const fallbackDuration = normalizeDuration(
      row.rental_duration ?? pricingFactors.rental_duration ?? pricingFactors.duration ?? DEFAULT_RENTAL_DURATION
    );
    const fallbackOverdue = normalizeOverdueRate(
      row.overdue_rate ?? pricingFactors.overdue_rate ?? pricingFactors.overdue_amount ?? DEFAULT_OVERDUE_RATE
    );

    const fallbackDueDate =
      toDateOnly(row.due_date)
      || toDateOnly(row.rental_end_date)
      || addRentalDays(row.rental_start_date, fallbackDuration);

    let changed = false;
    const aggregateDueDates = [];
    const aggregateDurations = [];
    const aggregateRates = [];

    if (specificData && specificData.is_bundle === true && Array.isArray(specificData.bundle_items)) {
      const nextBundleItems = specificData.bundle_items.map((bundleItem = {}) => {
        const selectedSizes = bundleItem.selected_sizes || bundleItem.selectedSizes || [];
        const result = normalizeSelectedSizeTerms(
          selectedSizes,
          bundleItem.rental_start_date || specificData.rental_start_date || row.rental_start_date,
          bundleItem.rental_end_date || fallbackDueDate,
          fallbackDuration,
          fallbackOverdue
        );

        if (result.changed) changed = true;
        aggregateDueDates.push(...result.dueDates);
        aggregateDurations.push(...result.durations);
        aggregateRates.push(...result.rates);

        const bundleChanged = result.changed || bundleItem.selected_sizes !== result.normalized || bundleItem.selectedSizes !== result.normalized;
        if (!bundleChanged) return bundleItem;

        return {
          ...bundleItem,
          selected_sizes: result.normalized,
          selectedSizes: result.normalized
        };
      });

      if (changed) {
        specificData.bundle_items = nextBundleItems;
      }
    } else {
      const selectedSizes = specificData.selected_sizes || specificData.selectedSizes || [];
      const result = normalizeSelectedSizeTerms(
        selectedSizes,
        specificData.rental_start_date || row.rental_start_date,
        specificData.rental_end_date || fallbackDueDate,
        fallbackDuration,
        fallbackOverdue
      );

      if (result.changed) changed = true;
      aggregateDueDates.push(...result.dueDates);
      aggregateDurations.push(...result.durations);
      aggregateRates.push(...result.rates);

      if (result.changed) {
        specificData.selected_sizes = result.normalized;
        specificData.selectedSizes = result.normalized;
      }
    }

    const nextDuration = aggregateDurations.length > 0 ? Math.max(...aggregateDurations) : fallbackDuration;
    const nextOverdueRate = aggregateRates.length > 0 ? Math.max(...aggregateRates) : fallbackOverdue;
    const nextDueDate = maxDate(aggregateDueDates) || fallbackDueDate || null;

    if (pricingFactors.rental_duration !== nextDuration) {
      pricingFactors.rental_duration = nextDuration;
      changed = true;
    }
    if (parseFloat(pricingFactors.overdue_rate) !== nextOverdueRate) {
      pricingFactors.overdue_rate = nextOverdueRate;
      changed = true;
    }
    if (toDateOnly(pricingFactors.due_date) !== nextDueDate) {
      pricingFactors.due_date = nextDueDate;
      changed = true;
    }

    if (
      normalizeDuration(row.rental_duration) !== nextDuration ||
      normalizeOverdueRate(row.overdue_rate) !== nextOverdueRate ||
      toDateOnly(row.due_date) !== nextDueDate
    ) {
      changed = true;
    }

    if (!changed) continue;

    await runQuery(
      `
        UPDATE order_items
        SET
          specific_data = ?,
          pricing_factors = ?,
          rental_duration = ?,
          overdue_rate = ?,
          due_date = ?,
          rental_end_date = COALESCE(rental_end_date, ?)
        WHERE item_id = ?
      `,
      [
        JSON.stringify(specificData),
        JSON.stringify(pricingFactors),
        nextDuration,
        nextOverdueRate,
        nextDueDate,
        nextDueDate,
        row.item_id
      ]
    );

    updatedCount += 1;
  }

  return updatedCount;
};

const runDynamicRentalConfigMigration = async () => {
  await runSqlMigrationStatements();
  const inventoryUpdates = await normalizeRentalInventorySizeProfiles();
  const orderUpdates = await normalizeRentalOrderTerms();

  console.log(
    `[DYNAMIC RENTAL MIGRATION] Completed. Updated ${inventoryUpdates} rental inventory profile(s) and ${orderUpdates} rental order item(s).`
  );
};

module.exports = { runDynamicRentalConfigMigration };
