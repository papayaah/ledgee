'use client';

import React, { useState } from 'react';
import { DatabaseInvoice } from '@/types/invoice';
import { GoogleSheetsSync } from '@/lib/google-sheets-sync';

interface GoogleSheetsSyncProps {
  invoices: DatabaseInvoice[];
  disabled?: boolean;
}

export default function GoogleSheetsSync({ invoices, disabled = false }: GoogleSheetsSyncProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [apiKey, setApiKey] = useState('');

  const handleCSVExport = async () => {
    setIsExporting(true);
    try {
      const sync = new GoogleSheetsSync({ spreadsheetId: '' });
      sync.exportToCSV(invoices);
      setSyncStatus('✅ CSV exported successfully!');
    } catch (error) {
      setSyncStatus('❌ Export failed: ' + (error as Error).message);
    } finally {
      setIsExporting(false);
      setTimeout(() => setSyncStatus(null), 3000);
    }
  };

  const handleGoogleSheetsSync = async () => {
    if (!spreadsheetId.trim()) {
      setSyncStatus('❌ Please enter a Google Sheets ID');
      return;
    }

    setIsSyncing(true);
    setSyncStatus('🔄 Syncing to Google Sheets...');
    
    try {
      const sync = new GoogleSheetsSync({ 
        spreadsheetId: spreadsheetId.trim(),
        apiKey: apiKey.trim() || undefined
      });
      
      const success = await sync.syncToGoogleSheets(invoices);
      
      if (success) {
        setSyncStatus('✅ Successfully synced to Google Sheets!');
      } else {
        setSyncStatus('❌ Sync failed. Check your API key and sheet permissions.');
      }
    } catch (error) {
      setSyncStatus('❌ Sync failed: ' + (error as Error).message);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  const openGoogleSheets = () => {
    if (spreadsheetId.trim()) {
      window.open(`https://docs.google.com/spreadsheets/d/${spreadsheetId}`, '_blank');
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Google Sheets Sync</h3>
          <p className="text-sm text-muted-foreground">
            Export or sync your invoice data to Google Sheets
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* CSV Export */}
      <div className="space-y-2">
        <h4 className="font-medium">Quick Export</h4>
        <button
          onClick={handleCSVExport}
          disabled={disabled || isExporting || invoices.length === 0}
          className="w-full px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isExporting ? 'Exporting...' : '📊 Export to CSV'}
        </button>
        <p className="text-xs text-muted-foreground">
          Download CSV file to import into Google Sheets manually
        </p>
      </div>

      {/* Direct Google Sheets Sync */}
      <div className="space-y-3 border-t border-border pt-4">
        <h4 className="font-medium">Direct Sync</h4>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Google Sheets ID</label>
          <input
            type="text"
            value={spreadsheetId}
            onChange={(e) => setSpreadsheetId(e.target.value)}
            placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <p className="text-xs text-muted-foreground">
            Get this from your Google Sheets URL: docs.google.com/spreadsheets/d/[ID]/edit
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">API Key (Optional)</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIzaSyBvOkBw..."
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <p className="text-xs text-muted-foreground">
            <a 
              href="https://console.cloud.google.com/apis/credentials" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Get API key from Google Cloud Console
            </a>
          </p>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={handleGoogleSheetsSync}
            disabled={disabled || isSyncing || invoices.length === 0 || !spreadsheetId.trim()}
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSyncing ? 'Syncing...' : '🔄 Sync to Sheets'}
          </button>
          
          {spreadsheetId.trim() && (
            <button
              onClick={openGoogleSheets}
              className="px-4 py-2 bg-muted text-muted-foreground rounded-md hover:bg-muted/80 transition-colors"
            >
              📋 Open Sheet
            </button>
          )}
        </div>
      </div>

      {/* Status Messages */}
      {syncStatus && (
        <div className={`text-sm p-2 rounded-md ${
          syncStatus.includes('✅') 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : syncStatus.includes('❌')
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-blue-50 text-blue-700 border border-blue-200'
        }`}>
          {syncStatus}
        </div>
      )}

      {/* Instructions */}
      <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md space-y-1">
        <p><strong>Setup Instructions:</strong></p>
        <ol className="list-decimal list-inside space-y-1 ml-2">
          <li>Create a new Google Sheet</li>
          <li>Copy the Sheet ID from the URL</li>
          <li>For direct sync: Enable Google Sheets API and get an API key</li>
          <li>Share the sheet with your API key email (if using API)</li>
        </ol>
      </div>
    </div>
  );
}
