const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  day: { 
    type: String, 
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    required: true 
  },
  open: { type: String, required: true },
  close: { type: String, required: true },
  isClosed: { type: Boolean, default: false },
});

const medicationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  genericName: { type: String },
  description: { type: String },
  category: { type: String, required: true },
  subcategory: { type: String },
  price: { type: Number, required: true, min: 0 },
  comparePrice: { type: Number },
  quantity: { type: Number, default: 0 },
  unit: { type: String, default: 'unit' },
  dosage: { type: String },
  requiresPrescription: { type: Boolean, default: false },
  images: [{ type: String }],
  isActive: { type: Boolean, default: true },
  barcode: { type: String },
  cipCode: { type: String },
  manufacturer: { type: String },
  tags: [{ type: String }],
}, { timestamps: true });

const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  createdAt: { type: Date, default: Date.now },
});

const pharmacySchema = new mongoose.Schema({
  // Basic Info
  name: { type: String, required: true, trim: true },
  description: { type: String },
  
  // Contact
  email: { type: String, required: true },
  phone: { type: String, required: true },
  alternatePhone: { type: String },
  
  // Address
  address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    zipCode: { type: String },
    coordinates: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
  },
  
  // Schedule
  schedule: [scheduleSchema],
  isGuard: { type: Boolean, default: false },
  guardSchedule: {
    startDate: { type: Date },
    endDate: { type: Date },
  },
  
  // Status
  isOpen: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  
  // Owner & Staff
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pharmacists: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  
  // Inventory
  medications: [medicationSchema],
  
  // Ratings & Reviews
  rating: { type: Number, default: 0, min: 0, max: 5 },
  reviewCount: { type: Number, default: 0 },
  reviews: [reviewSchema],
  
  // Delivery Settings
  deliverySettings: {
    isAvailable: { type: Boolean, default: true },
    deliveryFee: { type: Number, default: 20 },
    freeDeliveryThreshold: { type: Number, default: 200 },
    minOrderAmount: { type: Number, default: 50 },
    maxDeliveryDistance: { type: Number, default: 10 }, // km
    estimatedDeliveryTime: { type: Number, default: 30 }, // minutes
  },
  
  // Financial
  commissionRate: { type: Number, default: 15 }, // percentage
  bankInfo: {
    accountName: { type: String },
    accountNumber: { type: String },
    bankName: { type: String },
    rib: { type: String },
  },
  
  // Documents
  documents: {
    pharmacyLicense: { type: String },
    professionalInsurance: { type: String },
    identityDocument: { type: String },
  },
  
  // Statistics
  stats: {
    totalOrders: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    totalCommission: { type: Number, default: 0 },
  },
  
  // Timestamps
  subscriptionExpiresAt: { type: Date },
}, { timestamps: true });

// Indexes
pharmacySchema.index({ 'address.coordinates': '2dsphere' });
pharmacySchema.index({ city: 1 });
pharmacySchema.index({ isActive: 1, isVerified: 1 });
pharmacySchema.index({ isGuard: 1 });
pharmacySchema.index({ 'medications.name': 'text', 'medications.description': 'text' });

// Virtual for full address
pharmacySchema.virtual('fullAddress').get(function() {
  return `${this.address.street}, ${this.address.city}`;
});

// Method to check if pharmacy is currently open
pharmacySchema.methods.isCurrentlyOpen = function() {
  const now = new Date();
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = days[now.getDay()];
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  const todaySchedule = this.schedule.find(s => s.day === currentDay);
  if (!todaySchedule || todaySchedule.isClosed) return false;
  
  return currentTime >= todaySchedule.open && currentTime <= todaySchedule.close;
};

// Method to update rating
pharmacySchema.methods.updateRating = async function() {
  const reviews = this.reviews;
  if (reviews.length === 0) {
    this.rating = 0;
    this.reviewCount = 0;
  } else {
    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    this.rating = Math.round((sum / reviews.length) * 10) / 10;
    this.reviewCount = reviews.length;
  }
  await this.save();
};

module.exports = mongoose.model('Pharmacy', pharmacySchema);
