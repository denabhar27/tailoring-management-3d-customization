require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const db = require('./config/db');

const app = express();

const uploadDirs = [
  'uploads',
  'uploads/customization-references',
  'uploads/profile-pictures'
];
uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const allowedOrigins = [
  'http://localhost:5173', 
  'http://localhost:5174',
  'http://localhost:5175', 
  'http://localhost:3000',
  'http://localhost:8081',
  'http://localhost:8082', 
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:8082',
  'http://localhost:19006',
  'http://127.0.0.1:19006', 
  'exp://192.168.1.100:19000', 
  'exp://192.168.254.103:8082',
  'http://192.168.1.38:5173',
  'http://192.168.1.38:5174',
  'http://192.168.1.38:5175',
  'http://192.168.254.102:5173',
  'http://192.168.254.102:5174',
  'http://192.168.254.102:5175',
  'http://192.168.254.102:3000',
  'http://192.168.254.102:8081',
  'http://192.168.254.102:8082',
  'http://192.168.1.202:5173',
  'http://192.168.1.202:5174',
  'http://192.168.1.202:5175',
  'http://192.168.1.202:3000',
  'http://192.168.1.202:8081',
  'http://192.168.1.202:8082',
  // Production domains (Vercel)
  'https://tailoring-management-3d-customizati-zeta.vercel.app',
  'https://tailoring-management-3d-customi-git-bd8c13-denabhar27s-projects.vercel.app',
  'https://tailoring-management-3d-customization-rped-g9iqc602q.vercel.app',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      if (origin.includes('localhost') || 
          origin.includes('127.0.0.1') || 
          origin.includes('192.168.') ||
          origin.includes('10.0.') ||
          origin.includes('172.16.') ||
          origin.includes('.vercel.app') ||
          origin.includes('.onrender.com')) {
        callback(null, true);
      } else {
        console.log('CORS blocked origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static('uploads', {
  maxAge: '1d',
  setHeaders: (res, path) => {
    if (path.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (path.endsWith('.webp')) {
      res.setHeader('Content-Type', 'image/webp');
    }
  }
}));

const authRoutes = require('./routes/AuthRoutes');
const rentalRoutes = require('./routes/RentalRoutes');
const userRoutes = require('./routes/UserRoutes');
const cartRoutes = require('./routes/CartRoutes');
const orderRoutes = require('./routes/OrderRoutes');
const repairRoutes = require('./routes/RepairRoutes');
const orderTrackingRoutes = require('./routes/OrderTrackingRoutes');
const dryCleaningRoutes = require('./routes/DryCleaningRoutes');
const customizationRoutes = require('./routes/CustomizationRoutes');
const billingRoutes = require('./routes/BillingRoutes');
const inventoryRoutes = require('./routes/InventoryRoutes');
const adminDashboardRoutes = require('./routes/AdminDashboardRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const customerRoutes = require('./routes/CustomerRoutes');
const appointmentSlotRoutes = require('./routes/AppointmentSlotRoutes');
const transactionLogRoutes = require('./routes/TransactionLogRoutes');
const fabricTypeRoutes = require('./routes/FabricTypeRoutes');
const garmentTypeRoutes = require('./routes/GarmentTypeRoutes');
const clerkRoutes = require('./routes/ClerkRoutes');

app.use('/api', authRoutes);
app.use('/api/rentals', rentalRoutes);
app.use('/api/user', userRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/repair', repairRoutes);
app.use('/api/dry-cleaning', dryCleaningRoutes);
app.use('/api/customization', customizationRoutes);
app.use('/api/tracking', orderTrackingRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/admin', adminDashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/appointments', appointmentSlotRoutes);
app.use('/api/transaction-logs', transactionLogRoutes);
app.use('/api/fabric-types', fabricTypeRoutes);
app.use('/api/garment-types', garmentTypeRoutes);
app.use('/api/admin/clerks', clerkRoutes);
const repairGarmentTypeRoutes = require('./routes/RepairGarmentTypeRoutes');
app.use('/api/repair-garment-types', repairGarmentTypeRoutes);
try {
  const { initializeRepairDamageLevelSystem } = require('./controller/RepairGarmentTypeController');
  initializeRepairDamageLevelSystem();
} catch (err) {
  console.error('[SERVER] Failed to initialize repair damage level system:', err.message);
}
const dcGarmentTypeRoutes = require('./routes/DryCleaningGarmentTypeRoutes');
app.use('/api/dc-garment-types', dcGarmentTypeRoutes);
const shopScheduleRoutes = require('./routes/ShopScheduleRoutes');
app.use('/api/shop-schedule', shopScheduleRoutes);
const patternRoutes = require('./routes/PatternRoutes');
app.use('/api/patterns', patternRoutes);
const walkInOrderRoutes = require('./routes/WalkInOrderRoutes');
app.use('/api/walk-in-orders', walkInOrderRoutes);
const damageRecordRoutes = require('./routes/DamageRecordRoutes');
app.use('/api/damage-records', damageRecordRoutes);
const faqRoutes = require('./routes/FAQRoutes');
app.use('/api/faqs', faqRoutes);
const analyticsRoutes = require('./routes/AnalyticsRoutes');
app.use('/api/analytics', analyticsRoutes);
const passwordResetRoutes = require('./routes/PasswordResetRoutes');
app.use('/api', passwordResetRoutes);

try {
  const appointmentSlotController = require('./controller/AppointmentSlotController');
  const db = require('./config/db');
  
  const createTimeSlotsSQL = `
    CREATE TABLE IF NOT EXISTS time_slots (
      slot_id INT AUTO_INCREMENT PRIMARY KEY,
      time_slot TIME NOT NULL UNIQUE COMMENT 'Time in HH:MM:SS format (e.g., 10:30:00)',
      capacity INT NOT NULL DEFAULT 5 COMMENT 'Maximum number of appointments allowed at this time',
      is_active TINYINT(1) DEFAULT 1 COMMENT 'Whether this time slot is active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_time_slot (time_slot),
      INDEX idx_is_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;
  
  db.query(createTimeSlotsSQL, (err) => {
    if (err) {
      console.error('[SERVER] Error creating time_slots table:', err.message);
    } else {
      console.log('[SERVER] ✅ time_slots table ready');
      
      const insertDefaultSlotsSQL = `
        INSERT IGNORE INTO time_slots (time_slot, capacity, is_active) VALUES
        ('08:00:00', 5, 1), ('08:30:00', 5, 1), ('09:00:00', 5, 1), ('09:30:00', 5, 1),
        ('10:00:00', 5, 1), ('10:30:00', 5, 1), ('11:00:00', 5, 1), ('11:30:00', 5, 1),
        ('12:00:00', 5, 1), ('12:30:00', 5, 1), ('13:00:00', 5, 1), ('13:30:00', 5, 1),
        ('14:00:00', 5, 1), ('14:30:00', 5, 1), ('15:00:00', 5, 1), ('15:30:00', 5, 1),
        ('16:00:00', 5, 1), ('16:30:00', 5, 1), ('17:00:00', 5, 1)
      `;
      
      db.query(insertDefaultSlotsSQL, (err) => {
        if (err) {
          console.error('[SERVER] Error inserting default time slots:', err.message);
        } else {
          console.log('[SERVER] ✅ Default time slots initialized');
        }
      });
    }
    
    const createAppointmentSlotsSQL = `
      CREATE TABLE IF NOT EXISTS appointment_slots (
        slot_id INT AUTO_INCREMENT PRIMARY KEY,
        service_type ENUM('dry_cleaning', 'repair', 'customization') NOT NULL,
        appointment_date DATE NOT NULL,
        appointment_time TIME NOT NULL,
        user_id INT NOT NULL,
        order_item_id INT NULL COMMENT 'Reference to the order item when order is created',
        cart_item_id INT NULL COMMENT 'Reference to cart item if still in cart',
        status ENUM('booked', 'completed', 'cancelled') DEFAULT 'booked',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_service_date (service_type, appointment_date),
        INDEX idx_user_id (user_id),
        INDEX idx_status (status),
        INDEX idx_appointment_datetime (appointment_date, appointment_time),
        INDEX idx_service_date_time (service_type, appointment_date, appointment_time, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    db.query(createAppointmentSlotsSQL, (err) => {
      if (err) {
        console.error('[SERVER] Error creating appointment_slots table:', err.message);
      } else {
        console.log('[SERVER] ✅ appointment_slots table ready');
        
        db.query(`ALTER TABLE appointment_slots DROP INDEX unique_slot`, (err) => {
          if (err && err.code !== 'ER_CANT_DROP_FIELD_OR_KEY') {
            console.warn('[SERVER] Warning: Could not drop unique_slot index:', err.message);
          } else if (!err) {
            console.log('[SERVER] ✅ Removed unique constraint from appointment_slots');
          }
        });
      }
    });

    const createShopScheduleSQL = `
      CREATE TABLE IF NOT EXISTS shop_schedule (
        schedule_id INT AUTO_INCREMENT PRIMARY KEY,
        day_of_week TINYINT NOT NULL UNIQUE COMMENT '0 = Sunday, 1 = Monday, ..., 6 = Saturday',
        is_open TINYINT(1) DEFAULT 1 COMMENT '1 = Open, 0 = Closed',
        available_times TEXT NULL COMMENT 'JSON array of available time slots for this day',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_day_of_week (day_of_week),
        INDEX idx_is_open (is_open)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    db.query(createShopScheduleSQL, (err) => {
      if (err) {
        console.error('[SERVER] Error creating shop_schedule table:', err.message);
      } else {
        console.log('[SERVER] ✅ shop_schedule table ready');

        // Migration: add available_times column if missing (for existing databases)
        const addColumnSQL = `ALTER TABLE shop_schedule ADD COLUMN available_times TEXT NULL COMMENT 'JSON array of available time slots for this day'`;
        db.query(addColumnSQL, (alterErr) => {
          if (alterErr && !alterErr.message.includes('Duplicate column')) {
            console.warn('[SERVER] Note on available_times column:', alterErr.message);
          } else if (!alterErr) {
            console.log('[SERVER] ✅ Added available_times column to shop_schedule');
          }
        });
        
        const checkDataSQL = `SELECT COUNT(*) as count FROM shop_schedule`;
        db.query(checkDataSQL, (err, results) => {
          if (err) {
            console.error('[SERVER] Error checking shop_schedule data:', err.message);
          } else if (results[0].count === 0) {
            const insertDefaultSQL = `
              INSERT INTO shop_schedule (day_of_week, is_open) VALUES
              (0, 0), (1, 1), (2, 1), (3, 1), (4, 1), (5, 1), (6, 1)
            `;
            
            db.query(insertDefaultSQL, (err) => {
              if (err) {
                console.error('[SERVER] Error inserting default schedule:', err.message);
              } else {
                console.log('[SERVER] ✅ Default shop schedule initialized');
              }
            });
          }
        });
      }
    });
  });
} catch (err) {
  console.error('[SERVER] Error initializing time slots tables:', err.message);
}

try {
  const dateReminderService = require('./services/dateReminderService');
  dateReminderService.checkDateReminders();
  setInterval(() => {
    dateReminderService.checkDateReminders();
  }, 24 * 60 * 60 * 1000); 
  console.log('[SERVER] Date reminder service initialized');
} catch (err) {
  console.error('[SERVER] Error initializing date reminder service:', err.message);
}

try {
  const cronScheduler = require('./services/cronScheduler');
  
  const createRentalEmailLogsSQL = `
    CREATE TABLE IF NOT EXISTS rental_email_logs (
      log_id INT AUTO_INCREMENT PRIMARY KEY,
      order_item_id INT NOT NULL,
      user_id INT NOT NULL,
      email_type ENUM('reminder', 'overdue', 'penalty_applied', 'status_update') NOT NULL,
      email_status ENUM('sent', 'failed', 'pending') DEFAULT 'pending',
      recipient_email VARCHAR(255) NOT NULL,
      subject VARCHAR(500),
      sent_at DATETIME,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_order_item_id (order_item_id),
      INDEX idx_user_id (user_id),
      INDEX idx_email_type (email_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;
  
  const createRentalRemindersSentSQL = `
    CREATE TABLE IF NOT EXISTS rental_reminders_sent (
      reminder_id INT AUTO_INCREMENT PRIMARY KEY,
      order_item_id INT NOT NULL,
      user_id INT NOT NULL,
      reminder_type ENUM('1_day', '2_day', '3_day', 'same_day', 'overdue_1', 'overdue_3', 'overdue_7', 'daily_overdue') NOT NULL,
      reminder_date DATE NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_order_item_id (order_item_id),
      INDEX idx_reminder_date (reminder_date),
      UNIQUE KEY unique_reminder (order_item_id, reminder_type, reminder_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;
  
  const createRentalPenaltyTrackingSQL = `
    CREATE TABLE IF NOT EXISTS rental_penalty_tracking (
      tracking_id INT AUTO_INCREMENT PRIMARY KEY,
      order_item_id INT NOT NULL,
      user_id INT NOT NULL,
      rental_end_date DATE NOT NULL,
      check_date DATE NOT NULL,
      days_overdue INT DEFAULT 0,
      penalty_amount DECIMAL(10,2) DEFAULT 0.00,
      penalty_rate DECIMAL(10,2) DEFAULT 100.00,
      is_notified TINYINT(1) DEFAULT 0,
      notification_sent_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_order_item_id (order_item_id),
      INDEX idx_check_date (check_date),
      UNIQUE KEY unique_daily_check (order_item_id, check_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;
  
  db.query(createRentalEmailLogsSQL, (err) => {
    if (err) {
      console.error('[SERVER] Error creating rental_email_logs table:', err.message);
    } else {
      console.log('[SERVER] ✅ rental_email_logs table ready');
    }
  });
  
  db.query(createRentalRemindersSentSQL, (err) => {
    if (err) {
      console.error('[SERVER] Error creating rental_reminders_sent table:', err.message);
    } else {
      console.log('[SERVER] ✅ rental_reminders_sent table ready');
    }
  });
  
  db.query(createRentalPenaltyTrackingSQL, (err) => {
    if (err) {
      console.error('[SERVER] Error creating rental_penalty_tracking table:', err.message);
    } else {
      console.log('[SERVER] ✅ rental_penalty_tracking table ready');
    }
  });

  cronScheduler.initializeScheduler();
  console.log('[SERVER] ✅ Rental monitoring service initialized with SendGrid email notifications');
} catch (err) {
  console.error('[SERVER] Error initializing rental monitoring service:', err.message);
}

// Auto-migrate action_logs.action_by column to support longer usernames
try {
  const alterActionByColumnSQL = `
    ALTER TABLE action_logs
    MODIFY COLUMN action_by VARCHAR(50) NULL
  `;
  db.query(alterActionByColumnSQL, (err) => {
    if (err) {
      if (!err.message.includes("doesn't exist") && !err.message.includes('Unknown table')) {
        console.log('[SERVER] action_logs.action_by migration note:', err.message);
      }
    } else {
      console.log('[SERVER] ✅ action_logs.action_by column size increased to VARCHAR(50)');
    }
  });
} catch (err) {
  console.error('[SERVER] Error updating action_logs.action_by column:', err.message);
}

// Auto-migrate payment_status ENUM to include all required values
try {
  const alterPaymentStatusSQL = `
    ALTER TABLE order_items 
    MODIFY COLUMN payment_status ENUM('unpaid', 'paid', 'cancelled', 'fully_paid', 'down-payment', 'partial_payment', 'pending', 'partial') DEFAULT 'unpaid'
  `;
  db.query(alterPaymentStatusSQL, (err) => {
    if (err) {
      // Ignore if column doesn't exist or already has correct type
      if (!err.message.includes("Unknown column") && !err.message.includes("doesn't exist")) {
        console.log('[SERVER] payment_status ENUM migration note:', err.message);
      }
    } else {
      console.log('[SERVER] ✅ payment_status ENUM updated successfully');
    }
  });
} catch (err) {
  console.error('[SERVER] Error updating payment_status ENUM:', err.message);
}

// Auto-migrate approval_status ENUM to include 'rented' and other rental statuses
try {
  const alterApprovalStatusSQL = `
    ALTER TABLE order_items 
    MODIFY COLUMN approval_status ENUM(
      'auto_confirmed',
      'pending_review', 
      'pending',
      'accepted',
      'price_confirmation', 
      'confirmed', 
      'cancelled', 
      'ready_for_pickup',
      'ready_to_pickup',
      'completed', 
      'price_declined',
      'rented',
      'picked_up',
      'returned'
    ) DEFAULT 'pending_review'
  `;
  db.query(alterApprovalStatusSQL, (err) => {
    if (err) {
      if (!err.message.includes("Unknown column") && !err.message.includes("doesn't exist")) {
        console.log('[SERVER] approval_status ENUM migration note:', err.message);
      }
    } else {
      console.log('[SERVER] ✅ approval_status ENUM updated successfully');
    }
  });
} catch (err) {
  console.error('[SERVER] Error updating approval_status ENUM:', err.message);
}

// Auto-migrate rental size column so admin size+measurement JSON is not truncated
try {
  const alterRentalSizeColumnSQL = `
    ALTER TABLE rental_inventory
    MODIFY COLUMN size LONGTEXT NULL
  `;
  db.query(alterRentalSizeColumnSQL, (err) => {
    if (err) {
      if (!err.message.includes("doesn't exist") && !err.message.includes('Unknown table')) {
        console.log('[SERVER] rental_inventory.size migration note:', err.message);
      }
    } else {
      console.log('[SERVER] ✅ rental_inventory.size migrated to LONGTEXT');
    }
  });
} catch (err) {
  console.error('[SERVER] Error updating rental_inventory.size column:', err.message);
}

// Run rental deposit migration
try {
  const { runDepositMigration } = require('./migrations/runDepositMigration');
  runDepositMigration()
    .then(() => {
      console.log('[SERVER] ✅ Rental deposit system migration completed');
    })
    .catch((err) => {
      console.error('[SERVER] Error running deposit migration:', err.message);
    });
} catch (err) {
  console.error('[SERVER] Error initializing deposit migration:', err.message);
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});