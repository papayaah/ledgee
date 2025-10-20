'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRouter } from 'next/navigation';
import { invoiceDb, db } from '@/lib/database';
import { formatCurrencyWithLocale } from '@/lib/currency-utils';
import { useAIProvider } from '@/contexts/AIProviderContext';
import { useAIAvailabilityStore } from '@/store/aiAvailabilityStore';
import AIPromptInput from '@/components/AIPromptInput';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MdPerson, MdStoreMallDirectory, MdCalendarMonth, MdCalendarToday, MdStore } from 'react-icons/md';

export default function HomePage() {
  const router = useRouter();
  const { useOnlineGemini, geminiApiKey } = useAIProvider();
  const { isAvailable: chromeAIAvailable } = useAIAvailabilityStore();
  
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
  const [hasCheckedForInvoices, setHasCheckedForInvoices] = useState(false);
  const [showAgents, setShowAgents] = useState(false); // Toggle between merchants and agents
  const [revenueView, setRevenueView] = useState<'daily' | 'monthly' | 'store'>('monthly'); // Revenue view type

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

  // Calculate unique agents count for stats
  const uniqueAgentsCount = useMemo(() => {
    const agents = new Set(invoices.map(inv => inv.agentName).filter(Boolean));
    return agents.size;
  }, [invoices]);

  // Chart data: Monthly revenue trend
  const monthlyRevenueData = useMemo(() => {
    const monthlyTotals: { [key: string]: number } = {};
    
    invoices.forEach(invoice => {
      const date = new Date(invoice.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyTotals[monthKey]) {
        monthlyTotals[monthKey] = 0;
      }
      monthlyTotals[monthKey] += invoice.total;
    });
    
    // Sort by month
    const sorted = Object.entries(monthlyTotals)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, total]) => {
        const [year, month] = key.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return {
          month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          amount: total
        };
      });
    
    return sorted;
  }, [invoices]);

  // Chart data: Daily revenue trend
  const dailyRevenueData = useMemo(() => {
    const dailyTotals: { [key: string]: number } = {};
    
    invoices.forEach(invoice => {
      const dateKey = invoice.date; // Already in YYYY-MM-DD format
      
      if (!dailyTotals[dateKey]) {
        dailyTotals[dateKey] = 0;
      }
      dailyTotals[dateKey] += invoice.total;
    });
    
    // Sort by date and format
    const sorted = Object.entries(dailyTotals)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateKey, total]) => {
        const date = new Date(dateKey);
        return {
          month: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          amount: total
        };
      });
    
    // Limit to last 30 days for readability
    return sorted.slice(-30);
  }, [invoices]);

  // Chart data: Top merchants
  const topMerchantsData = useMemo(() => {
    const merchantTotals: { [key: string]: number } = {};
    
    invoices.forEach(invoice => {
      const merchant = invoice.merchantName || 'Unknown';
      if (!merchantTotals[merchant]) {
        merchantTotals[merchant] = 0;
      }
      merchantTotals[merchant] += invoice.total;
    });
    
    // Get top 5 merchants
    const sorted = Object.entries(merchantTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, total]) => ({
        name: name.length > 20 ? name.substring(0, 20) + '...' : name,
        amount: total
      }));
    
    return sorted;
  }, [invoices]);

  // Chart data: Top agents
  const topAgentsData = useMemo(() => {
    const agentTotals: { [key: string]: number } = {};
    
    invoices.forEach(invoice => {
      const agent = invoice.agentName || 'Unknown';
      if (!agentTotals[agent]) {
        agentTotals[agent] = 0;
      }
      agentTotals[agent] += invoice.total;
    });
    
    // Get top 5 agents
    const sorted = Object.entries(agentTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, total]) => ({
        name: name.length > 20 ? name.substring(0, 20) + '...' : name,
        amount: total
      }));
    
    return sorted;
  }, [invoices]);

  // Chart data: Spending by store
  const storeSpendingData = useMemo(() => {
    const storeTotals: { [key: string]: number } = {};
    
    invoices.forEach(invoice => {
      const store = invoice.storeName || 'Unknown';
      if (!storeTotals[store]) {
        storeTotals[store] = 0;
      }
      storeTotals[store] += invoice.total;
    });
    
    const sorted = Object.entries(storeTotals).map(([name, value]) => ({
      name: name.length > 15 ? name.substring(0, 15) + '...' : name,
      value
    }));
    
    return sorted;
  }, [invoices]);

  const COLORS = ['#c4b5fd', '#fcd34d', '#6ee7b7', '#93c5fd', '#fca5a5', '#f9a8d4']; // Pastel colors

  // Initialize database
  useEffect(() => {
    let isMounted = true;
    
    async function initialize() {
      if (!isMounted) return;
      
      try {
        await invoiceDb.initialize();
      } catch (error) {
        console.error('Initialization failed:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    initialize();
    
    return () => {
      isMounted = false;
    };
  }, [useOnlineGemini]);

  // Auto-redirect based on setup state and invoices
  useEffect(() => {
    if (loading || hasCheckedForInvoices) return;

    const checkAndRedirect = async () => {
      // Check if we have any invoices
      const hasInvoices = invoices.length > 0;
      
      if (hasInvoices) {
        // Has invoices, stay on dashboard
        setHasCheckedForInvoices(true);
        return;
      }

      // No invoices - check if AI is configured
      const hasAI = chromeAIAvailable || (useOnlineGemini && geminiApiKey);
      
      if (!hasAI) {
        // No AI configured, redirect to setup
        console.log('No AI configured, redirecting to setup...');
        router.push('/setup');
      } else {
        // AI is ready, redirect to add invoice
        console.log('AI ready, redirecting to add invoice...');
        router.push('/add-invoice');
      }
    };

    checkAndRedirect();
  }, [loading, hasCheckedForInvoices, invoices.length, chromeAIAvailable, useOnlineGemini, geminiApiKey, router]);




  // Loading state or redirecting
  if (loading || !hasCheckedForInvoices || invoices.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <div>
            <h2 className="text-xl font-semibold">Loading Ledgee...</h2>
            <p className="text-muted-foreground">
              {loading ? 'Setting up database' : 'Preparing your workspace'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-full flex flex-col">
        <div className="space-y-8 flex-1">
        {/* Statistics */}
        {invoices && invoices.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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

        {/* Charts Section */}
        {invoices && invoices.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Card with 3 views */}
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  {revenueView === 'daily' ? 'Daily Revenue (Last 30 Days)' : 
                   revenueView === 'monthly' ? 'Monthly Revenue' : 
                   'Revenue by Store'}
                </h3>
                <div className="flex items-center space-x-1 bg-muted/50 rounded-lg p-1">
                  <button
                    onClick={() => setRevenueView('daily')}
                    className={`p-2 rounded-md transition-colors ${
                      revenueView === 'daily' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-muted'
                    }`}
                    title="Daily Revenue"
                  >
                    <MdCalendarToday className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setRevenueView('monthly')}
                    className={`p-2 rounded-md transition-colors ${
                      revenueView === 'monthly' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-muted'
                    }`}
                    title="Monthly Revenue"
                  >
                    <MdCalendarMonth className="w-5 h-5" />
                  </button>
                  {storeSpendingData.length > 1 && (
                    <button
                      onClick={() => setRevenueView('store')}
                      className={`p-2 rounded-md transition-colors ${
                        revenueView === 'store' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'hover:bg-muted'
                      }`}
                      title="Revenue by Store"
                    >
                      <MdStore className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
              
              {/* Render chart based on selected view */}
              {(revenueView === 'daily' || revenueView === 'monthly') && (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={revenueView === 'daily' ? dailyRevenueData : monthlyRevenueData}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#c4b5fd" stopOpacity={0.5}/>
                        <stop offset="95%" stopColor="#c4b5fd" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#6b7280" />
                    <YAxis 
                      tick={{ fontSize: 12 }} 
                      stroke="#6b7280"
                      tickFormatter={(value) => value.toLocaleString()}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      formatter={(value: number) => formatCurrencyWithLocale(value, primaryCurrency)}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="amount" 
                      stroke="#a78bfa" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorAmount)"
                      animationDuration={800}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
              
              {/* Store pie chart */}
              {revenueView === 'store' && storeSpendingData.length > 0 && (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={storeSpendingData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      animationDuration={800}
                    >
                      {storeSpendingData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => formatCurrencyWithLocale(value, primaryCurrency)}
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Top 5 Customers */}
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  Top 5 {showAgents ? 'Agents' : 'Customers'}
                </h3>
                <button
                  onClick={() => setShowAgents(!showAgents)}
                  className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  title={showAgents ? 'Switch to Customers' : 'Switch to Agents'}
                >
                  {showAgents ? (
                    <MdStoreMallDirectory className="w-5 h-5 text-muted-foreground hover:text-foreground" />
                  ) : (
                    <MdPerson className="w-5 h-5 text-muted-foreground hover:text-foreground" />
                  )}
                </button>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={showAgents ? topAgentsData : topMerchantsData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    type="number" 
                    tick={{ fontSize: 12 }} 
                    stroke="#6b7280"
                    tickFormatter={(value) => value.toLocaleString()}
                  />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} stroke="#6b7280" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    formatter={(value: number) => formatCurrencyWithLocale(value, primaryCurrency)}
                  />
                  <Bar dataKey="amount" fill="#fcd34d" radius={[0, 4, 4, 0]} animationDuration={800} />
                </BarChart>
              </ResponsiveContainer>
            </div>

          </div>
        )}

        {/* Ask AI Section */}
        {invoices && invoices.length > 0 && (
          <AIPromptInput disabled={false} />
        )}

      </div>
    </div>
  );
}
