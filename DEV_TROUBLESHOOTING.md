# Shaw AI - Development Troubleshooting Guide

## 🔧 Hot Reload Issues

### Problem: Styles disappearing on file changes
**Symptoms:**
- CSS styles not loading after changes
- Page showing unstyled content
- Need to restart dev server frequently

**Solutions:**

1. **Try Turbo mode (recommended):**
   ```bash
   npm run dev
   # This now uses --turbo flag for better hot reload
   ```

2. **Fallback to legacy mode:**
   ```bash
   npm run dev:legacy
   # Uses standard Next.js dev server
   ```

3. **Clean cache and restart:**
   ```bash
   npm run dev:clean
   # Cleans .next and cache, then starts dev server
   ```

4. **Manual cleanup:**
   ```bash
   rm -rf .next
   rm -rf node_modules/.cache
   npm run dev
   ```

### Problem: 404 errors for CSS/JS chunks
**Symptoms:**
- `GET /_next/static/css/app/layout.css 404`
- `GET /_next/static/chunks/main-app.js 404`

**Solutions:**

1. **Restart dev server completely:**
   ```bash
   # Kill all node processes
   pkill -f node
   npm run dev
   ```

2. **Clear Next.js cache:**
   ```bash
   npx next clean
   npm run dev
   ```

3. **Check for port conflicts:**
   ```bash
   # Kill process on port 3000
   lsof -ti:3000 | xargs kill -9
   npm run dev
   ```

## 🤖 LanguageModel API Issues

### Problem: LanguageModel not available
**Check the debug console in the app:**
1. Click "Test Availability" button
2. Check browser console for detailed logs

**Setup Requirements:**
1. **Chrome Canary** (not regular Chrome)
2. **Enable flags:**
   - `chrome://flags/#prompt-api-for-gemini-nano` → Enabled
   - `chrome://flags/#optimization-guide-on-device-model` → Enabled BypassPerfRequirement

3. **Download model:**
   - Go to `chrome://components/`
   - Find "Optimization Guide On Device Model"
   - Click "Check for update"

4. **Restart Chrome Canary completely**

### Problem: AI extraction not working
**Debug steps:**
1. Open browser dev tools (F12)
2. Check console logs for:
   - "Raw AI Response:"
   - "Extracted AI Response Text:"
   - "Parsed invoice data:"
3. Use the debug console in the app to test extraction

## 📱 PWA/Manifest Issues

### Problem: Icon 404 errors
**Fixed in latest version** - now uses SVG favicon instead of PNG icons.

If you still see errors:
```bash
# Check if favicon.svg exists
ls -la public/favicon.svg
```

## 🗄️ Database Issues

### Problem: SQLite errors or data not persisting
**Check:**
1. Browser developer tools → Application → Local Storage
2. Look for `shawai-database` key
3. If missing or corrupted, clear storage:

```javascript
// Run in browser console
localStorage.clear();
location.reload();
```

### Problem: Invoice data not displaying
**Debug SQL issues:**
1. Open browser console
2. Look for database-related errors
3. Check if `sql-wasm.wasm` file exists in `public/` folder

```bash
ls -la public/sql-wasm.wasm
```

If missing:
```bash
cp node_modules/sql.js/dist/sql-wasm.wasm public/
```

## 🚀 Performance Issues

### Problem: Slow development server
**Solutions:**

1. **Use Turbo mode:**
   ```bash
   npm run dev  # Now uses --turbo by default
   ```

2. **Disable TypeScript checking during dev:**
   ```bash
   # In next.config.js, add:
   typescript: {
     ignoreBuildErrors: true,
   }
   ```

3. **Reduce file watching:**
   ```bash
   # Add to next.config.js webpack config:
   watchOptions: {
     poll: 1000,
     aggregateTimeout: 300,
   }
   ```

## 🔍 Common Error Messages

### `TypeError: invoices.reduce(...).toFixed is not a function`
**Fixed** - This was caused by null/undefined totals in invoice data.

### `Cannot update a component while rendering`
**Fixed** - State updates moved to proper useEffect hooks.

### `Module not found: Can't resolve 'sql.js'`
```bash
npm install sql.js
cp node_modules/sql.js/dist/sql-wasm.wasm public/
```

### `LanguageModel is not defined`
Check Chrome Canary setup and flags configuration.

## 📝 Development Best Practices

### 1. Always use Chrome Canary for development
```bash
# Check if you're using Canary
navigator.userAgent
# Should contain "Chrome" and a recent version number
```

### 2. Monitor console logs
Keep dev tools open to catch errors early:
- Console tab for JavaScript errors
- Network tab for 404/failed requests
- Application tab for storage issues

### 3. Test LanguageModel periodically
Use the debug console in the app to verify LanguageModel is working.

### 4. Clear cache when things break
```bash
# Nuclear option - clears everything
rm -rf .next
rm -rf node_modules/.cache
npm install
npm run dev
```

## 🆘 When All Else Fails

1. **Complete restart:**
   ```bash
   # Kill all node processes
   pkill -f node
   
   # Clear all caches
   rm -rf .next
   rm -rf node_modules/.cache
   
   # Restart
   npm run dev
   ```

2. **Check versions:**
   ```bash
   node --version  # Should be 18+ 
   npm --version   # Should be 9+
   ```

3. **Reinstall dependencies:**
   ```bash
   rm -rf node_modules
   rm package-lock.json
   npm install
   npm run dev
   ```

4. **Check port availability:**
   ```bash
   # Try different port
   npm run dev -- -p 3001
   ```

## 📊 Performance Monitoring

Monitor these during development:
- Memory usage in dev tools
- Hot reload speed
- LanguageModel response times
- Database operation performance

The debug console will show timing information for AI operations.

---

**Need more help?** Check the console output carefully - most issues show detailed error messages that point to the root cause.