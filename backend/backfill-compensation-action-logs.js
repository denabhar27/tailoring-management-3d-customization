/**
 * Migration Script: Backfill Action Logs for Existing Damage Compensation Records
 * 
 * This script creates action log entries for existing damage compensation records
 * that don't have action logs yet. This ensures the dashboard shows the correct
 * "Changed by" information.
 * 
 * Run this once after deploying the damage compensation action logging fix.
 */

const db = require('./config/db');

function backfillCompensationActionLogs() {
  console.log('Starting damage compensation action logs backfill...');

  // Get all compensation records that don't have action logs
  const query = `
    SELECT 
      dcr.id,
      dcr.order_item_id,
      dcr.service_type,
      dcr.customer_name,
      dcr.reported_by_user_id,
      dcr.reported_by_role,
      dcr.responsible_party,
      dcr.damage_type,
      dcr.compensation_amount,
      dcr.liability_status,
      dcr.compensation_status,
      dcr.created_at,
      dcr.updated_at,
      CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS reporter_name,
      u.username AS reporter_username
    FROM damage_compensation_records dcr
    LEFT JOIN user u ON u.user_id = dcr.reported_by_user_id
    WHERE dcr.order_item_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM action_logs al 
        WHERE al.order_item_id = dcr.order_item_id 
        AND al.action_type IN ('damage_compensation', 'rental_damage_compensation')
      )
    ORDER BY dcr.created_at ASC
  `;

  db.query(query, (err, records) => {
    if (err) {
      console.error('Error fetching compensation records:', err);
      process.exit(1);
    }

    if (!records || records.length === 0) {
      console.log('No compensation records need backfilling.');
      process.exit(0);
    }

    console.log(`Found ${records.length} compensation records to backfill.`);

    let processed = 0;
    let errors = 0;

    records.forEach((record, index) => {
      const serviceType = (record.service_type || '').toLowerCase();
      const actionType = serviceType === 'rental' ? 'rental_damage_compensation' : 'damage_compensation';
      const reporterName = (record.reporter_name || '').trim() || record.reporter_username || 
                          (record.reported_by_role === 'clerk' ? 'Clerk' : 
                           record.reported_by_role === 'admin' ? 'Admin' : 'System');
      
      const actorRole = record.reported_by_role || 'admin';
      const status = record.liability_status || 'pending';
      const damagedBy = record.responsible_party ? `. Damaged by: ${record.responsible_party}` : '';
      
      const insertQuery = `
        INSERT INTO action_logs 
        (order_item_id, user_id, action_type, action_by, previous_status, new_status, reason, notes, created_at)
        VALUES (?, ?, ?, ?, NULL, ?, NULL, ?, ?)
      `;

      const notes = `Damage compensation reported by ${reporterName}. Customer: ${record.customer_name || 'Customer'}. Damage type: ${record.damage_type || 'damage'}. Amount: ₱${record.compensation_amount || 0}${damagedBy}`;

      db.query(
        insertQuery,
        [
          record.order_item_id,
          record.reported_by_user_id,
          actionType,
          actorRole,
          status,
          notes,
          record.created_at
        ],
        (insertErr) => {
          if (insertErr) {
            console.error(`Error creating action log for compensation ID ${record.id}:`, insertErr);
            errors++;
          } else {
            processed++;
            console.log(`[${processed}/${records.length}] Created action log for compensation ID ${record.id} (Order Item: ${record.order_item_id})`);
          }

          // Check if this is the last record
          if (index === records.length - 1) {
            setTimeout(() => {
              console.log('\n=== Backfill Complete ===');
              console.log(`Successfully processed: ${processed}`);
              console.log(`Errors: ${errors}`);
              console.log(`Total: ${records.length}`);
              process.exit(errors > 0 ? 1 : 0);
            }, 1000);
          }
        }
      );
    });
  });
}

// Run the migration
backfillCompensationActionLogs();
