import { Invoice, DatabaseInvoice, InvoiceItem } from '@/types/invoice';

const normalizeNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const parsed = parseFloat(String(value ?? 0));
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeInvoiceNumbers = <T extends {
  total: unknown;
  subtotal?: unknown;
  tax?: unknown;
  items?: InvoiceItem[];
}>(invoice: T): T => {
  const items = (invoice.items || []).map(item => ({
    ...item,
    quantity: normalizeNumber(item.quantity),
    unitPrice: normalizeNumber(item.unitPrice),
    totalPrice: normalizeNumber(item.totalPrice),
  }));

  return {
    ...invoice,
    subtotal: invoice.subtotal !== undefined ? normalizeNumber(invoice.subtotal) : invoice.subtotal,
    tax: invoice.tax !== undefined ? normalizeNumber(invoice.tax) : invoice.tax,
    total: normalizeNumber(invoice.total),
    items,
  } as T;
};

interface StoredData {
  invoices: DatabaseInvoice[];
  lastUpdated: string;
}

class FallbackInvoiceDatabase {
  private storageKey = 'shawai-invoices';
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Check if we can access localStorage
      if (typeof window === 'undefined' || !window.localStorage) {
        throw new Error('localStorage not available');
      }

      // Try to load existing data
      const existing = this.loadData();
      console.log(`Initialized fallback database with ${existing.invoices.length} invoices`);
      
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize fallback database:', error);
      throw new Error('Fallback database initialization failed');
    }
  }

  private loadData(): StoredData {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        return {
          invoices: (parsed.invoices || []).map((invoice: DatabaseInvoice) => normalizeInvoiceNumbers(invoice)),
          lastUpdated: parsed.lastUpdated || new Date().toISOString()
        };
      }
    } catch (error) {
      console.warn('Failed to load stored data, using empty dataset:', error);
    }

    return {
      invoices: [],
      lastUpdated: new Date().toISOString()
    };
  }

  private saveData(data: StoredData): void {
    try {
      data.lastUpdated = new Date().toISOString();
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save data to localStorage:', error);
      throw new Error('Failed to save invoice data');
    }
  }

  async saveInvoice(invoice: Invoice): Promise<void> {
    if (!this.initialized) await this.initialize();

    try {
      const data = this.loadData();
      const now = new Date().toISOString();

      const dbInvoice: DatabaseInvoice = {
        ...normalizeInvoiceNumbers(invoice),
        id: invoice.id || this.generateId(),
        createdAt: now,
        updatedAt: now
      };

      // Remove existing invoice with same ID
      data.invoices = data.invoices.filter(inv => inv.id !== dbInvoice.id);
      
      // Add new/updated invoice
      data.invoices.push(dbInvoice);
      
      this.saveData(data);
      console.log('Saved invoice:', dbInvoice.id);
    } catch (error) {
      console.error('Failed to save invoice:', error);
      throw error;
    }
  }

  async getInvoice(id: string): Promise<DatabaseInvoice | null> {
    if (!this.initialized) await this.initialize();

    const data = this.loadData();
    return data.invoices.find(inv => inv.id === id) || null;
  }

  async getAllInvoices(): Promise<DatabaseInvoice[]> {
    if (!this.initialized) await this.initialize();

    const data = this.loadData();
    // Sort by date descending, then by created date
    return data.invoices.sort((a, b) => {
      const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  async getInvoicesByMerchant(merchantName: string): Promise<DatabaseInvoice[]> {
    if (!this.initialized) await this.initialize();

    const data = this.loadData();
    return data.invoices
      .filter(inv => inv.merchantName.toLowerCase().includes(merchantName.toLowerCase()))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getInvoicesByDateRange(startDate: string, endDate: string): Promise<DatabaseInvoice[]> {
    if (!this.initialized) await this.initialize();

    const data = this.loadData();
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return data.invoices
      .filter(inv => {
        const invoiceDate = new Date(inv.date);
        return invoiceDate >= start && invoiceDate <= end;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async deleteInvoice(id: string): Promise<void> {
    if (!this.initialized) await this.initialize();

    try {
      const data = this.loadData();
      const originalLength = data.invoices.length;
      data.invoices = data.invoices.filter(inv => inv.id !== id);
      
      if (data.invoices.length === originalLength) {
        throw new Error('Invoice not found');
      }

      this.saveData(data);
      console.log('Deleted invoice:', id);
    } catch (error) {
      console.error('Failed to delete invoice:', error);
      throw error;
    }
  }

  async getStats() {
    if (!this.initialized) await this.initialize();

    const data = this.loadData();
    const invoices = data.invoices;

    const totalInvoices = invoices.length;
    const totalAmount = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const averageAmount = totalInvoices > 0 ? totalAmount / totalInvoices : 0;

    // Calculate top merchants
    const merchantTotals = invoices.reduce((acc, inv) => {
      const name = inv.merchantName || 'Unknown';
      if (!acc[name]) {
        acc[name] = { name, count: 0, totalAmount: 0 };
      }
      acc[name].count += 1;
      acc[name].totalAmount += inv.total || 0;
      return acc;
    }, {} as Record<string, { name: string; count: number; totalAmount: number }>);

    const topMerchants = Object.values(merchantTotals)
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5);

    return {
      totalInvoices,
      totalAmount,
      averageAmount,
      topMerchants
    };
  }

  async clearAllData(): Promise<void> {
    if (!this.initialized) await this.initialize();

    try {
      localStorage.removeItem(this.storageKey);
      console.log('Cleared all invoice data');
    } catch (error) {
      console.error('Failed to clear data:', error);
      throw error;
    }
  }

  private generateId(): string {
    return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  close(): void {
    // Nothing to close for localStorage implementation
    this.initialized = false;
  }

  // Export/Import functionality
  async exportData(): Promise<string> {
    if (!this.initialized) await this.initialize();

    const data = this.loadData();
    return JSON.stringify(data, null, 2);
  }

  async importData(jsonData: string): Promise<void> {
    if (!this.initialized) await this.initialize();

    try {
      const importedData = JSON.parse(jsonData);
      
      // Validate the structure
      if (!importedData.invoices || !Array.isArray(importedData.invoices)) {
        throw new Error('Invalid import data structure');
      }

      // Validate each invoice has required fields
      for (const invoice of importedData.invoices) {
        if (!invoice.id || !invoice.merchantName || invoice.total === undefined) {
          throw new Error('Invalid invoice data in import');
        }
      }

      this.saveData(importedData);
      console.log(`Imported ${importedData.invoices.length} invoices`);
    } catch (error) {
      console.error('Failed to import data:', error);
      throw new Error('Import failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  // Get storage usage info
  getStorageInfo(): { used: number; available: number; percentage: number } {
    try {
      const used = new Blob([localStorage.getItem(this.storageKey) || '']).size;
      const total = 5 * 1024 * 1024; // Assume 5MB localStorage limit
      const available = total - used;
      const percentage = (used / total) * 100;

      return { used, available, percentage };
    } catch (error) {
      return { used: 0, available: 0, percentage: 0 };
    }
  }
}

export const fallbackDb = new FallbackInvoiceDatabase();
