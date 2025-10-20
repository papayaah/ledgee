'use client';

import React, { useEffect, useState } from 'react';
import { MdCheckCircle, MdSync, MdLogout, MdAddCircle, MdOpenInNew, MdWarning } from 'react-icons/md';
import { FcGoogle } from 'react-icons/fc';
import {
  getValidTokens,
  getGoogleUserInfo,
  storeGoogleTokens,
  storeGoogleUserInfo,
  clearGoogleOAuthData,
  isGoogleConnected,
  storeOAuthState,
  verifyOAuthState,
  GoogleUserInfo,
  GoogleOAuthTokens,
} from '@/lib/google-oauth';
import { db } from '@/lib/database';

interface GoogleAccountConnectProps {
  onConnectionChange?: (isConnected: boolean, hasSpreadsheet: boolean) => void;
  // Removed: usePersonalMode - now always uses Google account
  isGoogleConnected?: boolean;
  hasSpreadsheet?: boolean;
}

export default function GoogleAccountConnect({ 
  onConnectionChange, 
  // Removed: usePersonalMode - now always uses Google account
  isGoogleConnected: propIsGoogleConnected,
  hasSpreadsheet: propHasSpreadsheet
}: GoogleAccountConnectProps = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [userInfo, setUserInfo] = useState<GoogleUserInfo | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [isCreatingSpreadsheet, setIsCreatingSpreadsheet] = useState(false);

  // Check connection status on mount
  useEffect(() => {
    checkConnectionStatus();
  }, []);

  // Handle OAuth callback
  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const authSuccess = params.get('auth_success');
      const authError = params.get('auth_error');
      const state = params.get('state');
      const tokensParam = params.get('tokens');
      const userParam = params.get('user');

      if (authSuccess === 'true' && state && tokensParam) {
        // Verify state
        if (!verifyOAuthState(state)) {
          setMessage({ type: 'error', text: 'Security verification failed. Please try again.' });
          cleanupUrl();
          return;
        }

        try {
          // Parse and store tokens
          const tokens: GoogleOAuthTokens = JSON.parse(decodeURIComponent(tokensParam));
          await storeGoogleTokens(tokens);

          // Parse and store user info if available
          let userName = 'user';
          if (userParam) {
            const user: GoogleUserInfo = JSON.parse(decodeURIComponent(userParam));
            await storeGoogleUserInfo(user);
            setUserInfo(user);
            userName = user.name;
          }

          setIsConnected(true);
          setMessage({ 
            type: 'success', 
            text: `Successfully connected to Google! Welcome ${userName}` 
          });
          setTimeout(() => setMessage(null), 5000);
        } catch (error) {
          console.error('Error processing OAuth callback:', error);
          setMessage({ type: 'error', text: 'Failed to complete connection. Please try again.' });
        }

        cleanupUrl();
      } else if (authError) {
        let errorMessage = `Authentication failed: ${authError}. Please try again.`;
        
        if (authError === 'not_configured') {
          errorMessage = 'Google OAuth is not configured. Please set GOOGLE_CLIENT_SECRET in your environment variables.';
        } else if (authError === 'access_denied') {
          errorMessage = 'Access was denied. Please try again and grant the required permissions.';
        }
        
        setMessage({ 
          type: 'error', 
          text: errorMessage 
        });
        cleanupUrl();
      }
    };

    handleCallback();
  }, []);

  const cleanupUrl = () => {
    // Remove OAuth parameters from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('auth_success');
    url.searchParams.delete('auth_error');
    url.searchParams.delete('state');
    url.searchParams.delete('tokens');
    url.searchParams.delete('user');
    window.history.replaceState({}, '', url.toString());
  };

  const checkConnectionStatus = async () => {
    setIsLoading(true);
    try {
      const connected = await isGoogleConnected();
      setIsConnected(connected);
      
      let hasSheet = false;
      if (connected) {
        const user = await getGoogleUserInfo();
        setUserInfo(user);
        
        // Load spreadsheet ID from settings
        const sheetIdSetting = await db.settings.get('ledgee_spreadsheet_id');
        if (sheetIdSetting?.value) {
          setSpreadsheetId(sheetIdSetting.value);
          hasSheet = true;
        }
      }
      
      // Notify parent component
      if (onConnectionChange) {
        onConnectionChange(connected, hasSheet);
      }
    } catch (error) {
      console.error('Error checking connection status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      // Get auth URL from API
      const response = await fetch('/api/google-auth/login');
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Store state for verification
      storeOAuthState(data.state);

      // Redirect to Google OAuth
      window.location.href = data.authUrl;
    } catch (error) {
      console.error('Error initiating OAuth:', error);
      setMessage({ type: 'error', text: 'Failed to start authentication. Please try again.' });
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await clearGoogleOAuthData();
      setIsConnected(false);
      setUserInfo(null);
      setSpreadsheetId(null);
      setMessage({ type: 'success', text: 'Successfully disconnected from Google' });
      setTimeout(() => setMessage(null), 3000);
      
      // Notify parent component
      if (onConnectionChange) {
        onConnectionChange(false, false);
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
      setMessage({ type: 'error', text: 'Failed to disconnect. Please try again.' });
    }
  };

  const handleCreateSpreadsheet = async () => {
    setIsCreatingSpreadsheet(true);
    setMessage(null);
    
    try {
      const tokens = await getValidTokens();
      if (!tokens || !tokens.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/create-ledgee-spreadsheet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken: tokens.access_token
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create spreadsheet');
      }

      // Store spreadsheet ID in settings
      await db.settings.put({
        key: 'ledgee_spreadsheet_id',
        value: data.spreadsheetId
      });

      setSpreadsheetId(data.spreadsheetId);
      setMessage({ 
        type: 'success', 
        text: 'Ledgee spreadsheet created successfully!' 
      });
      setTimeout(() => setMessage(null), 5000);
      
      // Notify parent component
      if (onConnectionChange) {
        onConnectionChange(true, true);
      }
      
      // Google account is now always used when connected
    } catch (error) {
      console.error('Error creating spreadsheet:', error);
      setMessage({ 
        type: 'error', 
        text: `Failed to create spreadsheet: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setIsCreatingSpreadsheet(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <FcGoogle className="w-6 h-6" />
          <h2 className="text-2xl font-semibold">Google Account</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <MdSync className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Checking connection status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center space-x-3 mb-4">
        <FcGoogle className="w-6 h-6" />
        <h2 className="text-2xl font-semibold">Google Account</h2>
      </div>
      
      <p className="text-muted-foreground mb-6">
        Connect your Google account to create spreadsheets and save invoice images to your Google Drive.
      </p>

      {message && (
        <div className={`mb-4 p-4 rounded-lg border ${
          message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
          message.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

      {!isConnected ? (
        <div className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <h3 className="font-medium mb-2">Permissions Required:</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground flex-shrink-0"></span>
                <span>Create and manage Google Sheets</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground flex-shrink-0"></span>
                <span>Upload files to your Google Drive</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground flex-shrink-0"></span>
                <span>View your email address and profile</span>
              </li>
            </ul>
          </div>

          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full flex items-center justify-center space-x-3 px-6 py-3 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <FcGoogle className="w-5 h-5" />
            <span className="font-medium text-gray-700">
              {isConnecting ? 'Connecting...' : 'Connect with Google'}
            </span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center p-4 bg-green-50 border border-green-200 rounded-lg">
            <MdCheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-green-800">Connected to Google</p>
              {userInfo && (
                <p className="text-sm text-green-700 mt-1">
                  {userInfo.email}
                </p>
              )}
            </div>
            {userInfo?.picture && (
              <img 
                src={userInfo.picture} 
                alt={userInfo.name}
                className="w-10 h-10 rounded-full ml-2"
              />
            )}
          </div>

          <div className="p-4 bg-muted/50 rounded-lg">
            <h3 className="font-medium mb-2">Active Permissions:</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center space-x-2">
                <MdCheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span>Create and manage Google Sheets</span>
              </li>
              <li className="flex items-center space-x-2">
                <MdCheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span>Upload files to your Google Drive</span>
              </li>
              <li className="flex items-center space-x-2">
                <MdCheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span>Access your email and profile</span>
              </li>
            </ul>
          </div>

          {/* Google Integration Info */}
          {spreadsheetId && isConnected && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-start space-x-2">
                <MdCheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800">
                  Google integration enabled. Reports and backups use your Ledgee spreadsheet. Images saved to Google Drive (Ledgee/Invoices).
                </p>
              </div>
            </div>
          )}
          
          {/* Show warning if spreadsheet exists but not connected */}
          {spreadsheetId && !isConnected && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <MdWarning className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-medium text-sm text-yellow-900">Connection Expired</h3>
                  <p className="text-xs text-yellow-800 mt-1">
                    Your Google session has expired. Reconnect to use your personal spreadsheet, or the app will use the shared spreadsheet.
                  </p>
                  <button
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="mt-2 px-3 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors disabled:opacity-50"
                  >
                    {isConnecting ? 'Reconnecting...' : 'Reconnect Google Account'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Ledgee Spreadsheet Section */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-medium mb-3 text-blue-900">Ledgee Spreadsheet</h3>
            
            {!spreadsheetId ? (
              <div className="space-y-3">
                <p className="text-sm text-blue-800">
                  Create a dedicated Google Sheets spreadsheet for Ledgee to store your invoice data.
                </p>
                <button
                  onClick={handleCreateSpreadsheet}
                  disabled={isCreatingSpreadsheet}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <MdAddCircle className="w-5 h-5" />
                  <span className="font-medium">
                    {isCreatingSpreadsheet ? 'Creating Spreadsheet...' : 'Create Ledgee Spreadsheet'}
                  </span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-blue-700 mb-1">Spreadsheet ID:</p>
                  <div className="flex items-center space-x-2">
                    <code className="flex-1 text-xs bg-white border border-blue-300 px-2 py-1 rounded font-mono text-blue-900 overflow-x-auto">
                      {spreadsheetId}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(spreadsheetId);
                        setMessage({ type: 'success', text: 'Spreadsheet ID copied!' });
                        setTimeout(() => setMessage(null), 2000);
                      }}
                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <a
                  href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center space-x-2 px-4 py-2 bg-white border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <MdOpenInNew className="w-4 h-4" />
                  <span className="font-medium text-sm">Open in Google Sheets</span>
                </a>
              </div>
            )}
          </div>

          <button
            onClick={handleDisconnect}
            className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
          >
            <MdLogout className="w-5 h-5" />
            <span className="font-medium">Disconnect Google Account</span>
          </button>
        </div>
      )}
    </div>
  );
}

