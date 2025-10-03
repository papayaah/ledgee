'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import InvoiceDropzone from '@/components/InvoiceDropzone';
import InvoiceList from '@/components/InvoiceList';
import InvoiceDetails from '@/components/InvoiceDetails';
import DemoInstructions from '@/components/DemoInstructions';
import AITestComponent from '@/components/AITestComponent';
import SampleImages from '@/components/SampleImages';
import DeleteAllData from '@/components/DeleteAllData';
import { DragDropFile, ProcessingStatus, DatabaseInvoice } from '@/types/invoice';
import { aiExtractor, checkChromeAIAvailability, ChromeAIStatus, describeImage } from '@/lib/ai-extraction';
import { invoiceDb } from '@/lib/database';
import ImageDescribeDropzone from '@/components/ImageDescribeDropzone';
import { formatCurrencyWithLocale } from '@/lib/currency-utils';

function formatMonthLabel(key: string) {
  const [year, month] = key.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default function HomePage() {
  const [invoices, setInvoices] = useState<DatabaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<ProcessingStatus>({ status: 'idle' });
  const [aiAvailable, setAiAvailable] = useState<boolean>(false);
  const [aiStatus, setAiStatus] = useState<ChromeAIStatus | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<DatabaseInvoice | null>(null);
  const [describeLoading, setDescribeLoading] = useState(false);
  const [describeResult, setDescribeResult] = useState<string | null>(null);
  const [describeError, setDescribeError] = useState<string | null>(null);
  const [describeResponseTime, setDescribeResponseTime] = useState<number | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [lastProcessingTime, setLastProcessingTime] = useState<number | null>(null);

  // Calculate total amounts by currency
  const totalAmountsByCurrency = useMemo(() => {
    const totals: Record<string, number> = {};
    
    (invoices || []).forEach(inv => {
      const value = typeof inv?.total === 'number' ? inv.total : parseFloat(String(inv?.total ?? 0));
      const currency = inv?.currency || 'PHP';
      
      if (Number.isFinite(value)) {
        totals[currency] = (totals[currency] || 0) + value;
      }
    });
    
    return totals;
  }, [invoices]);

  // Get the primary currency (most used) or default to PHP
  const primaryCurrency = useMemo(() => {
    const currencies = Object.keys(totalAmountsByCurrency);
    if (currencies.length === 0) return 'PHP';
    if (currencies.length === 1) return currencies[0];
    
    // Find the currency with the most invoices
    const currencyCounts: Record<string, number> = {};
    (invoices || []).forEach(inv => {
      const currency = inv?.currency || 'PHP';
      currencyCounts[currency] = (currencyCounts[currency] || 0) + 1;
    });
    
    return Object.entries(currencyCounts).reduce((a, b) => 
      currencyCounts[a[0]] > currencyCounts[b[0]] ? a : b
    )[0];
  }, [invoices, totalAmountsByCurrency]);

  const agentSummaries = useMemo(() => {
    const map = new Map<string, {
      name: string;
      totalInvoices: number;
      totalAmount: number;
      monthlyTotals: Record<string, number>;
    }>();

    invoices.forEach((invoice) => {
      const agent = invoice.agentName?.trim();
      if (!agent) return;

      if (!map.has(agent)) {
        map.set(agent, {
          name: agent,
          totalInvoices: 0,
          totalAmount: 0,
          monthlyTotals: {},
        });
      }

      const entry = map.get(agent)!;
      entry.totalInvoices += 1;
      entry.totalAmount += invoice.total || 0;

      const invoiceDate = new Date(invoice.date);
      if (!Number.isNaN(invoiceDate.getTime())) {
        const monthKey = `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, '0')}`;
        entry.monthlyTotals[monthKey] = (entry.monthlyTotals[monthKey] ?? 0) + (invoice.total || 0);
      }
    });

    return Array.from(map.values()).map((entry) => ({
      ...entry,
      averageTicket: entry.totalInvoices > 0 ? entry.totalAmount / entry.totalInvoices : 0,
      monthlyTotals: Object.entries(entry.monthlyTotals)
        .map(([month, amount]) => ({ month, amount }))
        .sort((a, b) => b.month.localeCompare(a.month)),
    }));
  }, [invoices]);

  const uniqueAgentsCount = useMemo(() => agentSummaries.length, [agentSummaries]);

  const filteredInvoices = useMemo(() => {
    if (!selectedAgent) return invoices;
    const lower = selectedAgent.toLowerCase();
    return invoices.filter((invoice) => invoice.agentName?.toLowerCase() === lower);
  }, [invoices, selectedAgent]);

  // Initialize database and check AI availability
  useEffect(() => {
    async function initialize() {
      console.log('Starting initialization...');
      
      try {
        // Initialize database
        console.log('Initializing database...');
        await invoiceDb.initialize();
        
        // Load existing invoices
        console.log('Loading existing invoices...');
        const existingInvoices = await invoiceDb.getAllInvoices();
        setInvoices(existingInvoices);
        console.log(`Loaded ${existingInvoices.length} existing invoices`);
        
        // Check Chrome LanguageModel availability
        console.log('Checking LanguageModel availability...');
        const aiCheck = await checkChromeAIAvailability();
        console.log('LanguageModel check result:', aiCheck);
        
        setAiAvailable(aiCheck.available);
        setAiStatus(aiCheck);
        
        if (!aiCheck.available && aiCheck.instructions) {
          console.warn('LanguageModel setup instructions:', aiCheck.instructions);
        }
        
      } catch (error) {
        console.error('Initialization failed:', error);
      } finally {
        setLoading(false);
        console.log('Initialization complete');
      }
    }

    initialize();
  }, []);

  // Handle file drop and processing
  const handleFilesDropped = useCallback(async (files: DragDropFile[]) => {
    console.log('Files dropped, aiAvailable:', aiAvailable);
    
    if (!aiAvailable) {
      const message = aiStatus
        ? `${aiStatus.status}${aiStatus.instructions ? `\n\n${aiStatus.instructions}` : ''}`
        : 'Chrome Prompt API is not available. Please use Chrome Canary with the required flags enabled.';
      alert(message);
      return;
    }

    const batchStart = performance.now ? performance.now() : Date.now();
    setProcessing({ 
      status: 'processing', 
      message: 'Extracting invoice data...', 
      progress: 0 
    });

    try {
      const newInvoices: DatabaseInvoice[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        setProcessing({ 
          status: 'processing', 
          message: `Processing ${file.file.name}...`, 
          progress: (i / files.length) * 100 
        });

        try {
          console.log(`Starting extraction for ${file.file.name}`);
          // Extract invoice data using AI
          const result = await aiExtractor.extractFromImage(file.file);
          console.log('Extraction result:', result);
          
          // Store the processing time for display
          if (result.processingTime) {
            setLastProcessingTime(result.processingTime);
          }
          
          if (result.invoice && result.invoice.merchantName) {
            // Save to database
            const completeInvoice = {
              ...result.invoice,
              id: result.invoice.id || `inv_${Date.now()}_${i}`,
              merchantName: result.invoice.merchantName,
              date: result.invoice.date || new Date().toISOString().split('T')[0],
              total: result.invoice.total || 0,
              items: result.invoice.items || [],
              extractedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              processingTime: result.processingTime,
            } as DatabaseInvoice;

            await invoiceDb.saveInvoice(completeInvoice);
            newInvoices.push(completeInvoice);
            console.log('Successfully saved invoice:', completeInvoice.id);
          }
        } catch (error) {
          console.error(`Failed to process ${file.file.name}:`, error);
        }

        // Clean up file preview
        URL.revokeObjectURL(file.preview);
      }

      // Update invoices list
      if (newInvoices.length > 0) {
        const allInvoices = await invoiceDb.getAllInvoices();
        setInvoices(allInvoices);

        const totalDuration = (performance.now ? performance.now() : Date.now()) - batchStart;
        setProcessing({ 
          status: 'completed', 
          message: `Successfully processed ${newInvoices.length} invoice${newInvoices.length !== 1 ? 's' : ''}! (${(totalDuration / 1000).toFixed(1)}s)` 
        });
        setLastProcessingTime(totalDuration);
      } else {
        setProcessing({ 
          status: 'error', 
          message: 'No invoices could be processed' 
        });
        setLastProcessingTime(null);
      }

    } catch (error) {
      console.error('Processing failed:', error);
      setProcessing({ 
        status: 'error', 
        message: 'Failed to process invoices' 
      });
      setLastProcessingTime(null);
    }

    // Reset processing status after 3 seconds
    setTimeout(() => {
      setProcessing({ status: 'idle' });
    }, 3000);
  }, [aiAvailable, aiStatus]);

  const handleDescribeImage = useCallback(async (file: File) => {
    if (!aiAvailable) {
      const message = aiStatus
        ? `${aiStatus.status}${aiStatus.instructions ? `\n\n${aiStatus.instructions}` : ''}`
        : 'Chrome Prompt API is not available. Please enable the required flags.';
      alert(message);
      return;
    }

    setDescribeLoading(true);
    setDescribeResult(null);
    setDescribeError(null);
    setDescribeResponseTime(null);

    const startTime = Date.now();

    try {
      const description = await describeImage(file);
      const responseTime = Date.now() - startTime;
      setDescribeResult(description);
      setDescribeResponseTime(responseTime);
    } catch (error) {
      console.error('Image description failed:', error);
      setDescribeError(error instanceof Error ? error.message : 'Failed to describe image');
    } finally {
      setDescribeLoading(false);
    }
  }, [aiAvailable, aiStatus]);

  const handleAgentSelect = useCallback((agentName: string) => {
    setSelectedAgent(agentName);
    setSelectedInvoice(null);
  }, []);

  const handleDeleteAllData = useCallback(async () => {
    try {
      // Clear all invoices from database
      await invoiceDb.clearAllInvoices();
      
      // Reset all state
      setInvoices([]);
      setSelectedInvoice(null);
      setSelectedAgent(null);
      setLastProcessingTime(null);
      setDescribeResult(null);
      setDescribeError(null);
      setDescribeResponseTime(null);
      
      console.log('All data deleted successfully');
    } catch (error) {
      console.error('Failed to delete all data:', error);
      alert('Failed to delete all data. Please try again.');
    }
  }, []);

  const clearAgentFilter = useCallback(() => {
    setSelectedAgent(null);
  }, []);

  // Handle invoice selection
  const handleInvoiceSelect = useCallback((invoice: DatabaseInvoice) => {
    setSelectedInvoice(invoice);
  }, []);

  // Handle invoice deletion
  const handleInvoiceDelete = useCallback(async (invoiceId: string) => {
    try {
      await invoiceDb.deleteInvoice(invoiceId);
      const updatedInvoices = await invoiceDb.getAllInvoices();
      setInvoices(updatedInvoices);
      
      if (selectedInvoice?.id === invoiceId) {
        setSelectedInvoice(null);
      }
    } catch (error) {
      console.error('Failed to delete invoice:', error);
      alert('Failed to delete invoice');
    }
  }, [selectedInvoice]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <div>
            <h2 className="text-xl font-semibold">Initializing Shaw AI...</h2>
            <p className="text-muted-foreground">Setting up database and checking AI availability</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Welcome section */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold brand-gradient">
            Welcome to Shaw AI
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Extract invoice data automatically using Chrome&apos;s built-in AI. 
            Drop your invoice images below and watch the magic happen.
          </p>
        </div>

        {/* Demo Instructions */}
        <DemoInstructions />

        {/* AI Test Component for debugging */}
        <AITestComponent />

        {/* Statistics */}
        {invoices && invoices.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-lg p-6 text-center">
              <div className="text-2xl font-bold text-primary">{invoices?.length || 0}</div>
              <div className="text-sm text-muted-foreground">Total Invoices</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-6 text-center">
              <div className="text-2xl font-bold text-primary">
                {formatCurrencyWithLocale(totalAmountsByCurrency[primaryCurrency] || 0, primaryCurrency)}
              </div>
              <div className="text-sm text-muted-foreground">
                Total Amount
                {Object.keys(totalAmountsByCurrency).length > 1 && (
                  <span className="block text-xs mt-1">
                    ({Object.keys(totalAmountsByCurrency).length} currencies)
                  </span>
                )}
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-6 text-center">
              <div className="text-2xl font-bold text-primary">
                {new Set((invoices || []).map(inv => inv?.merchantName || 'Unknown')).size}
              </div>
              <div className="text-sm text-muted-foreground">Unique Merchants</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-6 text-center">
              <div className="text-2xl font-bold text-primary">{uniqueAgentsCount}</div>
              <div className="text-sm text-muted-foreground">Active Agents</div>
            </div>
          </div>
        )}

        {/* Upload Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Left column - Drop zone */}
          <div className="space-y-6">
            {/* Sample Images */}
            <div className="bg-card border border-border rounded-lg p-6">
              <SampleImages 
                onImageSelect={async (file) => {
                  // Convert single file to DragDropFile format
                  const dragDropFile: DragDropFile = {
                    file,
                    preview: URL.createObjectURL(file),
                    id: `sample_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                  };
                  await handleFilesDropped([dragDropFile]);
                }}
                disabled={processing.status === 'processing' || !aiAvailable}
              />
              {processing.status === 'processing' && (
                <div className="mt-3 text-center">
                  <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Processing sample image...
                  </div>
                </div>
              )}
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4">Upload Invoices</h2>
              <InvoiceDropzone
                onFilesDropped={handleFilesDropped}
                processing={processing}
                maxFiles={5}
              />
              {lastProcessingTime !== null && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Last response time: {(lastProcessingTime / 1000).toFixed(1)}s
                </p>
              )}
            </div>
          </div>

          {/* Right column - Quick Image Description */}
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Quick Image Description</h2>
                {describeLoading && <span className="text-sm text-muted-foreground">Processing…</span>}
              </div>
              <ImageDescribeDropzone onFileSelected={handleDescribeImage} disabled={describeLoading} />
              {describeResult && (
                <div className="space-y-2">
                  <div className="bg-muted/50 border border-border rounded-md p-3 text-sm text-left whitespace-pre-wrap">
                    {describeResult}
                  </div>
                  {describeResponseTime && (
                    <div className="text-xs text-muted-foreground text-right">
                      Response time: {describeResponseTime}ms
                    </div>
                  )}
                </div>
              )}
              {describeError && (
                <div className="text-sm text-red-600">
                  {describeError}
                </div>
              )}
              {!describeLoading && !describeResult && !describeError && (
                <p className="text-xs text-muted-foreground">
                  Need to sanity check a tricky image? Drop it here to see what the model can perceive before running the full invoice extraction.
                </p>
              )}
            </div>

            {/* Delete All Data Button */}
            {invoices.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Development Tools</h3>
                    <p className="text-xs text-muted-foreground mt-1">Reset app to clean state</p>
                  </div>
                  <DeleteAllData 
                    onDeleteAll={handleDeleteAllData}
                    disabled={processing.status === 'processing'}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Invoice List Section */}
        {invoices.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Invoice List</h2>
              <div className="text-sm text-muted-foreground">
                {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
              </div>
            </div>
            {agentSummaries.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Agent Performance</h2>
                  {selectedAgent && (
                    <button onClick={clearAgentFilter} className="text-sm text-primary hover:underline">
                      Clear filter
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {agentSummaries.map((agent) => {
                    const isActive = selectedAgent === agent.name;
                    return (
                      <div
                        key={agent.name}
                        className={`border rounded-lg p-3 transition-colors ${isActive ? 'border-primary bg-primary/5' : 'border-border'}`}
                      >
                        <button className="w-full text-left" onClick={() => handleAgentSelect(agent.name)}>
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-sm">{agent.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {agent.totalInvoices} invoice{agent.totalInvoices !== 1 ? 's' : ''}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-primary">
                                {formatCurrencyWithLocale(agent.totalAmount, primaryCurrency)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Avg {formatCurrencyWithLocale(agent.averageTicket, primaryCurrency)}
                              </div>
                            </div>
                          </div>
                        </button>
                        {isActive && agent.monthlyTotals.length > 0 && (
                          <div className="mt-3 border-t border-border pt-3 space-y-2 text-xs text-muted-foreground">
                            <div className="font-medium text-foreground">Monthly totals</div>
                            {agent.monthlyTotals.slice(0, 6).map((month) => (
                              <div key={`${agent.name}-${month.month}`} className="flex justify-between">
                                <span>{formatMonthLabel(month.month)}</span>
                                <span className="font-medium text-foreground">
                                  {formatCurrencyWithLocale(month.amount, primaryCurrency)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedInvoice ? (
              <InvoiceDetails
                invoice={selectedInvoice}
                onAgentSelect={handleAgentSelect}
                onBack={() => setSelectedInvoice(null)}
              />
            ) : (
              <InvoiceList
                invoices={filteredInvoices}
                onInvoiceSelect={handleInvoiceSelect}
                onInvoiceDelete={handleInvoiceDelete}
                loading={false}
                onAgentSelect={handleAgentSelect}
                activeAgent={selectedAgent}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
