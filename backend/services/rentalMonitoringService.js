

const db = require('../config/db');
const emailService = require('./emailService');
const Notification = require('../model/NotificationModel');

const PENALTY_RATE = parseFloat(process.env.PENALTY_RATE_PER_DAY) || 50;

const parseMaybeJson = (value, fallback = {}) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const toDateOnly = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
};

const normalizeDuration = (value) => {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 3;
  return Math.max(1, Math.min(30, parsed));
};

const normalizeRate = (value) => {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) return PENALTY_RATE;
  return Math.max(0, parsed);
};

const addRentalDays = (startDate, duration) => {
  const start = toDateOnly(startDate);
  if (!start) return null;
  const d = new Date(`${start}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + normalizeDuration(duration) - 1);
  return d.toISOString().split('T')[0];
};

const dateDiffDays = (fromDate, toDate) => {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
};

const collectRentalTermRows = (rental) => {
  const pricingFactors = parseMaybeJson(rental?.pricing_factors, {});
  const specificData = parseMaybeJson(rental?.specific_data, {});

  const fallbackStart = toDateOnly(rental?.rental_start_date || specificData?.rental_start_date);
  const fallbackDuration = normalizeDuration(rental?.rental_duration ?? pricingFactors?.rental_duration ?? pricingFactors?.duration ?? 3);
  const fallbackRate = normalizeRate(rental?.overdue_rate ?? pricingFactors?.overdue_rate ?? PENALTY_RATE);
  const fallbackDue =
    toDateOnly(rental?.due_date)
    || toDateOnly(pricingFactors?.due_date)
    || toDateOnly(rental?.rental_end_date)
    || addRentalDays(fallbackStart, fallbackDuration);

  const rows = [];

  const appendRows = (selectedSizes, startDate, fallbackLabel = 'Rental') => {
    if (!Array.isArray(selectedSizes)) return;
    selectedSizes.forEach((entry = {}) => {
      const qty = Math.max(1, parseInt(entry.quantity, 10) || 1);
      const duration = normalizeDuration(entry.rental_duration ?? entry.duration ?? fallbackDuration);
      const overdueRate = normalizeRate(entry.overdue_amount ?? entry.overdue_rate ?? fallbackRate);
      const dueDate =
        toDateOnly(entry.due_date)
        || addRentalDays(startDate || fallbackStart, duration)
        || fallbackDue;

      rows.push({
        label: entry.label || entry.sizeKey || entry.size_key || fallbackLabel,
        quantity: qty,
        duration,
        overdueRate,
        dueDate
      });
    });
  };

  if (specificData?.is_bundle && Array.isArray(specificData.bundle_items)) {
    specificData.bundle_items.forEach((bundleItem = {}) => {
      appendRows(
        bundleItem.selected_sizes || bundleItem.selectedSizes || [],
        bundleItem.rental_start_date || fallbackStart,
        bundleItem.item_name || 'Bundle Item'
      );
    });
  } else {
    appendRows(specificData?.selected_sizes || specificData?.selectedSizes || [], fallbackStart, specificData?.item_name || 'Rental');
  }

  if (rows.length === 0 && fallbackDue) {
    rows.push({
      label: 'Rental',
      quantity: 1,
      duration: fallbackDuration,
      overdueRate: fallbackRate,
      dueDate: fallbackDue
    });
  }

  return rows;
};

const calculateRentalPenaltySnapshot = (rental, asOfDate = new Date()) => {
  const asOf = asOfDate.toISOString().split('T')[0];
  const terms = collectRentalTermRows(rental);

  let penaltyAmount = 0;
  let maxDaysOverdue = 0;
  let maxRate = PENALTY_RATE;
  const dueDates = [];

  terms.forEach((row) => {
    const dueDate = toDateOnly(row.dueDate);
    if (!dueDate) return;
    dueDates.push(dueDate);
    const daysOverdue = Math.max(0, dateDiffDays(dueDate, asOf));
    penaltyAmount += daysOverdue * row.overdueRate * row.quantity;
    if (daysOverdue > maxDaysOverdue) maxDaysOverdue = daysOverdue;
    if (row.overdueRate > maxRate) maxRate = row.overdueRate;
  });

  const earliestDueDate = dueDates.length > 0
    ? dueDates.reduce((earliest, current) => (current < earliest ? current : earliest), dueDates[0])
    : null;
  const latestDueDate = dueDates.length > 0
    ? dueDates.reduce((latest, current) => (current > latest ? current : latest), dueDates[0])
    : null;

  return {
    penaltyAmount: Math.max(0, parseFloat(penaltyAmount.toFixed(2))),
    daysOverdue: maxDaysOverdue,
    earliestDueDate,
    latestDueDate,
    effectiveRate: maxRate,
    terms
  };
};

async function checkUpcomingRentalEnds() {
  console.log('[RENTAL MONITOR] Checking for upcoming rental end dates...');
  
  const sql = `
    SELECT 
      oi.item_id,
      oi.order_id,
      oi.rental_start_date,
      oi.rental_end_date,
      oi.due_date,
      oi.overdue_rate,
      oi.pricing_factors,
      oi.specific_data,
      oi.approval_status,
      o.user_id,
      u.email,
      u.first_name,
      u.last_name,
      JSON_UNQUOTE(JSON_EXTRACT(oi.specific_data, '$.item_name')) as item_name
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.order_id
    JOIN user u ON o.user_id = u.user_id
    WHERE oi.service_type = 'rental'
      AND oi.approval_status IN ('rented', 'picked_up')
      AND (oi.rental_end_date IS NOT NULL OR oi.due_date IS NOT NULL)
  `;

  return new Promise((resolve, reject) => {
    db.query(sql, async (err, results) => {
      if (err) {
        console.error('[RENTAL MONITOR] Error fetching upcoming rentals:', err);
        reject(err);
        return;
      }

      if (results.length === 0) {
        console.log('[RENTAL MONITOR] No rentals ending soon');
        resolve({ remindersCount: 0 });
        return;
      }

      const todayKey = new Date().toISOString().split('T')[0];
      const upcomingRentals = (results || []).map((rental) => {
        const snapshot = calculateRentalPenaltySnapshot(rental, new Date(`${todayKey}T00:00:00`));
        const dueDate = snapshot.earliestDueDate || snapshot.latestDueDate || toDateOnly(rental.due_date) || toDateOnly(rental.rental_end_date);
        const daysRemaining = dueDate ? dateDiffDays(todayKey, dueDate) : null;
        return {
          ...rental,
          due_date: dueDate,
          days_remaining: daysRemaining,
          effective_overdue_rate: snapshot.effectiveRate
        };
      }).filter((rental) => Number.isFinite(rental.days_remaining) && rental.days_remaining >= 0 && rental.days_remaining <= 3);

      if (upcomingRentals.length === 0) {
        console.log('[RENTAL MONITOR] No rentals ending in the next 3 days');
        resolve({ remindersCount: 0 });
        return;
      }

      console.log(`[RENTAL MONITOR] Found ${upcomingRentals.length} rentals ending soon`);
      let remindersSent = 0;

      for (const rental of upcomingRentals) {
        try {
          
          const alreadySent = await hasReminderBeenSent(rental.item_id, 'reminder', rental.days_remaining);
          
          if (!alreadySent) {
            const userName = `${rental.first_name} ${rental.last_name}`;

            const emailSent = await emailService.sendRentalEndReminderEmail({
              userEmail: rental.email,
              userName: userName,
              itemName: rental.item_name || 'Rental Item',
              rentalEndDate: rental.due_date || rental.rental_end_date,
              daysRemaining: rental.days_remaining,
              itemId: rental.item_id
            });

            if (emailSent) {
              
              await logEmailSent(rental.item_id, rental.user_id, 'reminder', rental.email, 
                `Rental ending in ${rental.days_remaining} day(s)`);

              await markReminderSent(rental.item_id, rental.user_id, 
                rental.days_remaining === 0 ? 'same_day' : `${rental.days_remaining}_day`);

              const title = rental.days_remaining === 0 
                ? '⏰ Your rental ends today!' 
                : `⏰ Rental ending in ${rental.days_remaining} day${rental.days_remaining > 1 ? 's' : ''}`;
              const message = `Your rental of "${rental.item_name || 'Rental Item'}" is ending soon. Please return the item by the due date to avoid late penalties (up to ₱${rental.effective_overdue_rate || PENALTY_RATE}/day).`;
              
              Notification.create(rental.user_id, rental.item_id, 'rental_reminder', title, message, (notifErr) => {
                if (notifErr) {
                  console.error('[RENTAL MONITOR] Failed to create notification:', notifErr);
                }
              });

              remindersSent++;
              console.log(`[RENTAL MONITOR] Reminder sent for item ${rental.item_id} to ${rental.email}`);
            }
          } else {
            console.log(`[RENTAL MONITOR] Reminder already sent for item ${rental.item_id} (${rental.days_remaining} days remaining)`);
          }
        } catch (error) {
          console.error(`[RENTAL MONITOR] Error processing rental ${rental.item_id}:`, error);
        }
      }

      console.log(`[RENTAL MONITOR] Sent ${remindersSent} rental end reminders`);
      resolve({ remindersCount: remindersSent });
    });
  });
}

async function checkOverdueRentals() {
  console.log('[RENTAL MONITOR] Checking for overdue rentals...');
  
  const sql = `
    SELECT 
      oi.item_id,
      oi.order_id,
      oi.rental_start_date,
      oi.rental_end_date,
      oi.due_date,
      oi.overdue_rate,
      oi.final_price,
      oi.pricing_factors,
      oi.specific_data,
      oi.approval_status,
      o.user_id,
      u.email,
      u.first_name,
      u.last_name,
      JSON_UNQUOTE(JSON_EXTRACT(oi.specific_data, '$.item_name')) as item_name
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.order_id
    JOIN user u ON o.user_id = u.user_id
    WHERE oi.service_type = 'rental'
      AND oi.approval_status IN ('rented', 'picked_up')
      AND (oi.rental_end_date IS NOT NULL OR oi.due_date IS NOT NULL)
  `;

  return new Promise((resolve, reject) => {
    db.query(sql, async (err, results) => {
      if (err) {
        console.error('[RENTAL MONITOR] Error fetching overdue rentals:', err);
        reject(err);
        return;
      }

      if (results.length === 0) {
        console.log('[RENTAL MONITOR] No overdue rentals found');
        resolve({ overdueCount: 0, notificationsSent: 0 });
        return;
      }

      const overdueRentals = (results || []).map((rental) => {
        const snapshot = calculateRentalPenaltySnapshot(rental, new Date());
        return {
          ...rental,
          days_overdue: snapshot.daysOverdue,
          current_penalty: snapshot.penaltyAmount,
          effective_due_date: snapshot.earliestDueDate || snapshot.latestDueDate || toDateOnly(rental.due_date) || toDateOnly(rental.rental_end_date),
          effective_overdue_rate: snapshot.effectiveRate
        };
      }).filter((rental) => rental.days_overdue > 0);

      if (overdueRentals.length === 0) {
        console.log('[RENTAL MONITOR] No overdue rentals found');
        resolve({ overdueCount: 0, notificationsSent: 0 });
        return;
      }

      console.log(`[RENTAL MONITOR] Found ${overdueRentals.length} overdue rentals`);
      let notificationsSent = 0;

      for (const rental of overdueRentals) {
        try {
          const currentPenalty = rental.current_penalty;
          const userName = `${rental.first_name} ${rental.last_name}`;

          let reminderType = 'daily_overdue';
          if (rental.days_overdue === 1) reminderType = 'overdue_1';
          else if (rental.days_overdue === 3) reminderType = 'overdue_3';
          else if (rental.days_overdue === 7) reminderType = 'overdue_7';

          const alreadySent = await hasReminderBeenSent(rental.item_id, reminderType, 0);

          const shouldSendEmail = !alreadySent && (
            rental.days_overdue === 1 || 
            rental.days_overdue === 3 || 
            rental.days_overdue === 7 ||
            rental.days_overdue % 3 === 0 
          );

          if (shouldSendEmail) {
            
            const emailSent = await emailService.sendOverdueNotificationEmail({
              userEmail: rental.email,
              userName: userName,
              itemName: rental.item_name || 'Rental Item',
              rentalEndDate: rental.effective_due_date || rental.rental_end_date,
              daysOverdue: rental.days_overdue,
              currentPenalty: currentPenalty,
              itemId: rental.item_id
            });

            if (emailSent) {
              
              await logEmailSent(rental.item_id, rental.user_id, 'overdue', rental.email,
                `Overdue: ${rental.days_overdue} days, Penalty: ₱${currentPenalty}`);

              await markReminderSent(rental.item_id, rental.user_id, reminderType);
              
              notificationsSent++;
              console.log(`[RENTAL MONITOR] Overdue notification sent for item ${rental.item_id} (${rental.days_overdue} days overdue)`);
            }
          }

          const title = `🚨 Rental ${rental.days_overdue} Day${rental.days_overdue > 1 ? 's' : ''} Overdue!`;
          const message = `Your rental of "${rental.item_name || 'Rental Item'}" is ${rental.days_overdue} day(s) overdue. Current penalty: ₱${currentPenalty}. Late charges are based on your selected size terms (up to ₱${rental.effective_overdue_rate || PENALTY_RATE}/day). Please return immediately to avoid additional charges.`;
          
          Notification.create(rental.user_id, rental.item_id, 'overdue_warning', title, message, (notifErr) => {
            if (notifErr) {
              console.error('[RENTAL MONITOR] Failed to create overdue notification:', notifErr);
            }
          });

          await trackPenalty(
            rental.item_id,
            rental.user_id,
            rental.effective_due_date || rental.rental_end_date,
            rental.days_overdue,
            currentPenalty,
            rental.effective_overdue_rate || PENALTY_RATE
          );

        } catch (error) {
          console.error(`[RENTAL MONITOR] Error processing overdue rental ${rental.item_id}:`, error);
        }
      }

      console.log(`[RENTAL MONITOR] Sent ${notificationsSent} overdue notifications`);
      resolve({ overdueCount: overdueRentals.length, notificationsSent });
    });
  });
}

function getActiveRentalsWithPenalty(callback) {
  const sql = `
    SELECT 
      oi.item_id,
      oi.order_id,
      oi.rental_start_date,
      oi.rental_end_date,
      oi.due_date,
      oi.overdue_rate,
      oi.final_price,
      oi.pricing_factors,
      oi.specific_data,
      oi.approval_status,
      oi.payment_status,
      o.user_id,
      u.email,
      u.first_name,
      u.last_name,
      CONCAT(u.first_name, ' ', u.last_name) as full_name,
      JSON_UNQUOTE(JSON_EXTRACT(oi.specific_data, '$.item_name')) as item_name
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.order_id
    JOIN user u ON o.user_id = u.user_id
    WHERE oi.service_type = 'rental'
      AND oi.approval_status IN ('rented', 'picked_up', 'accepted', 'ready_to_pickup')
    ORDER BY oi.rental_end_date ASC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      callback(err);
      return;
    }

    const todayKey = new Date().toISOString().split('T')[0];
    const enriched = (rows || []).map((row) => {
      const snapshot = calculateRentalPenaltySnapshot(row, new Date(`${todayKey}T00:00:00`));
      const dueDate = snapshot.earliestDueDate || snapshot.latestDueDate || toDateOnly(row.due_date) || toDateOnly(row.rental_end_date);
      const daysUntilDue = dueDate ? dateDiffDays(todayKey, dueDate) : null;

      let rentalStatus = 'active';
      if (!dueDate) {
        rentalStatus = 'no_end_date';
      } else if (snapshot.daysOverdue > 0) {
        rentalStatus = 'overdue';
      } else if (daysUntilDue === 0) {
        rentalStatus = 'due_today';
      } else if (Number.isFinite(daysUntilDue) && daysUntilDue > 0 && daysUntilDue <= 3) {
        rentalStatus = 'due_soon';
      }

      return {
        ...row,
        due_date: dueDate,
        days_overdue: snapshot.daysOverdue,
        calculated_penalty: snapshot.penaltyAmount,
        penalty_rate: snapshot.effectiveRate,
        rental_status: rentalStatus
      };
    });

    callback(null, enriched);
  });
}

function calculatePenalty(itemId, callback) {
  const sql = `
    SELECT 
      oi.item_id,
      oi.rental_start_date,
      oi.rental_end_date,
      oi.due_date,
      oi.overdue_rate,
      oi.final_price,
      oi.approval_status,
      oi.pricing_factors,
      oi.specific_data
    FROM order_items oi
    WHERE oi.item_id = ? AND oi.service_type = 'rental'
  `;

  db.query(sql, [itemId], (err, results) => {
    if (err) {
      callback(err, null);
      return;
    }

    if (results.length === 0) {
      callback(null, { daysOverdue: 0, penaltyAmount: 0 });
      return;
    }

    const snapshot = calculateRentalPenaltySnapshot(results[0], new Date());
    const dueDate = snapshot.earliestDueDate || snapshot.latestDueDate || toDateOnly(results[0].due_date) || toDateOnly(results[0].rental_end_date);

    callback(null, {
      daysOverdue: snapshot.daysOverdue,
      penaltyAmount: snapshot.penaltyAmount,
      rentalEndDate: dueDate,
      finalPrice: results[0].final_price
    });
  });
}

function hasReminderBeenSent(itemId, type, daysRemaining) {
  return new Promise((resolve) => {
    const reminderType = type === 'reminder' 
      ? (daysRemaining === 0 ? 'same_day' : `${daysRemaining}_day`)
      : type;
    
    const sql = `
      SELECT * FROM rental_reminders_sent 
      WHERE order_item_id = ? AND reminder_type = ? AND reminder_date = CURDATE()
    `;
    
    db.query(sql, [itemId, reminderType], (err, results) => {
      if (err) {
        console.error('[RENTAL MONITOR] Error checking reminder status:', err);
        resolve(false); 
        return;
      }
      resolve(results.length > 0);
    });
  });
}

function markReminderSent(itemId, userId, reminderType) {
  return new Promise((resolve) => {
    const sql = `
      INSERT IGNORE INTO rental_reminders_sent (order_item_id, user_id, reminder_type, reminder_date)
      VALUES (?, ?, ?, CURDATE())
    `;
    
    db.query(sql, [itemId, userId, reminderType], (err) => {
      if (err) {
        console.error('[RENTAL MONITOR] Error marking reminder as sent:', err);
      }
      resolve();
    });
  });
}

function logEmailSent(itemId, userId, emailType, recipientEmail, subject) {
  return new Promise((resolve) => {
    const sql = `
      INSERT INTO rental_email_logs (order_item_id, user_id, email_type, email_status, recipient_email, subject, sent_at)
      VALUES (?, ?, ?, 'sent', ?, ?, NOW())
    `;
    
    db.query(sql, [itemId, userId, emailType, recipientEmail, subject], (err) => {
      if (err) {
        console.error('[RENTAL MONITOR] Error logging email:', err);
      }
      resolve();
    });
  });
}

function trackPenalty(itemId, userId, rentalEndDate, daysOverdue, penaltyAmount, penaltyRate = PENALTY_RATE) {
  return new Promise((resolve) => {
    const sql = `
      INSERT INTO rental_penalty_tracking 
        (order_item_id, user_id, rental_end_date, check_date, days_overdue, penalty_amount, penalty_rate)
      VALUES (?, ?, ?, CURDATE(), ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        days_overdue = VALUES(days_overdue),
        penalty_amount = VALUES(penalty_amount)
    `;
    
    db.query(sql, [itemId, userId, rentalEndDate, daysOverdue, penaltyAmount, penaltyRate], (err) => {
      if (err) {
        console.error('[RENTAL MONITOR] Error tracking penalty:', err);
      }
      resolve();
    });
  });
}

async function runAllChecks() {
  console.log('[RENTAL MONITOR] ========== Starting rental monitoring checks ==========');
  const startTime = Date.now();

  try {
    const reminderResults = await checkUpcomingRentalEnds();
    const overdueResults = await checkOverdueRentals();

    const duration = Date.now() - startTime;
    console.log(`[RENTAL MONITOR] ========== Completed in ${duration}ms ==========`);
    console.log(`[RENTAL MONITOR] Summary: ${reminderResults.remindersCount} reminders, ${overdueResults.notificationsSent} overdue notifications`);

    return {
      success: true,
      remindersSent: reminderResults.remindersCount,
      overdueNotifications: overdueResults.notificationsSent,
      overdueCount: overdueResults.overdueCount,
      duration
    };
  } catch (error) {
    console.error('[RENTAL MONITOR] Error during checks:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  checkUpcomingRentalEnds,
  checkOverdueRentals,
  getActiveRentalsWithPenalty,
  calculatePenalty,
  runAllChecks,
  PENALTY_RATE
};
