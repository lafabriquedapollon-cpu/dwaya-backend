const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  medication: {
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    requiresPrescription: { type: Boolean, default: false },
  },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
});

const prescriptionSchema = new mongoose.Schema({
  url: { type: String, required: true },
  publicId: { type: String },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  pharmacistNotes: { type: String },
  uploadedAt: { type: Date, default: Date.now },
  validatedAt: { type: Date },
  validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

const deliveryTrackingSchema = new mongoose.Schema({
  status: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  location: {
    latitude: { type: Number },
    longitude: { type: Number },
  },
  notes: { type: String },
});

const orderSchema = new mongoose.Schema({
  // Order Info
  orderNumber: { type: String, unique: true },
  
  // Customer
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Pharmacy
  pharmacy: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', required: true },
  
  // Items
  items: [orderItemSchema],
  
  // Prescriptions (if required)
  prescriptions: [prescriptionSchema],
  
  // Pricing
  subtotal: { type: Number, required: true },
  deliveryFee: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  loyaltyPointsUsed: { type: Number, default: 0 },
  total: { type: Number, required: true },
  
  // Delivery Address
  deliveryAddress: {
    label: { type: String },
    street: { type: String, required: true },
    city: { type: String, required: true },
    zipCode: { type: String },
    coordinates: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
  },
  
  // Status
  status: {
    type: String,
    enum: [
      'pending',           // Order created, waiting for pharmacy
      'confirmed',         // Pharmacy accepted
      'preparing',         // Pharmacy preparing order
      'ready',             // Order ready for pickup
      'out_for_delivery',  // Driver picked up
      'delivered',         // Successfully delivered
      'cancelled',         // Cancelled
      'refunded',          // Refunded
    ],
    default: 'pending',
  },
  
  // Payment
  payment: {
    method: { 
      type: String, 
      enum: ['cash', 'card', 'cmi', 'paypal'],
      required: true 
    },
    status: { 
      type: String, 
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending' 
    },
    transactionId: { type: String },
    paidAt: { type: Date },
  },
  
  // Driver
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deliveryTracking: [deliveryTrackingSchema],
  estimatedDeliveryTime: { type: Date },
  actualDeliveryTime: { type: Date },
  
  // Timestamps
  confirmedAt: { type: Date },
  preparedAt: { type: Date },
  pickedUpAt: { type: Date },
  deliveredAt: { type: Date },
  cancelledAt: { type: Date },
  
  // Notes
  customerNotes: { type: String },
  pharmacyNotes: { type: String },
  
  // Review
  review: {
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String },
    createdAt: { type: Date },
  },
  
  // Loyalty Points Earned
  loyaltyPointsEarned: { type: Number, default: 0 },
  
}, { timestamps: true });

// Indexes
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ pharmacy: 1, status: 1 });
orderSchema.index({ driver: 1, status: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ orderNumber: 1 });

// Generate order number before saving
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const date = new Date();
    const prefix = 'DW';
    const timestamp = date.getTime().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    this.orderNumber = `${prefix}${timestamp}${random}`;
  }
  next();
});

// Calculate totals before saving
orderSchema.pre('save', function(next) {
  if (this.isModified('items') || this.isModified('deliveryFee') || this.isModified('discount')) {
    this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
    this.total = this.subtotal + this.deliveryFee - this.discount - this.loyaltyPointsUsed;
  }
  next();
});

// Method to update status
orderSchema.methods.updateStatus = async function(newStatus, notes = '') {
  const oldStatus = this.status;
  this.status = newStatus;
  
  const trackingEntry = {
    status: newStatus,
    notes,
  };
  
  if (this.driver && this.driver.driverInfo?.currentLocation) {
    trackingEntry.location = this.driver.driverInfo.currentLocation;
  }
  
  this.deliveryTracking.push(trackingEntry);
  
  // Update timestamps based on status
  const now = new Date();
  switch (newStatus) {
    case 'confirmed':
      this.confirmedAt = now;
      break;
    case 'ready':
      this.preparedAt = now;
      break;
    case 'out_for_delivery':
      this.pickedUpAt = now;
      break;
    case 'delivered':
      this.deliveredAt = now;
      this.actualDeliveryTime = now;
      break;
    case 'cancelled':
      this.cancelledAt = now;
      break;
  }
  
  await this.save();
  return { oldStatus, newStatus };
};

// Method to check if order requires prescription
orderSchema.methods.requiresPrescription = function() {
  return this.items.some(item => item.medication.requiresPrescription);
};

// Method to get order summary
orderSchema.methods.getSummary = function() {
  return {
    id: this._id,
    orderNumber: this.orderNumber,
    status: this.status,
    total: this.total,
    itemCount: this.items.length,
    createdAt: this.createdAt,
    estimatedDeliveryTime: this.estimatedDeliveryTime,
  };
};

module.exports = mongoose.model('Order', orderSchema);
