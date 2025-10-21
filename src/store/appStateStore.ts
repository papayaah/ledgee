import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type StatusFilter = 'all' | 'review' | 'approved';

interface AppStateStore {
  // Invoice page state
  selectedStatusFilter: StatusFilter;
  setSelectedStatusFilter: (status: StatusFilter) => void;
  
  isAgentPerformanceExpanded: boolean;
  setIsAgentPerformanceExpanded: (expanded: boolean) => void;
  
  // Floating navigation state
  isNavigationExpanded: boolean;
  setIsNavigationExpanded: (expanded: boolean) => void;
  
  // Demo state
  isDemoActive: boolean;
  setIsDemoActive: (active: boolean) => void;
}

export const useAppStateStore = create<AppStateStore>()(
  persist(
    (set) => ({
      // Invoice page defaults
      selectedStatusFilter: 'review',
      setSelectedStatusFilter: (status) => set({ selectedStatusFilter: status }),
      
      isAgentPerformanceExpanded: false, // Collapsed by default
      setIsAgentPerformanceExpanded: (expanded) => set({ isAgentPerformanceExpanded: expanded }),
      
      // Navigation defaults
      isNavigationExpanded: true, // Expanded by default
      setIsNavigationExpanded: (expanded) => set({ isNavigationExpanded: expanded }),
      
      // Demo defaults
      isDemoActive: false,
      setIsDemoActive: (active) => set({ isDemoActive: active }),
    }),
    {
      name: 'ledgee-app-state',
    }
  )
);

