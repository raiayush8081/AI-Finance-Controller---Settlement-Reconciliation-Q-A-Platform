import React, { useState } from 'react';

export default function ExceptionTable({ exceptions }) {
  const [filterReason, setFilterReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredExceptions = exceptions.filter(exc => {
    const matchesReason = filterReason === '' || exc.reasonCode === filterReason;
    const matchesSearch = 
      searchTerm === '' ||
      (exc.paymentId && exc.paymentId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (exc.settlementId && exc.settlementId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (exc.details && exc.details.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesReason && matchesSearch;
  });

  const sortedExceptions = [...filteredExceptions].sort((a, b) => {
    const amtA = a.amountAtRisk || 0;
    const amtB = b.amountAtRisk || 0;
    return amtB - amtA;
  });

  const currencyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">System Exceptions ({filteredExceptions.length})</h2>
        <div className="table-controls">
          <input
            type="text"
            className="select-input"
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '200px' }}
          />
          <select
            className="select-input"
            value={filterReason}
            onChange={(e) => setFilterReason(e.target.value)}
          >
            <option value="">All Reason Codes</option>
            <option value="AMOUNT_MISMATCH">Amount Mismatch</option>
            <option value="NO_COUNTERPART">No Counterpart</option>
            <option value="DATE_OUT_OF_WINDOW">Date Out of Window</option>
            <option value="DUPLICATE_SETTLEMENT">Duplicate Settlement</option>
          </select>
        </div>
      </div>
      <div className="table-container">
        {filteredExceptions.length === 0 ? (
          <div className="empty-state">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>No exceptions found.</p>
            <p className="subtext">Verify reconciliation run stats or adjust search criteria.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Reason Code</th>
                <th>Payment ID</th>
                <th>Settlement UTR</th>
                <th>Amount at Risk</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {sortedExceptions.map((exc, idx) => (
                <tr key={exc._id || idx}>
                  <td>
                    <span className={`badge badge-${exc.reasonCode}`}>
                      {exc.reasonCode.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>
                    <code style={{ color: '#818cf8' }}>{exc.paymentId || 'N/A'}</code>
                  </td>
                  <td>
                    <code style={{ color: '#06b6d4' }}>{exc.settlementId || 'N/A'}</code>
                  </td>
                  <td style={{ color: '#f43f5e', fontWeight: '600' }}>
                    {currencyFormatter.format(exc.amountAtRisk || 0)}
                  </td>
                  <td style={{ color: '#e5e7eb' }}>{exc.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
