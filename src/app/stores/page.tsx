'use client';

import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { storeDb, StoreRecord } from '@/lib/database';
import { MdDelete, MdWarning } from 'react-icons/md';

interface StoreWithCount extends StoreRecord {
  invoiceCount: number;
}

export default function StoresPage() {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [items, setItems] = useState<StoreWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const loadStores = useCallback(async () => {
    setIsLoading(true);
    try {
      const records = await storeDb.list();
      
      // Get invoice counts for each store
      const storesWithCounts = await Promise.all(
        records.map(async (store) => {
          const invoiceCount = await storeDb.getInvoiceCount(store.name);
          return { ...store, invoiceCount };
        })
      );
      
      setItems(storesWithCounts);
    } catch (error) {
      console.error('Failed to load stores', error);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedAddress = address.trim();
    if (!trimmedName) {
      return;
    }

    setIsSubmitting(true);
    try {
      await storeDb.create({ name: trimmedName, address: trimmedAddress });
      await loadStores();
      setName('');
      setAddress('');
    } catch (error) {
      console.error('Failed to create store', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (store: StoreWithCount) => {
    setEditingId(store.id);
    setEditName(store.name);
    setEditAddress(store.address || '');
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    
    const trimmedName = editName.trim();
    if (!trimmedName) {
      alert('Store name is required');
      return;
    }

    setIsSavingEdit(true);
    try {
      await storeDb.update(editingId, { 
        name: trimmedName, 
        address: editAddress.trim() 
      });
      await loadStores();
      setEditingId(null);
      setEditName('');
      setEditAddress('');
    } catch (error) {
      console.error('Failed to update store', error);
      alert('Failed to update store. Please try again.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditAddress('');
  };

  // Delete confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDeleteClick = (store: StoreWithCount) => {
    if (store.isDefault) {
      alert('Cannot delete the default store. Please set another store as default first.');
      return;
    }
    
    if (deleteConfirmId === store.id) {
      // Second click - actually delete
      handleDelete(store.id);
    } else {
      // First click - show confirmation
      setDeleteConfirmId(store.id);
    }
  };

  const handleDelete = async (storeId: string) => {
    try {
      await storeDb.remove(storeId);
      await loadStores();
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Failed to delete store', error);
    }
  };

  const handleToggleDefault = async (store: StoreWithCount) => {
    if (store.isDefault) {
      return; // Already default, do nothing
    }

    try {
      await storeDb.setDefault(store.id);
      await loadStores();
    } catch (error) {
      console.error('Failed to set default store', error);
    }
  };

  return (
    <div className="max-w-[1920px] mx-auto px-4 py-8 min-h-full flex flex-col">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground mb-2">Stores</h1>
        <p className="text-sm text-muted-foreground">
          Track store details with name, address, and metadata.
        </p>
      </header>

      <section className="bg-card border border-border rounded-2xl p-6 mb-8 shadow-sm">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <input
              type="text"
              className="rounded-xl bg-background border border-border px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="Store name"
              value={name}
              onChange={event => setName(event.target.value)}
              disabled={isSubmitting}
            />
            <input
              type="text"
              className="rounded-xl bg-background border border-border px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="Store address"
              value={address}
              onChange={event => setAddress(event.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold transition hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving…' : 'Add Store'}
            </button>
          </div>
        </form>
      </section>

      <section className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <table className="min-w-full text-left text-sm text-foreground">
          <thead className="bg-muted text-muted-foreground uppercase text-xs tracking-wide">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Address</th>
              <th className="px-4 py-3 font-semibold">Invoices</th>
              <th className="px-4 py-3 font-semibold w-16"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  Loading stores…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  No stores yet. Add your first store to get started.
                </td>
              </tr>
            ) : (
              items.map(store => (
                <React.Fragment key={store.id}>
                  <tr 
                    className="border-t border-border hover:bg-muted/30 group cursor-pointer transition-colors"
                    onClick={(e) => {
                      // Don't trigger if clicking on checkbox or delete icon
                      if ((e.target as HTMLElement).closest('input[type="checkbox"]') || 
                          (e.target as HTMLElement).closest('button')) {
                        return;
                      }
                      handleEdit(store);
                    }}
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={store.isDefault}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleToggleDefault(store);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 cursor-pointer"
                          title={store.isDefault ? 'Default store' : 'Set as default store'}
                        />
                        <span>{store.name}</span>
                        {store.isDefault && (
                          <span className="text-xs text-primary font-semibold">(Default)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-muted-foreground">
                      {store.address || '—'}
                    </td>
                    <td className="px-4 py-3 align-top text-muted-foreground">
                      {store.invoiceCount}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!store.isDefault && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(store);
                          }}
                          onMouseLeave={() => {
                            if (deleteConfirmId === store.id) {
                              setDeleteConfirmId(null);
                            }
                          }}
                          className={`
                            p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100
                            ${deleteConfirmId === store.id 
                              ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' 
                              : 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
                            }
                          `}
                          title={deleteConfirmId === store.id ? 'Click again to confirm delete' : 'Delete store'}
                        >
                          {deleteConfirmId === store.id ? (
                            <MdWarning className="w-5 h-5" />
                          ) : (
                            <MdDelete className="w-5 h-5" />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                  
                  {/* Inline Edit Form */}
                  {editingId === store.id && (
                    <tr className="bg-muted/50 border-t border-border">
                      <td colSpan={4} className="px-4 py-4">
                        <div className="bg-card rounded-lg p-4 shadow-sm">
                          <h4 className="text-sm font-semibold mb-3">Edit Store</h4>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Store name *
                              </label>
                              <input
                                type="text"
                                className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                placeholder="Store name"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                disabled={isSavingEdit}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Store address
                              </label>
                              <input
                                type="text"
                                className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                placeholder="Store address"
                                value={editAddress}
                                onChange={(e) => setEditAddress(e.target.value)}
                                disabled={isSavingEdit}
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 mt-4">
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition text-sm font-medium"
                              disabled={isSavingEdit}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveEdit}
                              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition text-sm font-semibold disabled:opacity-50"
                              disabled={isSavingEdit}
                            >
                              {isSavingEdit ? 'Saving…' : 'Save Changes'}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
