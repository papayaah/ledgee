#!/bin/bash

echo "🔧 Setting up Google Sheets integration..."

# Install required dependencies
echo "📦 Installing Google APIs dependencies..."
npm install

echo "✅ Dependencies installed!"

echo ""
echo "🧪 To test the Google Sheets integration:"
echo "1. Run: node test-google-sheets.js"
echo "2. Check your Google Sheet: https://docs.google.com/spreadsheets/d/1ym0xPhwPKtYUXQTLCB8brozgsa50SEjFlAUr46k_uSY"
echo ""
echo "📝 Make sure to:"
echo "- Share your Google Sheet with: revenue-cat@oh-my-receipts.iam.gserviceaccount.com"
echo "- Give it Editor permissions"
echo ""
echo "🚀 Your app is now ready with automatic Google Sheets sync!"
