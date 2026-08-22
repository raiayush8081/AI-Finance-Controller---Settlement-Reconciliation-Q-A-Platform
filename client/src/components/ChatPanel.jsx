import React, { useState, useRef, useEffect } from 'react';

const SUGGESTIONS = [
  "What is our current match rate?",
  "Why did payment pay_12 not settle?",
  "List all amount mismatches",
  "How many exceptions do we have?"
];

export default function ChatPanel({ onSendMessage, chatHistory, isThinking }) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;
    onSendMessage(input);
    setInput('');
  };

  const handleSuggestionClick = (suggestion) => {
    if (isThinking) return;
    onSendMessage(suggestion);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isThinking]);

  return (
    <div className="panel chat-container">
      <div className="panel-header">
        <h2 className="panel-title">AI Reconciliation Assistant</h2>
      </div>

      <div className="chat-messages">
        {chatHistory.length === 0 && (
          <div className="empty-state" style={{ height: '100%', justifyContent: 'center' }}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p>Ask a financial query in plain English</p>
            <p className="subtext">The agent translates questions into MongoDB queries and inspects results.</p>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem', justifyContent: 'center' }}>
              {SUGGESTIONS.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(s)}
                  className="select-input"
                  style={{ background: 'rgba(99, 102, 241, 0.15)', borderColor: 'rgba(99, 102, 241, 0.3)', borderRadius: '20px', padding: '0.35rem 0.85rem', fontSize: '0.75rem' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {chatHistory.map((msg, index) => (
          <div key={index} className={`message message-${msg.role}`}>
            <div>{msg.text}</div>
            
            {msg.rawResult && (
              <div className="query-inspector">
                <div className="query-inspector-title">Database Response (Raw JSON)</div>
                <pre style={{ overflowX: 'auto', maxHeight: '150px' }}>
                  {JSON.stringify(msg.rawResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ))}

        {isThinking && (
          <div className="message message-agent" style={{ width: 'fit-content' }}>
            <div className="typing-indicator">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="chat-input-form">
        <input
          type="text"
          className="chat-input"
          placeholder="Type your query..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isThinking}
        />
        <button type="submit" className="btn-send" disabled={isThinking}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '18px', height: '18px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </form>
    </div>
  );
}
