const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const addressSchema = new mongoose.Schema({
  label: { type: String, default: 'Domicile' },
  street: { type: String, required: true },
  city: { type: String, required: true },
  zipCode: { type: String },
  coordinates: {
    latitude: { type: Number },
    longitude: { type: Number },
  },
  isDefault: { type: Boolean, default: false },
});

const healthInfoSchema = new mongoose.Schema({
  bloodType: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
  allergies: [{
    name: { type: String, required: true },
    severity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  }],
  medicalHistory: [{
    type: { type: String, enum: ['prescription', 'exam', 'vaccine', 'consultation'] },
    title: { type: String, required: true },
    date: { type: Date, required: true },
    doctor: { type: String },
    notes: { type: String },
    files: [{ url: String, name: String }],
  }],
  doctors: [{
    name: { type: String, required: true },
    specialty: { type: String },
    phone: { type: String },
    city: { type: String },
  }],
  emergencyContact: {
    name: { type: String },
    phone: { type: String },
    relation: { type: String },
  },
});

const medicationReminderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  dosage: { type: String, required: true },
  frequency: { type: String, required: true },
  times: [{ type: String }],
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  enabled: { type: Boolean, default: true },
  color: { type: String, default: '#0f7d69' },
  createdAt: { type: Date, default: Date.now },
});

const userSchema = new mongoose.Schema({
  // Basic Info
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true, minlength: 6 },
  
  // Profile
  avatar: { type: String },
  dateOfBirth: { type: Date },
  gender: { type: String, enum: ['male', 'female', 'other'] },
  
  // Role & Status
  role: { 
    type: String, 
    enum: ['customer', 'pharmacist', 'driver', 'admin'], 
    default: 'customer' 
  },
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  
  // Addresses
  addresses: [addressSchema],
  
  // Health Information (for customers)
  healthInfo: healthInfoSchema,
  medicationReminders: [medicationReminderSchema],
  
  // Loyalty Program
  loyaltyPoints: { type: Number, default: 0 },
  referralCode: { type: String, unique: true, sparse: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  
  // Push Notifications
  pushTokens: [{ type: String }],
  notificationSettings: {
    orderUpdates: { type: Boolean, default: true },
    promotions: { type: Boolean, default: true },
    medicationReminders: { type: Boolean, default: true },
    chatMessages: { type: Boolean, default: true },
  },
  
  // For pharmacists
  pharmacy: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy' },
  
  // For drivers
  driverInfo: {
    licenseNumber: { type: String },
    vehicleType: { type: String },
    vehiclePlate: { type: String },
    isAvailable: { type: Boolean, default: false },
    currentLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
      updatedAt: { type: Date },
    },
  },
  
  // Timestamps
  lastLogin: { type: Date },
}, { timestamps: true });

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ role: 1 });
userSchema.index({ referralCode: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate referral code
userSchema.pre('save', function(next) {
  if (!this.referralCode && this.isNew) {
    this.referralCode = `DWAYA${this._id.toString().slice(-6).toUpperCase()}`;
  }
  next();
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Method to get public profile
userSchema.methods.toPublicProfile = function() {
  return {
    id: this._id,
    firstName: this.firstName,
    lastName: this.lastName,
    email: this.email,
    phone: this.phone,
    avatar: this.avatar,
    role: this.role,
    loyaltyPoints: this.loyaltyPoints,
    referralCode: this.referralCode,
  };
};

module.exports = mongoose.model('User', userSchema);
