const mongoose = require('mongoose');

const promoCodeSchema = new mongoose.Schema({
  // Code
  code: { type: String, required: true, unique: true, uppercase: true },
  
  // Description
  description: { type: String, required: true },
  
  // Discount Type
  discountType: {
    type: String,
    enum: ['percentage', 'fixed_amount', 'free_delivery'],
    required: true,
  },
  
  // Discount Value
  discountValue: { type: Number, required: true },
  
  // Limits
  minOrderAmount: { type: Number, default: 0 },
  maxDiscountAmount: { type: Number },
  
  // Usage Limits
  maxUses: { type: Number }, // Total max uses
  maxUsesPerUser: { type: Number, default: 1 },
  currentUses: { type: Number, default: 0 },
  
  // Validity
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  
  // Applicability
  applicableTo: {
    type: String,
    enum: ['all', 'new_users', 'existing_users', 'specific_pharmacies', 'specific_categories'],
    default: 'all',
  },
  
  // Specific restrictions
  pharmacies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy' }],
  categories: [{ type: String }],
  excludedMedications: [{ type: mongoose.Schema.Types.ObjectId }],
  
  // Status
  isActive: { type: Boolean, default: true },
  
  // Usage History
  usageHistory: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    discountAmount: { type: Number },
    usedAt: { type: Date, default: Date.now },
  }],
  
}, { timestamps: true });

// Indexes
promoCodeSchema.index({ code: 1 });
promoCodeSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

// Method to check if code is valid
promoCodeSchema.methods.isValid = function(userId = null) {
  const now = new Date();
  
  // Check if active
  if (!this.isActive) return { valid: false, reason: 'Code promo inactif' };
  
  // Check dates
  if (now < this.startDate) return { valid: false, reason: 'Code promo non encore valide' };
  if (now > this.endDate) return { valid: false, reason: 'Code promo expiré' };
  
  // Check max uses
  if (this.maxUses && this.currentUses >= this.maxUses) {
    return { valid: false, reason: 'Code promo épuisé' };
  }
  
  // Check per-user limit
  if (userId) {
    const userUses = this.usageHistory.filter(u => u.user.toString() === userId.toString()).length;
    if (userUses >= this.maxUsesPerUser) {
      return { valid: false, reason: 'Vous avez déjà utilisé ce code' };
    }
  }
  
  return { valid: true };
};

// Method to calculate discount
promoCodeSchema.methods.calculateDiscount = function(orderAmount) {
  // Check minimum order amount
  if (orderAmount < this.minOrderAmount) {
    return {
      applicable: false,
      reason: `Montant minimum de commande: ${this.minOrderAmount} DH`,
    };
  }
  
  let discountAmount = 0;
  
  if (this.discountType === 'percentage') {
    discountAmount = (orderAmount * this.discountValue) / 100;
    if (this.maxDiscountAmount) {
      discountAmount = Math.min(discountAmount, this.maxDiscountAmount);
    }
  } else if (this.discountType === 'fixed_amount') {
    discountAmount = this.discountValue;
  } else if (this.discountType === 'free_delivery') {
    discountAmount = this.discountValue; // Should be the delivery fee
  }
  
  return {
    applicable: true,
    discountAmount: Math.round(discountAmount * 100) / 100,
    finalAmount: Math.round((orderAmount - discountAmount) * 100) / 100,
  };
};

// Method to apply code
promoCodeSchema.methods.apply = async function(userId, orderId, discountAmount) {
  this.usageHistory.push({
    user: userId,
    order: orderId,
    discountAmount,
  });
  this.currentUses += 1;
  await this.save();
};

module.exports = mongoose.model('PromoCode', promoCodeSchema);
