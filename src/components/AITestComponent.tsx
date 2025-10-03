'use client';

import React, { useState, useCallback } from 'react';

export default function AITestComponent() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [languageModelAvailable, setLanguageModelAvailable] = useState<boolean | null>(null);

  const addResult = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTestResults(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`AITest: ${message}`);
  }, []);

  const testLanguageModelAvailability = useCallback(async () => {
    setIsLoading(true);
    setTestResults([]);
    
    try {
      addResult('Starting LanguageModel availability test...');
      
      // Check if LanguageModel exists on window
      if (!('LanguageModel' in window)) {
        addResult('❌ window.LanguageModel is not available');
        addResult('Make sure you are using Chrome Canary with flags enabled');
        setLanguageModelAvailable(false);
        return;
      }
      
      addResult('✅ window.LanguageModel exists');
      const LanguageModel = (window as any).LanguageModel;
      
      // Check availability
      addResult('Checking availability...');
      const availability = await LanguageModel.availability();
      addResult(`Availability status: ${availability}`);
      
      if (availability === 'available') {
        addResult('✅ LanguageModel is available');
        setLanguageModelAvailable(true);
        
        // Try to create a session
        addResult('Attempting to create LanguageModel session...');
        const session = await LanguageModel.create({
          systemPrompt: 'You are a helpful assistant for testing purposes.',
          temperature: 0.5,
          topK: 1,
        });
        
        addResult('✅ LanguageModel session created successfully');
        
        // Test a simple prompt
        addResult('Testing simple prompt...');
        const testPrompt = 'Say hello and confirm you are working. Respond with just: "Hello, I am working correctly."';
        const response = await session.prompt(testPrompt);
        
        addResult('Raw response received:');
        addResult(JSON.stringify(response, null, 2));
        
        // Extract text from response
        let extractedText = '';
        if (typeof response === 'string') {
          extractedText = response;
        } else if (response?.output?.[0]?.content?.[0]?.text) {
          extractedText = response.output[0].content[0].text;
        } else {
          extractedText = 'Could not extract text from response';
        }
        
        addResult(`Extracted text: "${extractedText}"`);
        addResult('✅ LanguageModel test completed successfully');
        
        // Clean up
        if (session.destroy) {
          session.destroy();
          addResult('Session destroyed');
        }
        
      } else {
        addResult(`❌ LanguageModel not available: ${availability}`);
        setLanguageModelAvailable(false);
        
        switch (availability) {
          case 'after-download':
            addResult('💡 The model needs to be downloaded. Visit chrome://components/ and update "Optimization Guide On Device Model"');
            break;
          case 'no':
            addResult('💡 LanguageModel is not supported on this device/browser');
            break;
          default:
            addResult('💡 Unknown availability status');
        }
      }
      
    } catch (error) {
      addResult(`❌ Error during test: ${error}`);
      console.error('LanguageModel test error:', error);
      setLanguageModelAvailable(false);
    } finally {
      setIsLoading(false);
    }
  }, [addResult]);

  const testInvoiceExtraction = useCallback(async () => {
    if (!languageModelAvailable) {
      addResult('❌ Cannot test invoice extraction - LanguageModel not available');
      return;
    }
    
    setIsLoading(true);
    
    try {
      addResult('Testing invoice extraction with sample data...');
      
      const LanguageModel = (window as any).LanguageModel;
      const session = await LanguageModel.create({
        systemPrompt: `Extract invoice data and return JSON with fields: merchantName, date, total, items array. Only return valid JSON.`,
        temperature: 0.1,
        topK: 1,
      });
      
      const sampleInvoiceText = `
DEMO STORE
123 Main St, City, ST 12345
Invoice #: 001
Date: 2024-01-15

1x Coffee         $4.50
2x Donut          $3.00
Tax:              $0.60
Total:            $8.10
      `;
      
      const prompt = `Extract invoice data from this text and return as JSON:

${sampleInvoiceText}

Return only the JSON object with merchantName, date, total, and items fields.`;

      addResult('Sending extraction prompt...');
      const response = await session.prompt(prompt);
      
      addResult('Raw extraction response:');
      addResult(JSON.stringify(response, null, 2));
      
      // Extract and parse response
      let extractedText = '';
      if (typeof response === 'string') {
        extractedText = response;
      } else if (response?.output?.[0]?.content?.[0]?.text) {
        extractedText = response.output[0].content[0].text;
      }
      
      addResult(`Extracted response text: ${extractedText}`);
      
      // Try to parse as JSON
      try {
        const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsedData = JSON.parse(jsonMatch[0]);
          addResult('✅ Successfully parsed invoice data:');
          addResult(JSON.stringify(parsedData, null, 2));
        } else {
          addResult('❌ No JSON found in response');
        }
      } catch (parseError) {
        addResult(`❌ Failed to parse JSON: ${parseError}`);
      }
      
      if (session.destroy) {
        session.destroy();
      }
      
    } catch (error) {
      addResult(`❌ Invoice extraction test failed: ${error}`);
      console.error('Invoice extraction test error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [languageModelAvailable, addResult]);

  const clearResults = useCallback(() => {
    setTestResults([]);
  }, []);

  return (
    <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          🧪 LanguageModel Debug Console
        </h3>
        <div className="flex gap-2">
          <button
            onClick={testLanguageModelAvailability}
            disabled={isLoading}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading ? 'Testing...' : 'Test Availability'}
          </button>
          <button
            onClick={testInvoiceExtraction}
            disabled={isLoading || !languageModelAvailable}
            className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            Test Extraction
          </button>
          <button
            onClick={clearResults}
            className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Clear
          </button>
        </div>
      </div>
      
      <div className="bg-black text-green-400 p-4 rounded font-mono text-sm max-h-96 overflow-y-auto">
        {testResults.length === 0 ? (
          <div className="text-gray-500">Click "Test Availability" to start debugging...</div>
        ) : (
          testResults.map((result, index) => (
            <div key={index} className="mb-1 whitespace-pre-wrap break-words">
              {result}
            </div>
          ))
        )}
      </div>
      
      <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
        <p><strong>Current Status:</strong></p>
        <ul className="list-disc ml-5 space-y-1">
          <li>LanguageModel Available: {languageModelAvailable === null ? 'Unknown' : languageModelAvailable ? '✅ Yes' : '❌ No'}</li>
          <li>Browser: {navigator.userAgent.includes('Chrome') ? 'Chrome-based' : 'Other'}</li>
          <li>Window.LanguageModel: {'LanguageModel' in window ? '✅ Present' : '❌ Missing'}</li>
        </ul>
      </div>
    </div>
  );
}
