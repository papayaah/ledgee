# Personal Google Account Mode

## Overview

Ledgee now supports using your personal Google account for all operations instead of the shared service account spreadsheet. This gives you full control over your data in your own Google Drive and Google Sheets.

## Features

### 1. **Google OAuth Login**
- Connect with your personal Google account
- Secure OAuth 2.0 authentication
- Permissions for Google Sheets and Google Drive access

### 2. **Personal Spreadsheet Creation**
- One-click creation of your own "Ledgee" spreadsheet
- Spreadsheet ID is stored and displayed in settings
- Direct link to open your spreadsheet in Google Sheets

### 3. **Google Drive Integration**
- Automatic folder structure creation: `Ledgee/Invoices`
- All invoice images uploaded to your personal Google Drive
- Images stored in the Invoices folder with proper naming
- Public shareable links generated for images

### 4. **Mode Toggle**
- Settings option to switch between:
  - **Personal Mode**: Uses your Google account and Ledgee spreadsheet
  - **Shared Mode**: Uses the default service account spreadsheet
- Toggle is disabled until you:
  1. Connect your Google account
  2. Create a Ledgee spreadsheet

### 5. **Automatic Configuration**
- When you create a Ledgee spreadsheet, Personal Mode is automatically enabled
- All reports and backups will use your personal spreadsheet
- Images are automatically uploaded to your Drive folder

## How to Use

### Initial Setup

1. **Go to Settings**
2. **Connect Google Account**
   - Click "Connect with Google"
   - Grant the required permissions
   - You'll be redirected back to settings

3. **Create Ledgee Spreadsheet**
   - Click "Create Ledgee Spreadsheet"
   - A new spreadsheet will be created in your Google Drive
   - The spreadsheet ID will be displayed

4. **Personal Mode Enabled**
   - The toggle will automatically enable
   - All future operations will use your personal Google account

### Using Personal Mode

Once enabled, all these operations use your personal account:

- **Summary Reports** → Created in your Ledgee spreadsheet
- **By Merchant Reports** → Created in your Ledgee spreadsheet
- **Invoice Images** → Uploaded to `Ledgee/Invoices` folder in your Drive
- **Backup Data** → Stored in your Ledgee spreadsheet

### Switching Modes

You can toggle between Personal and Shared modes anytime:

1. Go to **Settings**
2. Find **"Google Sheets Mode"** section
3. Toggle **"Use Personal Google Account"**
   - ON = Personal Mode (your spreadsheet)
   - OFF = Shared Mode (service account spreadsheet)

## Technical Details

### Architecture

```
User Authentication
    ↓
Google OAuth 2.0
    ↓
Access Token + Refresh Token
    ↓
Stored in IndexedDB (settings table)
    ↓
Used for Google Sheets API + Drive API
```

### Folder Structure

Your Google Drive will have:
```
Google Drive/
└── Ledgee/
    └── Invoices/
        ├── invoice_12345.jpg
        ├── invoice_67890.jpg
        └── ...
```

### Spreadsheet Structure

Your Ledgee spreadsheet will contain:
- **Summary** sheet - All invoices overview
- **By Merchant** sheet - Grouped by merchant
- **Month sheets** - One sheet per month (e.g., "October 2024")
- **Counter Receipts** sheet - Printable receipts

### API Usage

**Personal Mode uses:**
- Google Sheets API v4 with OAuth
- Google Drive API v3 with OAuth
- User's quota (generous free tier)

**Shared Mode uses:**
- Google Sheets API v4 with Service Account
- ImgBB for image hosting
- Shared quota across all users

## Security & Privacy

### Data Storage
- **OAuth tokens**: Stored securely in browser IndexedDB
- **Spreadsheet ID**: Stored in IndexedDB settings
- **Images**: Stored in your personal Google Drive
- **No server-side storage**: All data stays on your machine and Google account

### Permissions
Ledgee requests these Google OAuth scopes:
- `spreadsheets` - Create and manage Google Sheets
- `drive.file` - Upload files to Google Drive
- `userinfo.email` - View your email address
- `userinfo.profile` - View your profile information

### Token Management
- Access tokens expire after 1 hour
- Refresh tokens are stored for automatic renewal
- Disconnect option removes all tokens and data

## Troubleshooting

### "Connect Google account first"
→ You need to connect your Google account in the Settings page

### "Create Ledgee spreadsheet first"
→ After connecting, click "Create Ledgee Spreadsheet"

### "Personal mode not available"
→ Check that you've completed both steps above

### Images not appearing in Drive
→ Check permissions and try reconnecting your Google account

### Reports not generating
→ Try toggling to Shared mode and back, or reconnect your account

## Benefits

### Personal Mode Advantages
- ✅ Full control over your data
- ✅ Can share spreadsheet with others
- ✅ Can edit spreadsheet manually
- ✅ Images stored in your Drive (no expiration)
- ✅ Better privacy (data stays in your account)
- ✅ Can backup/download your spreadsheet

### Shared Mode Advantages
- ✅ No setup required
- ✅ Works immediately
- ✅ No Google account needed
- ✅ Suitable for demo/testing

## Future Enhancements

Potential improvements:
- [ ] Auto-sync to personal spreadsheet on invoice creation
- [ ] Monthly reports as separate spreadsheets
- [ ] Folder customization
- [ ] Multiple spreadsheet support
- [ ] Team sharing features

## API Reference

See implementation files:
- `/src/lib/google-oauth.ts` - OAuth management
- `/src/lib/google-sheets-oauth.ts` - Personal Google Sheets client
- `/src/lib/google-drive-folders.ts` - Drive folder management
- `/src/lib/sheets-client-factory.ts` - Client factory (mode selection)
- `/src/components/GoogleAccountConnect.tsx` - UI component

## Support

For issues or questions:
1. Check Settings → Google Account section for connection status
2. Try disconnecting and reconnecting
3. Check browser console for error messages
4. Toggle between Personal and Shared modes to isolate issues

