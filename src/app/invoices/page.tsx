'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import InvoiceList from '@/components/InvoiceList';
import InvoiceFilter from '@/components/InvoiceFilter';
import { DatabaseInvoice } from '@/types/invoice';
import { invoiceDb, db } from '@/lib/database';
import { formatCurrencyWithLocale } from '@/lib/currency-utils';
import { useAIProvider } from '@/contexts/AIProviderContext';
import { useAppStateStore } from '@/store/appStateStore';
import { useInvoiceQueueStore } from '@/store/invoiceQueueStore';
import Link from 'next/link';

function formatMonthLabel(key: string) {
  const [year, month] = key.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default function InvoicesPage() {
  const { useOnlineGemini } = useAIProvider();
  const { 
    selectedStatusFilter, 
    setSelectedStatusFilter,
    isAgentPerformanceExpanded,
    setIsAgentPerformanceExpanded 
  } = useAppStateStore();
  const { pendingCount, processingCount } = useInvoiceQueueStore();
  
  // Use reactive query for invoices - automatically updates when IndexedDB changes
  const invoicesRaw = useLiveQuery(
    async () => {
      const allInvoices = await db.invoices.toArray();
      // Sort by date descending, then by created date
      return allInvoices.sort((a, b) => {
        const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateCompare !== 0) return dateCompare;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    },
    []
  );
  const invoices = useMemo(() => invoicesRaw ?? [], [invoicesRaw]);
  
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [filteredInvoices, setFilteredInvoices] = useState<DatabaseInvoice[]>([]);

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
    
    return Object.entries(currencyCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0];
  }, [invoices, totalAmountsByCurrency]);

  // Calculate agent summaries
  const agentSummaries = useMemo(() => {
    const agentMap: Record<string, {
      name: string;
      totalInvoices: number;
      totalAmount: number;
      averageTicket: number;
      monthlyTotals: Array<{ month: string; amount: number }>;
    }> = {};

    (invoices || []).forEach(invoice => {
      const agentName = invoice.agentName || 'Unknown Agent';
      const amount = typeof invoice.total === 'number' ? invoice.total : parseFloat(String(invoice.total ?? 0));
      const month = invoice.date.split('-').slice(0, 2).join('-');
      
      if (!agentMap[agentName]) {
        agentMap[agentName] = {
          name: agentName,
          totalInvoices: 0,
          totalAmount: 0,
          averageTicket: 0,
          monthlyTotals: []
        };
      }
      
      agentMap[agentName].totalInvoices++;
      agentMap[agentName].totalAmount += amount;
      
      const existingMonth = agentMap[agentName].monthlyTotals.find(m => m.month === month);
      if (existingMonth) {
        existingMonth.amount += amount;
      } else {
        agentMap[agentName].monthlyTotals.push({ month, amount });
      }
    });

    // Calculate averages and sort monthly totals
    Object.values(agentMap).forEach(agent => {
      agent.averageTicket = agent.totalInvoices > 0 ? agent.totalAmount / agent.totalInvoices : 0;
      agent.monthlyTotals.sort((a, b) => b.month.localeCompare(a.month));
    });

    return Object.values(agentMap).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [invoices]);

  // Initialize
  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        // Initialize database
        console.log('Initializing database...');
        await invoiceDb.initialize();
        
        // AI initialization moved to add-invoice page
        console.log('AI provider:', useOnlineGemini ? 'Online Gemini' : 'Chrome AI');
        
      } catch (error) {
        console.error('Initialization failed:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initialize();
    
    return () => {
      isMounted = false;
    };
  }, [useOnlineGemini]);


  const handleInvoiceDelete = useCallback(async (invoiceId: string) => {
    try {
      await invoiceDb.deleteInvoice(invoiceId);
      console.log('Invoice deleted successfully');
    } catch (error) {
      console.error('Failed to delete invoice:', error);
      alert('Failed to delete invoice. Please try again.');
    }
  }, []);

  const handleAgentSelect = useCallback((agentName: string) => {
    setSelectedAgent(agentName);
  }, []);

  const clearAgentFilter = useCallback(() => {
    setSelectedAgent(null);
  }, []);

  // Apply status filter to the filtered invoices
  const statusFilteredInvoices = useMemo(() => {
    if (selectedStatusFilter === 'all') {
      return filteredInvoices;
    }
    return filteredInvoices.filter(inv => (inv.status || 'review') === selectedStatusFilter);
  }, [filteredInvoices, selectedStatusFilter]);

  // Calculate status counts
  const statusCounts = useMemo(() => {
    return {
      all: filteredInvoices.length,
      review: filteredInvoices.filter(inv => (inv.status || 'review') === 'review').length,
      approved: filteredInvoices.filter(inv => inv.status === 'approved').length,
    };
  }, [filteredInvoices]);

  const handleFilterChange = useCallback((filtered: DatabaseInvoice[]) => {
    setFilteredInvoices(filtered);
  }, []);

  const handleFilterStateChange = useCallback((/* _filterState: InvoiceFilterState */) => {
    // Filter state change handled by InvoiceFilter component
  }, []);

  if (loading) {
    return (
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-full flex flex-col">
        <div className="flex items-center justify-center flex-1">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <div>
              <h2 className="text-xl font-semibold">Loading Invoices...</h2>
              <p className="text-muted-foreground">Fetching your invoice data</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-full flex flex-col">
        <div className="text-center space-y-4 flex-1 flex flex-col justify-center">
          <h1 className="text-4xl font-bold brand-gradient">
            No Invoices Yet
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Start by adding your first invoice to see them listed here.
          </p>
          <div className="mt-8">
            <Link 
              href="/add-invoice" 
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary/90 transition-colors"
            >
              Add Your First Invoice
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-full flex flex-col">
      <div className="flex flex-col lg:flex-row gap-6 flex-1">
        {/* Main Content - Invoice List (Left, flexible width) */}
        <div className="flex-1 min-w-0">
          <InvoiceList
            invoices={statusFilteredInvoices}
            onInvoiceDelete={handleInvoiceDelete}
            loading={false}
            onAgentSelect={handleAgentSelect}
            activeAgent={selectedAgent}
          />
        </div>

        {/* Sidebar - Filters & Agent Performance (Right, fixed width) */}
        <div className="lg:w-80 xl:w-96 space-y-6 flex-shrink-0">
          {/* Status Filter Toggle */}
          <div className="bg-card border border-border rounded-lg p-3">
            <h3 className="font-semibold text-sm mb-3">Status</h3>
            <div className="flex flex-col space-y-2">
              <button
                onClick={() => setSelectedStatusFilter('review')}
                className={`
                  flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-sm border
                  ${selectedStatusFilter === 'review' 
                    ? 'bg-yellow-100 text-yellow-800 border-yellow-200 font-medium' 
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted border-transparent'
                  }
                `}
              >
                <span>⚠ Review</span>
                <span className="text-xs font-semibold">{statusCounts.review}</span>
              </button>
              
              <button
                onClick={() => setSelectedStatusFilter('approved')}
                className={`
                  flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-sm border
                  ${selectedStatusFilter === 'approved' 
                    ? 'bg-green-100 text-green-800 border-green-200 font-medium' 
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted border-transparent'
                  }
                `}
              >
                <span>✓ Approved</span>
                <span className="text-xs font-semibold">{statusCounts.approved}</span>
              </button>
              
              <button
                onClick={() => setSelectedStatusFilter('all')}
                className={`
                  flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-sm border
                  ${selectedStatusFilter === 'all' 
                    ? 'bg-primary/10 text-primary border-primary/20 font-medium' 
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted border-transparent'
                  }
                `}
              >
                <span>All Invoices</span>
                <span className="text-xs font-semibold">{statusCounts.all}</span>
              </button>
            </div>
            
            {/* Queue Status - Only show if there are items processing or pending */}
            {(pendingCount() > 0 || processingCount() > 0) && (
              <Link href="/add-invoice">
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center justify-between text-xs text-muted-foreground hover:text-primary transition-colors">
                    <span>
                      {processingCount() > 0 ? '⚡ Processing queue...' : '⏳ Items in queue'}
                    </span>
                    <span className="font-semibold">
                      {pendingCount() + processingCount()}
                    </span>
                  </div>
                </div>
              </Link>
            )}
          </div>

          {/* Invoice Filter - No nested card */}
          <InvoiceFilter
            invoices={invoices}
            onFilterChange={handleFilterChange}
            onFilterStateChange={handleFilterStateChange}
            loading={false}
          />

          {/* Agent Performance */}
          {agentSummaries.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-3">
              <div 
                className="flex items-center justify-between mb-3 cursor-pointer"
                onClick={() => setIsAgentPerformanceExpanded(!isAgentPerformanceExpanded)}
              >
                <h3 className="font-semibold text-sm">Agent Performance</h3>
                <div className="flex items-center gap-2">
                  {selectedAgent && isAgentPerformanceExpanded && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        clearAgentFilter();
                      }} 
                      className="text-xs text-primary hover:underline"
                    >
                      Clear
                    </button>
                  )}
                  <span className="text-xs text-primary">
                    {isAgentPerformanceExpanded ? '▲' : '▼'}
                  </span>
                </div>
              </div>
              {isAgentPerformanceExpanded && (
                <div className="space-y-3">
                {agentSummaries.map((agent) => {
                  const isActive = selectedAgent === agent.name;
                  return (
                    <div
                      key={agent.name}
                      className={`border rounded-lg p-3 transition-colors cursor-pointer ${
                        isActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => handleAgentSelect(agent.name)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">{agent.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {agent.totalInvoices} invoice{agent.totalInvoices !== 1 ? 's' : ''}
                          </div>
                        </div>
                        <div className="text-right ml-2">
                          <div className="text-sm font-semibold text-primary">
                            {formatCurrencyWithLocale(agent.totalAmount, primaryCurrency)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Avg {formatCurrencyWithLocale(agent.averageTicket, primaryCurrency)}
                          </div>
                        </div>
                      </div>
                      {isActive && agent.monthlyTotals.length > 0 && (
                        <div className="mt-3 border-t border-border pt-3 space-y-2 text-xs text-muted-foreground">
                          <div className="font-medium text-foreground">Monthly totals</div>
                          {agent.monthlyTotals.slice(0, 4).map((month) => (
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
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
