// compare-manifests.js
// Compare two chunk-based manifests to analyze delta updates

const fs = require('fs');
const path = require('path');

const oldManifestPath = path.join(__dirname, 'test-server-files', 'roleplayai_manifest_v1.0.0.json');
const newManifestPath = path.join(__dirname, 'test-server-files', 'roleplayai_manifest_v1.0.4.json');
const reportPath = path.join(__dirname, 'DELTA-UPDATE-REPORT.md');

function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function compareManifests() {
    console.log('📊 Comparing Manifests');
    console.log('='.repeat(60));
    
    // Load manifests
    const oldManifest = JSON.parse(fs.readFileSync(oldManifestPath, 'utf8'));
    const newManifest = JSON.parse(fs.readFileSync(newManifestPath, 'utf8'));
    
    console.log(`Old Version: ${oldManifest.version}`);
    console.log(`New Version: ${newManifest.version}\n`);
    
    // Collect all chunk hashes from old manifest
    const oldChunkHashes = new Set();
    const oldChunksByHash = new Map();
    let oldTotalSize = 0;
    
    for (const file of oldManifest.files) {
        for (const chunk of file.chunks) {
            oldChunkHashes.add(chunk.hash);
            if (!oldChunksByHash.has(chunk.hash)) {
                oldChunksByHash.set(chunk.hash, chunk);
                oldTotalSize += chunk.size;
            }
        }
    }
    
    // Collect all chunk hashes from new manifest
    const newChunkHashes = new Set();
    const newChunksByHash = new Map();
    let newTotalSize = 0;
    
    for (const file of newManifest.files) {
        for (const chunk of file.chunks) {
            newChunkHashes.add(chunk.hash);
            if (!newChunksByHash.has(chunk.hash)) {
                newChunksByHash.set(chunk.hash, chunk);
                newTotalSize += chunk.size;
            }
        }
    }
    
    // Find shared chunks (chunks that exist in both)
    const sharedChunks = new Set();
    for (const hash of newChunkHashes) {
        if (oldChunkHashes.has(hash)) {
            sharedChunks.add(hash);
        }
    }
    
    // Find new chunks (chunks only in new manifest)
    const newChunks = new Set();
    for (const hash of newChunkHashes) {
        if (!oldChunkHashes.has(hash)) {
            newChunks.add(hash);
        }
    }
    
    // Find removed chunks (chunks only in old manifest)
    const removedChunks = new Set();
    for (const hash of oldChunkHashes) {
        if (!newChunkHashes.has(hash)) {
            removedChunks.add(hash);
        }
    }
    
    // Calculate sizes
    let sharedSize = 0;
    for (const hash of sharedChunks) {
        sharedSize += newChunksByHash.get(hash).size;
    }
    
    let newChunksSize = 0;
    for (const hash of newChunks) {
        newChunksSize += newChunksByHash.get(hash).size;
    }
    
    let removedChunksSize = 0;
    for (const hash of removedChunks) {
        removedChunksSize += oldChunksByHash.get(hash).size;
    }
    
    // File comparison
    const oldFiles = new Set(oldManifest.files.map(f => f.filename));
    const newFiles = new Set(newManifest.files.map(f => f.filename));
    
    const addedFiles = [];
    const removedFiles = [];
    const modifiedFiles = [];
    
    for (const file of newManifest.files) {
        if (!oldFiles.has(file.filename)) {
            addedFiles.push(file.filename);
        }
    }
    
    for (const file of oldManifest.files) {
        if (!newFiles.has(file.filename)) {
            removedFiles.push(file.filename);
        }
    }
    
    // Find modified files (files that exist in both but have different chunks)
    for (const newFile of newManifest.files) {
        if (oldFiles.has(newFile.filename)) {
            const oldFile = oldManifest.files.find(f => f.filename === newFile.filename);
            const oldFileChunks = new Set(oldFile.chunks.map(c => c.hash));
            const newFileChunks = new Set(newFile.chunks.map(c => c.hash));
            
            // Check if chunks are different
            if (oldFileChunks.size !== newFileChunks.size || 
                ![...newFileChunks].every(hash => oldFileChunks.has(hash))) {
                modifiedFiles.push(newFile.filename);
            }
        }
    }
    
    // Calculate delta download size (new chunks + removed chunks that need to be replaced)
    const deltaDownloadSize = newChunksSize + removedChunksSize;
    const bandwidthSavings = oldTotalSize - deltaDownloadSize;
    const bandwidthSavingsPercent = ((bandwidthSavings / oldTotalSize) * 100).toFixed(2);
    
    // Generate report
    const report = `# Delta Update Report: ${oldManifest.version} → ${newManifest.version}

Generated: ${new Date().toISOString()}

## Summary

| Metric | Value |
|--------|-------|
| **Old Version** | ${oldManifest.version} |
| **New Version** | ${newManifest.version} |
| **Total Files (Old)** | ${oldManifest.files.length} |
| **Total Files (New)** | ${newManifest.files.length} |
| **Files Added** | ${addedFiles.length} |
| **Files Removed** | ${removedFiles.length} |
| **Files Modified** | ${modifiedFiles.length} |

## Chunk Statistics

| Metric | Count | Size |
|--------|-------|------|
| **Total Chunks (Old)** | ${oldChunkHashes.size.toLocaleString()} | ${formatBytes(oldTotalSize)} |
| **Total Chunks (New)** | ${newChunkHashes.size.toLocaleString()} | ${formatBytes(newTotalSize)} |
| **Shared Chunks** | ${sharedChunks.size.toLocaleString()} | ${formatBytes(sharedSize)} |
| **New Chunks** | ${newChunks.size.toLocaleString()} | ${formatBytes(newChunksSize)} |
| **Removed Chunks** | ${removedChunks.size.toLocaleString()} | ${formatBytes(removedChunksSize)} |

## Delta Update Analysis

| Metric | Value |
|--------|-------|
| **Delta Download Size** | ${formatBytes(deltaDownloadSize)} |
| **Full Download Size (Old)** | ${formatBytes(oldTotalSize)} |
| **Full Download Size (New)** | ${formatBytes(newTotalSize)} |
| **Bandwidth Saved** | ${formatBytes(bandwidthSavings)} |
| **Bandwidth Savings** | ${bandwidthSavingsPercent}% |
| **Chunks to Download** | ${(newChunks.size + removedChunks.size).toLocaleString()} |
| **Chunks Already Cached** | ${sharedChunks.size.toLocaleString()} |

## File Changes

### Added Files (${addedFiles.length})
${addedFiles.length > 0 ? addedFiles.map(f => `- ${f}`).join('\n') : 'None'}

### Removed Files (${removedFiles.length})
${removedFiles.length > 0 ? removedFiles.map(f => `- ${f}`).join('\n') : 'None'}

### Modified Files (${modifiedFiles.length})
${modifiedFiles.length > 0 ? modifiedFiles.map(f => `- ${f}`).join('\n') : 'None'}

## Conclusion

With chunk-based delta updates, users only need to download **${formatBytes(deltaDownloadSize)}** instead of the full **${formatBytes(newTotalSize)}**, saving **${bandwidthSavingsPercent}%** bandwidth.

This means:
- **${sharedChunks.size.toLocaleString()} chunks** are already cached locally
- Only **${(newChunks.size + removedChunks.size).toLocaleString()} chunks** need to be downloaded
- Update is **${((1 - deltaDownloadSize / newTotalSize) * 100).toFixed(2)}%** smaller than a full download
`;

    // Save report
    fs.writeFileSync(reportPath, report);
    
    // Print summary
    console.log('\n📈 Comparison Results:');
    console.log('='.repeat(60));
    console.log(`Old Version: ${oldManifest.version} | New Version: ${newManifest.version}`);
    console.log(`Files: ${oldManifest.files.length} → ${newManifest.files.length} (${addedFiles.length} added, ${removedFiles.length} removed, ${modifiedFiles.length} modified)`);
    console.log(`\nChunks:`);
    console.log(`  Old: ${oldChunkHashes.size.toLocaleString()} unique chunks (${formatBytes(oldTotalSize)})`);
    console.log(`  New: ${newChunkHashes.size.toLocaleString()} unique chunks (${formatBytes(newTotalSize)})`);
    console.log(`  Shared: ${sharedChunks.size.toLocaleString()} chunks (${formatBytes(sharedSize)})`);
    console.log(`  New: ${newChunks.size.toLocaleString()} chunks (${formatBytes(newChunksSize)})`);
    console.log(`  Removed: ${removedChunks.size.toLocaleString()} chunks (${formatBytes(removedChunksSize)})`);
    console.log(`\n📥 Delta Update:`);
    console.log(`  Download Size: ${formatBytes(deltaDownloadSize)}`);
    console.log(`  Bandwidth Saved: ${formatBytes(bandwidthSavings)} (${bandwidthSavingsPercent}%)`);
    console.log(`  Chunks to Download: ${(newChunks.size + removedChunks.size).toLocaleString()}`);
    console.log(`  Chunks Already Cached: ${sharedChunks.size.toLocaleString()}`);
    console.log('='.repeat(60));
    console.log(`\n✅ Full report saved to: ${reportPath}\n`);
}

if (require.main === module) {
    compareManifests();
}

module.exports = { compareManifests };

