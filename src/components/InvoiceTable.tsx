import React from 'react';
import { DatabaseInvoice } from '@/types/invoice';
import { formatCurrencyWithLocale } from '@/lib/currency-utils';

interface InvoiceDetailsProps {
  invoice: DatabaseInvoice;
  onAgentSelect: (agentName: string) => void;
  onBack: () => void;
}

export default function InvoiceDetails({ 
  invoice, 
  onAgentSelect,
  onBack
}: InvoiceDetailsProps) {
  
  const handleAgentClick = (e: React.MouseEvent, agentName: string) => {
    e.stopPropagation();
    onAgentSelect(agentName);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Invoice Details</h2>
        <button
          onClick={onBack}
          className="text-muted-foreground hover:text-primary transition-colors"
        >
          ← Back to List
        </button>
      </div>
      
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {/* Invoice Header */}
        <div className="bg-muted/50 border-b border-border p-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-semibold">{invoice.merchantName}</h3>
              <p className="text-muted-foreground">
                {invoice.date} {invoice.time && `• ${invoice.time}`}
              </p>
              {invoice.invoiceNumber && (
                <p className="text-sm text-muted-foreground">#{invoice.invoiceNumber}</p>
              )}
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">
                {formatCurrencyWithLocale(invoice.total, invoice.currency || 'PHP')}
              </div>
            </div>
          </div>

          {(invoice.agentName || invoice.terms || invoice.termsDays) && (
            <div className="text-sm text-muted-foreground space-y-1 mt-4">
              {invoice.agentName && (
                <div>
                  Agent:{' '}
                  <button
                    className="text-primary hover:underline"
                    onClick={() => onAgentSelect(invoice.agentName!)}
                  >
                    {invoice.agentName}
                  </button>
                </div>
              )}
              {(invoice.terms || invoice.termsDays) && (
                <div>
                  Terms: {invoice.terms || `${invoice.termsDays} days`}
                </div>
              )}
            </div>
          )}

          {invoice.merchantAddress && (
            <div className="mt-4">
              <h4 className="font-medium mb-2">Address</h4>
              <p className="text-sm text-muted-foreground">
                {invoice.merchantAddress.full || 
                 `${invoice.merchantAddress.street || ''} ${invoice.merchantAddress.city || ''} ${invoice.merchantAddress.state || ''} ${invoice.merchantAddress.zipCode || ''}`.trim()}
              </p>
            </div>
          )}
        </div>

        {/* Items Table */}
        {invoice.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="text-left p-4 font-medium text-sm text-muted-foreground">Qty</th>
                  <th className="text-left p-4 font-medium text-sm text-muted-foreground">Unit</th>
                  <th className="text-left p-4 font-medium text-sm text-muted-foreground">Description</th>
                  <th className="text-right p-4 font-medium text-sm text-muted-foreground">Unit Price</th>
                  <th className="text-right p-4 font-medium text-sm text-muted-foreground">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, index) => (
                  <tr key={index} className="border-b border-border/50 last:border-b-0">
                    <td className="p-4 text-sm font-medium">
                      {item.quantity}
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {item.category || 'PCS'}
                    </td>
                    <td className="p-4 text-sm">
                      <div>
                        <div className="font-medium">{item.name}</div>
                        {item.description && (
                          <div className="text-xs text-muted-foreground">{item.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-sm text-right">
                      {formatCurrencyWithLocale(item.unitPrice, invoice.currency || 'PHP')}
                    </td>
                    <td className="p-4 text-sm text-right font-medium">
                      {formatCurrencyWithLocale(item.totalPrice, invoice.currency || 'PHP')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals */}
        {(invoice.subtotal || invoice.tax) && (
          <div className="border-t border-border p-6 space-y-2">
            {invoice.subtotal && (
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrencyWithLocale(invoice.subtotal, invoice.currency || 'PHP')}</span>
              </div>
            )}
            {invoice.tax && (
              <div className="flex justify-between">
                <span>Tax</span>
                <span>{formatCurrencyWithLocale(invoice.tax, invoice.currency || 'PHP')}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-lg border-t border-border pt-2">
              <span>Total</span>
              <span>{formatCurrencyWithLocale(invoice.total, invoice.currency || 'PHP')}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
