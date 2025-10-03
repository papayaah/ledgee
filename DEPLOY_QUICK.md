# 🚀 Shaw AI - Quick Deployment Guide

Shaw AI is a **100% client-side** web app. No server needed!

## ⚡ Quick Deploy (30 seconds)

```bash
# 1. Build static files
npm run build:static

# 2. Deploy the 'out' folder anywhere!
```

## 📁 What You Get

After building, you'll have a `out/` folder (~1.9MB) containing:
- `index.html` - Your complete app
- `_next/static/` - JavaScript & CSS
- `sql-wasm.wasm` - SQLite database
- `manifest.json` - PWA configuration

## 🌐 Deploy Anywhere

### Option 1: Vercel (Fastest)
```bash
npm install -g vercel
vercel --prod
```

### Option 2: Netlify (Drag & Drop)
1. Build: `npm run build:static`
2. Go to [netlify.com](https://netlify.com)
3. Drag the `out/` folder to their site
4. Done!

### Option 3: Any Web Host
```bash
# Upload 'out' folder contents via FTP to:
# public_html/ or www/ or htdocs/
```

Works with: GitHub Pages, AWS S3, Google Cloud, shared hosting, VPS, etc.

## 🧪 Test Locally

```bash
npm run build:static
npx serve out -p 8080
# Open http://localhost:8080
```

## ✅ Production Checklist

- [ ] Chrome Canary with LanguageModel flags enabled
- [ ] HTTPS enabled (required for some features)
- [ ] Files serve from root domain or subdirectory
- [ ] Test offline functionality

## 🔧 Troubleshooting

**Build fails?**
```bash
npm run clean
npm install
npm run build:static
```

**LanguageModel not working?**
1. Use Chrome Canary
2. Enable: `chrome://flags/#prompt-api-for-gemini-nano`
3. Update model: `chrome://components/`
4. Restart browser

**Files missing?**
- Check `out/sql-wasm.wasm` exists
- Verify `out/index.html` is ~10KB
- Ensure `out/_next/static/` has CSS/JS files

## 📊 What Works Offline

✅ Invoice extraction with LanguageModel  
✅ SQLite database storage  
✅ All UI functionality  
✅ Data persistence  
✅ PWA installation  

## 🎯 That's It!

Your Shaw AI app is now a static website that works completely offline. No Node.js server required in production!

**File size**: 1.9MB total  
**Load time**: < 3 seconds on 3G  
**Works offline**: 100% after first load  
