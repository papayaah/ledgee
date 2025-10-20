"use client";

import { DatabaseInvoice } from '@/types/invoice';

interface AutoSyncConfig {
  spreadsheetId: string;
  apiKey?: string;
  sheetName?: string;
  enabled: boolean;
}

class AutoSheetsSync {
  private config: AutoSyncConfig;
  private retryQueue: DatabaseInvoice[] = [];
  private isProcessing = false;

  constructor(config: AutoSyncConfig) {
    this.config = config;
  }

  // Update configuration
  updateConfig(newConfig: Partial<AutoSyncConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Auto-save a single invoice to Google Sheets
  async saveInvoice(invoice: DatabaseInvoice): Promise<boolean> {
    if (!this.config.enabled || !this.config.spreadsheetId) {
      console.log('Auto-sync disabled or no spreadsheet ID configured');
      return false;
    }

    try {
      console.log('Auto-syncing invoice to Google Sheets:', invoice.id);
      
      // Check if sheet has headers, add them if not
      const hasHeaders = await this.checkIfSheetHasHeaders();
      if (!hasHeaders) {
        await this.addHeaders();
      }

      // Add the invoice data
      const values = this.formatInvoiceForSheets(invoice);
      await this.appendRow([values]);

      console.log('✅ Invoice auto-synced to Google Sheets:', invoice.id);
      return true;
    } catch (error) {
      console.error('❌ Auto-sync failed for invoice:', invoice.id, error);
      
      // Add to retry queue for later processing
      this.retryQueue.push(invoice);
      
      // Process retry queue in background
      this.processRetryQueue();
      
      return false;
    }
  }

  // Process any failed syncs from the retry queue
  private async processRetryQueue(): Promise<void> {
    if (this.isProcessing || this.retryQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`Processing ${this.retryQueue.length} failed syncs...`);

    const failedInvoices: DatabaseInvoice[] = [];

    for (const invoice of this.retryQueue) {
      try {
        const values = this.formatInvoiceForSheets(invoice);
        await this.appendRow([values]);
        console.log('✅ Retry successful for invoice:', invoice.id);
      } catch (error) {
        console.error('❌ Retry failed for invoice:', invoice.id, error);
        failedInvoices.push(invoice);
      }
    }

    this.retryQueue = failedInvoices;
    this.isProcessing = false;

    if (failedInvoices.length > 0) {
      console.log(`${failedInvoices.length} invoices still failed to sync`);
    }
  }

  // Format invoice data for Google Sheets
  private formatInvoiceForSheets(invoice: DatabaseInvoice): string[] {
    return [
      invoice.date,
      invoice.merchantName,
      invoice.total.toString(),
      invoice.currency || 'PHP',
      invoice.agentName || '',
      invoice.invoiceNumber || '',
      invoice.paymentMethod || '',
      invoice.phoneNumber || '',
      invoice.email || '',
      (invoice.items?.length || 0).toString(),
      invoice.createdAt,
      invoice.processingTime?.toString() || '',
      invoice.id
    ];
  }

  // Check if the sheet already has headers
  private async checkIfSheetHasHeaders(): Promise<boolean> {
    if (!this.config.apiKey) {
      // Without API key, assume headers exist to avoid errors
      return true;
    }

    try {
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}/values/${this.config.sheetName || 'Sheet1'}!A1:M1?key=${this.config.apiKey}`
      );
      
      if (!response.ok) return false;
      
      const data = await response.json();
      return data.values && data.values.length > 0;
    } catch (error) {
      console.error('Error checking headers:', error);
      return false;
    }
  }

  // Add headers to the sheet
  private async addHeaders(): Promise<void> {
    const headers = [
      'Date',
      'Merchant Name',
      'Total',
      'Currency',
      'Agent Name',
      'Invoice Number',
      'Payment Method',
      'Phone Number',
      'Email',
      'Items Count',
      'Created At',
      'Processing Time (ms)',
      'Invoice ID'
    ];

    await this.appendRow([headers]);
    console.log('Added headers to Google Sheet');
  }

  // Append a row to the Google Sheet
  private async appendRow(values: string[][]): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('Google Sheets API key required for auto-sync');
    }

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}/values/${this.config.sheetName || 'Sheet1'}!A:M:append?valueInputOption=RAW&key=${this.config.apiKey}`,
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
      const errorText = await response.text();
      throw new Error(`Google Sheets API error: ${response.status} ${errorText}`);
    }
  }

  // Get retry queue status
  getRetryQueueStatus(): { count: number; isProcessing: boolean } {
    return {
      count: this.retryQueue.length,
      isProcessing: this.isProcessing
    };
  }

  // Clear retry queue
  clearRetryQueue(): void {
    this.retryQueue = [];
  }
}

// Create singleton instance with your Google Sheets ID
export const autoSheetsSync = new AutoSheetsSync({
  spreadsheetId: '1ym0xPhwPKtYUXQTLCB8brozgsa50SEjFlAUr46k_uSY',
  sheetName: 'Invoices',
  enabled: false // Will be enabled when API key is provided
});

// Helper function to enable auto-sync with API key
export const enableAutoSync = (apiKey: string): void => {
  autoSheetsSync.updateConfig({
    apiKey,
    enabled: true
  });
  console.log('Auto-sync enabled for Google Sheets');
};

// Helper function to disable auto-sync
export const disableAutoSync = (): void => {
  autoSheetsSync.updateConfig({
    enabled: false
  });
  console.log('Auto-sync disabled');
};
