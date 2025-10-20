# Ledgee - Invoice Extraction

Ledgee is an offline-first web application that automatically extracts structured data from invoice images using Chrome's built-in LanguageModel API. Simply drag and drop your invoice images, and Ledgee will extract merchant information, line items, totals, and other important details.

## Features

- 🤖 **Chrome LanguageModel**: Uses Chrome's native LanguageModel API with Gemini Nano for invoice extraction
- 📱 **Offline-First**: Works completely offline after initial load
- 🗄️ **Local Database**: Stores all data locally using SQLite WASM
- 📄 **Smart Extraction**: Automatically extracts merchant name, items, totals, dates, and more
- 🎯 **Responsive Design**: Works seamlessly on desktop and mobile devices
- 🔒 **Privacy-Focused**: All processing happens locally in your browser

## Prerequisites

To use Ledgee, you need:

1. **Chrome Canary** browser (required for LanguageModel features)
2. Enable the Chrome LanguageModel flag: `chrome://flags/#prompt-api-for-gemini-nano`
3. Set the flag to "Enabled"
4. Restart Chrome Canary

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ledgee
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in Chrome Canary

## Usage

1. **Check LanguageModel Status**: Ensure the green indicator shows "Chrome LanguageModel is ready"
2. **Upload Invoices**: Drag and drop invoice images (JPG, PNG, WebP) onto the upload area
3. **Automatic Extraction**: Ledgee will automatically extract and structure the invoice data
4. **Review Results**: View extracted invoices in the list with confidence scores
5. **Manage Data**: Click on invoices to view details or delete them

## Supported Invoice Data

Ledgee extracts:

- **Merchant Information**: Name, address, contact details
- **Invoice Details**: Invoice number, date, time
- **Line Items**: Product names, quantities, unit prices, totals
- **Financial Data**: Subtotal, tax, total amount
- **Payment Info**: Payment method (if visible)

## Technology Stack

- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Chrome LanguageModel API**: Built-in Gemini Nano model
- **SQL.js**: SQLite database in WebAssembly
- **PWA**: Progressive Web App capabilities

## Chrome LanguageModel Setup

### For Chrome Canary Users:

1. Open `chrome://flags/#prompt-api-for-gemini-nano`
2. Set to "Enabled"
3. Open `chrome://flags/#optimization-guide-on-device-model`
4. Set to "Enabled BypassPerfRequirement"
5. Restart Chrome Canary
6. Visit `chrome://components/` and update "Optimization Guide On Device Model"

### Testing Chrome AI in Console:

You can test the built-in Chrome AI directly in the browser console:

```javascript
// Check if Chrome AI is available
if ('LanguageModel' in window) {
  console.log('✅ Chrome AI is available!');
  
  // Create a session and chat
  (async () => {
    // Check availability first
    const availability = await window.LanguageModel.availability();
    console.log('Availability:', availability);
    
    if (availability === 'available') {
      const session = await window.LanguageModel.create();
      console.log('Session created!');
      
      // Ask a question
      const response = await session.prompt('Hello! Tell me a joke about programming.');
      console.log('AI Response:', response);
      
      // Continue the conversation
      const response2 = await session.prompt('Can you explain that joke?');
      console.log('AI Response 2:', response2);
      
      // Cleanup
      session.destroy();
    } else {
      console.log('Status:', availability);
    }
  })();
} else {
  console.log('❌ Chrome AI not available. Enable flags and restart Chrome Canary.');
}
```

**Quick test (one-liner):**
```javascript
// Simple test
(async () => { const s = await window.LanguageModel.create(); console.log(await s.prompt('Hello! What can you do?')); s.destroy(); })();
```

**Check AI availability:**
```javascript
// Check if model is ready
(async () => {
  const availability = await window.LanguageModel.availability();
  console.log('Status:', availability); // "available", "downloadable", "downloading", or "unavailable"
})();
```

**Interactive chat example:**
```javascript
// Create a session you can reuse
let chatSession;
(async () => {
  chatSession = await window.LanguageModel.create();
  console.log('Chat session ready! Use: await chatSession.prompt("your question")');
})();

// Then you can chat:
// await chatSession.prompt('What is 2+2?')
// await chatSession.prompt('Tell me more about that')
// When done: chatSession.destroy()
```

### Troubleshooting LanguageModel Issues:

- **"Chrome LanguageModel not available"**: Ensure you're using Chrome Canary with flags enabled
- **"Model downloading"**: Wait for the AI model to download automatically
- **Low confidence scores**: Ensure invoice images are clear and well-lit

## Project Structure

```
ledgee/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── layout.tsx       # Root layout
│   │   ├── page.tsx         # Main page
│   │   └── globals.css      # Global styles
│   ├── components/          # React components
│   │   ├── InvoiceDropzone.tsx
│   │   └── InvoiceList.tsx
│   ├── lib/                 # Utilities
│   │   ├── ai-extraction.ts # Chrome LanguageModel integration
│   │   └── database.ts      # SQLite database
│   └── types/               # TypeScript definitions
│       └── invoice.ts
├── public/                  # Static assets
│   ├── sql-wasm.wasm       # SQLite WebAssembly
│   └── manifest.json       # PWA manifest
└── README.md
```

## Development

### Available Scripts:

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript checks

### Environment Setup:

The app requires no environment variables as it runs completely client-side.

## Database

Ledgee uses SQLite via WebAssembly for local storage:

- **Invoices Table**: Stores invoice metadata and totals
- **Invoice Items Table**: Stores individual line items
- **Local Storage**: Database persisted in browser's localStorage

## Privacy & Security

- **No Server Required**: Everything runs in your browser
- **Local Processing**: Invoice images never leave your device
- **No Tracking**: No analytics or external services
- **Offline Capable**: Works without internet after initial load

## Browser Compatibility

- ✅ Chrome Canary (with LanguageModel flags enabled)
- ❌ Regular Chrome (LanguageModel features not available yet)
- ❌ Firefox, Safari, Edge (Chrome LanguageModel not available)

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Submit a pull request with a clear description

## Known Limitations

- Currently requires Chrome Canary with experimental flags
- AI model accuracy depends on invoice image quality
- Limited to English language invoices
- OCR simulation for demo purposes (real OCR integration needed)

## Roadmap

- [ ] Real OCR integration (Tesseract.js or Cloud APIs)
- [ ] Multi-language support
- [ ] Export functionality (CSV, JSON, PDF)
- [ ] Invoice templates and categories
- [ ] Batch processing improvements
- [ ] Analytics and reporting features

## License

This project is licensed under the ISC License.

## Support

For issues and questions:
1. Check Chrome LanguageModel flag configuration
2. Ensure you're using Chrome Canary
3. Check browser console for error messages
4. Create an issue with detailed information

---

Built with ❤️ using Chrome's Built-in LanguageModel API