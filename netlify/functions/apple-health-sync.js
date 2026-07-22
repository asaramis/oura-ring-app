import { loadStoredData, saveIncomingPayload } from './lib/apple-health-storage.js';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders }
  });
}

function getRequestHeaders(request) {
  return Object.fromEntries(request.headers.entries());
}

function isAuthorized(request) {
  const expected = process.env.APPLE_HEALTH_SYNC_TOKEN;
  if (!expected) return false;

  const authHeader = request.headers.get('authorization') || '';
  return authHeader === `Bearer ${expected}`;
}

export default async (request) => {
  if (request.method === 'OPTIONS') {
    return jsonResponse({}, 200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  if (!process.env.APPLE_HEALTH_SYNC_TOKEN) {
    return jsonResponse({ error: 'APPLE_HEALTH_SYNC_TOKEN is not configured' }, 503);
  }

  if (!isAuthorized(request)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  try {
    const result = await saveIncomingPayload(body, getRequestHeaders(request));
    const stored = await loadStoredData();

    return jsonResponse({
      ok: true,
      ...result,
      verifiedMetrics: Object.keys(stored.metrics || {}).length
    });
  } catch (error) {
    console.error('Apple Health sync error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
};
