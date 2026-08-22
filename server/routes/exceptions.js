const express = require('express');
const router = express.Router();
const Exception = require('../models/exception');
const ReconciliationRun = require('../models/reconciliationRun');

// GET /api/exceptions?runId=xxx – if runId omitted, use latest run
router.get('/', async (req, res) => {
  try {
    let { runId } = req.query;
    if (!runId) {
      const latestRun = await ReconciliationRun.findOne({}).sort({ timestamp: -1 }).lean();
      if (!latestRun) return res.json({ success: true, data: [] });
      runId = latestRun.runId;
    }
    const exceptions = await Exception.find({ runId }).lean();
    res.json({ success: true, data: exceptions });
  } catch (err) {
    console.error('Exception fetch error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
