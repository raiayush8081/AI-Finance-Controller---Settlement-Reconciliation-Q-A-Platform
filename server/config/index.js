const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

module.exports = {
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/settlement_demo',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  matchWindowDays: parseInt(process.env.MATCH_WINDOW_DAYS) || 3,
  amountTolerance: parseFloat(process.env.AMOUNT_TOLERANCE) || 1.0,
};
