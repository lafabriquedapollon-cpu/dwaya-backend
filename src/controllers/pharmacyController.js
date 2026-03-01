const { Pharmacy, User } = require('../models');

// @desc    Get all pharmacies
// @route   GET /api/pharmacies
// @access  Public
const getPharmacies = async (req, res) => {
  try {
    const { 
      city, 
      isOpen, 
      isGuard, 
      lat, 
      lng, 
      radius = 10,
      page = 1, 
      limit = 20,
      search,
    } = req.query;

    const query = { isActive: true, isVerified: true };

    if (city) query['address.city'] = new RegExp(city, 'i');
    if (isOpen === 'true') query.isOpen = true;
    if (isGuard === 'true') query.isGuard = true;
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { 'address.street': new RegExp(search, 'i') },
      ];
    }

    let pharmaciesQuery = Pharmacy.find(query);

    // Geospatial query if coordinates provided
    if (lat && lng) {
      pharmaciesQuery = pharmaciesQuery.where('address.coordinates').near({
        center: {
          type: 'Point',
          coordinates: [parseFloat(lng), parseFloat(lat)],
        },
        maxDistance: radius * 1000, // Convert km to meters
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const pharmacies = await pharmaciesQuery
      .skip(skip)
      .limit(parseInt(limit))
      .select('-medications -reviews')
      .sort({ rating: -1 });

    const total = await Pharmacy.countDocuments(query);

    res.json({
      success: true,
      data: {
        pharmacies,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get pharmacies error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des pharmacies',
    });
  }
};

// @desc    Get pharmacy by ID
// @route   GET /api/pharmacies/:id
// @access  Public
const getPharmacy = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id)
      .populate('owner', 'firstName lastName')
      .populate('reviews.user', 'firstName lastName avatar');

    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacie non trouvée',
      });
    }

    // Update isOpen status
    pharmacy.isOpen = pharmacy.isCurrentlyOpen();

    res.json({
      success: true,
      data: { pharmacy },
    });
  } catch (error) {
    console.error('Get pharmacy error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la pharmacie',
    });
  }
};

// @desc    Get pharmacy medications
// @route   GET /api/pharmacies/:id/medications
// @access  Public
const getPharmacyMedications = async (req, res) => {
  try {
    const { category, search, page = 1, limit = 20 } = req.query;

    const pharmacy = await Pharmacy.findById(req.params.id);

    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacie non trouvée',
      });
    }

    let medications = pharmacy.medications.filter(m => m.isActive);

    if (category) {
      medications = medications.filter(m => m.category === category);
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      medications = medications.filter(m => 
        searchRegex.test(m.name) || 
        searchRegex.test(m.description)
      );
    }

    const total = medications.length;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    medications = medications.slice(skip, skip + parseInt(limit));

    res.json({
      success: true,
      data: {
        medications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get medications error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des médicaments',
    });
  }
};

// @desc    Create pharmacy
// @route   POST /api/pharmacies
// @access  Private (Pharmacist only)
const createPharmacy = async (req, res) => {
  try {
    const pharmacyData = {
      ...req.body,
      owner: req.user._id,
    };

    const pharmacy = await Pharmacy.create(pharmacyData);

    // Update user's pharmacy reference
    await User.findByIdAndUpdate(req.user._id, {
      role: 'pharmacist',
      pharmacy: pharmacy._id,
    });

    res.status(201).json({
      success: true,
      message: 'Pharmacie créée avec succès',
      data: { pharmacy },
    });
  } catch (error) {
    console.error('Create pharmacy error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la pharmacie',
    });
  }
};

// @desc    Update pharmacy
// @route   PUT /api/pharmacies/:id
// @access  Private (Owner only)
const updatePharmacy = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);

    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacie non trouvée',
      });
    }

    // Check ownership
    if (pharmacy.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé',
      });
    }

    const updatedPharmacy = await Pharmacy.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Pharmacie mise à jour',
      data: { pharmacy: updatedPharmacy },
    });
  } catch (error) {
    console.error('Update pharmacy error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la pharmacie',
    });
  }
};

// @desc    Add medication to pharmacy
// @route   POST /api/pharmacies/:id/medications
// @access  Private (Owner only)
const addMedication = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);

    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacie non trouvée',
      });
    }

    if (pharmacy.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé',
      });
    }

    pharmacy.medications.push(req.body);
    await pharmacy.save();

    res.status(201).json({
      success: true,
      message: 'Médicament ajouté',
      data: { medication: pharmacy.medications[pharmacy.medications.length - 1] },
    });
  } catch (error) {
    console.error('Add medication error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'ajout du médicament',
    });
  }
};

// @desc    Update medication
// @route   PUT /api/pharmacies/:id/medications/:medicationId
// @access  Private (Owner only)
const updateMedication = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);

    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacie non trouvée',
      });
    }

    if (pharmacy.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé',
      });
    }

    const medication = pharmacy.medications.id(req.params.medicationId);

    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Médicament non trouvé',
      });
    }

    Object.assign(medication, req.body);
    await pharmacy.save();

    res.json({
      success: true,
      message: 'Médicament mis à jour',
      data: { medication },
    });
  } catch (error) {
    console.error('Update medication error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du médicament',
    });
  }
};

// @desc    Get guard pharmacies
// @route   GET /api/pharmacies/guard
// @access  Public
const getGuardPharmacies = async (req, res) => {
  try {
    const { city, lat, lng, radius = 20 } = req.query;

    const query = { 
      isActive: true, 
      isVerified: true, 
      isGuard: true,
    };

    if (city) query['address.city'] = new RegExp(city, 'i');

    let pharmaciesQuery = Pharmacy.find(query).select('-medications -reviews');

    // Sort by distance if coordinates provided
    if (lat && lng) {
      pharmaciesQuery = pharmaciesQuery.where('address.coordinates').near({
        center: {
          type: 'Point',
          coordinates: [parseFloat(lng), parseFloat(lat)],
        },
        maxDistance: radius * 1000,
      });
    }

    const pharmacies = await pharmaciesQuery;

    res.json({
      success: true,
      data: { pharmacies },
    });
  } catch (error) {
    console.error('Get guard pharmacies error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des pharmacies de garde',
    });
  }
};

// @desc    Add review to pharmacy
// @route   POST /api/pharmacies/:id/reviews
// @access  Private
const addReview = async (req, res) => {
  try {
    const { rating, comment, orderId } = req.body;

    const pharmacy = await Pharmacy.findById(req.params.id);

    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacie non trouvée',
      });
    }

    // Check if user already reviewed
    const existingReview = pharmacy.reviews.find(
      r => r.user.toString() === req.user._id.toString()
    );

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'Vous avez déjà évalué cette pharmacie',
      });
    }

    pharmacy.reviews.push({
      user: req.user._id,
      rating,
      comment,
      order: orderId,
    });

    await pharmacy.updateRating();

    res.status(201).json({
      success: true,
      message: 'Avis ajouté avec succès',
      data: { review: pharmacy.reviews[pharmacy.reviews.length - 1] },
    });
  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'ajout de l\'avis',
    });
  }
};

module.exports = {
  getPharmacies,
  getPharmacy,
  getPharmacyMedications,
  createPharmacy,
  updatePharmacy,
  addMedication,
  updateMedication,
  getGuardPharmacies,
  addReview,
};
