const express = require('express');
const router = express.Router();
const { runReconciliation } = require('../services/reconciliationService');
const ReconciliationRun = require('../models/reconciliationRun');
const Exception = require('../models/exception');
const PDFDocument = require('pdfkit');

// GET /api/reconcile/latest
router.get('/latest', async (req, res) => {
  try {
    const latestRun = await ReconciliationRun.findOne({}).sort({ timestamp: -1 }).lean();
    res.json({ success: true, data: latestRun });
  } catch (err) {
    console.error('Error fetching latest run:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

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

// GET /api/reconcile/:runId/report?format=pdf|csv
router.get('/:runId/report', async (req, res) => {
  try {
    const { runId } = req.params;
    const { format } = req.query;

    const run = await ReconciliationRun.findOne({ runId }).lean();
    if (!run) {
      return res.status(404).json({ success: false, error: 'Reconciliation run not found' });
    }

    const exceptions = await Exception.find({ runId }).lean();
    exceptions.sort((a, b) => (b.amountAtRisk || 0) - (a.amountAtRisk || 0));

    if (format === 'csv') {
      function escapeCSVField(val) {
        if (val === null || val === undefined) return '';
        let str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          str = '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      }

      const timestampStr = run.timestamp instanceof Date ? run.timestamp.toISOString() : new Date(run.timestamp).toISOString();
      const summaryHeader = `Run ID,Timestamp,Match Rate (%),Total Amount at Risk (INR)\n${escapeCSVField(run.runId)},${escapeCSVField(timestampStr)},${escapeCSVField(run.matchRate)},${escapeCSVField(run.totalAmountAtRisk)}\n\n`;
      const tableHeader = `paymentId,settlementId,reasonCode,amountAtRisk,details\n`;
      const tableRows = exceptions.map(exc => [
        exc.paymentId,
        exc.settlementId,
        exc.reasonCode,
        exc.amountAtRisk,
        exc.details
      ].map(escapeCSVField).join(',')).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="reconciliation-report-${runId}.csv"`);
      return res.send(summaryHeader + tableHeader + tableRows);
    } 
    
    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 30 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="reconciliation-report-${runId}.pdf"`);
      doc.pipe(res);

      // Title & Header
      doc.fontSize(20).font('Helvetica-Bold').text('Reconciliation Audit Report', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').text(`Run ID: ${run.runId}`, { align: 'left' });
      doc.text(`Timestamp: ${new Date(run.timestamp).toLocaleString()}`, { align: 'left' });
      doc.moveDown(1);

      // Stats Summary
      doc.fontSize(14).font('Helvetica-Bold').text('Summary Statistics', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Match Rate: ${run.matchRate}%`);
      doc.text(`Matched Count: ${run.matchedCount}`);
      doc.text(`Exception Count: ${run.exceptionCount}`);
      doc.text(`Total Amount at Risk: INR ${run.totalAmountAtRisk.toLocaleString('en-IN')}`);
      doc.moveDown(1.5);

      // Exceptions List Header
      doc.fontSize(14).font('Helvetica-Bold').text('Exceptions List', { underline: true });
      doc.moveDown(0.5);

      // Draw table columns
      let headerY = doc.y;
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Reason Code', 30, headerY, { width: 110 });
      doc.text('Payment ID', 145, headerY, { width: 65 });
      doc.text('Settlement UTR', 215, headerY, { width: 105 });
      doc.text('Amt at Risk', 325, headerY, { width: 65 });
      doc.text('Details', 395, headerY, { width: 185 });

      doc.moveTo(30, headerY + 12).lineTo(580, headerY + 12).stroke();
      doc.y = headerY + 18;
      doc.font('Helvetica');

      exceptions.forEach(exc => {
        const reasonCodeText = exc.reasonCode;
        const paymentIdText = exc.paymentId || 'N/A';
        const settlementIdText = exc.settlementId || 'N/A';
        const amountText = `INR ${exc.amountAtRisk.toLocaleString('en-IN')}`;
        const detailsText = exc.details || '';

        const cols = [
          { text: reasonCodeText, x: 30, w: 110 },
          { text: paymentIdText, x: 145, w: 65 },
          { text: settlementIdText, x: 215, w: 105 },
          { text: amountText, x: 325, w: 65 },
          { text: detailsText, x: 395, w: 185 }
        ];

        // Find max height for this row
        let maxRowHeight = 0;
        cols.forEach(col => {
          const height = doc.heightOfString(col.text, { width: col.w });
          if (height > maxRowHeight) maxRowHeight = height;
        });

        // Check page overflow
        if (doc.y + maxRowHeight > 740) {
          doc.addPage();
          let pageHeaderY = doc.y;
          doc.fontSize(9).font('Helvetica-Bold');
          doc.text('Reason Code', 30, pageHeaderY, { width: 110 });
          doc.text('Payment ID', 145, pageHeaderY, { width: 65 });
          doc.text('Settlement UTR', 215, pageHeaderY, { width: 105 });
          doc.text('Amt at Risk', 325, pageHeaderY, { width: 65 });
          doc.text('Details', 395, pageHeaderY, { width: 185 });
          doc.moveTo(30, pageHeaderY + 12).lineTo(580, pageHeaderY + 12).stroke();
          doc.y = pageHeaderY + 18;
          doc.font('Helvetica');
        }

        const rowY = doc.y;
        doc.fontSize(8);
        cols.forEach(col => {
          doc.text(col.text, col.x, rowY, { width: col.w });
        });

        // Set y to the bottom of the tallest cell in the row plus some padding
        doc.y = rowY + maxRowHeight + 5;
      });

      doc.end();
      return;
    }

    return res.status(400).json({ success: false, error: 'Invalid report format. Use pdf or csv.' });
  } catch (err) {
    console.error('Error generating report:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
