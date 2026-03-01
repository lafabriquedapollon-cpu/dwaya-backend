const express = require('express');
const router = express.Router();
const {
  createOrder,
  getOrders,
  getOrder,
  updateStatus,
  assignDriver,
  updateLocation,
  cancelOrder,
  addReview,
} = require('../controllers/orderController');
const { authMiddleware, authorize } = require('../middleware/auth');
const { createOrderValidation, idParamValidation } = require('../middleware/validation');

router.use(authMiddleware);

router.post('/', createOrderValidation, createOrder);
router.get('/', getOrders);
router.get('/:id', idParamValidation, getOrder);
router.put('/:id/status', authorize('pharmacist', 'driver', 'admin'), idParamValidation, updateStatus);
router.put('/:id/assign-driver', authorize('pharmacist', 'admin'), idParamValidation, assignDriver);
router.put('/:id/location', authorize('driver'), idParamValidation, updateLocation);
router.put('/:id/cancel', idParamValidation, cancelOrder);
router.post('/:id/review', idParamValidation, addReview);

module.exports = router;
