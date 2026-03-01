const express = require('express');
const router = express.Router();
const {
  getChatRooms,
  createChatRoom,
  getMessages,
  sendMessage,
  markAsRead,
  closeChatRoom,
} = require('../controllers/chatController');
const { authMiddleware } = require('../middleware/auth');
const { sendMessageValidation, idParamValidation, paginationValidation } = require('../middleware/validation');

router.use(authMiddleware);

router.get('/rooms', getChatRooms);
router.post('/rooms', createChatRoom);
router.get('/rooms/:id/messages', idParamValidation, paginationValidation, getMessages);
router.post('/rooms/:id/messages', idParamValidation, sendMessageValidation, sendMessage);
router.put('/rooms/:id/read', idParamValidation, markAsRead);
router.put('/rooms/:id/close', idParamValidation, closeChatRoom);

module.exports = router;
