'use client';

import React, { useState, useEffect } from 'react';
import { DatabaseInvoice } from '@/types/invoice';
import { GoogleSheetsSync as GoogleSheetsSyncLib } from '@/lib/google-sheets-sync';
import { serviceAccountSync, enableServiceAccountSync, disableServiceAccountSync } from '@/lib/service-account-sync';
import { MdFileDownload, MdSync, MdOpenInNew, MdSummarize, MdStore, MdCalendarMonth, MdReceipt } from 'react-icons/md';

interface GoogleSheetsSyncProps {
  invoices: DatabaseInvoice[];
  disabled?: boolean;
}

export default function GoogleSheetsSync({ invoices, disabled = false }: GoogleSheetsSyncProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCreatingSummary, setIsCreatingSummary] = useState(false);
  const [isCreatingMerchantSummary, setIsCreatingMerchantSummary] = useState(false);
  const [isCreatingMonthSummary, setIsCreatingMonthSummary] = useState(false);
  const [isCreatingReceipt, setIsCreatingReceipt] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [spreadsheetId] = useState('1ym0xPhwPKtYUXQTLCB8brozgsa50SEjFlAUr46k_uSY');
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [retryQueueStatus, setRetryQueueStatus] = useState({ count: 0, isProcessing: false });

  // Load auto-sync preference from localStorage and configure service account sync
  useEffect(() => {
    const savedAutoSync = localStorage.getItem('service-account-sync-enabled');
    
    // Always configure the service account sync with the spreadsheet ID
    serviceAccountSync.updateConfig({
      enabled: true,
      spreadsheetId: spreadsheetId,
      sheetName: 'Invoices'
    });
    
    if (savedAutoSync === 'true') {
      enableServiceAccountSync();
      setAutoSyncEnabled(true);
    }
  }, [spreadsheetId]);

  // Update retry queue status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const status = serviceAccountSync.getRetryQueueStatus();
      setRetryQueueStatus(status);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleCSVExport = async () => {
    setIsExporting(true);
    try {
      const sync = new GoogleSheetsSyncLib({ spreadsheetId: '' });
      sync.downloadCSV(invoices);
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
      // Use service account sync for manual sync as well
      let successCount = 0;
      let failCount = 0;

      for (const invoice of invoices) {
        try {
          const success = await serviceAccountSync.saveInvoice(invoice);
          if (success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          failCount++;
          console.error('Failed to sync invoice:', invoice.id, error);
        }
      }
      
      if (failCount === 0) {
        setSyncStatus(`✅ Successfully synced ${successCount} invoices to Google Sheets!`);
      } else {
        setSyncStatus(`⚠️ Synced ${successCount} invoices, ${failCount} failed. Check console for details.`);
      }
    } catch (error) {
      setSyncStatus('❌ Sync failed: ' + (error as Error).message);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  const handleCreateSummary = async () => {
    setIsCreatingSummary(true);
    setSyncStatus(null);
    try {
      const response = await fetch('/api/create-summary-sheet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoices,
          spreadsheetId
        }),
      });

      const result = await response.json();
      if (result.success) {
        setSyncStatus('✅ Summary sheet created successfully!');
      } else {
        setSyncStatus('❌ Failed to create Summary sheet: ' + result.error);
      }
    } catch (error) {
      setSyncStatus('❌ Failed to create Summary sheet: ' + (error as Error).message);
    } finally {
      setIsCreatingSummary(false);
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  const handleCreateMerchantSummary = async () => {
    setIsCreatingMerchantSummary(true);
    setSyncStatus(null);
    try {
      const response = await fetch('/api/create-merchant-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoices,
          spreadsheetId
        }),
      });

      const result = await response.json();
      if (result.success) {
        setSyncStatus('✅ By Merchant sheet created successfully!');
      } else {
        setSyncStatus('❌ Failed to create By Merchant sheet: ' + result.error);
      }
    } catch (error) {
      setSyncStatus('❌ Failed to create By Merchant sheet: ' + (error as Error).message);
    } finally {
      setIsCreatingMerchantSummary(false);
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  const handleCreateMonthSummary = async () => {
    setIsCreatingMonthSummary(true);
    setSyncStatus(null);
    try {
      const response = await fetch('/api/create-month-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoices,
          spreadsheetId
        }),
      });

      const result = await response.json();
      if (result.success) {
        setSyncStatus(`✅ Month sheets created successfully: ${result.createdSheets?.join(', ') || 'Multiple months'}`);
      } else {
        setSyncStatus('❌ Failed to create month sheets: ' + result.error);
      }
    } catch (error) {
      setSyncStatus('❌ Failed to create month sheets: ' + (error as Error).message);
    } finally {
      setIsCreatingMonthSummary(false);
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  const handleCreateReceipt = async () => {
    setIsCreatingReceipt(true);
    setSyncStatus(null);
    try {
      const response = await fetch('/api/create-receipt-sheet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoices,
          spreadsheetId
        }),
      });

      const result = await response.json();
      if (result.success) {
        setSyncStatus('✅ Receipts sheet created successfully!');
      } else {
        setSyncStatus('❌ Failed to create Receipts sheet: ' + result.error);
      }
    } catch (error) {
      setSyncStatus('❌ Failed to create Receipts sheet: ' + (error as Error).message);
    } finally {
      setIsCreatingReceipt(false);
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  const openGoogleSheets = () => {
    if (spreadsheetId.trim()) {
      window.open(`https://docs.google.com/spreadsheets/d/${spreadsheetId}`, '_blank');
    }
  };

  const handleAutoSyncToggle = () => {
    if (autoSyncEnabled) {
      disableServiceAccountSync();
      setAutoSyncEnabled(false);
      localStorage.setItem('service-account-sync-enabled', 'false');
      setSyncStatus('Auto-sync disabled');
    } else {
      // Configure service account sync before enabling
      serviceAccountSync.updateConfig({
        enabled: true,
        spreadsheetId: spreadsheetId,
        sheetName: 'Invoices'
      });
      enableServiceAccountSync();
      setAutoSyncEnabled(true);
      localStorage.setItem('service-account-sync-enabled', 'true');
      setSyncStatus('Auto-sync enabled');
    }
    setTimeout(() => setSyncStatus(null), 2000);
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Reporting</h3>
          <p className="text-sm text-muted-foreground">
            Export or sync your invoice data to Google Sheets
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Auto-Sync Toggle */}
      <div className="space-y-3 border-b border-border pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium">Auto-Sync</h4>
            <p className="text-sm text-muted-foreground">
              Automatically save new invoices to Google Sheets
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleAutoSyncToggle}
              disabled={disabled}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoSyncEnabled
                  ? 'bg-green-500'
                  : 'bg-gray-300'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoSyncEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            {retryQueueStatus.count > 0 && (
              <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">
                {retryQueueStatus.count} pending
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Export and Sync Actions */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleCSVExport}
            disabled={disabled || isExporting || invoices.length === 0}
            className="px-3 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center space-x-1"
          >
            <MdFileDownload size={16} />
            <span>{isExporting ? 'Exporting...' : 'Export'}</span>
          </button>
          
          <button
            onClick={handleGoogleSheetsSync}
            disabled={disabled || isSyncing || invoices.length === 0}
            className="px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center space-x-1"
          >
            <MdSync size={16} />
            <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
          </button>
          
          <button
            onClick={handleCreateSummary}
            disabled={disabled || isCreatingSummary || invoices.length === 0}
            className="px-3 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center space-x-1"
          >
            <MdSummarize size={16} />
            <span>{isCreatingSummary ? 'Creating...' : 'Summary'}</span>
          </button>
          
          <button
            onClick={handleCreateMerchantSummary}
            disabled={disabled || isCreatingMerchantSummary || invoices.length === 0}
            className="px-3 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center space-x-1"
          >
            <MdStore size={16} />
            <span>{isCreatingMerchantSummary ? 'Creating...' : 'By Merchant'}</span>
          </button>

          <button
            onClick={handleCreateMonthSummary}
            disabled={disabled || isCreatingMonthSummary || invoices.length === 0}
            className="px-3 py-2 bg-teal-500 text-white rounded-md hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center space-x-1"
          >
            <MdCalendarMonth size={16} />
            <span>{isCreatingMonthSummary ? 'Creating...' : 'By Month'}</span>
          </button>

          <button
            onClick={handleCreateReceipt}
            disabled={disabled || isCreatingReceipt || invoices.length === 0}
            className="px-3 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center space-x-1"
          >
            <MdReceipt size={16} />
            <span>{isCreatingReceipt ? 'Creating...' : 'Receipts'}</span>
          </button>
          
          <button
            onClick={openGoogleSheets}
            className="px-3 py-2 bg-muted text-muted-foreground rounded-md hover:bg-muted/80 transition-colors text-sm flex items-center space-x-1"
          >
            <MdOpenInNew size={16} />
            <span>Open</span>
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {syncStatus && (
        <div className={`text-sm p-2 rounded-md ${
          syncStatus.includes('✅') || syncStatus.includes('Successfully') || syncStatus.includes('enabled')
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : syncStatus.includes('❌') || syncStatus.includes('failed') || syncStatus.includes('Error')
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-blue-50 text-blue-700 border border-blue-200'
        }`}>
          {syncStatus}
        </div>
      )}

    </div>
  );
}
