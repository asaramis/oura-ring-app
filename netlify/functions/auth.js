export const handler = async (event) => {
  const clientId = process.env.OURA_CLIENT_ID;
  const redirectUri = `${process.env.SITE_URL}/api/callback`;
  const state = Math.random().toString(36).substring(7);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'daily personal',
    state: state
  });

  const authUrl = `https://cloud.ouraring.com/oauth/authorize?${params.toString()}`;

  return {
    statusCode: 302,
    headers: {
      Location: authUrl
    }
  };
};
