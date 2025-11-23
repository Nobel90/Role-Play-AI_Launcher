// verifierWorker.js
// Worker thread for file verification to keep UI responsive

const { parentPort, workerData } = require('worker_threads');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Hash a buffer using SHA256
 */
function hashBuffer(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Tier 1: Instant Check (Metadata)
 * Check file existence and size only
 */
async function verifyTier1(files, installPath, checkCancelled = null) {
    const failedFiles = [];
    
    for (let i = 0; i < files.length; i++) {
        // Check for cancellation
        if (checkCancelled && checkCancelled()) {
            break;
        }
        
        const file = files[i];
        const filePath = path.join(installPath, file.filename);
        
        try {
            const stats = await fs.stat(filePath);
            
            // Check if size matches
            if (stats.size !== file.totalSize) {
                failedFiles.push({
                    filename: file.filename,
                    reason: 'size_mismatch',
                    localSize: stats.size,
                    expectedSize: file.totalSize
                });
            }
        } catch (error) {
            // File doesn't exist or can't be accessed
            failedFiles.push({
                filename: file.filename,
                reason: 'not_found',
                error: error.message
            });
        }
        
        // Send progress update
        if (parentPort) {
            parentPort.postMessage({
                type: 'progress',
                tier: 1,
                checked: i + 1,
                total: files.length,
                currentFile: file.filename
            });
        }
    }
    
    return failedFiles;
}

/**
 * Tier 2: Smart Sparse Check (Random Sampling)
 * Read and verify 5 random chunks from each file
 */
async function verifyTier2(files, installPath, checkCancelled = null) {
    const failedFiles = [];
    
    for (let i = 0; i < files.length; i++) {
        // Check for cancellation
        if (checkCancelled && checkCancelled()) {
            break;
        }
        
        const file = files[i];
        const filePath = path.join(installPath, file.filename);
        
        // Skip if file has no chunks
        if (!file.chunks || file.chunks.length === 0) {
            continue;
        }
        
        let fd = null;
        try {
            // Open file for reading
            fd = await fs.open(filePath, 'r');
            
            // Pick 5 random chunks (or all chunks if less than 5)
            const numChunksToCheck = Math.min(5, file.chunks.length);
            const chunkIndices = [];
            
            if (file.chunks.length <= 5) {
                // Check all chunks if 5 or fewer
                for (let j = 0; j < file.chunks.length; j++) {
                    chunkIndices.push(j);
                }
            } else {
                // Randomly select 5 chunks
                const indices = new Set();
                while (indices.size < numChunksToCheck) {
                    indices.add(Math.floor(Math.random() * file.chunks.length));
                }
                chunkIndices.push(...Array.from(indices));
            }
            
            // Verify each selected chunk
            let hasFailedChunk = false;
            
            for (const chunkIndex of chunkIndices) {
                // Check for cancellation
                if (checkCancelled && checkCancelled()) {
                    hasFailedChunk = true; // Mark as failed to stop processing
                    break;
                }
                
                const chunk = file.chunks[chunkIndex];
                
                try {
                    // Read only the specific chunk bytes
                    const buffer = Buffer.alloc(chunk.size);
                    const result = await fd.read(buffer, 0, chunk.size, chunk.offset);
                    
                    if (result.bytesRead !== chunk.size) {
                        hasFailedChunk = true;
                        break;
                    }
                    
                    // Hash the chunk
                    const calculatedHash = hashBuffer(buffer);
                    
                    // Compare with manifest hash
                    if (calculatedHash !== chunk.hash) {
                        hasFailedChunk = true;
                        break;
                    }
                } catch (chunkError) {
                    // Error reading chunk - mark file as failed
                    hasFailedChunk = true;
                    break;
                }
            }
            
            // If any chunk failed, mark entire file as needing update
            if (hasFailedChunk) {
                failedFiles.push({
                    filename: file.filename,
                    reason: 'chunk_mismatch',
                    checkedChunks: chunkIndices.length
                });
            }
            
        } catch (error) {
            // File can't be opened or read
            failedFiles.push({
                filename: file.filename,
                reason: 'read_error',
                error: error.message
            });
        } finally {
            // Always close the file descriptor
            if (fd !== null) {
                try {
                    await fd.close();
                } catch (closeError) {
                    // Ignore close errors
                }
            }
        }
        
        // Send progress update
        if (parentPort) {
            parentPort.postMessage({
                type: 'progress',
                tier: 2,
                checked: i + 1,
                total: files.length,
                currentFile: file.filename
            });
        }
    }
    
    return failedFiles;
}

/**
 * Tier 3: Deep Verify (Repair Mode)
 * Read entire file and verify all chunks
 */
async function verifyTier3(files, installPath, checkCancelled = null) {
    const failedFiles = [];
    
    for (let i = 0; i < files.length; i++) {
        // Check for cancellation
        if (checkCancelled && checkCancelled()) {
            break;
        }
        
        const file = files[i];
        const filePath = path.join(installPath, file.filename);
        
        // Skip if file has no chunks
        if (!file.chunks || file.chunks.length === 0) {
            continue;
        }
        
        let fd = null;
        try {
            // Open file for reading
            fd = await fs.open(filePath, 'r');
            
            const failedChunks = [];
            
            // Verify each chunk in the file
            for (let chunkIndex = 0; chunkIndex < file.chunks.length; chunkIndex++) {
                // Check for cancellation
                if (checkCancelled && checkCancelled()) {
                    break;
                }
                
                const chunk = file.chunks[chunkIndex];
                
                try {
                    // Read the chunk bytes
                    const buffer = Buffer.alloc(chunk.size);
                    const result = await fd.read(buffer, 0, chunk.size, chunk.offset);
                    
                    if (result.bytesRead !== chunk.size) {
                        failedChunks.push({
                            index: chunkIndex,
                            hash: chunk.hash,
                            reason: 'read_incomplete',
                            bytesRead: result.bytesRead,
                            expectedSize: chunk.size
                        });
                        continue;
                    }
                    
                    // Hash the chunk
                    const calculatedHash = hashBuffer(buffer);
                    
                    // Compare with manifest hash
                    if (calculatedHash !== chunk.hash) {
                        failedChunks.push({
                            index: chunkIndex,
                            hash: chunk.hash,
                            calculatedHash: calculatedHash,
                            reason: 'hash_mismatch'
                        });
                    }
                } catch (chunkError) {
                    failedChunks.push({
                        index: chunkIndex,
                        hash: chunk.hash,
                        reason: 'read_error',
                        error: chunkError.message
                    });
                }
            }
            
            // If any chunks failed, mark file as needing update
            if (failedChunks.length > 0) {
                failedFiles.push({
                    filename: file.filename,
                    reason: 'chunks_failed',
                    failedChunks: failedChunks.length,
                    totalChunks: file.chunks.length,
                    details: failedChunks
                });
            }
            
        } catch (error) {
            // File can't be opened or read
            failedFiles.push({
                filename: file.filename,
                reason: 'read_error',
                error: error.message
            });
        } finally {
            // Always close the file descriptor
            if (fd !== null) {
                try {
                    await fd.close();
                } catch (closeError) {
                    // Ignore close errors
                }
            }
        }
        
        // Send progress update
        if (parentPort) {
            parentPort.postMessage({
                type: 'progress',
                tier: 3,
                checked: i + 1,
                total: files.length,
                currentFile: file.filename
            });
        }
    }
    
    return failedFiles;
}

/**
 * Main worker message handler
 */
if (parentPort) {
    let cancelled = false;
    
    // Helper function to check cancellation
    function checkCancelled() {
        return cancelled;
    }
    
    parentPort.on('message', async (message) => {
        try {
            // Handle cancellation
            if (message.type === 'cancel') {
                cancelled = true;
                parentPort.postMessage({
                    type: 'cancelled'
                });
                return;
            }
            
            const { type, files, installPath } = message;
            
            // Reset cancellation flag for new verification
            cancelled = false;
            
            let result;
            
            switch (type) {
                case 'tier1':
                    result = await verifyTier1(files, installPath, checkCancelled);
                    break;
                case 'tier2':
                    result = await verifyTier2(files, installPath, checkCancelled);
                    break;
                case 'tier3':
                    result = await verifyTier3(files, installPath, checkCancelled);
                    break;
                default:
                    throw new Error(`Unknown verification type: ${type}`);
            }
            
            // Check if cancelled before sending result
            if (cancelled) {
                parentPort.postMessage({
                    type: 'cancelled'
                });
                return;
            }
            
            // Send result back to main thread
            parentPort.postMessage({
                type: 'result',
                tier: type.replace('tier', ''),
                failedFiles: result
            });
            
        } catch (error) {
            // Send error back to main thread
            parentPort.postMessage({
                type: 'error',
                error: error.message,
                stack: error.stack
            });
        }
    });
}

