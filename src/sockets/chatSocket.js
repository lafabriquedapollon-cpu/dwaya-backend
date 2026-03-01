const { ChatRoom } = require('../models');

const chatSocket = (io) => {
  const chatNamespace = io.of('/chat');

  chatNamespace.use(async (socket, next) => {
    // Verify JWT token from socket handshake
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error: Token required'));
    }

    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { User } = require('../models');
      const user = await User.findById(decoded.id);
      
      if (!user || !user.isActive) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  chatNamespace.on('connection', (socket) => {
    console.log(`User connected to chat: ${socket.userId}`);

    // Join user's personal room for notifications
    socket.join(`user_${socket.userId}`);

    // Join chat room
    socket.on('join_room', async (roomId) => {
      try {
        const room = await ChatRoom.findById(roomId);
        
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        // Check if user is participant
        if (!room.participants.includes(socket.userId)) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        socket.join(roomId);
        socket.currentRoom = roomId;
        
        // Mark messages as read
        await room.markAsRead(socket.userId);
        
        socket.emit('joined_room', { roomId });
        
        console.log(`User ${socket.userId} joined room ${roomId}`);
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    // Leave chat room
    socket.on('leave_room', (roomId) => {
      socket.leave(roomId);
      socket.currentRoom = null;
      socket.emit('left_room', { roomId });
    });

    // Send message
    socket.on('send_message', async (data) => {
      try {
        const { roomId, content, type = 'text', attachments = [] } = data;

        const room = await ChatRoom.findById(roomId);
        
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        // Add message
        const message = await room.addMessage(socket.userId, content, type, attachments);
        
        // Populate sender info
        await room.populate('messages.sender', 'firstName lastName avatar');
        const populatedMessage = room.messages[room.messages.length - 1];

        // Broadcast to room
        chatNamespace.to(roomId).emit('new_message', {
          roomId,
          message: populatedMessage,
        });

        // Send notification to other participants
        const otherParticipants = room.participants.filter(
          p => p.toString() !== socket.userId
        );

        for (const participantId of otherParticipants) {
          chatNamespace.to(`user_${participantId}`).emit('notification', {
            type: 'new_message',
            roomId,
            sender: {
              id: socket.userId,
              name: `${socket.user.firstName} ${socket.user.lastName}`,
            },
            preview: content.substring(0, 100),
          });
        }
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    // Typing indicator
    socket.on('typing', (data) => {
      const { roomId, isTyping } = data;
      socket.to(roomId).emit('user_typing', {
        userId: socket.userId,
        userName: `${socket.user.firstName} ${socket.user.lastName}`,
        isTyping,
      });
    });

    // Mark messages as read
    socket.on('mark_read', async (roomId) => {
      try {
        const room = await ChatRoom.findById(roomId);
        if (room) {
          await room.markAsRead(socket.userId);
          
          // Notify other participants
          socket.to(roomId).emit('messages_read', {
            userId: socket.userId,
          });
        }
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected from chat: ${socket.userId}`);
    });
  });
};

module.exports = chatSocket;
