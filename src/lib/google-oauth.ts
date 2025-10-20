'use client';

// Google OAuth configuration and token management
import { db } from './database';

export interface GoogleOAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  scope: string;
  token_type: string;
}

export interface GoogleUserInfo {
  email: string;
  name: string;
  picture?: string;
  verified_email: boolean;
}

// OAuth configuration
export const GOOGLE_OAUTH_CONFIG = {
  client_id: process.env.GOOGLE_CLIENT_ID || '',
  redirect_uri: typeof window !== 'undefined' 
    ? `${window.location.origin}/api/google-auth/callback`
    : '',
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',  // Create and manage sheets
    'https://www.googleapis.com/auth/drive.file',    // Create files in Drive
    'https://www.googleapis.com/auth/userinfo.email', // Get user email
    'https://www.googleapis.com/auth/userinfo.profile', // Get user profile
  ],
  auth_url: 'https://accounts.google.com/o/oauth2/v2/auth',
  token_url: 'https://oauth2.googleapis.com/token',
  userinfo_url: 'https://www.googleapis.com/oauth2/v2/userinfo',
};

// Store tokens in IndexedDB
export async function storeGoogleTokens(tokens: GoogleOAuthTokens): Promise<void> {
  await db.settings.put({
    key: 'google_oauth_tokens',
    value: tokens,
  });
}

// Get stored tokens
export async function getGoogleTokens(): Promise<GoogleOAuthTokens | null> {
  const setting = await db.settings.get('google_oauth_tokens');
  return setting?.value as GoogleOAuthTokens || null;
}

// Store user info
export async function storeGoogleUserInfo(userInfo: GoogleUserInfo): Promise<void> {
  await db.settings.put({
    key: 'google_user_info',
    value: userInfo,
  });
}

// Get stored user info
export async function getGoogleUserInfo(): Promise<GoogleUserInfo | null> {
  const setting = await db.settings.get('google_user_info');
  return setting?.value as GoogleUserInfo || null;
}

// Clear all Google OAuth data
export async function clearGoogleOAuthData(): Promise<void> {
  await db.settings.delete('google_oauth_tokens');
  await db.settings.delete('google_user_info');
}

// Check if tokens are valid (not expired)
export function areTokensValid(tokens: GoogleOAuthTokens | null): boolean {
  if (!tokens) return false;
  const now = Date.now();
  return tokens.expires_at > now;
}

// Generate OAuth URL for login
export function generateGoogleAuthUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_OAUTH_CONFIG.client_id,
    redirect_uri: GOOGLE_OAUTH_CONFIG.redirect_uri,
    response_type: 'code',
    scope: GOOGLE_OAUTH_CONFIG.scopes.join(' '),
    access_type: 'offline',  // Request refresh token
    prompt: 'consent',       // Always show consent to get refresh token
    state: state || generateRandomState(),
  });

  return `${GOOGLE_OAUTH_CONFIG.auth_url}?${params.toString()}`;
}

// Generate a random state for CSRF protection
export function generateRandomState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Store state for verification
export function storeOAuthState(state: string): void {
  sessionStorage.setItem('google_oauth_state', state);
}

// Verify state
export function verifyOAuthState(state: string): boolean {
  const storedState = sessionStorage.getItem('google_oauth_state');
  sessionStorage.removeItem('google_oauth_state');
  return storedState === state;
}

// Refresh access token using refresh token
export async function refreshAccessToken(): Promise<GoogleOAuthTokens | null> {
  try {
    const tokens = await getGoogleTokens();
    
    if (!tokens || !tokens.refresh_token) {
      console.log('No refresh token available');
      return null;
    }

    console.log('🔄 Refreshing access token...');
    
    // Call our API route to refresh the token
    const response = await fetch('/api/google-auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: tokens.refresh_token,
      }),
    });

    if (!response.ok) {
      console.error('Token refresh failed:', response.status);
      return null;
    }

    const data = await response.json();
    
    if (data.success && data.tokens) {
      const newTokens: GoogleOAuthTokens = {
        access_token: data.tokens.access_token,
        refresh_token: tokens.refresh_token, // Keep the same refresh token
        expires_at: data.tokens.expires_at,
        scope: data.tokens.scope || tokens.scope,
        token_type: data.tokens.token_type || tokens.token_type,
      };
      
      await storeGoogleTokens(newTokens);
      console.log('✅ Access token refreshed successfully');
      return newTokens;
    }
    
    return null;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

// Get valid tokens (refresh if expired)
export async function getValidTokens(): Promise<GoogleOAuthTokens | null> {
  let tokens = await getGoogleTokens();
  
  if (!tokens) {
    return null;
  }
  
  // If tokens are expired, try to refresh
  if (!areTokensValid(tokens)) {
    console.log('Tokens expired, attempting refresh...');
    tokens = await refreshAccessToken();
  }
  
  return tokens && areTokensValid(tokens) ? tokens : null;
}

// Check if user is connected (with auto-refresh)
export async function isGoogleConnected(): Promise<boolean> {
  const tokens = await getValidTokens();
  return tokens !== null;
}

