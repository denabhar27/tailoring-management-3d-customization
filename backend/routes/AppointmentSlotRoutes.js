const express = require('express');
const router = express.Router();
const appointmentSlotController = require('../controller/AppointmentSlotController');
const { verifyToken, requireAdmin } = require('../middleware/AuthToken');

router.get('/available', appointmentSlotController.getAvailableSlots);
router.get('/check', appointmentSlotController.checkSlotAvailability);
router.get('/slots-with-availability', appointmentSlotController.getAllSlotsWithAvailability);

router.use(verifyToken);
router.post('/book', appointmentSlotController.bookSlot);
router.delete('/cancel/:slotId', appointmentSlotController.cancelSlot);
router.get('/user-slots', appointmentSlotController.getUserSlots);

router.get('/admin/time-slots', requireAdmin, appointmentSlotController.getAllTimeSlots);
router.put('/admin/time-slot', requireAdmin, appointmentSlotController.updateTimeSlotCapacity);
router.get('/admin/availability', requireAdmin, appointmentSlotController.getTimeSlotAvailability);

module.exports = router;

