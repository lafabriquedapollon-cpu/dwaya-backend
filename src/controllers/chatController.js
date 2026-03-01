const { ChatRoom, User } = require('../models');
const { sendPushNotification } = require('../config/firebase');

// @desc    Get user's chat rooms
// @route   GET /api/chat/rooms
// @access  Private
const getChatRooms = async (req, res) => {
  try {
    const rooms = await ChatRoom.find({
      participants: req.user._id,
      isActive: true,
    })
      .populate('participants', 'firstName lastName avatar role')
      .populate('order', 'orderNumber status')
      .populate('pharmacy', 'name')
      .populate('lastMessage.sender', 'firstName lastName')
      .sort({ 'lastMessage.timestamp': -1 });

    // Add unread count for each room
    const roomsWithUnread = rooms.map(room => ({
      ...room.toObject(),
      unreadCount: room.getUnreadCount(req.user._id),
    }));

    res.json({
      success: true,
      data: { rooms: roomsWithUnread },
    });
  } catch (error) {
    console.error('Get chat rooms error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des conversations',
    });
  }
};

// @desc    Get or create chat room
// @route   POST /api/chat/rooms
// @access  Private
const createChatRoom = async (req, res) => {
  try {
    const { participantId, type, orderId, pharmacyId } = req.body;

    const participants = [req.user._id, participantId];

    const room = await ChatRoom.getOrCreateRoom(
      participants,
      type,
      orderId,
      pharmacyId
    );

    await room.populate('participants', 'firstName lastName avatar role');

    res.json({
      success: true,
      data: { room },
    });
  } catch (error) {
    console.error('Create chat room error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la conversation',
    });
  }
};

// @desc    Get chat room messages
// @route   GET /api/chat/rooms/:id/messages
// @access  Private
const getMessages = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    const room = await ChatRoom.findById(req.params.id)
      .populate('messages.sender', 'firstName lastName avatar');

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Conversation non trouvée',
      });
    }

    // Check if user is participant
    if (!room.participants.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé',
      });
    }

    // Mark messages as read
    await room.markAsRead(req.user._id);

    // Paginate messages
    const messages = room.messages
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice((page - 1) * limit, page * limit)
      .reverse();

    res.json({
      success: true,
      data: { messages },
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des messages',
    });
  }
};

// @desc    Send message
// @route   POST /api/chat/rooms/:id/messages
// @access  Private
const sendMessage = async (req, res) => {
  try {
    const { content, type = 'text', attachments = [] } = req.body;

    const room = await ChatRoom.findById(req.params.id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Conversation non trouvée',
      });
    }

    // Check if user is participant
    if (!room.participants.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé',
      });
    }

    // Add message
    const message = await room.addMessage(
      req.user._id,
      content,
      type,
      attachments
    );

    // Populate sender info
    await room.populate('messages.sender', 'firstName lastName avatar');
    const populatedMessage = room.messages[room.messages.length - 1];

    // Send push notifications to other participants
    const otherParticipants = room.participants.filter(
      p => p.toString() !== req.user._id.toString()
    );

    for (const participantId of otherParticipants) {
      const participant = await User.findById(participantId);
      if (participant?.pushTokens.length > 0) {
        await sendPushNotification(
          participant.pushTokens[0],
          `Nouveau message de ${req.user.firstName}`,
          content.substring(0, 100),
          { 
            roomId: room._id.toString(), 
            type: 'chat',
            messageId: message._id.toString(),
          }
        );
      }
    }

    res.status(201).json({
      success: true,
      data: { message: populatedMessage },
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi du message',
    });
  }
};

// @desc    Mark messages as read
// @route   PUT /api/chat/rooms/:id/read
// @access  Private
const markAsRead = async (req, res) => {
  try {
    const room = await ChatRoom.findById(req.params.id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Conversation non trouvée',
      });
    }

    if (!room.participants.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé',
      });
    }

    await room.markAsRead(req.user._id);

    res.json({
      success: true,
      message: 'Messages marqués comme lus',
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du marquage des messages',
    });
  }
};

// @desc    Close chat room
// @route   PUT /api/chat/rooms/:id/close
// @access  Private
const closeChatRoom = async (req, res) => {
  try {
    const room = await ChatRoom.findById(req.params.id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Conversation non trouvée',
      });
    }

    if (!room.participants.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé',
      });
    }

    room.isActive = false;
    room.closedAt = new Date();
    room.closedBy = req.user._id;
    await room.save();

    res.json({
      success: true,
      message: 'Conversation fermée',
    });
  } catch (error) {
    console.error('Close chat room error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la fermeture de la conversation',
    });
  }
};

module.exports = {
  getChatRooms,
  createChatRoom,
  getMessages,
  sendMessage,
  markAsRead,
  closeChatRoom,
};
