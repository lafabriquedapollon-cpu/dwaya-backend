const { User } = require('../models');
const { uploadImage } = require('../config/cloudinary');
const fs = require('fs');

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du profil',
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, dateOfBirth, gender } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { firstName, lastName, phone, dateOfBirth, gender },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profil mis à jour',
      data: { user },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du profil',
    });
  }
};

// @desc    Upload avatar
// @route   POST /api/users/avatar
// @access  Private
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucune image fournie',
      });
    }

    // Upload to Cloudinary
    const result = await uploadImage(req.file.path, 'dwaya/avatars');

    // Delete old avatar if exists
    const user = await User.findById(req.user._id);
    if (user.avatar) {
      // Extract public ID from URL and delete
      const publicId = user.avatar.split('/').pop().split('.')[0];
      if (publicId) {
        await require('../config/cloudinary').deleteImage(`dwaya/avatars/${publicId}`);
      }
    }

    // Update user with new avatar
    user.avatar = result.url;
    await user.save();

    // Delete local file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: 'Avatar mis à jour',
      data: { avatar: result.url },
    });
  } catch (error) {
    console.error('Upload avatar error:', error);
    // Clean up local file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: 'Erreur lors du téléchargement de l\'avatar',
    });
  }
};

// @desc    Add address
// @route   POST /api/users/addresses
// @access  Private
const addAddress = async (req, res) => {
  try {
    const { label, street, city, zipCode, coordinates, isDefault } = req.body;

    const user = await User.findById(req.user._id);

    // If setting as default, unset other defaults
    if (isDefault) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }

    user.addresses.push({
      label,
      street,
      city,
      zipCode,
      coordinates,
      isDefault,
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: 'Adresse ajoutée',
      data: { addresses: user.addresses },
    });
  } catch (error) {
    console.error('Add address error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'ajout de l\'adresse',
    });
  }
};

// @desc    Update address
// @route   PUT /api/users/addresses/:id
// @access  Private
const updateAddress = async (req, res) => {
  try {
    const { label, street, city, zipCode, coordinates, isDefault } = req.body;

    const user = await User.findById(req.user._id);
    const address = user.addresses.id(req.params.id);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Adresse non trouvée',
      });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }

    address.label = label || address.label;
    address.street = street || address.street;
    address.city = city || address.city;
    address.zipCode = zipCode || address.zipCode;
    address.coordinates = coordinates || address.coordinates;
    address.isDefault = isDefault !== undefined ? isDefault : address.isDefault;

    await user.save();

    res.json({
      success: true,
      message: 'Adresse mise à jour',
      data: { addresses: user.addresses },
    });
  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de l\'adresse',
    });
  }
};

// @desc    Delete address
// @route   DELETE /api/users/addresses/:id
// @access  Private
const deleteAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    user.addresses = user.addresses.filter(
      addr => addr._id.toString() !== req.params.id
    );

    await user.save();

    res.json({
      success: true,
      message: 'Adresse supprimée',
      data: { addresses: user.addresses },
    });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de l\'adresse',
    });
  }
};

// @desc    Get loyalty points
// @route   GET /api/users/loyalty
// @access  Private
const getLoyaltyPoints = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('loyaltyPoints referralCode referrals');

    // Get referral info
    const referrals = await User.find({
      _id: { $in: user.referrals },
    }).select('firstName lastName createdAt');

    res.json({
      success: true,
      data: {
        points: user.loyaltyPoints,
        referralCode: user.referralCode,
        referrals: referrals.map(r => ({
          name: `${r.firstName} ${r.lastName}`,
          date: r.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('Get loyalty points error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des points de fidélité',
    });
  }
};

// @desc    Update health info
// @route   PUT /api/users/health
// @access  Private
const updateHealthInfo = async (req, res) => {
  try {
    const { bloodType, allergies, emergencyContact } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        'healthInfo.bloodType': bloodType,
        'healthInfo.allergies': allergies,
        'healthInfo.emergencyContact': emergencyContact,
      },
      { new: true }
    ).select('healthInfo');

    res.json({
      success: true,
      message: 'Informations de santé mises à jour',
      data: { healthInfo: user.healthInfo },
    });
  } catch (error) {
    console.error('Update health info error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour des informations de santé',
    });
  }
};

// @desc    Add medication reminder
// @route   POST /api/users/reminders
// @access  Private
const addReminder = async (req, res) => {
  try {
    const { name, dosage, frequency, times, startDate, endDate, color } = req.body;

    const user = await User.findById(req.user._id);

    user.medicationReminders.push({
      name,
      dosage,
      frequency,
      times,
      startDate,
      endDate,
      color,
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: 'Rappel ajouté',
      data: { reminders: user.medicationReminders },
    });
  } catch (error) {
    console.error('Add reminder error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'ajout du rappel',
    });
  }
};

// @desc    Update medication reminder
// @route   PUT /api/users/reminders/:id
// @access  Private
const updateReminder = async (req, res) => {
  try {
    const { enabled, takenToday } = req.body;

    const user = await User.findById(req.user._id);
    const reminder = user.medicationReminders.id(req.params.id);

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Rappel non trouvé',
      });
    }

    if (enabled !== undefined) reminder.enabled = enabled;
    if (takenToday) reminder.takenToday = takenToday;

    await user.save();

    res.json({
      success: true,
      message: 'Rappel mis à jour',
      data: { reminders: user.medicationReminders },
    });
  } catch (error) {
    console.error('Update reminder error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du rappel',
    });
  }
};

// @desc    Delete medication reminder
// @route   DELETE /api/users/reminders/:id
// @access  Private
const deleteReminder = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    user.medicationReminders = user.medicationReminders.filter(
      r => r._id.toString() !== req.params.id
    );

    await user.save();

    res.json({
      success: true,
      message: 'Rappel supprimé',
      data: { reminders: user.medicationReminders },
    });
  } catch (error) {
    console.error('Delete reminder error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du rappel',
    });
  }
};

module.exports = {
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
};
