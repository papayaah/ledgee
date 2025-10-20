import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { checkChromeAIAvailability, ChromeAIStatus } from '@/lib/ai-extraction';

interface AIAvailabilityState {
  isChecked: boolean;
  isAvailable: boolean;
  status: ChromeAIStatus | null;
  lastChecked: number | null;
  
  // Actions
  checkAvailability: () => Promise<void>;
  resetCheck: () => void;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useAIAvailabilityStore = create<AIAvailabilityState>()(
  persist(
    (set, get) => ({
      isChecked: false,
      isAvailable: false,
      status: null,
      lastChecked: null,
      
      checkAvailability: async () => {
        const state = get();
        const now = Date.now();
        
        // Check if we have a recent cached result (within 5 minutes)
        if (
          state.isChecked && 
          state.lastChecked && 
          now - state.lastChecked < CACHE_DURATION
        ) {
          console.log('[AIAvailability] Using cached result');
          return;
        }
        
        console.log('[AIAvailability] Checking Chrome AI availability...');
        try {
          const status = await checkChromeAIAvailability();
          console.log('[AIAvailability] Result:', status);
          
          set({
            isChecked: true,
            isAvailable: status.available,
            status,
            lastChecked: now
          });
        } catch (error) {
          console.error('[AIAvailability] Check failed:', error);
          set({
            isChecked: true,
            isAvailable: false,
            status: {
              available: false,
              status: 'Error checking availability',
              promptApiAvailable: false,
              languageModelAvailable: false,
              instructions: 'Failed to check Chrome AI availability'
            },
            lastChecked: now
          });
        }
      },
      
      resetCheck: () => {
        set({
          isChecked: false,
          isAvailable: false,
          status: null,
          lastChecked: null
        });
      }
    }),
    {
      name: 'ledgee-ai-availability',
      // Only persist the check results, not the full status object
      partialize: (state) => ({
        isChecked: state.isChecked,
        isAvailable: state.isAvailable,
        lastChecked: state.lastChecked,
        status: state.status
      })
    }
  )
);

