const express = require('express');
const router = express.Router();
const rentalController = require('../controller/RentalController');
const { uploadSingle, handleUploadError } = require('../middleware/UploadMiddleware');

const rentalMonitoringService = require('../services/rentalMonitoringService');
const cronScheduler = require('../services/cronScheduler');

const rentalImageFields = uploadSingle.fields([
  { name: 'image', maxCount: 1 },      
  { name: 'front_image', maxCount: 1 },
  { name: 'back_image', maxCount: 1 },
  { name: 'side_image', maxCount: 1 }
]);

router.get('/monitoring/active', async (req, res) => {
  rentalMonitoringService.getActiveRentalsWithPenalty((err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Error fetching active rentals', error: err });
    }
    res.json({ success: true, data: results });
  });
});

router.get('/monitoring/penalty/:itemId', async (req, res) => {
  const { itemId } = req.params;
  rentalMonitoringService.calculatePenalty(itemId, (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Error calculating penalty', error: err });
    }
    res.json({ success: true, data: result });
  });
});

router.post('/monitoring/check', async (req, res) => {
  try {
    const result = await cronScheduler.triggerManualCheck();
    res.json({ success: true, message: 'Rental check completed', data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error running rental check', error: error.message });
  }
});

router.get('/monitoring/status', (req, res) => {
  const status = cronScheduler.getSchedulerStatus();
  res.json({ success: true, data: status });
});

router.post('/', rentalImageFields, rentalController.createRental);

router.get('/', rentalController.getAllRentals);

router.get('/available', rentalController.getAvailableRentals);

router.get('/categories', rentalController.getCategories);

router.get('/search', rentalController.searchRentals);

router.get('/category/:category', rentalController.getRentalsByCategory);

router.put('/:item_id', rentalImageFields, rentalController.updateRental);

router.put('/:item_id/status', rentalController.updateRentalStatus);
router.post('/:item_id/mark-damaged', rentalController.markRentalItemDamaged);
router.post('/:item_id/restock-sizes', rentalController.restockReturnedRentalSizes);
router.post('/:item_id/resolve-maintenance/:log_id', rentalController.resolveMaintenance);
router.get('/:item_id/size-activity/:size_key', rentalController.getRentalSizeActivity);
router.get('/:item_id', rentalController.getRentalById);

router.delete('/:item_id', rentalController.deleteRental);

router.use(handleUploadError);

module.exports = router;
