const { Notification } = require('../models');
const { sendPushNotification } = require('../config/firebase');

/**
 * Create and send notification to user
 * @param {string} recipientId - User ID
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {string} type - Notification type
 * @param {object} data - Additional data
 */
const createNotification = async (recipientId, title, body, type, data = {}) => {
  try {
    // Create notification in database
    const notification = await Notification.create({
      recipient: recipientId,
      title,
      body,
      type,
      data,
    });

    // Get user's push tokens
    const { User } = require('../models');
    const user = await User.findById(recipientId);

    if (user && user.pushTokens.length > 0 && user.notificationSettings[type] !== false) {
      // Send push notification
      for (const token of user.pushTokens) {
        try {
          await sendPushNotification(token, title, body, data);
        } catch (error) {
          console.error(`Failed to send push to token ${token}:`, error.message);
        }
      }

      // Update notification status
      notification.pushSent = true;
      notification.pushSentAt = new Date();
      await notification.save();
    }

    return notification;
  } catch (error) {
    console.error('Create notification error:', error);
    throw error;
  }
};

/**
 * Send order status notification
 * @param {string} orderId - Order ID
 * @param {string} status - New status
 */
const sendOrderStatusNotification = async (orderId, status) => {
  try {
    const { Order } = require('../models');
    const order = await Order.findById(orderId).populate('customer', 'firstName');

    if (!order) return;

    const statusMessages = {
      confirmed: {
        title: 'Commande confirmée',
        body: `Votre commande ${order.orderNumber} a été confirmée par la pharmacie.`,
      },
      preparing: {
        title: 'Commande en préparation',
        body: `Votre commande ${order.orderNumber} est en cours de préparation.`,
      },
      ready: {
        title: 'Commande prête',
        body: `Votre commande ${order.orderNumber} est prête pour la livraison.`,
      },
      out_for_delivery: {
        title: 'En cours de livraison',
        body: `Votre commande ${order.orderNumber} est en route !`,
      },
      delivered: {
        title: 'Commande livrée',
        body: `Votre commande ${order.orderNumber} a été livrée. Merci !`,
      },
      cancelled: {
        title: 'Commande annulée',
        body: `Votre commande ${order.orderNumber} a été annulée.`,
      },
    };

    const message = statusMessages[status];
    if (message) {
      await createNotification(
        order.customer._id,
        message.title,
        message.body,
        'order_update',
        { orderId: order._id.toString() }
      );
    }
  } catch (error) {
    console.error('Send order status notification error:', error);
  }
};

/**
 * Send chat message notification
 * @param {string} recipientId - Recipient user ID
 * @param {string} senderName - Sender name
 * @param {string} message - Message preview
 * @param {string} roomId - Chat room ID
 */
const sendChatNotification = async (recipientId, senderName, message, roomId) => {
  try {
    await createNotification(
      recipientId,
      `Nouveau message de ${senderName}`,
      message.substring(0, 100),
      'chat_message',
      { roomId }
    );
  } catch (error) {
    console.error('Send chat notification error:', error);
  }
};

/**
 * Send medication reminder notification
 * @param {string} userId - User ID
 * @param {string} medicationName - Medication name
 * @param {string} dosage - Dosage info
 */
const sendMedicationReminder = async (userId, medicationName, dosage) => {
  try {
    await createNotification(
      userId,
      'Rappel de médicament',
      `Il est temps de prendre ${medicationName} - ${dosage}`,
      'medication_reminder',
      {}
    );
  } catch (error) {
    console.error('Send medication reminder error:', error);
  }
};

/**
 * Send loyalty points notification
 * @param {string} userId - User ID
 * @param {number} points - Points earned
 * @param {string} reason - Reason for earning points
 */
const sendLoyaltyNotification = async (userId, points, reason) => {
  try {
    await createNotification(
      userId,
      'Points de fidélité',
      `Vous avez gagné ${points} points ! ${reason}`,
      'loyalty_points',
      {}
    );
  } catch (error) {
    console.error('Send loyalty notification error:', error);
  }
};

/**
 * Send promotional notification
 * @param {string} userId - User ID
 * @param {string} title - Promotion title
 * @param {string} description - Promotion description
 * @param {string} url - Promotion URL
 */
const sendPromotionNotification = async (userId, title, description, url) => {
  try {
    await createNotification(
      userId,
      title,
      description,
      'promotion',
      { url }
    );
  } catch (error) {
    console.error('Send promotion notification error:', error);
  }
};

module.exports = {
  createNotification,
  sendOrderStatusNotification,
  sendChatNotification,
  sendMedicationReminder,
  sendLoyaltyNotification,
  sendPromotionNotification,
};
