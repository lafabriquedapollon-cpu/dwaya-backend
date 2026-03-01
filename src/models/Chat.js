const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['text', 'image', 'file', 'order_reference'],
    default: 'text' 
  },
  attachments: [{
    url: { type: String },
    name: { type: String },
    type: { type: String },
  }],
  orderReference: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  isRead: { type: Boolean, default: false },
  readAt: { type: Date },
}, { timestamps: true });

const chatRoomSchema = new mongoose.Schema({
  // Participants
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  
  // Room Type
  type: { 
    type: String, 
    enum: ['customer_support', 'pharmacy_chat', 'driver_chat', 'group'],
    required: true 
  },
  
  // Related Entities
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  pharmacy: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy' },
  
  // Messages
  messages: [messageSchema],
  
  // Last Activity
  lastMessage: {
    content: { type: String },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date },
  },
  
  // Unread Count per Participant
  unreadCount: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    count: { type: Number, default: 0 },
  }],
  
  // Status
  isActive: { type: Boolean, default: true },
  closedAt: { type: Date },
  closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
}, { timestamps: true });

// Indexes
chatRoomSchema.index({ participants: 1 });
chatRoomSchema.index({ order: 1 });
chatRoomSchema.index({ pharmacy: 1 });
chatRoomSchema.index({ 'lastMessage.timestamp': -1 });
chatRoomSchema.index({ isActive: 1 });

// Method to add message
chatRoomSchema.methods.addMessage = async function(senderId, content, type = 'text', attachments = []) {
  const message = {
    sender: senderId,
    content,
    type,
    attachments,
  };
  
  this.messages.push(message);
  this.lastMessage = {
    content,
    sender: senderId,
    timestamp: new Date(),
  };
  
  // Update unread counts for other participants
  this.participants.forEach(participant => {
    if (participant.toString() !== senderId.toString()) {
      const unreadEntry = this.unreadCount.find(
        u => u.user.toString() === participant.toString()
      );
      if (unreadEntry) {
        unreadEntry.count += 1;
      } else {
        this.unreadCount.push({ user: participant, count: 1 });
      }
    }
  });
  
  await this.save();
  return this.messages[this.messages.length - 1];
};

// Method to mark messages as read
chatRoomSchema.methods.markAsRead = async function(userId) {
  // Mark all unread messages as read
  this.messages.forEach(message => {
    if (message.sender.toString() !== userId.toString() && !message.isRead) {
      message.isRead = true;
      message.readAt = new Date();
    }
  });
  
  // Reset unread count for this user
  const unreadEntry = this.unreadCount.find(
    u => u.user.toString() === userId.toString()
  );
  if (unreadEntry) {
    unreadEntry.count = 0;
  }
  
  await this.save();
};

// Method to get unread count for user
chatRoomSchema.methods.getUnreadCount = function(userId) {
  const entry = this.unreadCount.find(
    u => u.user.toString() === userId.toString()
  );
  return entry ? entry.count : 0;
};

// Static method to get or create chat room
chatRoomSchema.statics.getOrCreateRoom = async function(participants, type, orderId = null, pharmacyId = null) {
  // Check if room already exists
  let room = await this.findOne({
    participants: { $all: participants, $size: participants.length },
    type,
    isActive: true,
  });
  
  if (!room) {
    room = new this({
      participants,
      type,
      order: orderId,
      pharmacy: pharmacyId,
      unreadCount: participants.map(p => ({ user: p, count: 0 })),
    });
    await room.save();
  }
  
  return room;
};

module.exports = mongoose.model('ChatRoom', chatRoomSchema);
