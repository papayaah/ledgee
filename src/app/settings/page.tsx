'use client';

import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useUserPreferencesStore } from '@/store/userPreferencesStore';
import { useInvoiceQueueStore } from '@/store/invoiceQueueStore';
import DeleteAllData from '@/components/DeleteAllData';
import GoogleAccountConnect from '@/components/GoogleAccountConnect';
import { invoiceDb } from '@/lib/database';
import { backupSync } from '@/lib/backup-sync';
import { useAIProvider } from '@/contexts/AIProviderContext';
import { useAIAvailabilityStore } from '@/store/aiAvailabilityStore';
import { MdSettings, MdAttachMoney, MdDeleteSweep, MdCloudSync, MdCloudDownload, MdSmartToy, MdCheckCircle, MdWarning, MdInfo, MdSpeed } from 'react-icons/md';
// import { FcGoogle } from 'react-icons/fc';
import { db } from '@/lib/database';

export default function SettingsPage() {
  const { currency, setCurrency, showCurrencyInReports, setShowCurrencyInReports, reportDateFormat, setReportDateFormat } = useUserPreferencesStore();
  const { clearQueue } = useInvoiceQueueStore();
  const { useOnlineGemini, setUseOnlineGemini, geminiApiKey, setGeminiApiKey } = useAIProvider();
  const { isAvailable: aiAvailable, checkAvailability } = useAIAvailabilityStore();
  const [isRestoring, setIsRestoring] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  // Track Google connection at runtime for UI only
  // Removed runtime flags to avoid unused warnings; connection state is shown within GoogleAccountConnect
  // removed unused setters
  const [apiKeyInput, setApiKeyInput] = useState(geminiApiKey || '');

  // Fetch AI performance data
  const aiInvoicesRaw = useLiveQuery(
    async () => {
      const allInvoices = await db.invoices.toArray();
      return allInvoices.filter(inv => inv.aiExtractedFrom === 'image' && inv.aiResponseTime);
    },
    []
  );
  const aiInvoices = useMemo(() => aiInvoicesRaw ?? [], [aiInvoicesRaw]);

  // Calculate AI performance stats
  const aiStats = useMemo(() => {
    const formatTime = (ms: number): string => {
      if (ms < 1000) return `${ms}ms`;
      return `${(ms / 1000).toFixed(1)}s`;
    };

    const byModel: { [key: string]: { count: number; totalTime: number; times: number[] } } = {};
    
    aiInvoices.forEach(invoice => {
      const model = invoice.aiModel || 'unknown';
      if (!byModel[model]) {
        byModel[model] = { count: 0, totalTime: 0, times: [] };
      }
      byModel[model].count++;
      byModel[model].totalTime += invoice.aiResponseTime || 0;
      byModel[model].times.push(invoice.aiResponseTime || 0);
    });

    const stats = Object.entries(byModel).map(([model, data]) => ({
      name: model === 'chrome-builtin' ? 'Chrome AI' : model === 'gemini-api' ? 'Gemini API' : 'Unknown',
      avgTime: data.count > 0 ? Math.round(data.totalTime / data.count) : 0,
      count: data.count,
      minTime: Math.min(...data.times),
      maxTime: Math.max(...data.times)
    }));

    return { stats, totalExtracted: aiInvoices.length, formatTime };
  }, [aiInvoices]);

  // Sync API key input with context
  useEffect(() => {
    setApiKeyInput(geminiApiKey || '');
  }, [geminiApiKey]);

  // Check AI status and Google connection
  useEffect(() => {
    const checkStatus = async () => {
      try {
        // Use cached AI availability check
        await checkAvailability();
        
        // Check Google connection and spreadsheet
        const { isGoogleConnected } = await import('@/lib/google-oauth');
        const { db } = await import('@/lib/database');
        const connected = await isGoogleConnected();
        
        if (connected) {
          await db.settings.get('ledgee_spreadsheet_id');
        }
      } catch (error) {
        console.error('Failed to check status:', error);
      }
    };

    checkStatus();
  }, [checkAvailability]);

  const handleDeleteAllData = useCallback(async () => {
    try {
      await invoiceDb.clearAllData();
      await clearQueue(); // Also clear the queue store state
      console.log('All data deleted successfully');
      setMessage({ type: 'success', text: 'All data deleted successfully - invoices, queue, stores, merchants, and agents cleared' });
      setTimeout(() => setMessage(null), 5000);
    } catch (error) {
      console.error('Failed to delete all data:', error);
      setMessage({ type: 'error', text: 'Failed to delete all data. Please try again.' });
      setTimeout(() => setMessage(null), 5000);
    }
  }, [clearQueue]);

  const handleSyncAllData = useCallback(async () => {
    setIsSyncing(true);
    setMessage(null);
    try {
      const results = await backupSync.syncAllData();
      setMessage({ 
        type: 'success', 
        text: `Successfully synced all data to backup: ${results.invoices} invoices, ${results.stores} stores, ${results.merchants} merchants, ${results.agents} agents` 
      });
      console.log('Full sync complete:', results);
      setTimeout(() => setMessage(null), 8000);
    } catch (error) {
      console.error('Failed to sync all data:', error);
      setMessage({ type: 'error', text: 'Failed to sync all data. Please try again. Check console for details.' });
      setTimeout(() => setMessage(null), 8000);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const [restoreConfirm, setRestoreConfirm] = useState(false);

  const handleSaveApiKey = useCallback(() => {
    const trimmedKey = apiKeyInput.trim();
    if (trimmedKey) {
      setGeminiApiKey(trimmedKey);
      setMessage({ type: 'success', text: 'Gemini API key saved successfully' });
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage({ type: 'error', text: 'Please enter a valid API key' });
      setTimeout(() => setMessage(null), 3000);
    }
  }, [apiKeyInput, setGeminiApiKey]);

  const handleRestoreFromBackup = useCallback(async () => {
    if (!restoreConfirm) {
      setMessage({ 
        type: 'info', 
        text: 'Click "Restore from Backup" again to confirm. This will restore all data from Google Sheets backup.' 
      });
      setRestoreConfirm(true);
      setTimeout(() => {
        setRestoreConfirm(false);
        setMessage(null);
      }, 5000);
      return;
    }

    setRestoreConfirm(false);
    setIsRestoring(true);
    setMessage(null);
    try {
      // Check if user has a personal spreadsheet
      const { db } = await import('@/lib/database');
      const sheetIdSetting = await db.settings.get('ledgee_spreadsheet_id');
      if (!sheetIdSetting?.value) {
        throw new Error('No Ledgee spreadsheet found. Please create a Ledgee spreadsheet first in the Google Account section above.');
      }

      // Check if backup sheet exists
      const { isGoogleSheetsReady } = await import('@/lib/sheets-client-factory');
      const { ready } = await isGoogleSheetsReady();
      if (!ready) {
        throw new Error('Google Sheets not ready. Please ensure you are connected to Google and have created a Ledgee spreadsheet.');
      }

      // Restore all entities
      const [restoredInvoices, restoredStores, restoredMerchants, restoredAgents] = await Promise.all([
        backupSync.restoreInvoices(),
        backupSync.restoreStores(),
        backupSync.restoreMerchants(),
        backupSync.restoreAgents()
      ]);
      
      // Import all entities directly to database
      
      // Restore stores
      for (const store of restoredStores) {
        await db.stores.put(store);
      }

      // Restore merchants
      for (const merchant of restoredMerchants) {
        await db.merchants.put(merchant);
      }

      // Restore agents
      for (const agent of restoredAgents) {
        await db.agents.put(agent);
      }

      // Restore invoices
      for (const invoice of restoredInvoices) {
        await invoiceDb.saveInvoice(invoice);
      }

      const totalRestored = restoredInvoices.length + restoredStores.length + restoredMerchants.length + restoredAgents.length;
      setMessage({ 
        type: 'success', 
        text: `Successfully restored: ${restoredInvoices.length} invoices, ${restoredStores.length} stores, ${restoredMerchants.length} merchants, ${restoredAgents.length} agents` 
      });
      console.log(`Restored ${totalRestored} records from Google Sheets backup`);
      setTimeout(() => setMessage(null), 8000);
    } catch (error) {
      console.error('Failed to restore from backup:', error);
      setMessage({ type: 'error', text: 'Failed to restore from backup. Please try again.' });
      setTimeout(() => setMessage(null), 8000);
    } finally {
      setIsRestoring(false);
    }
  }, [restoreConfirm]);

  return (
    <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-full flex flex-col">
      <div className="space-y-8 flex-1">
        {/* Page Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-3">
            <MdSettings className="w-10 h-10 text-primary" />
            <h1 className="text-4xl font-bold brand-gradient">
              Settings
            </h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Configure your Ledgee preferences and manage your data.
          </p>
        </div>

        {/* Two-column grid on md (768px) and up, single column on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Google Account Connection - with integrated mode toggle */}
        <div className="bg-gradient-to-br from-blue-50/80 to-purple-50/80 rounded-lg p-1">
          <GoogleAccountConnect />
        </div>

        {/* Currency & Reports Settings */}
        <div className="bg-gradient-to-br from-green-50/80 to-emerald-50/80 rounded-lg p-1">
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <MdAttachMoney className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-semibold">Currency & Reports</h2>
          </div>
          <p className="text-muted-foreground mb-6">
            Configure currency and report formatting preferences.
          </p>
          
          <h3 className="font-medium mb-3">Default Currency</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* USD Option */}
            <button
              onClick={() => setCurrency('USD')}
              className={`
                flex items-center justify-between p-4 rounded-lg border-2 transition-all duration-200
                ${currency === 'USD' 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
                }
              `}
            >
              <div className="flex items-center space-x-3">
                <div className={`
                  w-5 h-5 rounded-full border-2 flex items-center justify-center
                  ${currency === 'USD' ? 'border-primary' : 'border-border'}
                `}>
                  {currency === 'USD' && (
                    <div className="w-3 h-3 rounded-full bg-primary"></div>
                  )}
                </div>
                <div className="text-left">
                  <div className="font-semibold text-lg">US Dollar</div>
                  <div className="text-sm text-muted-foreground">USD ($)</div>
                </div>
              </div>
              <div className="text-3xl">$</div>
            </button>

            {/* PHP Option */}
            <button
              onClick={() => setCurrency('PHP')}
              className={`
                flex items-center justify-between p-4 rounded-lg border-2 transition-all duration-200
                ${currency === 'PHP' 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
                }
              `}
            >
              <div className="flex items-center space-x-3">
                <div className={`
                  w-5 h-5 rounded-full border-2 flex items-center justify-center
                  ${currency === 'PHP' ? 'border-primary' : 'border-border'}
                `}>
                  {currency === 'PHP' && (
                    <div className="w-3 h-3 rounded-full bg-primary"></div>
                  )}
                </div>
                <div className="text-left">
                  <div className="font-semibold text-lg">Philippine Peso</div>
                  <div className="text-sm text-muted-foreground">PHP (₱)</div>
                </div>
              </div>
              <div className="text-3xl">₱</div>
            </button>
          </div>

          {/* Reports Formatting */}
          <div className="mt-6 pt-6 border-t border-border">
            <h3 className="font-medium mb-3">Report Formatting</h3>
            
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg mb-4">
              <div className="flex-1">
                <h4 className="font-medium text-sm">Show Currency Symbol</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {showCurrencyInReports 
                    ? 'Currency symbols will be shown in reports (₱1,234.56)' 
                    : 'Reports will show plain numbers (1,234.56)'
                  }
                </p>
              </div>
              <button
                onClick={() => setShowCurrencyInReports(!showCurrencyInReports)}
                className={`
                  relative inline-flex h-8 w-14 items-center rounded-full transition-colors
                  ${showCurrencyInReports ? 'bg-primary' : 'bg-muted-foreground'}
                `}
              >
                <span
                  className={`
                    inline-block h-6 w-6 transform rounded-full bg-white transition-transform
                    ${showCurrencyInReports ? 'translate-x-7' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>

            <div>
              <h4 className="font-medium text-sm mb-2">Date Format</h4>
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => setReportDateFormat('MM/DD/YYYY')}
                  className={`
                    flex items-center justify-between p-3 rounded-lg border-2 transition-all duration-200
                    ${reportDateFormat === 'MM/DD/YYYY' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }
                  `}
                >
                  <span className="text-sm font-medium">MM/DD/YYYY</span>
                  <span className="text-xs text-muted-foreground">10/16/2025</span>
                </button>
                <button
                  onClick={() => setReportDateFormat('DD/MM/YYYY')}
                  className={`
                    flex items-center justify-between p-3 rounded-lg border-2 transition-all duration-200
                    ${reportDateFormat === 'DD/MM/YYYY' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }
                  `}
                >
                  <span className="text-sm font-medium">DD/MM/YYYY</span>
                  <span className="text-xs text-muted-foreground">16/10/2025</span>
                </button>
                <button
                  onClick={() => setReportDateFormat('YYYY-MM-DD')}
                  className={`
                    flex items-center justify-between p-3 rounded-lg border-2 transition-all duration-200
                    ${reportDateFormat === 'YYYY-MM-DD' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }
                  `}
                >
                  <span className="text-sm font-medium">YYYY-MM-DD</span>
                  <span className="text-xs text-muted-foreground">2025-10-16</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* AI Provider Settings */}
        <div className="bg-gradient-to-br from-orange-50/80 to-yellow-50/80 rounded-lg p-1">
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <MdSmartToy className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-semibold">AI Provider</h2>
          </div>
          <p className="text-muted-foreground mb-6">
            Choose between Chrome's built-in AI or Online Gemini for invoice extraction.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Chrome AI Option */}
            <button
              onClick={() => setUseOnlineGemini(false)}
              className={`
                flex flex-col items-start p-4 rounded-lg border-2 transition-all duration-200
                ${!useOnlineGemini 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
                }
              `}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <div className={`
                  w-5 h-5 rounded-full border-2 flex items-center justify-center
                  ${!useOnlineGemini ? 'border-primary' : 'border-border'}
                `}>
                  {!useOnlineGemini && (
                    <div className="w-3 h-3 rounded-full bg-primary"></div>
                  )}
                </div>
                <div className={`w-3 h-3 rounded-full ${
                  aiAvailable ? 'bg-green-400' : 'bg-red-400'
                }`}></div>
              </div>
              <div className="text-left w-full">
                <div className="font-semibold text-base">Chrome Built-in AI</div>
                <div className="text-sm text-muted-foreground mt-1 flex items-center space-x-1">
                  {aiAvailable ? (
                    <>
                      <MdCheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span>Available - Offline capable</span>
                    </>
                  ) : (
                    <>
                      <MdWarning className="w-4 h-4 text-red-600 flex-shrink-0" />
                      <span>Not available - Setup required</span>
                    </>
                  )}
                </div>
              </div>
            </button>

            {/* Online Gemini Option */}
            <button
              onClick={() => setUseOnlineGemini(true)}
              className={`
                flex flex-col items-start p-4 rounded-lg border-2 transition-all duration-200
                ${useOnlineGemini 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
                }
              `}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <div className={`
                  w-5 h-5 rounded-full border-2 flex items-center justify-center
                  ${useOnlineGemini ? 'border-primary' : 'border-border'}
                `}>
                  {useOnlineGemini && (
                    <div className="w-3 h-3 rounded-full bg-primary"></div>
                  )}
                </div>
                <div className="w-3 h-3 rounded-full bg-blue-400"></div>
              </div>
              <div className="text-left w-full">
                <div className="font-semibold text-base">Online Gemini AI</div>
                <div className="text-sm text-muted-foreground mt-1 flex items-center space-x-1">
                  <MdCheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span>Always available - Requires internet</span>
                </div>
              </div>
            </button>
          </div>

          {useOnlineGemini && (
            <>
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start space-x-2">
                <MdInfo className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800">
                  Using Online Gemini AI - Internet connection required for invoice processing
                </p>
              </div>

              {/* Gemini API Key Input */}
              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-2">Gemini API Key *</label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Get your free API key from{' '}
                    <a 
                      href="https://aistudio.google.com/apikey" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Google AI Studio
                    </a>
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="Enter your Gemini API key"
                      className="flex-1 px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      onClick={handleSaveApiKey}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
                    >
                      Save
                    </button>
                  </div>
                </div>
                {!geminiApiKey && (
                  <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                    ⚠️ API key required for Online Gemini AI to work
                  </div>
                )}
                {geminiApiKey && (
                  <div className="p-2 bg-green-50 border border-green-200 rounded text-xs text-green-800">
                    ✓ API key saved
                  </div>
                )}
              </div>
            </>
          )}
          
          {!useOnlineGemini && !aiAvailable && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start space-x-2">
              <MdWarning className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800">
                Chrome AI not available. Switch to Online Gemini or follow setup instructions.
              </p>
            </div>
          )}

          {/* AI Performance Stats */}
          {aiStats.totalExtracted > 0 && (
            <div className="mt-6 pt-6 border-t border-border">
              <div className="flex items-center space-x-2 mb-4">
                <MdSpeed className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">Performance Stats</h3>
                <span className="text-sm text-muted-foreground">({aiStats.totalExtracted} extracted)</span>
              </div>
              <div className="space-y-2">
                {aiStats.stats.map((stat, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div>
                      <div className="text-sm font-medium">{stat.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {stat.count} invoice{stat.count !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{aiStats.formatTime(stat.avgTime)}</div>
                      <div className="text-xs text-muted-foreground">
                        {aiStats.formatTime(stat.minTime)} - {aiStats.formatTime(stat.maxTime)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        </div>

        {/* AUTO-BACKUP FEATURE DISABLED - Auto-Sync Settings commented out
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            {autoSyncEnabled ? (
              <MdCloudSync className="w-6 h-6 text-primary" />
            ) : (
              <MdCloudOff className="w-6 h-6 text-muted-foreground" />
            )}
            <h2 className="text-2xl font-semibold">Auto-Backup to Google Sheets</h2>
          </div>
          <p className="text-muted-foreground mb-6">
            Automatically backup all data (invoices, stores, merchants, agents) to Google Sheets. This acts as a mirror of your IndexedDB data for restoration if needed.
          </p>
          
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex-1">
              <h3 className="font-medium">Auto-Sync Backup</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {autoSyncEnabled 
                  ? 'All data (invoices, stores, merchants, agents) automatically backed up to Google Sheets' 
                  : 'Manual backup only - data will not sync automatically'
                }
              </p>
            </div>
            <button
              onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
              className={`
                relative inline-flex h-8 w-14 items-center rounded-full transition-colors
                ${autoSyncEnabled ? 'bg-primary' : 'bg-muted-foreground'}
              `}
            >
              <span
                className={`
                  inline-block h-6 w-6 transform rounded-full bg-white transition-transform
                  ${autoSyncEnabled ? 'translate-x-7' : 'translate-x-1'}
                `}
              />
            </button>
          </div>

          {autoSyncEnabled && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start space-x-2">
              <MdCheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800">
                Auto-backup is enabled. All data changes will be automatically synced to Google Sheets backup.
              </p>
            </div>
          )} */}

        {/* Backup & Data Management */}
        <div className="bg-gradient-to-br from-pink-50/80 to-rose-50/80 rounded-lg p-1">
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <MdCloudSync className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-semibold">Backup & Data Management</h2>
          </div>
          <p className="text-muted-foreground mb-6">
            Backup and restore data, or reset the application.
          </p>

          {/* Inline Message Display */}
          {message && (
            <div className={`mb-4 p-4 rounded-lg border ${
              message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
              message.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
              'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
              <p className="text-sm font-medium">{message.text}</p>
            </div>
          )}

          {/* Backup & Restore Section */}
          <div className="pt-4 border-t border-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sync All Data to Backup */}
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium">Sync All Data to Backup</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Export all data to Google Sheets backup
                  </p>
                </div>
                <button
                  onClick={handleSyncAllData}
                  disabled={isSyncing}
                  className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                >
                  <MdCloudSync size={18} />
                  <span className="text-sm font-medium">
                    {isSyncing ? 'Syncing...' : 'Sync All Data'}
                  </span>
                </button>
              </div>

              {/* Restore from Backup */}
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium">Restore from Backup</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Import all data from Google Sheets backup
                  </p>
                </div>
                <button
                  onClick={handleRestoreFromBackup}
                  disabled={isRestoring}
                  className="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                >
                  <MdCloudDownload size={18} />
                  <span className="text-sm font-medium">
                    {isRestoring ? 'Restoring...' : 'Restore from Backup'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Data Management Section */}
          <div className="mt-6 pt-6 border-t border-border">
            <div className="flex items-center space-x-2 mb-4">
              <MdDeleteSweep className="w-5 h-5 text-destructive" />
              <h3 className="text-lg font-semibold">Data Management</h3>
            </div>
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex-1">
                <h4 className="text-sm font-medium">Reset App Data</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Clear all invoices and start fresh. This action cannot be undone.
                </p>
              </div>
              <DeleteAllData 
                onDeleteAll={handleDeleteAllData}
                disabled={false}
              />
            </div>
          </div>
        </div>
        </div>
        
        </div>
        {/* End of grid */}

        {/* Info Section - Full width below the grid */}
        <div className="bg-muted/50 border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-2">About Settings</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground flex-shrink-0 mt-2"></span>
              <span>Currency settings are saved locally in your browser</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground flex-shrink-0 mt-2"></span>
              <span>All processed invoices will use your selected currency</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground flex-shrink-0 mt-2"></span>
              <span>Deleting app data will remove all invoices from your device</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground flex-shrink-0 mt-2"></span>
              <span>Settings are applied immediately after selection</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

