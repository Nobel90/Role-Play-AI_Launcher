# Quick Start - Testing with Unreal Package

## ✅ Setup Complete!

Everything is configured to test with your Unreal package at:
`D:\VR Centre\Perforce\RolePlay_AI\Package\noChubks\Windows`

## What's Been Set Up

1. ✅ **Test Server** - Configured to serve files directly from your Unreal package directory
2. ✅ **Manifest Generated** - Created `test-server-files/roleplayai_manifest.json` with all 364 files (5.56 GB)
3. ✅ **Version File** - Created `test-server-files/version.json`

## Next Steps

### 1. Switch Launcher to Test Mode

Open `renderer.js` and find lines 162-163. Comment out production URLs and uncomment test URLs:

```javascript
// Comment these:
// manifestUrl: 'https://vrcentre.com.au/RolePlay_Ai/RolePlay_AI_Package/roleplayai_manifest.json',
// versionUrl: 'https://vrcentre.com.au/RolePlay_Ai/RolePlay_AI_Package/1.0.0.2/version.json',

// Uncomment these:
manifestUrl: 'http://localhost:8080/roleplayai_manifest.json',
versionUrl: 'http://localhost:8080/version.json',
```

### 2. Start the Test Server

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

### 3. Start the Launcher

In a **new terminal window**:

```bash
npm start
```

### 4. Test the Launcher

1. Click "INSTALL" in the launcher
2. Select an installation directory
3. The launcher should detect updates and start downloading
4. Watch the test server console for file requests

## Regenerating the Manifest

If you update files in the Unreal package directory, regenerate the manifest:

```bash
npm run generate-test-manifest
```

## Troubleshooting

**Port 8080 already in use:**
- Edit `test-server.js` and change `port: 8080` to another port (e.g., `8081`)
- Update URLs in `renderer.js` accordingly

**Files not found (404 errors):**
- Check the test server console to see what paths are being requested
- Verify files exist in the Unreal package directory
- Regenerate the manifest: `npm run generate-test-manifest`

**CORS errors:**
- The test server already handles CORS, but if you see issues, check the headers in `test-server.js`

## Switching Back to Production

When done testing, switch back to production URLs in `renderer.js`:

```javascript
// Uncomment these:
manifestUrl: 'https://vrcentre.com.au/RolePlay_Ai/RolePlay_AI_Package/roleplayai_manifest.json',
versionUrl: 'https://vrcentre.com.au/RolePlay_Ai/RolePlay_AI_Package/1.0.0.2/version.json',

// Comment these:
// manifestUrl: 'http://localhost:8080/roleplayai_manifest.json',
// versionUrl: 'http://localhost:8080/version.json',
```

