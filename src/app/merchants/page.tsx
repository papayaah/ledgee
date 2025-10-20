'use client';

import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { merchantDb, MerchantRecord } from '@/lib/database';
import { MdDelete, MdWarning } from 'react-icons/md';

interface MerchantWithCount extends MerchantRecord {
  invoiceCount: number;
}

export default function MerchantsPage() {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [items, setItems] = useState<MerchantWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const loadMerchants = useCallback(async () => {
    setIsLoading(true);
    try {
      const records = await merchantDb.list();
      
      // Get invoice counts for each merchant
      const merchantsWithCounts = await Promise.all(
        records.map(async (merchant) => {
          const invoiceCount = await merchantDb.getInvoiceCount(merchant.id);
          return { ...merchant, invoiceCount };
        })
      );
      
      setItems(merchantsWithCounts);
    } catch (error) {
      console.error('Failed to load merchants', error);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMerchants();
  }, [loadMerchants]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedAddress = address.trim();
    if (!trimmedName) {
      return;
    }

    setIsSubmitting(true);
    try {
      await merchantDb.create({ name: trimmedName, address: trimmedAddress });
      await loadMerchants();
      setName('');
      setAddress('');
    } catch (error) {
      console.error('Failed to create merchant', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (merchant: MerchantWithCount) => {
    setEditingId(merchant.id);
    setEditName(merchant.name);
    setEditAddress(merchant.address || '');
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    
    const trimmedName = editName.trim();
    if (!trimmedName) {
      alert('Merchant name is required');
      return;
    }

    setIsSavingEdit(true);
    try {
      await merchantDb.update(editingId, { 
        name: trimmedName, 
        address: editAddress.trim() 
      });
      await loadMerchants();
      setEditingId(null);
      setEditName('');
      setEditAddress('');
    } catch (error) {
      console.error('Failed to update merchant', error);
      alert('Failed to update merchant. Please try again.');
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

  const handleDeleteClick = (merchant: MerchantWithCount) => {
    if (deleteConfirmId === merchant.id) {
      // Second click - actually delete
      handleDelete(merchant.id);
    } else {
      // First click - show confirmation
      setDeleteConfirmId(merchant.id);
    }
  };

  const handleDelete = async (merchantId: string) => {
    try {
      await merchantDb.remove(merchantId);
      await loadMerchants();
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Failed to delete merchant', error);
    }
  };

  return (
    <div className="max-w-[1920px] mx-auto px-4 py-8 min-h-full flex flex-col">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground mb-2">Merchants</h1>
        <p className="text-sm text-muted-foreground">
          Maintain merchant names, addresses, and history metadata.
        </p>
      </header>

      <section className="bg-card border border-border rounded-2xl p-6 mb-8 shadow-sm">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <input
              type="text"
              className="rounded-xl bg-background border border-border px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="Merchant name"
              value={name}
              onChange={event => setName(event.target.value)}
              disabled={isSubmitting}
            />
            <input
              type="text"
              className="rounded-xl bg-background border border-border px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="Merchant address"
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
              {isSubmitting ? 'Saving…' : 'Add Merchant'}
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
                  Loading merchants…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  No merchants yet. Add your first merchant to get started.
                </td>
              </tr>
            ) : (
              items.map(merchant => (
                <React.Fragment key={merchant.id}>
                  <tr 
                    className="border-t border-border hover:bg-muted/30 group cursor-pointer transition-colors"
                    onClick={(e) => {
                      // Don't trigger if clicking on delete icon
                      if ((e.target as HTMLElement).closest('button')) {
                        return;
                      }
                      handleEdit(merchant);
                    }}
                  >
                    <td className="px-4 py-3 align-top">{merchant.name}</td>
                    <td className="px-4 py-3 align-top text-muted-foreground">
                      {merchant.address || '—'}
                    </td>
                    <td className="px-4 py-3 align-top text-muted-foreground">
                      {merchant.invoiceCount}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(merchant);
                        }}
                        onMouseLeave={() => {
                          if (deleteConfirmId === merchant.id) {
                            setDeleteConfirmId(null);
                          }
                        }}
                        className={`
                          p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100
                          ${deleteConfirmId === merchant.id 
                            ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' 
                            : 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
                          }
                        `}
                        title={deleteConfirmId === merchant.id ? 'Click again to confirm delete' : 'Delete merchant'}
                      >
                        {deleteConfirmId === merchant.id ? (
                          <MdWarning className="w-5 h-5" />
                        ) : (
                          <MdDelete className="w-5 h-5" />
                        )}
                      </button>
                    </td>
                  </tr>
                  
                  {/* Inline Edit Form */}
                  {editingId === merchant.id && (
                    <tr className="bg-muted/50 border-t border-border">
                      <td colSpan={4} className="px-4 py-4">
                        <div className="bg-card rounded-lg p-4 shadow-sm">
                          <h4 className="text-sm font-semibold mb-3">Edit Merchant</h4>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Merchant name *
                              </label>
                              <input
                                type="text"
                                className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                placeholder="Merchant name"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                disabled={isSavingEdit}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Merchant address
                              </label>
                              <input
                                type="text"
                                className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                placeholder="Merchant address"
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
