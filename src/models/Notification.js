const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // Recipient
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Notification Details
  title: { type: String, required: true },
  body: { type: String, required: true },
  
  // Type
  type: {
    type: String,
    enum: [
      'order_update',
      'order_delivered',
      'prescription_approved',
      'prescription_rejected',
      'chat_message',
      'promotion',
      'medication_reminder',
      'loyalty_points',
      'referral',
      'system',
    ],
    required: true,
  },
  
  // Related Data
  data: {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    chatRoomId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom' },
    pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy' },
    url: { type: String },
  },
  
  // Status
  isRead: { type: Boolean, default: false },
  readAt: { type: Date },
  
  // Push Notification Status
  pushSent: { type: Boolean, default: false },
  pushSentAt: { type: Date },
  
}, { timestamps: true });

// Indexes
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ type: 1 });

// Method to mark as read
notificationSchema.methods.markAsRead = async function() {
  this.isRead = true;
  this.readAt = new Date();
  await this.save();
};

module.exports = mongoose.model('Notification', notificationSchema);
