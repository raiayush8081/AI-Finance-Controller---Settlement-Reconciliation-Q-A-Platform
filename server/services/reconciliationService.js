const crypto = require('crypto');
const Payment = require('../models/payment');
const Settlement = require('../models/settlement');
const ReconciliationRun = require('../models/reconciliationRun');
const Exception = require('../models/exception');
const config = require('../config');

/**
 * Runs a deterministic reconciliation batch.
 * Returns a summary object.
 */
async function runReconciliation() {
  // 1️⃣ Load all records
  const payments = await Payment.find({}).lean();
  const settlements = await Settlement.find({}).lean();

  const totalPayments = payments.length;
  const totalSettlements = settlements.length;

  // Indexes for fast lookup
  // Create maps with a `matched` flag for each record
  const paymentMap = new Map(); // paymentId -> payment (with matched flag)
  const paymentsFlagged = payments.map(p => ({ ...p, matched: false }));
  paymentsFlagged.forEach(p => paymentMap.set(p.paymentId, p));

  const settlementMap = new Map(); // utr -> settlement (with matched flag)
  const settlementsFlagged = settlements.map(s => ({ ...s, matched: false }));
  settlementsFlagged.forEach(s => settlementMap.set(s.utr, s));

  // Helper to record exception
  const exceptions = [];

  // 2️⃣ Exact matches (linkedPaymentId present & amounts equal)
  // Exact matches based on linkedPaymentId and equal amount
  for (const settlement of settlementsFlagged) {
    if (settlement.linkedPaymentId) {
      const payment = paymentMap.get(settlement.linkedPaymentId);
      if (payment && !payment.matched && settlement.amount === payment.amount) {
        payment.matched = true;
        settlement.matched = true;
        continue;
      }
    }
  }

  // 3️⃣ Fuzzy matches (amount within tolerance & date window)
  const tolerance = config.amountTolerance; // e.g., 1.0
  const windowMs = config.matchWindowDays * 24 * 60 * 60 * 1000;

  // Fuzzy matches: amount within tolerance and settlement date within window
  for (const settlement of settlementsFlagged) {
    if (settlement.matched) continue;
    const candidates = paymentsFlagged.filter(p => !p.matched);
    for (const payment of candidates) {
      const amountDiff = Math.abs(settlement.amount - payment.amount);
      const dateDiff = Math.abs(new Date(settlement.settledOn) - new Date(payment.timestamp));
      if (amountDiff <= tolerance && dateDiff <= windowMs) {
        payment.matched = true;
        settlement.matched = true;
        break;
      }
    }
  }

  // 4️⃣ Record exceptions for everything left unmatched
  // Unmatched payments -> NO_COUNTERPART
  // Unmatched payments → NO_COUNTERPART exceptions
  for (const payment of paymentsFlagged) {
    if (!payment.matched) {
      exceptions.push({
        runId: null,
        paymentId: payment.paymentId,
        settlementId: null,
        reasonCode: 'NO_COUNTERPART',
        details: `Payment ${payment.paymentId} has no settlement`,
        amountAtRisk: payment.amount,
      });
    }
  }

  // Unmatched settlements – need to decide why
  // Unmatched settlements → determine specific reason
  for (const settlement of settlementsFlagged) {
    if (!settlement.matched) {
      let reason = 'NO_COUNTERPART';
      let details = `Settlement ${settlement.utr} has no matching payment`;
      let amountAtRisk = settlement.amount;

      if (settlement.linkedPaymentId) {
        const linkedPay = paymentMap.get(settlement.linkedPaymentId);
        if (linkedPay) {
          const amountDiff = Math.abs(settlement.amount - linkedPay.amount);
          if (amountDiff > tolerance) {
            reason = 'AMOUNT_MISMATCH';
            details = `Amount differs by ${amountDiff} for payment ${linkedPay.paymentId}`;
            amountAtRisk = amountDiff;
          } else {
            const dateDiff = Math.abs(new Date(settlement.settledOn) - new Date(linkedPay.timestamp));
            if (dateDiff > windowMs) {
              reason = 'DATE_OUT_OF_WINDOW';
              details = `Settlement date ${settlement.settledOn} is outside ${config.matchWindowDays}-day window for payment ${linkedPay.paymentId}`;
              amountAtRisk = linkedPay.amount;
            }
          }
        }
      }

      // Duplicate detection – check if another settlement already matched this payment
      if (settlement.linkedPaymentId) {
        const duplicate = settlementsFlagged.find(s => s.linkedPaymentId === settlement.linkedPaymentId && s.matched);
        if (duplicate) {
          reason = 'DUPLICATE_SETTLEMENT';
          details = `Multiple settlements linked to payment ${settlement.linkedPaymentId}`;
          amountAtRisk = settlement.amount;
        }
      }

      exceptions.push({
        runId: null,
        paymentId: settlement.linkedPaymentId || null,
        settlementId: settlement.utr,
        reasonCode: reason,
        details,
        amountAtRisk,
      });
    }
  }

  // 5️⃣ Persist run document and exceptions
  const runId = `run_${crypto.randomUUID()}`;
  const matchedCount = paymentsFlagged.filter(p => p.matched).length;
  const exceptionCount = exceptions.length;
  const matchRate = totalPayments ? (matchedCount / totalPayments) * 100 : 0;

  // Persist exceptions with the runId
  const exceptionDocs = exceptions.map(exc => ({ ...exc, runId }));
  await Exception.insertMany(exceptionDocs);

  // Compute total amount at risk and breakdown by reason code
  const totalAmountAtRisk = exceptionDocs.reduce((sum, cur) => sum + cur.amountAtRisk, 0);
  const amountAtRiskByReasonCode = exceptionDocs.reduce((acc, cur) => {
    acc[cur.reasonCode] = (acc[cur.reasonCode] || 0) + cur.amountAtRisk;
    return acc;
  }, {});

  const runDoc = new ReconciliationRun({
    runId,
    totalPayments,
    totalSettlements,
    matchedCount,
    exceptionCount,
    matchRate: Number(matchRate.toFixed(2)),
    totalAmountAtRisk,
    amountAtRiskByReasonCode,
  });
  await runDoc.save();

  const breakdown = exceptionDocs.reduce((acc, cur) => {
    acc[cur.reasonCode] = (acc[cur.reasonCode] || 0) + 1;
    return acc;
  }, {});

  return {
    runId,
    matchRate: Number(matchRate.toFixed(2)),
    totalPayments,
    totalSettlements,
    matchedCount,
    exceptionCount,
    exceptionBreakdown: breakdown,
    totalAmountAtRisk,
    amountAtRiskByReasonCode,
  };
}

module.exports = { runReconciliation };
