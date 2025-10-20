'use client';

import React, { useState, useEffect } from 'react';
import { DatabaseInvoice } from '@/types/invoice';
import { FiSearch, FiFilter, FiX, FiCalendar, FiMapPin, FiTag, FiHash, FiDollarSign } from 'react-icons/fi';

export interface InvoiceFilterState {
  searchQuery: string;
  storeName: string;
  category: string;
  city: string;
  invoiceNumber: string;
  dateRange: {
    start: string;
    end: string;
  };
  amountRange: {
    min: string;
    max: string;
  };
  paymentMethod: string;
  agentName: string;
  sortBy: 'date' | 'merchant' | 'total' | 'invoiceNumber';
  sortOrder: 'asc' | 'desc';
}

interface InvoiceFilterProps {
  invoices: DatabaseInvoice[];
  onFilterChange: (filteredInvoices: DatabaseInvoice[]) => void;
  onFilterStateChange: (filterState: InvoiceFilterState) => void;
  loading?: boolean;
}

export default function InvoiceFilter({ 
  invoices, 
  onFilterChange, 
  onFilterStateChange,
  loading = false 
}: InvoiceFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filterState, setFilterState] = useState<InvoiceFilterState>({
    searchQuery: '',
    storeName: '',
    category: '',
    city: '',
    invoiceNumber: '',
    dateRange: { start: '', end: '' },
    amountRange: { min: '', max: '' },
    paymentMethod: '',
    agentName: '',
    sortBy: 'date',
    sortOrder: 'desc'
  });

  // Get unique values for dropdowns
  const uniqueStores = Array.from(new Set(invoices.map(inv => inv.merchantName).filter(Boolean))).sort();
  const uniqueCategories = Array.from(new Set(
    invoices.flatMap(inv => inv.items.map(item => item.category).filter(Boolean))
  )).sort();
  const uniqueCities = Array.from(new Set(
    invoices.map(inv => inv.merchantAddress?.city).filter(Boolean)
  )).sort();
  const uniquePaymentMethods = Array.from(new Set(
    invoices.map(inv => inv.paymentMethod).filter(Boolean)
  )).sort();
  const uniqueAgents = Array.from(new Set(
    invoices.map(inv => inv.agentName).filter(Boolean)
  )).sort();

  // Apply filters
  useEffect(() => {
    const filtered = invoices.filter(invoice => {
      const searchQuery = filterState.searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        invoice.merchantName.toLowerCase().includes(searchQuery) ||
        invoice.invoiceNumber?.toLowerCase().includes(searchQuery) ||
        invoice.agentName?.toLowerCase().includes(searchQuery) ||
        invoice.items.some(item => 
          item.name.toLowerCase().includes(searchQuery) ||
          item.description?.toLowerCase().includes(searchQuery)
        );

      const matchesStore = !filterState.storeName || 
        invoice.merchantName.toLowerCase().includes(filterState.storeName.toLowerCase());

      const matchesCategory = !filterState.category ||
        invoice.items.some(item => 
          item.category?.toLowerCase().includes(filterState.category.toLowerCase())
        );

      const matchesCity = !filterState.city ||
        invoice.merchantAddress?.city?.toLowerCase().includes(filterState.city.toLowerCase());

      const matchesInvoiceNumber = !filterState.invoiceNumber ||
        invoice.invoiceNumber?.toLowerCase().includes(filterState.invoiceNumber.toLowerCase());

      const matchesDateRange = (!filterState.dateRange.start || new Date(invoice.date) >= new Date(filterState.dateRange.start)) &&
        (!filterState.dateRange.end || new Date(invoice.date) <= new Date(filterState.dateRange.end));

      const matchesAmountRange = (!filterState.amountRange.min || invoice.total >= parseFloat(filterState.amountRange.min)) &&
        (!filterState.amountRange.max || invoice.total <= parseFloat(filterState.amountRange.max));

      const matchesPaymentMethod = !filterState.paymentMethod ||
        invoice.paymentMethod?.toLowerCase().includes(filterState.paymentMethod.toLowerCase());

      const matchesAgent = !filterState.agentName ||
        invoice.agentName?.toLowerCase().includes(filterState.agentName.toLowerCase());

      return matchesSearch && matchesStore && matchesCategory && matchesCity && 
             matchesInvoiceNumber && matchesDateRange && matchesAmountRange && 
             matchesPaymentMethod && matchesAgent;
    });

    // Sort filtered results
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (filterState.sortBy) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'merchant':
          comparison = a.merchantName.localeCompare(b.merchantName);
          break;
        case 'total':
          comparison = a.total - b.total;
          break;
        case 'invoiceNumber':
          comparison = (a.invoiceNumber || '').localeCompare(b.invoiceNumber || '');
          break;
      }

      return filterState.sortOrder === 'asc' ? comparison : -comparison;
    });

    onFilterChange(filtered);
    onFilterStateChange(filterState);
  }, [invoices, filterState, onFilterChange, onFilterStateChange]);

  const updateFilter = (key: keyof InvoiceFilterState, value: any) => {
    setFilterState(prev => ({ ...prev, [key]: value }));
  };

  const updateNestedFilter = (parentKey: keyof InvoiceFilterState, childKey: string, value: any) => {
    setFilterState(prev => ({
      ...prev,
      [parentKey]: {
        ...(prev[parentKey] as any),
        [childKey]: value
      }
    }));
  };

  const clearAllFilters = () => {
    setFilterState({
      searchQuery: '',
      storeName: '',
      category: '',
      city: '',
      invoiceNumber: '',
      dateRange: { start: '', end: '' },
      amountRange: { min: '', max: '' },
      paymentMethod: '',
      agentName: '',
      sortBy: 'date',
      sortOrder: 'desc'
    });
  };

  const hasActiveFilters = Object.values(filterState).some(value => {
    if (typeof value === 'string') return value !== '';
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(v => v !== '');
    }
    return false;
  });

  const getFilterCount = () => {
    let count = 0;
    if (filterState.searchQuery) count++;
    if (filterState.storeName) count++;
    if (filterState.category) count++;
    if (filterState.city) count++;
    if (filterState.invoiceNumber) count++;
    if (filterState.dateRange.start || filterState.dateRange.end) count++;
    if (filterState.amountRange.min || filterState.amountRange.max) count++;
    if (filterState.paymentMethod) count++;
    if (filterState.agentName) count++;
    return count;
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-muted rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-10 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg">
      {/* Compact Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiFilter className="text-primary" size={18} />
            <h3 className="font-semibold text-sm">Filters</h3>
            {hasActiveFilters && (
              <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
                {getFilterCount()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                <FiX size={12} />
                Clear
              </button>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-primary hover:text-primary/80 transition-colors"
            >
              {isExpanded ? '▲' : '▼'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <FiSearch className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
          <input
            type="text"
            placeholder="Search across all fields..."
            value={filterState.searchQuery}
            onChange={(e) => updateFilter('searchQuery', e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="p-3 space-y-4">
          {/* Row 1: Store Name & Category */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <FiTag size={14} />
                Store Name
              </label>
              <select
                value={filterState.storeName}
                onChange={(e) => updateFilter('storeName', e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">All Stores</option>
                {uniqueStores.map(store => (
                  <option key={store} value={store}>{store}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <FiTag size={14} />
                Category
              </label>
              <select
                value={filterState.category}
                onChange={(e) => updateFilter('category', e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">All Categories</option>
                {uniqueCategories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: City & Invoice Number */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <FiMapPin size={16} />
                City
              </label>
              <select
                value={filterState.city}
                onChange={(e) => updateFilter('city', e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">All Cities</option>
                {uniqueCities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <FiHash size={16} />
                Invoice Number
              </label>
              <input
                type="text"
                placeholder="Enter invoice number..."
                value={filterState.invoiceNumber}
                onChange={(e) => updateFilter('invoiceNumber', e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          {/* Row 3: Date Range */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <FiCalendar size={16} />
              Date Range
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">From</label>
                <input
                  type="date"
                  value={filterState.dateRange.start}
                  onChange={(e) => updateNestedFilter('dateRange', 'start', e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">To</label>
                <input
                  type="date"
                  value={filterState.dateRange.end}
                  onChange={(e) => updateNestedFilter('dateRange', 'end', e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>
          </div>

          {/* Row 4: Amount Range */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <FiDollarSign size={16} />
              Amount Range
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Min Amount</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={filterState.amountRange.min}
                  onChange={(e) => updateNestedFilter('amountRange', 'min', e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Max Amount</label>
                <input
                  type="number"
                  placeholder="999999.99"
                  value={filterState.amountRange.max}
                  onChange={(e) => updateNestedFilter('amountRange', 'max', e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>
          </div>

          {/* Row 5: Payment Method & Agent */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Payment Method
              </label>
              <select
                value={filterState.paymentMethod}
                onChange={(e) => updateFilter('paymentMethod', e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">All Payment Methods</option>
                {uniquePaymentMethods.map(method => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Agent
              </label>
              <select
                value={filterState.agentName}
                onChange={(e) => updateFilter('agentName', e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">All Agents</option>
                {uniqueAgents.map(agent => (
                  <option key={agent} value={agent}>{agent}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 6: Sort Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Sort By
              </label>
              <select
                value={filterState.sortBy}
                onChange={(e) => updateFilter('sortBy', e.target.value as any)}
                className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="date">Date</option>
                <option value="merchant">Store Name</option>
                <option value="total">Amount</option>
                <option value="invoiceNumber">Invoice Number</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Sort Order
              </label>
              <select
                value={filterState.sortOrder}
                onChange={(e) => updateFilter('sortOrder', e.target.value as any)}
                className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


