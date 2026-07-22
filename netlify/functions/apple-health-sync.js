import { connectLambda } from '@netlify/blobs';
import { saveIncomingPayload } from './lib/apple-health-storage.js';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function unauthorized() {
  return {
    statusCode: 401,
    headers: JSON_HEADERS,
    body: JSON.stringify({ error: 'Unauthorized' })
  };
}

function parseBody(event) {
  if (!event.body) return null;

  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isAuthorized(event) {
  const expected = process.env.APPLE_HEALTH_SYNC_TOKEN;
  if (!expected) return false;

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  return authHeader === `Bearer ${expected}`;
}

export const handler = async (event) => {
  connectLambda(event);

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        ...JSON_HEADERS,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  if (!process.env.APPLE_HEALTH_SYNC_TOKEN) {
    return {
      statusCode: 503,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'APPLE_HEALTH_SYNC_TOKEN is not configured' })
    };
  }

  if (!isAuthorized(event)) {
    return unauthorized();
  }

  const body = parseBody(event);
  if (!body) {
    return {
      statusCode: 400,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Invalid JSON body' })
    };
  }

  try {
    const result = await saveIncomingPayload(body, event.headers);

    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        ok: true,
        ...result
      })
    };
  } catch (error) {
    console.error('Apple Health sync error:', error);
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: error.message })
    };
  }
};
