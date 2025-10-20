export interface GeminiImagePart {
  inlineData: {
    data: string;
    mimeType: string;
  };
}

export interface GeminiTextPart {
  text: string;
}

export type GeminiPart = GeminiImagePart | GeminiTextPart;

export interface GeminiRequest {
  contents: Array<{
    parts: GeminiPart[];
  }>;
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

export class GeminiAPI {
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  private model = 'gemini-2.5-flash-lite'; // Using Gemini 2.5 Flash Lite - optimized for speed

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateContent(request: GeminiRequest): Promise<string> {
    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
    
    console.log('🌐 [GeminiAPI] Sending request to Gemini API...');
    console.log('🌐 [GeminiAPI] Request config:', {
      model: this.model,
      temperature: request.generationConfig?.temperature,
      maxOutputTokens: request.generationConfig?.maxOutputTokens,
      partsCount: request.contents[0].parts.length
    });
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    console.log('🌐 [GeminiAPI] Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ [GeminiAPI] API error:', errorData);
      throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data: GeminiResponse = await response.json();
    
    console.log('🌐 [GeminiAPI] Response received:', {
      hasCandidates: !!data.candidates,
      candidatesCount: data.candidates?.length || 0
    });
    
    if (!data.candidates || data.candidates.length === 0) {
      console.error('❌ [GeminiAPI] No candidates in response');
      throw new Error('No response generated from Gemini API');
    }

    const responseText = data.candidates[0].content.parts[0].text;
    console.log('🌐 [GeminiAPI] Response text length:', responseText?.length || 0);
    console.log('🌐 [GeminiAPI] Response preview:', responseText?.substring(0, 200));

    return responseText;
  }

  // Helper method to convert File to base64
  async fileToBase64(file: File): Promise<string> {
    console.log('🔄 [GeminiAPI] Converting file to base64:', { name: file.name, size: file.size, type: file.type });
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data:image/jpeg;base64, prefix
        const base64 = result.split(',')[1];
        console.log('✅ [GeminiAPI] Base64 conversion complete, length:', base64?.length || 0);
        resolve(base64);
      };
      reader.onerror = (error) => {
        console.error('❌ [GeminiAPI] Base64 conversion failed:', error);
        reject(error);
      };
      reader.readAsDataURL(file);
    });
  }

  // Helper method to create image part from file
  async createImagePart(file: File): Promise<GeminiImagePart> {
    console.log('🖼️ [GeminiAPI] Creating image part from file:', file.name);
    const base64 = await this.fileToBase64(file);
    const imagePart = {
      inlineData: {
        data: base64,
        mimeType: file.type || 'image/jpeg',
      },
    };
    console.log('✅ [GeminiAPI] Image part created, mimeType:', imagePart.inlineData.mimeType);
    return imagePart;
  }

  // Helper method to create text part
  createTextPart(text: string): GeminiTextPart {
    return { text };
  }
}
