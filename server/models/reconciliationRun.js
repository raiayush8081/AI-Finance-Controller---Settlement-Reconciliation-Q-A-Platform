const mongoose = require('mongoose');

const reconciliationRunSchema = new mongoose.Schema({
  runId: { type: String, required: true, unique: true },
  timestamp: { type: Date, default: Date.now },
  totalPayments: { type: Number, required: true },
  totalSettlements: { type: Number, required: true },
  matchedCount: { type: Number, required: true },
  exceptionCount: { type: Number, required: true },
  matchRate: { type: Number, required: true }, // percentage (0-100)
}, { timestamps: true });

module.exports = mongoose.model('ReconciliationRun', reconciliationRunSchema);
