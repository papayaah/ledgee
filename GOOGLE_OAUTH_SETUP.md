# Google OAuth Setup Guide

This guide will help you set up Google OAuth login for your Ledgee application.

## Prerequisites

You need to have a Google Cloud Project with OAuth 2.0 credentials configured.

## Step 1: Get Your Client Secret

1. Go to [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)
2. Find your OAuth 2.0 Client ID: `502223673862-iq3qs8as56l1d9kqfre879no0bc48mq7.apps.googleusercontent.com`
3. Click on it to view details
4. Copy the **Client Secret** value

## Step 2: Configure Authorized Redirect URIs

In the OAuth 2.0 Client settings, make sure you have added the following redirect URI:

For local development:
```
http://localhost:3000/api/google-auth/callback
```

For production (replace with your actual domain):
```
https://yourdomain.com/api/google-auth/callback
```

## Step 3: Create Environment Variables File

Create a file named `.env.local` in the root of your project with the following content:

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```

**Important:** Replace `your_google_client_id_here` and `your_google_client_secret_here` with your actual Google OAuth credentials from Google Cloud Console.

## Step 4: Restart Your Development Server

After creating the `.env.local` file, restart your Next.js development server:

```bash
npm run dev
```

## Step 5: Test the Connection

1. Navigate to the Settings page in your app
2. Look for the "Google Account" section
3. Click "Connect with Google"
4. You should be redirected to Google's OAuth consent screen
5. Grant the requested permissions:
   - Create and manage Google Sheets
   - Upload files to your Google Drive
   - View your email address and profile
6. After granting permissions, you'll be redirected back to your app
7. You should see a success message with your email address

## Scopes Requested

The application requests the following OAuth scopes:

- `https://www.googleapis.com/auth/spreadsheets` - Create and manage Google Sheets
- `https://www.googleapis.com/auth/drive.file` - Upload invoice images to Google Drive
- `https://www.googleapis.com/auth/userinfo.email` - View your email address
- `https://www.googleapis.com/auth/userinfo.profile` - View your profile information

## Troubleshooting

### Error: "Google OAuth is not configured"
- Make sure you've created the `.env.local` file
- Verify that `GOOGLE_CLIENT_SECRET` is set correctly
- Restart your development server

### Error: "redirect_uri_mismatch"
- Check that you've added the correct redirect URI in Google Cloud Console
- Make sure the URI matches exactly (including http/https and port number)

### Error: "access_denied"
- This means you clicked "Cancel" or "Deny" on the Google consent screen
- Try connecting again and grant the required permissions

## Security Notes

- **Never commit `.env.local` to git** - it's already in `.gitignore`
- The client secret is only used server-side in API routes
- OAuth tokens are stored securely in IndexedDB on the client
- Access tokens expire and will need to be refreshed (refresh token flow will be implemented)

## Next Steps

After successfully connecting your Google account, you'll be able to:
1. Create Google Sheets for your invoice reports
2. Upload invoice images to your Google Drive
3. Share spreadsheets with others
4. Access your data from anywhere

For more information about managing OAuth tokens and implementing additional features, see the main README.md file.

