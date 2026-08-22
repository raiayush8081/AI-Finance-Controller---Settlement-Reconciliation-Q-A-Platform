import React from 'react';

export default function Header({ onRunReconcile, isReconciling, matchRate }) {
  return (
    <header className="header">
      <div className="brand-section">
        <h1>AI Finance Controller</h1>
        <p>Settlement Reconciliation &amp; Exception Q&A Platform</p>
      </div>
      <div className="actions-section">
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
