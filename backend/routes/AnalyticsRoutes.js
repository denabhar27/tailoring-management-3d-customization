const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../middleware/AuthToken');
const AnalyticsController = require('../controller/AnalyticsController');

router.use(verifyToken);

router.get('/overview', requireAdmin, AnalyticsController.getRevenueOverview);

router.get('/trend', requireAdmin, AnalyticsController.getRevenueTrend);

router.get('/by-service', requireAdmin, AnalyticsController.getRevenueByService);

router.get('/top-services', requireAdmin, AnalyticsController.getTopServices);

router.get('/net-loss-by-service', requireAdmin, AnalyticsController.getNetLossByService);

router.get('/comparison', requireAdmin, AnalyticsController.getRevenueComparison);

router.get('/top-customers', requireAdmin, AnalyticsController.getTopCustomers);

router.get('/detailed', requireAdmin, AnalyticsController.getDetailedAnalytics);

module.exports = router;
