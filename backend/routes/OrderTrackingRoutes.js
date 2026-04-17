const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();
const OrderTrackingController = require('../controller/OrderTrackingController');
const { verifyToken, requireAdmin } = require('../middleware/AuthToken');

const enhancementDir = path.join(__dirname, '..', 'uploads', 'enhancement-requests');
if (!fs.existsSync(enhancementDir)) {
  fs.mkdirSync(enhancementDir, { recursive: true });
}

const enhancementStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, enhancementDir),
  filename: (req, file, cb) => {
    const id = req.params.id || 'item';
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `enh-${id}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const enhancementUpload = multer({
  storage: enhancementStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed for enhancement photos'));
    }
    cb(null, true);
  }
});

/** JSON body OR multipart (fields + optional photos) */
const handleEnhancementUpload = (req, res, next) => {
  const ct = String(req.headers['content-type'] || '');
  if (ct.includes('multipart/form-data')) {
    return enhancementUpload.array('photos', 5)(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || 'Invalid file upload'
        });
      }
      next();
    });
  }
  next();
};

router.get('/', verifyToken, OrderTrackingController.getUserOrderTracking);

router.get('/history/:id', verifyToken, OrderTrackingController.getOrderItemTrackingHistory);

router.get('/transitions/:id', verifyToken, requireAdmin, OrderTrackingController.getStatusTransitions);

router.post('/update/:id', verifyToken, requireAdmin, OrderTrackingController.updateTrackingStatus);

router.post('/confirm-pickup/:id', verifyToken, OrderTrackingController.confirmPickupByCustomer);

router.post('/request-enhancement/:id', verifyToken, handleEnhancementUpload, OrderTrackingController.requestEnhancement);

module.exports = router;
