require('dotenv').config();
const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const Payment = require('../models/payment');
const Settlement = require('../models/settlement');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/settlement_demo';

const MATCH_WINDOW_DAYS = parseInt(process.env.MATCH_WINDOW_DAYS) || 3;
const AMOUNT_TOLERANCE = parseFloat(process.env.AMOUNT_TOLERANCE) || 1.0;

async function connect() {
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('✅ Connected to MongoDB for seeding');
}

function randomCurrency() {
  return 'INR'; // keep simple
}

function randomStatus() {
  const statuses = ['captured', 'failed', 'refunded'];
  return statuses[Math.floor(Math.random() * statuses.length)];
}

async function clearCollections() {
  await Payment.deleteMany({});
  await Settlement.deleteMany({});
  console.log('🧹 Cleared existing collections');
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function generateData() {
  const payments = [];
  const settlements = [];
  const total = faker.number.int({ min: 50, max: 100 });

  // Helper to create a payment
  function createPayment(id) {
    return {
      paymentId: `pay_${id}`,
      orderId: `order_${faker.string.uuid()}`,
      amount: faker.number.int({ min: 100, max: 10000 }),
      currency: randomCurrency(),
      timestamp: faker.date.recent({ days: 30 }),
      status: 'captured',
    };
  }

  // Generate base payments
  for (let i = 0; i < total; i++) {
    payments.push(createPayment(i + 1));
  }

  // Now decide which ones will match cleanly, mismatch, no counterpart, date out of window, duplicate
  const cleanCount = Math.round(total * 0.87); // ~87% clean
  const amountMismatchCount = Math.round(total * 0.05);
  const noCounterpartCount = Math.round(total * 0.03);
  const dateOutCount = Math.round(total * 0.02);
  const duplicateCount = 2; // a couple of duplicates

  const shuffledIdx = faker.helpers.shuffle(Array.from(Array(total).keys()));
  let idx = 0;

  // Clean matches
  for (let i = 0; i < cleanCount; i++) {
    const pIdx = shuffledIdx[idx++];
    const payment = payments[pIdx];
    const settlement = {
      utr: `utr_${faker.string.uuid()}`,
      amount: payment.amount,
      settledOn: addDays(payment.timestamp, faker.number.int({ min: 1, max: 2 })),
      linkedPaymentId: payment.paymentId,
      bankRef: `bank_${faker.string.uuid()}`,
    };
    settlements.push(settlement);
  }

  // Amount mismatches
  for (let i = 0; i < amountMismatchCount; i++) {
    const pIdx = shuffledIdx[idx++];
    const payment = payments[pIdx];
    const delta = faker.number.int({ min: -5, max: 5 }); // small delta
    const settlement = {
      utr: `utr_${faker.string.uuid()}`,
      amount: payment.amount + delta,
      settledOn: addDays(payment.timestamp, faker.number.int({ min: 1, max: 2 })),
      linkedPaymentId: payment.paymentId,
      bankRef: `bank_${faker.string.uuid()}`,
    };
    settlements.push(settlement);
  }

  // No counterpart – some payments will have no settlement (skip) and some settlements will have no payment (create extra settlement)
  for (let i = 0; i < Math.floor(noCounterpartCount / 2); i++) {
    // payment without settlement – simply do nothing for this payment
    idx++;
  }
  for (let i = 0; i < Math.ceil(noCounterpartCount / 2); i++) {
    // settlement without payment – generate a random settlement not linked to any payment
    const settlement = {
      utr: `utr_${faker.string.uuid()}`,
      amount: faker.number.int({ min: 100, max: 10000 }),
      settledOn: faker.date.recent({ days: 30 }),
      linkedPaymentId: null,
      bankRef: `bank_${faker.string.uuid()}`,
    };
    settlements.push(settlement);
  }

  // Date out of window – match amount but settle > MATCH_WINDOW_DAYS later
  for (let i = 0; i < dateOutCount; i++) {
    const pIdx = shuffledIdx[idx++];
    const payment = payments[pIdx];
    const settlement = {
      utr: `utr_${faker.string.uuid()}`,
      amount: payment.amount,
      settledOn: addDays(payment.timestamp, MATCH_WINDOW_DAYS + faker.number.int({ min: 1, max: 3 })),
      linkedPaymentId: payment.paymentId,
      bankRef: `bank_${faker.string.uuid()}`,
    };
    settlements.push(settlement);
  }

  // Duplicate settlements – pick a random already matched payment and add another settlement with same amount
  const duplicateTargets = payments.slice(0, duplicateCount);
  duplicateTargets.forEach((pay) => {
    const settlement = {
      utr: `utr_${faker.string.uuid()}`,
      amount: pay.amount,
      settledOn: addDays(pay.timestamp, faker.number.int({ min: 1, max: 2 })),
      linkedPaymentId: pay.paymentId,
      bankRef: `bank_${faker.string.uuid()}`,
    };
    settlements.push(settlement);
  });

  // Insert into DB
  await Payment.insertMany(payments);
  await Settlement.insertMany(settlements);
  console.log(`✅ Seeded ${payments.length} payments and ${settlements.length} settlements`);
}

async function main() {
  try {
    await connect();
    await clearCollections();
    await generateData();
  } catch (err) {
    console.error('❌ Seeding error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  }
}

main();
