import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import ExceptionTable from './components/ExceptionTable';
import ChatPanel from './components/ChatPanel';
import { runReconciliation, getExceptions, askQuestion, getLatestRun } from './api';

export default function App() {
  const [isReconciling, setIsReconciling] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [exceptions, setExceptions] = useState([]);
  const [stats, setStats] = useState({
    matchRate: 0,
    totalPayments: 0,
    totalSettlements: 0,
    exceptionCount: 0,
    totalAmountAtRisk: 0,
    runId: null,
  });
  const [chatHistory, setChatHistory] = useState([]);

  // Load exceptions and latest stats on mount
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const runRes = await getLatestRun();
      if (runRes.success && runRes.data) {
        const runData = runRes.data;
        setStats({
          matchRate: runData.matchRate,
          totalPayments: runData.totalPayments,
          totalSettlements: runData.totalSettlements,
          exceptionCount: runData.exceptionCount,
          totalAmountAtRisk: runData.totalAmountAtRisk || 0,
          runId: runData.runId,
        });

        const excRes = await getExceptions(runData.runId);
        if (excRes.success && excRes.data) {
          setExceptions(excRes.data);
        }
      } else {
        const res = await getExceptions();
        if (res.success && res.data) {
          setExceptions(res.data);
        }
      }
    } catch (err) {
      console.error("Error loading initial data", err);
    }
  };

  const handleRunReconcile = async () => {
    setIsReconciling(true);
    try {
      const res = await runReconciliation();
      if (res.success && res.data) {
        const data = res.data;
        setStats({
          matchRate: data.matchRate,
          totalPayments: data.totalPayments || 50,
          totalSettlements: data.totalSettlements || 50,
          exceptionCount: data.exceptionCount,
          totalAmountAtRisk: data.totalAmountAtRisk || 0,
          runId: data.runId,
        });
        
        // Fetch the exceptions for this new run
        const excRes = await getExceptions(data.runId);
        if (excRes.success && excRes.data) {
          setExceptions(excRes.data);
        }
      }
    } catch (err) {
      console.error("Reconciliation failed", err);
      alert("Error running reconciliation batch: " + err.message);
    } finally {
      setIsReconciling(false);
    }
  };

  const handleSendMessage = async (text) => {
    const userMessage = { role: 'user', text };
    setChatHistory((prev) => [...prev, userMessage]);
    setIsThinking(true);

    try {
      const res = await askQuestion(text);
      if (res.success && res.data) {
        const agentMessage = {
          role: 'agent',
          text: res.data.answer,
          rawResult: res.data.rawResult,
        };
        setChatHistory((prev) => [...prev, agentMessage]);
      } else {
        throw new Error(res.error || 'Failed to get response');
      }
    } catch (err) {
      console.error("QA call failed", err);
      const systemMessage = {
        role: 'system',
        text: `Error parsing query: ${err.message}. Make sure the backend server is running and GEMINI_API_KEY is configured.`,
      };
      setChatHistory((prev) => [...prev, systemMessage]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="app-container">
      <Header 
        onRunReconcile={handleRunReconcile} 
        isReconciling={isReconciling} 
        matchRate={stats.matchRate}
        totalAmountAtRisk={stats.totalAmountAtRisk}
        runId={stats.runId}
      />
      
      <div className="stats-container">
        <div className="stat-card">
          <span className="stat-label">Match Rate</span>
          <span className={`stat-value ${stats.matchRate >= 80 ? 'stat-emerald' : 'stat-rose'}`}>
            {stats.matchRate}%
          </span>
          <span className="stat-subtext">Deterministic threshold matching</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Payments</span>
          <span className="stat-value stat-cyan">
            {stats.totalPayments}
          </span>
          <span className="stat-subtext">Captured transactions loaded</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Settlement Records</span>
          <span className="stat-value stat-indigo">
            {stats.totalSettlements || exceptions.length}
          </span>
          <span className="stat-subtext">Bank-cleared entries processed</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Exceptions Found</span>
          <span className="stat-value stat-rose">
            {stats.exceptionCount || exceptions.length}
          </span>
          <span className="stat-subtext">Requires human reconciliation</span>
        </div>
      </div>

      <div className="main-grid">
        <ExceptionTable exceptions={exceptions} />
        <ChatPanel 
          onSendMessage={handleSendMessage} 
          chatHistory={chatHistory} 
          isThinking={isThinking} 
        />
      </div>
    </div>
  );
}
