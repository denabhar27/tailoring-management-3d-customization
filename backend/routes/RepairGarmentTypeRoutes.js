const express = require('express');
const router = express.Router();
const repairGarmentTypeController = require('../controller/RepairGarmentTypeController');
const { verifyToken } = require('../middleware/AuthToken');

router.get('/', repairGarmentTypeController.getAllRepairGarmentTypes);
router.get('/:garmentId/damage-levels', repairGarmentTypeController.getDamageLevelsByGarmentId);

router.use(verifyToken);

router.get('/admin', repairGarmentTypeController.getAllRepairGarmentTypesAdmin);

router.get('/:garmentId', repairGarmentTypeController.getRepairGarmentTypeById);

router.post('/', repairGarmentTypeController.createRepairGarmentType);

router.put('/:garmentId', repairGarmentTypeController.updateRepairGarmentType);

router.post('/:garmentId/damage-levels', repairGarmentTypeController.createDamageLevel);
router.put('/:garmentId/damage-levels/:damageLevelId', repairGarmentTypeController.updateDamageLevel);
router.delete('/:garmentId/damage-levels/:damageLevelId', repairGarmentTypeController.deleteDamageLevel);

router.delete('/:garmentId', repairGarmentTypeController.deleteRepairGarmentType);

module.exports = router;

