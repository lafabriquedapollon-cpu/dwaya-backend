const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  refreshToken,
  logout,
  updatePushToken,
} = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');
const {
  registerValidation,
  loginValidation,
} = require('../middleware/validation');

// Public routes
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.post('/refresh', refreshToken);

// Protected routes
router.use(authMiddleware);

router.get('/me', getMe);
router.put('/profile', updateProfile);
router.put('/password', changePassword);
router.post('/logout', logout);
router.put('/push-token', updatePushToken);

module.exports = router;
