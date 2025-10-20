# Google Sheets Auto-Sync Setup Guide

## Overview
Your invoice processing app now automatically saves every processed invoice to your Google Sheet with ID: `1ym0xPhwPKtYUXQTLCB8brozgsa50SEjFlAUr46k_uSY`

## Setup Steps

### 1. Get Google Sheets API Key
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project or select existing one
3. Enable the Google Sheets API
4. Create credentials → API Key
5. Copy the API key

### 2. Configure Auto-Sync
1. Open your invoice app
2. Go to the Google Sheets Sync section
3. Paste your API key in the "API Key" field
4. Click "Enable Auto-Sync"
5. The API key will be saved locally for future use

### 3. Test the Setup
1. Upload an invoice image
2. Once processed, check your Google Sheet
3. The invoice data should appear automatically

## Features

### Auto-Sync
- ✅ Automatically saves every processed invoice
- ✅ Includes all invoice details (merchant, total, date, etc.)
- ✅ Adds headers automatically on first sync
- ✅ Retry logic for failed syncs
- ✅ Non-blocking (won't fail invoice processing if sync fails)

### Manual Sync
- 📊 Export to CSV for manual import
- 🔄 Sync all existing invoices at once
- 📋 Direct link to open your Google Sheet

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
- Processing Time
- Invoice ID

## Troubleshooting

### Auto-sync not working?
1. Check if API key is entered and auto-sync is enabled
2. Verify Google Sheets API is enabled in Google Cloud Console
3. Check browser console for error messages
4. Ensure your Google Sheet has editor permissions

### Failed syncs?
- Failed syncs are automatically queued for retry
- Check the "pending" counter in the auto-sync status
- Manual sync can be used to sync all invoices at once

### Need to change Google Sheet?
- Update the spreadsheet ID in the configuration
- The new sheet will be used for future auto-syncs

## Security Notes
- API key is stored locally in your browser
- Only you can access your Google Sheet
- API key is not shared with any external services
