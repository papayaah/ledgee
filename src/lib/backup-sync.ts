import { DatabaseInvoice } from '@/types/invoice';
// import { GoogleSheetsClient } from './google-sheets-client'; // Removed - had secrets
import { StoreRecord, MerchantRecord, AgentRecord, db } from './database';
import { createSheetsClient } from './sheets-client-factory';

const BACKUP_SHEET_NAME = 'Backup';

// Vertical layout - all entities in columns A onwards, separated by section headers
// Section 1: INVOICES (starts at row 1)
// Section 2: STORES (starts after invoices + 2 blank rows)
// Section 3: MERCHANTS (starts after stores + 2 blank rows)
// Section 4: AGENTS (starts after merchants + 2 blank rows)

class BackupSync {
  private client: any | null = null;
  private isInitialized = false;
  private spreadsheetId: string | null = null;

  private getSpreadsheetId(): string {
    if (!this.spreadsheetId) {
      throw new Error('Backup sync not initialized. Please initialize first.');
    }
    return this.spreadsheetId;
  }

  async initialize(): Promise<boolean> {
    try {
      // Get user's personal spreadsheet ID
      const sheetIdSetting = await db.settings.get('ledgee_spreadsheet_id');
      if (!sheetIdSetting?.value) {
        throw new Error('No personal spreadsheet found. Please create a Ledgee spreadsheet first.');
      }
      this.spreadsheetId = sheetIdSetting.value as string;
      
      // Use Google account for backup sync
      const { client, mode } = await createSheetsClient();
      if (mode === 'needs_setup') {
        throw new Error('Google account not connected or spreadsheet not created. Please connect your Google account and create a spreadsheet first.');
      }
      this.client = client;
      this.isInitialized = true;
      console.log('Backup sync initialized with Google account');
      return true;
    } catch (error) {
      console.error('Failed to initialize backup sync:', error);
      return false;
    }
  }

  // Sync a single invoice to the Backup sheet
  async syncInvoice(invoice: DatabaseInvoice): Promise<boolean> {
    try {
      console.log('[BackupSync] Starting backup for invoice:', invoice.id);
      
      if (!this.isInitialized || !this.client) {
        console.log('[BackupSync] Not initialized, initializing now...');
        const initialized = await this.initialize();
        if (!initialized) {
          throw new Error('Failed to initialize backup sync');
        }
      }

      if (!this.client) {
        throw new Error('Client not initialized');
      }

      console.log('[BackupSync] Client ready, checking headers...');

      // Check if Backup sheet exists and has headers
      const hasHeaders = await this.checkIfSheetHasHeaders();
      console.log('[BackupSync] Has headers:', hasHeaders);
      
      if (!hasHeaders) {
        console.log('[BackupSync] Adding headers to Backup sheet...');
        await this.addHeaders();
      }

      // Format invoice data for backup (async now for image upload)
      console.log('[BackupSync] Formatting invoice data...');
      const values = await this.formatInvoiceForBackup(invoice);
      console.log('[BackupSync] Formatted values:', values.slice(0, 5), '... (truncated)');
      
      console.log('[BackupSync] Appending row to sheet...');
      // Use USER_ENTERED to process formulas like =IMAGE()
      await this.appendRowWithFormulas([values]);

      console.log('✅ [BackupSync] Invoice backed up successfully:', invoice.id);
      return true;
    } catch (error) {
      console.error('❌ [BackupSync] Backup failed for invoice:', invoice.id, error);
      return false;
    }
  }

  // Restore all invoices from the Backup sheet
  async restoreInvoices(): Promise<DatabaseInvoice[]> {
    try {
      if (!this.isInitialized || !this.client) {
        await this.initialize();
      }

      if (!this.client) {
        throw new Error('Client not initialized');
      }

      // Get data from Backup sheet
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.getSpreadsheetId()}/values/${BACKUP_SHEET_NAME}!A:Z`,
        {
          headers: {
            'Authorization': `Bearer ${(this.client as any).accessToken}`,
          }
        }
      );

      const data = await response.json();
      const rows = data.values || [];

      if (rows.length <= 1) {
        console.log('No invoices to restore');
        return [];
      }

      // Parse rows into invoices (skip header row)
      const invoices: DatabaseInvoice[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        try {
          const invoice = this.parseRowToInvoice(row);
          if (invoice) {
            invoices.push(invoice);
          }
        } catch (error) {
          console.error(`Failed to parse row ${i}:`, error);
        }
      }

      console.log(`Restored ${invoices.length} invoices from backup`);
      return invoices;
    } catch (error) {
      console.error('Failed to restore invoices:', error);
      throw error;
    }
  }

  private async formatInvoiceForBackup(invoice: DatabaseInvoice): Promise<string[]> {
    let imageFormula = '';
    
    // Upload image to temporary hosting for development/testing
    // Using ImgBB free service - no API key needed for basic use
    if (invoice.imageData) {
      try {
        console.log('📤 Uploading image to temporary hosting...');
        const imageUrl = await this.uploadImageToImgBB(invoice.imageData);
        if (imageUrl) {
          imageFormula = `=IMAGE("${imageUrl}")`;
          console.log('✅ Image uploaded:', imageUrl);
        }
      } catch (error) {
        console.error('❌ Failed to upload image:', error);
      }
    }
    
    return [
      invoice.id,
      invoice.merchantName,
      invoice.date,
      String(invoice.total),
      invoice.currency || 'PHP',
      invoice.invoiceNumber || '',
      invoice.agentName || '',
      invoice.terms || '',
      String(invoice.termsDays || ''),
      invoice.paymentMethod || '',
      invoice.merchantAddress?.street || '',
      invoice.merchantAddress?.city || '',
      invoice.merchantAddress?.state || '',
      invoice.merchantAddress?.zipCode || '',
      invoice.phoneNumber || '',
      invoice.email || '',
      invoice.website || '',
      JSON.stringify(invoice.items),
      String(invoice.subtotal || ''),
      String(invoice.tax || ''),
      invoice.createdAt,
      invoice.updatedAt || invoice.createdAt,
      invoice.status || 'review',
      String(invoice.processingTime || ''),
      imageFormula, // IMAGE formula for embedded display
    ];
  }

  private parseRowToInvoice(row: string[]): DatabaseInvoice | null {
    try {
      const invoice: DatabaseInvoice = {
        id: row[0] || '',
        merchantName: row[1] || '',
        date: row[2] || '',
        total: parseFloat(row[3]) || 0,
        currency: row[4] || 'PHP',
        invoiceNumber: row[5] || undefined,
        agentName: row[6] || undefined,
        terms: row[7] || undefined,
        termsDays: row[8] ? parseInt(row[8]) : undefined,
        paymentMethod: row[9] || undefined,
        merchantAddress: {
          street: row[10] || undefined,
          city: row[11] || undefined,
          state: row[12] || undefined,
          zipCode: row[13] || undefined,
        },
        phoneNumber: row[14] || undefined,
        email: row[15] || undefined,
        website: row[16] || undefined,
        items: row[17] ? JSON.parse(row[17]) : [],
        subtotal: row[18] ? parseFloat(row[18]) : undefined,
        tax: row[19] ? parseFloat(row[19]) : undefined,
        createdAt: row[20] || new Date().toISOString(),
        updatedAt: row[21] || row[20] || new Date().toISOString(),
        status: (row[22] as any) || 'review',
        processingTime: row[23] ? parseInt(row[23]) : undefined,
        extractedAt: row[20] || new Date().toISOString(),
      };

      return invoice;
    } catch (error) {
      console.error('Failed to parse invoice row:', error);
      return null;
    }
  }


  private async addHeaders(): Promise<void> {
    const headers = [
      'ID',
      'Merchant Name',
      'Date',
      'Total',
      'Currency',
      'Invoice Number',
      'Agent Name',
      'Terms',
      'Terms Days',
      'Payment Method',
      'Street',
      'City',
      'State',
      'Zip Code',
      'Phone',
      'Email',
      'Website',
      'Items (JSON)',
      'Subtotal',
      'Tax',
      'Created At',
      'Updated At',
      'Status',
      'Processing Time (ms)',
      'Image', // IMAGE formula for embedded display
    ];

    await this.appendRow([headers]);
    
    // Note: Sheet protection removed to allow auto-sync to work
    // Protection requires specific permissions and can block automated writes
  }

  private async appendRow(values: string[][], sheetName: string = BACKUP_SHEET_NAME): Promise<void> {
    if (!this.client) throw new Error('Client not initialized');

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.getSpreadsheetId()}/values/${sheetName}!A:Z:append?valueInputOption=RAW`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(this.client as any).accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[BackupSync] API Error Response:', errorText);
      throw new Error(`Failed to append row: ${response.statusText} - ${errorText}`);
    }
  }

  private async appendRowWithFormulas(values: string[][], sheetName: string = BACKUP_SHEET_NAME): Promise<void> {
    if (!this.client) throw new Error('Client not initialized');

    // Use USER_ENTERED to process formulas like =IMAGE()
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.getSpreadsheetId()}/values/${sheetName}!A:Z:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(this.client as any).accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[BackupSync] API Error Response:', errorText);
      throw new Error(`Failed to append row with formulas: ${response.statusText} - ${errorText}`);
    }
  }

  // Protect the Backup sheet from editing (warning only, not full protection)
  private async protectSheet(): Promise<void> {
    try {
      if (!this.client) return;

      // Get the sheet ID for the Backup sheet
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.getSpreadsheetId()}?fields=sheets.properties`,
        {
          headers: {
            'Authorization': `Bearer ${(this.client as any).accessToken}`,
          }
        }
      );

      const data = await response.json();
      const backupSheet = data.sheets?.find(
        (sheet: any) => sheet.properties?.title === BACKUP_SHEET_NAME
      );

      if (!backupSheet) return;

      // Add warning-only protection
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.getSpreadsheetId()}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${(this.client as any).accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [{
              addProtectedRange: {
                protectedRange: {
                  range: {
                    sheetId: backupSheet.properties.sheetId,
                  },
                  warningOnly: true, // Warning only, allows editing with confirmation
                  description: 'This sheet is an automated backup. Manual edits may be overwritten.',
                }
              }
            }]
          })
        }
      );

      console.log('Backup sheet protected (warning mode)');
    } catch (error) {
      console.log('Could not protect sheet (non-critical):', error);
    }
  }

  // ============= STORES BACKUP (Horizontal: Columns Z-AE) =============
  async syncStore(store: StoreRecord): Promise<boolean> {
    try {
      console.log('[BackupSync] Syncing store:', store.name);
      
      if (!this.isInitialized || !this.client) {
        console.log('[BackupSync] Not initialized, initializing...');
        await this.initialize();
      }

      if (!this.client) {
        throw new Error('Client not initialized');
      }

      // Check if sheet has headers in the stores section
      console.log('[BackupSync] Checking stores headers...');
      const hasHeaders = await this.checkStoresHeaders();
      if (!hasHeaders) {
        console.log('[BackupSync] Adding stores headers...');
        await this.addStoresHeaders();
      }

      // Find existing row by ID in column Z
      const existingRowIndex = await this.findStoreRowInBackup(store.id);
      console.log('[BackupSync] Existing row index:', existingRowIndex);
      
      const values = [
        store.id,
        store.name,
        store.address,
        String(store.isDefault),
        store.createdAt,
        store.updatedAt
      ];

      if (existingRowIndex !== null) {
        // Update existing row in columns Z-AE
        console.log('[BackupSync] Updating store row:', existingRowIndex);
        await this.updateStoreRow(existingRowIndex, values);
      } else {
        // Append new row in columns Z-AE
        console.log('[BackupSync] Appending new store row');
        await this.appendStoreRow(values);
      }

      console.log('✅ [BackupSync] Store backed up:', store.name);
      return true;
    } catch (error) {
      console.error('❌ [BackupSync] Store backup failed:', error);
      return false;
    }
  }

  async restoreStores(): Promise<StoreRecord[]> {
    try {
      if (!this.isInitialized || !this.client) {
        await this.initialize();
      }

      if (!this.client) {
        throw new Error('Client not initialized');
      }

      // Read from columns Z-AE
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.getSpreadsheetId()}/values/${BACKUP_SHEET_NAME}!Z:AE`,
        {
          headers: {
            'Authorization': `Bearer ${(this.client as any).accessToken}`,
          }
        }
      );

      const data = await response.json();
      const rows = data.values || [];

      if (rows.length <= 1) {
        console.log('No stores to restore');
        return [];
      }

      const stores: StoreRecord[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row[0]) continue; // Skip empty rows
        stores.push({
          id: row[0],
          name: row[1],
          address: row[2] || '',
          isDefault: row[3] === 'true',
          createdAt: row[4],
          updatedAt: row[5]
        });
      }

      console.log(`Restored ${stores.length} stores from backup`);
      return stores;
    } catch (error) {
      console.error('Failed to restore stores:', error);
      return [];
    }
  }

  // Helper methods for horizontal stores layout
  private async checkStoresHeaders(): Promise<boolean> {
    try {
      if (!this.client) return false;
      
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.getSpreadsheetId()}/values/${BACKUP_SHEET_NAME}!Z1:AE1`,
        {
          headers: {
            'Authorization': `Bearer ${(this.client as any).accessToken}`,
          }
        }
      );

      const data = await response.json();
      return data.values && data.values.length > 0 && data.values[0][0];
    } catch {
      return false;
    }
  }

  private async addStoresHeaders(): Promise<void> {
    if (!this.client) throw new Error('Client not initialized');

    const headers = ['ID', 'Name', 'Address', 'Is Default', 'Created At', 'Updated At'];
    
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.getSpreadsheetId()}/values/${BACKUP_SHEET_NAME}!Z1:AE1?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${(this.client as any).accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [headers] })
      }
    );
  }

  private async findStoreRowInBackup(storeId: string): Promise<number | null> {
    try {
      if (!this.client) return null;

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.getSpreadsheetId()}/values/${BACKUP_SHEET_NAME}!Z:Z`,
        {
          headers: {
            'Authorization': `Bearer ${(this.client as any).accessToken}`,
          }
        }
      );

      const data = await response.json();
      const rows = data.values || [];

      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === storeId) {
          return i + 1; // Return 1-based row number
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to find store row:', error);
      return null;
    }
  }

  private async appendStoreRow(values: string[]): Promise<void> {
    if (!this.client) throw new Error('Client not initialized');

    // Get next row number
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.getSpreadsheetId()}/values/${BACKUP_SHEET_NAME}!Z:Z`,
      {
        headers: {
          'Authorization': `Bearer ${(this.client as any).accessToken}`,
        }
      }
    );

    const data = await response.json();
    const nextRow = (data.values?.length || 0) + 1;

    // Append to specific row
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.getSpreadsheetId()}/values/${BACKUP_SHEET_NAME}!Z${nextRow}:AE${nextRow}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${(this.client as any).accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [values] })
      }
    );
  }

  private async updateStoreRow(rowNumber: number, values: string[]): Promise<void> {
    if (!this.client) throw new Error('Client not initialized');

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.getSpreadsheetId()}/values/${BACKUP_SHEET_NAME}!Z${rowNumber}:AE${rowNumber}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${(this.client as any).accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [values] })
      }
    );
  }

  // ============= MERCHANTS BACKUP (Horizontal: Columns AG-AK) =============
  async syncMerchant(merchant: MerchantRecord): Promise<boolean> {
    try {
      console.log('[BackupSync] Syncing merchant:', merchant.name);
      
      if (!this.isInitialized || !this.client) {
        console.log('[BackupSync] Not initialized, initializing...');
        await this.initialize();
      }

      if (!this.client) {
        throw new Error('Client not initialized');
      }

      console.log('[BackupSync] Checking merchants headers...');
      const hasHeaders = await this.checkMerchantsHeaders();
      if (!hasHeaders) {
        console.log('[BackupSync] Adding merchants headers...');
        await this.addMerchantsHeaders();
      }

      const existingRowIndex = await this.findMerchantRowInBackup(merchant.id);
      console.log('[BackupSync] Existing row index:', existingRowIndex);
      
      const values = [
        merchant.id,
        merchant.name,
        merchant.address,
        merchant.createdAt,
        merchant.updatedAt
      ];

      if (existingRowIndex !== null) {
        console.log('[BackupSync] Updating merchant row:', existingRowIndex);
        await this.updateMerchantRow(existingRowIndex, values);
      } else {
        console.log('[BackupSync] Appending new merchant row');
        await this.appendMerchantRow(values);
      }

      console.log('✅ [BackupSync] Merchant backed up:', merchant.name);
      return true;
    } catch (error) {
      console.error('❌ [BackupSync] Merchant backup failed:', error);
      return false;
    }
  }

  async restoreMerchants(): Promise<MerchantRecord[]> {
    try {
      if (!this.isInitialized || !this.client) {
        await this.initialize();
      }

      if (!this.client) {
        throw new Error('Client not initialized');
      }

      // Read from columns AG-AK
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.getSpreadsheetId()}/values/${BACKUP_SHEET_NAME}!AG:AK`,
        {
          headers: {
            'Authorization': `Bearer ${(this.client as any).accessToken}`,
          }
        }
      );

      const data = await response.json();
      const rows = data.values || [];

      if (rows.length <= 1) {
        console.log('No merchants to restore');
        return [];
      }

      const merchants: MerchantRecord[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row[0]) continue; // Skip empty rows
        merchants.push({
          id: row[0],
          name: row[1],
          address: row[2] || '',
          createdAt: row[3],
          updatedAt: row[4]
        });
      }

      console.log(`Restored ${merchants.length} merchants from backup`);
      return merchants;
    } catch (error) {
      console.error('Failed to restore merchants:', error);
      return [];
    }
  }

  // Helper methods for horizontal merchants layout
  private async checkMerchantsHeaders(): Promise<boolean> {
    try {
      if (!this.client) return false;
      
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.getSpreadsheetId()}/values/${BACKUP_SHEET_NAME}!AG1:AK1`,
        {
          headers: {
            'Authorization': `Bearer ${(this.client as any).accessToken}`,
          }
        }
      );

      const data = await response.json();
      return data.values && data.values.length > 0 && data.values[0][0];
    } catch {
      return false;
    }
  }

  private async addMerchantsHeaders(): Promise<void> {
    if (!this.client) throw new Error('Client not initialized');

    const headers = ['ID', 'Name', 'Address', 'Created At', 'Updated At'];
    
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.getSpreadsheetId()}/values/${BACKUP_SHEET_NAME}!AG1:AK1?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${(this.client as any).accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [headers] })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [BackupSync] Failed to add merchants headers:', errorText);
      throw new Error(`Failed to add merchants headers: ${response.statusText}`);
    }
  }

  private async findMerchantRowInBackup(merchantId: string): Promise<number | null> {
    try {
      if (!this.client) return null;

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.getSpreadsheetId()}/values/${BACKUP_SHEET_NAME}!AG:AG`,
        {
          headers: {
            'Authorization': `Bearer ${(this.client as any).accessToken}`,
          }
        }
      );

      const data = await response.json();
      const rows = data.values || [];

      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === merchantId) {
          return i + 1;
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to find merchant row:', error);
      return null;
    }
  }

  private async appendMerchantRow(values: string[]): Promise<void> {
    if (!this.client) throw new Error('Client not initialized');

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.getSpreadsheetId()}/values/${BACKUP_SHEET_NAME}!AG:AG`,
      {
        headers: {
          'Authorization': `Bearer ${(this.client as any).accessToken}`,
        }
      }
    );

    const data = await response.json();
    const nextRow = (data.values?.length || 0) + 1;

    console.log('[BackupSync] Appending merchant to row:', nextRow);

    const putResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.getSpreadsheetId()}/values/${BACKUP_SHEET_NAME}!AG${nextRow}:AK${nextRow}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${(this.client as any).accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [values] })
      }
    );

    if (!putResponse.ok) {
      const errorText = await putResponse.text();
      console.error('❌ [BackupSync] Failed to append merchant row:', errorText);
      throw new Error(`Failed to append merchant row: ${putResponse.statusText}`);
    }
  }

  private async updateMerchantRow(rowNumber: number, values: string[]): Promise<void> {
    if (!this.client) throw new Error('Client not initialized');

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.getSpreadsheetId()}/values/${BACKUP_SHEET_NAME}!AG${rowNumber}:AK${rowNumber}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${(this.client as any).accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [values] })
      }
    );
  }

  // ============= AGENTS BACKUP (Horizontal: Columns AM-AP) =============
  async syncAgent(agent: AgentRecord): Promise<boolean> {
    try {
      console.log('[BackupSync] Syncing agent:', agent.name);
      
      if (!this.isInitialized || !this.client) {
        console.log('[BackupSync] Not initialized, initializing...');
        await this.initialize();
      }

      if (!this.client) {
        throw new Error('Client not initialized');
      }

      console.log('[BackupSync] Checking agents headers...');
      const hasHeaders = await this.checkAgentsHeaders();
      if (!hasHeaders) {
        console.log('[BackupSync] Adding agents headers...');
        await this.addAgentsHeaders();
      }

      const existingRowIndex = await this.findAgentRowInBackup(agent.id);
      console.log('[BackupSync] Existing row index:', existingRowIndex);
      
      const values = [
        agent.id,
        agent.name,
        agent.createdAt,
        agent.updatedAt
      ];

      if (existingRowIndex !== null) {
        console.log('[BackupSync] Updating agent row:', existingRowIndex);
        await this.updateAgentRow(existingRowIndex, values);
      } else {
        console.log('[BackupSync] Appending new agent row');
        await this.appendAgentRow(values);
      }

      console.log('✅ [BackupSync] Agent backed up:', agent.name);
      return true;
    } catch (error) {
      console.error('❌ [BackupSync] Agent backup failed:', error);
      return false;
    }
  }

  async restoreAgents(): Promise<AgentRecord[]> {
    try {
      if (!this.isInitialized || !this.client) {
        await this.initialize();
      }

      if (!this.client) {
        throw new Error('Client not initialized');
      }

      // Read from columns AM-AP
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.getSpreadsheetId()}/values/${BACKUP_SHEET_NAME}!AM:AP`,
        {
          headers: {
            'Authorization': `Bearer ${(this.client as any).accessToken}`,
          }
        }
      );

      const data = await response.json();
      const rows = data.values || [];

      if (rows.length <= 1) {
        console.log('No agents to restore');
        return [];
      }

      const agents: AgentRecord[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row[0]) continue; // Skip empty rows
        agents.push({
          id: row[0],
          name: row[1],
          createdAt: row[2],
          updatedAt: row[3]
        });
      }

      console.log(`Restored ${agents.length} agents from backup`);
      return agents;
    } catch (error) {
      console.error('Failed to restore agents:', error);
      return [];
    }
  }

  // Helper methods for horizontal agents layout
  private async checkAgentsHeaders(): Promise<boolean> {
    try {
      if (!this.client) return false;
      
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.getSpreadsheetId()}/values/${BACKUP_SHEET_NAME}!AM1:AP1`,
        {
          headers: {
            'Authorization': `Bearer ${(this.client as any).accessToken}`,
          }
        }
      );

      const data = await response.json();
      return data.values && data.values.length > 0 && data.values[0][0];
    } catch {
      return false;
    }
  }

  private async addAgentsHeaders(): Promise<void> {
    if (!this.client) throw new Error('Client not initialized');

    const headers = ['ID', 'Name', 'Created At', 'Updated At'];
    
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.getSpreadsheetId()}/values/${BACKUP_SHEET_NAME}!AM1:AP1?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${(this.client as any).accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [headers] })
      }
    );
  }

  private async findAgentRowInBackup(agentId: string): Promise<number | null> {
    try {
      if (!this.client) return null;

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.getSpreadsheetId()}/values/${BACKUP_SHEET_NAME}!AM:AM`,
        {
          headers: {
            'Authorization': `Bearer ${(this.client as any).accessToken}`,
          }
        }
      );

      const data = await response.json();
      const rows = data.values || [];

      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === agentId) {
          return i + 1;
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to find agent row:', error);
      return null;
    }
  }

  private async appendAgentRow(values: string[]): Promise<void> {
    if (!this.client) throw new Error('Client not initialized');

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.getSpreadsheetId()}/values/${BACKUP_SHEET_NAME}!AM:AM`,
      {
        headers: {
          'Authorization': `Bearer ${(this.client as any).accessToken}`,
        }
      }
    );

    const data = await response.json();
    const nextRow = (data.values?.length || 0) + 1;

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.getSpreadsheetId()}/values/${BACKUP_SHEET_NAME}!AM${nextRow}:AP${nextRow}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${(this.client as any).accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [values] })
      }
    );
  }

  private async updateAgentRow(rowNumber: number, values: string[]): Promise<void> {
    if (!this.client) throw new Error('Client not initialized');

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.getSpreadsheetId()}/values/${BACKUP_SHEET_NAME}!AM${rowNumber}:AP${rowNumber}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${(this.client as any).accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [values] })
      }
    );
  }

  // ============= IMAGE UPLOAD HELPER =============
  private async uploadImageToImgBB(imageData: string): Promise<string | null> {
    try {
      // Extract base64 data (remove data:image/jpeg;base64, prefix)
      const base64Data = imageData.split(',')[1] || imageData;
      
      // Using ImgBB API - https://api.imgbb.com/
      const formData = new FormData();
      formData.append('image', base64Data);
      
      // Upload with your API key
      const response = await fetch('https://api.imgbb.com/1/upload?key=8e225894ce8bf30f4bec24eb013647f0', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('ImgBB API Error:', errorText);
        throw new Error(`ImgBB upload failed: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      // Use display_url for best quality image display in Google Sheets
      const imageUrl = data.data?.display_url || data.data?.url;
      
      if (imageUrl) {
        console.log(`✅ Image uploaded to ImgBB: ${imageUrl}`);
      }
      
      return imageUrl || null;
    } catch (error) {
      console.error('ImgBB upload error:', error);
      return null;
    }
  }

  // ============= HELPER METHODS =============
  private async checkIfSheetHasHeaders(sheetName: string = BACKUP_SHEET_NAME): Promise<boolean> {
    try {
      if (!this.client) return false;
      
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.getSpreadsheetId()}/values/${sheetName}!A1:Z1`,
        {
          headers: {
            'Authorization': `Bearer ${(this.client as any).accessToken}`,
          }
        }
      );

      const data = await response.json();
      return data.values && data.values.length > 0;
    } catch {
      return false;
    }
  }

  // Clear all data from backup sheet (keeps sheet, removes all rows)
  async clearBackupSheet(): Promise<void> {
    console.log('[BackupSync] Clearing backup sheet...');
    
    if (!this.isInitialized || !this.client) {
      await this.initialize();
    }

    if (!this.client) {
      throw new Error('Client not initialized');
    }

    try {
      // Clear the entire sheet by writing empty values to a very large range
      // This is simpler than using batchUpdate and doesn't require sheet ID
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.getSpreadsheetId()}/values/${BACKUP_SHEET_NAME}!A1:ZZ10000:clear`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${(this.client as any).accessToken}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [BackupSync] Failed to clear backup sheet:', errorText);
        throw new Error(`Failed to clear backup sheet: ${response.statusText}`);
      }

      console.log('✅ [BackupSync] Backup sheet cleared successfully');
    } catch (error) {
      console.error('❌ [BackupSync] Error clearing backup sheet:', error);
      throw error;
    }
  }

  // Simplified: Sync all data using simple vertical append (no horizontal layout complexity)
  async syncAllData(): Promise<{ invoices: number; stores: number; merchants: number; agents: number }> {
    console.log('[BackupSync] Starting full data sync...');
    
    const results = {
      invoices: 0,
      stores: 0,
      merchants: 0,
      agents: 0
    };

    try {
      // Initialize if needed
      if (!this.isInitialized || !this.client) {
        await this.initialize();
      }

      if (!this.client) {
        throw new Error('Client not initialized');
      }

      // Clear the backup sheet first for a fresh start
      console.log('[BackupSync] Clearing backup sheet for fresh sync...');
      await this.clearBackupSheet();

      // Import database utilities with error handling for HMR
      let db, storeDb, merchantDb, agentDb;
      try {
        const databaseModule = await import('./database');
        db = databaseModule.db;
        storeDb = databaseModule.storeDb;
        merchantDb = databaseModule.merchantDb;
        agentDb = databaseModule.agentDb;
      } catch (error) {
        console.error('[BackupSync] Failed to import database module:', error);
        throw new Error('Database module not available. Please refresh the page and try again.');
      }

      const allData: string[][] = [];

      // SECTION 1: INVOICES
      console.log('[BackupSync] Preparing invoices...');
      allData.push(['--- INVOICES ---']);
      allData.push([
        'ID', 'Merchant Name', 'Date', 'Total', 'Currency', 'Invoice Number', 'Agent Name',
        'Terms', 'Terms Days', 'Payment Method', 'Street', 'City', 'State', 'Zip Code',
        'Phone', 'Email', 'Website', 'Items (JSON)', 'Subtotal', 'Tax',
        'Created At', 'Updated At', 'Status', 'Processing Time (ms)', 'Image'
      ]);
      
      const invoices = await db.invoices.toArray();
      for (const invoice of invoices) {
        const values = await this.formatInvoiceForBackup(invoice);
        allData.push(values);
        results.invoices++;
      }

      // Blank row separator
      allData.push([]);

      // SECTION 2: STORES
      console.log('[BackupSync] Preparing stores...');
      allData.push(['--- STORES ---']);
      allData.push(['ID', 'Name', 'Address', 'Is Default', 'Created At', 'Updated At']);
      
      const stores = await storeDb.list();
      for (const store of stores) {
        allData.push([
          store.id,
          store.name,
          store.address,
          String(store.isDefault),
          store.createdAt,
          store.updatedAt
        ]);
        results.stores++;
      }

      // Blank row separator
      allData.push([]);

      // SECTION 3: MERCHANTS
      console.log('[BackupSync] Preparing merchants...');
      allData.push(['--- MERCHANTS ---']);
      allData.push(['ID', 'Name', 'Address', 'Created At', 'Updated At']);
      
      const merchants = await merchantDb.list();
      for (const merchant of merchants) {
        allData.push([
          merchant.id,
          merchant.name,
          merchant.address,
          merchant.createdAt,
          merchant.updatedAt
        ]);
        results.merchants++;
      }

      // Blank row separator
      allData.push([]);

      // SECTION 4: AGENTS
      console.log('[BackupSync] Preparing agents...');
      allData.push(['--- AGENTS ---']);
      allData.push(['ID', 'Name', 'Created At', 'Updated At']);
      
      const agents = await agentDb.list();
      for (const agent of agents) {
        allData.push([
          agent.id,
          agent.name,
          agent.createdAt,
          agent.updatedAt
        ]);
        results.agents++;
      }

      // Write all data in one go
      console.log('[BackupSync] Writing all data to sheet...');
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.getSpreadsheetId()}/values/${BACKUP_SHEET_NAME}!A1:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${(this.client as any).accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: allData })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [BackupSync] Failed to write data:', errorText);
        throw new Error(`Failed to write backup data: ${response.statusText}`);
      }

      console.log('✅ [BackupSync] Full sync complete:', results);
      return results;
    } catch (error) {
      console.error('❌ [BackupSync] Full sync failed:', error);
      throw error;
    }
  }
}

export const backupSync = new BackupSync();
