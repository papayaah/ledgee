"use client";

import { DatabaseInvoice } from '@/types/invoice';

interface GoogleSheetsConfig {
  spreadsheetId: string;
  sheetName?: string;
  apiKey?: string;
}

export class GoogleSheetsSync {
  private config: GoogleSheetsConfig;

  constructor(config: GoogleSheetsConfig) {
    this.config = config;
  }

  // Method 1: Export to CSV for manual import
  exportToCSV(invoices: DatabaseInvoice[]): string {
    const headers = [
      'DATE',
      'INVOICE',
      'AMOUNT',
      'AGENT',
      'STORE',
      'Currency',
      'Payment Method',
      'Phone Number',
      'Email',
      'Items Count',
      'Created At'
    ];

    const csvContent = [
      headers.join(','),
      ...invoices.map(invoice => [
        invoice.date,
        `"${invoice.invoiceNumber || ''}"`,
        invoice.total,
        `"${invoice.agentName || ''}"`,
        `"${invoice.merchantName}"`,
        invoice.currency || 'PHP',
        `"${invoice.paymentMethod || ''}"`,
        `"${invoice.phoneNumber || ''}"`,
        `"${invoice.email || ''}"`,
        invoice.items?.length || 0,
        invoice.createdAt
      ].join(','))
    ].join('\n');

    return csvContent;
  }

  // Method 1b: Download CSV file
  downloadCSV(invoices: DatabaseInvoice[]): void {
    const csvContent = this.exportToCSV(invoices);
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invoices_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Method 2: Direct API sync (requires Google Sheets API)
  async syncToGoogleSheets(invoices: DatabaseInvoice[]): Promise<boolean> {
    if (!this.config.apiKey) {
      throw new Error('Google Sheets API key not configured');
    }

    try {
      const values = invoices.map(invoice => [
        invoice.date,
        invoice.invoiceNumber || '',
        String(invoice.total),
        invoice.agentName || '',
        invoice.merchantName,
        invoice.currency || 'PHP',
        invoice.paymentMethod || '',
        invoice.phoneNumber || '',
        invoice.email || '',
        String(invoice.items?.length || 0),
        invoice.createdAt
      ]);

      // Add headers if this is the first sync
      const hasHeaders = await this.checkIfSheetHasHeaders();
      if (!hasHeaders) {
        const headers = [
          'DATE',
          'INVOICE',
          'AMOUNT',
          'AGENT',
          'STORE',
          'Currency',
          'Payment Method',
          'Phone Number',
          'Email',
          'Items Count',
          'Created At'
        ];
        await this.appendRow([headers]);
      }

      // Add invoice data
      await this.appendRow(values);

      return true;
    } catch (error) {
      console.error('Google Sheets sync failed:', error);
      return false;
    }
  }

  private async checkIfSheetHasHeaders(): Promise<boolean> {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}/values/${this.config.sheetName || 'Sheet1'}!A1:K1?key=${this.config.apiKey}`
    );
    
    if (!response.ok) return false;
    
    const data = await response.json();
    return data.values && data.values.length > 0;
  }

  private async appendRow(values: string[][]): Promise<void> {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}/values/${this.config.sheetName || 'Sheet1'}!A:K:append?valueInputOption=RAW&key=${this.config.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: values
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Google Sheets API error: ${response.statusText}`);
    }
  }

  // Method 3: Generate Google Sheets import URL
  generateImportURL(invoices: DatabaseInvoice[]): string {
    const csvData = this.exportToCSV(invoices);
    const encodedData = encodeURIComponent(csvData);
    return `https://docs.google.com/spreadsheets/d/create?usp=sharing&csv=${encodedData}`;
  }
}

// Helper function to create sync instance
export const createGoogleSheetsSync = (spreadsheetId: string, apiKey?: string) => {
  return new GoogleSheetsSync({
    spreadsheetId,
    apiKey,
    sheetName: 'Invoices'
  });
};

// Export CSV function for easy use
export const exportInvoicesToCSV = (invoices: DatabaseInvoice[]) => {
  const sync = new GoogleSheetsSync({ spreadsheetId: '' });
  sync.downloadCSV(invoices);
};
