"use client";

import { invoiceDb } from './database';

// Schema definition for the LanguageModel to understand our database structure
const DATABASE_SCHEMA = `
Database schema for invoice data:

Table: invoices
- id: TEXT PRIMARY KEY (unique invoice identifier)
- merchantName: TEXT (name of the store/merchant)
- date: TEXT (invoice date in YYYY-MM-DD format)
- time: TEXT (invoice time)
- total: REAL (total amount paid)
- subtotal: REAL (subtotal before tax)
- tax: REAL (tax amount)
- currency: TEXT (currency code, default USD)
- paymentMethod: TEXT (payment method used)
- invoiceNumber: TEXT (invoice/receipt number)
- phoneNumber: TEXT (merchant phone)
- email: TEXT (merchant email)
- createdAt: TEXT (when record was created)

Table: invoice_items  
- id: TEXT PRIMARY KEY
- invoiceId: TEXT (references invoices.id)
- name: TEXT (item name)
- quantity: REAL (quantity purchased)
- unitPrice: REAL (price per unit)
- totalPrice: REAL (total price for this item)
- category: TEXT (item category)
`;

export class AIInvoiceQueryEngine {
  private languageModel: any = null;
  private isInitialized = false;

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
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
        systemPrompt: `You are a SQL query generator for invoice data analysis. 
        Generate SQLite queries based on natural language questions about invoices.
        Always return valid SQLite syntax.
        
        ${DATABASE_SCHEMA}`,
        temperature: 0.1,
        topK: 1,
      });

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize AI query engine:', error);
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

      // Step 1: Convert natural language question to SQL
      const sqlPrompt = `
        User question: "${question}"
        
        Generate a SQL query that answers this question using the invoice database schema.
        Return only the SQL query, nothing else.
        Use proper SQLite syntax with JOINs if needed.
      `;

      const sqlResponse = await this.languageModel.prompt(sqlPrompt);
      const sqlQuery = this.extractTextFromResponse(sqlResponse).trim();

      console.log('Generated SQL:', sqlQuery);

      // Step 2: Execute the SQL query
      await invoiceDb.initialize();
      const results = await this.executeSQLQuery(sqlQuery);

      console.log('Query results:', results);

      // Step 3: Generate natural language answer
      const summaryPrompt = `
        User asked: "${question}"
        
        SQL query executed: ${sqlQuery}
        
        Query results:
        ${JSON.stringify(results, null, 2)}
        
        Provide a natural language answer that summarizes these results.
        Be specific with numbers and details when available.
      `;

      const summaryResponse = await this.languageModel.prompt(summaryPrompt);
      const answer = this.extractTextFromResponse(summaryResponse);

      return {
        success: true,
        answer,
        data: results,
      };

    } catch (error) {
      console.error('Query processing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async executeSQLQuery(sqlQuery: string): Promise<any[]> {
    // This is a simplified version - in a real implementation,
    // you'd need to handle complex SQL queries properly with sql.js
    
    try {
      // For demo purposes, let's handle some common query patterns
      if (sqlQuery.toLowerCase().includes('count(*)')) {
        const invoices = await invoiceDb.getAllInvoices();
        return [{ count: invoices.length }];
      }
      
      if (sqlQuery.toLowerCase().includes('sum(total)')) {
        const invoices = await invoiceDb.getAllInvoices();
        const total = invoices.reduce((sum, inv) => sum + inv.total, 0);
        return [{ total_spent: total }];
      }
      
      if (sqlQuery.toLowerCase().includes('group by merchantname')) {
        const invoices = await invoiceDb.getAllInvoices();
        const merchantTotals = invoices.reduce((acc, inv) => {
          acc[inv.merchantName] = (acc[inv.merchantName] || 0) + inv.total;
          return acc;
        }, {} as Record<string, number>);
        
        return Object.entries(merchantTotals).map(([merchant, total]) => ({
          merchantName: merchant,
          total: total
        }));
      }
      
      if (sqlQuery.toLowerCase().includes('avg(total)')) {
        const invoices = await invoiceDb.getAllInvoices();
        const avg = invoices.length > 0 
          ? invoices.reduce((sum, inv) => sum + inv.total, 0) / invoices.length 
          : 0;
        return [{ average: avg }];
      }
      
      // Default: return all invoices
      const invoices = await invoiceDb.getAllInvoices();
      return invoices.map(inv => ({
        id: inv.id,
        merchantName: inv.merchantName,
        date: inv.date,
        total: inv.total,
        items_count: inv.items.length
      }));
      
    } catch (error) {
      console.error('SQL execution error:', error);
      throw new Error('Failed to execute query');
    }
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

  // Predefined example queries for users to try
  getExampleQueries(): Array<{ question: string; description: string }> {
    return [
      {
        question: "How much did I spend in total this month?",
        description: "Calculates total spending for current month"
      },
      {
        question: "What's my average invoice amount?",
        description: "Shows average spending per invoice"
      },
      {
        question: "Which merchant did I spend the most money at?",
        description: "Finds top merchant by total spending"
      },
      {
        question: "How many invoices do I have?",
        description: "Counts total number of processed invoices"
      },
      {
        question: "What did I buy at grocery stores?",
        description: "Lists items purchased at grocery stores"
      },
      {
        question: "Show me all invoices over $50",
        description: "Filters invoices by amount threshold"
      }
    ];
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

export const aiQueryEngine = new AIInvoiceQueryEngine();

// Example usage functions
export async function askAboutInvoices(question: string) {
  return await aiQueryEngine.queryInvoices(question);
}

export async function getSpendingAnalysis() {
  const questions = [
    "How much did I spend in total?",
    "What's my average invoice amount?",
    "Which merchant did I spend the most at?"
  ];

  const results = [];
  for (const question of questions) {
    const result = await aiQueryEngine.queryInvoices(question);
    results.push({ question, result });
  }
  
  return results;
}
