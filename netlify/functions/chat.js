import Anthropic from '@anthropic-ai/sdk';
import { getAppleHealthContext } from './lib/apple-health-storage.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

async function fetchOuraData(token, endpoint, startDate, endDate) {
  let url = `https://api.ouraring.com/v2/usercollection/${endpoint}`;
  if (endpoint !== 'personal_info') {
    url += `?start_date=${startDate}&end_date=${endDate}`;
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.json();
}

export default async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    });
  }

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const authHeader = request.headers.get('authorization');
  const ouraToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  let question;
  try {
    ({ question } = await request.json());
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!question) {
    return Response.json({ error: 'No question provided' }, { status: 400 });
  }

  try {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const appleHealth = await getAppleHealthContext();

    let sleepData = { data: [] };
    let readinessData = { data: [] };
    let activityData = { data: [] };

    if (ouraToken) {
      [sleepData, readinessData, activityData] = await Promise.all([
        fetchOuraData(ouraToken, 'daily_sleep', startDate, endDate),
        fetchOuraData(ouraToken, 'daily_readiness', startDate, endDate),
        fetchOuraData(ouraToken, 'daily_activity', startDate, endDate)
      ]);
    }

    const hasOuraData = Boolean(
      sleepData.data?.length || readinessData.data?.length || activityData.data?.length
    );

    if (!hasOuraData && !appleHealth) {
      return Response.json(
        { error: 'No health data available. Connect Oura or sync Apple Health first.' },
        { status: 400 }
      );
    }

    const systemPrompt = `You are a helpful health data assistant analyzing personal health data from Oura Ring and/or Apple Health.

Be conversational, insightful, and helpful. When discussing Oura scores:
- Sleep/Readiness/Activity scores range from 0-100
- 85+ is excellent, 70-84 is good, below 70 needs attention

When discussing Apple Health metrics, use the units provided in the data. Reference specific dates and values when relevant. Keep responses concise but informative.`;

    const sections = [`Today's date is ${endDate}.`];

    if (hasOuraData) {
      sections.push(
        `OURA SLEEP DATA:\n${JSON.stringify(sleepData.data || [], null, 2)}`,
        `OURA READINESS DATA:\n${JSON.stringify(readinessData.data || [], null, 2)}`,
        `OURA ACTIVITY DATA:\n${JSON.stringify(activityData.data || [], null, 2)}`
      );
    }

    if (appleHealth) {
      sections.push(
        `APPLE HEALTH SUMMARY:\n${JSON.stringify(appleHealth.summary, null, 2)}`,
        `APPLE HEALTH METRICS:\n${JSON.stringify(appleHealth.metrics, null, 2)}`,
        `APPLE HEALTH WORKOUTS:\n${JSON.stringify(appleHealth.workouts, null, 2)}`
      );
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `${sections.join('\n\n')}\n\nUser question: ${question}`
        }
      ]
    });

    return Response.json(
      { answer: response.content[0].text },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (error) {
    console.error('Chat error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
};
