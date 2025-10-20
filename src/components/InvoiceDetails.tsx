'use client';

import React, { useState } from 'react';
import { DatabaseInvoice } from '@/types/invoice';
import { formatCurrencyWithLocale } from '@/lib/currency-utils';
import { useUserPreferencesStore, InvoiceLayout } from '@/store/userPreferencesStore';
import { invoiceDb, merchantDb, agentDb } from '@/lib/database';
import MerchantAutocomplete from './MerchantAutocomplete';
import AgentAutocomplete from './AgentAutocomplete';
import StoreDropdown from './StoreDropdown';
import { 
  MdViewAgenda, 
  MdViewDay, 
  MdViewColumn, 
  MdViewWeek,
  MdRateReview,
  MdCheckCircle,
  MdDelete,
  MdWarning,
  MdEdit,
  MdSave,
  MdClose,
  MdImage,
  MdSmartToy,
  MdSpeed
} from 'react-icons/md';
import Zoom from 'react-medium-image-zoom';
import 'react-medium-image-zoom/dist/styles.css';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

interface InvoiceDetailsProps {
  invoice: DatabaseInvoice;
  onStatusChange: (newStatus: 'review' | 'approved') => void;
  onDelete: () => void;
  onUpdate?: (updatedInvoice: DatabaseInvoice) => void;
}

function InvoiceDetailsComponent({ 
  invoice, 
  onStatusChange,
  onDelete,
  onUpdate
}: InvoiceDetailsProps) {
  const { invoiceLayout, setInvoiceLayout } = useUserPreferencesStore();
  
  // Editable fields state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({
    merchantName: invoice.merchantName,
    invoiceNumber: invoice.invoiceNumber || '',
    date: invoice.date,
    total: invoice.total,
    agentName: invoice.agentName || '',
    terms: invoice.terms || '',
    merchantAddress: invoice.merchantAddress,
    storeName: invoice.storeName || ''
  });
  
  // Line items editing state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemValues, setEditingItemValues] = useState<any>(null);
  const [editingItemFocus, setEditingItemFocus] = useState<'quantity' | 'name' | 'unitPrice' | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const qtyRef = React.useRef<HTMLInputElement>(null);
  const nameRef = React.useRef<HTMLInputElement>(null);
  const priceRef = React.useRef<HTMLInputElement>(null);
  
  // Don't sync while actively editing to prevent re-renders
  React.useEffect(() => {
    if (!editingField && !editingItemId) {
      setEditValues({
        merchantName: invoice.merchantName,
        invoiceNumber: invoice.invoiceNumber || '',
        date: invoice.date,
        total: invoice.total,
        agentName: invoice.agentName || '',
        terms: invoice.terms || '',
        merchantAddress: invoice.merchantAddress,
        storeName: invoice.storeName || ''
      });
    }
  }, [invoice.id]); // Only depend on ID, not the whole invoice object

  // Save edited field
  const handleSaveField = async (fieldName: string) => {
    try {
      let merchantId = invoice.merchantId;
      let agentId = invoice.agentId;
      
      // If editing merchant name, find or create merchant
      if (fieldName === 'merchantName' && editValues.merchantName) {
        try {
          const merchantAddress = editValues.merchantAddress 
            ? [
                editValues.merchantAddress.street,
                editValues.merchantAddress.city,
                editValues.merchantAddress.state,
                editValues.merchantAddress.zipCode,
                editValues.merchantAddress.country
              ].filter(Boolean).join(', ')
            : '';
          
          const merchant = await merchantDb.findOrCreate(
            editValues.merchantName,
            merchantAddress
          );
          merchantId = merchant.id;
        } catch (error) {
          console.error('Failed to associate merchant:', error);
        }
      }

      // If editing agent name, find or create agent
      if (fieldName === 'agentName' && editValues.agentName.trim()) {
        try {
          const agent = await agentDb.findOrCreate(editValues.agentName.trim());
          agentId = agent.id;
        } catch (error) {
          console.error('Failed to associate agent:', error);
        }
      }
      
      // Create updated invoice with all changes
      const updatedInvoice: DatabaseInvoice = {
        ...invoice,
        merchantName: editValues.merchantName,
        merchantId,
        agentName: editValues.agentName,
        agentId,
        invoiceNumber: editValues.invoiceNumber,
        date: editValues.date,
        total: editValues.total,
        terms: editValues.terms,
        merchantAddress: editValues.merchantAddress,
        storeName: editValues.storeName,
        updatedAt: new Date().toISOString()
      };
      
      // Use saveInvoice instead of updateInvoice (put operation)
      await invoiceDb.saveInvoice(updatedInvoice);
      
      setEditingField(null);
      
      if (onUpdate) {
        onUpdate(updatedInvoice);
      }
    } catch (error) {
      console.error('Failed to update invoice:', error);
      alert(`Failed to save changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent, fieldName: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveField(fieldName);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditValues({
      merchantName: invoice.merchantName,
      invoiceNumber: invoice.invoiceNumber || '',
      date: invoice.date,
      total: invoice.total,
      agentName: invoice.agentName || '',
      terms: invoice.terms || '',
      merchantAddress: invoice.merchantAddress,
      storeName: invoice.storeName || ''
    });
    setEditingField(null);
  };

  // Save edited line item
  const handleSaveItem = async (itemId: string) => {
    try {
      // Update the items array
      const updatedItems = invoice.items.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            ...editingItemValues,
            totalPrice: editingItemValues.quantity * editingItemValues.unitPrice
          };
        }
        return item;
      });
      
      // Calculate new total
      const newTotal = updatedItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
      
      // Update invoice
      const updatedInvoice: DatabaseInvoice = {
        ...invoice,
        items: updatedItems,
        total: newTotal,
        updatedAt: new Date().toISOString()
      };
      
      await invoiceDb.saveInvoice(updatedInvoice);
      
      setEditingItemId(null);
      setEditingItemValues(null);
      
      if (onUpdate) {
        onUpdate(updatedInvoice);
      }
    } catch (error) {
      console.error('Failed to save item:', error);
      alert(`Failed to save item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Cancel item editing
  const handleCancelItemEdit = () => {
    setEditingItemId(null);
    setEditingItemValues(null);
  };

  // Start editing an item with a specific focus field
  const handleEditItem = React.useCallback((item: any, focusField: 'quantity' | 'name' | 'unitPrice') => {
    setEditingItemId(item.id);
    setEditingItemValues({
      name: item.name,
      description: item.description || '',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice
    });
    setEditingItemFocus(focusField);
  }, []);

  // Focus the correct input when entering edit mode or when focus field changes
  React.useEffect(() => {
    if (!editingItemId || !editingItemFocus) return;
    const focus = () => {
      if (editingItemFocus === 'quantity') qtyRef.current?.focus();
      if (editingItemFocus === 'name') nameRef.current?.focus();
      if (editingItemFocus === 'unitPrice') priceRef.current?.focus();
    };
    // Next tick to ensure input is mounted
    const t = setTimeout(focus, 0);
    return () => clearTimeout(t);
  }, [editingItemId, editingItemFocus]);

  // Keep focus on the active input across state updates (typing)
  React.useEffect(() => {
    if (!editingItemId || !editingItemFocus) return;
    
    // Check if any of our inputs currently has focus
    const hasFocus = qtyRef.current === document.activeElement 
                  || nameRef.current === document.activeElement 
                  || priceRef.current === document.activeElement;
    
    // Only restore focus if none of our inputs have it
    if (!hasFocus) {
      const el = editingItemFocus === 'quantity' ? qtyRef.current
                : editingItemFocus === 'name' ? nameRef.current
                : priceRef.current;
      if (el) {
        el.focus({ preventScroll: true } as any);
        // Place caret at end
        const val = (el as HTMLInputElement).value;
        try {
          (el as HTMLInputElement).setSelectionRange(val.length, val.length);
        } catch {}
      }
    }
  }, [editingItemId, editingItemFocus, editingItemValues]);


  // Handle item field change with auto-calculation
  const handleItemFieldChange = React.useCallback((field: string, value: any) => {
    setEditingItemValues((prev: any) => {
      if (!prev) return prev;
      
      const newValues = { ...prev, [field]: value };
      
      // Auto-calculate totalPrice when quantity or unitPrice changes
      if (field === 'quantity' || field === 'unitPrice') {
        const quantity = field === 'quantity' ? parseFloat(value) || 0 : prev.quantity;
        const unitPrice = field === 'unitPrice' ? parseFloat(value) || 0 : prev.unitPrice;
        newValues.totalPrice = quantity * unitPrice;
      }
      
      return newValues;
    });
  }, []);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const cycleLayout = () => {
    const layouts: InvoiceLayout[] = ['left-right', 'right-left', 'top-bottom', 'bottom-top'];
    const currentIndex = layouts.indexOf(invoiceLayout);
    const nextIndex = (currentIndex + 1) % layouts.length;
    setInvoiceLayout(layouts[nextIndex]);
  };

  const getLayoutIcon = () => {
    switch (invoiceLayout) {
      case 'left-right':
        return <MdViewColumn className="w-5 h-5" />;
      case 'right-left':
        return <MdViewWeek className="w-5 h-5" />;
      case 'top-bottom':
        return <MdViewAgenda className="w-5 h-5" />;
      case 'bottom-top':
        return <MdViewDay className="w-5 h-5" />;
    }
  };

  const getLayoutLabel = () => {
    switch (invoiceLayout) {
      case 'left-right':
        return 'Data Left | Image Right';
      case 'right-left':
        return 'Image Left | Data Right';
      case 'top-bottom':
        return 'Image Top | Data Bottom';
      case 'bottom-top':
        return 'Data Top | Image Bottom';
    }
  };

  // Editable Field Component
  const EditableField = ({ 
    fieldName, 
    label, 
    value, 
    displayValue,
    type = 'text',
    className = '',
    disabled = false,
    useAutocomplete = false,
    useAgentAutocomplete = false,
    useStoreDropdown = false
  }: { 
    fieldName: string; 
    label: string; 
    value: any; 
    displayValue?: string;
    type?: 'text' | 'number' | 'date';
    className?: string;
    disabled?: boolean;
    useAutocomplete?: boolean;
    useAgentAutocomplete?: boolean;
    useStoreDropdown?: boolean;
  }) => {
    const isEditing = editingField === fieldName && !disabled;
    
    return (
      <div>
        <label className="text-sm font-medium text-muted-foreground">{label}</label>
        {!isEditing ? (
          <div 
            onClick={() => !disabled && setEditingField(fieldName)}
            className={`${disabled ? 'cursor-default' : 'cursor-pointer hover:bg-muted/50'} p-2 rounded-md -ml-2 group ${className}`}
            title={disabled ? '' : 'Click to edit'}
          >
            <div className="flex items-center justify-between">
              <span>{displayValue || value}</span>
              {!disabled && <MdEdit className="w-4 h-4 opacity-0 group-hover:opacity-50 transition-opacity" />}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {type === 'date' ? (
              <DatePicker
                selected={editValues.date && !isNaN(new Date(editValues.date).getTime()) ? new Date(editValues.date) : new Date()}
                onChange={async (date) => {
                  if (!date) return;
                  
                  const newDate = date.toISOString().split('T')[0];
                  setEditValues({...editValues, date: newDate});
                  
                  // Auto-save when date is selected
                  try {
                    const updatedInvoice: DatabaseInvoice = {
                      ...invoice,
                      date: newDate,
                      updatedAt: new Date().toISOString()
                    };
                    
                    await invoiceDb.updateInvoice(invoice.id, updatedInvoice);
                    setEditingField(null);
                    
                    if (onUpdate) {
                      onUpdate(updatedInvoice);
                    }
                  } catch (error) {
                    console.error('Failed to auto-save date:', error);
                  }
                }}
                onKeyDown={(e) => handleKeyDown(e as any, fieldName)}
                dateFormat="yyyy-MM-dd"
                className="px-3 py-2 border border-border rounded-md w-full"
                autoFocus
              />
            ) : useAutocomplete && fieldName === 'merchantName' ? (
              <div 
                className="flex-1"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()} // prevent row click toggles while typing
              >
                <MerchantAutocomplete
                  value={editValues.merchantName}
                  onChange={async (newValue, merchantId, merchantAddress, isSelection) => {
                    // Parse the address string into InvoiceAddress format if provided
                    let updatedAddress = editValues.merchantAddress;
                    if (merchantAddress) {
                      updatedAddress = {
                        street: merchantAddress,
                        city: '',
                        state: '',
                        zipCode: '',
                        country: ''
                      };
                    }
                    
                    const newValues = {
                      ...editValues, 
                      merchantName: newValue,
                      merchantAddress: updatedAddress
                    };
                    
                    setEditValues(newValues);
                    
                    // Auto-save when selecting from dropdown (not when typing)
                    if (isSelection && merchantId) {
                      try {
                        const updatedInvoice: DatabaseInvoice = {
                          ...invoice,
                          merchantName: newValue,
                          merchantId: merchantId,
                          merchantAddress: updatedAddress,
                          updatedAt: new Date().toISOString()
                        };
                        
                        await invoiceDb.updateInvoice(invoice.id, updatedInvoice);
                        setEditingField(null);
                        
                        if (onUpdate) {
                          onUpdate(updatedInvoice);
                        }
                      } catch (error) {
                        console.error('Failed to auto-save merchant:', error);
                      }
                    }
                  }}
                  className="px-3 py-2 border border-border rounded-md w-full"
                  disabled={false}
                  autoFocus
                />
              </div>
            ) : useAgentAutocomplete && fieldName === 'agentName' ? (
              <div 
                className="flex-1"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <AgentAutocomplete
                  value={editValues.agentName}
                  onChange={async (newValue, agentId, isSelection) => {
                    setEditValues({
                      ...editValues, 
                      agentName: newValue
                    });
                    
                    // Auto-save when selecting from dropdown
                    if (isSelection && agentId) {
                      try {
                        const updatedInvoice: DatabaseInvoice = {
                          ...invoice,
                          agentName: newValue,
                          agentId: agentId,
                          updatedAt: new Date().toISOString()
                        };
                        
                        await invoiceDb.updateInvoice(invoice.id, updatedInvoice);
                        setEditingField(null);
                        
                        if (onUpdate) {
                          onUpdate(updatedInvoice);
                        }
                      } catch (error) {
                        console.error('Failed to auto-save agent:', error);
                      }
                    }
                  }}
                  className="px-3 py-2 border border-border rounded-md w-full"
                  disabled={false}
                  autoFocus
                />
              </div>
            ) : useStoreDropdown && fieldName === 'storeName' ? (
              <StoreDropdown
                value={editValues.storeName}
                onChange={(newValue) => {
                  setEditValues({...editValues, storeName: newValue});
                }}
                className="px-3 py-2 border border-border rounded-md w-full"
                disabled={false}
              />
            ) : (
              <input
                type={type}
                value={editValues[fieldName as keyof typeof editValues] as string | number}
                onChange={(e) => setEditValues({...editValues, [fieldName]: type === 'number' ? parseFloat(e.target.value) : e.target.value})}
                onKeyDown={(e) => handleKeyDown(e, fieldName)}
                className="px-3 py-2 border border-border rounded-md w-full"
                autoFocus
              />
            )}
            <button
              onClick={() => handleSaveField(fieldName)}
              className="p-2 text-green-600 hover:bg-green-50 rounded-md transition-colors"
              title="Save"
            >
              <MdSave className="w-5 h-5" />
            </button>
            <button
              onClick={handleCancelEdit}
              className="p-2 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
              title="Cancel"
            >
              <MdClose className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    );
  };

  // Invoice Image Component
  const InvoiceImage = () => (
    <div className="h-full">
      {invoice.imageData ? (
        <Zoom>
          <img 
            src={invoice.imageData} 
            alt={`Invoice from ${invoice.merchantName}`}
            className="w-full h-auto object-contain cursor-zoom-in sticky top-4"
          />
        </Zoom>
      ) : (
        <div className="w-full h-64 bg-muted rounded-lg flex items-center justify-center">
          <p className="text-muted-foreground">No image available</p>
        </div>
      )}
    </div>
  );

  // Invoice Data Component
  const InvoiceData = () => (
    <div className="space-y-4">
      {/* Status and Actions Card */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-sm text-muted-foreground">Status:</span>
            {/* Status Badge */}
            <span className={`
              px-3 py-1 rounded-full text-xs font-semibold
              ${invoice.status === 'approved' 
                ? 'bg-green-100 text-green-800 border border-green-200' 
                : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
              }
            `}>
              {invoice.status === 'approved' ? '✓ Approved' : '⚠ Review'}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-2">
            {/* Status Buttons */}
            {invoice.status !== 'review' ? (
              <button
                onClick={() => onStatusChange('review')}
                className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-yellow-600 hover:bg-yellow-50 transition-colors rounded-lg border border-yellow-200"
              >
                <MdRateReview className="w-4 h-4" />
                <span>Set to Review</span>
              </button>
            ) : (
              <button
                onClick={() => onStatusChange('approved')}
                className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-green-600 hover:bg-green-50 transition-colors rounded-lg border border-green-200"
              >
                <MdCheckCircle className="w-4 h-4" />
                <span>Approve</span>
              </button>
            )}
            
            <button
              onClick={() => {
                if (deleteConfirm) {
                  onDelete();
                } else {
                  setDeleteConfirm(true);
                  // auto-reset after a short delay
                  setTimeout(() => setDeleteConfirm(false), 2000);
                }
              }}
              className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                deleteConfirm
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : 'text-destructive hover:bg-destructive/10'
              }`}
              title={deleteConfirm ? 'Click again to confirm delete' : 'Delete invoice'}
            >
              {deleteConfirm ? <MdWarning className="w-4 h-4" /> : <MdDelete className="w-4 h-4" />}
              <span>{deleteConfirm ? 'Confirm' : 'Delete'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Merchant Information Details */}
      <div className="bg-card border border-border rounded-lg p-6">
        {/* Store Name - Editable at top */}
        <div className="mb-4 pb-4 border-b border-border">
          <EditableField
            fieldName="storeName"
            label="Store"
            value={editValues.storeName}
            displayValue={editValues.storeName || 'No store assigned'}
            className="text-xl font-bold text-primary"
            useStoreDropdown={true}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <EditableField
            fieldName="merchantName"
            label="Merchant"
            value={editValues.merchantName}
            displayValue={editValues.merchantName}
            className="text-lg font-semibold"
            useAutocomplete={true}
          />
          <EditableField
            fieldName="invoiceNumber"
            label="Invoice Number"
            value={editValues.invoiceNumber}
            displayValue={editValues.invoiceNumber || 'N/A'}
            className="text-lg font-semibold"
          />
          <EditableField
            fieldName="date"
            label="Date"
            value={editValues.date}
            displayValue={formatDate(editValues.date)}
            type="date"
            className="text-lg"
          />
          <EditableField
            fieldName="total"
            label="Total Amount"
            value={editValues.total}
            displayValue={formatCurrencyWithLocale(editValues.total, invoice.currency || 'PHP')}
            type="number"
            className="text-lg font-bold text-primary"
            disabled={editingItemId !== null}
          />
        </div>

        {/* Address */}
        {invoice.merchantAddress && (
          <div className="mt-4 pt-4 border-t">
            <label className="text-sm font-medium text-muted-foreground">Address</label>
            {editingField === 'address' ? (
              <div className="flex items-start gap-2 mt-2">
                <textarea
                  value={[
                    editValues.merchantAddress?.street,
                    editValues.merchantAddress?.city,
                    editValues.merchantAddress?.state,
                    editValues.merchantAddress?.zipCode,
                    editValues.merchantAddress?.country
                  ].filter(Boolean).join(', ')}
                  onChange={(e) => {
                    // Simple implementation: split by comma and reassign
                    const parts = e.target.value.split(',').map(p => p.trim());
                    setEditValues({
                      ...editValues,
                      merchantAddress: {
                        street: parts[0] || '',
                        city: parts[1] || '',
                        state: parts[2] || '',
                        zipCode: parts[3] || '',
                        country: parts[4] || ''
                      }
                    });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                      e.preventDefault();
                      handleSaveField('address');
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      handleCancelEdit();
                    }
                  }}
                  className="px-3 py-2 border border-border rounded-md w-full text-sm"
                  rows={2}
                  placeholder="Hint: Press Ctrl+Enter to save, Escape to cancel"
                  autoFocus
                />
                <button
                  onClick={() => handleSaveField('address')}
                  className="p-2 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                  title="Save"
                >
                  <MdSave className="w-5 h-5" />
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="p-2 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                  title="Cancel"
                >
                  <MdClose className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div 
                onClick={() => setEditingField('address')}
                className="cursor-pointer hover:bg-muted/50 p-2 rounded-md -ml-2 group text-sm mt-1"
                title="Click to edit"
              >
                <div className="flex items-center justify-between">
                  <span>
                    {[
                      invoice.merchantAddress.street,
                      invoice.merchantAddress.city,
                      invoice.merchantAddress.state,
                      invoice.merchantAddress.zipCode,
                      invoice.merchantAddress.country
                    ].filter(Boolean).join(', ')}
                  </span>
                  <MdEdit className="w-4 h-4 opacity-0 group-hover:opacity-50 transition-opacity" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Agent and Terms */}
        <div className="mt-4 pt-4 border-t">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <EditableField
              fieldName="agentName"
              label="Agent"
              value={editValues.agentName}
              displayValue={editValues.agentName || 'N/A'}
              className="text-lg"
              useAgentAutocomplete={true}
            />
            <EditableField
              fieldName="terms"
              label="Terms"
              value={editValues.terms}
              displayValue={editValues.terms || 'N/A'}
              className="text-lg"
            />
          </div>
        </div>

        {/* Contact Info */}
        {(invoice.phoneNumber || invoice.email || invoice.website) && (
          <div className="mt-4 pt-4 border-t">
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Contact Information</label>
            <div className="space-y-1 text-sm">
              {invoice.phoneNumber && <p>📞 {invoice.phoneNumber}</p>}
              {invoice.email && <p>✉️ {invoice.email}</p>}
              {invoice.website && <p>🌐 {invoice.website}</p>}
            </div>
          </div>
        )}

        {/* Notes Section */}
        {invoice.notes && (
          <div className="mt-4 pt-4 border-t">
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Notes</label>
            <div className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 rounded-md p-3">
              {invoice.notes}
            </div>
          </div>
        )}

        {/* AI Extraction Metadata */}
        {(invoice.aiModel || invoice.aiResponseTime || invoice.aiExtractedFrom) && (
          <div className="mt-4 pt-4 border-t">
            <label className="text-sm font-medium text-muted-foreground mb-2 block">AI Extraction Info</label>
            <div className="space-y-1 text-xs">
              {invoice.aiExtractedFrom && (
                <div className="flex items-center space-x-2">
                  <span className="text-muted-foreground">Source:</span>
                  <div className="flex items-center space-x-1">
                    {invoice.aiExtractedFrom === 'image' ? (
                      <MdImage className="w-4 h-4 text-blue-600" />
                    ) : (
                      <MdEdit className="w-4 h-4 text-gray-600" />
                    )}
                    <span className="font-medium">
                      {invoice.aiExtractedFrom === 'image' ? 'Extracted from Image' : 'Manual Entry'}
                    </span>
                  </div>
                </div>
              )}
              {invoice.aiModel && (
                <div className="flex items-center space-x-2">
                  <span className="text-muted-foreground">AI Model:</span>
                  <div className="flex items-center space-x-1">
                    <MdSmartToy className="w-4 h-4 text-purple-600" />
                    <span className="font-medium">
                      {invoice.aiModel === 'chrome-builtin' ? 'Chrome Built-in AI' : invoice.aiModel || 'Gemini API'}
                    </span>
                  </div>
                </div>
              )}
              {invoice.aiResponseTime && (
                <div className="flex items-center space-x-2">
                  <span className="text-muted-foreground">Processing Time:</span>
                  <div className="flex items-center space-x-1">
                    <MdSpeed className="w-4 h-4 text-green-600" />
                    <span className="font-medium">
                      {invoice.aiResponseTime < 1000 
                        ? `${invoice.aiResponseTime}ms` 
                        : `${(invoice.aiResponseTime / 1000).toFixed(2)}s`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Line Items</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-center p-2 text-sm font-medium">Qty</th>
                <th className="text-center p-2 text-sm font-medium">Unit</th>
                <th className="text-left p-2 text-sm font-medium">Description</th>
                <th className="text-right p-2 text-sm font-medium">Unit Price</th>
                <th className="text-right p-2 text-sm font-medium">Amount</th>
                {editingItemId && (
                  <th className="text-center p-2 text-sm font-medium">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => {
                const isEditingThisItem = editingItemId === item.id;
                
                return (
                  <tr key={item.id} className="border-b border-border hover:bg-muted/30">
                    {/* Quantity - Editable */}
                    <td className="text-center p-2">
                      {isEditingThisItem ? (
                        <input
                          ref={qtyRef}
                          key={`qty-${item.id}`}
                          type="number"
                          value={editingItemValues?.quantity ?? item.quantity}
                          onChange={(e) => handleItemFieldChange('quantity', e.target.value)}
                          onFocus={() => setEditingItemFocus('quantity')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveItem(item.id);
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              handleCancelItemEdit();
                            }
                          }}
                          className="w-16 px-2 py-1 border border-border rounded text-center"
                          min="0"
                          step="1"
                        />
                      ) : (
                        <div 
                          onClick={() => handleEditItem(item, 'quantity')}
                          className="cursor-pointer hover:bg-primary/10 rounded px-2 py-1"
                          title="Click to edit"
                        >
                          {item.quantity}
                        </div>
                      )}
                    </td>
                    
                    {/* Unit - Static */}
                    <td className="text-center p-2 text-sm text-muted-foreground">
                      {item.description?.match(/^\d+\s*(PC|BOX|SET|PCS|UNIT|EA)/i)?.[1] || 'PC'}
                    </td>
                    
                    {/* Description - Editable */}
                    <td className="p-2">
                      {isEditingThisItem ? (
                        <input
                          ref={nameRef}
                          key={`name-${item.id}`}
                          type="text"
                          value={editingItemValues?.name ?? item.name}
                          onChange={(e) => handleItemFieldChange('name', e.target.value)}
                          onFocus={() => setEditingItemFocus('name')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveItem(item.id);
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              handleCancelItemEdit();
                            }
                          }}
                          className="w-full px-2 py-1 border border-border rounded"
                          placeholder="Item description"
                        />
                      ) : (
                        <div 
                          onClick={() => handleEditItem(item, 'name')}
                          className="cursor-pointer hover:bg-primary/10 rounded px-2 py-1"
                          title="Click to edit"
                        >
                          <div className="font-medium">{item.name}</div>
                          {item.description && item.description !== item.name && (
                            <div className="text-xs text-muted-foreground">{item.description}</div>
                          )}
                        </div>
                      )}
                    </td>
                    
                    {/* Unit Price - Editable */}
                    <td className="text-right p-2">
                      {isEditingThisItem ? (
                        <input
                          ref={priceRef}
                          key={`price-${item.id}`}
                          type="number"
                          value={editingItemValues?.unitPrice ?? item.unitPrice}
                          onChange={(e) => handleItemFieldChange('unitPrice', e.target.value)}
                          onFocus={() => setEditingItemFocus('unitPrice')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveItem(item.id);
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              handleCancelItemEdit();
                            }
                          }}
                          className="w-24 px-2 py-1 border border-border rounded text-right"
                          min="0"
                          step="0.01"
                        />
                      ) : (
                        <div 
                          onClick={() => handleEditItem(item, 'unitPrice')}
                          className="cursor-pointer hover:bg-primary/10 rounded px-2 py-1"
                          title="Click to edit"
                        >
                          {formatCurrencyWithLocale(item.unitPrice, invoice.currency || 'PHP')}
                        </div>
                      )}
                    </td>
                    
                    {/* Amount - Auto-calculated (not editable) */}
                    <td className="text-right p-2 font-medium">
                      {isEditingThisItem ? (
                        <div className="px-2 py-1 bg-green-50 border border-green-200 rounded text-green-700">
                          {formatCurrencyWithLocale(editingItemValues?.totalPrice ?? item.totalPrice, invoice.currency || 'PHP')}
                        </div>
                      ) : (
                        formatCurrencyWithLocale(item.totalPrice, invoice.currency || 'PHP')
                      )}
                    </td>
                    
                    {/* Save/Cancel buttons when editing */}
                    {isEditingThisItem && (
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleSaveItem(item.id)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Save (Enter)"
                          >
                            <MdSave className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleCancelItemEdit}
                            className="p-1 text-destructive hover:bg-destructive/10 rounded transition-colors"
                            title="Cancel (Escape)"
                          >
                            <MdClose className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted">
              {invoice.subtotal && (
                <tr>
                  <td colSpan={editingItemId ? 5 : 4} className="text-right p-2 font-medium">Subtotal</td>
                  <td className="text-right p-2">
                    {formatCurrencyWithLocale(invoice.subtotal, invoice.currency || 'PHP')}
                  </td>
                </tr>
              )}
              {invoice.tax && (
                <tr>
                  <td colSpan={editingItemId ? 5 : 4} className="text-right p-2 font-medium">Tax</td>
                  <td className="text-right p-2">
                    {formatCurrencyWithLocale(invoice.tax, invoice.currency || 'PHP')}
                  </td>
                </tr>
              )}
              <tr className="text-lg font-bold">
                <td colSpan={editingItemId ? 5 : 4} className="text-right p-2">Total</td>
                <td className="text-right p-2 text-primary">
                  {formatCurrencyWithLocale(invoice.total, invoice.currency || 'PHP')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );

  // Render based on layout
  const renderLayout = () => {
    switch (invoiceLayout) {
      case 'left-right':
        return (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 min-w-0">
              <InvoiceData />
            </div>
            <div className="lg:w-72 xl:w-80 flex-shrink-0">
              <InvoiceImage />
            </div>
          </div>
        );
      case 'right-left':
        return (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="lg:w-72 xl:w-80 flex-shrink-0">
              <InvoiceImage />
            </div>
            <div className="flex-1 min-w-0">
              <InvoiceData />
            </div>
          </div>
        );
      case 'top-bottom':
        return (
          <div className="space-y-6">
            <InvoiceImage />
            <InvoiceData />
          </div>
        );
      case 'bottom-top':
        return (
          <div className="space-y-6">
            <InvoiceData />
            <InvoiceImage />
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Invoice Details</h2>
        <div className="flex items-center space-x-3">
          {/* Layout Toggle Button */}
          <button
            onClick={cycleLayout}
            className="flex items-center space-x-2 px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
            title={getLayoutLabel()}
          >
            {getLayoutIcon()}
            <span className="text-sm font-medium hidden sm:inline">{getLayoutLabel()}</span>
          </button>
        </div>
      </div>

      {renderLayout()}
    </div>
  );
}

// Memoize to prevent re-renders when parent re-renders
export default React.memo(InvoiceDetailsComponent);
