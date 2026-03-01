const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const userRoutes = require('./users');
const pharmacyRoutes = require('./pharmacies');
const orderRoutes = require('./orders');
const chatRoutes = require('./chat');
const notificationRoutes = require('./notifications');
const paymentRoutes = require('./payments');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/pharmacies', pharmacyRoutes);
router.use('/orders', orderRoutes);
router.use('/chat', chatRoutes);
router.use('/notifications', notificationRoutes);
router.use('/payments', paymentRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Dwaya API is running',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
