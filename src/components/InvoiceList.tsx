'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DatabaseInvoice } from '@/types/invoice';
import { formatCurrencyWithLocale } from '@/lib/currency-utils';
import { FiTrash2, FiEye } from 'react-icons/fi';

interface InvoiceListProps {
  invoices: DatabaseInvoice[];
  onInvoiceDelete?: (invoiceId: string) => void;
  onAgentSelect?: (agentName: string) => void;
  activeAgent?: string | null;
  loading?: boolean;
}

export default function InvoiceList({ 
  invoices, 
  onInvoiceDelete, 
  onAgentSelect,
  activeAgent = null,
  loading = false 
}: InvoiceListProps) {
  const router = useRouter();
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

  const handleInvoiceClick = (invoice: DatabaseInvoice) => {
    router.push(`/invoices/${invoice.id}`);
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
    <div className="space-y-4">
      {/* Invoice list */}
      {invoices.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-lg">
          <div className="text-4xl mb-4">📄</div>
          <h3 className="text-lg font-semibold mb-2">No invoices yet</h3>
          <p className="text-muted-foreground">Drop some invoice images to get started</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {invoices.map((invoice, index) => (
            <div
              key={invoice.id}
              onClick={() => handleInvoiceClick(invoice)}
              className={`
                flex items-center justify-between p-4 cursor-pointer transition-all duration-200
                ${pendingDelete === invoice.id ? 'bg-red-50' : ''}
                hover:bg-muted/50
                ${index < invoices.length - 1 ? 'border-b border-border' : ''}
              `}
            >
              {/* Left side - Main info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <h3 className="font-semibold text-lg truncate mr-2">
                      {invoice.merchantName}
                    </h3>
                    {/* Status Badge */}
                    <span className={`
                      px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap
                      ${invoice.status === 'approved' 
                        ? 'bg-green-100 text-green-800 border border-green-200' 
                        : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                      }
                    `}>
                      {invoice.status === 'approved' ? '✓' : '⚠'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="text-muted-foreground">{formatDate(invoice.date)}</span>
                  <span>•</span>
                  <span>{invoice.items.length} item{invoice.items.length !== 1 ? 's' : ''}</span>
                  {invoice.merchantAddress?.city && (
                    <>
                      <span>•</span>
                      <span>📍 {invoice.merchantAddress.city}</span>
                    </>
                  )}
                  {invoice.invoiceNumber && (
                    <>
                      <span>•</span>
                      <span>#{invoice.invoiceNumber}</span>
                    </>
                  )}
                  {invoice.paymentMethod && (
                    <>
                      <span>•</span>
                      <span>{invoice.paymentMethod}</span>
                    </>
                  )}
                  {invoice.agentName && (
                    <>
                      <span>•</span>
                      <button
                        onClick={(e) => handleAgentClick(e, invoice.agentName)}
                        className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                          activeAgent && invoice.agentName.toLowerCase() === activeAgent.toLowerCase()
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                        }`}
                      >
                        {invoice.agentName}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Right side - Total and actions */}
              <div className="flex items-center gap-4 ml-4">
                <div className="text-xl font-bold text-primary">
                  {formatCurrencyWithLocale(invoice.total, invoice.currency)}
                </div>
                
                <div className="flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (invoice.imageData) {
                        window.open(invoice.imageData, '_blank');
                      } else {
                        // Navigate to invoice detail page if no image
                        router.push(`/invoices/${invoice.id}`);
                      }
                    }}
                    className={`p-2 transition-colors rounded-md ${
                      invoice.imageData 
                        ? 'text-muted-foreground hover:text-primary hover:bg-muted'
                        : 'text-muted-foreground hover:text-primary hover:bg-muted'
                    }`}
                    title={invoice.imageData ? "View original image" : "View invoice details"}
                  >
                    <FiEye size={16} />
                  </button>
                  
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
          ))}
        </div>
      )}
    </div>
  );
}
