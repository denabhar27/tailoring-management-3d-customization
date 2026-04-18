const express = require('express');
const router = express.Router();
const orderController = require('../controller/OrderController');
const orderPriceController = require('../controller/OrderPriceController');
const middleware = require('../middleware/AuthToken');

router.use(middleware.verifyToken);

router.get('/', orderController.getUserOrders);
router.get('/all', orderController.getAllOrders);
router.get('/archive/deleted', orderController.getDeletedOrdersArchive);
router.get('/:id', orderController.getOrderById);

router.put('/:id/status', orderController.updateOrderStatus);
router.put('/:id/cancel', orderController.cancelOrder);

router.post('/items/:id/cancel', orderController.cancelOrderItem);

router.put('/items/:id/approval', orderController.updateItemApprovalStatus);

router.get('/status/:status', orderController.getOrdersByStatus);

router.get('/pending-approvals', orderController.getPendingApprovalItems);

router.get('/repair/orders', orderController.getRepairOrders);
router.get('/repair/orders/status/:status', orderController.getRepairOrdersByStatus);
router.put('/repair/items/:id', orderController.updateRepairOrderItem);

router.get('/dry-cleaning/orders', orderController.getDryCleaningOrders);
router.get('/dry-cleaning/orders/status/:status', orderController.getDryCleaningOrdersByStatus);
router.put('/dry-cleaning/items/:id', orderController.updateDryCleaningOrderItem);

router.get('/rental/orders', orderController.getRentalOrders);
router.get('/rental/orders/status/:status', orderController.getRentalOrdersByStatus);
router.put('/rental/items/:id', orderController.updateRentalOrderItem);
router.post('/rental/items/:id/payment', orderController.recordRentalPayment); 
router.post('/rental/items/:id/deposit-return', orderController.recordRentalDepositReturn);
router.post('/rental/items/:id/confirm-deposit-receipt', orderController.confirmRentalDepositReceipt);

router.post('/items/:id/payment', orderController.recordRentalPayment); 

router.post('/:itemId/accept-price', orderPriceController.acceptPrice);
router.post('/:itemId/decline-price', orderPriceController.declinePrice);
router.post('/:itemId/haggle-price', orderPriceController.hagglePrice);

router.get('/items/:itemId', orderController.getOrderItemDetails);

router.delete('/items/:itemId', orderController.deleteOrderItem);

router.put('/items/:id/price', orderController.updateOrderItemPrice);
router.get('/items/:id/price-history', orderController.getOrderItemPriceHistory);

router.post('/items/:itemId/cancel-enhancement', orderController.cancelEnhancement);

module.exports = router;
