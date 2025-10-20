'use client';

import React, { useState, useEffect, useCallback } from 'react';
import InvoiceDropzone from '@/components/InvoiceDropzone';
import InvoiceForm from '@/components/InvoiceForm';
import InvoiceQueue from '@/components/InvoiceQueue';
import SampleImages from '@/components/SampleImages';
import { DragDropFile, ProcessingStatus, Invoice, DatabaseInvoice } from '@/types/invoice';
import { aiExtractor } from '@/lib/ai-extraction';
import { useAIProvider } from '@/contexts/AIProviderContext';
import { useInvoiceQueueStore } from '@/store/invoiceQueueStore';
import { useAIAvailabilityStore } from '@/store/aiAvailabilityStore';
import { useRouter } from 'next/navigation';
import { MdChevronLeft, MdChevronRight } from 'react-icons/md';
import Zoom from 'react-medium-image-zoom';
import 'react-medium-image-zoom/dist/styles.css';

export default function AddInvoicePage() {
  const router = useRouter();
  const { useOnlineGemini, geminiApiKey } = useAIProvider();
  const { queue, addToQueue, updateQueueItem, removeFromQueue, initialize } = useInvoiceQueueStore();
  const { isAvailable: aiAvailable, checkAvailability } = useAIAvailabilityStore();
  
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<ProcessingStatus>({ status: 'idle' });
  const [currentQueueIndex, setCurrentQueueIndex] = useState<number>(-1);
  const [extractedData, setExtractedData] = useState<Partial<Invoice> | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  // Check AI availability and initialize queue
  useEffect(() => {
    const initializeAI = async () => {
      // Initialize queue from IndexedDB
      await initialize();
      try {
        // Check availability (will use cache if recent)
        await checkAvailability();
        
        console.log('[AddInvoice] AI Available:', aiAvailable);
        console.log('[AddInvoice] useOnlineGemini:', useOnlineGemini);
        
        // Redirect to setup if no AI is available
        if (!aiAvailable && !useOnlineGemini) {
          console.log('[AddInvoice] No AI available, redirecting to /setup');
          router.push('/setup');
          return;
        }
        
        console.log('[AddInvoice] AI is available, initializing...');
        
        // Initialize the AI extractor with provider settings
        if (useOnlineGemini) {
          if (!geminiApiKey) {
            console.warn('[AddInvoice] Online Gemini enabled but no API key found');
            setLoading(false);
            return;
          }
          
          aiExtractor.setProvider(true, geminiApiKey);
        } else {
          aiExtractor.setProvider(false);
        }
        
        // Initialize the AI extractor
        const initialized = await aiExtractor.initialize();
        
        if (!initialized) {
          console.error('[AddInvoice] Failed to initialize AI extractor');
        }
        
        console.log('[AddInvoice] Initialization complete');
      } catch (error) {
        console.error('Failed to initialize AI:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAI();
  }, [useOnlineGemini, geminiApiKey, router, aiAvailable, checkAvailability, initialize]);

  // Get current invoice from queue
  const currentInvoice = currentQueueIndex >= 0 && currentQueueIndex < queue.length 
    ? queue[currentQueueIndex] 
    : null;

  // Load invoice data at specific index (background processor handles extraction)
  const loadInvoiceAtIndex = useCallback((index: number) => {
    if (index < 0 || index >= queue.length) return;

    const queueItem = queue[index];
    if (!queueItem) return;

    console.log('📦 [AddInvoice] Loading invoice at index', index, ':', queueItem.fileName, '| Status:', queueItem.status);
    
    // Load extracted data if completed
    if (queueItem.status === 'completed' && queueItem.extractedData) {
      console.log('✅ [AddInvoice] Loading extracted data');
      setExtractedData(queueItem.extractedData);
      setProcessing({ status: 'idle' });
      setIsExtracting(false);
      return;
    }

    // Show processing state if being extracted
    if (queueItem.status === 'processing') {
      console.log('🔄 [AddInvoice] Invoice is being extracted in background');
      setExtractedData(null);
      setProcessing({ status: 'processing', message: 'Extracting invoice data...' });
      setIsExtracting(true);
      return;
    }

    // Show error if failed
    if (queueItem.status === 'failed') {
      console.log('❌ [AddInvoice] Invoice extraction failed');
      setExtractedData(null);
      setProcessing({ status: 'error', message: queueItem.error || 'Extraction failed. You can still fill the form manually.' });
      setIsExtracting(false);
      return;
    }

    // Pending - background processor will pick it up
    if (queueItem.status === 'pending') {
      console.log('⏳ [AddInvoice] Invoice pending extraction');
      setExtractedData(null);
      setProcessing({ status: 'processing', message: 'Waiting for extraction...' });
      setIsExtracting(false);
    }
  }, [queue]);

  // Auto-load first invoice when queue first gets items
  useEffect(() => {
    // Only auto-load if we don't have a current index and there are items in the queue
    if (queue.length > 0 && currentQueueIndex === -1) {
      console.log('📦 [AddInvoice] Auto-loading first invoice');
      setCurrentQueueIndex(0);
    }
    // Reset form when queue becomes empty
    if (queue.length === 0 && currentQueueIndex !== -1) {
      console.log('📦 [AddInvoice] Queue cleared, resetting form');
      setCurrentQueueIndex(-1);
      setExtractedData(null);
      setProcessing({ status: 'idle' });
      setIsExtracting(false);
    }
  }, [queue.length, currentQueueIndex]);

  // Load the invoice when the current index changes
  useEffect(() => {
    if (currentQueueIndex >= 0 && currentQueueIndex < queue.length) {
      loadInvoiceAtIndex(currentQueueIndex);
    }
  }, [currentQueueIndex, queue, loadInvoiceAtIndex]); // Watch queue changes to update when extraction completes

  // Navigate to previous invoice
  const handlePrevious = () => {
    if (currentQueueIndex > 0) {
      const newIndex = currentQueueIndex - 1;
      setCurrentQueueIndex(newIndex);
    }
  };

  // Navigate to next invoice
  const handleNext = () => {
    if (currentQueueIndex < queue.length - 1) {
      const newIndex = currentQueueIndex + 1;
      setCurrentQueueIndex(newIndex);
    }
  };

  const handleFilesDropped = useCallback(async (files: DragDropFile[]) => {
    console.log('📦 [AddInvoice] handleFilesDropped called with', files.length, 'files');
    if (!files.length) {
      console.warn('⚠️ [AddInvoice] No files to process');
      return;
    }

    // Check if Online Gemini is selected but no API key
    if (useOnlineGemini && !geminiApiKey) {
      setProcessing({ 
        status: 'error', 
        message: 'Gemini API key required. Please add your API key in Settings.' 
      });
      return;
    }
    
    // Add all files to queue
    console.log('📤 [AddInvoice] Adding files to queue...');
    addToQueue(files);
    console.log('✅ [AddInvoice] Files added to queue');
  }, [addToQueue, useOnlineGemini, geminiApiKey]);

  if (loading) {
    return (
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center min-h-96">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <div>
              <h2 className="text-xl font-semibold">Initializing Ledgee...</h2>
              <p className="text-muted-foreground">Setting up database and checking AI availability</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleSave = (invoice: DatabaseInvoice) => {
    console.log('✅ Invoice saved:', invoice);
    
    // Remove current queue item if processing from queue
    if (currentInvoice) {
      // Remove from queue
      removeFromQueue(currentInvoice.id);
      
      // Clear extracted data for this invoice
      setExtractedData(null);
      setProcessing({ status: 'idle' });
      
      // The queue index will automatically adjust after removal
      // If there are more items, stay at same index (which will be the next item)
      // If no more items, navigate to the saved invoice
      const remainingCount = queue.length - 1; // -1 because we just removed one
      
      if (remainingCount > 0) {
        // Stay at current index (queue will shift, so same index = next item)
        // Small delay to let the queue state update from the removal
        setTimeout(() => {
          // Force reload by re-setting the same index
          setCurrentQueueIndex(-1);
          setTimeout(() => {
            if (currentQueueIndex < queue.length - 1) {
              setCurrentQueueIndex(currentQueueIndex);
            } else {
              // We were at the last item, go to the new last item
              setCurrentQueueIndex(Math.max(0, queue.length - 2));
            }
          }, 50);
        }, 100);
      } else {
        // No more invoices, reset index and navigate
        setCurrentQueueIndex(-1);
        router.push(`/invoices/${invoice.id}`);
      }
    } else {
      // Manual entry - navigate to the saved invoice
      router.push(`/invoices/${invoice.id}`);
    }
  };

  const handleCancel = () => {
    // Only applicable when processing from queue
    if (currentInvoice) {
      // Mark as failed and remove from queue
      removeFromQueue(currentInvoice.id);
      
      // Clear extracted data
      setExtractedData(null);
      setProcessing({ status: 'idle' });
      
      // Move to next if available (index stays same, queue shifts)
      const remainingCount = queue.length - 1;
      if (remainingCount > 0) {
        setTimeout(() => {
          // Force reload
          setCurrentQueueIndex(-1);
          setTimeout(() => {
            if (currentQueueIndex < queue.length - 1) {
              setCurrentQueueIndex(currentQueueIndex);
            } else {
              setCurrentQueueIndex(Math.max(0, queue.length - 2));
            }
          }, 50);
        }, 100);
      } else {
        // No more invoices - completely reset
        setCurrentQueueIndex(-1);
        setExtractedData(null);
        setProcessing({ status: 'idle' });
        setIsExtracting(false);
      }
    } else {
      // Manual entry - just clear the form
      setExtractedData(null);
      setProcessing({ status: 'idle' });
      setIsExtracting(false);
    }
  };

  return (
    <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-full flex flex-col">
      <div className="space-y-8 flex-1">
        {/* Page Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold brand-gradient">
            Add New Invoice
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Fill in the form manually or drop invoice images to auto-extract data
          </p>
        </div>

        {/* API Key Warning */}
        {useOnlineGemini && !geminiApiKey && (
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-yellow-900 mb-2">
                  Gemini API Key Required
                </h3>
                <p className="text-sm text-yellow-800 mb-3">
                  You've selected Online Gemini AI, but no API key has been configured. Please add your API key in Settings to use invoice extraction.
                </p>
                <button
                  onClick={() => router.push('/settings')}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors text-sm font-medium"
                >
                  Go to Settings
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Queue Navigation - Only show when more than 1 invoice */}
        {queue.length > 1 && (
          <div className="flex items-center justify-center gap-4 bg-card border border-border rounded-lg p-4">
            <button
              onClick={handlePrevious}
              disabled={currentQueueIndex <= 0}
              className="p-2 rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Previous invoice"
            >
              <MdChevronLeft className="w-6 h-6" />
            </button>
            
            <div className="text-lg font-semibold">
              {currentQueueIndex + 1} of {queue.length}
            </div>
            
            <button
              onClick={handleNext}
              disabled={currentQueueIndex >= queue.length - 1}
              className="p-2 rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Next invoice"
            >
              <MdChevronRight className="w-6 h-6" />
            </button>
          </div>
        )}

        {/* Main Content */}
        {(aiAvailable || useOnlineGemini) && (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Column - Invoice Form (flexible width) - Always visible */}
            <div className="flex-1 min-w-0 order-2 lg:order-1">
              {/* Error Message */}
              {processing.status === 'error' && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{processing.message}</p>
                  {processing.message?.includes('API key') && (
                    <button
                      onClick={() => router.push('/settings')}
                      className="mt-2 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
                    >
                      Go to Settings
                    </button>
                  )}
                </div>
              )}
              
              <InvoiceForm
                initialData={extractedData || undefined}
                imageData={currentInvoice?.imageData}
                isExtracting={isExtracting}
                onSave={handleSave}
                onCancel={(extractedData || currentInvoice) ? handleCancel : undefined}
              />
            </div>

            {/* Right Column - Dropzone, Queue, and Sample Images (fixed width) */}
            <div className="lg:w-80 xl:w-96 space-y-6 flex-shrink-0 order-1 lg:order-2">
              {/* Image Preview */}
              {currentInvoice && (
                <div className="bg-card border border-border rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-3">Invoice Image</h3>
                  <Zoom>
                    <img
                      src={currentInvoice.imageData}
                      alt="Invoice preview"
                      className="w-full h-auto object-contain cursor-zoom-in"
                    />
                  </Zoom>
                </div>
              )}

              {/* Dropzone */}
              <InvoiceDropzone
                onFilesDropped={handleFilesDropped}
                processing={processing}
                maxFiles={20}
              />

              {/* Queue Display - Below dropzone, above samples */}
              {queue.length > 0 && (
                <InvoiceQueue />
              )}

              {/* Sample Images */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Try Sample Invoices</h3>
                <SampleImages 
                  onImageSelect={async (file) => {
                    console.log('🎯 [AddInvoice] onImageSelect called for sample image:', file.name);
                    const dragDropFile: DragDropFile = {
                      file,
                      preview: URL.createObjectURL(file),
                      id: `sample_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                    };
                    await handleFilesDropped([dragDropFile]);
                  }}
                  onMultipleImagesSelect={async (files) => {
                    console.log('🎯 [AddInvoice] onMultipleImagesSelect called with', files.length, 'files');
                    const dragDropFiles: DragDropFile[] = files.map((file, index) => ({
                      file,
                      preview: URL.createObjectURL(file),
                      id: `sample_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`
                    }));
                    await handleFilesDropped(dragDropFiles);
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}






