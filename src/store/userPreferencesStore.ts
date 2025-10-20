import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Currency = 'USD' | 'PHP';
export type InvoiceLayout = 'top-bottom' | 'bottom-top' | 'left-right' | 'right-left';
export type DateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';

interface UserPreferencesState {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  invoiceLayout: InvoiceLayout;
  setInvoiceLayout: (layout: InvoiceLayout) => void;
  autoSyncEnabled: boolean;
  setAutoSyncEnabled: (enabled: boolean) => void;
  showCurrencyInReports: boolean;
  setShowCurrencyInReports: (enabled: boolean) => void;
  reportDateFormat: DateFormat;
  setReportDateFormat: (format: DateFormat) => void;
  // Removed: usePersonalGoogleAccount - now always uses Google account
}

export const useUserPreferencesStore = create<UserPreferencesState>()(
  persist(
    (set) => ({
      currency: 'PHP',
      setCurrency: (currency) => set({ currency }),
      invoiceLayout: 'left-right',
      setInvoiceLayout: (layout) => set({ invoiceLayout: layout }),
      autoSyncEnabled: true, // Enabled by default
      setAutoSyncEnabled: (enabled) => set({ autoSyncEnabled: enabled }),
      showCurrencyInReports: false, // No currency symbol by default
      setShowCurrencyInReports: (enabled) => set({ showCurrencyInReports: enabled }),
      reportDateFormat: 'MM/DD/YYYY', // Default to US format
      setReportDateFormat: (format) => set({ reportDateFormat: format }),
      // Removed: usePersonalGoogleAccount - now always uses Google account
    }),
    {
      name: 'ledgee-user-preferences',
    }
  )
);

