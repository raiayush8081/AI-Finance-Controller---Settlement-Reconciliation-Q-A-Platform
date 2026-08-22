// test_runner.js – Runs automated test suite to verify the reconciliation engine and QA fallback
require('dotenv').config();
const mongoose = require('mongoose');
const Payment = require('./models/payment');
const Settlement = require('./models/settlement');
const ReconciliationRun = require('./models/reconciliationRun');
const Exception = require('./models/exception');
const { runReconciliation } = require('./services/reconciliationService');
const { handleQuestion } = require('./services/qaService');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/settlement_demo';

async function runTests() {
  console.log('🧪 Starting Automated Test Suite for Reconciliation & Q&A Agent...');
  
  // Connect to DB
  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }

  let failedTests = 0;
  
  // Test Case 1: Seed data check
  console.log('\n--- Test Case 1: Data Model Seed Verification ---');
  try {
    const paymentCount = await Payment.countDocuments();
    const settlementCount = await Settlement.countDocuments();
    console.log(`- Payments in DB: ${paymentCount}`);
    console.log(`- Settlements in DB: ${settlementCount}`);
    if (paymentCount >= 50 && settlementCount >= 50) {
      console.log('✅ Test Case 1 Passed: Database seeded correctly.');
    } else {
      console.error('❌ Test Case 1 Failed: Seed data count is too low.');
      failedTests++;
    }
  } catch (err) {
    console.error('❌ Test Case 1 Failed with error:', err.message);
    failedTests++;
  }

  // Test Case 2: Reconciliation engine execution
  console.log('\n--- Test Case 2: Reconciliation Engine Execution ---');
  let runSummary = null;
  try {
    runSummary = await runReconciliation();
    console.log(`- Run ID: ${runSummary.runId}`);
    console.log(`- Match Rate: ${runSummary.matchRate}%`);
    console.log(`- Matched Count: ${runSummary.matchedCount}`);
    console.log(`- Exceptions Count: ${runSummary.exceptionCount}`);
    console.log('- Exception Breakdown:', runSummary.exceptionBreakdown);

    if (runSummary.runId && runSummary.matchRate >= 70 && runSummary.matchRate <= 95) {
      console.log('✅ Test Case 2 Passed: Reconciliation executed successfully within target match rates.');
    } else {
      console.error('❌ Test Case 2 Failed: Match rate or data outside acceptable range.');
      failedTests++;
    }
  } catch (err) {
    console.error('❌ Test Case 2 Failed with error:', err.message);
    failedTests++;
  }

  // Test Case 3: Exception categorization verification
  console.log('\n--- Test Case 3: Exception Categorization & Reason Codes ---');
  try {
    const exceptions = await Exception.find({ runId: runSummary.runId });
    const amountMismatches = exceptions.filter(e => e.reasonCode === 'AMOUNT_MISMATCH');
    const duplicates = exceptions.filter(e => e.reasonCode === 'DUPLICATE_SETTLEMENT');
    const noCounterparts = exceptions.filter(e => e.reasonCode === 'NO_COUNTERPART');
    const dateOutWindows = exceptions.filter(e => e.reasonCode === 'DATE_OUT_OF_WINDOW');

    console.log(`- AMOUNT_MISMATCH exceptions: ${amountMismatches.length}`);
    console.log(`- DUPLICATE_SETTLEMENT exceptions: ${duplicates.length}`);
    console.log(`- NO_COUNTERPART exceptions: ${noCounterparts.length}`);
    console.log(`- DATE_OUT_OF_WINDOW exceptions: ${dateOutWindows.length}`);

    // Verify reason codes are mapped
    if (exceptions.length > 0 && noCounterparts.length > 0) {
      console.log('✅ Test Case 3 Passed: Reason codes verified.');
    } else {
      console.error('❌ Test Case 3 Failed: Exception mapping error.');
      failedTests++;
    }
  } catch (err) {
    console.error('❌ Test Case 3 Failed with error:', err.message);
    failedTests++;
  }

  // Test Case 4: Q&A engine fallback execution
  console.log('\n--- Test Case 4: Q&A Fallback Logic Execution ---');
  try {
    const q1 = "What is our current match rate?";
    const ans1 = await handleQuestion(q1);
    console.log(`- Question: "${q1}"`);
    console.log(`- Answer:\n${ans1.answer}`);

    const q2 = "List all amount mismatches";
    const ans2 = await handleQuestion(q2);
    console.log(`- Question: "${q2}"`);
    console.log(`- Answer:\n${ans2.answer}`);

    if (ans1.answer && ans2.answer) {
      console.log('✅ Test Case 4 Passed: QA engine handled queries successfully.');
    } else {
      console.error('❌ Test Case 4 Failed: QA engine returned empty response.');
      failedTests++;
    }
  } catch (err) {
    console.error('❌ Test Case 4 Failed with error:', err.message);
    failedTests++;
  }

  // Summary
  console.log('\n=======================================');
  if (failedTests === 0) {
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! No glitches detected.');
  } else {
    console.error(`⚠️ TEST RUN COMPLETE. ${failedTests} test case(s) failed.`);
  }
  console.log('=======================================');

  await mongoose.disconnect();
}

runTests();
