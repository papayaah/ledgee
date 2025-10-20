'use client';

import { DatabaseInvoice } from '@/types/invoice';
import { GoogleDriveFolders } from './google-drive-folders';

type DateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';

// Google Sheets API client for user's OAuth account
export class GoogleSheetsOAuth {
  private spreadsheetId: string;
  private accessToken: string;
  private showCurrencySymbol: boolean = false;
  private dateFormat: DateFormat = 'MM/DD/YYYY';
  private driveManager: GoogleDriveFolders;
  private invoicesFolderId: string | null = null;

  constructor(spreadsheetId: string, accessToken: string, showCurrencySymbol: boolean = false, dateFormat: DateFormat = 'MM/DD/YYYY') {
    this.spreadsheetId = spreadsheetId;
    this.accessToken = accessToken;
    this.showCurrencySymbol = showCurrencySymbol;
    this.dateFormat = dateFormat;
    this.driveManager = new GoogleDriveFolders(accessToken);
  }

  // Initialize folder structure
  async initialize(): Promise<void> {
    try {
      const folders = await this.driveManager.setupLedgeeFolders();
      this.invoicesFolderId = folders.invoicesFolderId;
      console.log('Google Sheets OAuth client initialized with folders');
    } catch (error) {
      console.error('Failed to initialize Google Sheets OAuth client:', error);
      throw error;
    }
  }

  // Format currency with optional symbol and commas
  private formatCurrency(amount: number | string): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    const formatted = num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return this.showCurrencySymbol ? `₱${formatted}` : formatted;
  }

  // Format date according to user preference
  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    switch (this.dateFormat) {
      case 'MM/DD/YYYY':
        return `${month}/${day}/${year}`;
      case 'DD/MM/YYYY':
        return `${day}/${month}/${year}`;
      case 'YYYY-MM-DD':
        return `${year}-${month}-${day}`;
      default:
        return dateString;
    }
  }

  // Upload image to Google Drive
  async uploadImageToDrive(imageData: string, fileName: string): Promise<string | null> {
    if (!this.invoicesFolderId) {
      console.error('Invoices folder not initialized');
      return null;
    }

    return await this.driveManager.uploadImage(imageData, fileName, this.invoicesFolderId);
  }

  // Helper to get sheet ID by name
  private async getSheetId(sheetName: string): Promise<number> {
    try {
      const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}?fields=sheets.properties`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        }
      });
      
      const data = await response.json();
      const sheet = data.sheets?.find((s: any) => s.properties.title === sheetName);
      return sheet?.properties.sheetId || 0;
    } catch {
      return 0;
    }
  }

  // Helper method to delete sheet if it exists
  private async deleteSheetIfExists(sheetName: string): Promise<void> {
    try {
      const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}?fields=sheets.properties`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        }
      });

      const data = await response.json();
      const existingSheet = data.sheets?.find(
        (sheet: any) => sheet.properties?.title === sheetName
      );

      if (existingSheet) {
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}:batchUpdate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [{
              deleteSheet: {
                sheetId: existingSheet.properties.sheetId
              }
            }]
          })
        });
      }
    } catch (error) {
      console.log(`Error checking/deleting ${sheetName} sheet:`, error);
    }
  }

  // Create Summary sheet
  async createSummarySheet(invoices: DatabaseInvoice[]): Promise<boolean> {
    try {
      // Check if Summary sheet exists and delete it
      await this.deleteSheetIfExists('Summary');

      // Create Summary sheet
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [{
            addSheet: {
              properties: {
                title: 'Summary',
                gridProperties: {
                  rowCount: 100,
                  columnCount: 20
                }
              }
            }
          }]
        })
      });

      // Upload images to Google Drive and create image map
      console.log('📤 Uploading invoice images to Google Drive...');
      const imageMap: { [invoiceId: string]: string } = {};
      for (const invoice of invoices) {
        if (invoice.imageData) {
          const fileName = `invoice_${invoice.invoiceNumber || invoice.id}.jpg`;
          const imageUrl = await this.uploadImageToDrive(invoice.imageData, fileName);
          if (imageUrl) {
            imageMap[invoice.id] = imageUrl;
          }
        }
      }
      console.log(`✅ Uploaded ${Object.keys(imageMap).length} images`);

      // Format data with image column
      const summaryData = [
        ['DATE', 'INVOICE #', 'TOTAL', 'AGENT', 'MERCHANT', 'IMAGE'],
        ...invoices.map(invoice => {
          const imageFormula = imageMap[invoice.id] 
            ? `=HYPERLINK("${imageMap[invoice.id]}", "View Invoice")` 
            : '';
          
          return [
            this.formatDate(invoice.date),
            invoice.invoiceNumber || '',
            this.formatCurrency(invoice.total),
            invoice.agentName || '',
            invoice.merchantName,
            imageFormula
          ];
        })
      ];

      // Add data
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/Summary!A1:F${summaryData.length}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: summaryData
        })
      });

      return true;
    } catch (error) {
      console.error('Error creating Summary sheet:', error);
      return false;
    }
  }

  // Create By Merchant sheet
  async createByMerchantSheet(invoices: DatabaseInvoice[]): Promise<boolean> {
    try {
      await this.deleteSheetIfExists('By Merchant');

      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [{
            addSheet: {
              properties: {
                title: 'By Merchant',
                gridProperties: {
                  rowCount: 100,
                  columnCount: 20
                }
              }
            }
          }]
        })
      });

      // Upload images
      console.log('📤 Uploading invoice images to Google Drive...');
      const imageMap: { [invoiceId: string]: string } = {};
      for (const invoice of invoices) {
        if (invoice.imageData) {
          const fileName = `invoice_${invoice.invoiceNumber || invoice.id}.jpg`;
          const imageUrl = await this.uploadImageToDrive(invoice.imageData, fileName);
          if (imageUrl) {
            imageMap[invoice.id] = imageUrl;
          }
        }
      }
      console.log(`✅ Uploaded ${Object.keys(imageMap).length} images`);

      // Group by merchant
      const merchantGroups: { [key: string]: DatabaseInvoice[] } = {};
      invoices.forEach(invoice => {
        const merchant = invoice.merchantName || 'Unknown';
        if (!merchantGroups[merchant]) {
          merchantGroups[merchant] = [];
        }
        merchantGroups[merchant].push(invoice);
      });

      const merchantData = [
        ['DATE', 'INVOICE NUMBER', 'CHARGE AMOUNT', 'TOTAL', 'STATUS', 'DATE', 'BANK', 'CHEQUE NO.', 'AMOUNT', 'IMAGE']
      ];

      const sortedMerchantNames = Object.keys(merchantGroups).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' })
      );

      sortedMerchantNames.forEach((merchantName) => {
        const merchantInvoices = merchantGroups[merchantName];
        const merchantTotal = merchantInvoices.reduce((sum, invoice) => sum + invoice.total, 0);
        
        merchantData.push([
          merchantName,
          '',
          '',
          this.formatCurrency(merchantTotal),
          '',
          '',
          '',
          '',
          this.formatCurrency(merchantTotal),
          ''
        ]);
        
        merchantInvoices.forEach(invoice => {
          const imageFormula = imageMap[invoice.id] 
            ? `=HYPERLINK("${imageMap[invoice.id]}", "View Invoice")` 
            : '';
          
          merchantData.push([
            this.formatDate(invoice.date),
            invoice.invoiceNumber || '',
            this.formatCurrency(invoice.total),
            '',
            'PENDING',
            '',
            '',
            '',
            '',
            imageFormula
          ]);
        });

        merchantData.push(['', '', '', '', '', '', '', '', '', '']);
      });

      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/By Merchant!A1:J${merchantData.length}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: merchantData
        })
      });

      return true;
    } catch (error) {
      console.error('Error creating By Merchant sheet:', error);
      return false;
    }
  }

  // Get spreadsheet URL
  getSpreadsheetUrl(): string {
    return `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}`;
  }
}

