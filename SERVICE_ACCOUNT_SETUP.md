# Google Sheets Service Account Setup Guide

## Overview
Your invoice processing app now uses a **service account** for automatic Google Sheets integration. This is more secure and reliable than API keys.

## ✅ What's Already Configured

### Service Account Details
- **Project**: oh-my-receipts
- **Service Account Email**: revenue-cat@oh-my-receipts.iam.gserviceaccount.com
- **Google Sheet ID**: 1ym0xPhwPKtYUXQTLCB8brozgsa50SEjFlAUr46k_uSY
- **Sheet Name**: Invoices

### Files Created
- `test-google-sheets.js` - Test script to verify connection
- `src/app/api/sync-to-sheets/route.ts` - API endpoint for server-side sync
- `src/lib/service-account-sync.ts` - Client-side sync service
- Updated components to use service account

## 🚀 Quick Setup

### 1. Install Dependencies
```bash
npm install google-auth-library googleapis
```

### 2. Share Your Google Sheet
**IMPORTANT**: You must share your Google Sheet with the service account:

1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/1ym0xPhwPKtYUXQTLCB8brozgsa50SEjFlAUr46k_uSY
2. Click "Share" button
3. Add this email: `revenue-cat@oh-my-receipts.iam.gserviceaccount.com`
4. Set permission to "Editor"
5. Click "Send"

### 3. Test the Connection
```bash
node test-google-sheets.js
```

This will:
- Authenticate with your service account
- Add headers to your sheet (if not present)
- Add a sample invoice row
- Show success/error messages

### 4. Enable Auto-Sync in Your App
1. Open your invoice app
2. Go to Google Sheets Sync section
3. Click "Enable Auto-Sync"
4. Process some invoices - they'll automatically save to your Google Sheet!

## 🔧 How It Works

### Auto-Sync Flow
1. **Invoice Processing**: When you upload an invoice image
2. **AI Extraction**: Invoice data is extracted using AI
3. **Local Storage**: Data is saved to your local database
4. **Auto-Sync**: Data is automatically sent to Google Sheets via service account
5. **Retry Logic**: Failed syncs are queued and retried automatically

### Data Fields Saved
- Date
- Merchant Name
- Total Amount
- Currency
- Agent Name
- Invoice Number
- Payment Method
- Phone Number
- Email
- Items Count
- Created At
- Processing Time (ms)
- Invoice ID

## 🛠️ Technical Details

### Service Account Authentication
- Uses your `oh-my-receipts-e6ca236e43bc.json` service account key
- Authenticates server-side via Next.js API route
- No API keys needed in the browser
- More secure than client-side API keys

### API Endpoint
- **Route**: `/api/sync-to-sheets`
- **Method**: POST
- **Authentication**: Service account (server-side)
- **Scope**: Google Sheets write access

### Error Handling
- Failed syncs are queued for retry
- Non-blocking (won't fail invoice processing)
- Detailed error logging
- Status indicators in UI

## 🧪 Testing

### Test Script
```bash
node test-google-sheets.js
```

### Manual Testing
1. Enable auto-sync in the app
2. Upload an invoice image
3. Check your Google Sheet for the new row
4. Verify all fields are populated correctly

## 🔍 Troubleshooting

### "Permission denied" errors
- Make sure you've shared the Google Sheet with `revenue-cat@oh-my-receipts.iam.gserviceaccount.com`
- Verify the service account has "Editor" permissions

### "Sheet not found" errors
- Check that the Google Sheet ID is correct: `1ym0xPhwPKtYUXQTLCB8brozgsa50SEjFlAUr46k_uSY`
- Ensure the sheet exists and is accessible

### Auto-sync not working
- Check browser console for error messages
- Verify the API route is working: `/api/sync-to-sheets`
- Check server logs for authentication issues

### Dependencies missing
```bash
npm install google-auth-library googleapis
```

## 📊 Monitoring

### Status Indicators
- **🟢 Enabled**: Auto-sync is active
- **⚪ Disabled**: Auto-sync is off
- **Pending counter**: Shows failed syncs queued for retry

### Console Logs
- All sync operations are logged to browser console
- Server-side logs available in Next.js development mode
- Error details help with troubleshooting

## 🔒 Security

### Service Account Benefits
- No API keys exposed in browser
- Server-side authentication only
- Limited scope (Google Sheets only)
- Automatic token refresh

### Data Privacy
- Service account only has access to your specific Google Sheet
- No data is sent to external services
- All operations are logged for audit

## 🎉 You're All Set!

Your invoice processing app now automatically saves every processed invoice to your Google Sheet using a secure service account. No manual exports needed!

**Next Steps:**
1. Share your Google Sheet with the service account
2. Install dependencies: `npm install google-auth-library googleapis`
3. Test with: `node test-google-sheets.js`
4. Enable auto-sync in your app
5. Process invoices and watch them appear in your Google Sheet!
