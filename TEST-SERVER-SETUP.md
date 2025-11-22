# Test Server Setup Guide

## Quick Start

1. **Start the test server:**
   ```bash
   npm run test-server
   ```
   The server will start on `http://localhost:8080`

2. **Place your game files in `test-server-files/` directory:**
   - Copy your game files matching the paths in your manifest
   - Update `test-server-files/roleplayai_manifest.json` with correct file paths and sizes
   - Update `test-server-files/version.json` with your version

3. **Switch launcher to test mode:**
   - Open `renderer.js`
   - Find the `manifestUrl` and `versionUrl` in the `gameLibrary` object (around line 162-163)
   - Comment out the production URLs and uncomment the test server URLs:
   ```javascript
   // PRODUCTION URLs (default)
   // manifestUrl: 'https://vrcentre.com.au/RolePlay_Ai/RolePlay_AI_Package/roleplayai_manifest.json',
   // versionUrl: 'https://vrcentre.com.au/RolePlay_Ai/RolePlay_AI_Package/1.0.0.2/version.json',
   // TEST SERVER URLs (uncomment to use local test server)
   manifestUrl: 'http://localhost:8080/roleplayai_manifest.json',
   versionUrl: 'http://localhost:8080/version.json',
   ```

4. **Start the launcher:**
   ```bash
   npm start
   ```

## Directory Structure

Your `test-server-files/` directory should look like this:

```
test-server-files/
├── roleplayai_manifest.json    # Your manifest file
├── version.json                 # Version file
├── README.md                    # Instructions
└── [your game files]            # Place files matching manifest paths
```

## Example Manifest Setup

If your manifest has:
```json
{
  "path": "RolePlay_AI.exe",
  "url": "http://localhost:8080/RolePlay_AI.exe"
}
```

Then place `RolePlay_AI.exe` directly in `test-server-files/`

If your manifest has:
```json
{
  "path": "AFEOS/Binaries/Win64/AFEOS.exe",
  "url": "http://localhost:8080/AFEOS/Binaries/Win64/AFEOS.exe"
}
```

Then create the directory structure:
```
test-server-files/
└── AFEOS/
    └── Binaries/
        └── Win64/
            └── AFEOS.exe
```

## Important Notes

- **File sizes**: Make sure your manifest includes the `size` field for each file (in bytes)
- **URLs**: All URLs in the manifest should point to `http://localhost:8080/[path]`
- **Keep server running**: The test server must be running while testing the launcher
- **Switch back**: Remember to switch back to production URLs before deploying!

## Testing Checklist

- [ ] Test server is running on port 8080
- [ ] All game files are in `test-server-files/` with correct paths
- [ ] Manifest URLs point to `http://localhost:8080/...`
- [ ] Launcher URLs are set to test server
- [ ] Version numbers match between manifest and version.json

## Troubleshooting

**Port already in use:**
- Change the port in `test-server.js` (line 9: `port: 8080`)
- Update URLs accordingly

**404 errors:**
- Check file paths match exactly (case-sensitive on some systems)
- Verify files are in the correct directory structure
- Check the server console for requested paths

**CORS errors:**
- The test server already handles CORS, but if you see issues, check the headers in `test-server.js`

