const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const damageRecordController = require('../controller/DamageRecordController');
const middleware = require('../middleware/AuthToken');

const disputeImagesDir = path.join(process.cwd(), 'uploads', 'dispute-images');
if (!fs.existsSync(disputeImagesDir)) {
	fs.mkdirSync(disputeImagesDir, { recursive: true });
}

const disputeStorage = multer.diskStorage({
	destination: (req, file, cb) => cb(null, disputeImagesDir),
	filename: (req, file, cb) => {
		const ext = path.extname(file.originalname || '');
		const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
		cb(null, `dispute-${unique}${ext}`);
	}
});

const disputeUpload = multer({
	storage: disputeStorage,
	limits: { fileSize: 5 * 1024 * 1024 },
	fileFilter: (req, file, cb) => {
		if (file?.mimetype?.startsWith('image/')) {
			cb(null, true);
			return;
		}
		cb(new Error('Only image files are allowed.'));
	}
});

router.use(middleware.verifyToken);

router.post('/', damageRecordController.createDamageRecord);
router.post('/compensation-incidents', disputeUpload.single('disputeImage'), damageRecordController.createCompensationIncident);
router.put('/compensation-incidents/:id/liability', damageRecordController.updateLiabilityDecision);
router.put('/compensation-incidents/:id/customer-liability', damageRecordController.customerLiabilityDecision);
router.post('/compensation-incidents/:id/settlement', damageRecordController.recordCompensationSettlement);
router.get('/compensation-incidents', damageRecordController.getCompensationIncidents);
router.get('/compensation-stats', damageRecordController.getCompensationStats);
router.get('/', damageRecordController.getAllDamageRecords);
router.get('/item/:itemId', damageRecordController.getDamageRecordsByItem);
router.get('/:id', damageRecordController.getDamageRecordById);
router.put('/:id', damageRecordController.updateDamageRecord);
router.delete('/:id', damageRecordController.deleteDamageRecord);

module.exports = router;

