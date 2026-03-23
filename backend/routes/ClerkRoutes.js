const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/AuthToken');
const ClerkController = require('../controller/ClerkController');

router.use(verifyToken);
router.use(requireRole(['admin']));

router.get('/', ClerkController.listClerks);
router.post('/', ClerkController.createClerk);
router.put('/:id', ClerkController.updateClerk);
router.delete('/:id', ClerkController.deactivateClerk);
router.post('/:id/activate', ClerkController.activateClerk);
router.post('/:id/reset-password', ClerkController.resetClerkPassword);

module.exports = router;
