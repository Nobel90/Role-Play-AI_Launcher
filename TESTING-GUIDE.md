# Testing Guide: Chunk-Based Updates (v1.0.1.2 → v1.0.1.3)

## Prerequisites

1. **Test Server**: Must be running on `http://localhost:8080`
2. **Test Installation**: A local game installation directory with v1.0.1.2 files
3. **Launcher**: The updated launcher with chunk-based support

## Step 1: Start the Test Server

### Option A: Using the Batch File
```bash
START-TEST-SERVER.bat
```

### Option B: Using npm
```bash
npm run test-server
```

**Verify the server is running:**
- Open browser: `http://localhost:8080/version.json`
- Should show: `{"version": "1.0.1.2"}`
- Check manifest: `http://localhost:8080/roleplayai_manifest.json`
- Should return the v1.0.1.2 manifest

## Step 2: Set Up Test Installation

### Option A: Use Existing Installation
If you have an existing installation at `D:\VR Centre\RolePlay Test\RolePlayAI_v1.0.1.0`:
1. Copy it to a new location: `D:\VR Centre\RolePlay Test\RolePlayAI_v1.0.1.2`
2. Create/update `version.json` in that directory:
   ```json
   {"version": "1.0.1.2"}
   ```

### Option B: Fresh Installation
1. Create a new directory: `D:\VR Centre\RolePlay Test\RolePlayAI_v1.0.1.2`
2. Copy game files from: `D:\VR Centre\Perforce\RolePlay_AI\Package\300MB_Chunks\Windows`
3. Create `version.json` in the root:
   ```json
   {"version": "1.0.1.2"}
   ```

## Step 3: Configure Launcher for Testing

### Update renderer.js (if using local test server)
Make sure the launcher is configured to use the local test server:

```javascript
// In renderer.js, look for these URLs:
const LOCAL_TEST_SERVER = 'http://localhost:8080';
const PRODUCTION_SERVER = 'https://your-production-server.com';

// Use LOCAL_TEST_SERVER for testing
const manifestUrl = `${LOCAL_TEST_SERVER}/roleplayai_manifest.json`;
const versionUrl = `${LOCAL_TEST_SERVER}/version.json`;
```

## Step 4: Test Scenarios

### Test 1: Fast Version Check (Startup)
1. **Start the launcher**: `npm start`
2. **Expected Behavior**:
   - Launcher should quickly check version (fast, no chunk matching)
   - If version matches (1.0.1.2), button shows "LAUNCH"
   - If version mismatches, button shows "SYNC FILES"

### Test 2: Version Mismatch Detection
1. **Update server version** to 1.0.1.3:
   - Edit `test-server-files/version.json`: `{"version": "1.0.1.3"}`
   - Update `test-server.js` to serve v1.0.1.3 manifest (change line 113 to v1.0.1.3)
2. **Restart launcher**
3. **Expected Behavior**:
   - Fast version check detects mismatch
   - Button changes to "SYNC FILES"
   - Status shows: "Version mismatch: Local 1.0.1.2 → Server 1.0.1.3"

### Test 3: Sync Files (Chunk Matching)
1. **Click "SYNC FILES" button**
2. **Expected Behavior**:
   - Button becomes disabled: "SYNCING..."
   - Status shows progress: "Syncing files... X% (Y/400)"
   - Console shows chunk comparison for each file
   - After completion:
     - If updates needed: Button changes to "UPDATE"
     - If no updates: Button changes to "LAUNCH"

### Test 4: Delta Update Download
1. **After sync detects updates, click "UPDATE"**
2. **Expected Behavior**:
   - Download progress shows:
     - "Downloading chunks: X/Y"
     - "Reconstructing files: X%"
   - Only missing chunks are downloaded (should be ~45 chunks, ~368 MB)
   - Files are reconstructed from chunks
   - After completion: Button shows "LAUNCH"

### Test 5: Verify Update
1. **Check local version.json**: Should be updated to `1.0.1.3`
2. **Check modified files**: The 5 modified pak files should be updated
3. **Launch game**: Should work with new version

## Step 5: Monitor Console Output

### Launcher Console (Main Process)
Look for:
```
--- Fast Version Check for RolePlayAI ---
Local: 1.0.1.2, Server: 1.0.1.3, Mismatch: true

--- Starting File Sync for RolePlayAI v1.0.1.3 (chunk-based) ---
📊 [filename]: Local chunks: X, Server chunks: Y, Missing chunks: Z
✅ [filename] -> All chunks match
❌ [filename] -> Needs update
```

### Test Server Console
Look for:
```
200: GET /version.json
200: GET /roleplayai_manifest.json
200: GET /chunks/[chunk-hash]
```

## Expected Results

### Delta Update Statistics (v1.0.1.2 → v1.0.1.3)
- **Files Modified**: 5 pak files
- **Chunks to Download**: ~45 chunks
- **Download Size**: ~368 MB (vs 5.11 GB full download)
- **Bandwidth Saved**: ~92.96%
- **Shared Chunks**: ~949 chunks (already cached)

## Troubleshooting

### Issue: "Version mismatch" but no updates found
- **Check**: Are the local files actually v1.0.1.2?
- **Solution**: Verify `version.json` in installation directory

### Issue: Server not responding
- **Check**: Is test server running on port 8080?
- **Solution**: Run `npm run test-server-status` or check `http://localhost:8080/version.json`

### Issue: All files match when they shouldn't
- **Check**: Are you using the correct test installation?
- **Solution**: Make sure local installation is v1.0.1.2, not v1.0.1.3

### Issue: Chunk download fails
- **Check**: Are chunks stored in `test-server-files/chunks/`?
- **Solution**: Verify chunks were generated during manifest creation

## Quick Test Checklist

- [ ] Test server running on port 8080
- [ ] Server serves v1.0.1.2 manifest and version
- [ ] Local installation has v1.0.1.2 files and version.json
- [ ] Launcher detects version mismatch on startup
- [ ] "SYNC FILES" button works and shows progress
- [ ] Chunk matching identifies 5 files needing update
- [ ] Update downloads only ~45 chunks (~368 MB)
- [ ] Files are reconstructed successfully
- [ ] Game launches with v1.0.1.3

## Next: Test v1.0.1.3 → v1.0.1.4

To test the reverse (or another update):
1. Update server to serve v1.0.1.3 manifest
2. Update local installation to v1.0.1.3
3. Change server version to 1.0.1.4
4. Repeat the test process

