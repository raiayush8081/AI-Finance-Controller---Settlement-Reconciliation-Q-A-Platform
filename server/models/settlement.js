const mongoose = require('mongoose');

const settlementSchema = new mongoose.Schema({
  utr: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  settledOn: { type: Date, required: true },
  linkedPaymentId: { type: String, default: null }, // nullable reference to Payment.paymentId
  bankRef: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Settlement', settlementSchema);
