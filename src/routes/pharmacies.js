const express = require('express');
const router = express.Router();
const {
  getPharmacies,
  getPharmacy,
  getPharmacyMedications,
  createPharmacy,
  updatePharmacy,
  addMedication,
  updateMedication,
  getGuardPharmacies,
  addReview,
} = require('../controllers/pharmacyController');
const { authMiddleware, authorize } = require('../middleware/auth');
const { createPharmacyValidation, idParamValidation } = require('../middleware/validation');

// Public routes
router.get('/', getPharmacies);
router.get('/guard', getGuardPharmacies);
router.get('/:id', idParamValidation, getPharmacy);
router.get('/:id/medications', idParamValidation, getPharmacyMedications);

// Protected routes
router.use(authMiddleware);

router.post('/', authorize('pharmacist', 'admin'), createPharmacyValidation, createPharmacy);
router.put('/:id', authorize('pharmacist', 'admin'), idParamValidation, updatePharmacy);
router.post('/:id/medications', authorize('pharmacist', 'admin'), idParamValidation, addMedication);
router.put('/:id/medications/:medicationId', authorize('pharmacist', 'admin'), idParamValidation, updateMedication);
router.post('/:id/reviews', idParamValidation, addReview);

module.exports = router;
