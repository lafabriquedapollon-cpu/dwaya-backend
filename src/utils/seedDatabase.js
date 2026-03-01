require('dotenv').config();

const mongoose = require('mongoose');
const { User, Pharmacy, Order, PromoCode } = require('../models');
const connectDB = require('../config/database');

const seedDatabase = async () => {
  try {
    await connectDB();

    console.log('🌱 Seeding database...');

    // Clear existing data
    await User.deleteMany({});
    await Pharmacy.deleteMany({});
    await Order.deleteMany({});
    await PromoCode.deleteMany({});

    console.log('✅ Existing data cleared');

    // Create admin user
    const admin = await User.create({
      firstName: 'Admin',
      lastName: 'Dwaya',
      email: 'admin@dwaya.ma',
      phone: '0612345678',
      password: 'Admin123!',
      role: 'admin',
      isVerified: true,
    });

    console.log('✅ Admin user created');

    // Create customer
    const customer = await User.create({
      firstName: 'Karim',
      lastName: 'Benani',
      email: 'karim@example.com',
      phone: '0623456789',
      password: 'Password123!',
      role: 'customer',
      isVerified: true,
      addresses: [{
        label: 'Domicile',
        street: '123 Boulevard Mohammed V',
        city: 'Casablanca',
        zipCode: '20000',
        coordinates: { latitude: 33.5731, longitude: -7.5898 },
        isDefault: true,
      }],
      loyaltyPoints: 150,
    });

    console.log('✅ Customer user created');

    // Create pharmacist
    const pharmacist = await User.create({
      firstName: 'Dr. Fatima',
      lastName: 'Amrani',
      email: 'pharmacie@example.com',
      phone: '0634567890',
      password: 'Password123!',
      role: 'pharmacist',
      isVerified: true,
    });

    console.log('✅ Pharmacist user created');

    // Create driver
    const driver = await User.create({
      firstName: 'Youssef',
      lastName: 'El Fassi',
      email: 'driver@example.com',
      phone: '0645678901',
      password: 'Password123!',
      role: 'driver',
      isVerified: true,
      driverInfo: {
        licenseNumber: 'DR123456',
        vehicleType: 'Scooter',
        vehiclePlate: '12345-A-6',
        isAvailable: true,
      },
    });

    console.log('✅ Driver user created');

    // Create pharmacy
    const pharmacy = await Pharmacy.create({
      name: 'Pharmacie Centrale',
      description: 'Votre pharmacie de confiance au centre-ville',
      email: 'contact@pharmacie-centrale.ma',
      phone: '0522123456',
      address: {
        street: '45 Boulevard Mohammed V',
        city: 'Casablanca',
        zipCode: '20000',
        coordinates: { latitude: 33.5731, longitude: -7.5898 },
      },
      schedule: [
        { day: 'monday', open: '08:00', close: '20:00', isClosed: false },
        { day: 'tuesday', open: '08:00', close: '20:00', isClosed: false },
        { day: 'wednesday', open: '08:00', close: '20:00', isClosed: false },
        { day: 'thursday', open: '08:00', close: '20:00', isClosed: false },
        { day: 'friday', open: '08:00', close: '20:00', isClosed: false },
        { day: 'saturday', open: '09:00', close: '18:00', isClosed: false },
        { day: 'sunday', open: '09:00', close: '12:00', isClosed: false },
      ],
      isOpen: true,
      isActive: true,
      isVerified: true,
      owner: pharmacist._id,
      medications: [
        {
          name: 'Doliprane 1000mg',
          description: 'Paracétamol - Analgésique et antipyrétique',
          category: 'Douleur',
          price: 35.50,
          quantity: 100,
          unit: 'comprimé',
          dosage: '1 comprimé',
          requiresPrescription: false,
          isActive: true,
          tags: ['douleur', 'fièvre', 'paracétamol'],
        },
        {
          name: 'Advil 400mg',
          description: 'Ibuprofène - Anti-inflammatoire',
          category: 'Douleur',
          price: 42.00,
          quantity: 80,
          unit: 'comprimé',
          dosage: '1 comprimé',
          requiresPrescription: false,
          isActive: true,
          tags: ['douleur', 'inflammation', 'ibuprofène'],
        },
        {
          name: 'Vitamin C 500mg',
          description: 'Complément alimentaire',
          category: 'Vitamines',
          price: 28.00,
          quantity: 50,
          unit: 'comprimé',
          requiresPrescription: false,
          isActive: true,
          tags: ['vitamine', 'immunité'],
        },
        {
          name: 'Amoxicilline 1g',
          description: 'Antibiotique',
          category: 'Antibiotiques',
          price: 65.00,
          quantity: 30,
          unit: 'comprimé',
          dosage: '3 fois par jour',
          requiresPrescription: true,
          isActive: true,
          tags: ['antibiotique', 'infection'],
        },
        {
          name: 'Oméga 3',
          description: 'Huile de poisson - Complément cardiovasculaire',
          category: 'Compléments',
          price: 85.00,
          quantity: 40,
          unit: 'capsule',
          requiresPrescription: false,
          isActive: true,
          tags: ['oméga3', 'coeur', 'mémoire'],
        },
      ],
      rating: 4.8,
      reviewCount: 124,
      deliverySettings: {
        isAvailable: true,
        deliveryFee: 20,
        freeDeliveryThreshold: 200,
        minOrderAmount: 50,
        maxDeliveryDistance: 10,
        estimatedDeliveryTime: 30,
      },
    });

    // Update pharmacist with pharmacy reference
    pharmacist.pharmacy = pharmacy._id;
    await pharmacist.save();

    console.log('✅ Pharmacy created');

    // Create promo codes
    await PromoCode.create({
      code: 'BIENVENUE',
      description: '10% de réduction sur votre première commande',
      discountType: 'percentage',
      discountValue: 10,
      maxDiscountAmount: 50,
      maxUses: 1000,
      maxUsesPerUser: 1,
      startDate: new Date(),
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      applicableTo: 'new_users',
    });

    await PromoCode.create({
      code: 'LIVRAISON',
      description: 'Livraison gratuite',
      discountType: 'free_delivery',
      discountValue: 20,
      minOrderAmount: 100,
      maxUses: 500,
      maxUsesPerUser: 3,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      applicableTo: 'all',
    });

    console.log('✅ Promo codes created');

    // Create a sample order
    const order = await Order.create({
      customer: customer._id,
      pharmacy: pharmacy._id,
      items: [
        {
          medication: {
            id: pharmacy.medications[0]._id,
            name: pharmacy.medications[0].name,
            price: pharmacy.medications[0].price,
            requiresPrescription: pharmacy.medications[0].requiresPrescription,
          },
          quantity: 2,
          unitPrice: pharmacy.medications[0].price,
          totalPrice: pharmacy.medications[0].price * 2,
        },
      ],
      deliveryAddress: customer.addresses[0],
      payment: {
        method: 'cash',
        status: 'pending',
      },
      subtotal: 71.00,
      deliveryFee: 20,
      discount: 0,
      total: 91.00,
      status: 'pending',
    });

    console.log('✅ Sample order created');

    console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   🎉 DATABASE SEEDED SUCCESSFULLY!                       ║
║                                                          ║
║   Created:                                               ║
║   • 1 Admin user (admin@dwaya.ma)                        ║
║   • 1 Customer (karim@example.com)                       ║
║   • 1 Pharmacist (pharmacie@example.com)                 ║
║   • 1 Driver (driver@example.com)                        ║
║   • 1 Pharmacy with 5 medications                        ║
║   • 2 Promo codes                                        ║
║   • 1 Sample order                                       ║
║                                                          ║
║   Default password for all users: Password123!           ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
    `);

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
};

seedDatabase();
