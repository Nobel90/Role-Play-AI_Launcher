# Chunk-Based Download Setup Guide

## Quick Start

### Step 1: Generate Chunk-Based Manifest

Run the chunk manifest generator. This will:
- Scan all files in your Unreal package directory
- Chunk each file using FastCDC algorithm
- Store chunks in `test-server-files/chunks/`
- Generate a chunk-based manifest

```bash
npm run generate-chunk-manifest
```

**Note:** This may take a while depending on the size of your game files. The script will show progress for each file.

### Step 2: Start Test Server

In a separate terminal, start the test server:

```bash
npm run test-server
```

The server will serve:
- Manifest: `http://localhost:8080/roleplayai_manifest.json`
- Chunks: `http://localhost:8080/chunks/XX/hash...`
- Version: `http://localhost:8080/version.json`

### Step 3: Test with Launcher

Start the launcher:

```bash
npm start
```

The launcher will automatically detect that the manifest is chunk-based and use chunk-based downloads.

## What to Expect

### During Manifest Generation

You'll see output like:
```
🚀 Starting Chunk-Based Manifest Generation
============================================================
[1/364] Processing: Engine/Binaries/ThirdParty/... (12.34 MB)
   Generated 245 chunks
[2/364] Processing: ...
...
✅ Manifest Generated Successfully!
============================================================
Files: 364
Total Chunks: 125,432
Unique Chunks: 98,765
Deduplication Ratio: 21.25%
```

### During Download

The launcher will:
1. Check for existing chunks (deduplication)
2. Download only missing chunks
3. Reconstruct files from chunks
4. Show progress: "Downloading chunks: X/Y" and "Reconstructing files"

## Benefits of Chunk-Based Downloads

1. **Delta Updates**: Only changed chunks are downloaded
2. **Deduplication**: Same chunks across files are stored once
3. **Bandwidth Savings**: Significant reduction in download size for updates
4. **Resumable**: Can resume from any chunk

## Troubleshooting

### Manifest Generation Fails

- Check that the source directory path is correct in `generate-chunk-manifest.js`
- Ensure you have enough disk space for chunks
- Check file permissions

### Chunks Not Downloading

- Verify test server is running: `npm run test-server-status`
- Check that chunks directory exists: `test-server-files/chunks/`
- Check server logs for 404 errors

### Download Stuck

- Check launcher console (F12) for errors
- Verify chunk URLs in manifest are correct
- Check network connectivity

## Configuration

Edit `generate-chunk-manifest.js` to change:
- Source directory
- Chunk output directory
- Chunk base URL
- Game version

## Next Steps

Once chunk-based downloads are working:
1. Test with a small update (modify a file and regenerate manifest)
2. Verify deduplication is working (check unique chunks count)
3. Test pause/resume functionality
4. Prepare for production deployment

