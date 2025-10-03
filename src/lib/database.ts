"use client";

import { Invoice, DatabaseInvoice } from '@/types/invoice';
import { fallbackDb } from './database-fallback';

class InvoiceDatabase {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await fallbackDb.initialize();
    this.initialized = true;
  }

  async saveInvoice(invoice: Invoice): Promise<void> {
    if (!this.initialized) await this.initialize();
    await fallbackDb.saveInvoice(invoice);
  }

  async getInvoice(id: string): Promise<DatabaseInvoice | null> {
    if (!this.initialized) await this.initialize();
    return fallbackDb.getInvoice(id);
  }

  async getAllInvoices(): Promise<DatabaseInvoice[]> {
    if (!this.initialized) await this.initialize();
    return fallbackDb.getAllInvoices();
  }

  async getInvoicesByMerchant(merchantName: string): Promise<DatabaseInvoice[]> {
    if (!this.initialized) await this.initialize();
    return fallbackDb.getInvoicesByMerchant(merchantName);
  }

  async getInvoicesByDateRange(startDate: string, endDate: string): Promise<DatabaseInvoice[]> {
    if (!this.initialized) await this.initialize();
    return fallbackDb.getInvoicesByDateRange(startDate, endDate);
  }

  async deleteInvoice(id: string): Promise<void> {
    if (!this.initialized) await this.initialize();
    await fallbackDb.deleteInvoice(id);
  }

  async getStats() {
    if (!this.initialized) await this.initialize();
    return fallbackDb.getStats();
  }

  async clearAllData(): Promise<void> {
    if (!this.initialized) await this.initialize();
    await fallbackDb.clearAllData();
  }

  async clearAllInvoices(): Promise<void> {
    if (!this.initialized) await this.initialize();
    await fallbackDb.clearAllData();
  }

  close(): void {
    fallbackDb.close();
    this.initialized = false;
  }
}

export const invoiceDb = new InvoiceDatabase();
