'use client';

import React, { useState, useEffect } from 'react';
import { DatabaseInvoice } from '@/types/invoice';
import { useAIProvider } from '@/contexts/AIProviderContext';
import { useAIAvailabilityStore } from '@/store/aiAvailabilityStore';
import InvoiceDetails from './InvoiceDetails';

// Mock invoice data for demo
const DEMO_INVOICE: DatabaseInvoice = {
  id: 'demo-invoice-1',
  merchantName: 'Tech Supply Co.',
  date: '2024-10-01',
  total: 15750.00,
  currency: 'PHP',
  invoiceNumber: 'INV-2024-001',
  status: 'review',
  agentName: 'John Smith',
  terms: 'Net 30',
  merchantAddress: {
    street: '123 Business Ave',
    city: 'Manila',
    state: 'Metro Manila',
    zipCode: '1000',
    country: 'Philippines'
  },
  phoneNumber: '+63 2 1234 5678',
  email: 'sales@techsupply.ph',
  website: 'www.techsupply.ph',
  subtotal: 14000.00,
  tax: 1750.00,
  items: [
    {
      id: '1',
      name: 'Laptop Computer',
      description: 'High Performance Business Laptop',
      quantity: 2,
      unitPrice: 45000.00,
      totalPrice: 90000.00
    },
    {
      id: '2',
      name: 'Office Chair',
      description: 'Ergonomic Executive Chair',
      quantity: 5,
      unitPrice: 8500.00,
      totalPrice: 42500.00
    },
    {
      id: '3',
      name: 'Monitor',
      description: '27" 4K Display',
      quantity: 3,
      unitPrice: 18000.00,
      totalPrice: 54000.00
    }
  ],
  imageData: '/samples/7775149e-34c8-4c47-91a8-c569869036f7.jpeg',
  extractedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

export default function DemoInstructions() {
  const { useOnlineGemini, setUseOnlineGemini } = useAIProvider();
  const { isAvailable: aiAvailable, status: aiStatus } = useAIAvailabilityStore();
  
  const [showInstructions, setShowInstructions] = useState(true);
  const [demoState, setDemoState] = useState<'idle' | 'analyzing' | 'complete'>('idle');

  const handleDemoClick = () => {
    setDemoState('analyzing');
    // Simulate AI processing time
    setTimeout(() => {
      setDemoState('complete');
    }, 2000);
  };

  const handleReset = () => {
    setDemoState('idle');
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="text-2xl">🚀</div>
          <div>
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
              Welcome to Ledgee Demo
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              LanguageModel Status: <span className={aiAvailable ? 'text-green-600' : 'text-red-600'}>
                {aiStatus?.status || 'Checking...'}
              </span>
            </p>
            <div className="flex gap-3 text-xs text-blue-600 dark:text-blue-400 mt-1">
              <span>Prompt API: {aiStatus?.promptApiAvailable ? '✅' : '❌'}</span>
              <span>LanguageModel: {aiStatus?.languageModelAvailable ? '✅' : '❌'}</span>
            </div>
          </div>
        </div>
        
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="text-blue-600 hover:text-blue-800 transition-colors text-sm font-medium"
        >
          {showInstructions ? 'Hide' : 'Show'} Setup Instructions
        </button>
      </div>

      {/* Status Banner */}
      {!aiAvailable && aiStatus?.instructions && (
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-md p-4 mb-6">
          <div className="flex items-start space-x-2">
            <div className="text-yellow-500 mt-0.5">⚠️</div>
            <div className="text-sm">
              <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                {aiStatus?.promptApiAvailable ? 'LanguageModel Ready' : 'Chrome Prompt API Required'}
              </p>
              <p className="text-yellow-700 dark:text-yellow-300">
                {aiStatus?.instructions}
              </p>
              {aiStatus?.languageModelAvailable && !aiStatus?.promptApiAvailable && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                  Detected window.LanguageModel, but the new image-capable Prompt API is missing. Enable the flags below to unlock multimodal extraction.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {aiAvailable && (
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md p-4 mb-6">
          <div className="flex items-center space-x-2">
            <div className="text-green-500">✅</div>
            <div className="text-sm">
              <p className="font-medium text-green-800 dark:text-green-200">
                Chrome Prompt API is ready! You can now upload invoice images for automatic extraction.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Demo Section - Always Visible */}
      <div className="border-t border-blue-200 dark:border-blue-800 pt-4 mb-6">
        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 text-center">
          🎯 Interactive Demo - See Ledgee in Action
        </h4>

        {demoState === 'idle' && (
          <div className="space-y-3 max-w-2xl mx-auto">
            <button
              onClick={handleDemoClick}
              className="w-full group relative overflow-hidden rounded-lg border-2 border-blue-300 dark:border-blue-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all shadow-md hover:shadow-lg"
            >
              <img 
                src="/samples/7775149e-34c8-4c47-91a8-c569869036f7.jpeg" 
                alt="Sample Invoice"
                className="w-full h-auto"
              />
              <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/10 transition-colors flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold text-lg shadow-lg">
                  👆 Click to Analyze
                </div>
              </div>
            </button>
          </div>
        )}

        {demoState === 'analyzing' && (
          <div className="bg-white dark:bg-blue-950/50 rounded-lg border border-blue-200 dark:border-blue-800 p-8 max-w-2xl mx-auto">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-800 rounded-full"></div>
                <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
              </div>
              <div className="text-center">
                <p className="font-semibold text-blue-900 dark:text-blue-100 text-lg">
                  🤖 AI Analyzing Invoice...
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  Extracting merchant info, line items, and totals
                </p>
              </div>
            </div>
          </div>
        )}

        {demoState === 'complete' && (
          <div className="space-y-3">
            <div className="flex items-center justify-center">
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors rounded-lg font-medium shadow-md"
              >
                ← Try Demo Again
              </button>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-border overflow-auto max-h-[800px] shadow-lg">
              <InvoiceDetails
                invoice={DEMO_INVOICE}
                onStatusChange={() => {}}
                onDelete={() => {}}
              />
            </div>
          </div>
        )}
      </div>

      {/* Setup Instructions - Collapsible */}
      {showInstructions && (
        <div className="border-t border-blue-200 dark:border-blue-800 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
                🔧 Setup Instructions for Chrome LanguageModel
              </h4>
              
              <div className="space-y-3 text-sm text-blue-700 dark:text-blue-300">
                <div className="bg-white dark:bg-blue-950/50 rounded-md p-3 border border-blue-200 dark:border-blue-800">
                  <p className="font-medium mb-2">1. Install Chrome Canary</p>
                  <p>Download from: <a href="https://www.google.com/chrome/canary/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">chrome.google.com/chrome/canary</a></p>
                </div>
                
                <div className="bg-white dark:bg-blue-950/50 rounded-md p-3 border border-blue-200 dark:border-blue-800">
                  <p className="font-medium mb-2">2. Enable Chrome LanguageModel Flags</p>
                  <p>Navigate to these URLs in Chrome Canary and set to "Enabled":</p>
                  <ul className="mt-2 space-y-1 font-mono text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded">
                    <li>chrome://flags/#prompt-api-for-gemini-nano</li>
                    <li>chrome://flags/#optimization-guide-on-device-model</li>
                  </ul>
                </div>
                
                <div className="bg-white dark:bg-blue-950/50 rounded-md p-3 border border-blue-200 dark:border-blue-800">
                  <p className="font-medium mb-2">3. Download Language Model</p>
                  <p>Visit <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">chrome://components/</code> and update "Optimization Guide On Device Model"</p>
                </div>
                
                <div className="bg-white dark:bg-blue-950/50 rounded-md p-3 border border-blue-200 dark:border-blue-800">
                  <p className="font-medium mb-2">4. Restart Chrome Canary</p>
                  <p>Completely close and restart Chrome Canary, then refresh this page.</p>
                </div>
                
                <div className="bg-white dark:bg-blue-950/50 rounded-md p-3 border border-blue-200 dark:border-blue-800">
                  <p className="font-medium mb-2">Alternative: Use Online Gemini API</p>
                  <p className="mb-3">Don't want to set up Chrome AI? Use Google's Gemini API instead:</p>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useOnlineGemini}
                      onChange={(e) => setUseOnlineGemini(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">Use Online Gemini (requires API key in Settings)</span>
                  </label>
                  {useOnlineGemini && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                      ✅ Online Gemini enabled. Make sure to add your API key in <a href="/settings" className="underline font-medium">Settings</a>.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
                📝 How to Test Ledgee
              </h4>
              
              <div className="grid grid-cols-1 gap-3 text-sm">
                <div className="bg-white dark:bg-blue-950/50 rounded-md p-3 border border-blue-200 dark:border-blue-800">
                  <p className="font-medium text-green-700 dark:text-green-300 mb-2">✅ What Works Now</p>
                  <ul className="space-y-1 text-blue-700 dark:text-blue-300">
                    <li>• Drag & drop interface</li>
                    <li>• Database storage (IndexedDB with Dexie)</li>
                    <li>• Invoice list and details view</li>
                    <li>• Responsive design</li>
                    <li>• LanguageModel integration</li>
                    <li>• Demo data extraction</li>
                  </ul>
                </div>
                
                <div className="bg-white dark:bg-blue-950/50 rounded-md p-3 border border-blue-200 dark:border-blue-800">
                  <p className="font-medium text-orange-700 dark:text-orange-300 mb-2">🚧 Demo Limitations</p>
                  <ul className="space-y-1 text-blue-700 dark:text-blue-300">
                    <li>• Uses simulated OCR text</li>
                    <li>• LanguageModel may not be available</li>
                    <li>• Limited to English invoices</li>
                    <li>• Requires Chrome Canary setup</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
