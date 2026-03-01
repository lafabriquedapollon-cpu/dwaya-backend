const express = require('express');
const router = express.Router();
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  updateSettings,
} = require('../controllers/notificationController');
const { authMiddleware } = require('../middleware/auth');
const { idParamValidation } = require('../middleware/validation');

router.use(authMiddleware);

router.get('/', getNotifications);
router.put('/settings', updateSettings);
router.put('/read-all', markAllAsRead);
router.put('/:id/read', idParamValidation, markAsRead);
router.delete('/:id', idParamValidation, deleteNotification);

module.exports = router;
