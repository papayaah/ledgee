'use client';

import React, { useState, useEffect } from 'react';
import { DatabaseInvoice } from '@/types/invoice';
// import { GoogleSheetsClient } from '@/lib/google-sheets-client'; // Removed - had secrets
import { useUserPreferencesStore } from '@/store/userPreferencesStore';
import { createSheetsClient, SheetsClientInterface, isGoogleSheetsReady } from '@/lib/sheets-client-factory';
import { getValidTokens } from '@/lib/google-oauth';
import { db } from '@/lib/database';
import { MdOpenInNew, MdSummarize, MdStore, MdCalendarMonth, MdReceipt, MdDeleteSweep, MdRocketLaunch, MdAdd, MdWarning } from 'react-icons/md';

interface GoogleSheetsSyncClientProps {
  invoices: DatabaseInvoice[];
  disabled?: boolean;
}

export default function GoogleSheetsSyncClient({ invoices, disabled = false }: GoogleSheetsSyncClientProps) {
  const { showCurrencyInReports, reportDateFormat } = useUserPreferencesStore();
  // Removed unused: isExporting
  const [isCreatingSummary, setIsCreatingSummary] = useState(false);
  const [isCreatingMerchantSummary, setIsCreatingMerchantSummary] = useState(false);
  const [isCreatingMonthSummary, setIsCreatingMonthSummary] = useState(false);
  const [isCreatingReceipt, setIsCreatingReceipt] = useState(false);
  const [isDeletingReports, setIsDeletingReports] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState<{ current: number; total: number; reportName: string } | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState('1ym0xPhwPKtYUXQTLCB8brozgsa50SEjFlAUr46k_uSY');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [sheetsClient, setSheetsClient] = useState<SheetsClientInterface | null>(null);
  // Removed unused: clientMode
  const [isCreatingSpreadsheet, setIsCreatingSpreadsheet] = useState(false);
  const [needsConnection, setNeedsConnection] = useState(false);
  const [needsSpreadsheet, setNeedsSpreadsheet] = useState(false);

  // Initialize Google Sheets client
  useEffect(() => {
    const initializeClient = async () => {
      try {
        const { needsConnection: needsConn, needsSpreadsheet: needsSheet } = await isGoogleSheetsReady();
        setNeedsConnection(needsConn);
        setNeedsSpreadsheet(needsSheet);
        
        if (needsConn) {
          setSyncStatus('Please connect your Google account first');
          setIsInitialized(true);
          return;
        }
        
        if (needsSheet) {
          setSyncStatus('Please create a Google Sheet first');
          setIsInitialized(true);
          return;
        }
        
        const { client, mode } = await createSheetsClient(showCurrencyInReports, reportDateFormat);
        setSheetsClient(client);
        setIsInitialized(true);
        setIsAuthenticated(true);
        
        // Update spreadsheet ID if connected
        if (mode === 'connected' && client.getSpreadsheetUrl) {
          const url = client.getSpreadsheetUrl();
          const id = url.split('/d/')[1]?.split('/')[0];
          if (id) setSpreadsheetId(id);
        }
        
        setSyncStatus('Google Sheets initialized');
        console.log('Google Sheets client initialized');
        setTimeout(() => setSyncStatus(null), 3000);
      } catch (error) {
        console.error('Failed to initialize Google Sheets client:', error);
        setSyncStatus('Failed to initialize Google Sheets');
        setTimeout(() => setSyncStatus(null), 5000);
        setIsInitialized(true);
      }
    };

    initializeClient();
  }, [showCurrencyInReports, reportDateFormat]);

  const handleCreateSpreadsheet = async () => {
    setIsCreatingSpreadsheet(true);
    setSyncStatus('Creating Ledgee spreadsheet...');
    
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
      setSyncStatus('Ledgee spreadsheet created successfully!');
      
      // Reinitialize the client
      const { client, mode } = await createSheetsClient(showCurrencyInReports, reportDateFormat);
      setSheetsClient(client);
      setClientMode(mode);
      setIsAuthenticated(true);
      setNeedsSpreadsheet(false);
      
      setTimeout(() => setSyncStatus(null), 5000);
    } catch (error) {
      console.error('Error creating spreadsheet:', error);
      setSyncStatus(`Failed to create spreadsheet: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTimeout(() => setSyncStatus(null), 5000);
    } finally {
      setIsCreatingSpreadsheet(false);
    }
  };

  // Removed unused: handleCSVExport

  const handleCreateSummary = async () => {
    if (!sheetsClient || !isAuthenticated) {
      setSyncStatus('Please authenticate with Google Sheets first');
      return;
    }

    setIsCreatingSummary(true);
    setSyncStatus(null);
    try {
      const success = await sheetsClient.createSummarySheet(invoices);
      if (success) {
        setSyncStatus('Summary sheet created successfully');
      } else {
        setSyncStatus('Failed to create Summary sheet');
      }
    } catch (error) {
      setSyncStatus('Failed to create Summary sheet: ' + (error as Error).message);
    } finally {
      setIsCreatingSummary(false);
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  const handleCreateMerchantSummary = async () => {
    if (!sheetsClient || !isAuthenticated) {
      setSyncStatus('Please authenticate with Google Sheets first');
      return;
    }

    setIsCreatingMerchantSummary(true);
    setSyncStatus(null);
    try {
      const success = await sheetsClient.createByMerchantSheet(invoices);
      if (success) {
        setSyncStatus('By Merchant sheet created successfully');
      } else {
        setSyncStatus('Failed to create By Merchant sheet');
      }
    } catch (error) {
      setSyncStatus('Failed to create By Merchant sheet: ' + (error as Error).message);
    } finally {
      setIsCreatingMerchantSummary(false);
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  const handleCreateMonthSummary = async () => {
    if (!sheetsClient || !isAuthenticated) {
      setSyncStatus('Please authenticate with Google Sheets first');
      return;
    }

    setIsCreatingMonthSummary(true);
    setSyncStatus(null);
    try {
      if (sheetsClient.createMonthSheets) {
        const createdSheets = await sheetsClient.createMonthSheets(invoices);
        if (createdSheets.length > 0) {
          setSyncStatus(`Month sheets created successfully: ${createdSheets.join(', ')}`);
        } else {
          setSyncStatus('Failed to create month sheets');
        }
      } else {
        setSyncStatus('Month sheets not available');
      }
    } catch (error) {
      setSyncStatus('Failed to create month sheets: ' + (error as Error).message);
    } finally {
      setIsCreatingMonthSummary(false);
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  const handleCreateReceipt = async () => {
    if (!sheetsClient || !isAuthenticated) {
      setSyncStatus('Please authenticate with Google Sheets first');
      return;
    }

    setIsCreatingReceipt(true);
    setSyncStatus(null);
    try {
      if (sheetsClient.createReceiptsSheet) {
        const success = await sheetsClient.createReceiptsSheet(invoices);
        if (success) {
          setSyncStatus('Counter Receipts sheet created successfully');
        } else {
          setSyncStatus('Failed to create Counter Receipts sheet');
        }
      } else {
        setSyncStatus('Counter Receipts not available');
      }
    } catch (error) {
      setSyncStatus('Failed to create Counter Receipts sheet: ' + (error as Error).message);
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

  const handleGenerateAllReports = async () => {
    if (!sheetsClient || !isAuthenticated) {
      setSyncStatus('Please authenticate with Google Sheets first');
      return;
    }

    setIsGeneratingAll(true);
    setSyncStatus('🚀 Starting report generation...');
    
    const totalSteps = 5; // 1 deletion step + 4 generation steps
    let currentStep = 0;
    let successCount = 0;
    let failedCount = 0;
    
    try {
      // Step 1: Delete all existing reports first
      currentStep++;
      setGeneratingProgress({ current: currentStep, total: totalSteps, reportName: 'Deleting old reports' });
      setSyncStatus(`Deleting old reports... (${currentStep}/${totalSteps})`);
      
      try {
        if (sheetsClient.deleteAllReports) {
          await sheetsClient.deleteAllReports();
          console.log('Old reports deleted successfully');
        }
      } catch (error) {
        console.error('Failed to delete old reports:', error);
        // Continue anyway - they might not exist
      }
      
      // Steps 2-5: Generate new reports
      const reports = [
        { name: 'Summary', fn: () => sheetsClient.createSummarySheet(invoices) },
        { name: 'By Merchant', fn: () => sheetsClient.createByMerchantSheet(invoices) },
        { name: 'By Month', fn: () => sheetsClient.createMonthSheets ? sheetsClient.createMonthSheets(invoices) : Promise.resolve([]) },
        { name: 'Counter Receipts', fn: () => sheetsClient.createReceiptsSheet ? sheetsClient.createReceiptsSheet(invoices) : Promise.resolve(false) }
      ];
      
      // Generate reports sequentially to show progress
      for (let i = 0; i < reports.length; i++) {
        currentStep++;
        const report = reports[i];
        setGeneratingProgress({ current: currentStep, total: totalSteps, reportName: report.name });
        setSyncStatus(`📊 Generating ${report.name}... (${currentStep}/${totalSteps})`);
        
        try {
          await report.fn();
          successCount++;
        } catch (error) {
          console.error(`Failed to generate ${report.name}:`, error);
          failedCount++;
        }
      }
      
      // Final status
      if (successCount === reports.length) {
        setSyncStatus('All reports generated successfully');
      } else if (successCount > 0) {
        setSyncStatus(`${successCount} report(s) succeeded, ${failedCount} failed`);
      } else {
        setSyncStatus('Failed to generate reports');
      }
    } catch (error) {
      setSyncStatus('Failed to generate reports: ' + (error as Error).message);
    } finally {
      setIsGeneratingAll(false);
      setGeneratingProgress(null);
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  const handleDeleteAllReports = async () => {
    if (!sheetsClient || !isAuthenticated) {
      setSyncStatus('Please authenticate with Google Sheets first');
      return;
    }

    if (!confirm('Are you sure you want to delete all generated report sheets? This cannot be undone.')) {
      return;
    }

    setIsDeletingReports(true);
    setSyncStatus(null);
    try {
      if (sheetsClient.deleteAllReports) {
        const success = await sheetsClient.deleteAllReports();
        if (success) {
          setSyncStatus('All report sheets deleted successfully');
        } else {
          setSyncStatus('Failed to delete report sheets');
        }
      } else {
        setSyncStatus('Delete not available for this mode');
      }
    } catch (error) {
      setSyncStatus('Failed to delete report sheets: ' + (error as Error).message);
    } finally {
      setIsDeletingReports(false);
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  // Inline loading will be shown inside the card instead of swapping the whole content

  // Show connection required message
  if (needsConnection) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="text-center py-8">
          <MdWarning className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Google Account Required</h2>
          <p className="text-muted-foreground mb-6">
            Please connect your Google account in Settings to use Google Sheets integration.
          </p>
          <a 
            href="/settings" 
            className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
          >
            Go to Settings
          </a>
        </div>
      </div>
    );
  }

  // Show spreadsheet creation option
  if (needsSpreadsheet) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="text-center py-8">
          <MdAdd className="w-12 h-12 text-blue-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Create Your Ledgee Spreadsheet</h2>
          <p className="text-muted-foreground mb-6">
            Create a dedicated Google Sheet for your invoice data and reports.
          </p>
          <button
            onClick={handleCreateSpreadsheet}
            disabled={isCreatingSpreadsheet}
            className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isCreatingSpreadsheet ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Creating...
              </>
            ) : (
              <>
                <MdAdd className="w-4 h-4 mr-2" />
                Create Spreadsheet
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Google Sheets Export</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create sheets from your {invoices.length} invoice{invoices.length !== 1 ? 's' : ''} in different formats
          </p>
        </div>
        {!isInitialized && (
          <div className="flex items-center text-sm text-muted-foreground">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
            Initializing...
          </div>
        )}
      </div>

      {/* Generate All Reports - Big Prominent Button */}
      <div className="mb-6">
        <button
          onClick={handleGenerateAllReports}
          disabled={disabled || isGeneratingAll || invoices.length === 0 || !isAuthenticated || !isInitialized}
          className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex items-center justify-center space-x-3"
        >
          {isGeneratingAll && generatingProgress ? (
            <>
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <div className="flex flex-col items-start">
                <span className="text-lg font-bold">
                  {generatingProgress.reportName === 'Deleting old reports' 
                    ? 'Deleting old reports...' 
                    : `Generating ${generatingProgress.reportName}...`}
                </span>
                <span className="text-sm opacity-90">
                  Progress: {generatingProgress.current}/{generatingProgress.total}
                </span>
              </div>
            </>
          ) : isGeneratingAll ? (
            <>
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span className="text-lg font-bold">Preparing...</span>
            </>
          ) : (
            <>
              <MdRocketLaunch size={24} />
              <span className="text-lg font-bold">Generate All Reports</span>
            </>
          )}
        </button>
        <p className="text-center text-xs text-muted-foreground mt-2">
          Creates Summary, By Merchant, By Month, and Counter Receipts in one click
        </p>
      </div>

      {/* Divider */}
      <div className="border-t border-border my-6"></div>

      {/* Export Options - 2 Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Summary Sheet */}
        <div className="flex items-start space-x-4">
          <button
            onClick={handleCreateSummary}
            disabled={disabled || isCreatingSummary || invoices.length === 0 || !isAuthenticated || !isInitialized}
            className="w-48 px-4 py-2.5 bg-purple-500 text-white rounded-md hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
          >
            <MdSummarize size={18} />
            <span className="text-sm font-medium whitespace-nowrap">{isCreatingSummary ? 'Creating...' : 'Create Summary'}</span>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground font-medium">Summary Overview</p>
            <p className="text-xs text-muted-foreground">Comprehensive overview with totals and stats</p>
          </div>
        </div>

        {/* By Merchant */}
        <div className="flex items-start space-x-4">
          <button
            onClick={handleCreateMerchantSummary}
            disabled={disabled || isCreatingMerchantSummary || invoices.length === 0 || !isAuthenticated || !isInitialized}
            className="w-48 px-4 py-2.5 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
          >
            <MdStore size={18} />
            <span className="text-sm font-medium whitespace-nowrap">{isCreatingMerchantSummary ? 'Creating...' : 'Create By Merchant'}</span>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground font-medium">Merchant Analysis</p>
            <p className="text-xs text-muted-foreground">Group invoices by merchant with totals</p>
          </div>
        </div>

        {/* By Month */}
        <div className="flex items-start space-x-4">
          <button
            onClick={handleCreateMonthSummary}
            disabled={disabled || isCreatingMonthSummary || invoices.length === 0 || !isAuthenticated || !isInitialized}
            className="w-48 px-4 py-2.5 bg-teal-500 text-white rounded-md hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
          >
            <MdCalendarMonth size={18} />
            <span className="text-sm font-medium whitespace-nowrap">{isCreatingMonthSummary ? 'Creating...' : 'Create By Month'}</span>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground font-medium">Monthly Breakdown</p>
            <p className="text-xs text-muted-foreground">Monthly spending trends and patterns</p>
          </div>
        </div>

        {/* Counter Receipts */}
        <div className="flex items-start space-x-4">
          <button
            onClick={handleCreateReceipt}
            disabled={disabled || isCreatingReceipt || invoices.length === 0 || !isAuthenticated || !isInitialized}
            className="w-48 px-4 py-2.5 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
          >
            <MdReceipt size={18} />
            <span className="text-sm font-medium whitespace-nowrap">{isCreatingReceipt ? 'Creating...' : 'Create Counter Receipts'}</span>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground font-medium">Counter Receipts</p>
            <p className="text-xs text-muted-foreground">Printable counter receipt format</p>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border my-4"></div>

      {/* Actions - Open Sheet & Delete All */}
      <div className="space-y-3">
        <div className="flex items-start space-x-4">
          <button
            onClick={openGoogleSheets}
            className="w-48 px-4 py-2.5 bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors flex items-center justify-center space-x-2"
          >
            <MdOpenInNew size={18} />
            <span className="text-sm font-medium whitespace-nowrap">Open Sheet</span>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground font-medium">View in Google Sheets</p>
            <p className="text-xs text-muted-foreground">Open the spreadsheet to view and edit</p>
          </div>
        </div>

        <div className="flex items-start space-x-4">
          <button
            onClick={handleDeleteAllReports}
            disabled={disabled || isDeletingReports || !isAuthenticated}
            className="w-48 px-4 py-2.5 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
          >
            <MdDeleteSweep size={18} />
            <span className="text-sm font-medium whitespace-nowrap">{isDeletingReports ? 'Deleting...' : 'Delete All Reports'}</span>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground font-medium">Clear All Generated Sheets</p>
            <p className="text-xs text-muted-foreground">Remove all generated report tabs (Summary, By Merchant, By Month, Counter Receipts)</p>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {syncStatus && (
        <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
          <p className="text-sm text-blue-800">{syncStatus}</p>
        </div>
      )}

      {/* Footer Info */}
      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">
          Using service account for authentication
        </p>
      </div>
    </div>
  );
}
