const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  paymentId: { type: String, required: true, unique: true },
  orderId: { type: String, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  timestamp: { type: Date, required: true },
  status: { type: String, enum: ['captured', 'failed', 'refunded'], required: true },
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
