'use client';

import React, { useState, useEffect } from 'react';
import { Invoice, InvoiceItem, DatabaseInvoice } from '@/types/invoice';
import { MdAdd, MdDelete, MdSave, MdClose } from 'react-icons/md';
import { db, merchantDb, agentDb, storeDb } from '@/lib/database';
import StoreAutocomplete from './StoreAutocomplete';
import MerchantAutocomplete from './MerchantAutocomplete';
import AgentAutocomplete from './AgentAutocomplete';
import { useRouter } from 'next/navigation';
import { useUserPreferencesStore } from '@/store/userPreferencesStore';

interface InvoiceFormProps {
  initialData?: Partial<Invoice>;
  imageData?: string;
  isExtracting?: boolean;
  onSave?: (invoice: DatabaseInvoice) => void;
  onCancel?: () => void;
}

export default function InvoiceForm({
  initialData,
  imageData,
  isExtracting = false,
  onSave,
  onCancel
}: InvoiceFormProps) {
  const router = useRouter();
  const { currency: defaultCurrency } = useUserPreferencesStore();
  
  const [formData, setFormData] = useState<Partial<Invoice>>({
    merchantName: '',
    invoiceNumber: '',
    date: new Date().toISOString().split('T')[0],
    total: 0,
    currency: defaultCurrency,
    items: [],
    subtotal: 0,
    tax: 0,
    ...initialData
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load default store on form initialization
  useEffect(() => {
    const loadDefaultStore = async () => {
      try {
        const stores = await storeDb.list();
        const defaultStore = stores.find(store => store.isDefault);
        if (defaultStore && !formData.storeName && !initialData?.storeName) {
          setFormData(prev => ({
            ...prev,
            storeName: defaultStore.name
          }));
        }
      } catch (error) {
        console.error('Failed to load default store:', error);
      }
    };
    
    loadDefaultStore();
  }, [formData.storeName, initialData?.storeName]);

  // Update form when initialData changes (from extraction)
  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        ...initialData,
        // Use extracted currency if available, otherwise use default from settings
        currency: initialData.currency || defaultCurrency,
        items: initialData.items || prev.items || []
      }));
    } else {
      // Reset form when initialData is cleared
      setFormData({
        merchantName: '',
        invoiceNumber: '',
        date: new Date().toISOString().split('T')[0],
        total: 0,
        currency: defaultCurrency,
        items: [],
        subtotal: 0,
        tax: 0,
        terms: '',
        termsDays: undefined,
        agentName: '',
        phoneNumber: '',
        email: '',
        website: '',
        notes: '',
        storeName: ''
      });
    }
  }, [initialData, defaultCurrency]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const updatedItems = [...(formData.items || [])];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value
    };

    // Recalculate item total
    if (field === 'quantity' || field === 'unitPrice') {
      const item = updatedItems[index];
      updatedItems[index].totalPrice = item.quantity * item.unitPrice;
    }

    setFormData(prev => ({ ...prev, items: updatedItems }));
    recalculateTotals(updatedItems);
  };

  const addLineItem = () => {
    const newItem: InvoiceItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: '',
      description: '',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0
    };
    
    setFormData(prev => ({
      ...prev,
      items: [...(prev.items || []), newItem]
    }));
  };

  const removeLineItem = (index: number) => {
    const updatedItems = (formData.items || []).filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, items: updatedItems }));
    recalculateTotals(updatedItems);
  };

  const recalculateTotals = (items: InvoiceItem[]) => {
    const subtotal = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    const tax = formData.tax || 0;
    const total = subtotal + tax;
    
    setFormData(prev => ({
      ...prev,
      subtotal,
      total
    }));
  };

  const handleTaxChange = (tax: number) => {
    const subtotal = formData.subtotal || 0;
    setFormData(prev => ({
      ...prev,
      tax,
      total: subtotal + tax
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.merchantName?.trim()) {
        throw new Error('Merchant name is required');
      }
      if (!formData.date) {
        throw new Error('Date is required');
      }
      if (formData.total === undefined || formData.total < 0) {
        throw new Error('Total amount is required');
      }

      // Auto-create merchant if it doesn't exist
      let merchantId = formData.merchantId;
      if (formData.merchantName?.trim() && !merchantId) {
        // Check if merchant exists
        const existingMerchants = await merchantDb.list();
        const existingMerchant = existingMerchants.find(
          m => m.name.toLowerCase() === formData.merchantName!.toLowerCase()
        );
        
        if (existingMerchant) {
          merchantId = existingMerchant.id;
        } else {
          // Create new merchant
          const newMerchant = await merchantDb.create({ name: formData.merchantName, address: formData.merchantAddress?.street || '' });
          merchantId = newMerchant.id;
          console.log('✅ Created new merchant:', newMerchant.name);
        }
      }

      // Auto-create agent if it doesn't exist
      let agentId = formData.agentId;
      if (formData.agentName?.trim() && !agentId) {
        // Check if agent exists
        const existingAgents = await agentDb.list();
        const existingAgent = existingAgents.find(
          a => a.name.toLowerCase() === formData.agentName!.toLowerCase()
        );
        
        if (existingAgent) {
          agentId = existingAgent.id;
        } else {
          // Create new agent
          const newAgent = await agentDb.create(formData.agentName);
          agentId = newAgent.id;
          console.log('✅ Created new agent:', newAgent.name);
        }
      }

      // Auto-create store if it doesn't exist
      if (formData.storeName?.trim()) {
        // Check if store exists
        const existingStores = await storeDb.list();
        const existingStore = existingStores.find(
          s => s.name.toLowerCase() === formData.storeName!.toLowerCase()
        );
        
        if (!existingStore) {
          // Create new store - first store becomes default
          const newStore = await storeDb.create({ name: formData.storeName, address: '' });
          console.log('✅ Created new store:', newStore.name, newStore.isDefault ? '(Default)' : '');
        }
      }

      // Create invoice object
      const now = new Date().toISOString();
      const invoice: DatabaseInvoice = {
        id: `invoice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        merchantName: formData.merchantName,
        merchantId: merchantId,
        merchantAddress: formData.merchantAddress,
        storeName: formData.storeName,
        invoiceNumber: formData.invoiceNumber || '',
        date: formData.date,
        time: formData.time,
        items: formData.items || [],
        subtotal: formData.subtotal || 0,
        tax: formData.tax || 0,
        total: formData.total,
        currency: formData.currency || defaultCurrency,
        paymentMethod: formData.paymentMethod,
        agentName: formData.agentName,
        agentId: agentId,
        terms: formData.terms,
        termsDays: formData.termsDays,
        phoneNumber: formData.phoneNumber,
        email: formData.email,
        website: formData.website,
        notes: formData.notes,
        imageData: imageData,
        extractedAt: now,
        createdAt: now,
        updatedAt: now,
        status: 'review',
        // AI Metadata - pass through if it exists
        aiModel: formData.aiModel,
        aiResponseTime: formData.aiResponseTime,
        aiExtractedFrom: formData.aiExtractedFrom || (imageData ? 'image' : 'manual')
      };

      // Save to database
      await db.invoices.add(invoice);

      // Call onSave callback
      if (onSave) {
        onSave(invoice);
      } else {
        // Navigate to invoices page
        router.push('/invoices');
      }
    } catch (err) {
      console.error('Error saving invoice:', err);
      setError(err instanceof Error ? err.message : 'Failed to save invoice');
    } finally {
      setIsSaving(false);
    }
  };

  const isDisabled = isExtracting || isSaving;

  return (
    <div className="bg-card border border-border rounded-lg p-6 h-full overflow-y-auto relative">
      {/* Extracting Overlay */}
      {isExtracting && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 rounded-lg flex items-center justify-center">
          <div className="flex flex-col items-center space-y-3">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-lg font-medium">Extracting invoice data...</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Invoice Details</h2>
        <p className="text-sm text-muted-foreground">
          Fill in the invoice details manually or drop an invoice image to auto-extract
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* Form */}
      <div className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg border-b border-border pb-2">Basic Information</h3>
          
          {/* Store */}
          <div>
            <label className="block text-sm font-medium mb-1">Store</label>
            <StoreAutocomplete
              value={formData.storeName || ''}
              onChange={(name) => {
                handleInputChange('storeName', name);
              }}
              disabled={isDisabled}
              className="w-full px-3 py-2 border border-border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Merchant Name */}
          <div>
            <label className="block text-sm font-medium mb-1">Merchant Name *</label>
            <MerchantAutocomplete
              value={formData.merchantName || ''}
              onChange={(name, id) => {
                handleInputChange('merchantName', name);
                handleInputChange('merchantId', id);
              }}
              disabled={isDisabled}
              className="w-full px-3 py-2 border border-border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Invoice Number */}
            <div>
              <label className="block text-sm font-medium mb-1">Invoice Number</label>
              <input
                type="text"
                value={formData.invoiceNumber || ''}
                onChange={(e) => handleInputChange('invoiceNumber', e.target.value)}
                disabled={isDisabled}
                className="w-full px-3 py-2 border border-border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="INV-001"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium mb-1">Date *</label>
              <input
                type="date"
                value={formData.date || ''}
                onChange={(e) => handleInputChange('date', e.target.value)}
                disabled={isDisabled}
                className="w-full px-3 py-2 border border-border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Merchant Address */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">City</label>
              <input
                type="text"
                value={formData.merchantAddress?.city || ''}
                onChange={(e) => handleInputChange('merchantAddress', {
                  ...formData.merchantAddress,
                  city: e.target.value
                })}
                disabled={isDisabled}
                className="w-full px-3 py-2 border border-border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="City"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">State/Province</label>
              <input
                type="text"
                value={formData.merchantAddress?.state || ''}
                onChange={(e) => handleInputChange('merchantAddress', {
                  ...formData.merchantAddress,
                  state: e.target.value
                })}
                disabled={isDisabled}
                className="w-full px-3 py-2 border border-border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="State"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Street Address</label>
            <input
              type="text"
              value={formData.merchantAddress?.street || ''}
              onChange={(e) => handleInputChange('merchantAddress', {
                ...formData.merchantAddress,
                street: e.target.value
              })}
              disabled={isDisabled}
              className="w-full px-3 py-2 border border-border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Street address"
            />
          </div>

          {/* Agent */}
          <div>
            <label className="block text-sm font-medium mb-1">Agent</label>
            <AgentAutocomplete
              value={formData.agentName || ''}
              onChange={(name, id) => {
                handleInputChange('agentName', name);
                handleInputChange('agentId', id);
              }}
              disabled={isDisabled}
              className="w-full px-3 py-2 border border-border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Terms */}
            <div>
              <label className="block text-sm font-medium mb-1">Terms</label>
              <input
                type="text"
                value={formData.terms || ''}
                onChange={(e) => handleInputChange('terms', e.target.value)}
                disabled={isDisabled}
                className="w-full px-3 py-2 border border-border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Net 30"
              />
            </div>

            {/* Currency */}
            <div>
              <label className="block text-sm font-medium mb-1">Currency</label>
              <select
                value={formData.currency || defaultCurrency}
                onChange={(e) => handleInputChange('currency', e.target.value)}
                disabled={isDisabled}
                className="w-full px-3 py-2 border border-border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="PHP">PHP (₱)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h3 className="font-semibold text-lg">Line Items</h3>
            <button
              onClick={addLineItem}
              disabled={isDisabled}
              className="flex items-center space-x-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <MdAdd className="w-4 h-4" />
              <span>Add Item</span>
            </button>
          </div>

          {formData.items && formData.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-center p-2 text-xs font-medium">Qty</th>
                    <th className="text-left p-2 text-xs font-medium">Description</th>
                    <th className="text-right p-2 text-xs font-medium">Unit Price</th>
                    <th className="text-right p-2 text-xs font-medium">Amount</th>
                    <th className="text-center p-2 text-xs font-medium w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items.map((item, index) => (
                    <tr key={item.id} className="border-b border-border">
                      {/* Quantity */}
                      <td className="text-center p-2">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                          disabled={isDisabled}
                          min="0"
                          step="0.01"
                          className="w-16 px-2 py-1 border border-border rounded text-sm text-center disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </td>
                      {/* Name & Description */}
                      <td className="p-2">
                        <div className="space-y-1">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                            disabled={isDisabled}
                            className="w-full px-2 py-1 border border-border rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            placeholder="Item name"
                          />
                          <input
                            type="text"
                            value={item.description || ''}
                            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                            disabled={isDisabled}
                            className="w-full px-2 py-1 border border-border rounded text-xs text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                            placeholder="Description (optional)"
                          />
                        </div>
                      </td>
                      {/* Unit Price */}
                      <td className="text-right p-2">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          disabled={isDisabled}
                          min="0"
                          step="0.01"
                          className="w-24 px-2 py-1 border border-border rounded text-sm text-right disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </td>
                      {/* Total Price */}
                      <td className="text-right p-2">
                        <input
                          type="number"
                          value={item.totalPrice}
                          disabled
                          className="w-24 px-2 py-1 border border-border rounded text-sm text-right bg-muted cursor-not-allowed font-medium"
                        />
                      </td>
                      {/* Delete Button */}
                      <td className="text-center p-2">
                        <button
                          onClick={() => removeLineItem(index)}
                          disabled={isDisabled}
                          className="text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Remove item"
                        >
                          <MdDelete className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
              <p className="text-sm">No line items added yet</p>
              <p className="text-xs mt-1">Click "Add Item" to add your first line item</p>
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg border-b border-border pb-2">Totals</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Subtotal</label>
              <input
                type="number"
                value={formData.subtotal || 0}
                disabled
                className="w-32 px-3 py-2 border border-border rounded-md text-sm bg-muted cursor-not-allowed text-right"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Tax</label>
              <input
                type="number"
                value={formData.tax || 0}
                onChange={(e) => handleTaxChange(parseFloat(e.target.value) || 0)}
                disabled={isDisabled}
                min="0"
                step="0.01"
                className="w-32 px-3 py-2 border border-border rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed text-right"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <label className="text-base font-bold">Total</label>
              <input
                type="number"
                value={formData.total || 0}
                disabled
                className="w-32 px-3 py-2 border-2 border-primary rounded-md text-sm bg-muted cursor-not-allowed text-right font-bold"
              />
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg border-b border-border pb-2">Additional Information</h3>
          
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              disabled={isDisabled}
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Additional notes..."
            />
          </div>

          {/* AI Extraction Info */}
          {formData.aiModel && formData.aiResponseTime && (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">AI Model</label>
                <input
                  type="text"
                  value={formData.aiModel === 'chrome-builtin' ? 'Chrome Built-in AI' : formData.aiModel || 'Gemini API'}
                  disabled
                  className="w-full px-3 py-2 border border-border rounded-md text-sm bg-muted cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Response Time</label>
                <input
                  type="text"
                  value={formData.aiResponseTime < 1000 
                    ? `${formData.aiResponseTime}ms` 
                    : `${(formData.aiResponseTime / 1000).toFixed(2)}s`}
                  disabled
                  className="w-full px-3 py-2 border border-border rounded-md text-sm bg-muted cursor-not-allowed"
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border">
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={isDisabled}
              className="flex items-center space-x-2 px-4 py-2 border border-border rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <MdClose className="w-5 h-5" />
              <span>Cancel</span>
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isDisabled}
            className="flex items-center space-x-2 px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MdSave className="w-5 h-5" />
            <span>{isSaving ? 'Saving...' : 'Save Invoice'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

