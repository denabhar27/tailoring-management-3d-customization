const express = require('express');
const router = express.Router();
const CustomizationController = require('../controller/CustomizationController');
const middleware = require('../middleware/AuthToken');

router.get('/custom-models', CustomizationController.getAllCustom3DModels);
router.get('/custom-models/type/:type', CustomizationController.getCustom3DModelsByType);

router.use(middleware.verifyToken);

router.post('/upload-image', 
  CustomizationController.uploadCustomizationImage, 
  CustomizationController.handleImageUpload
);

router.get('/user', CustomizationController.getUserCustomizationOrders);

router.get('/', CustomizationController.getAllCustomizationOrders);

router.get('/stats', CustomizationController.getCustomizationStats);

router.post('/upload-glb', 
  CustomizationController.uploadGLBFile, 
  CustomizationController.handleGLBUpload
);
router.put('/custom-models/:modelId', CustomizationController.updateCustom3DModel);
router.delete('/custom-models/:modelId', CustomizationController.deleteCustom3DModel);

router.get('/:itemId', CustomizationController.getCustomizationOrderById);

router.put('/:itemId', CustomizationController.updateCustomizationOrderItem);

router.put('/:itemId/status', CustomizationController.updateApprovalStatus);

module.exports = router;
