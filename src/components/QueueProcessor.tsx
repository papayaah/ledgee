'use client';

import { useEffect, useRef, useState } from 'react';
import { useInvoiceQueueStore } from '@/store/invoiceQueueStore';
import { useAIProvider } from '@/contexts/AIProviderContext';
import { aiExtractor } from '@/lib/ai-extraction';

/**
 * Global queue processor that runs in the background
 * Extracts invoice data from queue items (does NOT auto-save to database)
 * User manually saves from the form after reviewing extracted data
 */
export default function QueueProcessor() {
  const { queue, updateQueueItem, initialize } = useInvoiceQueueStore();
  const { useOnlineGemini, geminiApiKey } = useAIProvider();
  const processingRef = useRef(false);
  const [aiInitialized, setAiInitialized] = useState(false);
  const [forceProcess, setForceProcess] = useState(0);

  // Initialize queue and AI on mount
  useEffect(() => {
    const init = async () => {
      await initialize();
      
      // Initialize AI extractor
      try {
        await aiExtractor.initialize();
        setAiInitialized(true);
        console.log('QueueProcessor: AI initialized');
      } catch (error) {
        console.error('QueueProcessor: Failed to initialize AI:', error);
      }
    };
    
    init();
  }, [initialize]);

  // Re-initialize AI when switching providers
  useEffect(() => {
    const reinitAI = async () => {
      try {
        console.log('🔄 [QueueProcessor] Setting AI provider:', useOnlineGemini ? 'Online Gemini' : 'Chrome AI');
        // Set the provider with API key if using Online Gemini
        aiExtractor.setProvider(useOnlineGemini, useOnlineGemini ? geminiApiKey : undefined);
        console.log('✅ [QueueProcessor] Provider set, now initializing...');
        
        await aiExtractor.initialize();
        setAiInitialized(true);
        console.log('✅ [QueueProcessor] AI re-initialized for', useOnlineGemini ? 'Online Gemini' : 'Chrome AI');
      } catch (error) {
        console.error('❌ [QueueProcessor] Failed to re-initialize AI:', error);
        setAiInitialized(false);
      }
    };
    
    reinitAI();
  }, [useOnlineGemini, geminiApiKey]);

  // Resume processing when tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('QueueProcessor: Tab became visible, resuming processing...');
        // Force re-process by triggering effect
        setForceProcess(prev => prev + 1);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Periodic check to ensure processing continues (backup mechanism)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!processingRef.current && aiInitialized) {
        const pendingCount = queue.filter(item => item.status === 'pending').length;
        if (pendingCount > 0) {
          console.log('QueueProcessor: Periodic check found pending items, triggering process...');
          setForceProcess(prev => prev + 1);
        }
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [queue, aiInitialized]);

  // Queue processor - extracts data only (does NOT save to database)
  useEffect(() => {
    const processQueue = async () => {
      // Don't process if AI is not initialized
      if (!aiInitialized) {
        console.log('QueueProcessor: Waiting for AI initialization...');
        return;
      }
      
      // Prevent concurrent processing
      if (processingRef.current) return;
      
      const pendingItems = queue.filter(item => item.status === 'pending');
      if (pendingItems.length === 0) {
        return;
      }

      const item = pendingItems[0];
      processingRef.current = true;

      try {
        console.log('🔄 [QueueProcessor] Starting to extract item:', {
          id: item.id,
          fileName: item.fileName,
          status: item.status
        });
        
        // Update item to processing
        await updateQueueItem(item.id, { 
          status: 'processing',
          startedAt: Date.now()
        });
        console.log('✅ [QueueProcessor] Item status updated to processing');

        // Convert base64 to File for processing
        const base64Response = await fetch(item.imageData);
        const blob = await base64Response.blob();
        const file = new File([blob], item.fileName, { type: item.fileType });

        console.log('🤖 [QueueProcessor] Calling aiExtractor.extractFromImage...');
        const result = await aiExtractor.extractFromImage(file);
        console.log('✅ [QueueProcessor] Extraction completed:', {
          hasInvoice: !!result.invoice
        });
        
        if (result.invoice) {
          // Update item to completed with extracted data
          // User will manually save from the form
          console.log('✅ [QueueProcessor] Marking queue item as completed (extracted)...');
          await updateQueueItem(item.id, { 
            status: 'completed',
            extractedData: result.invoice,
            completedAt: Date.now()
          });
          console.log('✅ [QueueProcessor] Queue item marked as completed');
        } else {
          console.error('❌ [QueueProcessor] No invoice data in result');
          await updateQueueItem(item.id, { 
            status: 'failed',
            error: 'Failed to extract invoice data',
            completedAt: Date.now()
          });
        }
      } catch (error) {
        console.error('❌ [QueueProcessor] Error processing file', item.fileName, error);
        await updateQueueItem(item.id, { 
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          completedAt: Date.now()
        });
      } finally {
        processingRef.current = false;
        console.log('🏁 [QueueProcessor] Processing finished for item:', item.id);
      }
    };

    processQueue();
  }, [queue, updateQueueItem, aiInitialized, forceProcess]);

  // This component doesn't render anything
  return null;
}

