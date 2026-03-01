const { Order, User } = require('../models');

const driverSocket = (io) => {
  const driverNamespace = io.of('/driver');

  driverNamespace.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error: Token required'));
    }

    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      
      if (!user || !user.isActive) {
        return next(new Error('Authentication error: User not found'));
      }

      // Allow drivers, pharmacists, and admins
      if (!['driver', 'pharmacist', 'admin'].includes(user.role)) {
        return next(new Error('Authentication error: Insufficient permissions'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  driverNamespace.on('connection', (socket) => {
    console.log(`Driver connected: ${socket.userId}`);

    // Driver goes online
    socket.on('go_online', async () => {
      if (socket.user.role === 'driver') {
        await User.findByIdAndUpdate(socket.userId, {
          'driverInfo.isAvailable': true,
        });
        socket.broadcast.emit('driver_online', { driverId: socket.userId });
      }
    });

    // Driver goes offline
    socket.on('go_offline', async () => {
      if (socket.user.role === 'driver') {
        await User.findByIdAndUpdate(socket.userId, {
          'driverInfo.isAvailable': false,
        });
        socket.broadcast.emit('driver_offline', { driverId: socket.userId });
      }
    });

    // Update driver location
    socket.on('update_location', async (data) => {
      try {
        const { latitude, longitude, orderId } = data;

        // Update driver's current location
        await User.findByIdAndUpdate(socket.userId, {
          'driverInfo.currentLocation': {
            latitude,
            longitude,
            updatedAt: new Date(),
          },
        });

        // If delivering an order, update order tracking
        if (orderId) {
          const order = await Order.findById(orderId);
          if (order && order.driver?.toString() === socket.userId) {
            order.deliveryTracking.push({
              status: order.status,
              location: { latitude, longitude },
              timestamp: new Date(),
            });
            await order.save();

            // Notify customer
            driverNamespace.to(`order_${orderId}`).emit('location_update', {
              orderId,
              location: { latitude, longitude },
              timestamp: new Date(),
            });
          }
        }

        // Broadcast location to relevant parties
        socket.broadcast.emit('driver_location', {
          driverId: socket.userId,
          location: { latitude, longitude },
        });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    // Join order tracking room
    socket.on('track_order', (orderId) => {
      socket.join(`order_${orderId}`);
    });

    // Leave order tracking room
    socket.on('untrack_order', (orderId) => {
      socket.leave(`order_${orderId}`);
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`Driver disconnected: ${socket.userId}`);
      
      // Mark driver as offline
      if (socket.user.role === 'driver') {
        await User.findByIdAndUpdate(socket.userId, {
          'driverInfo.isAvailable': false,
        });
      }
    });
  });
};

module.exports = driverSocket;
