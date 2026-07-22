import { buildSummary, loadStoredData, loadSyncLog } from './lib/apple-health-storage.js';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*'
};

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders }
  });
}

export default async (request) => {
  if (request.method === 'OPTIONS') {
    return jsonResponse({}, 200, {
      'Access-Control-Allow-Methods': 'GET, OPTIONS'
    });
  }

  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const stored = await loadStoredData();
    const syncLog = await loadSyncLog();
    const hasData = Object.keys(stored.metrics || {}).length > 0;

    return jsonResponse({
      hasData,
      lastUpdated: stored.lastUpdated,
      syncCount: stored.syncCount || 0,
      lastSync: syncLog[0] || null,
      summary: buildSummary(stored),
      metrics: stored.metrics || {},
      workouts: (stored.workouts || []).slice(0, 10)
    });
  } catch (error) {
    console.error('Apple Health data error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
};
