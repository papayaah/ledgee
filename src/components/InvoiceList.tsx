'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { DatabaseInvoice } from '@/types/invoice';
import { formatCurrencyWithLocale } from '@/lib/currency-utils';
import { FiTrash2, FiEye } from 'react-icons/fi';

interface InvoiceListProps {
  invoices: DatabaseInvoice[];
  onInvoiceSelect?: (invoice: DatabaseInvoice) => void;
  onInvoiceDelete?: (invoiceId: string) => void;
  onAgentSelect?: (agentName: string) => void;
  activeAgent?: string | null;
  loading?: boolean;
}

export default function InvoiceList({ 
  invoices, 
  onInvoiceSelect, 
  onInvoiceDelete, 
  onAgentSelect,
  activeAgent = null,
  loading = false 
}: InvoiceListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'merchant' | 'total'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  // Clear pending delete when invoices change
  useEffect(() => {
    setPendingDelete(null);
  }, [invoices]);

  // Auto-reset pending delete after 3 seconds
  useEffect(() => {
    if (pendingDelete) {
      const timer = setTimeout(() => {
        setPendingDelete(null);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [pendingDelete]);

  // Filter and sort invoices
  const filteredAndSortedInvoices = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const filtered = invoices.filter(invoice => {
      const matchesSearch =
        invoice.merchantName.toLowerCase().includes(query) ||
        invoice.invoiceNumber?.toLowerCase().includes(query) ||
        invoice.agentName?.toLowerCase().includes(query) ||
        invoice.items.some(item => item.name.toLowerCase().includes(query));

      const matchesAgent =
        !activeAgent || invoice.agentName?.toLowerCase() === activeAgent.toLowerCase();

      return matchesSearch && matchesAgent;
    });

    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'merchant':
          comparison = a.merchantName.localeCompare(b.merchantName);
          break;
        case 'total':
          comparison = a.total - b.total;
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [invoices, searchQuery, sortBy, sortOrder]);

  const handleInvoiceClick = (invoice: DatabaseInvoice) => {
    setSelectedInvoice(invoice.id);
    onInvoiceSelect?.(invoice);
  };

  const handleDeleteClick = (e: React.MouseEvent, invoiceId: string) => {
    e.stopPropagation();
    
    if (pendingDelete === invoiceId) {
      // Second click - actually delete
      onInvoiceDelete?.(invoiceId);
      setPendingDelete(null);
    } else {
      // First click - mark for deletion
      setPendingDelete(invoiceId);
    }
  };

  const handleAgentClick = (e: React.MouseEvent, agentName?: string | null) => {
    e.stopPropagation();
    if (!agentName) return;
    onAgentSelect?.(agentName);
  };

  // Removed local formatCurrency function - using formatCurrencyWithLocale from utils

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="shimmer h-12 w-full rounded-lg" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="invoice-card">
            <div className="shimmer h-4 w-3/4 mb-2" />
            <div className="shimmer h-3 w-1/2 mb-2" />
            <div className="shimmer h-3 w-1/4" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Your Invoices</h2>
          <p className="text-muted-foreground">
            {filteredAndSortedInvoices.length} of {invoices.length} invoices
          </p>
        </div>
        
        {/* Search and filters */}
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search invoices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-');
              setSortBy(field as 'date' | 'merchant' | 'total');
              setSortOrder(order as 'asc' | 'desc');
            }}
            className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="merchant-asc">Merchant A-Z</option>
            <option value="merchant-desc">Merchant Z-A</option>
            <option value="total-desc">Highest Amount</option>
            <option value="total-asc">Lowest Amount</option>
          </select>
        </div>
      </div>

      {/* Invoice list */}
      {filteredAndSortedInvoices.length === 0 ? (
        <div className="text-center py-12">
          {searchQuery ? (
            <div>
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-lg font-semibold mb-2">No invoices found</h3>
              <p className="text-muted-foreground">Try adjusting your search terms</p>
            </div>
          ) : (
            <div>
              <div className="text-4xl mb-4">📄</div>
              <h3 className="text-lg font-semibold mb-2">No invoices yet</h3>
              <p className="text-muted-foreground">Drop some invoice images to get started</p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredAndSortedInvoices.map((invoice) => (
            <div
              key={invoice.id}
              onClick={() => handleInvoiceClick(invoice)}
              className={`
                invoice-card cursor-pointer transition-all duration-200
                ${selectedInvoice === invoice.id ? 'ring-2 ring-primary border-primary' : ''}
                ${pendingDelete === invoice.id ? 'bg-red-50 border-red-200 ring-2 ring-red-300' : ''}
                hover:scale-[1.01]
              `}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  {/* Merchant and date */}
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-lg truncate mr-2">
                      {invoice.merchantName}
                    </h3>
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(invoice.date)}
                    </span>
                  </div>

                  {/* Invoice number and payment method */}
                  <div className="flex items-center gap-3 flex-wrap mb-3 text-sm text-muted-foreground">
                    {invoice.invoiceNumber && (
                      <span className="bg-muted px-2 py-1 rounded-full font-medium">#{invoice.invoiceNumber}</span>
                    )}
                    {invoice.paymentMethod && (
                      <span>• {invoice.paymentMethod}</span>
                    )}
                    {invoice.time && (
                      <span>• {invoice.time}</span>
                    )}
                    {invoice.agentName && (
                      <button
                        onClick={(e) => handleAgentClick(e, invoice.agentName)}
                        className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                          activeAgent && invoice.agentName.toLowerCase() === activeAgent.toLowerCase()
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                        }`}
                      >
                        Agent: {invoice.agentName}
                      </button>
                    )}
                  </div>

                  {/* Items preview */}
                  <div className="mb-3">
                    <div className="text-sm text-muted-foreground mb-1">
                      {invoice.items.length} item{invoice.items.length !== 1 ? 's' : ''}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {invoice.items.slice(0, 3).map((item, index) => (
                        <span
                          key={index}
                          className="inline-block bg-muted text-muted-foreground px-2 py-1 rounded text-xs"
                        >
                          {item.name}
                        </span>
                      ))}
                      {invoice.items.length > 3 && (
                        <span className="text-xs text-muted-foreground px-2 py-1">
                          +{invoice.items.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Address */}
                  {invoice.merchantAddress && (
                    <div className="text-sm text-muted-foreground mb-2">
                      📍 {invoice.merchantAddress.city || invoice.merchantAddress.full}
                    </div>
                  )}

                  {/* Confidence indicator */}
                  {invoice.confidence !== undefined && (
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-muted-foreground">Confidence:</span>
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <div
                              key={i}
                              className={`w-2 h-2 rounded-full mr-1 ${
                                i < Math.floor(invoice.confidence! * 5)
                                  ? 'bg-green-500'
                                  : 'bg-muted'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-muted-foreground">
                          {Math.round(invoice.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Total and actions */}
                <div className="flex flex-col items-end ml-4">
                  <div className="text-2xl font-bold text-primary mb-2">
                    {formatCurrencyWithLocale(invoice.total, invoice.currency)}
                  </div>
                  
                  <div className="flex gap-2">
                    {invoice.imageUrl && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(invoice.imageUrl, '_blank');
                        }}
                        className="p-2 text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-muted"
                        title="View original image"
                      >
                        <FiEye size={16} />
                      </button>
                    )}
                    
                    <button
                      onClick={(e) => handleDeleteClick(e, invoice.id)}
                      className={`p-2 transition-colors rounded-md ${
                        pendingDelete === invoice.id
                          ? 'text-white bg-red-500 hover:bg-red-600 shadow-md'
                          : 'text-muted-foreground hover:text-destructive hover:bg-red-50'
                      }`}
                      title={pendingDelete === invoice.id ? "Click again to delete" : "Delete invoice"}
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Breakdown */}
              {(invoice.subtotal || invoice.tax) && (
                <div className="mt-4 pt-3 border-t border-border text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    {invoice.subtotal && (
                      <span>Subtotal: {formatCurrencyWithLocale(invoice.subtotal, invoice.currency)}</span>
                    )}
                    {invoice.tax && (
                      <span>Tax: {formatCurrencyWithLocale(invoice.tax, invoice.currency)}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
