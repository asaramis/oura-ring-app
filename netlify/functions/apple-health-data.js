import { connectLambda } from '@netlify/blobs';
import { buildSummary, loadStoredData, loadSyncLog } from './lib/apple-health-storage.js';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*'
};

export const handler = async (event) => {
  connectLambda(event);

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        ...JSON_HEADERS,
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      }
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const stored = await loadStoredData();
    const syncLog = await loadSyncLog();
    const hasData = Object.keys(stored.metrics || {}).length > 0;

    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        hasData,
        lastUpdated: stored.lastUpdated,
        syncCount: stored.syncCount || 0,
        lastSync: syncLog[0] || null,
        summary: buildSummary(stored),
        metrics: stored.metrics || {},
        workouts: (stored.workouts || []).slice(0, 10)
      })
    };
  } catch (error) {
    console.error('Apple Health data error:', error);
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: error.message })
    };
  }
};
