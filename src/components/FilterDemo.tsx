'use client';

import React from 'react';
import { DatabaseInvoice } from '@/types/invoice';

// Sample data for demonstration
const sampleInvoices: DatabaseInvoice[] = [
  {
    id: '1',
    merchantName: 'Starbucks Coffee',
    merchantAddress: {
      city: 'Manila',
      state: 'Metro Manila',
      country: 'Philippines'
    },
    invoiceNumber: 'SB-2024-001',
    date: '2024-01-15',
    time: '10:30 AM',
    items: [
      { id: '1', name: 'Grande Latte', category: 'Beverage', quantity: 1, unitPrice: 150, totalPrice: 150 },
      { id: '2', name: 'Croissant', category: 'Food', quantity: 1, unitPrice: 80, totalPrice: 80 }
    ],
    subtotal: 230,
    tax: 27.6,
    total: 257.6,
    currency: 'PHP',
    paymentMethod: 'Credit Card',
    agentName: 'John Doe',
    extractedAt: '2024-01-15T10:30:00Z',
    confidence: 0.95,
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-15T10:30:00Z'
  },
  {
    id: '2',
    merchantName: 'McDonald\'s',
    merchantAddress: {
      city: 'Quezon City',
      state: 'Metro Manila',
      country: 'Philippines'
    },
    invoiceNumber: 'MCD-2024-002',
    date: '2024-01-16',
    time: '12:15 PM',
    items: [
      { id: '1', name: 'Big Mac Meal', category: 'Food', quantity: 1, unitPrice: 120, totalPrice: 120 },
      { id: '2', name: 'Coca Cola', category: 'Beverage', quantity: 1, unitPrice: 25, totalPrice: 25 }
    ],
    subtotal: 145,
    tax: 17.4,
    total: 162.4,
    currency: 'PHP',
    paymentMethod: 'Cash',
    agentName: 'Jane Smith',
    extractedAt: '2024-01-16T12:15:00Z',
    confidence: 0.88,
    createdAt: '2024-01-16T12:15:00Z',
    updatedAt: '2024-01-16T12:15:00Z'
  },
  {
    id: '3',
    merchantName: 'Jollibee',
    merchantAddress: {
      city: 'Makati',
      state: 'Metro Manila',
      country: 'Philippines'
    },
    invoiceNumber: 'JB-2024-003',
    date: '2024-01-17',
    time: '7:45 PM',
    items: [
      { id: '1', name: 'Chicken Joy', category: 'Food', quantity: 2, unitPrice: 85, totalPrice: 170 },
      { id: '2', name: 'Rice', category: 'Food', quantity: 2, unitPrice: 15, totalPrice: 30 }
    ],
    subtotal: 200,
    tax: 24,
    total: 224,
    currency: 'PHP',
    paymentMethod: 'GCash',
    agentName: 'Mike Johnson',
    extractedAt: '2024-01-17T19:45:00Z',
    confidence: 0.92,
    createdAt: '2024-01-17T19:45:00Z',
    updatedAt: '2024-01-17T19:45:00Z'
  },
  {
    id: '4',
    merchantName: 'Coffee Bean & Tea Leaf',
    merchantAddress: {
      city: 'Taguig',
      state: 'Metro Manila',
      country: 'Philippines'
    },
    invoiceNumber: 'CBTL-2024-004',
    date: '2024-01-18',
    time: '2:20 PM',
    items: [
      { id: '1', name: 'Iced Coffee', category: 'Beverage', quantity: 1, unitPrice: 120, totalPrice: 120 },
      { id: '2', name: 'Muffin', category: 'Food', quantity: 1, unitPrice: 65, totalPrice: 65 }
    ],
    subtotal: 185,
    tax: 22.2,
    total: 207.2,
    currency: 'PHP',
    paymentMethod: 'Debit Card',
    agentName: 'Sarah Wilson',
    extractedAt: '2024-01-18T14:20:00Z',
    confidence: 0.90,
    createdAt: '2024-01-18T14:20:00Z',
    updatedAt: '2024-01-18T14:20:00Z'
  },
  {
    id: '5',
    merchantName: 'KFC',
    merchantAddress: {
      city: 'Pasig',
      state: 'Metro Manila',
      country: 'Philippines'
    },
    invoiceNumber: 'KFC-2024-005',
    date: '2024-01-19',
    time: '6:30 PM',
    items: [
      { id: '1', name: 'Zinger Burger', category: 'Food', quantity: 1, unitPrice: 95, totalPrice: 95 },
      { id: '2', name: 'Fries', category: 'Food', quantity: 1, unitPrice: 35, totalPrice: 35 },
      { id: '3', name: 'Pepsi', category: 'Beverage', quantity: 1, unitPrice: 25, totalPrice: 25 }
    ],
    subtotal: 155,
    tax: 18.6,
    total: 173.6,
    currency: 'PHP',
    paymentMethod: 'Credit Card',
    agentName: 'John Doe',
    extractedAt: '2024-01-19T18:30:00Z',
    confidence: 0.87,
    createdAt: '2024-01-19T18:30:00Z',
    updatedAt: '2024-01-19T18:30:00Z'
  }
];

interface FilterDemoProps {
  onClose: () => void;
}

export default function FilterDemo({ onClose }: FilterDemoProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card border border-border rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Filter Component Demo</h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              ✕
            </button>
          </div>
          
          <div className="space-y-6">
            <div className="bg-muted/50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Features Demonstrated:</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Global Search:</strong> Search across all fields (store name, invoice number, items, etc.)</li>
                <li>• <strong>Store Filter:</strong> Filter by specific merchant/store names</li>
                <li>• <strong>Category Filter:</strong> Filter by item categories (Food, Beverage, etc.)</li>
                <li>• <strong>City Filter:</strong> Filter by merchant city location</li>
                <li>• <strong>Invoice Number:</strong> Search by specific invoice numbers</li>
                <li>• <strong>Date Range:</strong> Filter by date range (from/to dates)</li>
                <li>• <strong>Amount Range:</strong> Filter by minimum and maximum amounts</li>
                <li>• <strong>Payment Method:</strong> Filter by payment type (Cash, Credit Card, etc.)</li>
                <li>• <strong>Agent Filter:</strong> Filter by processing agent</li>
                <li>• <strong>Sorting:</strong> Sort by date, merchant, amount, or invoice number</li>
                <li>• <strong>Collapsible UI:</strong> Expandable filter panel for better UX</li>
                <li>• <strong>Active Filter Count:</strong> Shows number of active filters</li>
                <li>• <strong>Clear All:</strong> One-click filter reset</li>
              </ul>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
              <h3 className="font-semibold text-yellow-800 mb-2">Sample Data:</h3>
              <p className="text-sm text-yellow-700">
                This demo uses sample invoice data with various stores, categories, cities, 
                payment methods, and agents to demonstrate all filtering capabilities.
              </p>
            </div>

            <div className="text-center">
              <p className="text-muted-foreground text-sm">
                The filter component is now integrated into your main invoice list. 
                Try the various filters with your actual invoice data!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { sampleInvoices };
