const Customization = require('../model/CustomizationModel');
const Custom3DModel = require('../model/Custom3DModel');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/customization-images';
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'customization-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, 
  fileFilter: fileFilter
});

exports.uploadCustomizationImage = upload.single('customizationImage');

exports.handleImageUpload = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const imageUrl = `/uploads/customization-images/${req.file.filename}`;
    
    res.json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl: imageUrl,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading image'
    });
  }
};

exports.getAllCustomizationOrders = (req, res) => {
  Customization.getAllOrders((err, orders) => {
    if (err) {
      console.error('Get all customization orders error:', err);
      return res.status(500).json({
        success: false,
        message: 'Error fetching customization orders'
      });
    }
    
    res.json({
      success: true,
      orders: orders
    });
  });
};

exports.getUserCustomizationOrders = (req, res) => {
  const userId = req.user.id;
  
  Customization.getByUserId(userId, (err, orders) => {
    if (err) {
      console.error('Get user customization orders error:', err);
      return res.status(500).json({
        success: false,
        message: 'Error fetching customization orders'
      });
    }
    
    res.json({
      success: true,
      orders: orders
    });
  });
};

exports.getCustomizationOrderById = (req, res) => {
  const { itemId } = req.params;
  
  Customization.getOrderItemById(itemId, (err, order) => {
    if (err) {
      console.error('Get customization order error:', err);
      return res.status(500).json({
        success: false,
        message: 'Error fetching customization order'
      });
    }
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Customization order not found'
      });
    }
    
    res.json({
      success: true,
      order: order
    });
  });
};

exports.updateCustomizationOrderItem = (req, res) => {
  const { itemId } = req.params;
  const updateData = req.body;
  const userId = req.user.id;

  const Order = require('../model/OrderModel');
  Order.getOrderItemById(itemId, (getErr, item) => {
    if (getErr || !item) {
      return res.status(500).json({
        success: false,
        message: "Error fetching order item",
        error: getErr
      });
    }

    const previousStatus = item.approval_status || 'pending';
    const previousPrice = item.final_price || null;

    const db = require('../config/db');
    const checkOrderSql = `SELECT order_type FROM orders WHERE order_id = ?`;
    db.query(checkOrderSql, [item.order_id], (orderErr, orderResults) => {
      if (!orderErr && orderResults && orderResults.length > 0) {
        const isWalkIn = orderResults[0].order_type === 'walk_in';

        if (isWalkIn && updateData.finalPrice && !updateData.approvalStatus) {
          
          if (previousStatus === 'pending' || previousStatus === 'pending_review' || previousStatus === 'price_confirmation') {
            updateData.approvalStatus = 'accepted';
          }
        }

        if (isWalkIn && updateData.approvalStatus === 'price_confirmation') {
          updateData.approvalStatus = 'accepted';
        }
      }

      const hasIncomingFinalPrice = updateData.finalPrice !== undefined && updateData.finalPrice !== null && updateData.finalPrice !== '';
      if (hasIncomingFinalPrice) {
        const nextPrice = parseFloat(updateData.finalPrice);
        const prevPrice = parseFloat(previousPrice || 0);
        const isPriceChanged = !Number.isNaN(nextPrice) && Math.abs(nextPrice - prevPrice) > 0.01;
        const hasReason = String(updateData.adminNotes || '').trim().length > 0;

        if (isPriceChanged && !hasReason) {
          return res.status(400).json({
            success: false,
            message: 'A reason is required when changing the customization price'
          });
        }
      }
  
      Customization.updateOrderItem(itemId, updateData, (err, result) => {
      if (err) {
        console.error('Update customization order error:', err);
        return res.status(500).json({
          success: false,
          message: 'Error updating customization order'
        });
      }

      const ActionLog = require('../model/ActionLogModel');
      
      const adminUserId = userId || item.user_id || null;
      
      if (!adminUserId) {
        console.error('Cannot log action: user_id is missing. userId:', userId, 'item.user_id:', item.user_id);
      }

      const formatStatus = (status) => {
        const statusMap = {
          'pending_review': 'Pending Review',
          'pending': 'Pending',
          'accepted': 'Accepted',
          'price_confirmation': 'Price Confirmation',
          'confirmed': 'In Progress',
          'ready_for_pickup': 'Ready for Pickup',
          'completed': 'Completed',
          'cancelled': 'Cancelled'
        };
        return statusMap[status] || status;
      };
      
      let actionNotes = [];
      
      if (updateData.approvalStatus && updateData.approvalStatus !== previousStatus) {
        actionNotes.push(formatStatus(updateData.approvalStatus));
      }
      if (updateData.finalPrice && updateData.finalPrice !== previousPrice) {
        actionNotes.push(`Price: ₱${parseFloat(previousPrice || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} → ₱${parseFloat(updateData.finalPrice).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
      }
      if (updateData.adminNotes) {
        actionNotes.push(`Notes: ${updateData.adminNotes}`);
      }

      const newStatus = updateData.approvalStatus || previousStatus;

      if (adminUserId) {
        ActionLog.create({
          order_item_id: itemId,
          user_id: adminUserId,
          action_type: 'status_update',
          action_by: req.user?.role || 'admin',
          previous_status: previousStatus,
          new_status: newStatus,
          reason: null,
          notes: actionNotes.length > 0 
            ? `Customization: ${actionNotes.join(' | ')}`
            : `Customization: Updated`
        }, (logErr, logResult) => {
          if (logErr) {
            console.error('Error logging customization order action:', logErr);
            console.error('Log data:', {
              order_item_id: itemId,
              user_id: adminUserId,
              action_type: 'status_update',
              previous_status: previousStatus,
              new_status: newStatus
            });
          } else {
            console.log('Successfully logged customization order action:', logResult?.insertId);
          }
        });
      } else {
        console.error('Skipping action log: user_id is null or undefined');
      }

      if (updateData.approvalStatus && (updateData.approvalStatus === 'cancelled' || updateData.approvalStatus === 'rejected')) {
        console.log(`[CUSTOMIZATION] Cancelling appointment slot for order item ${itemId} with status: ${updateData.approvalStatus}`);
        const AppointmentSlot = require('../model/AppointmentSlotModel');
        AppointmentSlot.cancelSlotByOrderItem(itemId, (slotErr, cancelResult) => {
          if (slotErr) {
            console.error('[CUSTOMIZATION] Error cancelling appointment slot:', slotErr);
          } else {
            console.log(`[CUSTOMIZATION] Appointment slot cancellation result for item ${itemId}:`, cancelResult?.affectedRows || 0, 'slots cancelled');
          }
        });
      }

      const billingHelper = require('../utils/billingHelper');
      if (updateData.approvalStatus && updateData.approvalStatus !== previousStatus) {
        billingHelper.updateBillingStatus(itemId, 'customization', updateData.approvalStatus, previousStatus, (billingErr, billingResult) => {
          if (billingErr) {
            console.error('Error auto-updating billing status:', billingErr);
          } else if (billingResult) {
            console.log('Billing status auto-updated:', billingResult);
          }
        });
      }

      if (updateData.approvalStatus && updateData.approvalStatus !== previousStatus) {
        const Notification = require('../model/NotificationModel');
        const customerUserId = item.user_id; 
        
        if (customerUserId) {
          const serviceType = 'customize';

          if (updateData.approvalStatus === 'accepted') {
            Notification.createAcceptedNotification(customerUserId, itemId, serviceType, (notifErr) => {
              if (notifErr) {
                console.error('[NOTIFICATION] Failed to create accepted notification:', notifErr);
              } else {
                console.log('[NOTIFICATION] Accepted notification created successfully');
              }
            });

            try {
              const emailService = require('../services/emailService');
              const dbConn = require('../config/db');
              
              const getUserSql = `SELECT u.email, u.first_name, u.last_name FROM user u WHERE u.user_id = ?`;
              dbConn.query(getUserSql, [customerUserId], async (userErr, userResults) => {
                if (!userErr && userResults.length > 0) {
                  const user = userResults[0];
                  const specificData = item.specific_data ? 
                    (typeof item.specific_data === 'string' ? JSON.parse(item.specific_data) : item.specific_data) : {};
                  const itemName = specificData.garment_type || specificData.item_name || 'Customization Order';
                  
                  await emailService.sendServiceStatusEmail({
                    userEmail: user.email,
                    userName: `${user.first_name} ${user.last_name}`,
                    serviceName: itemName,
                    serviceType: serviceType,
                    status: 'accepted',
                    orderId: itemId,
                    appointmentDate: item.appointment_date || null
                  });
                  console.log(`[EMAIL] Service status email sent to ${user.email} for status: accepted`);
                }
              });
            } catch (emailErr) {
              console.error('[EMAIL] Error sending service status email:', emailErr);
            }
          }

          const statusNotificationStatuses = [
            'price_confirmation',
            'confirmed',
            'in_progress',
            'ready_for_pickup',
            'ready_to_pickup',
            'completed',
            'cancelled'
          ];
          
          if (statusNotificationStatuses.includes(updateData.approvalStatus)) {
            const statusForNotification = 
              updateData.approvalStatus === 'confirmed' ? 'in_progress' :
              updateData.approvalStatus === 'ready_for_pickup' ? 'ready_to_pickup' :
              updateData.approvalStatus === 'ready_to_pickup' ? 'ready_to_pickup' :
              updateData.approvalStatus;
            
            Notification.createStatusUpdateNotification(
              customerUserId,
              itemId,
              statusForNotification,
              null,
              serviceType,
              (notifErr) => {
                if (notifErr) {
                  console.error('[NOTIFICATION] Failed to create status update notification:', notifErr);
                } else {
                  console.log('[NOTIFICATION] Status update notification created successfully');
                }
              }
            );

            try {
              const emailService = require('../services/emailService');
              const dbConn = require('../config/db');
              
              const getUserSql = `SELECT u.email, u.first_name, u.last_name FROM user u WHERE u.user_id = ?`;
              dbConn.query(getUserSql, [customerUserId], async (userErr, userResults) => {
                if (!userErr && userResults.length > 0) {
                  const user = userResults[0];
                  const specificData = item.specific_data ? 
                    (typeof item.specific_data === 'string' ? JSON.parse(item.specific_data) : item.specific_data) : {};
                  const itemName = specificData.garment_type || specificData.item_name || 'Customization Order';
                  
                  await emailService.sendServiceStatusEmail({
                    userEmail: user.email,
                    userName: `${user.first_name} ${user.last_name}`,
                    serviceName: itemName,
                    serviceType: serviceType,
                    status: statusForNotification,
                    orderId: itemId,
                    message: updateData.adminNotes || null,
                    appointmentDate: item.appointment_date || null
                  });
                  console.log(`[EMAIL] Service status email sent to ${user.email} for status: ${statusForNotification}`);
                }
              });
            } catch (emailErr) {
              console.error('[EMAIL] Error sending service status email:', emailErr);
            }
          }
        } else {
          console.error('[NOTIFICATION] Cannot create notification: customer user_id is missing');
        }
      }
      
      res.json({
        success: true,
        message: 'Customization order updated successfully'
      });
      });
    });
  });
};

exports.updateApprovalStatus = (req, res) => {
  const { itemId } = req.params;
  const { status } = req.body;
  const userId = req.user.id;
  
  if (!status) {
    return res.status(400).json({
      success: false,
      message: 'Status is required'
    });
  }

  const Order = require('../model/OrderModel');
  Order.getOrderItemById(itemId, (getErr, item) => {
    if (getErr || !item) {
      return res.status(500).json({
        success: false,
        message: "Error fetching order item",
        error: getErr
      });
    }

    const previousStatus = item.approval_status || 'pending';
  
    Customization.updateApprovalStatus(itemId, status, (err, result) => {
      if (err) {
        console.error('Update approval status error:', err);
        return res.status(500).json({
          success: false,
          message: 'Error updating approval status'
        });
      }

      const ActionLog = require('../model/ActionLogModel');
      
      const adminUserId = userId || item.user_id || null;
      
      if (!adminUserId) {
        console.error('Cannot log action: user_id is missing. userId:', userId, 'item.user_id:', item.user_id);
      }

      if (adminUserId) {
        ActionLog.create({
          order_item_id: itemId,
          user_id: adminUserId,
          action_type: 'status_update',
          action_by: req.user?.role || 'admin',
          previous_status: previousStatus,
          new_status: status,
          reason: null,
          notes: `${req.user?.role === 'clerk' ? 'Clerk' : 'Admin'} updated customization approval status from ${previousStatus} to ${status}`
        }, (logErr, logResult) => {
          if (logErr) {
            console.error('Error logging customization approval status update:', logErr);
            console.error('Log data:', {
              order_item_id: itemId,
              user_id: adminUserId,
              action_type: 'status_update',
              previous_status: previousStatus,
              new_status: status
            });
          } else {
            console.log('Successfully logged customization approval status update:', logResult?.insertId);
          }
        });
      } else {
        console.error('Skipping action log: user_id is null or undefined');
      }

      const billingHelper = require('../utils/billingHelper');
      if (status !== previousStatus) {
        billingHelper.updateBillingStatus(itemId, 'customization', status, previousStatus, (billingErr, billingResult) => {
          if (billingErr) {
            console.error('Error auto-updating billing status:', billingErr);
          } else if (billingResult) {
            console.log('Billing status auto-updated:', billingResult);
          }
        });
      }

      if (status !== previousStatus) {
        const Notification = require('../model/NotificationModel');
        const customerUserId = item.user_id; 
        
        if (customerUserId) {
          const serviceType = 'customize';

          if (status === 'accepted') {
            Notification.createAcceptedNotification(customerUserId, itemId, serviceType, (notifErr) => {
              if (notifErr) {
                console.error('[NOTIFICATION] Failed to create accepted notification:', notifErr);
              } else {
                console.log('[NOTIFICATION] Accepted notification created successfully');
              }
            });
          }

          const statusNotificationStatuses = [
            'price_confirmation',
            'confirmed',
            'in_progress',
            'ready_for_pickup',
            'ready_to_pickup',
            'completed',
            'cancelled'
          ];
          
          if (statusNotificationStatuses.includes(status)) {
            const statusForNotification = 
              status === 'confirmed' ? 'in_progress' :
              status === 'ready_for_pickup' ? 'ready_to_pickup' :
              status === 'ready_to_pickup' ? 'ready_to_pickup' :
              status;
            
            Notification.createStatusUpdateNotification(
              customerUserId,
              itemId,
              statusForNotification,
              null,
              serviceType,
              (notifErr) => {
                if (notifErr) {
                  console.error('[NOTIFICATION] Failed to create status update notification:', notifErr);
                } else {
                  console.log('[NOTIFICATION] Status update notification created successfully');
                }
              }
            );
          }

          try {
            const emailService = require('../services/emailService');
            const dbConn = require('../config/db');
            
            const getUserSql = `SELECT u.email, u.first_name, u.last_name FROM user u WHERE u.user_id = ?`;
            dbConn.query(getUserSql, [customerUserId], async (userErr, userResults) => {
              if (!userErr && userResults.length > 0) {
                const user = userResults[0];
                const specificData = item.specific_data ? 
                  (typeof item.specific_data === 'string' ? JSON.parse(item.specific_data) : item.specific_data) : {};
                const itemName = specificData.garment_type || specificData.item_name || 'Customization Order';
                
                await emailService.sendServiceStatusEmail({
                  userEmail: user.email,
                  userName: `${user.first_name} ${user.last_name}`,
                  serviceName: itemName,
                  serviceType: serviceType,
                  status: status,
                  orderId: itemId,
                  appointmentDate: item.appointment_date || null
                });
                console.log(`[EMAIL] Service status email sent to ${user.email} for status: ${status}`);
              }
            });
          } catch (emailErr) {
            console.error('[EMAIL] Error sending service status email:', emailErr);
          }
        } else {
          console.error('[NOTIFICATION] Cannot create notification: customer user_id is missing');
        }
      }
      
      res.json({
        success: true,
        message: 'Approval status updated successfully'
      });
    });
  });
};

exports.getCustomizationStats = (req, res) => {
  Customization.getStats((err, results) => {
    if (err) {
      console.error('Get customization stats error:', err);
      return res.status(500).json({
        success: false,
        message: 'Error fetching customization stats'
      });
    }
    
    const stats = results[0] || {
      total: 0,
      pending: 0,
      accepted: 0,
      inProgress: 0,
      toPickup: 0,
      completed: 0,
      rejected: 0
    };
    
    res.json({
      success: true,
      stats: stats
    });
  });
};

const glbStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/custom-3d-models';
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'custom-model-' + uniqueSuffix + ext);
  }
});

const glbFileFilter = (req, file, cb) => {
  
  const allowedTypes = /glb|GLB/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = file.mimetype === 'model/gltf-binary' || file.mimetype === 'application/octet-stream' || file.mimetype === '';
  
  if (extname || mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only GLB files are allowed!'), false);
  }
};

const uploadGLB = multer({
  storage: glbStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, 
  fileFilter: glbFileFilter
});

exports.uploadGLBFile = uploadGLB.single('glbFile');

const ensureTableExists = (callback) => {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS custom_3d_models (
      model_id INT AUTO_INCREMENT PRIMARY KEY,
      model_name VARCHAR(255) NOT NULL,
      model_type ENUM('garment', 'button', 'accessory') DEFAULT 'garment',
      file_path VARCHAR(500) NOT NULL COMMENT 'Path to GLB file in uploads directory',
      file_url VARCHAR(500) NOT NULL COMMENT 'URL to access the GLB file',
      garment_category VARCHAR(100) COMMENT 'Category like coat-men, barong, suit, pants, etc.',
      description TEXT,
      is_active TINYINT(1) DEFAULT 1,
      created_by INT COMMENT 'Admin user_id who uploaded the model',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_model_type (model_type),
      INDEX idx_garment_category (garment_category),
      INDEX idx_is_active (is_active),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;
  
  db.query(createTableSQL, (err, result) => {
    if (err) {
      console.error('Error creating custom_3d_models table:', err);
      return callback(err);
    }
    console.log('✓ custom_3d_models table ensured');
    callback(null);
  });
};

exports.handleGLBUpload = (req, res) => {
  
  ensureTableExists((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Database error. Please contact administrator.'
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No GLB file uploaded'
        });
      }

      const { model_name, model_type, garment_category, description } = req.body;
    
    if (!model_name || !model_name.trim()) {
      
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkErr) {
          console.error('Error deleting file:', unlinkErr);
        }
      }
      return res.status(400).json({
        success: false,
        message: 'Model name is required'
      });
    }

    const fileUrl = `/uploads/custom-3d-models/${req.file.filename}`;
    const filePath = req.file.path;

    const saveModelToDatabase = (userId) => {
      
      Custom3DModel.create({
        model_name,
        model_type: model_type || 'garment',
        file_path: filePath,
        file_url: fileUrl,
        garment_category: garment_category || null,
        description: description || null,
        created_by: userId
      }, (err, result) => {
        if (err) {
          console.error('Error saving GLB model to database:', err);
          console.error('Error details:', {
            code: err.code,
            errno: err.errno,
            sqlMessage: err.sqlMessage,
            sqlState: err.sqlState
          });
          
          if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            try {
              fs.unlinkSync(req.file.path);
            } catch (unlinkErr) {
              console.error('Error deleting file:', unlinkErr);
            }
          }
          return res.status(500).json({
            success: false,
            message: err.code === 'ER_NO_SUCH_TABLE' 
              ? 'Database table does not exist. Please run the migration script: backend/database/custom_3d_models.sql'
              : err.sqlMessage || err.message || 'Error saving model to database',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
          });
        }

        res.json({
          success: true,
          message: 'GLB file uploaded successfully',
          model: {
            model_id: result.insertId,
            model_name,
            model_type: model_type || 'garment',
            file_url: fileUrl,
            garment_category,
            description
          }
        });
      });
    };

    let created_by = null;
    if (req.user) {
      created_by = req.user.id || req.user.user_id || req.user.admin_id;
    }

    if (!created_by && req.user && req.user.role === 'admin' && req.user.username) {
      const Admin = require('../model/AdminModel');
      return Admin.findByUsername(req.user.username, (err, adminResults) => {
        if (err || !adminResults || adminResults.length === 0) {
          console.error('Error fetching admin from database:', err);
          if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            try {
              fs.unlinkSync(req.file.path);
            } catch (unlinkErr) {
              console.error('Error deleting file:', unlinkErr);
            }
          }
          return res.status(401).json({
            success: false,
            message: 'User authentication required. Please log out and log back in to refresh your session.'
          });
        }
        
        const adminId = adminResults[0].admin_id || adminResults[0].id;
        if (!adminId) {
          console.error('Admin ID not found in database result');
          if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            try {
              fs.unlinkSync(req.file.path);
            } catch (unlinkErr) {
              console.error('Error deleting file:', unlinkErr);
            }
          }
          return res.status(401).json({
            success: false,
            message: 'User authentication required. Please log out and log back in to refresh your session.'
          });
        }

        saveModelToDatabase(adminId);
      });
    }
    
    if (!created_by) {
      console.error('User ID not found in token:', {
        user: req.user,
        hasUser: !!req.user,
        userKeys: req.user ? Object.keys(req.user) : []
      });
      
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkErr) {
          console.error('Error deleting file:', unlinkErr);
        }
      }
      return res.status(401).json({
        success: false,
        message: 'User authentication required. Please log out and log back in to refresh your session.',
        debug: process.env.NODE_ENV === 'development' ? {
          hasUser: !!req.user,
          userKeys: req.user ? Object.keys(req.user) : []
        } : undefined
      });
    }

      saveModelToDatabase(created_by);
    } catch (error) {
      console.error('Upload GLB error:', error);
      console.error('Error stack:', error.stack);
      
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkErr) {
          console.error('Error deleting file:', unlinkErr);
        }
      }
      return res.status(500).json({
        success: false,
        message: error.message || 'Error uploading GLB file',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });
};

exports.getAllCustom3DModels = (req, res) => {
  
  ensureTableExists((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Database error. Please contact administrator.'
      });
    }
    
    Custom3DModel.getAll((err, models) => {
      if (err) {
        console.error('Get custom 3D models error:', err);
        return res.status(500).json({
          success: false,
          message: 'Error fetching custom 3D models'
        });
      }
      
      res.json({
        success: true,
        models: models || []
      });
    });
  });
};

exports.getCustom3DModelsByType = (req, res) => {
  const { type } = req.params;
  Custom3DModel.getByType(type, (err, models) => {
    if (err) {
      console.error('Get custom 3D models by type error:', err);
      return res.status(500).json({
        success: false,
        message: 'Error fetching custom 3D models'
      });
    }
    
    res.json({
      success: true,
      models: models
    });
  });
};

exports.deleteCustom3DModel = (req, res) => {
  const { modelId } = req.params;

  Custom3DModel.getById(modelId, (err, model) => {
    if (err || !model) {
      return res.status(404).json({
        success: false,
        message: 'Model not found'
      });
    }

    if (model.file_path && fs.existsSync(model.file_path)) {
      try {
        fs.unlinkSync(model.file_path);
      } catch (unlinkErr) {
        console.error('Error deleting file:', unlinkErr);
      }
    }

    Custom3DModel.delete(modelId, (deleteErr) => {
      if (deleteErr) {
        console.error('Error deleting model from database:', deleteErr);
        return res.status(500).json({
          success: false,
          message: 'Error deleting model'
        });
      }

      res.json({
        success: true,
        message: 'Model deleted successfully'
      });
    });
  });
};
