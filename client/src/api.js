import axios from 'axios';

const API_BASE = '/api';

export const runReconciliation = async () => {
  const response = await axios.post(`${API_BASE}/reconcile/run`);
  return response.data;
};

export const getExceptions = async (runId = '') => {
  const response = await axios.get(`${API_BASE}/exceptions`, {
    params: { runId }
  });
  return response.data;
};

export const askQuestion = async (question) => {
  const response = await axios.post(`${API_BASE}/qa`, { question });
  return response.data;
};
