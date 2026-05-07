export const handler = async (event) => {
  const code = event.queryStringParameters?.code;

  if (!code) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'No authorization code provided' })
    };
  }

  const clientId = process.env.OURA_CLIENT_ID;
  const clientSecret = process.env.OURA_CLIENT_SECRET;
  const redirectUri = `${process.env.SITE_URL}/api/callback`;

  try {
    const response = await fetch('https://api.ouraring.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri
      })
    });

    const data = await response.json();

    if (data.access_token) {
      // Return HTML that stores token and redirects to dashboard
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/html'
        },
        body: `
          <!DOCTYPE html>
          <html>
          <head><title>Connecting...</title></head>
          <body>
            <script>
              localStorage.setItem('oura_token', '${data.access_token}');
              localStorage.setItem('oura_refresh_token', '${data.refresh_token || ''}');
              window.location.href = '/';
            </script>
            <p>Connecting your Oura account...</p>
          </body>
          </html>
        `
      };
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Failed to get access token', details: data })
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
