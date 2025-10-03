export interface InvoiceItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  category?: string;
}

export interface InvoiceAddress {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  full?: string;
}

export interface Invoice {
  id: string;
  merchantName: string;
  merchantAddress?: InvoiceAddress;
  invoiceNumber?: string;
  date: string;
  time?: string;
  items: InvoiceItem[];
  subtotal?: number;
  tax?: number;
  total: number;
  currency?: string;
  paymentMethod?: string;
  agentName?: string;
  terms?: string;
  termsDays?: number;
  phoneNumber?: string;
  email?: string;
  website?: string;
  notes?: string;
  imageUrl?: string;
  extractedAt: string;
  confidence?: number;
  rawText?: string;
}

export interface InvoiceExtractionResult {
  invoice: Partial<Invoice>;
  confidence: number;
  rawText: string;
  processingTime: number;
  errors?: string[];
}

export interface DatabaseInvoice extends Invoice {
  createdAt: string;
  updatedAt: string;
  processingTime?: number;
}

export interface AIExtractionRequest {
  imageData: string;
  imageType: string;
  extractionPrompt: string;
}

export interface AIExtractionResponse {
  success: boolean;
  data?: InvoiceExtractionResult;
  error?: string;
}

export interface LanguageModelResponse {
  output?: Array<{
    content?: Array<{
      text?: string;
    }>;
  }>;
}

export interface LanguageModelSession {
  prompt: (text: string, options?: {
    responseConstraint?: any;
  }) => Promise<LanguageModelResponse | string>;
  destroy?: () => void;
}

export interface LanguageModel {
  availability: () => Promise<string>;
  create: (options?: {
    systemPrompt?: string;
    temperature?: number;
  }) => Promise<LanguageModelSession>;
}

export interface DragDropFile {
  file: File;
  preview: string;
  id: string;
}

export interface ProcessingStatus {
  status: 'idle' | 'processing' | 'completed' | 'error';
  message?: string;
  progress?: number;
}

export interface InvoiceStats {
  totalInvoices: number;
  totalAmount: number;
  averageAmount: number;
  topMerchants: Array<{
    name: string;
    count: number;
    totalAmount: number;
  }>;
  monthlySpending: Array<{
    month: string;
    amount: number;
  }>;
}

// Chrome LanguageModel availability check
declare global {
  interface Window {
    LanguageModel?: LanguageModel;
  }
}

export type InvoiceFilterType = 'all' | 'recent' | 'high-value' | 'merchant';

export interface InvoiceFilters {
  type: InvoiceFilterType;
  dateRange?: {
    start: string;
    end: string;
  };
  merchant?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface InvoiceFilterState {
  searchQuery: string;
  storeName: string;
  category: string;
  city: string;
  invoiceNumber: string;
  dateRange: {
    start: string;
    end: string;
  };
  amountRange: {
    min: string;
    max: string;
  };
  paymentMethod: string;
  agentName: string;
  sortBy: 'date' | 'merchant' | 'total' | 'invoiceNumber';
  sortOrder: 'asc' | 'desc';
}
