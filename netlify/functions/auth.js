export const handler = async (event) => {
  const clientId = process.env.OURA_CLIENT_ID;
  const redirectUri = `${process.env.SITE_URL}/api/callback`;

  const scopes = [
    'daily',
    'heartrate',
    'personal',
    'session',
    'spo2',
    'workout'
  ].join('+');

  const authUrl = `https://cloud.ouraring.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scopes}`;

  return {
    statusCode: 302,
    headers: {
      Location: authUrl
    }
  };
};
