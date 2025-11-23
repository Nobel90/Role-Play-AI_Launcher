# Testing Update: v1.0.1.2 → v1.0.1.3

## Current Setup ✅

- **Local Installation**: v1.0.1.2 (already set up)
- **Test Server**: Configured to serve v1.0.1.3
- **Manifest**: `roleplayai_manifest_v1.0.1.3.json`
- **Version**: `1.0.1.3` (in `test-server-files/version.json`)

## Step-by-Step Test Process

### 1. Start/Restart Test Server

**If server is already running:**
- Stop it (Ctrl+C)
- Restart it to pick up the new configuration:
  ```bash
  npm run test-server
  ```

**Verify server is serving v1.0.1.3:**
- Open browser: `http://localhost:8080/version.json`
- Should show: `{"version": "1.0.1.3"}`
- Check manifest: `http://localhost:8080/roleplayai_manifest.json`
- Should return v1.0.1.3 manifest

### 2. Start the Launcher

```bash
npm start
```

### 3. Expected Behavior on Startup

**Fast Version Check:**
- Launcher quickly checks version (should be fast, < 1 second)
- **Expected Result:**
  - Local version: `1.0.1.2`
  - Server version: `1.0.1.3`
  - **Version mismatch detected!**
  - Button should show: **"SYNC FILES"** (orange button)
  - Status text: `"Version mismatch: Local 1.0.1.2 → Server 1.0.1.3"`

### 4. Click "SYNC FILES" Button

**What happens:**
1. Button becomes disabled: **"SYNCING..."**
2. Status shows progress: `"Syncing files... X% (Y/400)"`
3. Console output shows chunk comparison for each file

**Watch the console for:**
```
--- Starting File Sync for RolePlayAI v1.0.1.3 (chunk-based) ---
📊 [filename]: Local file size: X, Server file size: Y
   Local chunks: A, Server chunks: B
   Missing chunks: C, Extra chunks: D
✅ [filename] -> All chunks match
❌ [filename] -> Needs update
```

**Expected Results:**
- Most files (395) should show: `✅ All chunks match`
- **5 files should show: `❌ Needs update`:**
  - `RolePlay_AI/Content/Paks/pakchunk0-Windows.pak`
  - `RolePlay_AI/Content/Paks/pakchunk0_s1-Windows.pak`
  - `RolePlay_AI/Content/Paks/pakchunk0_s2-Windows.pak`
  - `RolePlay_AI/Content/Paks/pakchunk0_s29-Windows.pak`
  - `RolePlay_AI/Content/Paks/pakchunk0_s3-Windows.pak`

### 5. After Sync Completes

**Expected Result:**
- Button changes to: **"UPDATE"** (yellow button)
- Status shows: `"Update available. 5 files, ~45 chunks to download."`
- Or: `"Update available. 5 files, X chunks to download."`

### 6. Click "UPDATE" Button

**What happens:**
1. Button becomes disabled
2. Download progress shows:
   - `"Downloading chunks: X/Y"`
   - Progress bar showing download percentage
3. After chunks download, shows:
   - `"Reconstructing files: X%"`
   - Progress bar for file reconstruction

**Expected Download Stats:**
- **Chunks to download**: ~45 chunks
- **Download size**: ~368 MB (not 5.11 GB!)
- **Bandwidth saved**: ~92.96%

### 7. Monitor Console Output

**Look for these messages:**

```
--- Starting Download for RolePlayAI v1.0.1.3 (chunk-based) ---
Downloading chunks: 1/45
Downloading chunks: 2/45
...
Downloading chunks: 45/45
Reconstructing files: 0%
Reconstructing files: 20%
...
Reconstructing files: 100%
✅ Download complete!
```

### 8. After Update Completes

**Expected Result:**
- Button changes to: **"LAUNCH"** (green button)
- Status shows: `"Ready to Launch!"`
- Local `version.json` should be updated to `1.0.1.3`

**Verify the update:**
1. Check `[InstallPath]/version.json`:
   ```json
   {"version": "1.0.1.3"}
   ```
2. Check the 5 modified pak files - they should have new timestamps
3. Verify file sizes match the v1.0.1.3 manifest

### 9. Launch the Game

Click **"LAUNCH"** to verify the game runs with the updated files.

## Expected Console Output Summary

```
--- Fast Version Check for RolePlayAI ---
Local: 1.0.1.2, Server: 1.0.1.3, Mismatch: true

--- Starting File Sync for RolePlayAI v1.0.1.3 (chunk-based) ---
📊 [file1]: Local chunks: X, Server chunks: Y, Missing chunks: Z
✅ [395 files] -> All chunks match
❌ [5 files] -> Needs update
   Reasons: Missing chunks: X, Extra chunks: Y

--- Update Check Complete. Found 5 files to update. ---

--- Starting Download for RolePlayAI v1.0.1.3 (chunk-based) ---
Downloading chunks: 45/45
Reconstructing files: 100%
✅ Download complete!
```

## Troubleshooting

### Issue: "All files match" when they shouldn't
- **Check**: Is your local installation actually v1.0.1.2?
- **Solution**: Verify `[InstallPath]/version.json` shows `1.0.1.2`

### Issue: Download size is too large
- **Check**: Are chunks being downloaded or full files?
- **Solution**: Verify console shows "Downloading chunks" not "Downloading files"

### Issue: Server not responding
- **Check**: Is test server running?
- **Solution**: Run `node test-server-status.js` or check `http://localhost:8080/version.json`

### Issue: Wrong number of files to update
- **Expected**: 5 files (the 5 modified pak files)
- **If different**: Check console output to see which files are flagged

## Success Criteria ✅

- [ ] Version mismatch detected on startup
- [ ] "SYNC FILES" button appears
- [ ] Sync identifies exactly 5 files needing update
- [ ] Download shows ~45 chunks (~368 MB)
- [ ] Bandwidth saved: ~92.96%
- [ ] Files reconstructed successfully
- [ ] Local version.json updated to 1.0.1.3
- [ ] Game launches successfully

## Next Steps

After successful testing:
1. You can test the reverse (v1.0.1.3 → v1.0.1.2) by switching server back
2. Test with different chunk sizes
3. Test with more file changes
4. Prepare for production deployment

