const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');
const Payment = require('../models/payment');
const Settlement = require('../models/settlement');
const Exception = require('../models/exception');
const ReconciliationRun = require('../models/reconciliationRun');

// Initialize Gemini API client if key is present
let genAI = null;
let model = null;

if (config.geminiApiKey) {
  genAI = new GoogleGenerativeAI(config.geminiApiKey);
  model = null; // Gemini disabled – using local fallback parser
}

// Gemini Tool declaration
const mongoQueryDeclaration = {
  name: 'mongo_query',
  description: 'Generate a MongoDB query against the settlement data model to retrieve records.',
  parameters: {
    type: 'OBJECT',
    properties: {
      collection: {
        type: 'STRING',
        description: 'The collection to query: Payment, Settlement, Exception, or ReconciliationRun',
        enum: ['Payment', 'Settlement', 'Exception', 'ReconciliationRun']
      },
      filter: {
        type: 'STRING',
        description: 'MongoDB query filter object as a serialized JSON string. Example: \'{"paymentId": "pay_1"}\' or \'{"reasonCode": "AMOUNT_MISMATCH"}\''
      },
      projection: {
        type: 'STRING',
        description: 'MongoDB query projection object as a serialized JSON string (optional). Example: \'{"amount": 1}\''
      }
    },
    required: ['collection', 'filter']
  }
};

/**
 * Deterministic query parser as a backup in case of Gemini API issues or missing key
 */
function localFallbackParser(question) {
  const q = question.toLowerCase();

  // 1. Match Rate queries
  if (q.includes('match rate') || q.includes('rate')) {
    return {
      collection: 'ReconciliationRun',
      filter: {},
      projection: {},
      formatAnswer: (data) => {
        if (!data || data.length === 0) {
          return "No reconciliation runs have been performed yet. Please click 'Run Batch Reconciliation' in the header first.";
        }
        const latest = [...data].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
        return `The current match rate is ${latest.matchRate}%. Out of ${latest.totalPayments} payments and ${latest.totalSettlements} settlements, ${latest.matchedCount} were matched successfully, leaving ${latest.exceptionCount} exceptions.`;
      }
    };
  }

  // 2. Specific Payment Check (e.g. why didn't pay_12 settle?)
  const payIdMatch = q.match(/pay_\d+/);
  if (payIdMatch) {
    const paymentId = payIdMatch[0];
    return {
      collection: 'Exception',
      filter: { paymentId },
      projection: {},
      formatAnswer: (data) => {
        if (!data || data.length === 0) {
          return `Payment ${paymentId} settled successfully without any exceptions.`;
        }
        return `Payment ${paymentId} has settlement exceptions. Reason: ${data[0].reasonCode}. Details: ${data[0].details}`;
      }
    };
  }

  // 3. Amount mismatches
  if (q.includes('amount mismatch') || q.includes('mismatch')) {
    return {
      collection: 'Exception',
      filter: { reasonCode: 'AMOUNT_MISMATCH' },
      projection: {},
      formatAnswer: (data) => {
        if (!data || data.length === 0) {
          return "There are currently no amount mismatch exceptions.";
        }
        return `We have ${data.length} amount mismatch exceptions. Examples:\n` + 
          data.slice(0, 3).map(d => `- Payment ${d.paymentId || 'N/A'}: ${d.details}`).join('\n');
      }
    };
  }

  // 4. Exceptions count & breakdown
  if (q.includes('how many exceptions') || q.includes('exception count') || q.includes('exceptions')) {
    return {
      collection: 'Exception',
      filter: {},
      projection: {},
      formatAnswer: (data) => {
        if (!data || data.length === 0) {
          return "We have 0 exceptions recorded in the system.";
        }
        const countByReason = data.reduce((acc, cur) => {
          acc[cur.reasonCode] = (acc[cur.reasonCode] || 0) + 1;
          return acc;
        }, {});
        const breakdownStr = Object.entries(countByReason)
          .map(([code, count]) => `- ${code}: ${count}`)
          .join('\n');
        return `There are currently ${data.length} exceptions in the system. Breakdown:\n${breakdownStr}`;
      }
    };
  }

  return null;
}

/**
 * Handles QA questions by:
 * 1. Querying Gemini to translate natural language → mongo_query function call
 * 2. Executing the query against MongoDB
 * 3. Querying Gemini to phrase the plain‑English response
 */
async function handleQuestion(question) {
  // If Gemini API key is missing, genAI or model is not initialized, fall back to deterministic parser
  if (!config.geminiApiKey || !genAI || !model) {
    console.warn('⚠️ Gemini not configured or unavailable. Using local deterministic fallback parser.');
    const fallbackPlan = localFallbackParser(question);
    if (fallbackPlan) {
      const rawResult = await executeMongoQuery(fallbackPlan.collection, fallbackPlan.filter, fallbackPlan.projection);
      return {
        answer: `⚠️ [Local Fallback Mode]\n\n${fallbackPlan.formatAnswer(rawResult)}`,
        rawResult,
      };
    }
    // Generic fallback for settlement count today
    if (/settled today/i.test(question)) {
      const start = new Date();
      start.setHours(0,0,0,0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const count = await Settlement.countDocuments({ settledOn: { $gte: start, $lt: end } });
      return { answer: `There are ${count} payments settled today.`, rawResult: [{ count }] };
    }
    throw new Error('Gemini is not configured and no fallback plan available.');
  }
  // If GEMINI_API_KEY is not defined, immediately fall back to local parser
  if (!config.geminiApiKey || !genAI) {
    console.warn('⚠️ GEMINI_API_KEY is not set. Using local deterministic fallback parser.');
    const fallbackPlan = localFallbackParser(question);
    if (fallbackPlan) {
      const rawResult = await executeMongoQuery(fallbackPlan.collection, fallbackPlan.filter, fallbackPlan.projection);
      return {
        answer: `⚠️ [Local Fallback Mode - GEMINI_API_KEY Not Configured]\n\n${fallbackPlan.formatAnswer(rawResult)}`,
        rawResult
      };
    }
    throw new Error('Please configure GEMINI_API_KEY in server/.env to enable the Q&A engine.');
  }

  try {
    const prompt = `You are a data analyst for a fintech reconciliation system.
The schema is:
- Payment: { paymentId, orderId, amount, currency, timestamp, status }
- Settlement: { utr, amount, settledOn, linkedPaymentId, bankRef }
- Exception: { runId, paymentId, settlementId, reasonCode, details }
- ReconciliationRun: { runId, timestamp, totalPayments, totalSettlements, matchedCount, exceptionCount, matchRate }

Translate the following natural-language question into a MongoDB query against one of these collections.
You must call the mongo_query tool. Both the filter and projection parameters MUST be valid JSON strings, not objects.

Question: "${question}"`;

    // 1. Force function calling
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{ functionDeclarations: [mongoQueryDeclaration] }],
      toolConfig: { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: ['mongo_query'] } }
    });

    const response = result.response;

    // Extract function call
    let call = null;
    if (response.functionCalls && response.functionCalls.length > 0) {
      call = response.functionCalls[0];
    } else {
      // Fallback extraction from candidates
      const candidate = response.candidates?.[0];
      const part = candidate?.content?.parts?.find(p => p.functionCall);
      if (part) {
        call = part.functionCall;
      }
    }

    if (!call || call.name !== 'mongo_query') {
      throw new Error('Gemini did not return a tool call');
    }

    const { collection, filter, projection } = call.args;
    const filterObj = JSON.parse(filter);
    const projectionObj = projection ? JSON.parse(projection) : {};

    // 2. Run the MongoDB query
    const rawResult = await executeMongoQuery(collection, filterObj, projectionObj);

    // 3. Ask Gemini to phrase the plain‑English response
    const answerResult = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{
            text: `Here is the structured data retrieved from MongoDB:\n\n${JSON.stringify(rawResult, null, 2)}\n\nOriginal Question: "${question}"\n\nPlease write a concise plain-English answer summarizing this data to answer the original question.`
          }]
        }
      ]
    });

    const answer = answerResult.response.text();
    return { answer, rawResult };

  } catch (err) {
    console.error('Gemini QA Layer Error:', err);

    // Fall back to local parsing engine if Gemini fails
    const fallbackPlan = localFallbackParser(question);
    if (fallbackPlan) {
      const rawResult = await executeMongoQuery(fallbackPlan.collection, fallbackPlan.filter, fallbackPlan.projection);
      return {
        answer: `⚠️ [Local Fallback Mode - Gemini API Error]\n\n${fallbackPlan.formatAnswer(rawResult)}`,
        rawResult
      };
    }

    throw err;
  }
}

async function executeMongoQuery(collection, filter, projection) {
  let rawResult;
  switch (collection) {
    case 'Payment':
      rawResult = await Payment.find(filter, projection).lean();
      break;
    case 'Settlement':
      rawResult = await Settlement.find(filter, projection).lean();
      break;
    case 'Exception':
      rawResult = await Exception.find(filter, projection).lean();
      break;
    case 'ReconciliationRun':
      rawResult = await ReconciliationRun.find(filter, projection).lean();
      break;
    default:
      throw new Error(`Unsupported collection: ${collection}`);
  }
  return rawResult;
}

module.exports = { handleQuestion };
