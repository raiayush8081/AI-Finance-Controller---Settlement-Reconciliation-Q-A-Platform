const mongoose = require('mongoose');

const exceptionSchema = new mongoose.Schema({
  runId: { type: String, required: true, index: true },
  paymentId: { type: String, default: null },
  settlementId: { type: String, default: null },
  reasonCode: {
    type: String,
    enum: ['AMOUNT_MISMATCH', 'NO_COUNTERPART', 'DATE_OUT_OF_WINDOW', 'DUPLICATE_SETTLEMENT'],
    required: true,
  },
  details: { type: String },
  amountAtRisk: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Exception', exceptionSchema);
