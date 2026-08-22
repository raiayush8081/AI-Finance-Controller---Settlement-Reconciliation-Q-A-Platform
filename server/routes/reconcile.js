const express = require('express');
const router = express.Router();
const { runReconciliation } = require('../services/reconciliationService');

// POST /api/reconcile/run
router.post('/run', async (req, res) => {
  try {
    const result = await runReconciliation();
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Reconciliation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
