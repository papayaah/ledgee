'use client';

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import GoogleSheetsSyncClient from '@/components/GoogleSheetsSyncClient';
import { db } from '@/lib/database';

export default function ReportingPage() {
  
  // Use reactive query for invoices - automatically updates when IndexedDB changes
  const invoices = useLiveQuery(
    async () => {
      const allInvoices = await db.invoices.toArray();
      return allInvoices.sort((a, b) => {
        const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateCompare !== 0) return dateCompare;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    },
    []
  ) || [];
  
  const [loading, setLoading] = useState(true);

  // Initialize
  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        // Basic initialization
        console.log('Initializing reporting page...');
        
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
  }, []);

  if (loading) {
    return (
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-full flex flex-col">
        <div className="flex items-center justify-center flex-1">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <div>
              <h2 className="text-xl font-semibold">Loading Reporting...</h2>
              <p className="text-muted-foreground">Preparing your reporting interface</p>
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
            Reporting & Analytics
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Once you have some invoices, you can sync them to Google Sheets for advanced reporting and analysis.
          </p>
          <div className="mt-8">
            <a 
              href="/add-invoice" 
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary/90 transition-colors"
            >
              Add Your First Invoice
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-full flex flex-col">
      <div className="space-y-8 flex-1">
        {/* Page Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold brand-gradient">
            Reporting & Analytics
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Export your invoice data to Google Sheets for advanced reporting, analysis, and collaboration.
            You have {invoices.length} invoice{invoices.length !== 1 ? 's' : ''} ready for export.
          </p>
        </div>

        {/* Google Sheets Integration */}
        <div className="max-w-4xl mx-auto">
          <GoogleSheetsSyncClient 
            invoices={invoices}
            disabled={false}
          />
        </div>
      </div>
    </div>
  );
}
