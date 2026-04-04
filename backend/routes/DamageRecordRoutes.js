const express = require('express');
const router = express.Router();
const damageRecordController = require('../controller/DamageRecordController');
const middleware = require('../middleware/AuthToken');

router.use(middleware.verifyToken);

router.post('/', damageRecordController.createDamageRecord);
router.post('/compensation-incidents', damageRecordController.createCompensationIncident);
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

