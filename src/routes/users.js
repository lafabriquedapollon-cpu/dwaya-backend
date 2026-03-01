const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
  getProfile,
  updateProfile,
  uploadAvatar,
  addAddress,
  updateAddress,
  deleteAddress,
  getLoyaltyPoints,
  updateHealthInfo,
  addReminder,
  updateReminder,
  deleteReminder,
} = require('../controllers/userController');
const { authMiddleware } = require('../middleware/auth');
const { idParamValidation } = require('../middleware/validation');

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/avatars/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non supporté. Utilisez JPEG, PNG ou WebP.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

router.use(authMiddleware);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.post('/avatar', upload.single('avatar'), uploadAvatar);

// Addresses
router.post('/addresses', addAddress);
router.put('/addresses/:id', idParamValidation, updateAddress);
router.delete('/addresses/:id', idParamValidation, deleteAddress);

// Loyalty
router.get('/loyalty', getLoyaltyPoints);

// Health
router.put('/health', updateHealthInfo);

// Medication Reminders
router.post('/reminders', addReminder);
router.put('/reminders/:id', idParamValidation, updateReminder);
router.delete('/reminders/:id', idParamValidation, deleteReminder);

module.exports = router;
