# Troubleshooting Guide

## Test Server Not Running

### Check if server is running:
```bash
npm run test-server-status
```

### Start the test server:
```bash
npm run test-server
```

You should see:
```
==================================================
Test Server Started
==================================================
Server: http://localhost:8080
Serving from: D:\VR Centre\Perforce\RolePlay_AI\Package\noChubks\Windows
==================================================
```

**Keep this terminal window open!** The server must stay running.

## Common Issues

### 1. "Download didn't happen"

**Checklist:**
- [ ] Test server is running (`npm run test-server-status`)
- [ ] Launcher is using test URLs (check `renderer.js` lines 166-167)
- [ ] Manifest file exists at `test-server-files/roleplayai_manifest.json`
- [ ] Check launcher console (F12 in Electron) for errors

**To check launcher console:**
1. In Electron, press `Ctrl+Shift+I` or `F12` to open DevTools
2. Go to Console tab
3. Look for errors or network requests

### 2. "Connection refused" or "ECONNREFUSED"

**Solution:** Start the test server:
```bash
npm run test-server
```

### 3. "404 File not found"

**Check:**
- Files exist in the Unreal package directory
- Manifest paths match actual file paths
- Regenerate manifest: `npm run generate-test-manifest`

### 4. Launcher shows "Checking for updates..." but nothing happens

**Possible causes:**
- Server not running
- Wrong manifest URL
- Network error (check console)

**Debug steps:**
1. Open launcher DevTools (F12)
2. Check Console for errors
3. Check Network tab for failed requests
4. Verify server is running: `npm run test-server-status`

### 5. Port 8080 already in use

**Solution:** Change port in `test-server.js`:
```javascript
port: 8081,  // Change from 8080 to 8081
```

Then update URLs in `renderer.js`:
```javascript
manifestUrl: 'http://localhost:8081/roleplayai_manifest.json',
versionUrl: 'http://localhost:8081/version.json',
```

## Testing the Server Manually

### Test 1: Check server status
```bash
npm run test-server-status
```

### Test 2: Test in browser
Open in browser: `http://localhost:8080/version.json`

Should show:
```json
{
  "version": "1.0.0"
}
```

### Test 3: Test manifest
Open in browser: `http://localhost:8080/roleplayai_manifest.json`

Should show the full manifest with all files.

## Debug Mode

### Enable verbose logging in launcher:
1. Open `main.js`
2. Look for `log.transports.file.level`
3. Set to `"debug"` for more detailed logs

### Check Electron logs:
Logs are usually in:
- Windows: `%APPDATA%\role-play-ai-launcher\logs\`

## Quick Verification Steps

1. **Server running?**
   ```bash
   npm run test-server-status
   ```

2. **Manifest accessible?**
   - Browser: `http://localhost:8080/roleplayai_manifest.json`
   - Should show JSON, not 404

3. **Launcher configured?**
   - Check `renderer.js` lines 166-167
   - Should have test URLs uncommented

4. **Files exist?**
   - Check `D:\VR Centre\Perforce\RolePlay_AI\Package\noChubks\Windows`
   - Files should be there

5. **Check launcher console:**
   - Press F12 in Electron
   - Look for errors in Console tab
   - Check Network tab for failed requests

