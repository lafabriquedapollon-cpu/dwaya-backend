const chatSocket = require('./chatSocket');
const driverSocket = require('./driverSocket');

const initializeSockets = (io) => {
  // Initialize chat sockets
  chatSocket(io);
  
  // Initialize driver tracking sockets
  driverSocket(io);

  // Main namespace for general notifications
  const mainNamespace = io.of('/');

  mainNamespace.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  mainNamespace.on('connection', (socket) => {
    console.log(`User connected to main namespace: ${socket.userId}`);
    
    // Join user's personal room
    socket.join(`user_${socket.userId}`);

    socket.on('disconnect', () => {
      console.log(`User disconnected from main namespace: ${socket.userId}`);
    });
  });

  console.log('Socket.io initialized');
};

module.exports = initializeSockets;
