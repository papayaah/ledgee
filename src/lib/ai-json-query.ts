"use client";

import { invoiceDb } from './database';
import { DatabaseInvoice } from '@/types/invoice';
import { GeminiAPI } from './gemini-api';

// Schema definition for the LanguageModel to understand our JSON data structure
const JSON_DATA_SCHEMA = `
Invoice data structure (stored as JSON in localStorage):

Each invoice object contains:
- id: string (unique invoice identifier)
- merchantName: string (name of the store/merchant)
- date: string (invoice date in YYYY-MM-DD format)
- time: string (invoice time)
- total: number (total amount paid)
- subtotal: number (subtotal before tax)
- tax: number (tax amount)
- currency: string (currency code, default PHP)
- paymentMethod: string (payment method used)
- invoiceNumber: string (invoice/receipt number)
- phoneNumber: string (merchant phone)
- email: string (merchant email)
- agentName: string (agent name from TERMS/AGENT field)
- terms: string (terms text like "120 DAYS")
- termsDays: number (numeric terms value)
- createdAt: string (when record was created)
- items: array of objects with:
  - id: string
  - name: string
  - description: string
  - quantity: number
  - unitPrice: number
  - totalPrice: number
  - category: string

All data is stored as an array of invoice objects in localStorage.
`;

export class AIJSONQueryEngine {
  private languageModel: any = null;
  private geminiAPI: GeminiAPI | null = null;
  private isInitialized = false;
  private useOnlineGemini = false;

  setProvider(useOnlineGemini: boolean, apiKey?: string) {
    this.useOnlineGemini = useOnlineGemini;
    this.isInitialized = false;
    
    if (useOnlineGemini && apiKey) {
      this.geminiAPI = new GeminiAPI(apiKey);
    } else {
      this.geminiAPI = null;
    }
  }

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      if (this.useOnlineGemini) {
        if (!this.geminiAPI) {
          throw new Error('Gemini API not initialized. Please provide API key.');
        }
        this.isInitialized = true;
        return true;
      }

      if (!('LanguageModel' in window)) {
        console.warn('LanguageModel not available');
        return false;
      }

      const LanguageModel = (window as any).LanguageModel;
      const availability = await LanguageModel.availability();
      
      if (availability !== 'available') {
        console.warn('LanguageModel not available:', availability);
        return false;
      }

      this.languageModel = await LanguageModel.create({
        initialPrompts: [{
          role: 'system',
          content: `You are a data analysis AI for invoice data stored as JSON objects in localStorage. 
          Analyze the provided invoice data and answer questions about it.
          Always provide specific numbers and details when available.
          
          ${JSON_DATA_SCHEMA}`
        }],
        temperature: 0.1,
        topK: 1,
        outputLanguage: 'en'
      });

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize AI JSON query engine:', error);
      return false;
    }
  }

  async queryInvoices(question: string): Promise<{
    success: boolean;
    answer?: string;
    data?: any[];
    error?: string;
  }> {
    try {
      if (!this.isInitialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          throw new Error('LanguageModel is not available');
        }
      }

      // Get all invoices from localStorage
      await invoiceDb.initialize();
      const invoices = await invoiceDb.getAllInvoices();

      if (invoices.length === 0) {
        return {
          success: true,
          answer: "No invoices found in your database. Please upload some invoice images first.",
          data: []
        };
      }

      // Step 1: Extract relevant data first to avoid quota issues
      const relevantData = this.extractRelevantData(invoices, question);
      
      // Step 2: Create a summary of the data for AI analysis
      const dataSummary = this.createDataSummary(invoices);
      
      // Step 3: Analyze the summarized data
      const analysisPrompt = `
        User question: "${question}"
        
        Data summary (${invoices.length} total invoices):
        ${dataSummary}
        
        Relevant data found:
        ${JSON.stringify(relevantData, null, 2)}
        
        Analyze this data and provide a comprehensive answer to the user's question.
        Include specific numbers, merchant names, dates, and amounts where relevant.
        If the question asks for specific data (like "which merchant made the most sales"), 
        provide the exact answer with numbers.
        
        Format your response as a clear, detailed answer that directly addresses the question.
      `;

      let response: string;
      if (this.useOnlineGemini && this.geminiAPI) {
        // Use Gemini API
        const request = {
          contents: [{
            parts: [this.geminiAPI.createTextPart(analysisPrompt)]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
          }
        };
        response = await this.geminiAPI.generateContent(request);
      } else {
        // Use Chrome LanguageModel
        response = await this.languageModel.prompt(analysisPrompt);
      }
      
      const answer = this.extractTextFromResponse(response);

      return {
        success: true,
        answer,
        data: relevantData,
      };

    } catch (error) {
      console.error('Query processing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private createDataSummary(invoices: DatabaseInvoice[]): string {
    
    // Basic stats
    const totalInvoices = invoices.length;
    const totalAmount = invoices.reduce((sum, inv) => sum + inv.total, 0);
    const averageAmount = totalInvoices > 0 ? totalAmount / totalInvoices : 0;
    
    // Merchant summary
    const merchantCounts = invoices.reduce((acc, inv) => {
      acc[inv.merchantName] = (acc[inv.merchantName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topMerchants = Object.entries(merchantCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => `${name} (${count} invoices)`);
    
    // Agent summary
    const agentCounts = invoices.reduce((acc, inv) => {
      if (inv.agentName) {
        acc[inv.agentName] = (acc[inv.agentName] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    
    const topAgents = Object.entries(agentCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => `${name} (${count} invoices)`);
    
    // Date range
    const dates = invoices.map(inv => inv.date).sort();
    const dateRange = dates.length > 0 ? `${dates[0]} to ${dates[dates.length - 1]}` : 'No dates';
    
    // Currency breakdown
    const currencyCounts = invoices.reduce((acc, inv) => {
      const currency = inv.currency || 'PHP';
      acc[currency] = (acc[currency] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const currencies = Object.keys(currencyCounts).join(', ');
    
    return `
- Total invoices: ${totalInvoices}
- Total amount: ${totalAmount.toFixed(2)}
- Average amount: ${averageAmount.toFixed(2)}
- Date range: ${dateRange}
- Currencies: ${currencies}
- Top merchants: ${topMerchants.join(', ')}
- Top agents: ${topAgents.join(', ')}
    `.trim();
  }

  private extractRelevantData(invoices: DatabaseInvoice[], question: string): any[] {
    const lowerQuestion = question.toLowerCase();

    // Merchant analysis
    if (lowerQuestion.includes('merchant') && (lowerQuestion.includes('most') || lowerQuestion.includes('top'))) {
      const merchantTotals = invoices.reduce((acc, inv) => {
        acc[inv.merchantName] = (acc[inv.merchantName] || 0) + inv.total;
        return acc;
      }, {} as Record<string, number>);

      return Object.entries(merchantTotals)
        .map(([merchant, total]) => ({ merchantName: merchant, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
    }

    // Agent analysis
    if (lowerQuestion.includes('agent')) {
      const agentTotals = invoices.reduce((acc, inv) => {
        if (inv.agentName) {
          acc[inv.agentName] = (acc[inv.agentName] || 0) + inv.total;
        }
        return acc;
      }, {} as Record<string, number>);

      return Object.entries(agentTotals)
        .map(([agent, total]) => ({ agentName: agent, total }))
        .sort((a, b) => b.total - a.total);
    }

    // Date filtering
    if (lowerQuestion.includes('august 2023') || lowerQuestion.includes('2023')) {
      const filteredInvoices = invoices.filter(inv => {
        const date = new Date(inv.date);
        return date.getFullYear() === 2023 && date.getMonth() === 7; // August is month 7 (0-indexed)
      });
      return filteredInvoices.map(inv => ({
        merchantName: inv.merchantName,
        date: inv.date,
        total: inv.total,
        agentName: inv.agentName
      }));
    }

    // Monthly analysis
    if (lowerQuestion.includes('month') || lowerQuestion.includes('this month')) {
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      
      const monthlyInvoices = invoices.filter(inv => {
        const date = new Date(inv.date);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      });

      const total = monthlyInvoices.reduce((sum, inv) => sum + inv.total, 0);
      return [{
        month: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`,
        totalInvoices: monthlyInvoices.length,
        totalAmount: total,
        averageAmount: monthlyInvoices.length > 0 ? total / monthlyInvoices.length : 0
      }];
    }

    // Total spending
    if (lowerQuestion.includes('total') && lowerQuestion.includes('spend')) {
      const total = invoices.reduce((sum, inv) => sum + inv.total, 0);
      return [{ totalSpending: total, invoiceCount: invoices.length }];
    }

    // Average amount
    if (lowerQuestion.includes('average')) {
      const total = invoices.reduce((sum, inv) => sum + inv.total, 0);
      const average = invoices.length > 0 ? total / invoices.length : 0;
      return [{ averageAmount: average, totalInvoices: invoices.length }];
    }

    // Count queries
    if (lowerQuestion.includes('how many') || lowerQuestion.includes('count')) {
      return [{ count: invoices.length }];
    }

    // High value invoices
    if (lowerQuestion.includes('over') && lowerQuestion.includes('$')) {
      const amount = parseFloat(lowerQuestion.match(/\$?(\d+)/)?.[1] || '0');
      const filtered = invoices.filter(inv => inv.total > amount);
      return filtered.map(inv => ({
        merchantName: inv.merchantName,
        date: inv.date,
        total: inv.total,
        agentName: inv.agentName
      }));
    }

    // Default: return summary data
    return [{
      totalInvoices: invoices.length,
      totalAmount: invoices.reduce((sum, inv) => sum + inv.total, 0),
      uniqueMerchants: new Set(invoices.map(inv => inv.merchantName)).size,
      uniqueAgents: new Set(invoices.filter(inv => inv.agentName).map(inv => inv.agentName)).size
    }];
  }

  private extractTextFromResponse(response: any): string {
    if (typeof response === 'string') {
      return response;
    }
    
    if (response?.output?.[0]?.content?.[0]?.text) {
      return response.output[0].content[0].text;
    }
    
    return '';
  }

  // Generate example queries based on actual invoice data
  async getExampleQueries(): Promise<Array<{ question: string; description: string }>> {
    try {
      await invoiceDb.initialize();
      const invoices = await invoiceDb.getAllInvoices();
      
      if (invoices.length === 0) {
        return [
          {
            question: "How many invoices do I have?",
            description: "Counts total number of invoices"
          },
          {
            question: "What's my total spending?",
            description: "Shows total amount across all invoices"
          }
        ];
      }

      const examples: Array<{ question: string; description: string }> = [];
      
      // Basic stats (always relevant)
      examples.push({
        question: "How many invoices do I have?",
        description: "Counts total number of invoices"
      });

      // Merchant analysis (if we have multiple merchants)
      const merchants = Array.from(new Set(invoices.map(inv => inv.merchantName)));
      if (merchants.length > 1) {
        examples.push({
          question: "Which merchant made the most sales?",
          description: "Finds the merchant with highest total sales"
        });
        
        if (merchants.length > 3) {
          examples.push({
            question: `How much did I spend at ${merchants[0]}?`,
            description: `Shows total spending at ${merchants[0]}`
          });
        }
      }

      // Agent analysis (if we have agents)
      const agents = Array.from(new Set(invoices.filter(inv => inv.agentName).map(inv => inv.agentName)));
      if (agents.length > 0) {
        examples.push({
          question: "Which agent has the highest total sales?",
          description: "Finds agent with highest total sales"
        });
        
        if (agents.length > 1) {
          examples.push({
            question: `How many invoices does ${agents[0]} have?`,
            description: `Shows invoice count for ${agents[0]}`
          });
        }
      }

      // Date-based examples (based on actual date ranges)
      const dates = invoices.map(inv => new Date(inv.date)).filter(d => !isNaN(d.getTime()));
      if (dates.length > 0) {
        
        // Get unique years from the data
        const years = Array.from(new Set(dates.map(d => d.getFullYear()))).sort();
        const months = Array.from(new Set(dates.map(d => d.getMonth() + 1))).sort();
        
        if (years.length > 1) {
          const recentYear = years[years.length - 1];
          examples.push({
            question: `Show me all invoices from ${recentYear}`,
            description: `Lists invoices from ${recentYear}`
          });
        }
        
        if (years.length > 0) {
          const currentYear = new Date().getFullYear();
          if (years.includes(currentYear)) {
            examples.push({
              question: `What's my total spending in ${currentYear}?`,
              description: `Shows total spending for ${currentYear}`
            });
          }
        }
        
        // Month-based examples
        if (months.length > 1) {
          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                             'July', 'August', 'September', 'October', 'November', 'December'];
          const recentMonth = months[months.length - 1];
          const recentYear = years[years.length - 1];
          examples.push({
            question: `Show me invoices from ${monthNames[recentMonth - 1]} ${recentYear}`,
            description: `Lists invoices from ${monthNames[recentMonth - 1]} ${recentYear}`
          });
        }
      }

      // Amount-based examples (based on actual amounts)
      const amounts = invoices.map(inv => inv.total).filter(a => a > 0);
      if (amounts.length > 0) {
        const avgAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
        const maxAmount = Math.max(...amounts);
        
        examples.push({
          question: "What's my average invoice amount?",
          description: "Shows average spending per invoice"
        });
        
        if (maxAmount > avgAmount * 1.5) {
          const threshold = Math.round(avgAmount);
          examples.push({
            question: `Show me invoices over ${threshold}`,
            description: `Filters high-value invoices over ${threshold}`
          });
        }
      }

      // Currency-based examples (if multiple currencies)
      const currencies = Array.from(new Set(invoices.map(inv => inv.currency || 'PHP')));
      if (currencies.length > 1) {
        examples.push({
          question: "How much did I spend in each currency?",
          description: "Shows spending breakdown by currency"
        });
      }

      // Item-based examples (if we have items)
      const allItems = invoices.flatMap(inv => inv.items || []);
      if (allItems.length > 0) {
        const categories = Array.from(new Set(allItems.map(item => item.category).filter(Boolean)));
        if (categories.length > 0) {
          examples.push({
            question: `What items did I buy in the ${categories[0]} category?`,
            description: `Lists items from ${categories[0]} category`
          });
        }
      }

      // Limit to 6 examples to keep it manageable
      return examples.slice(0, 6);
      
    } catch (error) {
      console.error('Failed to generate example queries:', error);
      // Fallback to basic examples
      return [
        {
          question: "How many invoices do I have?",
          description: "Counts total number of invoices"
        },
        {
          question: "What's my total spending?",
          description: "Shows total amount across all invoices"
        }
      ];
    }
  }

  destroy(): void {
    if (this.languageModel) {
      if (typeof this.languageModel.destroy === 'function') {
        this.languageModel.destroy();
      }
      this.languageModel = null;
    }
    this.isInitialized = false;
  }
}

export const aiJSONQueryEngine = new AIJSONQueryEngine();

// Example usage functions
export async function askAboutInvoices(question: string) {
  return await aiJSONQueryEngine.queryInvoices(question);
}

export async function getSpendingAnalysis() {
  const questions = [
    "What's my total spending?",
    "What's my average invoice amount?",
    "Which merchant did I spend the most at?",
    "How many invoices do I have?"
  ];

  const results = [];
  for (const question of questions) {
    const result = await aiJSONQueryEngine.queryInvoices(question);
    results.push({ question, result });
  }
  
  return results;
}
