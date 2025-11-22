# Manual Commit Instructions

Due to git lock file issues, please run these commands manually in your terminal:

## Step 1: Remove Lock File (if exists)
```powershell
cd "D:\Dev\VR Centre\RolePlayAI_Launcher"
Remove-Item -Force ".git\index.lock" -ErrorAction SilentlyContinue
```

## Step 2: Add Files
```powershell
git add .gitignore
git add chunkManager.js manifestUtils.js main.js renderer.js package.json
git add generate-chunk-manifest.js generate-test-manifest.js compare-manifests.js
git add test-server.js test-server-status.js build-chunk-manifest.js
git add *.md *.bat
```

## Step 3: Commit
```powershell
git commit -m "feat: Implement Content-Defined Chunking (CDC) with delta updates

- Add FastCDC chunking algorithm for content-defined chunking
- Implement chunk-based manifest system (backward compatible)
- Add chunk manager for storage, retrieval, and file reconstruction
- Support delta updates: only changed chunks are downloaded
- Add manifest comparison tool for analyzing delta updates
- Add test server and manifest generation scripts
- Update download manager to support both file-based and chunk-based downloads
- Test results: 99.41% bandwidth savings on delta update (32.42 MB vs 5.33 GB)"
```

## Step 4: Push
```powershell
git push
```

## Note
Make sure to close any git GUI applications (GitHub Desktop, SourceTree, etc.) and VS Code/Cursor git integration before running these commands.

