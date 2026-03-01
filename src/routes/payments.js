const express = require('express');
const router = express.Router();
const {
  createStripeIntent,
  stripeWebhook,
  createCMIPayment,
  cmiCallback,
  confirmCashOnDelivery,
  getPaymentStatus,
} = require('../controllers/paymentController');
const { authMiddleware } = require('../middleware/auth');

// Stripe webhook (raw body needed)
router.post('/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

// CMI callback (public)
router.post('/cmi/callback', cmiCallback);

// Protected routes
router.use(authMiddleware);

router.post('/stripe/create-intent', createStripeIntent);
router.post('/cmi/create', createCMIPayment);
router.post('/cod/confirm', confirmCashOnDelivery);
router.get('/status/:orderId', getPaymentStatus);

module.exports = router;
