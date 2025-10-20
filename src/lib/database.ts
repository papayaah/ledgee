"use client";

import Dexie, { Table } from 'dexie';
import { Invoice, DatabaseInvoice } from '@/types/invoice';

export interface StoreRecord {
  id: string;
  name: string;
  address: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MerchantRecord {
  id: string;
  name: string;
  address: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface SettingsRecord {
  key: string;
  value: any;
}

export type QueueItemStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface QueueItem {
  id: string;
  fileName: string;
  fileType: string;
  imageData: string; // Base64 encoded image
  status: QueueItemStatus;
  error?: string;
  invoiceId?: string;
  extractedData?: any; // Store extracted invoice data
  addedAt: number;
  startedAt?: number;
  completedAt?: number;
}

// Define the database schema
export class InvoiceDatabase extends Dexie {
  invoices!: Table<DatabaseInvoice, string>;
  queue!: Table<QueueItem, string>;
  stores!: Table<StoreRecord, string>;
  merchants!: Table<MerchantRecord, string>;
  agents!: Table<AgentRecord, string>;
  settings!: Table<SettingsRecord, string>;

  constructor() {
    super('LedgeeDatabase');
    
    // Define schema version 1
    this.version(1).stores({
      invoices: 'id, merchantName, date, total, invoiceNumber, createdAt, updatedAt'
    });
    
    // Define schema version 2 - add status field
    this.version(2).stores({
      invoices: 'id, merchantName, date, total, invoiceNumber, createdAt, updatedAt, status'
    });
    
    // Define schema version 3 - add queue table
    this.version(3).stores({
      invoices: 'id, merchantName, date, total, invoiceNumber, createdAt, updatedAt, status',
      queue: 'id, status, addedAt'
    });

    // Define schema version 4 - add stores & agents tables
    this.version(4).stores({
      invoices: 'id, merchantName, date, total, invoiceNumber, createdAt, updatedAt, status',
      queue: 'id, status, addedAt',
      stores: 'id, name, createdAt, updatedAt',
      agents: 'id, name, createdAt, updatedAt'
    });

    // Define schema version 5 - add address fields & merchants table
    this.version(5).stores({
      invoices: 'id, merchantName, date, total, invoiceNumber, createdAt, updatedAt, status',
      queue: 'id, status, addedAt',
      stores: 'id, name, createdAt, updatedAt, address',
      merchants: 'id, name, createdAt, updatedAt, address',
      agents: 'id, name, createdAt, updatedAt'
    }).upgrade(async tx => {
      await tx.table('stores').toCollection().modify(store => {
        if (typeof store.address !== 'string') {
          store.address = '';
        }
      });
    });

    // Define schema version 6 - add isDefault to stores, merchantId and storeName to invoices
    this.version(6).stores({
      invoices: 'id, merchantName, merchantId, storeName, date, total, invoiceNumber, createdAt, updatedAt, status',
      queue: 'id, status, addedAt',
      stores: 'id, name, isDefault, createdAt, updatedAt, address',
      merchants: 'id, name, createdAt, updatedAt, address',
      agents: 'id, name, createdAt, updatedAt'
    }).upgrade(async tx => {
      // Set first store as default if none exists
      const stores = await tx.table('stores').toArray();
      if (stores.length > 0) {
        const firstStore = stores[0];
        await tx.table('stores').update(firstStore.id, { isDefault: true });
        // Set all other stores to not default
        for (let i = 1; i < stores.length; i++) {
          await tx.table('stores').update(stores[i].id, { isDefault: false });
        }
      }
    });

    // Define schema version 7 - add agentId to invoices
    this.version(7).stores({
      invoices: 'id, merchantName, merchantId, storeName, agentId, date, total, invoiceNumber, createdAt, updatedAt, status',
      queue: 'id, status, addedAt',
      stores: 'id, name, isDefault, createdAt, updatedAt, address',
      merchants: 'id, name, createdAt, updatedAt, address',
      agents: 'id, name, createdAt, updatedAt'
    });

    // Define schema version 8 - add settings table for OAuth tokens and other app settings
    this.version(8).stores({
      invoices: 'id, merchantName, merchantId, storeName, agentId, date, total, invoiceNumber, createdAt, updatedAt, status',
      queue: 'id, status, addedAt',
      stores: 'id, name, isDefault, createdAt, updatedAt, address',
      merchants: 'id, name, createdAt, updatedAt, address',
      agents: 'id, name, createdAt, updatedAt',
      settings: 'key'
    });
  }
}

// Create database instance
export const db = new InvoiceDatabase();

// Helper functions for invoice operations
export const invoiceDb = {
  isInitialized: false,
  
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    await db.open();
    this.isInitialized = true;
    console.log('IndexedDB initialized with Dexie');
  },

  async saveInvoice(invoice: Invoice): Promise<void> {
    const now = new Date().toISOString();
    
    const dbInvoice: DatabaseInvoice = {
      ...invoice,
      id: invoice.id || this.generateId(),
      createdAt: now,
      updatedAt: now
    };

    await db.invoices.put(dbInvoice);
    console.log('Saved invoice to IndexedDB:', dbInvoice.id);
  },

  async updateInvoice(id: string, updates: Partial<DatabaseInvoice>): Promise<void> {
    const existing = await db.invoices.get(id);
    if (!existing) {
      throw new Error(`Invoice with id ${id} not found`);
    }

    const updatedInvoice: DatabaseInvoice = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: new Date().toISOString()
    };

    await db.invoices.put(updatedInvoice);
    console.log('Updated invoice in IndexedDB:', id);
  },

  async getInvoice(id: string): Promise<DatabaseInvoice | null> {
    const invoice = await db.invoices.get(id);
    return invoice || null;
  },

  async getAllInvoices(): Promise<DatabaseInvoice[]> {
    const invoices = await db.invoices.toArray();
    // Sort by date descending, then by created date
    return invoices.sort((a, b) => {
      const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  },

  async getInvoicesByMerchant(merchantName: string): Promise<DatabaseInvoice[]> {
    const invoices = await db.invoices
      .filter(inv => inv.merchantName.toLowerCase().includes(merchantName.toLowerCase()))
      .toArray();
    
    return invoices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async getInvoicesByDateRange(startDate: string, endDate: string): Promise<DatabaseInvoice[]> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const invoices = await db.invoices
      .filter(inv => {
        const invoiceDate = new Date(inv.date);
        return invoiceDate >= start && invoiceDate <= end;
      })
      .toArray();
    
    return invoices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async deleteInvoice(id: string): Promise<void> {
    await db.invoices.delete(id);
    console.log('Deleted invoice from IndexedDB:', id);
  },

  async getStats() {
    const invoices = await db.invoices.toArray();

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
  },

  async clearAllData(): Promise<void> {
    await db.invoices.clear();
    console.log('Cleared all invoice data from IndexedDB');
  },

  async clearAllInvoices(): Promise<void> {
    await db.invoices.clear();
  },

  close(): void {
    db.close();
  },

  generateId(): string {
    return generateRecordId('inv');
  },

  // Export/Import functionality
  async exportData(): Promise<string> {
    const invoices = await db.invoices.toArray();
    return JSON.stringify({ invoices, lastUpdated: new Date().toISOString() }, null, 2);
  },

  async importData(jsonData: string): Promise<void> {
    try {
      const importedData = JSON.parse(jsonData);
      
      if (!importedData.invoices || !Array.isArray(importedData.invoices)) {
        throw new Error('Invalid import data structure');
      }

      await db.invoices.bulkPut(importedData.invoices);
      console.log(`Imported ${importedData.invoices.length} invoices to IndexedDB`);
    } catch (error) {
      console.error('Failed to import data:', error);
      throw new Error('Import failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  },

  // Get storage usage info
  async getStorageInfo(): Promise<{ used: number; available: number; percentage: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const available = quota - used;
      const percentage = quota > 0 ? (used / quota) * 100 : 0;
      
      return { used, available, percentage };
    }
    return { used: 0, available: 0, percentage: 0 };
  }
};

const ensureDatabaseInitialized = async () => {
  await invoiceDb.initialize();
};

const createAddressEntityUtilities = <T extends StoreRecord | MerchantRecord>(
  table: Table<T, string>,
  prefix: string
) => ({
  async list(): Promise<T[]> {
    await ensureDatabaseInitialized();
    const records = await table.toArray();
    return records.sort((a, b) => a.name.localeCompare(b.name));
  },

  async create(data: { name: string; address: string }): Promise<T> {
    const name = data.name.trim();
    const address = data.address.trim();
    if (!name) {
      throw new Error('Name is required');
    }

    const now = new Date().toISOString();
    const record = {
      id: generateRecordId(prefix),
      name,
      address,
      createdAt: now,
      updatedAt: now
    } as T;

    await ensureDatabaseInitialized();
    await table.put(record);
    return record;
  },

  async update(id: string, updates: Partial<Pick<T, 'name' | 'address'>>): Promise<void> {
    await ensureDatabaseInitialized();
    const existing = await table.get(id);
    if (!existing) {
      throw new Error(`${prefix} record with id ${id} not found`);
    }

    const updatedName = updates.name?.trim();
    const updatedAddress = updates.address?.trim();
    const next = {
      ...existing,
      ...(typeof updatedName === 'string' ? { name: updatedName } : {}),
      ...(typeof updatedAddress === 'string' ? { address: updatedAddress } : {}),
      id,
      updatedAt: new Date().toISOString()
    } as T;

    await table.put(next);
  },

  async remove(id: string): Promise<void> {
    await ensureDatabaseInitialized();
    await table.delete(id);
  },

  async findByName(name: string): Promise<T | undefined> {
    await ensureDatabaseInitialized();
    const normalizedSearch = name.trim().toLowerCase();
    const records = await table.toArray();
    return records.find(r => r.name.toLowerCase() === normalizedSearch);
  }
});

const createNameEntityUtilities = <T extends AgentRecord>(
  table: Table<T, string>,
  prefix: string
) => ({
  async list(): Promise<T[]> {
    await ensureDatabaseInitialized();
    const records = await table.toArray();
    return records.sort((a, b) => a.name.localeCompare(b.name));
  },

  async create(name: string): Promise<T> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Name is required');
    }

    const now = new Date().toISOString();
    const record = {
      id: generateRecordId(prefix),
      name: trimmed,
      createdAt: now,
      updatedAt: now
    } as T;

    await ensureDatabaseInitialized();
    await table.put(record);
    return record;
  },

  async update(id: string, updates: Partial<Pick<T, 'name'>>): Promise<void> {
    await ensureDatabaseInitialized();
    const existing = await table.get(id);
    if (!existing) {
      throw new Error(`${prefix} record with id ${id} not found`);
    }

    const updatedName = updates.name?.trim();
    const next = {
      ...existing,
      ...(updatedName ? { name: updatedName } : {}),
      id,
      updatedAt: new Date().toISOString()
    } as T;

    await table.put(next);
  },

  async remove(id: string): Promise<void> {
    await ensureDatabaseInitialized();
    await table.delete(id);
  }
});

// Store utilities with default store management
const baseStoreUtils = createAddressEntityUtilities<StoreRecord>(db.stores, 'store');

export const storeDb = {
  ...baseStoreUtils,
  
  async create(data: { name: string; address: string }): Promise<StoreRecord> {
    await ensureDatabaseInitialized();
    
    // Check if this is the first store
    const existingStores = await db.stores.toArray();
    const isFirstStore = existingStores.length === 0;
    
    const name = data.name.trim();
    const address = data.address.trim();
    if (!name) {
      throw new Error('Name is required');
    }

    const now = new Date().toISOString();
    const record: StoreRecord = {
      id: generateRecordId('store'),
      name,
      address,
      isDefault: isFirstStore, // First store is always default
      createdAt: now,
      updatedAt: now
    };

    await db.stores.put(record);
    
    // AUTO-BACKUP DISABLED - Commenting out for now
    // Auto-sync to backup
    // if (typeof window !== 'undefined') {
    //   const { backupSync } = await import('./backup-sync');
    //   backupSync.syncStore(record).catch(err => 
    //     console.error('Store backup failed (non-blocking):', err)
    //   );
    // }
    
    return record;
  },

  async setDefault(id: string): Promise<void> {
    await ensureDatabaseInitialized();
    
    const store = await db.stores.get(id);
    if (!store) {
      throw new Error('Store not found');
    }

    // Set all stores to not default
    const allStores = await db.stores.toArray();
    for (const s of allStores) {
      await db.stores.update(s.id, { isDefault: false });
    }

    // Set the selected store as default
    await db.stores.update(id, { isDefault: true });
  },

  async getDefault(): Promise<StoreRecord | null> {
    await ensureDatabaseInitialized();
    const stores = await db.stores.toArray();
    const defaultStore = stores.find(s => s.isDefault);
    return defaultStore || null;
  },

  async getInvoiceCount(storeName: string): Promise<number> {
    await ensureDatabaseInitialized();
    const invoices = await db.invoices
      .filter(inv => inv.storeName === storeName)
      .toArray();
    return invoices.length;
  },

  async update(id: string, updates: Partial<Pick<StoreRecord, 'name' | 'address' | 'isDefault'>>): Promise<void> {
    await ensureDatabaseInitialized();
    const existing = await db.stores.get(id);
    if (!existing) {
      throw new Error('Store record not found');
    }

    // If setting this store as default, unset all others
    if (updates.isDefault === true) {
      const allStores = await db.stores.toArray();
      for (const s of allStores) {
        if (s.id !== id) {
          await db.stores.update(s.id, { isDefault: false });
        }
      }
    }

    const updatedName = updates.name?.trim();
    const updatedAddress = updates.address?.trim();
    const next: StoreRecord = {
      ...existing,
      ...(typeof updatedName === 'string' ? { name: updatedName } : {}),
      ...(typeof updatedAddress === 'string' ? { address: updatedAddress } : {}),
      ...(typeof updates.isDefault === 'boolean' ? { isDefault: updates.isDefault } : {}),
      id,
      updatedAt: new Date().toISOString()
    };

    await db.stores.put(next);
    
    // AUTO-BACKUP DISABLED - Commenting out for now
    // Auto-sync to backup
    // if (typeof window !== 'undefined') {
    //   const { backupSync } = await import('./backup-sync');
    //   backupSync.syncStore(next).catch(err => 
    //     console.error('Store backup failed (non-blocking):', err)
    //   );
    // }
  }
};

export const merchantDb = {
  ...createAddressEntityUtilities<MerchantRecord>(db.merchants, 'merchant'),
  
  async create(data: { name: string; address: string }): Promise<MerchantRecord> {
    await ensureDatabaseInitialized();
    const name = data.name.trim();
    const address = data.address.trim();
    if (!name) {
      throw new Error('Name is required');
    }

    const now = new Date().toISOString();
    const record: MerchantRecord = {
      id: generateRecordId('merchant'),
      name,
      address,
      createdAt: now,
      updatedAt: now
    };

    await db.merchants.put(record);
    
    // AUTO-BACKUP DISABLED - Commenting out for now
    // Auto-sync to backup
    // if (typeof window !== 'undefined') {
    //   const { backupSync } = await import('./backup-sync');
    //   backupSync.syncMerchant(record).catch(err => 
    //     console.error('Merchant backup failed (non-blocking):', err)
    //   );
    // }
    
    return record;
  },

  async update(id: string, updates: Partial<Pick<MerchantRecord, 'name' | 'address'>>): Promise<void> {
    await ensureDatabaseInitialized();
    const existing = await db.merchants.get(id);
    if (!existing) {
      throw new Error('Merchant record not found');
    }

    const updatedName = updates.name?.trim();
    const updatedAddress = updates.address?.trim();
    const next: MerchantRecord = {
      ...existing,
      ...(typeof updatedName === 'string' ? { name: updatedName } : {}),
      ...(typeof updatedAddress === 'string' ? { address: updatedAddress } : {}),
      id,
      updatedAt: new Date().toISOString()
    };

    await db.merchants.put(next);
    
    // AUTO-BACKUP DISABLED - Commenting out for now
    // Auto-sync to backup
    // if (typeof window !== 'undefined') {
    //   const { backupSync } = await import('./backup-sync');
    //   backupSync.syncMerchant(next).catch(err => 
    //     console.error('Merchant backup failed (non-blocking):', err)
    //   );
    // }
  },
  
  async findOrCreate(name: string, address?: string): Promise<MerchantRecord> {
    await ensureDatabaseInitialized();
    
    // Try to find existing merchant by name
    const existing = await this.findByName(name);
    if (existing) {
      return existing;
    }

    // Create new merchant
    return await this.create({
      name: name.trim(),
      address: address?.trim() || ''
    });
  },

  async getInvoiceCount(merchantId: string): Promise<number> {
    await ensureDatabaseInitialized();
    const invoices = await db.invoices
      .filter(inv => inv.merchantId === merchantId)
      .toArray();
    return invoices.length;
  }
};

export const agentDb = {
  ...createNameEntityUtilities<AgentRecord>(db.agents, 'agent'),
  
  async create(name: string): Promise<AgentRecord> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Name is required');
    }

    const now = new Date().toISOString();
    const record: AgentRecord = {
      id: generateRecordId('agent'),
      name: trimmed,
      createdAt: now,
      updatedAt: now
    };

    await ensureDatabaseInitialized();
    await db.agents.put(record);
    
    // AUTO-BACKUP DISABLED - Commenting out for now
    // Auto-sync to backup
    // if (typeof window !== 'undefined') {
    //   const { backupSync } = await import('./backup-sync');
    //   backupSync.syncAgent(record).catch(err => 
    //     console.error('Agent backup failed (non-blocking):', err)
    //   );
    // }
    
    return record;
  },

  async update(id: string, updates: Partial<Pick<AgentRecord, 'name'>>): Promise<void> {
    await ensureDatabaseInitialized();
    const existing = await db.agents.get(id);
    if (!existing) {
      throw new Error('Agent record not found');
    }

    const updatedName = updates.name?.trim();
    const next: AgentRecord = {
      ...existing,
      ...(updatedName ? { name: updatedName } : {}),
      id,
      updatedAt: new Date().toISOString()
    };

    await db.agents.put(next);
    
    // AUTO-BACKUP DISABLED - Commenting out for now
    // Auto-sync to backup
    // if (typeof window !== 'undefined') {
    //   const { backupSync } = await import('./backup-sync');
    //   backupSync.syncAgent(next).catch(err => 
    //     console.error('Agent backup failed (non-blocking):', err)
    //   );
    // }
  },
  
  async findOrCreate(name: string): Promise<AgentRecord> {
    await ensureDatabaseInitialized();
    
    // Try to find existing agent by name (case-insensitive)
    const normalizedSearch = name.trim().toLowerCase();
    const agents = await db.agents.toArray();
    const existing = agents.find(a => a.name.toLowerCase() === normalizedSearch);
    
    if (existing) {
      return existing;
    }

    // Create new agent
    return await this.create(name);
  },

  async getInvoiceCount(agentId: string): Promise<number> {
    await ensureDatabaseInitialized();
    const invoices = await db.invoices
      .filter(inv => inv.agentId === agentId)
      .toArray();
    return invoices.length;
  }
};

// Queue operations
export const queueDb = {
  async addToQueue(item: QueueItem): Promise<void> {
    await db.queue.put(item);
  },

  async addMultipleToQueue(items: QueueItem[]): Promise<void> {
    await db.queue.bulkPut(items);
  },

  async getQueue(): Promise<QueueItem[]> {
    const items = await db.queue.toArray();
    return items.sort((a, b) => a.addedAt - b.addedAt);
  },

  async getQueueItem(id: string): Promise<QueueItem | undefined> {
    return await db.queue.get(id);
  },

  async updateQueueItem(id: string, updates: Partial<QueueItem>): Promise<void> {
    const item = await db.queue.get(id);
    if (item) {
      await db.queue.put({ ...item, ...updates });
    }
  },

  async removeFromQueue(id: string): Promise<void> {
    await db.queue.delete(id);
  },

  async clearQueue(): Promise<void> {
    await db.queue.clear();
  },

  async clearCompleted(): Promise<void> {
    const items = await db.queue.toArray();
    const idsToDelete = items
      .filter(item => item.status === 'completed' || item.status === 'failed')
      .map(item => item.id);
    await db.queue.bulkDelete(idsToDelete);
  }
};

function generateRecordId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
