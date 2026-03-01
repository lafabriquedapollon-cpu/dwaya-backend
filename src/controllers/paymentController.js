const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios = require('axios');
const crypto = require('crypto');
const { Order } = require('../models');

// ==================== STRIPE PAYMENT ====================

// @desc    Create Stripe payment intent
// @route   POST /api/payments/stripe/create-intent
// @access  Private
const createStripeIntent = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée',
      });
    }

    if (order.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé',
      });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order.total * 100), // Convert to cents
      currency: 'mad',
      automatic_payment_methods: { enabled: true },
      metadata: {
        orderId: order._id.toString(),
        customerId: req.user._id.toString(),
      },
    });

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
      },
    });
  } catch (error) {
    console.error('Create Stripe intent error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du paiement',
    });
  }
};

// @desc    Stripe webhook handler
// @route   POST /api/payments/stripe/webhook
// @access  Public
const stripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle events
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      await handlePaymentSuccess(paymentIntent);
      break;

    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      await handlePaymentFailure(failedPayment);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
};

// ==================== CMI PAYMENT (Moroccan Gateway) ====================

// @desc    Create CMI payment
// @route   POST /api/payments/cmi/create
// @access  Private
const createCMIPayment = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée',
      });
    }

    // Generate CMI payment parameters
    const params = {
      merchant_id: process.env.CMI_MERCHANT_ID,
      order_id: order.orderNumber,
      amount: order.total.toFixed(2),
      currency: '504', // MAD currency code
      language: 'fr',
      ok_url: `${process.env.CLIENT_URL}/payment/success`,
      fail_url: `${process.env.CLIENT_URL}/payment/failed`,
      callback_url: `${process.env.API_URL}/api/payments/cmi/callback`,
    };

    // Generate hash
    const hashString = Object.values(params).join('') + process.env.CMI_API_KEY;
    params.hash = crypto.createHash('sha256').update(hashString).digest('hex');

    res.json({
      success: true,
      data: {
        paymentUrl: `${process.env.CMI_BASE_URL}/payment`,
        params,
      },
    });
  } catch (error) {
    console.error('Create CMI payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du paiement',
    });
  }
};

// @desc    CMI callback handler
// @route   POST /api/payments/cmi/callback
// @access  Public
const cmiCallback = async (req, res) => {
  try {
    const { order_id, status, hash } = req.body;

    // Verify hash
    const expectedHash = crypto
      .createHash('sha256')
      .update(order_id + status + process.env.CMI_API_KEY)
      .digest('hex');

    if (hash !== expectedHash) {
      return res.status(400).json({
        success: false,
        message: 'Invalid hash',
      });
    }

    const order = await Order.findOne({ orderNumber: order_id });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée',
      });
    }

    if (status === 'success') {
      await handlePaymentSuccess({
        metadata: { orderId: order._id.toString() },
        id: `cmi_${Date.now()}`,
      });
    } else {
      await handlePaymentFailure({
        metadata: { orderId: order._id.toString() },
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('CMI callback error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du traitement du callback',
    });
  }
};

// ==================== CASH ON DELIVERY ====================

// @desc    Confirm cash on delivery
// @route   POST /api/payments/cod/confirm
// @access  Private
const confirmCashOnDelivery = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée',
      });
    }

    if (order.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé',
      });
    }

    // Update order payment status
    order.payment.status = 'pending';
    order.payment.method = 'cash';
    await order.save();

    res.json({
      success: true,
      message: 'Paiement à la livraison confirmé',
      data: { order },
    });
  } catch (error) {
    console.error('Confirm COD error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la confirmation',
    });
  }
};

// ==================== HELPER FUNCTIONS ====================

const handlePaymentSuccess = async (paymentIntent) => {
  try {
    const orderId = paymentIntent.metadata.orderId;

    const order = await Order.findById(orderId);

    if (!order) {
      console.error('Order not found for payment:', orderId);
      return;
    }

    // Update order
    order.payment.status = 'completed';
    order.payment.transactionId = paymentIntent.id;
    order.payment.paidAt = new Date();
    await order.save();

    // Send notification to pharmacy
    const { Notification } = require('../models');
    const { sendPushNotification } = require('../config/firebase');

    await Notification.create({
      recipient: order.pharmacy,
      title: 'Paiement reçu',
      body: `Le paiement pour la commande ${order.orderNumber} a été reçu`,
      type: 'order_update',
      data: { orderId: order._id },
    });

    console.log(`Payment successful for order ${order.orderNumber}`);
  } catch (error) {
    console.error('Handle payment success error:', error);
  }
};

const handlePaymentFailure = async (paymentIntent) => {
  try {
    const orderId = paymentIntent.metadata.orderId;

    const order = await Order.findById(orderId);

    if (!order) {
      console.error('Order not found for failed payment:', orderId);
      return;
    }

    order.payment.status = 'failed';
    await order.save();

    console.log(`Payment failed for order ${order.orderNumber}`);
  } catch (error) {
    console.error('Handle payment failure error:', error);
  }
};

// @desc    Get payment status
// @route   GET /api/payments/status/:orderId
// @access  Private
const getPaymentStatus = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée',
      });
    }

    if (order.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé',
      });
    }

    res.json({
      success: true,
      data: {
        status: order.payment.status,
        method: order.payment.method,
        paidAt: order.payment.paidAt,
      },
    });
  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du statut de paiement',
    });
  }
};

module.exports = {
  createStripeIntent,
  stripeWebhook,
  createCMIPayment,
  cmiCallback,
  confirmCashOnDelivery,
  getPaymentStatus,
};
