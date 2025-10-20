'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ChromeAIStatus } from '@/lib/ai-extraction';
import { DatabaseInvoice } from '@/types/invoice';
import InvoiceDetails from './InvoiceDetails';
import { useAppStateStore } from '@/store/appStateStore';
import { useAIProvider } from '@/contexts/AIProviderContext';
import { useAIAvailabilityStore } from '@/store/aiAvailabilityStore';
import { 
  MdCheckCircle, 
  MdDownload, 
  MdRefresh, 
  MdError, 
  MdGetApp,
  MdLightbulb,
  MdWarning,
  MdSettings,
  MdPlayArrow,
  MdRestartAlt,
  MdCheckCircle as MdApprove,
  MdPerson,
  MdFilterList,
  MdSearch
} from 'react-icons/md';

interface AIStatusIndicatorProps {
  onStatusChange?: (status: ChromeAIStatus) => void;
  onDemoStateChange?: (state: 'idle' | 'analyzing' | 'complete' | 'listing') => void;
}

type ModelAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable';

// Mock invoice data for demo
  const DEMO_INVOICE: DatabaseInvoice = {
    id: 'demo-invoice-1',
    storeName: 'Grand Auto Parts',
    merchantName: 'Auto Parts Trading',
    date: '2025-09-27',
    total: 10445.00,
    currency: 'PHP',
    invoiceNumber: '14591',
    status: 'review',
    agentName: 'Maria',
    terms: '120 DAYS',
    merchantAddress: {
      street: 'Commonwealth',
      city: 'Quezon City',
      state: 'NCR',
      zipCode: '1100',
      country: 'Philippines'
    },
    phoneNumber: '8534-5483; 8942-9107',
    email: 'shawmdsg@yahoo.com',
    website: '',
    subtotal: 9252.00,
    tax: 1193.00,
    items: [
      {
        id: '1',
        name: '156 CORO EPOXY',
        description: '156 CORO EPOXY',
        quantity: 44,
        unitPrice: 76.00,
        totalPrice: 3648.00
      },
      {
        id: '2',
        name: '47201-08020 ® BMA',
        description: '47201-08020 ® BMA',
        quantity: 1,
        unitPrice: 1320.00,
        totalPrice: 1320.00
      },
      {
        id: '3',
        name: '41201-52370A EMA',
        description: '41201-52370A EMA',
        quantity: 1,
        unitPrice: 1450.00,
        totalPrice: 1450.00
      },
      {
        id: '4',
        name: 'SC-80353R WHEEL CUP',
        description: 'SC-80353R WHEEL CUP',
        quantity: 50,
        unitPrice: 38.00,
        totalPrice: 1900.00
      },
      {
        id: '5',
        name: 'F-193 FUEL FILTER',
        description: 'F-193 FUEL FILTER',
        quantity: 6,
        unitPrice: 227.00,
        totalPrice: 1360.00
      },
      {
        id: '6',
        name: 'C-111 OIL FILTER',
        description: 'C-111 OIL FILTER',
        quantity: 5,
        unitPrice: 149.00,
        totalPrice: 745.00
      }
    ],
    imageData: '/samples/invoice2.jpeg',
    extractedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

export default function AIStatusIndicator({ onStatusChange, onDemoStateChange }: AIStatusIndicatorProps) {
  const { setIsDemoActive } = useAppStateStore();
  const { useOnlineGemini, setUseOnlineGemini } = useAIProvider();
  const [aiStatus, setAiStatus] = useState<ChromeAIStatus>({
    available: false,
    status: 'Checking...',
    promptApiAvailable: false,
    languageModelAvailable: false,
  });
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [modelAvailability, setModelAvailability] = useState<ModelAvailability | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [sessionCreationTriggered, setSessionCreationTriggered] = useState(false);
  const [demoState, setDemoState] = useState<'idle' | 'analyzing' | 'complete' | 'listing'>('idle');

  const { checkAvailability: checkStoreAvailability, status: storeStatus } = useAIAvailabilityStore();

  const checkStatus = useCallback(async () => {
    setIsChecking(true);
    try {
      await checkStoreAvailability();
      if (storeStatus) {
        setAiStatus(storeStatus);
        onStatusChange?.(storeStatus);
      }
      setLastChecked(new Date());
      
      // Check LanguageModel availability if available
      if ('LanguageModel' in window) {
        try {
          const LanguageModel = (window as any).LanguageModel;
          const availability = await LanguageModel.availability({
            expectedInputs: [{ type: 'text', languages: ['en'] }],
            expectedOutputs: [{ type: 'text', languages: ['en'] }],
          });
          setModelAvailability(availability);
          console.log(`LanguageModel is ${availability}.`);
        } catch (error) {
          console.error('Failed to check LanguageModel availability:', error);
          setModelAvailability('unavailable');
        }
      } else {
        setModelAvailability('unavailable');
      }
    } catch (error) {
      console.error('Failed to check AI status:', error);
    } finally {
      setIsChecking(false);
    }
  }, [onStatusChange]);

  // Initial check
  useEffect(() => {
    checkStatus();
  }, [checkStatus, checkStoreAvailability]);

  // Reset demo state when component unmounts or when demo is not active
  useEffect(() => {
    return () => {
      // Reset demo state when component unmounts
      setIsDemoActive(false);
    };
  }, [setIsDemoActive]);

  // Reset demo state when demo is not in progress
  useEffect(() => {
    if (demoState === 'idle') {
      setIsDemoActive(false);
    }
  }, [demoState, setIsDemoActive]);

  // Auto-refresh every 30 seconds if not available
  useEffect(() => {
    if (aiStatus.available) return;

    const interval = setInterval(() => {
      checkStatus();
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [aiStatus.available, checkStatus]);

  const createSession = async (options = {}) => {
    if (sessionCreationTriggered) {
      console.log('Session creation already in progress, skipping...');
      return;
    }

    console.log('Starting session creation...');
    setDownloadProgress(0);
    setDownloadError(null);
    setSessionCreationTriggered(true);

    try {
      if (!('LanguageModel' in window)) {
        throw new Error('LanguageModel is not supported.');
      }

      const LanguageModel = (window as any).LanguageModel;
      const availability = await LanguageModel.availability({
        expectedInputs: [{ type: 'text', languages: ['en'] }],
        expectedOutputs: [{ type: 'text', languages: ['en'] }],
      });
      
      console.log(`LanguageModel availability: ${availability}`);
      
      if (availability === 'unavailable') {
        throw new Error('LanguageModel is not available on this device.');
      }

      let modelNewlyDownloaded = false;
      if (availability !== 'available') {
        modelNewlyDownloaded = true;
        setIsDownloading(true);
        console.log('Model needs to be downloaded, starting download...');
      } else {
        console.log('Model is already available, creating session directly...');
      }

      // Add timeout for session creation
      const sessionPromise = LanguageModel.create({
        monitor(m: any) {
          m.addEventListener('downloadprogress', (e: any) => {
            const progress = Math.round(e.loaded * 100);
            setDownloadProgress(progress);
            console.log(`AI Model Download Progress: ${progress}%`);
            
            if (modelNewlyDownloaded && e.loaded === 1) {
              // The model was newly downloaded and needs to be extracted
              // and loaded into memory, so show the indeterminate state.
              console.log('Download complete, now extracting and loading...');
              setIsExtracting(true);
              setDownloadProgress(100);
            }
          });
        },
        expectedInputs: [{ type: 'text', languages: ['en'] }],
        expectedOutputs: [{ type: 'text', languages: ['en'] }],
        ...options,
      });

      // Add timeout to prevent infinite waiting
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Session creation timed out after 10 minutes'));
        }, 10 * 60 * 1000); // 10 minutes timeout
      });

      const llmSession = await Promise.race([sessionPromise, timeoutPromise]);

      console.log('Session created successfully!');
      setSessionCreationTriggered(false);
      setIsDownloading(false);
      setIsExtracting(false);
      
      // Test the session to make sure it's working
      try {
        await llmSession.prompt('Hello');
        console.log('Session test successful');
      } catch (testError) {
        console.warn('Session test failed:', testError);
        // Don't throw here, session might still be usable
      }
      
      // Update status after successful session creation
      setTimeout(() => {
        checkStatus();
      }, 1000);
      
      return llmSession;
    } catch (error) {
      console.error('Session creation failed:', error);
      setDownloadError(error instanceof Error ? error.message : 'Session creation failed');
      setIsDownloading(false);
      setIsExtracting(false);
      setSessionCreationTriggered(false);
      
      // Don't throw the error, just log it and let user retry
      return null;
    }
  };


  const getStatusColor = () => {
    if (modelAvailability === 'available') return 'text-green-600';
    if (modelAvailability === 'downloading' || isDownloading || isExtracting) return 'text-yellow-600';
    if (modelAvailability === 'downloadable') return 'text-blue-600';
    return 'text-red-600';
  };

  const getStatusIcon = () => {
    if (modelAvailability === 'available') return <MdCheckCircle className="text-green-600" size={24} />;
    if (modelAvailability === 'downloading' || isDownloading) return <MdDownload className="text-yellow-600" size={24} />;
    if (isExtracting) return <MdRefresh className="text-yellow-600 animate-spin" size={24} />;
    if (modelAvailability === 'downloadable') return <MdGetApp className="text-blue-600" size={24} />;
    return <MdError className="text-red-600" size={24} />;
  };

  const getStatusMessage = () => {
    if (modelAvailability === 'available') {
      return 'AI Model Ready';
    }
    if (modelAvailability === 'downloading' || isDownloading) {
      return 'Downloading AI Model...';
    }
    if (isExtracting) {
      return 'Loading AI Model...';
    }
    if (modelAvailability === 'downloadable') {
      return 'AI Model Available for Download';
    }
    if (modelAvailability === 'unavailable') {
      return 'AI Model Not Available';
    }
    return aiStatus.status;
  };

  const getHelpfulMessage = () => {
    if (modelAvailability === 'available') {
      return 'AI is ready! You can now upload invoice images.';
    }
    
    if (modelAvailability === 'downloading' || isDownloading) {
      return 'Chrome is downloading the AI model. This may take 5-15 minutes. Keep this tab open and wait.';
    }
    
    if (isExtracting) {
      return 'The model has been downloaded and is now being extracted and loaded into memory. This should complete shortly.';
    }
    
    if (modelAvailability === 'downloadable') {
      return 'The AI model is available for download. Click "Start Download" to begin.';
    }
    
    if (modelAvailability === 'unavailable') {
      return 'Chrome AI is not enabled on this device. Please follow the setup instructions below to enable the required features.';
    }
    
    return 'Chrome AI setup is required. Check the instructions below.';
  };

  const getEstimatedTime = () => {
    if (modelAvailability === 'downloading' || isDownloading) {
      return 'Estimated time: 5-15 minutes (varies by internet speed)';
    }
    if (isExtracting) {
      return 'Estimated time: 30 seconds - 2 minutes';
    }
    return null;
  };

  const handleDemoClick = () => {
    setDemoState('analyzing');
    setIsDemoActive(true);
    onDemoStateChange?.('analyzing');
    // Simulate AI processing time
    setTimeout(() => {
      setDemoState('complete');
      onDemoStateChange?.('complete');
    }, 2000);
  };

  const handleDemoReset = () => {
    setDemoState('idle');
    setIsDemoActive(false);
    onDemoStateChange?.('idle');
  };

  const handleDemoApprove = () => {
    setDemoState('listing');
    onDemoStateChange?.('listing');
  };

  return (
    <>
      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
          20%, 40%, 60%, 80% { transform: translateX(2px); }
        }
        @keyframes glow {
          0%, 100% { 
            box-shadow: 0 0 20px rgba(34, 197, 94, 0.5), 0 0 40px rgba(34, 197, 94, 0.3);
          }
          50% { 
            box-shadow: 0 0 30px rgba(34, 197, 94, 0.8), 0 0 60px rgba(34, 197, 94, 0.5);
          }
        }
      `}</style>
      <div className="space-y-6">
      {/* Left-Right Layout: Chrome AI Status | Demo */}
      <div className={`grid grid-cols-1 gap-6 ${demoState === 'idle' ? 'lg:grid-cols-3' : 'lg:grid-cols-1'}`}>
        {/* Left: Chrome AI Status & Setup - Hide when demo is active */}
        {demoState === 'idle' && (
          <div className="space-y-4">
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            {/* AI Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span>{getStatusIcon()}</span>
          <div>
            <h3 className="font-semibold text-foreground text-sm">AI Status</h3>
            <p className={`text-sm ${getStatusColor()}`}>
              {getStatusMessage()}
            </p>
          </div>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={checkStatus}
            disabled={isChecking || isDownloading || isExtracting || sessionCreationTriggered}
            className="text-sm px-3 py-1 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded border border-border transition-colors disabled:opacity-50"
          >
            {isChecking ? 'Checking...' : 'Refresh'}
          </button>
          
          {modelAvailability === 'downloadable' && !isDownloading && !sessionCreationTriggered && (
            <button
              onClick={() => createSession()}
              className="text-sm px-3 py-1 bg-primary text-primary-foreground hover:bg-primary/90 rounded transition-colors"
            >
              Start Download
            </button>
          )}
          
          {downloadError && !isDownloading && !sessionCreationTriggered && (
            <button
              onClick={() => createSession()}
              className="text-sm px-3 py-1 bg-orange-500 text-white hover:bg-orange-600 rounded transition-colors"
            >
              Retry Download
            </button>
          )}
        </div>
      </div>

            {/* Status Message */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {getHelpfulMessage()}
        </p>
        
        {getEstimatedTime() && (
          <p className="text-sm text-yellow-600 bg-yellow-50 dark:bg-yellow-950/20 px-2 py-1 rounded">
            {getEstimatedTime()}
          </p>
        )}
            </div>

            {/* Setup Instructions */}
            <div className="border-t border-border pt-3">
              <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <MdSettings className="w-4 h-4" />
                Enable Chrome AI
              </h4>
              
              <p className="text-sm text-muted-foreground mb-3">
                To use the real AI-powered features, enable these 3 Chrome flags:
              </p>
              
              <div className="space-y-3 text-sm">
                <div className="bg-muted/50 rounded-md p-3 border border-border">
                  <p className="font-semibold text-primary mb-1">STEP 1 - Enable Gemini Nano</p>
                  <div className="bg-background p-2 rounded border text-xs font-mono">
                    chrome://flags/#prompt-api-for-gemini-nano
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Set to: <strong>Enabled</strong></p>
                </div>
                
                <div className="bg-muted/50 rounded-md p-3 border border-border">
                  <p className="font-semibold text-primary mb-1">STEP 2 - Enable Multimodal Input</p>
                  <div className="bg-background p-2 rounded border text-xs font-mono">
                    chrome://flags/#prompt-api-for-gemini-nano-multimodal-input
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Set to: <strong>Enabled</strong></p>
                </div>
                
                <div className="bg-muted/50 rounded-md p-3 border border-border">
                  <p className="font-semibold text-primary mb-1">STEP 3 - Enable On-Device Model</p>
                  <div className="bg-background p-2 rounded border text-xs font-mono">
                    chrome://flags/#optimization-guide-on-device-model
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Set to: <strong>Enabled BypassPerfRequirement</strong></p>
                </div>
              </div>
              
              <div className="bg-muted/50 rounded-md p-3 border border-border mt-3">
                <p className="text-xs text-muted-foreground">
                  After enabling these flags, restart Chrome and reload this page.
                </p>
              </div>
            </div>
            
            {/* Online Gemini Alternative */}
            <div className="border-t border-border pt-3 mt-3">
              <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <MdSettings className="w-4 h-4" />
                Alternative: Use Online Gemini
              </h4>
              
              <div className="bg-muted/50 rounded-md p-3 border border-border">
                <p className="text-sm text-muted-foreground mb-3">
                  Don't want to set up Chrome AI? Use Google's Gemini API instead:
                </p>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useOnlineGemini}
                    onChange={(e) => setUseOnlineGemini(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm">Use Online Gemini (requires API key in Settings)</span>
                </label>
                {useOnlineGemini && (
                  <p className="text-xs text-primary mt-2 bg-primary/10 p-2 rounded">
                    ✅ Online Gemini enabled. Make sure to add your API key in <a href="/settings" className="underline font-medium">Settings</a>.
                  </p>
                )}
              </div>
            </div>
            </div>
          </div>
        )}

        {/* Demo Simulation - Full width when active, 2/3 width when idle */}
        <div className={`space-y-4 ${demoState === 'idle' ? 'lg:col-span-2' : 'lg:col-span-1'}`}>

            {demoState === 'idle' && (
              <div className="space-y-3">
                <button
                  onClick={handleDemoClick}
                  className="w-full group relative overflow-hidden border-2 border-border hover:border-primary transition-all shadow-md hover:shadow-lg"
                >
                  <img 
                    src="/samples/invoice2.jpeg" 
                    alt="Sample Invoice"
                    className="w-full h-auto"
                  />
                  <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-primary-foreground px-6 py-3 font-semibold text-lg shadow-lg flex items-center gap-2">
                      <MdPlayArrow className="w-5 h-5" />
                      Click to Analyze
                    </div>
                  </div>
                </button>
              </div>
            )}

            {demoState === 'analyzing' && (
              <div className="bg-muted/50 border border-border p-8">
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-border rounded-full"></div>
                    <div className="absolute top-0 left-0 w-16 h-16 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-foreground text-lg flex items-center justify-center gap-2">
                      <MdRefresh className="w-5 h-5 animate-spin" />
                      Analyzing Invoice...
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Extracting data from image
                    </p>
            </div>
            </div>
          </div>
        )}

            {demoState === 'complete' && (
              <div className="space-y-3">
                <div className="p-6">
                  {/* Header */}
                  <h2 className="text-2xl font-bold text-foreground mb-6">Invoice Details</h2>
                  
                  {/* Status and Actions Card */}
                  <div className="bg-white rounded-lg p-4 mb-6 border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm text-muted-foreground">Status:</span>
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
                          ⚠ Review
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={handleDemoApprove}
                          className="animate-shake flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-all rounded-lg shadow-lg ring-2 ring-green-400 ring-opacity-50"
                          style={{
                            animation: 'shake 2s infinite, glow 2s infinite',
                            boxShadow: '0 0 20px rgba(34, 197, 94, 0.5), 0 0 40px rgba(34, 197, 94, 0.3)'
                          }}
                        >
                          <MdApprove className="w-4 h-4" />
                          <span>Approve</span>
                        </button>
                        <button className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors rounded-lg">
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Invoice Summary Card */}
                  <div className="bg-white rounded-lg p-6 mb-6 border">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Store</label>
                        <p className="text-lg font-semibold">{DEMO_INVOICE.storeName}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Merchant</label>
                        <p className="text-lg font-semibold">{DEMO_INVOICE.merchantName}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Invoice Number</label>
                        <p className="text-lg font-semibold">{DEMO_INVOICE.invoiceNumber}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Date</label>
                        <p className="text-lg">{new Date(DEMO_INVOICE.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Total Amount</label>
                        <p className="text-lg font-bold text-red-600">₱9,025.00</p>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t">
                      <label className="text-sm font-medium text-muted-foreground">Address</label>
                      <p className="text-sm">
                        {DEMO_INVOICE.merchantAddress ? 
                          `${DEMO_INVOICE.merchantAddress.street}, ${DEMO_INVOICE.merchantAddress.city}, ${DEMO_INVOICE.merchantAddress.state} ${DEMO_INVOICE.merchantAddress.zipCode}, ${DEMO_INVOICE.merchantAddress.country}` :
                          'Address not available'
                        }
                      </p>
                    </div>
                    <div className="mt-4 pt-4 border-t">
                      <label className="text-sm font-medium text-muted-foreground">Agent</label>
                      <div className="flex items-center space-x-2">
                        <span className="text-lg text-primary">{DEMO_INVOICE.agentName}</span>
                        <span className="text-sm text-muted-foreground">• {DEMO_INVOICE.terms}</span>
                      </div>
                    </div>
                  </div>

                  {/* Line Items Card */}
                  <div className="bg-white rounded-lg p-6 border">
                    <h3 className="text-lg font-semibold mb-4">Line Items</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-center p-2 text-sm font-medium">Qty</th>
                            <th className="text-center p-2 text-sm font-medium">Unit</th>
                            <th className="text-left p-2 text-sm font-medium">Description</th>
                            <th className="text-right p-2 text-sm font-medium">Unit Price</th>
                            <th className="text-right p-2 text-sm font-medium">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b">
                            <td className="text-center p-2">48</td>
                            <td className="text-center p-2 text-sm text-muted-foreground">PCS</td>
                            <td className="p-2">
                              <div className="font-medium">156 CORD EPOXY</div>
                            </td>
                            <td className="text-right p-2">₱76.00</td>
                            <td className="text-right p-2 font-medium">₱3,648.00</td>
                          </tr>
                          <tr className="border-b">
                            <td className="text-center p-2">1</td>
                            <td className="text-center p-2 text-sm text-muted-foreground">PC</td>
                            <td className="p-2">
                              <div className="font-medium">47201-0B020Ⓐ BMA</div>
                            </td>
                            <td className="text-right p-2">₱1,320.00</td>
                            <td className="text-right p-2 font-medium">₱1,320.00</td>
                          </tr>
                          <tr className="border-b">
                            <td className="text-center p-2">1</td>
                            <td className="text-center p-2 text-sm text-muted-foreground">PC</td>
                            <td className="p-2">
                              <div className="font-medium">41201-52330Ⓐ BMA</div>
                            </td>
                            <td className="text-right p-2">₱1,450.00</td>
                            <td className="text-right p-2 font-medium">₱1,450.00</td>
                          </tr>
                          <tr className="border-b">
                            <td className="text-center p-2">50</td>
                            <td className="text-center p-2 text-sm text-muted-foreground">PCS</td>
                            <td className="p-2">
                              <div className="font-medium">SC-80353R WHEEL CUP</div>
                            </td>
                            <td className="text-right p-2">₱38.00</td>
                            <td className="text-right p-2 font-medium">₱1,900.00</td>
                          </tr>
                          <tr className="border-b">
                            <td className="text-center p-2">6</td>
                            <td className="text-center p-2 text-sm text-muted-foreground">PCS</td>
                            <td className="p-2">
                              <div className="font-medium">F-190 FUEL FILTER</div>
                            </td>
                            <td className="text-right p-2">₱227.00</td>
                            <td className="text-right p-2 font-medium">₱1,362.00</td>
                          </tr>
                          <tr className="border-b">
                            <td className="text-center p-2">5</td>
                            <td className="text-center p-2 text-sm text-muted-foreground">PCS</td>
                            <td className="p-2">
                              <div className="font-medium">C-111 OIL FILTER</div>
                            </td>
                            <td className="text-right p-2">₱159.00</td>
                            <td className="text-right p-2 font-medium">₱795.00</td>
                          </tr>
                        </tbody>
                        <tfoot className="bg-gray-50">
                          <tr className="text-lg font-bold">
                            <td colSpan={4} className="text-right p-2">Total</td>
                            <td className="text-right p-2 text-red-600">₱9,025.00</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
            </div>
            </div>
          </div>
        )}
        
            {demoState === 'listing' && (
              <div className="bg-background border border-border">
                {/* Demo Invoices Listing Page */}
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
                      <p className="text-muted-foreground">Manage your extracted invoices</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <MdSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <input 
                          type="text" 
                          placeholder="Search invoices..."
                          className="pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Left-Right Layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Invoice Cards */}
                    <div className="lg:col-span-2">
                      <div className="space-y-3">
                        {/* Invoice Card */}
                        <div className="bg-white rounded-lg p-4 border hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <h3 className="font-bold text-gray-900">Auto Parts Trading</h3>
                                  <span className="text-yellow-500">⚠️</span>
                                </div>
                                <div className="flex items-center space-x-2 text-sm text-gray-600">
                                  <span>Sep 27, 2025</span>
                                  <span>•</span>
                                  <span>6 items</span>
                                  <span>•</span>
                                  <div className="flex items-center space-x-1">
                                    <span className="text-red-500">📍</span>
                                    <span>Mandaluyong</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3">
                              <div className="text-right">
                                <div className="text-lg font-bold text-pink-600">₱9,025.00</div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </button>
                                <button className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Stats, Filters, and Agents */}
                    <div className="space-y-4">
                      {/* Status Card */}
                      <div className="bg-white rounded-lg p-4 border">
                        <h3 className="font-bold text-gray-900 mb-3">Status</h3>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-2 bg-yellow-50 rounded">
                            <div className="flex items-center gap-2">
                              <span className="text-yellow-600">⚠️</span>
                              <span className="text-sm font-medium">Review</span>
                            </div>
                            <span className="text-sm font-bold">1</span>
                          </div>
                          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                            <div className="flex items-center gap-2">
                              <span className="text-green-600">✓</span>
                              <span className="text-sm">Approved</span>
                            </div>
                            <span className="text-sm">0</span>
                          </div>
                          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                            <span className="text-sm">All Invoices</span>
                            <span className="text-sm">1</span>
                          </div>
                        </div>
                      </div>

                      {/* Filters Card */}
                      <div className="bg-white rounded-lg p-4 border">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-bold text-gray-900 flex items-center gap-2">
                            <span className="text-red-500">🔽</span>
                            Filters
                            <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">0</span>
                          </h3>
                          <button className="text-sm text-gray-500 flex items-center gap-1">
                            <span>×</span>
                            <span>Clear</span>
                          </button>
                        </div>
                        <div className="relative">
                          <input 
                            type="text" 
                            placeholder="Search across all fields..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <MdSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        </div>
                      </div>

                      {/* Agent Performance Card */}
                      <div className="bg-white rounded-lg p-4 border">
                        <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                          <span className="text-red-500">▲</span>
                          Agent Performance
                        </h3>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-gray-900">Maria</div>
                              <div className="text-sm text-gray-500">1 invoice</div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium text-gray-900">₱10,445.00</div>
                              <div className="text-sm text-gray-500">Avg ₱10,445.00</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Floating Demo Buttons - Positioned to the left of the floating header */}
      {demoState === 'complete' && (
        <div className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-40">
          <button
            onClick={handleDemoReset}
            className="floating-header px-4 py-2 text-sm text-white bg-primary hover:bg-primary/90 transition-colors rounded-2xl font-medium shadow-lg hover:shadow-xl flex items-center gap-2"
          >
            <MdRestartAlt className="w-4 h-4" />
            Try Demo Again
          </button>
        </div>
      )}

      {demoState === 'listing' && (
        <div className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-40">
          <button
            onClick={handleDemoReset}
            className="floating-header px-4 py-2 text-sm text-white bg-primary hover:bg-primary/90 transition-colors rounded-2xl font-medium shadow-lg hover:shadow-xl flex items-center gap-2"
          >
            <MdRestartAlt className="w-4 h-4" />
            Try Demo Again
          </button>
        </div>
      )}
    </div>
    </>
  );
}
