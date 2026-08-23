import React from 'react';

export default function Header({ onRunReconcile, isReconciling, matchRate, totalAmountAtRisk, runId }) {
  const handleDownload = (format) => {
    if (!runId) return;
    window.open(`/api/reconcile/${runId}/report?format=${format}`, '_blank');
  };

  const currencyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });

  return (
    <header className="header">
      <div className="brand-section">
        <h1>AI Finance Controller</h1>
        <p>Settlement Reconciliation &amp; Exception Q&A Platform</p>
      </div>
      <div className="actions-section">
        {runId && (
          <div className="header-stats">
            <div className="header-stat">
              <span className="header-stat-label">Match Rate</span>
              <span className={`header-stat-value ${matchRate >= 80 ? 'stat-emerald' : 'stat-rose'}`}>
                {matchRate}%
              </span>
            </div>
            <div className="header-stat amount-at-risk-stat">
              <span className="header-stat-label">Amount at Risk</span>
              <span className="header-stat-value stat-rose">
                {currencyFormatter.format(totalAmountAtRisk || 0)} at risk
              </span>
            </div>
          </div>
        )}

        {runId && (
          <div className="report-buttons">
            <button className="btn-secondary-outline" onClick={() => handleDownload('pdf')}>
              Download PDF Report
            </button>
            <button className="btn-secondary-outline" onClick={() => handleDownload('csv')}>
              Download CSV Report
            </button>
          </div>
        )}

        <button 
          className="btn-primary" 
          onClick={onRunReconcile}
          disabled={isReconciling}
        >
          {isReconciling ? (
            <>
              <svg className="animate-spin" style={{ width: '16px', height: '16px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%' }} viewBox="0 0 24 24" />
              Reconciling...
            </>
          ) : 'Run Batch Reconciliation'}
        </button>
      </div>
    </header>
  );
}
