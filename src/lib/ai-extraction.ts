import { InvoiceExtractionResult, Invoice, InvoiceItem } from '@/types/invoice';
import { GeminiAPI } from './gemini-api';
import { storeDb, merchantDb, agentDb } from './database';

const MULTIMODAL_EXPECTED_INPUTS = [
  { type: 'text', languages: ['en'] },
  { type: 'image' },
] as const;

const MULTIMODAL_EXPECTED_OUTPUTS = [
  { type: 'text', languages: ['en'] },
] as const;

const INVOICE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    storeName: { type: ['string', 'null'] },
    merchantName: { type: ['string', 'null'] },
    merchantAddress: {
      type: ['object', 'null'],
      properties: {
        street: { type: ['string', 'null'] },
        city: { type: ['string', 'null'] },
        state: { type: ['string', 'null'] },
        zipCode: { type: ['string', 'null'] },
        country: { type: ['string', 'null'] },
      },
      additionalProperties: true,
    },
    invoiceNumber: { type: ['string', 'null'] },
    date: { type: ['string', 'null'] },
    time: { type: ['string', 'null'] },
    subtotal: { type: ['number', 'string', 'null'] },
    tax: { type: ['number', 'string', 'null'] },
    total: { type: ['number', 'string'] },
    currency: { type: ['string', 'null'] },
    paymentMethod: { type: ['string', 'null'] },
    agentName: { type: ['string', 'null'] },
    terms: { type: ['string', 'null'] },
    termsDays: { type: ['number', 'string', 'null'] },
    phoneNumber: { type: ['string', 'null'] },
    email: { type: ['string', 'null'] },
    website: { type: ['string', 'null'] },
    confidence: { type: ['number', 'string', 'null'] },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: ['string', 'null'] },
          name: { type: ['string', 'null'] },
          description: { type: ['string', 'null'] },
          quantity: { type: ['number', 'string', 'null'] },
          unitPrice: { type: ['number', 'string', 'null'] },
          totalPrice: { type: ['number', 'string', 'null'] },
          category: { type: ['string', 'null'] },
        },
        additionalProperties: true,
      },
    },
  },
  required: ['merchantName', 'date', 'total', 'items'],
  additionalProperties: true,
} as const;

const PROMPT_TIMEOUT_MS = 15_000; // Reduced from 45s to 15s
const AGENT_PROMPT_TIMEOUT_MS = 5_000; // Reduced from 15s to 5s

const EXTRACTION_SYSTEM_PROMPT = `Extract invoice data as JSON. Key rules:

1. Store: Extract the store/business name (invoice issuer, usually at top)
2. Merchant: Look for "SOLD TO" (customer name, not invoice issuer)
3. Terms/Agent: IF found, extract from "TERMS/AGENT: X DAYS (mi)" format. Use null if NOT present.
4. Items: Only include non-crossed-out items with exact quantities
5. Totals: Use handwritten totals over calculated ones
6. Currency: Detect from symbols (₱=PHP, $=USD, etc.)

Return JSON only:
{
  "storeName": "string",
  "merchantName": "string",
  "merchantAddress": {"street": "string", "city": "string", "state": "string", "zipCode": "string", "country": "string"},
  "invoiceNumber": "string", 
  "date": "YYYY-MM-DD",
  "agentName": null,
  "terms": null,
  "termsDays": null,
  "items": [{"id": "item_1", "name": "string", "quantity": number, "unitPrice": number, "totalPrice": number}],
  "subtotal": number,
  "tax": number, 
  "total": number,
  "currency": "string",
  "confidence": number
}

CRITICAL: Only extract data ACTUALLY present. Use null for missing values. Numbers only (no currency symbols).`;

class AIInvoiceExtractor {
  private languageModel: any = null;
  private geminiAPI: GeminiAPI | null = null;
  private isInitialized = false;
  private useOnlineGemini = false;

  setProvider(useOnlineGemini: boolean, apiKey?: string) {
    this.useOnlineGemini = useOnlineGemini;
    this.isInitialized = false; // Reset initialization when switching providers
    
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
        // For online Gemini, we just need the API key
        if (!this.geminiAPI) {
          throw new Error('Gemini API not initialized. Please provide API key.');
        }
        this.isInitialized = true;
        return true;
      }
      // Check if LanguageModel is available
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

      // Create language model session with deterministic parameters
      this.languageModel = await LanguageModel.create({
        systemPrompt: EXTRACTION_SYSTEM_PROMPT,
        temperature: 0.1,
        topK: 1,
      });

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize LanguageModel:', error);
      return false;
    }
  }

  async extractFromImage(imageFile: File): Promise<InvoiceExtractionResult> {
    const startTime = Date.now();

    try {
      console.time('invoice-extraction-total');
      console.log('[Ledgee] Starting invoice extraction for', {
        name: imageFile.name,
        size: imageFile.size,
        type: imageFile.type,
      });

      const { aiResponse, rawContext, agentHint } = await this.extractInvoiceData(imageFile);
      console.log('📤 [Ledgee] Raw AI Response received from extraction');

      console.log('🔄 [Ledgee] Starting to parse AI response...');
      const invoiceData = await this.parseAIResponse(aiResponse);
      console.log('✅ [Ledgee] Invoice data after parsing:', invoiceData);
      if (!invoiceData.agentName && agentHint) {
        console.log('[Ledgee] Applying agent hint from follow-up prompt:', agentHint);
        invoiceData.agentName = agentHint;
      }
      const invoiceId = this.generateInvoiceId();
      const imageDataUrl = await this.createImageUrl(imageFile);

      // Associate merchant - find or create merchant record
      let merchantId: string | undefined;
      if (invoiceData.merchantName) {
        try {
          const merchantAddress = invoiceData.merchantAddress 
            ? [
                invoiceData.merchantAddress.street,
                invoiceData.merchantAddress.city,
                invoiceData.merchantAddress.state,
                invoiceData.merchantAddress.zipCode,
                invoiceData.merchantAddress.country
              ].filter(Boolean).join(', ')
            : '';
          
          const merchant = await merchantDb.findOrCreate(
            invoiceData.merchantName,
            merchantAddress
          );
          merchantId = merchant.id;
          console.log('🏢 [Ledgee] Associated with merchant:', { id: merchantId, name: merchant.name });
        } catch (error) {
          console.error('❌ [Ledgee] Failed to associate merchant:', error);
        }
      }

      // Handle store name - prioritize AI-extracted store, create if new, fallback to default
      let storeName: string | undefined;
      if (invoiceData.storeName) {
        // AI found a store name - use it
        storeName = invoiceData.storeName;
        console.log('🏪 [Ledgee] Using AI-extracted store name:', storeName);
        
        // Check if this store exists, create if it doesn't
        try {
          const existingStores = await storeDb.list();
          const storeExists = existingStores.some(store => 
            store.name.toLowerCase() === storeName!.toLowerCase()
          );
          
          if (!storeExists && storeName) {
            console.log('🏪 [Ledgee] Creating new store:', storeName);
            await storeDb.create({
              name: storeName,
              address: ''
            });
          }
        } catch (error) {
          console.error('❌ [Ledgee] Failed to create/find store:', error);
        }
      } else {
        // No store found in AI extraction - use default store
        try {
          const defaultStore = await storeDb.getDefault();
          if (defaultStore) {
            storeName = defaultStore.name;
            console.log('🏪 [Ledgee] No store found in invoice, using default store:', storeName);
          } else {
            console.warn('⚠️ [Ledgee] No store found in invoice and no default store available');
          }
        } catch (error) {
          console.error('❌ [Ledgee] Failed to get default store:', error);
        }
      }

      // Associate agent - find or create agent record
      let agentId: string | undefined;
      if (invoiceData.agentName) {
        try {
          const agent = await agentDb.findOrCreate(invoiceData.agentName);
          agentId = agent.id;
          console.log('👤 [Ledgee] Associated with agent:', { id: agentId, name: agent.name });
        } catch (error) {
          console.error('❌ [Ledgee] Failed to associate agent:', error);
        }
      }

      console.log('📝 [Ledgee] Creating final invoice object...');
      console.log('📝 [Ledgee] Invoice ID:', invoiceId);
      console.log('📝 [Ledgee] Invoice data to merge:', invoiceData);
      
      const invoice: Partial<Invoice> = {
        id: invoiceId,
        ...invoiceData,
        merchantId,
        storeName,
        agentId,
        extractedAt: new Date().toISOString(),
        rawText: rawContext,
        imageData: imageDataUrl // Store base64 image data in IndexedDB
      };

      console.log('📝 [Ledgee] Final invoice object:', JSON.stringify(invoice, null, 2));
      const processingTime = Date.now() - startTime;
      console.timeEnd('invoice-extraction-total');
      console.log('[Ledgee] Invoice extraction succeeded', {
        invoiceId,
        processingTime,
      });

      return {
        invoice: {
          ...invoice,
          aiModel: this.useOnlineGemini ? 'gemini-2.5-flash-lite' : 'chrome-builtin',
          aiResponseTime: processingTime,
          aiExtractedFrom: 'image'
        },
        confidence: invoiceData.confidence || 0.5,
        rawText: rawContext,
        processingTime,
        errors: []
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('Invoice extraction failed:', error);
      console.timeEnd('invoice-extraction-total');

      return {
        invoice: {
          id: this.generateInvoiceId(),
          merchantName: 'Unknown Merchant',
          date: new Date().toISOString().split('T')[0],
          total: 0,
          items: [],
          extractedAt: new Date().toISOString()
        },
        confidence: 0,
        rawText: '',
        processingTime,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred']
      };
    }
  }

  private async extractInvoiceData(imageFile: File): Promise<{ aiResponse: string; rawContext: string; agentHint: string | null }> {
    if (this.useOnlineGemini && this.geminiAPI) {
      return this.extractWithGeminiAPI(imageFile);
    }

    const LanguageModel = (window as any).LanguageModel;

    if (!LanguageModel?.availability || !LanguageModel.create) {
      throw new Error('Chrome LanguageModel API not available');
    }

    const availabilityOptions = {
      expectedInputs: MULTIMODAL_EXPECTED_INPUTS,
      expectedOutputs: MULTIMODAL_EXPECTED_OUTPUTS,
    };

    console.time('invoice-availability');
    console.log('[Ledgee] Checking multimodal availability', availabilityOptions);
    const availability = await LanguageModel.availability(availabilityOptions);
    console.timeEnd('invoice-availability');
    console.log('[Ledgee] Multimodal availability result:', availability);

    if (availability !== 'available') {
      if (availability === 'after-download') {
        throw new Error('Chrome is downloading the Gemini Nano multimodal model. Keep this tab open and try again shortly.');
      }

      if (availability === 'no') {
        throw new Error('This device does not support the Gemini Nano multimodal model.');
      }

      throw new Error(`Chrome Prompt API not ready (status: ${availability}).`);
    }

    console.time('invoice-session-create');
    console.log('[Ledgee] Creating LanguageModel session');
    const session = await LanguageModel.create({
      ...availabilityOptions,
      initialPrompts: [
        {
          role: 'system',
          content: EXTRACTION_SYSTEM_PROMPT,
        },
      ],
      temperature: 0.1,
      topK: 1,
    });
    console.timeEnd('invoice-session-create');
    console.log('[Ledgee] Session created');

    try {
      console.time('invoice-session-append');
      console.log('[Ledgee] Appending invoice image to session');
      await session.append([
        {
          role: 'user',
          content: [
            {
              type: 'text',
              value: 'Analyze this invoice image and prepare to respond with the structured data described in the system instructions.',
            },
            {
              type: 'image',
              value: imageFile,
            },
          ],
        },
      ]);
      console.timeEnd('invoice-session-append');
      console.log('[Ledgee] Append completed');

      console.time('invoice-session-prompt');
      console.log('[Ledgee] Requesting structured response from session');

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => {
        console.warn('[Ledgee] Prompt timeout reached, aborting request');
        controller.abort();
      }, PROMPT_TIMEOUT_MS);

      let response: any;
      let usedFallback = false;
      let structuredDuration = 0;

      try {
        const structuredStart = performance.now?.() ?? Date.now();
        response = await session.prompt(
          'Return only the JSON object that represents the extracted invoice.',
          {
            responseConstraint: INVOICE_RESPONSE_SCHEMA,
            omitResponseConstraintInput: true,
            signal: controller.signal,
          }
        );
        structuredDuration = (performance.now?.() ?? Date.now()) - structuredStart;
        console.log('[Ledgee] Prompt completed (structured with responseConstraint)', {
          durationMs: structuredDuration,
        });
      } catch (error) {
        window.clearTimeout(timeoutId);

        if ((error instanceof DOMException || error instanceof Error) && error.name === 'AbortError') {
          console.warn('[Ledgee] Structured prompt timed out; retrying without responseConstraint');
          usedFallback = true;
        } else {
          throw error;
        }
      }

      if (!response) {
        try {
          const fallbackStart = performance.now?.() ?? Date.now();
          const fallbackController = new AbortController();
          const fallbackTimeout = window.setTimeout(() => {
            console.warn('[Ledgee] Fallback prompt timeout reached, aborting');
            fallbackController.abort();
          }, PROMPT_TIMEOUT_MS);

          response = await session.prompt(
            'Extract invoice data as JSON. Look for store name (invoice issuer), "SOLD TO" for merchant name, terms/agent ONLY if present (use null if missing), handwritten totals, exclude crossed-out items. Return JSON with storeName, merchantName, date, total, items, agentName, terms, termsDays, currency. Use null for missing fields.',
            {
              signal: fallbackController.signal,
            }
          );

          window.clearTimeout(fallbackTimeout);
          const fallbackDuration = (performance.now?.() ?? Date.now()) - fallbackStart;
          console.log('[Ledgee] Prompt completed via fallback (no responseConstraint)', {
            durationMs: fallbackDuration,
          });
        } catch (fallbackError) {
          if ((fallbackError instanceof DOMException || fallbackError instanceof Error) && fallbackError.name === 'AbortError') {
            throw new Error('Invoice extraction timed out while waiting for Gemini Nano (fallback).');
          }
          throw fallbackError;
        }
      } else {
        window.clearTimeout(timeoutId);
      }

      console.timeEnd('invoice-session-prompt');

      const aiResponse = this.normalizePromptResponse(response);

      if (usedFallback) {
        console.warn('[Ledgee] Using fallback response without responseConstraint; output may require additional validation', {
          structuredDurationMs: structuredDuration,
          fallbackPreview: aiResponse.slice(0, 140),
        });
      }

      let agentHint: string | null = null;
      const agentMatch = aiResponse.match(/"agentName"\s*:\s*"([^"\\]+)"/i);
      if (agentMatch && agentMatch[1].trim().toLowerCase() !== 'null') {
        agentHint = agentMatch[1].trim();
      }

      if (!agentHint && !usedFallback) {
        try {
          const agentController = new AbortController();
          const agentTimeout = window.setTimeout(() => agentController.abort(), AGENT_PROMPT_TIMEOUT_MS);

          const agentResponse = await session.prompt(
            'What is the sales agent or cashier name shown on this invoice? Respond with `agentName: <name>` or `agentName: null` if none.',
            { signal: agentController.signal }
          );

          window.clearTimeout(agentTimeout);

          const agentText = normalizePromptOutput(agentResponse);
          const extraMatch = agentText.match(/agentName\s*:\s*([^\n]+)/i);
          if (extraMatch) {
            const value = extraMatch[1].replace(/^["']|["']$/g, '').trim();
            if (value && value.toLowerCase() !== 'null') {
              agentHint = value;
            }
          }
        } catch (agentError) {
          if ((agentError instanceof DOMException || agentError instanceof Error) && agentError.name === 'AbortError') {
            console.warn('[Ledgee] Agent follow-up prompt timed out');
          } else {
            console.warn('[Ledgee] Agent follow-up prompt failed:', agentError);
          }
        }
      }

      return {
        aiResponse,
        rawContext: '[Image provided to Chrome LanguageModel session]',
        agentHint,
      };
    } finally {
      if (typeof session.destroy === 'function') {
        session.destroy();
        console.log('[Ledgee] Session destroyed');
      }
    }
  }

  private async extractWithGeminiAPI(imageFile: File): Promise<{ aiResponse: string; rawContext: string; agentHint: string | null }> {
    if (!this.geminiAPI) {
      console.error('❌ [Ledgee] Gemini API not initialized');
      throw new Error('Gemini API not initialized');
    }

    try {
      console.time('gemini-api-extraction');
      console.log('🚀 [Ledgee] Starting Gemini API extraction for', {
        name: imageFile.name,
        size: imageFile.size,
        type: imageFile.type,
      });

      // Create image part
      console.log('📸 [Ledgee] Creating image part...');
      const imagePart = await this.geminiAPI.createImagePart(imageFile);
      console.log('✅ [Ledgee] Image part created');
      
      // Create text part with the system prompt
      console.log('📝 [Ledgee] Creating text part with system prompt...');
      const textPart = this.geminiAPI.createTextPart(EXTRACTION_SYSTEM_PROMPT);
      console.log('✅ [Ledgee] Text part created, prompt length:', EXTRACTION_SYSTEM_PROMPT.length);

      // Generate content using Gemini API with optimized settings for speed
      const request = {
        contents: [{
          parts: [textPart, imagePart]
        }],
        generationConfig: {
          temperature: 0.0, // More deterministic for faster processing
          maxOutputTokens: 2048, // Reduced for faster response
          topP: 0.8, // Reduced for faster processing
          topK: 10, // Reduced for faster processing
        }
      };

      console.log('🌐 [Ledgee] Sending request to Gemini API...');
      const aiResponse = await this.geminiAPI.generateContent(request);
      console.timeEnd('gemini-api-extraction');
      console.log('✅ [Ledgee] Gemini API extraction completed');
      console.log('📄 [Ledgee] Response length:', aiResponse?.length || 0);
      console.log('📄 [Ledgee] Full Response:', aiResponse);
      console.log('📄 [Ledgee] Response preview:', aiResponse?.substring(0, 300));

      // Extract agent hint from response
      let agentHint: string | null = null;
      const agentMatch = aiResponse.match(/"agentName"\s*:\s*"([^"\\]+)"/i);
      if (agentMatch && agentMatch[1].trim().toLowerCase() !== 'null') {
        agentHint = agentMatch[1].trim();
        console.log('👤 [Ledgee] Agent hint found:', agentHint);
      } else {
        console.log('👤 [Ledgee] No agent hint found in response');
      }

      return {
        aiResponse,
        rawContext: '[Image processed by Gemini API]',
        agentHint,
      };
    } catch (error) {
      console.error('❌ [Ledgee] Gemini API extraction failed:', error);
      throw error;
    }
  }

  private normalizePromptResponse(response: any): string {
    return normalizePromptOutput(response);
  }

  private async parseAIResponse(response: string): Promise<any> {
    console.log('🔍 [Ledgee] ===== PARSING AI RESPONSE =====');
    console.log('🔍 [Ledgee] Raw response:', response);
    console.log('🔍 [Ledgee] Response type:', typeof response);
    console.log('🔍 [Ledgee] Response length:', response?.length);
    
    try {
      // Clean the response - remove any markdown formatting or extra text
      let cleanResponse = response.trim();
      console.log('🧹 [Ledgee] Cleaned response:', cleanResponse);
      
      // Look for JSON object in the response
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanResponse = jsonMatch[0];
        console.log('📦 [Ledgee] Extracted JSON from response:', cleanResponse);
      } else {
        console.warn('⚠️ [Ledgee] No JSON object found in response!');
      }

      cleanResponse = cleanResponse.replace(/[₱¥€£]/g, '');
      console.log('🧹 [Ledgee] After currency symbol removal:', cleanResponse);

      const parsed = JSON.parse(cleanResponse);
      console.log('✅ [Ledgee] Successfully parsed JSON');
      console.log('📊 [Ledgee] Parsed data keys:', Object.keys(parsed));
      console.log('📊 [Ledgee] Parsed invoice data:', JSON.stringify(parsed, null, 2));

      const toNumber = (value: any): number | null => {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string') {
          // Handle comma-separated numbers like "13,365"
          let cleaned = value.replace(/[^0-9.,\-]/g, '');
          
          // If it's a comma-separated number (like 13,365), remove commas
          if (cleaned.includes(',') && !cleaned.includes('.')) {
            cleaned = cleaned.replace(/,/g, '');
          }
          // If it has both comma and decimal, handle as currency format
          else if (cleaned.includes(',') && cleaned.includes('.')) {
            // Assume comma is thousands separator, decimal is decimal point
            cleaned = cleaned.replace(/,/g, '');
          }
          
          const num = parseFloat(cleaned);
          return Number.isFinite(num) ? num : null;
        }
        return null;
      };

      const toIsoDate = (value: any): string => {
        if (typeof value !== 'string') return new Date().toISOString().split('T')[0];
        const trimmed = value.trim();
        const parsedDate = new Date(trimmed);
        if (!Number.isNaN(parsedDate.getTime())) {
          return parsedDate.toISOString().split('T')[0];
        }

        const [month, day, year] = trimmed.split(/[\/-]/).map(part => part.trim());
        if (month && day && year) {
          const iso = new Date(`${year.length === 2 ? `20${year}` : year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
          if (!Number.isNaN(iso.getTime())) {
            return iso.toISOString().split('T')[0];
          }
        }

        return new Date().toISOString().split('T')[0];
      };

      const normalized: any = { ...parsed };

      console.log('🔄 [Ledgee] Starting normalization...');
      normalized.merchantName = parsed.merchantName || parsed.merchant || parsed.vendor || 'Unknown Merchant';
      console.log('🏪 [Ledgee] Merchant name:', normalized.merchantName);
      
      normalized.invoiceNumber = parsed.invoiceNumber || parsed.invoice_number || parsed.invoice_no || parsed.invoiceId || null;
      console.log('🔢 [Ledgee] Invoice number:', normalized.invoiceNumber);
      
      normalized.date = parsed.date ? toIsoDate(parsed.date) : toIsoDate(parsed.invoice_date || parsed.transaction_date || new Date().toISOString());
      console.log('📅 [Ledgee] Date:', normalized.date);
      
      // Extract terms and agent information
      normalized.terms = parsed.terms || null;
      normalized.termsDays = toNumber(parsed.termsDays) || null;
      
      // Fallback: Try to extract terms/agent from raw text if not found in structured data
      if (!normalized.terms || !normalized.termsDays || !normalized.agentName) {
        console.log('[Ledgee] Attempting fallback extraction for terms/agent from raw response');
        const rawText = response.toLowerCase();
        
        // Look for TERMS/AGENT pattern - try with parentheses first, then without
        let termsAgentMatch = rawText.match(/terms\/agent[:\s]*(\d+)\s*days?\s*\(([^)]+)\)/i);
        if (!termsAgentMatch) {
          // Try without parentheses: "120 DAYS EDWARD"
          termsAgentMatch = rawText.match(/terms\/agent[:\s]*(\d+)\s*days?\s+([a-zA-Z\s]+)/i);
        }
        if (termsAgentMatch) {
          console.log('[Ledgee] Found TERMS/AGENT pattern:', termsAgentMatch);
          if (!normalized.termsDays) {
            normalized.termsDays = parseInt(termsAgentMatch[1]);
          }
          if (!normalized.terms) {
            normalized.terms = `${termsAgentMatch[1]} DAYS`;
          }
          if (!normalized.agentName) {
            normalized.agentName = termsAgentMatch[2].trim();
          }
        }
        
        // Alternative patterns
        if (!normalized.termsDays) {
          const daysMatch = rawText.match(/(\d+)\s*days?/i);
          if (daysMatch) {
            console.log('[Ledgee] Found days pattern:', daysMatch);
            normalized.termsDays = parseInt(daysMatch[1]);
            if (!normalized.terms) {
              normalized.terms = `${daysMatch[1]} DAYS`;
            }
          }
        }
        
        console.log('[Ledgee] Final terms/agent extraction:', {
          terms: normalized.terms,
          termsDays: normalized.termsDays,
          agentName: normalized.agentName
        });
      }
      
      const agentFromKnownKeys = parsed.agentName || parsed.agent || parsed.salesAgent || parsed.salesperson || parsed.cashier || parsed.representative || parsed.accountManager;
      if (agentFromKnownKeys) {
        normalized.agentName = agentFromKnownKeys;
      } else {
        const agentKey = Object.keys(parsed).find((key) => key.toLowerCase().includes('agent') || key.toLowerCase().includes('cashier'));
        if (agentKey) {
          normalized.agentName = parsed[agentKey];
        }
      }

      const subtotal = toNumber(parsed.subtotal);
      const tax = toNumber(parsed.tax ?? parsed.sales_tax);
      const total = toNumber(parsed.total ?? parsed.totalAmount ?? parsed.amount_due) ?? 0;

      console.log('💰 [Ledgee] Financial data from parsed:', {
        parsedSubtotal: parsed.subtotal,
        parsedTax: parsed.tax,
        parsedTotal: parsed.total
      });
      console.log('💰 [Ledgee] Financial data after toNumber:', {
        subtotal,
        tax,
        total
      });

      normalized.subtotal = subtotal ?? undefined;
      normalized.tax = tax ?? undefined;
      normalized.total = total;
      
      console.log('💰 [Ledgee] Normalized financial data:', {
        subtotal: normalized.subtotal,
        tax: normalized.tax,
        total: normalized.total
      });
      
      // Enhanced currency detection
      let detectedCurrency = parsed.currency || parsed.currencyCode || parsed.currency_code;
      if (!detectedCurrency) {
        // Try to detect currency from the raw text or other fields
        const rawText = parsed.rawText || '';
        const currencySymbols = {
          '$': 'USD',
          '€': 'EUR', 
          '£': 'GBP',
          '¥': 'JPY',
          '₹': 'INR',
          '₽': 'RUB',
          '₩': 'KRW',
          '₪': 'ILS',
          'CHF': 'CHF',
          'CAD': 'CAD',
          'AUD': 'AUD',
          'NZD': 'NZD',
          'SGD': 'SGD',
          'HKD': 'HKD',
          'SEK': 'SEK',
          'NOK': 'NOK',
          'DKK': 'DKK',
          'PLN': 'PLN',
          'CZK': 'CZK',
          'HUF': 'HUF',
          'BRL': 'BRL',
          'MXN': 'MXN',
          'CNY': 'CNY',
          'TRY': 'TRY',
          'ZAR': 'ZAR'
        };
        
        // Look for currency symbols or codes in the text
        for (const [symbol, code] of Object.entries(currencySymbols)) {
          if (rawText.includes(symbol)) {
            detectedCurrency = code;
            break;
          }
        }
      }
      
      normalized.currency = detectedCurrency || 'PHP';
      normalized.paymentMethod = parsed.paymentMethod || parsed.payment_method || parsed.payment_type || null;
      normalized.confidence = toNumber(parsed.confidence) ?? 0.5;

      const items: any[] = Array.isArray(parsed.items) ? parsed.items : [];
      console.log('📦 [Ledgee] Items array:', items);
      console.log('📦 [Ledgee] Items count:', items.length);
      
      normalized.items = items.map((item: any, index: number) => {
        console.log(`📦 [Ledgee] Processing item ${index + 1}:`, item);
        
        const quantity = toNumber(item.quantity ?? item.qty) ?? 1;
        const unitPrice = toNumber(item.unitPrice ?? item.unit_price ?? item.price_per_unit ?? item.price) ?? 0;
        const totalPrice = toNumber(item.totalPrice ?? item.total_price ?? item.total ?? item.price) ?? quantity * unitPrice;

        console.log(`📦 [Ledgee] Item ${index + 1} parsed values:`, {
          quantity,
          unitPrice,
          totalPrice,
          name: item.name || item.description
        });

        return {
          id: `item_${index + 1}`,
          name: item.name || item.description || `Item ${index + 1}`,
          description: item.description || null,
          quantity,
          unitPrice,
          totalPrice,
          category: item.category || null
        } as InvoiceItem;
      });
      
      console.log('📦 [Ledgee] Normalized items:', normalized.items);

      // Validation: Check if item totals match the handwritten total
      const calculatedTotal = normalized.items.reduce((sum: number, item: InvoiceItem) => sum + (item.totalPrice || 0), 0);
      const handwrittenTotal = total;
      
      if (Math.abs(calculatedTotal - handwrittenTotal) > 0.01) {
        console.warn(`[Ledgee] Total mismatch detected:`, {
          calculatedTotal,
          handwrittenTotal,
          difference: Math.abs(calculatedTotal - handwrittenTotal)
        });
        
        // Use the handwritten total as it's more likely to be correct
        normalized.total = handwrittenTotal;
        
        // Lower confidence if there's a significant discrepancy
        if (normalized.confidence && Math.abs(calculatedTotal - handwrittenTotal) > 100) {
          normalized.confidence = Math.max(0.1, (normalized.confidence || 0.5) - 0.2);
        }
      }

      console.log('✅ [Ledgee] ===== PARSING COMPLETE =====');
      console.log('✅ [Ledgee] Final normalized data:', JSON.stringify(normalized, null, 2));
      return normalized;
    } catch (error) {
      console.error('❌ [Ledgee] ===== PARSING FAILED =====');
      console.error('❌ [Ledgee] Error:', error);
      console.error('❌ [Ledgee] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('❌ [Ledgee] Original response was:', response);
      
      // Return fallback data
      return {
        merchantName: 'Unknown Merchant',
        date: new Date().toISOString().split('T')[0],
        total: 0,
        items: [],
        confidence: 0.1
      };
    }
  }

  private generateInvoiceId(): string {
    return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async createImageUrl(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const initialized = await this.initialize();
      if (!initialized) return false;
      
      if (!this.languageModel) return false;
      
      // Test with a simple prompt
      const testResponse = await this.languageModel.prompt('Hello, are you ready to extract invoice data?');
      console.log('Test connection response:', testResponse);
      return true;
    } catch (error) {
      console.error('LanguageModel connection test failed:', error);
      return false;
    }
  }

  destroy(): void {
    if (this.languageModel) {
      // Clean up if there's a destroy method
      if (typeof this.languageModel.destroy === 'function') {
        this.languageModel.destroy();
      }
      this.languageModel = null;
    }
    this.isInitialized = false;
  }

  getAvailabilityStatus(): string {
    if (!('LanguageModel' in window)) {
      return 'Chrome LanguageModel not available. Please use Chrome Canary with experimental features enabled.';
    }

    if (!this.isInitialized) {
      return 'LanguageModel session not initialized';
    }

    return 'Ready';
  }
}

export const aiExtractor = new AIInvoiceExtractor();

function normalizePromptOutput(response: any): string {
  if (!response) return '';

  if (typeof response === 'string') {
    return response;
  }

  if (Array.isArray(response)) {
    return response
      .map((part) => (typeof part === 'string' ? part : part?.text || ''))
      .filter(Boolean)
      .join('\n');
  }

  if (response?.output?.length) {
    const chunks = response.output.flatMap((block: any) => block?.content || []);
    const text = chunks
      .map((part: any) => part?.text || part?.data || '')
      .filter(Boolean)
      .join('\n');
    if (text) return text;
  }

  if (response.output_text) {
    return response.output_text;
  }

  if (response.text) {
    return response.text;
  }

  try {
    return JSON.stringify(response);
  } catch {
    return '';
  }
}

// Utility function to check Chrome LanguageModel availability
export interface ChromeAIStatus {
  available: boolean;
  status: string;
  instructions?: string;
  promptApiAvailable: boolean;
  languageModelAvailable: boolean;
}

const DESCRIPTION_PROMPT = 'Extract and describe ALL visible information from this invoice image. Include: merchant name, address, invoice number, date, terms/agent information, all item details (quantities, descriptions, prices), totals, currency, and any other text or numbers you can see. IMPORTANT: Pay attention to crossed-out rows (items with horizontal lines through them) - these should be EXCLUDED from your analysis. Only include items that are NOT crossed out or are clearly marked as valid. Be thorough and detailed - list everything that is clearly visible and valid in the image.';

export async function checkChromeAIAvailability(): Promise<ChromeAIStatus> {
  if (typeof window === 'undefined') {
    return {
      available: false,
      status: 'Window object unavailable',
      instructions: 'Run inside a Chrome browser environment',
      promptApiAvailable: false,
      languageModelAvailable: false,
    };
  }

  const LanguageModel = (window as any).LanguageModel;

  if (!LanguageModel?.availability) {
    return {
      available: false,
      status: 'Chrome LanguageModel not detected',
      instructions: 'Enable these Chrome flags:\n• chrome://flags/#prompt-api-for-gemini-nano\n• chrome://flags/#prompt-api-for-gemini-nano-multimodal-input\n• chrome://flags/#optimization-guide-on-device-model',
      promptApiAvailable: false,
      languageModelAvailable: false,
    };
  }

  const availabilityOptions = {
    expectedInputs: MULTIMODAL_EXPECTED_INPUTS,
    expectedOutputs: MULTIMODAL_EXPECTED_OUTPUTS,
  };

  let multimodalAvailability: string;

  try {
    multimodalAvailability = await LanguageModel.availability(availabilityOptions);
  } catch (error) {
    console.warn('Failed to query multimodal availability:', error);
    return {
      available: false,
      status: 'Error checking Prompt API availability',
      instructions: 'Ensure the Chrome Prompt API flags are enabled and retry.',
      promptApiAvailable: false,
      languageModelAvailable: true,
    };
  }

  const languageModelAvailable = true;
  const instructions = 'Enable these Chrome flags, then restart:\n• chrome://flags/#prompt-api-for-gemini-nano\n• chrome://flags/#prompt-api-for-gemini-nano-multimodal-input\n• chrome://flags/#optimization-guide-on-device-model';

  switch (multimodalAvailability) {
    case 'available':
      return {
        available: true,
        status: 'Gemini Nano multimodal model is ready',
        promptApiAvailable: true,
        languageModelAvailable,
      };
    case 'after-download':
      return {
        available: false,
        status: 'Gemini Nano multimodal model is downloading',
        instructions: 'Keep Chrome open until the model download completes, then try again.',
        promptApiAvailable: false,
        languageModelAvailable,
      };
    case 'no':
      return {
        available: false,
        status: 'Gemini Nano multimodal model not supported on this device',
        instructions,
        promptApiAvailable: false,
        languageModelAvailable,
      };
    default:
      return {
        available: false,
        status: `Gemini Nano multimodal availability: ${multimodalAvailability}`,
        instructions,
        promptApiAvailable: false,
        languageModelAvailable,
      };
  }
}

export async function describeImage(imageFile: File): Promise<string> {
  const LanguageModel = (window as any).LanguageModel;

  if (!LanguageModel?.availability || !LanguageModel.create) {
    throw new Error('Chrome LanguageModel API not available');
  }

  const availabilityOptions = {
    expectedInputs: MULTIMODAL_EXPECTED_INPUTS,
    expectedOutputs: MULTIMODAL_EXPECTED_OUTPUTS,
  };

  console.log('[Ledgee] [Describe] Checking availability for quick image description');
  const availability = await LanguageModel.availability(availabilityOptions);
  console.log('[Ledgee] [Describe] Availability status:', availability);

  if (availability !== 'available') {
    throw new Error(`Gemini Nano not ready for image description (status: ${availability}).`);
  }

  const session = await LanguageModel.create({
    ...availabilityOptions,
    initialPrompts: [
      {
        role: 'system',
        content: 'You are a detailed invoice analysis assistant. Your task is to extract and describe ALL visible information from invoice images. Be thorough, accurate, and comprehensive. Include every piece of text, number, and detail you can see. CRITICAL: Pay attention to crossed-out items (rows with horizontal lines through them) and EXCLUDE them from your analysis. Only include items that are clearly valid and not crossed out.',
      },
    ],
    temperature: 0.1,
    topK: 1,
  });

  try {
    await session.append([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            value: 'Analyze this invoice image and extract all visible information. Include merchant details, invoice numbers, dates, terms, agent information, all line items with quantities and prices, totals, and any other text or numbers visible in the image. IMPORTANT: Exclude any crossed-out rows (items with horizontal lines through them) from your analysis. Only include items that are clearly valid and not crossed out.',
          },
          {
            type: 'image',
            value: imageFile,
          },
        ],
      },
    ]);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), PROMPT_TIMEOUT_MS);

    let response: any;

    try {
      response = await session.prompt(DESCRIPTION_PROMPT, {
        signal: controller.signal,
      });
    } catch (error) {
      if ((error instanceof DOMException || error instanceof Error) && error.name === 'AbortError') {
        throw new Error('Image description timed out while waiting for Gemini Nano.');
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }

    const description = normalizePromptOutput(response).trim();
    return description || 'No description returned.';
  } finally {
    if (typeof session.destroy === 'function') {
      session.destroy();
    }
  }
}
