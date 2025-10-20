import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect(
      `${request.nextUrl.origin}/settings?auth_error=${encodeURIComponent(error)}`
    );
  }

  // Validate code and state
  if (!code || !state) {
    return NextResponse.redirect(
      `${request.nextUrl.origin}/settings?auth_error=missing_parameters`
    );
  }

  try {
    // Get client credentials
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    // Check if client credentials are configured
    if (!clientId || !clientSecret) {
      console.error('GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured');
      return NextResponse.redirect(
        `${request.nextUrl.origin}/settings?auth_error=client_credentials_not_configured`
      );
    }

    const redirectUri = `${request.nextUrl.origin}/api/google-auth/callback`;

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      return NextResponse.redirect(
        `${request.nextUrl.origin}/settings?auth_error=token_exchange_failed`
      );
    }

    const tokens = await tokenResponse.json();

    // Calculate expiry time
    const expiresAt = Date.now() + (tokens.expires_in * 1000);

    // Get user info
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    const userInfo = userInfoResponse.ok ? await userInfoResponse.json() : null;

    // Encode tokens and user info to pass to client
    const tokenData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      scope: tokens.scope,
      token_type: tokens.token_type,
    };

    const userData = userInfo ? {
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      verified_email: userInfo.verified_email,
    } : null;

    // Redirect back to settings with success and data
    const redirectUrl = new URL(`${request.nextUrl.origin}/settings`);
    redirectUrl.searchParams.set('auth_success', 'true');
    redirectUrl.searchParams.set('state', state);
    redirectUrl.searchParams.set('tokens', encodeURIComponent(JSON.stringify(tokenData)));
    if (userData) {
      redirectUrl.searchParams.set('user', encodeURIComponent(JSON.stringify(userData)));
    }

    return NextResponse.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      `${request.nextUrl.origin}/settings?auth_error=server_error`
    );
  }
}

