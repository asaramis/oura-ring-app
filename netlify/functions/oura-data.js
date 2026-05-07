export const handler = async (event) => {
  const authHeader = event.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'No token provided' })
    };
  }

  const token = authHeader.split(' ')[1];
  const endpoint = event.queryStringParameters?.endpoint || 'daily_sleep';
  const startDate = event.queryStringParameters?.start_date;
  const endDate = event.queryStringParameters?.end_date;

  // Build date range (default: last 30 days)
  const end = endDate || new Date().toISOString().split('T')[0];
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const validEndpoints = [
    'daily_sleep',
    'daily_activity',
    'daily_readiness',
    'heartrate',
    'sleep',
    'personal_info',
    'daily_spo2'
  ];

  if (!validEndpoints.includes(endpoint)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid endpoint' })
    };
  }

  try {
    let url = `https://api.ouraring.com/v2/usercollection/${endpoint}`;

    if (endpoint !== 'personal_info') {
      url += `?start_date=${start}&end_date=${end}`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
