'use client';

import React, { useState, useEffect } from 'react';
import { checkChromeAIAvailability, ChromeAIStatus } from '@/lib/ai-extraction';

export default function DemoInstructions() {
  const [aiStatus, setAiStatus] = useState<ChromeAIStatus>({
    available: false,
    status: 'Checking...',
    promptApiAvailable: false,
    languageModelAvailable: false,
  });
  
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    async function checkAI() {
      console.log('DemoInstructions: Checking AI availability...');
      const status = await checkChromeAIAvailability();
      console.log('DemoInstructions: AI status result:', status);
      setAiStatus(status);
    }
    checkAI();
  }, []);

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-8">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="text-2xl">🚀</div>
          <div>
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
              Welcome to Shaw AI Demo
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              LanguageModel Status: <span className={aiStatus.available ? 'text-green-600' : 'text-red-600'}>
                {aiStatus.status}
              </span>
            </p>
            <div className="flex gap-3 text-xs text-blue-600 dark:text-blue-400 mt-1">
              <span>Prompt API: {aiStatus.promptApiAvailable ? '✅' : '❌'}</span>
              <span>LanguageModel: {aiStatus.languageModelAvailable ? '✅' : '❌'}</span>
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

      {!aiStatus.available && aiStatus.instructions && (
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-md p-4 mb-4">
          <div className="flex items-start space-x-2">
            <div className="text-yellow-500 mt-0.5">⚠️</div>
            <div className="text-sm">
              <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                {aiStatus.promptApiAvailable ? 'LanguageModel Ready' : 'Chrome Prompt API Required'}
              </p>
              <p className="text-yellow-700 dark:text-yellow-300">
                {aiStatus.instructions}
              </p>
              {aiStatus.languageModelAvailable && !aiStatus.promptApiAvailable && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                  Detected window.LanguageModel, but the new image-capable Prompt API is missing. Enable the flags below to unlock multimodal extraction.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {showInstructions && (
        <div className="space-y-4">
          <div className="border-t border-blue-200 dark:border-blue-800 pt-4">
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
            </div>
          </div>

          <div className="border-t border-blue-200 dark:border-blue-800 pt-4">
            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
              📝 How to Test Shaw AI
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="bg-white dark:bg-blue-950/50 rounded-md p-3 border border-blue-200 dark:border-blue-800">
                <p className="font-medium text-green-700 dark:text-green-300 mb-2">✅ What Works Now</p>
                <ul className="space-y-1 text-blue-700 dark:text-blue-300">
                  <li>• Drag & drop interface</li>
                  <li>• Database storage (SQLite WASM)</li>
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

          <div className="border-t border-blue-200 dark:border-blue-800 pt-4">
            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
              🧪 Test with Sample Images
            </h4>
            
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
              Try dropping any receipt or invoice image. The system will use Chrome's LanguageModel to extract data and demonstrate the full workflow:
            </p>
            
            <div className="bg-white dark:bg-blue-950/50 rounded-md p-3 border border-blue-200 dark:border-blue-800">
              <p className="font-medium mb-2 text-blue-900 dark:text-blue-100">Sample workflow:</p>
              <ol className="text-sm space-y-1 text-blue-700 dark:text-blue-300">
                <li>1. Drop an image → Shows processing animation</li>
                <li>2. LanguageModel extracts data → Creates structured invoice record</li>
                <li>3. Saves to local database → Displays in invoice list</li>
                <li>4. Click invoice → View detailed breakdown</li>
                <li>5. Data persists → Reloads on page refresh</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {aiStatus.available && (
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md p-4">
          <div className="flex items-center space-x-2">
            <div className="text-green-500">✅</div>
            <div className="text-sm">
              <p className="font-medium text-green-800 dark:text-green-200">
                Chrome Prompt API is ready! You can now upload invoice images for automatic extraction.
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                Debug: Status = {JSON.stringify(aiStatus)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
