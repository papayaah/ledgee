import { create } from 'zustand';
import { DragDropFile } from '@/types/invoice';
import { QueueItem, queueDb } from '@/lib/database';

// Helper to convert File to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

interface InvoiceQueueStore {
  queue: QueueItem[];
  isProcessing: boolean;
  initialized: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  addToQueue: (files: DragDropFile[]) => Promise<void>;
  removeFromQueue: (id: string) => Promise<void>;
  clearQueue: () => Promise<void>;
  clearCompleted: () => Promise<void>;
  updateQueueItem: (id: string, updates: Partial<QueueItem>) => Promise<void>;
  setIsProcessing: (isProcessing: boolean) => void;
  
  // Computed
  getNextPending: () => QueueItem | null;
  pendingCount: () => number;
  processingCount: () => number;
  completedCount: () => number;
  failedCount: () => number;
  totalCount: () => number;
}

export const useInvoiceQueueStore = create<InvoiceQueueStore>((set, get) => ({
  queue: [],
  isProcessing: false,
  initialized: false,
  
  initialize: async () => {
    if (get().initialized) return;
    
    try {
      const queue = await queueDb.getQueue();
      
      // Reset any 'processing' items back to 'pending' in case of page refresh during processing
      const restoredQueue = queue.map(item => {
        if (item.status === 'processing') {
          return { ...item, status: 'pending' as const, startedAt: undefined };
        }
        return item;
      });
      
      // Update IndexedDB with restored queue
      if (restoredQueue.some((item, idx) => item.status !== queue[idx].status)) {
        await Promise.all(
          restoredQueue.map(item => queueDb.updateQueueItem(item.id, item))
        );
      }
      
      set({ queue: restoredQueue, initialized: true });
    } catch (error) {
      console.error('Failed to initialize queue from IndexedDB:', error);
      set({ initialized: true });
    }
  },
  
  addToQueue: async (files: DragDropFile[]) => {
    console.log('📋 [QueueStore] addToQueue called with', files.length, 'files');
    try {
      console.log('📋 [QueueStore] Converting files to queue items...');
      const newItems: QueueItem[] = await Promise.all(
        files.map(async (file, index) => {
          console.log(`📋 [QueueStore] Processing file ${index + 1}/${files.length}:`, file.file.name);
          console.log(`📋 [QueueStore] Converting file to base64...`);
          const base64Data = await fileToBase64(file.file);
          console.log(`✅ [QueueStore] Base64 conversion complete for ${file.file.name}, length:`, base64Data.length);
          
          return {
            id: file.id,
            fileName: file.file.name,
            fileType: file.file.type,
            imageData: base64Data,
            status: 'pending' as const,
            addedAt: Date.now(),
          };
        })
      );
      
      console.log('✅ [QueueStore] All files converted to queue items:', newItems.length);
      console.log('📋 [QueueStore] Queue items:', newItems.map(item => ({
        id: item.id,
        fileName: item.fileName,
        status: item.status,
        imageDataLength: item.imageData.length
      })));
      
      // Save to IndexedDB
      console.log('💾 [QueueStore] Saving to IndexedDB...');
      await queueDb.addMultipleToQueue(newItems);
      console.log('✅ [QueueStore] Saved to IndexedDB');
      
      // Update state
      console.log('📋 [QueueStore] Updating store state...');
      set(state => ({
        queue: [...state.queue, ...newItems]
      }));
      console.log('✅ [QueueStore] Store state updated, new queue length:', get().queue.length);
    } catch (error) {
      console.error('❌ [QueueStore] Failed to add items to queue:', error);
    }
  },
  
  removeFromQueue: async (id: string) => {
    try {
      await queueDb.removeFromQueue(id);
      set(state => ({
        queue: state.queue.filter(item => item.id !== id)
      }));
    } catch (error) {
      console.error('Failed to remove item from queue:', error);
    }
  },
  
  clearQueue: async () => {
    try {
      await queueDb.clearQueue();
      set({ queue: [], isProcessing: false });
    } catch (error) {
      console.error('Failed to clear queue:', error);
    }
  },
  
  clearCompleted: async () => {
    try {
      await queueDb.clearCompleted();
      const queue = await queueDb.getQueue();
      set({ queue });
    } catch (error) {
      console.error('Failed to clear completed items:', error);
    }
  },
  
  updateQueueItem: async (id: string, updates: Partial<QueueItem>) => {
    try {
      await queueDb.updateQueueItem(id, updates);
      set(state => ({
        queue: state.queue.map(item =>
          item.id === id ? { ...item, ...updates } : item
        )
      }));
    } catch (error) {
      console.error('Failed to update queue item:', error);
    }
  },
  
  setIsProcessing: (isProcessing: boolean) => {
    set({ isProcessing });
  },
  
  // Computed getters
  getNextPending: () => {
    const pendingItems = get().queue.filter(item => item.status === 'pending');
    return pendingItems.length > 0 ? pendingItems[0] : null;
  },
  pendingCount: () => get().queue.filter(item => item.status === 'pending').length,
  processingCount: () => get().queue.filter(item => item.status === 'processing').length,
  completedCount: () => get().queue.filter(item => item.status === 'completed').length,
  failedCount: () => get().queue.filter(item => item.status === 'failed').length,
  totalCount: () => get().queue.length,
}));

