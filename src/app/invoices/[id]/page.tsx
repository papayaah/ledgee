'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import InvoiceDetails from '@/components/InvoiceDetails';
import { DatabaseInvoice } from '@/types/invoice';
import { invoiceDb } from '@/lib/database';
import { MdArrowBack } from 'react-icons/md';

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.id as string;
  
  const [invoice, setInvoice] = useState<DatabaseInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load invoice data
  useEffect(() => {
    const loadInvoice = async () => {
      try {
        if (!invoiceId) {
          setError('Invalid invoice ID');
          setLoading(false);
          return;
        }

        const invoiceData = await invoiceDb.getInvoice(invoiceId);
        if (invoiceData) {
          setInvoice(invoiceData);
        } else {
          setError('Invoice not found');
        }
      } catch (error) {
        console.error('Failed to load invoice:', error);
        setError('Failed to load invoice');
      } finally {
        setLoading(false);
      }
    };

    loadInvoice();
  }, [invoiceId]);

  const handleBack = () => {
    router.back();
  };

  // Removed: onAgentSelect usage (no longer a prop)

  const handleDelete = async () => {
    if (!invoice) return;

    try {
      await invoiceDb.deleteInvoice(invoice.id);
      router.push('/invoices');
    } catch (error) {
      console.error('Failed to delete invoice:', error);
      alert('Failed to delete invoice. Please try again.');
    }
  };

  const handleStatusChange = async (newStatus: 'review' | 'approved') => {
    if (!invoice) return;

    try {
      const updatedInvoice = {
        ...invoice,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      };
      
      await invoiceDb.saveInvoice(updatedInvoice);
      setInvoice(updatedInvoice);
    } catch (error) {
      console.error('Failed to update invoice status:', error);
      alert('Failed to update invoice status. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-full flex flex-col">
        <div className="flex items-center justify-center flex-1">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <div>
              <h2 className="text-xl font-semibold">Loading Invoice...</h2>
              <p className="text-muted-foreground">Fetching invoice details</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-full flex flex-col">
        <div className="text-center space-y-4 flex-1 flex flex-col justify-center">
          <div className="flex items-center justify-center mb-6">
            <button
              onClick={handleBack}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <MdArrowBack className="w-4 h-4" />
              <span>Back</span>
            </button>
          </div>
          
          <h1 className="text-4xl font-bold text-destructive">
            {error || 'Invoice Not Found'}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {error === 'Invoice not found' 
              ? 'The invoice you\'re looking for doesn\'t exist or may have been deleted.'
              : 'There was an error loading the invoice details.'
            }
          </p>
          <div className="mt-8">
            <button
              onClick={handleBack}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary/90 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-full flex flex-col">
      <div className="space-y-6 flex-1">
        {/* Simple Header */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleBack}
            className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
          >
            <MdArrowBack className="w-4 h-4" />
            <span>Back</span>
          </button>
          <h1 className="text-2xl font-bold">Invoice Details</h1>
        </div>

        {/* Invoice Details Component */}
        <InvoiceDetails 
          invoice={invoice}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
          onUpdate={(updatedInvoice) => setInvoice(updatedInvoice)}
        />
      </div>
    </div>
  );
}
