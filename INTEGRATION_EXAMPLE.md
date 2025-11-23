# FileVerifier Integration Example

This document shows how to integrate the new `FileVerifier` class into `main.js` to replace the current `checkChunkBasedUpdates` function.

## Step 1: Import FileVerifier

Add this import at the top of `main.js`:

```javascript
const { FileVerifier, cancelCurrentVerification } = require('./fileVerifier');
```

## Step 2: Create FileVerifier Instance

Add a global instance (similar to `chunkManager`):

```javascript
let fileVerifier = null;

// Initialize in app.whenReady() or wherever appropriate
fileVerifier = new FileVerifier();
```

## Step 3: Update Cancel Verification Handler

Update the `cancel-verification` IPC handler to use the new verifier:

```javascript
// Cancel verification handler
ipcMain.on('cancel-verification', (event) => {
    console.log('Cancellation requested for verification');
    verificationCancelled = true;
    cancelCurrentVerification(); // Add this line
    if (currentVerificationSender) {
        currentVerificationSender.send('chunk-check-error', { 
            error: 'Verification cancelled by user',
            cancelled: true 
        });
        currentVerificationSender = null;
    }
});
```

## Step 4: Replace checkChunkBasedUpdates

Replace the `checkChunkBasedUpdates` function with a new optimized version:

```javascript
async function checkChunkBasedUpdates(serverManifest, installPath, serverVersion, executableMissing, eventSender = null) {
    if (!fileVerifier) {
        fileVerifier = new FileVerifier();
    }

    const filesToUpdate = [];
    
    // Progress callback
    const onProgress = (progress) => {
        if (eventSender && !verificationCancelled) {
            eventSender.send('chunk-check-progress', {
                checked: progress.checked,
                total: progress.total,
                currentFile: progress.currentFile,
                message: progress.message
            });
        }
    };

    try {
        // Tier 1: Fast metadata check (< 200ms)
        console.log('Starting Tier 1 verification (metadata check)...');
        const tier1Result = await fileVerifier.verifyTier1(serverManifest, installPath, onProgress);
        
        // Get list of files that failed Tier 1
        const tier1FailedFiles = tier1Result.failedFiles.map(f => f.filename);
        
        // Add all failed files to update list
        for (const failedFile of tier1Result.failedFiles) {
            const file = serverManifest.files.find(f => f.filename === failedFile.filename);
            if (file) {
                filesToUpdate.push(file);
            }
        }
        
        console.log(`Tier 1 complete: ${tier1FailedFiles.length} files failed metadata check`);
        
        // If Tier 1 found issues, we can skip Tier 2 (those files need full update anyway)
        // But if Tier 1 passed, do Tier 2 for remaining files
        const tier1PassedFiles = serverManifest.files.filter(f => 
            !tier1FailedFiles.includes(f.filename)
        );
        
        if (tier1PassedFiles.length > 0 && !verificationCancelled) {
            // Create a temporary manifest with only passed files for Tier 2
            const tier2Manifest = {
                ...serverManifest,
                files: tier1PassedFiles
            };
            
            console.log('Starting Tier 2 verification (sparse chunk check)...');
            const tier2Result = await fileVerifier.verifyTier2(tier2Manifest, installPath, onProgress);
            
            // Add Tier 2 failed files to update list
            for (const failedFile of tier2Result.failedFiles) {
                const file = serverManifest.files.find(f => f.filename === failedFile.filename);
                if (file) {
                    filesToUpdate.push(file);
                }
            }
            
            console.log(`Tier 2 complete: ${tier2Result.failedFiles.length} files failed chunk verification`);
        }
        
        // Send completion update
        if (eventSender && !verificationCancelled) {
            eventSender.send('chunk-check-complete', {
                filesToUpdate: filesToUpdate.length,
                totalFiles: serverManifest.files.length
            });
        }
        
        console.log(`--- Update Check Complete. Found ${filesToUpdate.length} files to update. ---`);
        
        return {
            isUpdateAvailable: filesToUpdate.length > 0,
            manifest: serverManifest,
            manifestType: 'chunk-based',
            filesToUpdate: filesToUpdate,
            latestVersion: serverVersion,
            pathInvalid: false,
            executableMissing: executableMissing,
            message: executableMissing ? 
                `Main executable missing. Will download ${filesToUpdate.length} files including the executable.` : 
                `Found ${filesToUpdate.length} files to update.`
        };
        
    } catch (error) {
        if (error.message === 'Verification cancelled') {
            console.log('Verification cancelled by user');
            if (eventSender) {
                eventSender.send('chunk-check-error', { 
                    error: 'Verification cancelled by user',
                    cancelled: true 
                });
            }
            throw error;
        }
        
        console.error('Error during verification:', error);
        if (eventSender) {
            eventSender.send('chunk-check-error', { error: error.message });
        }
        throw error;
    }
}
```

## Step 5: Add Repair Mode (Tier 3)

For the "Repair Game" functionality, add a new IPC handler:

```javascript
ipcMain.handle('repair-game', async (event, { manifestPath, installPath }) => {
    try {
        // Load manifest
        const manifestData = await fs.readFile(manifestPath, 'utf-8');
        const { manifest } = parseManifest(manifestData);
        
        if (!fileVerifier) {
            fileVerifier = new FileVerifier();
        }
        
        // Progress callback
        const onProgress = (progress) => {
            event.sender.send('repair-progress', {
                checked: progress.checked,
                total: progress.total,
                currentFile: progress.currentFile,
                message: progress.message
            });
        };
        
        // Run Tier 3 (full verification)
        console.log('Starting Tier 3 verification (repair mode)...');
        const tier3Result = await fileVerifier.verifyTier3(manifest, installPath, onProgress);
        
        // Return list of files that need repair
        return {
            success: true,
            failedFiles: tier3Result.failedFiles,
            totalFiles: tier3Result.totalFiles
        };
        
    } catch (error) {
        console.error('Error during repair verification:', error);
        return {
            success: false,
            error: error.message
        };
    }
});
```

## Performance Benefits

- **Tier 1**: < 200ms for metadata check (file existence and size)
- **Tier 2**: Only reads 5 random chunks per file (much faster than full file read)
- **Tier 3**: Full verification only when needed (repair mode)
- **Worker Threads**: Keeps UI responsive during verification
- **Smart Filtering**: Skips Tier 2 for files that already failed Tier 1

## Notes

- The verifier automatically filters out saved folders, manifest files, launcher exe, etc. (same as original)
- Progress updates are sent via the same IPC events (`chunk-check-progress`, `chunk-check-complete`, `chunk-check-error`)
- Cancellation is supported via the existing `cancel-verification` IPC handler
- All file I/O happens in the worker thread to prevent UI blocking

