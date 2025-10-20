# Ledgee - Deployment Guide

Ledgee is a **100% client-side, offline-first** web application. No server required!

## 🚀 Quick Deploy

```bash
# Build static files
npm run build:static

# Deploy the 'out' folder to any static host!
```

## 📁 What Gets Deployed

After building, you'll have a `out/` folder containing:

```
out/
├── index.html              # Main app entry point
├── _next/
│   ├── static/
│   │   ├── css/            # Stylesheets
│   │   ├── chunks/         # JavaScript bundles
│   │   └── media/          # Assets
├── favicon.svg             # App icon
├── sql-wasm.wasm          # SQLite WebAssembly
├── manifest.json          # PWA manifest
└── 404.html               # Error page
```

**Total size**: ~500KB (tiny!)

## 🌐 Deployment Options

### 1. **Vercel** (Recommended - Zero Config)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy from project root
vercel

# Follow prompts, done!
```

**Why Vercel?**
- ✅ Automatic HTTPS
- ✅ Global CDN
- ✅ Perfect for Next.js
- ✅ Free tier available

### 2. **Netlify** (Drag & Drop)

```bash
npm run build:static
```

1. Go to [netlify.com](https://netlify.com)
2. Drag `out/` folder to deploy area
3. Done! Get instant URL

**Netlify Features:**
- ✅ Instant deployment
- ✅ Form handling (future features)
- ✅ Branch previews
- ✅ Custom domains

### 3. **GitHub Pages** (Free)

```bash
# Install gh-pages
npm install -D gh-pages

# Add to package.json scripts:
"deploy:github": "npm run build:static && gh-pages -d out"

# Deploy
npm run deploy:github
```

**Access**: `https://yourusername.github.io/shawai`

### 4. **AWS S3 + CloudFront**

```bash
npm run build:static

# Upload 'out' folder to S3 bucket
aws s3 sync out/ s3://your-bucket-name --delete

# Configure CloudFront distribution
# Point to S3 bucket, enable HTTPS
```

### 5. **Traditional Web Hosting**

```bash
npm run build:static

# Upload 'out' folder contents via FTP/SFTP
# to your web host's public_html folder
```

Works with: Apache, Nginx, IIS, shared hosting, VPS, etc.

## ⚙️ Build Configuration

### Environment Variables

Create `.env.local` for build-time variables:

```env
# App configuration
NEXT_PUBLIC_APP_NAME=Ledgee
NEXT_PUBLIC_VERSION=1.0.0

# Analytics (optional)
NEXT_PUBLIC_GA_ID=your-google-analytics-id
```

### Custom Domain Setup

1. **CNAME Record**: Point to your hosting provider
2. **A Record**: Point to hosting IP
3. **HTTPS**: Usually auto-configured by host

## 🔒 Security Headers

For production, ensure your host supports these headers:

```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline';
```

**Why needed?**
- Required for Chrome LanguageModel API
- Enables advanced browser features
- Improves security

## 📱 PWA Configuration

Ledgee is automatically configured as a PWA:

- ✅ **Offline caching** via Next.js
- ✅ **Install prompt** on supported browsers
- ✅ **App manifest** included
- ✅ **Service worker** auto-generated

### Testing PWA Features

```bash
# Serve built files locally
npm run serve:static

# Open http://localhost:8080
# Test offline functionality
# Check "Install App" option
```

## 🧪 Testing Deployment

### Local Testing

```bash
# Build and serve locally
npm run build:static
npm run serve:static

# Test on http://localhost:8080
# Verify all features work
# Test offline mode (disconnect internet)
```

### Production Testing

1. **LanguageModel API**: Requires Chrome Canary with flags
2. **HTTPS**: Some features require secure context
3. **CORS**: Ensure headers are properly set
4. **Caching**: Test offline functionality

## 📊 Performance Optimization

### Already Optimized

- ✅ **Code splitting** - Only load needed code
- ✅ **Tree shaking** - Remove unused code
- ✅ **Minification** - Compressed files
- ✅ **Static generation** - Pre-built pages

### CDN Recommendations

```bash
# Cloudflare (free tier)
# - Global CDN
# - DDoS protection
# - Analytics

# AWS CloudFront
# - Integrated with S3
# - Advanced caching rules
# - Custom domains
```

## 🚨 Troubleshooting

### Build Errors

```bash
# Clear all caches
npm run clean
npm install
npm run build:static
```

### Runtime Errors

1. **Check browser console** for specific errors
2. **Verify WASM file** is accessible at `/sql-wasm.wasm`
3. **Test LanguageModel** using debug console in app
4. **Check localStorage** permissions

### Chrome LanguageModel Issues

**Production checklist:**
- ✅ Using Chrome Canary
- ✅ Flags enabled: `chrome://flags/#prompt-api-for-gemini-nano`
- ✅ Model downloaded: `chrome://components/`
- ✅ HTTPS enabled (for production)

## 📈 Analytics & Monitoring

### Add Google Analytics

```javascript
// Add to _app.tsx or layout.tsx
import Script from 'next/script'

export default function RootLayout({ children }) {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
        `}
      </Script>
      {children}
    </>
  )
}
```

### Error Tracking

Consider adding:
- **Sentry** - Error monitoring
- **LogRocket** - Session replay
- **Hotjar** - User behavior analytics

## 🔄 CI/CD Pipeline

### GitHub Actions Example

```yaml
# .github/workflows/deploy.yml
name: Deploy Ledgee

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build static files
        run: npm run build:static
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
```

## 🎯 Best Practices

### 1. **Version Control**
- ✅ Commit built files? **NO** - Add `out/` to `.gitignore`
- ✅ Use tags for releases: `git tag v1.0.0`
- ✅ Semantic versioning

### 2. **Domain Strategy**
- 🚀 **Production**: `shawai.com`
- 🧪 **Staging**: `staging.shawai.com`  
- 👨‍💻 **Development**: `localhost:3000`

### 3. **Backup Strategy**
- ✅ **Code**: Git repository
- ✅ **User data**: Exported from localStorage
- ✅ **Configuration**: Environment variables

## 📝 Deployment Checklist

Before going live:

- [ ] ✅ Build completes without errors
- [ ] ✅ All features work in production build
- [ ] ✅ HTTPS configured
- [ ] ✅ Custom domain set up
- [ ] ✅ PWA features tested
- [ ] ✅ Chrome LanguageModel working
- [ ] ✅ Offline functionality verified
- [ ] ✅ Performance optimized
- [ ] ✅ Analytics configured
- [ ] ✅ Error monitoring set up
- [ ] ✅ Backup strategy in place

## 🆘 Support

**If deployment fails:**

1. **Check build logs** for specific errors
2. **Test locally** with `npm run serve:static`
3. **Verify environment** variables and configuration
4. **Review host documentation** for static site requirements

**Common issues:**
- Missing WASM file → Copy `sql-wasm.wasm` to output
- CORS errors → Configure security headers
- LanguageModel not working → Check Chrome flags
- Routing issues → Ensure trailing slashes configured

---

**🎉 That's it!** Ledgee is now deployed as a blazing-fast, offline-first web app with no server required.

**Live example**: `https://your-domain.com`
**Source**: Your static files work anywhere!