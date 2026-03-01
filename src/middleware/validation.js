const { body, param, query, validationResult } = require('express-validator');

// Helper to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  next();
};

// Auth validations
const registerValidation = [
  body('firstName')
    .trim()
    .notEmpty().withMessage('Le prénom est requis')
    .isLength({ min: 2, max: 50 }).withMessage('Le prénom doit contenir entre 2 et 50 caractères'),
  body('lastName')
    .trim()
    .notEmpty().withMessage('Le nom est requis')
    .isLength({ min: 2, max: 50 }).withMessage('Le nom doit contenir entre 2 et 50 caractères'),
  body('email')
    .trim()
    .notEmpty().withMessage('L\'email est requis')
    .isEmail().withMessage('Email invalide')
    .normalizeEmail(),
  body('phone')
    .trim()
    .notEmpty().withMessage('Le téléphone est requis')
    .matches(/^0[5-7]\d{8}$/).withMessage('Numéro de téléphone marocain invalide (ex: 0612345678)'),
  body('password')
    .notEmpty().withMessage('Le mot de passe est requis')
    .isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre'),
  handleValidationErrors,
];

const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('L\'email est requis')
    .isEmail().withMessage('Email invalide'),
  body('password')
    .notEmpty().withMessage('Le mot de passe est requis'),
  handleValidationErrors,
];

// Pharmacy validations
const createPharmacyValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Le nom de la pharmacie est requis')
    .isLength({ min: 3, max: 100 }),
  body('email')
    .trim()
    .notEmpty().withMessage('L\'email est requis')
    .isEmail().withMessage('Email invalide'),
  body('phone')
    .trim()
    .notEmpty().withMessage('Le téléphone est requis'),
  body('address.street')
    .trim()
    .notEmpty().withMessage('L\'adresse est requise'),
  body('address.city')
    .trim()
    .notEmpty().withMessage('La ville est requise'),
  body('address.coordinates.latitude')
    .notEmpty().withMessage('La latitude est requise')
    .isFloat({ min: -90, max: 90 }).withMessage('Latitude invalide'),
  body('address.coordinates.longitude')
    .notEmpty().withMessage('La longitude est requise')
    .isFloat({ min: -180, max: 180 }).withMessage('Longitude invalide'),
  handleValidationErrors,
];

// Order validations
const createOrderValidation = [
  body('pharmacy')
    .notEmpty().withMessage('L\'ID de la pharmacie est requis')
    .isMongoId().withMessage('ID de pharmacie invalide'),
  body('items')
    .isArray({ min: 1 }).withMessage('La commande doit contenir au moins un article'),
  body('items.*.medication.id')
    .notEmpty().withMessage('L\'ID du médicament est requis'),
  body('items.*.quantity')
    .isInt({ min: 1 }).withMessage('La quantité doit être au moins 1'),
  body('deliveryAddress.street')
    .trim()
    .notEmpty().withMessage('L\'adresse de livraison est requise'),
  body('deliveryAddress.city')
    .trim()
    .notEmpty().withMessage('La ville de livraison est requise'),
  body('payment.method')
    .notEmpty().withMessage('La méthode de paiement est requise')
    .isIn(['cash', 'card', 'cmi', 'paypal']).withMessage('Méthode de paiement invalide'),
  handleValidationErrors,
];

// Chat validations
const sendMessageValidation = [
  body('content')
    .trim()
    .notEmpty().withMessage('Le message ne peut pas être vide')
    .isLength({ max: 2000 }).withMessage('Le message ne peut pas dépasser 2000 caractères'),
  handleValidationErrors,
];

// Pagination validation
const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('La page doit être un nombre positif'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('La limite doit être entre 1 et 100'),
  handleValidationErrors,
];

// ID param validation
const idParamValidation = [
  param('id')
    .isMongoId().withMessage('ID invalide'),
  handleValidationErrors,
];

module.exports = {
  registerValidation,
  loginValidation,
  createPharmacyValidation,
  createOrderValidation,
  sendMessageValidation,
  paginationValidation,
  idParamValidation,
  handleValidationErrors,
};
