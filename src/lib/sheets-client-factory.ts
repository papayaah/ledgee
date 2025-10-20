'use client';

// import { GoogleSheetsClient } from './google-sheets-client'; // Removed - had secrets
import { GoogleSheetsOAuth } from './google-sheets-oauth';
import { getValidTokens, isGoogleConnected } from './google-oauth';
import { db } from './database';
// Removed unused imports and constants related to old shared mode

export interface SheetsClientInterface {
  initialize(): Promise<void>;
  uploadImageToDrive?(imageData: string, fileName: string): Promise<string | null>;
  createSummarySheet(invoices: any[]): Promise<boolean>;
  createByMerchantSheet(invoices: any[]): Promise<boolean>;
  createMonthSheets?(invoices: any[]): Promise<string[]>;
  createReceiptsSheet?(invoices: any[]): Promise<boolean>;
  deleteAllReports?(): Promise<boolean>;
  exportToCSV?(invoices: any[]): void;
  getSpreadsheetUrl?(): string;
}

/**
 * Factory to create the appropriate Google Sheets client
 * Returns personal OAuth client if user is connected, otherwise throws error
 */
export async function createSheetsClient(
  showCurrencySymbol: boolean = false,
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD' = 'MM/DD/YYYY'
): Promise<{ client: SheetsClientInterface; mode: 'connected' | 'needs_setup' }> {
  
  // Check if user is connected
  const connected = await isGoogleConnected();
  
  if (!connected) {
    throw new Error('Google account not connected. Please connect your Google account first.');
  }
  
  // Check if user has a spreadsheet
  const sheetIdSetting = await db.settings.get('ledgee_spreadsheet_id');
  const personalSpreadsheetId = sheetIdSetting?.value as string | undefined;
  
  if (!personalSpreadsheetId) {
    return { client: null as any, mode: 'needs_setup' };
  }
  
  try {
    console.log('📊 Using Google Sheets (OAuth)');
    const tokens = await getValidTokens();
    
    if (!tokens || !tokens.access_token) {
      throw new Error('No valid access token');
    }
    
    const client = new GoogleSheetsOAuth(
      personalSpreadsheetId,
      tokens.access_token,
      showCurrencySymbol,
      dateFormat
    );
    
    await client.initialize();
    return { client, mode: 'connected' };
  } catch (error) {
    console.error('Failed to initialize Google Sheets:', error);
    throw new Error('Failed to initialize Google Sheets. Please try reconnecting your Google account.');
  }
}

/**
 * Check if Google Sheets is ready for use
 */
export async function isGoogleSheetsReady(): Promise<{ ready: boolean; needsConnection: boolean; needsSpreadsheet: boolean }> {
  const connected = await isGoogleConnected();
  const sheetIdSetting = await db.settings.get('ledgee_spreadsheet_id');
  const hasSpreadsheet = !!sheetIdSetting?.value;
  
  return {
    ready: connected && hasSpreadsheet,
    needsConnection: !connected,
    needsSpreadsheet: connected && !hasSpreadsheet
  };
}

