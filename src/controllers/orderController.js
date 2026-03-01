const { Order, Pharmacy, User, Notification } = require('../models');
const { sendPushNotification } = require('../config/firebase');

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const createOrder = async (req, res) => {
  try {
    const { pharmacy, items, deliveryAddress, payment, customerNotes, promoCode } = req.body;

    // Verify pharmacy exists and is active
    const pharmacyDoc = await Pharmacy.findById(pharmacy);
    if (!pharmacyDoc || !pharmacyDoc.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacie non trouvée ou inactive',
      });
    }

    // Calculate pricing
    let subtotal = 0;
    const orderItems = items.map(item => {
      const medication = pharmacyDoc.medications.id(item.medicationId);
      if (!medication) {
        throw new Error(`Médicament ${item.medicationId} non trouvé`);
      }
      
      const totalPrice = medication.price * item.quantity;
      subtotal += totalPrice;

      return {
        medication: {
          id: medication._id,
          name: medication.name,
          price: medication.price,
          requiresPrescription: medication.requiresPrescription,
        },
        quantity: item.quantity,
        unitPrice: medication.price,
        totalPrice,
      };
    });

    // Calculate delivery fee
    const deliveryFee = subtotal >= pharmacyDoc.deliverySettings.freeDeliveryThreshold 
      ? 0 
      : pharmacyDoc.deliverySettings.deliveryFee;

    // Apply promo code if provided
    let discount = 0;
    if (promoCode) {
      const PromoCode = require('../models/PromoCode');
      const promo = await PromoCode.findOne({ code: promoCode.toUpperCase() });
      if (promo) {
        const validation = promo.isValid(req.user._id);
        if (validation.valid) {
          const discountResult = promo.calculateDiscount(subtotal);
          if (discountResult.applicable) {
            discount = discountResult.discountAmount;
          }
        }
      }
    }

    const total = subtotal + deliveryFee - discount;

    // Create order
    const order = await Order.create({
      customer: req.user._id,
      pharmacy,
      items: orderItems,
      deliveryAddress,
      payment,
      subtotal,
      deliveryFee,
      discount,
      total,
      customerNotes,
      estimatedDeliveryTime: new Date(Date.now() + pharmacyDoc.deliverySettings.estimatedDeliveryTime * 60000),
    });

    // Apply promo code usage
    if (promoCode && discount > 0) {
      const PromoCode = require('../models/PromoCode');
      const promo = await PromoCode.findOne({ code: promoCode.toUpperCase() });
      if (promo) {
        await promo.apply(req.user._id, order._id, discount);
      }
    }

    // Send notification to pharmacy
    const notification = await Notification.create({
      recipient: pharmacyDoc.owner,
      title: 'Nouvelle commande',
      body: `Vous avez reçu une nouvelle commande de ${req.user.firstName} ${req.user.lastName}`,
      type: 'order_update',
      data: { orderId: order._id },
    });

    // Send push notification
    const owner = await User.findById(pharmacyDoc.owner);
    if (owner.pushTokens.length > 0) {
      await sendPushNotification(
        owner.pushTokens[0],
        'Nouvelle commande',
        `Vous avez reçu une nouvelle commande`,
        { orderId: order._id.toString(), type: 'order' }
      );
    }

    res.status(201).json({
      success: true,
      message: 'Commande créée avec succès',
      data: { order },
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la commande',
    });
  }
};

// @desc    Get user orders
// @route   GET /api/orders
// @access  Private
const getOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query = { customer: req.user._id };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const orders = await Order.find(query)
      .populate('pharmacy', 'name address phone')
      .populate('driver', 'firstName lastName phone driverInfo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des commandes',
    });
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'firstName lastName phone')
      .populate('pharmacy', 'name address phone')
      .populate('driver', 'firstName lastName phone driverInfo');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée',
      });
    }

    // Check authorization
    const isAuthorized = 
      order.customer._id.toString() === req.user._id.toString() ||
      order.pharmacy.owner?.toString() === req.user._id.toString() ||
      order.driver?._id.toString() === req.user._id.toString() ||
      req.user.role === 'admin';

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé',
      });
    }

    res.json({
      success: true,
      data: { order },
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la commande',
    });
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private (Pharmacy/Driver/Admin)
const updateStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée',
      });
    }

    // Update status
    await order.updateStatus(status, notes);

    // Notify customer
    const notification = await Notification.create({
      recipient: order.customer,
      title: 'Mise à jour de commande',
      body: `Votre commande est maintenant: ${getStatusLabel(status)}`,
      type: 'order_update',
      data: { orderId: order._id },
    });

    // Send push notification to customer
    const customer = await User.findById(order.customer);
    if (customer.pushTokens.length > 0) {
      await sendPushNotification(
        customer.pushTokens[0],
        'Mise à jour de commande',
        `Votre commande est maintenant: ${getStatusLabel(status)}`,
        { orderId: order._id.toString(), type: 'order' }
      );
    }

    res.json({
      success: true,
      message: 'Statut mis à jour',
      data: { order },
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du statut',
    });
  }
};

// @desc    Assign driver to order
// @route   PUT /api/orders/:id/assign-driver
// @access  Private (Pharmacy/Admin)
const assignDriver = async (req, res) => {
  try {
    const { driverId } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée',
      });
    }

    order.driver = driverId;
    await order.save();

    // Notify driver
    const notification = await Notification.create({
      recipient: driverId,
      title: 'Nouvelle livraison',
      body: 'Une nouvelle commande vous a été assignée',
      type: 'order_update',
      data: { orderId: order._id },
    });

    const driver = await User.findById(driverId);
    if (driver.pushTokens.length > 0) {
      await sendPushNotification(
        driver.pushTokens[0],
        'Nouvelle livraison',
        'Une nouvelle commande vous a été assignée',
        { orderId: order._id.toString(), type: 'delivery' }
      );
    }

    res.json({
      success: true,
      message: 'Livreur assigné',
      data: { order },
    });
  } catch (error) {
    console.error('Assign driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'assignation du livreur',
    });
  }
};

// @desc    Update driver location
// @route   PUT /api/orders/:id/location
// @access  Private (Driver)
const updateLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée',
      });
    }

    // Verify driver
    if (order.driver?.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé',
      });
    }

    // Add tracking entry
    order.deliveryTracking.push({
      status: order.status,
      location: { latitude, longitude },
      timestamp: new Date(),
    });

    await order.save();

    res.json({
      success: true,
      message: 'Position mise à jour',
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la position',
    });
  }
};

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private (Customer)
const cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée',
      });
    }

    // Check if order can be cancelled
    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cette commande ne peut plus être annulée',
      });
    }

    await order.updateStatus('cancelled', reason);

    res.json({
      success: true,
      message: 'Commande annulée',
      data: { order },
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'annulation de la commande',
    });
  }
};

// @desc    Add review to order
// @route   POST /api/orders/:id/review
// @access  Private (Customer)
const addReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée',
      });
    }

    // Check if order belongs to user
    if (order.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé',
      });
    }

    // Check if order is delivered
    if (order.status !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Vous ne pouvez évaluer que les commandes livrées',
      });
    }

    // Check if already reviewed
    if (order.review) {
      return res.status(400).json({
        success: false,
        message: 'Vous avez déjà évalué cette commande',
      });
    }

    order.review = {
      rating,
      comment,
      createdAt: new Date(),
    };

    await order.save();

    // Update pharmacy rating
    const pharmacy = await Pharmacy.findById(order.pharmacy);
    if (pharmacy) {
      pharmacy.reviews.push({
        user: req.user._id,
        rating,
        comment,
        order: order._id,
      });
      await pharmacy.updateRating();
    }

    // Award loyalty points
    const points = Math.floor(order.total * (parseInt(process.env.LOYALTY_POINTS_PER_DH) || 1));
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { loyaltyPoints: points },
    });

    res.json({
      success: true,
      message: 'Avis ajouté avec succès',
      data: { review: order.review },
    });
  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'ajout de l\'avis',
    });
  }
};

// Helper function
const getStatusLabel = (status) => {
  const labels = {
    pending: 'En attente',
    confirmed: 'Confirmée',
    preparing: 'En préparation',
    ready: 'Prête',
    out_for_delivery: 'En cours de livraison',
    delivered: 'Livrée',
    cancelled: 'Annulée',
    refunded: 'Remboursée',
  };
  return labels[status] || status;
};

module.exports = {
  createOrder,
  getOrders,
  getOrder,
  updateStatus,
  assignDriver,
  updateLocation,
  cancelOrder,
  addReview,
};
