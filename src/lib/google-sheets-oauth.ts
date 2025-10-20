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

  // Create month sheets
  async createMonthSheets(invoices: any[]): Promise<string[]> {
    try {
      console.log('Creating month sheets...');
      
      // Group invoices by month
      const monthlyData: { [key: string]: any[] } = {};
      invoices.forEach(invoice => {
        const date = new Date(invoice.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = [];
        }
        monthlyData[monthKey].push(invoice);
      });

      const createdSheets: string[] = [];

      // Create a sheet for each month
      for (const [monthKey, monthInvoices] of Object.entries(monthlyData)) {
        const monthName = new Date(monthKey + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
        const sheetName = monthName;
        
        // Create the sheet
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
                  title: sheetName
                }
              }
            }]
          })
        });

        // Add data to the sheet
        const headers = ['Date', 'Invoice #', 'Merchant', 'Store', 'Agent', 'Total', 'Status'];
        const data = [headers];
        
        monthInvoices.forEach(invoice => {
          data.push([
            this.formatDate(invoice.date),
            invoice.invoiceNumber || '',
            invoice.merchantName || '',
            invoice.storeName || '',
            invoice.agentName || '',
            this.formatCurrency(invoice.total),
            invoice.status || 'Processed'
          ]);
        });

        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${sheetName}!A1:G${data.length}?valueInputOption=USER_ENTERED`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: data
          })
        });

        createdSheets.push(sheetName);
      }

      return createdSheets;
    } catch (error) {
      console.error('Error creating month sheets:', error);
      return [];
    }
  }

  // Create counter receipts sheet (2 printable columns layout)
  async createReceiptsSheet(invoices: any[]): Promise<boolean> {
    try {
      console.log('Creating Counter Receipts sheet...');

      // Remove old sheet if exists
      await this.deleteSheetIfExists('Counter Receipts');

      // Create the sheet
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
                title: 'Counter Receipts',
                gridProperties: { rowCount: 200, columnCount: 12 }
              }
            }
          }]
        })
      });

      const sheetId = await this.getSheetId('Counter Receipts');

      // Group by merchant, then lay out blocks per merchant
      const maxRowsPerBlock = 12; // rows of items per merchant block
      const blocks: { startCol: number; startRow: number; items: any[] }[] = [];
      const leftStartCol = 1; // A
      const rightStartCol = 7; // G (leave spacing columns D/E/F between)

      const merchantGroups: { [merchant: string]: any[] } = {};
      for (const inv of invoices) {
        const key = (inv.merchantName || 'Unknown').toString();
        if (!merchantGroups[key]) merchantGroups[key] = [];
        merchantGroups[key].push(inv);
      }

      let rowCursor = 1;
      let sideLeft = true; // true=A–C, false=G–I
      const sortedMerchants = Object.keys(merchantGroups).sort((a, b) => a.localeCompare(b));
      for (const merchant of sortedMerchants) {
        const list = merchantGroups[merchant];
        // Keep invoices for merchant sorted by date ascending
        list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        for (let i = 0; i < list.length; i += maxRowsPerBlock) {
          const slice = list.slice(i, i + maxRowsPerBlock);
          blocks.push({
            startCol: sideLeft ? leftStartCol : rightStartCol,
            startRow: rowCursor,
            items: slice
          });
          if (sideLeft) {
            // next goes to right column on same row
            sideLeft = false;
          } else {
            // after right column, move to next row and reset to left
            rowCursor += 24;
            sideLeft = true;
          }
        }
        // If merchant ended on left column (no right placed), move to next row
        if (sideLeft === false) {
          rowCursor += 24;
          sideLeft = true;
        }
      }

      // Build value updates per block
      const valueUpdates: { range: string; values: any[][] }[] = [];
      const monthFmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      for (const block of blocks) {
        const colLetter = (n: number) => String.fromCharCode('A'.charCodeAt(0) + (n - 1));
        const start = `${colLetter(block.startCol)}${block.startRow}`;

        const headerValues = [
          [`Date: ${this.formatDate(new Date().toISOString())}`],
          [`From: ${block.items[0]?.storeName || 'N/A'}`],
          [`To: ${(block.items[0]?.merchantName || 'N/A')}`],
          [
            `Address: ${[
              block.items[0]?.merchantAddress?.street,
              block.items[0]?.merchantAddress?.city,
              block.items[0]?.merchantAddress?.state,
              block.items[0]?.merchantAddress?.zipCode,
              block.items[0]?.merchantAddress?.country
            ].filter(Boolean).join(', ')}`
          ],
          ['DATE', 'INVOICE', 'AMOUNT']
        ];

        valueUpdates.push({
          range: `Counter Receipts!${start}:${colLetter(block.startCol + 2)}${block.startRow + 4}`,
          values: headerValues
        });

        // Month label row
        if (block.items.length) {
          valueUpdates.push({
            range: `Counter Receipts!${colLetter(block.startCol)}${block.startRow + 6}`,
            values: [[`${monthFmt(block.items[0].date)}`]]
          });
        }

        // Item rows start at startRow + 7
        const itemRows: any[][] = [];
        for (const inv of block.items) {
          itemRows.push([
            this.formatDate(inv.date),
            inv.invoiceNumber || '',
            this.formatCurrency(inv.total)
          ]);
        }
        if (itemRows.length) {
          valueUpdates.push({
            range: `Counter Receipts!${colLetter(block.startCol)}${block.startRow + 7}:${colLetter(block.startCol + 2)}${block.startRow + 7 + itemRows.length - 1}`,
            values: itemRows
          });
        }

        // TOTAL row and footers
        const total = block.items.reduce((s, inv) => s + (Number(inv.total) || 0), 0);
        const totalRow = block.startRow + 20;
        valueUpdates.push({
          range: `Counter Receipts!${colLetter(block.startCol)}${totalRow}:${colLetter(block.startCol + 2)}${totalRow + 3}`,
          values: [
            ['TOTAL:', '', this.formatCurrency(total)],
            ['If found correct payment will be made on'],
            [''],
            ['Authorized Signature:']
          ]
        });
      }

      // Apply all value updates
      for (const upd of valueUpdates) {
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${encodeURIComponent(upd.range)}?valueInputOption=USER_ENTERED`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: upd.values })
        });
      }

      // Batch formatting: column widths, bold headers, borders around table areas
      const requests: any[] = [
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 12 },
            properties: { pixelSize: 90 },
            fields: 'pixelSize'
          }
        }
      ];

      for (const block of blocks) {
        const startCol = block.startCol - 1; // zero-based
        const headerRow = block.startRow + 4 - 1; // zero-based index for header line
        const tableStartRow = block.startRow + 6 - 1; // month label row
        const itemsStartRow = block.startRow + 7 - 1;
        const itemsEndRow = itemsStartRow + Math.max(1, block.items.length);

        // Bold header row
        requests.push({
          repeatCell: {
            range: { sheetId, startRowIndex: headerRow, endRowIndex: headerRow + 1, startColumnIndex: startCol, endColumnIndex: startCol + 3 },
            cell: { userEnteredFormat: { textFormat: { bold: true } } },
            fields: 'userEnteredFormat.textFormat.bold'
          }
        });

        // Right-align amount column
        requests.push({
          repeatCell: {
            range: { sheetId, startRowIndex: itemsStartRow, endRowIndex: itemsEndRow + 1, startColumnIndex: startCol + 2, endColumnIndex: startCol + 3 },
            cell: { userEnteredFormat: { horizontalAlignment: 'RIGHT' } },
            fields: 'userEnteredFormat.horizontalAlignment'
          }
        });

        // Outline borders for table area (headers + items to a fixed area)
        requests.push({
          updateBorders: {
            range: {
              sheetId,
              startRowIndex: headerRow,
              endRowIndex: Math.max(itemsEndRow + 1, headerRow + 14),
              startColumnIndex: startCol,
              endColumnIndex: startCol + 3
            },
            top: { style: 'SOLID' },
            bottom: { style: 'SOLID' },
            left: { style: 'SOLID' },
            right: { style: 'SOLID' }
          }
        });
      }

      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests })
      });

      return true;
    } catch (error) {
      console.error('Error creating Counter Receipts sheet:', error);
      return false;
    }
  }

  // Get spreadsheet URL
  getSpreadsheetUrl(): string {
    return `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}`;
  }
}

