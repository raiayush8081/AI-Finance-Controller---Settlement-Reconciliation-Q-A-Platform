// server.js – entry point for the backend
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const reconcileRouter = require('./routes/reconcile');
const qaRouter = require('./routes/qa');
const exceptionsRouter = require('./routes/exceptions'); // new route for fetching exceptions

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/settlement_demo';
mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Routes
app.use('/api/reconcile', reconcileRouter);
app.use('/api/qa', qaRouter);
app.use('/api/exceptions', exceptionsRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
