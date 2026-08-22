const express = require('express');
const router = express.Router();
const { handleQuestion } = require('../services/qaService');

// POST /api/qa
router.post('/', async (req, res) => {
  const { question } = req.body;
  if (!question) {
    return res.status(400).json({ success: false, error: 'Missing question' });
  }
  try {
    const answer = await handleQuestion(question);
    res.json({ success: true, data: answer });
  } catch (err) {
    console.error('QA error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
