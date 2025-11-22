// chunkManager.js
// Content-Defined Chunking (CDC) using FastCDC algorithm

const crypto = require('crypto');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

/**
 * FastCDC implementation based on the paper:
 * "FastCDC: A Fast and Efficient Content-Defined Chunking Approach for Data Deduplication"
 * 
 * Uses Gear hash for rolling hash calculation
 */
class FastCDC {
    constructor(options = {}) {
        // Default chunk size parameters (in bytes)
        this.minSize = options.minSize || 4096;      // 4KB minimum
        this.avgSize = options.avgSize || 16384;     // 16KB average
        this.maxSize = options.maxSize || 65536;     // 64KB maximum
        
        // Mask for determining chunk boundaries
        // We want chunks around avgSize, so we calculate mask based on avgSize
        this.mask = this.calculateMask(this.avgSize);
        
        // Gear hash table (precomputed for performance)
        this.gear = this.generateGearTable();
    }
    
    /**
     * Calculate mask for chunk boundary detection
     */
    calculateMask(avgSize) {
        // Use bit manipulation to create a mask that gives us chunks around avgSize
        // This is a simplified approach - FastCDC uses more sophisticated mask calculation
        const bits = Math.floor(Math.log2(avgSize));
        return (1 << bits) - 1;
    }
    
    /**
     * Generate Gear hash table (64 random 64-bit integers)
     */
    generateGearTable() {
        const gear = new BigUint64Array(256);
        // Use a deterministic seed for reproducibility
        // In production, you might want to use the standard FastCDC gear table
        const multiplier = 0x9e3779b97f4a7c15n;
        for (let i = 0; i < 256; i++) {
            // Simplified gear table - in production use the standard FastCDC table
            // Convert i to BigInt before multiplication
            gear[i] = (BigInt(i) * multiplier) & 0xffffffffffffffffn;
        }
        return gear;
    }
    
    /**
     * Update Gear hash with a new byte
     */
    updateHash(hash, byte) {
        // FastCDC Gear hash: hash = (hash << 1) + gear[byte]
        return ((hash << 1n) + this.gear[byte]) & 0xffffffffffffffffn;
    }
    
    /**
     * Check if current position is a chunk boundary
     */
    isChunkBoundary(hash, position) {
        if (position < this.minSize) return false;
        if (position >= this.maxSize) return true; // Force boundary at max size
        
        // Check if hash matches mask pattern (simplified boundary detection)
        return (hash & BigInt(this.mask)) === 0n;
    }
    
    /**
     * Chunk a file or buffer using FastCDC
     * Returns array of chunk objects: { hash, size, offset, data }
     */
    async chunkFile(filePath) {
        const chunks = [];
        const fileHandle = await fs.open(filePath, 'r');
        const stats = await fileHandle.stat();
        const fileSize = stats.size;
        
        let offset = 0;
        let hash = 0n;
        let chunkStart = 0;
        const buffer = Buffer.alloc(65536); // 64KB read buffer
        
        while (offset < fileSize) {
            const bytesToRead = Math.min(buffer.length, fileSize - offset);
            const { bytesRead } = await fileHandle.read(buffer, 0, bytesToRead, offset);
            
            for (let i = 0; i < bytesRead; i++) {
                const byte = buffer[i];
                hash = this.updateHash(hash, byte);
                offset++;
                
                if (this.isChunkBoundary(hash, offset - chunkStart)) {
                    const chunkSize = offset - chunkStart;
                    const chunkData = Buffer.alloc(chunkSize);
                    
                    // Read the chunk data
                    await fileHandle.read(chunkData, 0, chunkSize, chunkStart);
                    
                    // Calculate SHA256 hash of chunk
                    const chunkHash = crypto.createHash('sha256').update(chunkData).digest('hex');
                    
                    chunks.push({
                        hash: chunkHash,
                        size: chunkSize,
                        offset: chunkStart,
                        data: chunkData
                    });
                    
                    chunkStart = offset;
                    hash = 0n; // Reset hash for next chunk
                }
            }
        }
        
        // Handle remaining data as final chunk
        if (chunkStart < fileSize) {
            const chunkSize = fileSize - chunkStart;
            const chunkData = Buffer.alloc(chunkSize);
            await fileHandle.read(chunkData, 0, chunkSize, chunkStart);
            const chunkHash = crypto.createHash('sha256').update(chunkData).digest('hex');
            
            chunks.push({
                hash: chunkHash,
                size: chunkSize,
                offset: chunkStart,
                data: chunkData
            });
        }
        
        await fileHandle.close();
        return chunks;
    }
    
    /**
     * Chunk a buffer in memory (for streaming)
     */
    chunkBuffer(buffer) {
        const chunks = [];
        let offset = 0;
        let hash = 0n;
        let chunkStart = 0;
        
        for (let i = 0; i < buffer.length; i++) {
            const byte = buffer[i];
            hash = this.updateHash(hash, byte);
            offset++;
            
            if (this.isChunkBoundary(hash, offset - chunkStart)) {
                const chunkSize = offset - chunkStart;
                const chunkData = buffer.slice(chunkStart, offset);
                const chunkHash = crypto.createHash('sha256').update(chunkData).digest('hex');
                
                chunks.push({
                    hash: chunkHash,
                    size: chunkSize,
                    offset: chunkStart,
                    data: chunkData
                });
                
                chunkStart = offset;
                hash = 0n;
            }
        }
        
        // Handle remaining data
        if (chunkStart < buffer.length) {
            const chunkData = buffer.slice(chunkStart);
            const chunkHash = crypto.createHash('sha256').update(chunkData).digest('hex');
            
            chunks.push({
                hash: chunkHash,
                size: chunkData.length,
                offset: chunkStart,
                data: chunkData
            });
        }
        
        return chunks;
    }
}

/**
 * Chunk Manager - Handles chunk storage, retrieval, and file reconstruction
 */
class ChunkManager {
    constructor(options = {}) {
        // chunkCacheDir should be provided by the caller (main.js)
        // Default to a relative path if not provided
        this.chunkCacheDir = options.chunkCacheDir || path.join(process.cwd(), 'chunks');
        this.fastCDC = new FastCDC(options.fastCDCOptions);
    }
    
    /**
     * Initialize chunk cache directory
     */
    async initialize() {
        try {
            await fs.mkdir(this.chunkCacheDir, { recursive: true });
        } catch (error) {
            console.error('Failed to create chunk cache directory:', error);
            throw error;
        }
    }
    
    /**
     * Get chunk file path from hash
     */
    getChunkPath(chunkHash) {
        // Use first 2 characters for directory structure to avoid too many files in one dir
        const dir = path.join(this.chunkCacheDir, chunkHash.substring(0, 2));
        return path.join(dir, chunkHash);
    }
    
    /**
     * Store a chunk to disk
     */
    async storeChunk(chunkHash, chunkData) {
        const chunkPath = this.getChunkPath(chunkHash);
        const chunkDir = path.dirname(chunkPath);
        
        try {
            await fs.mkdir(chunkDir, { recursive: true });
            await fs.writeFile(chunkPath, chunkData);
            return true;
        } catch (error) {
            console.error(`Failed to store chunk ${chunkHash}:`, error);
            return false;
        }
    }
    
    /**
     * Retrieve a chunk from disk
     */
    async getChunk(chunkHash) {
        const chunkPath = this.getChunkPath(chunkHash);
        
        try {
            const data = await fs.readFile(chunkPath);
            // Verify hash
            const calculatedHash = crypto.createHash('sha256').update(data).digest('hex');
            if (calculatedHash !== chunkHash) {
                throw new Error(`Chunk hash mismatch for ${chunkHash}`);
            }
            return data;
        } catch (error) {
            if (error.code === 'ENOENT') {
                return null; // Chunk not found
            }
            throw error;
        }
    }
    
    /**
     * Check if a chunk exists locally
     */
    async hasChunk(chunkHash) {
        const chunkPath = this.getChunkPath(chunkHash);
        try {
            await fs.access(chunkPath);
            return true;
        } catch {
            return false;
        }
    }
    
    /**
     * Chunk a local file and return chunk metadata
     */
    async chunkLocalFile(filePath) {
        return await this.fastCDC.chunkFile(filePath);
    }
    
    /**
     * Reconstruct a file from chunks
     * chunks: Array of { hash, size, offset } or { hash, data }
     */
    async reconstructFile(chunks, outputPath, onProgress = null) {
        // Sort chunks by offset if available
        const sortedChunks = [...chunks].sort((a, b) => (a.offset || 0) - (b.offset || 0));
        
        const fileHandle = await fs.open(outputPath, 'w');
        let totalWritten = 0;
        const totalSize = sortedChunks.reduce((sum, chunk) => sum + chunk.size, 0);
        
        try {
            for (let i = 0; i < sortedChunks.length; i++) {
                const chunk = sortedChunks[i];
                let chunkData;
                
                // If chunk has data, use it; otherwise retrieve from cache
                if (chunk.data) {
                    chunkData = chunk.data;
                } else {
                    chunkData = await this.getChunk(chunk.hash);
                    if (!chunkData) {
                        throw new Error(`Missing chunk: ${chunk.hash}`);
                    }
                }
                
                // Verify chunk hash
                const calculatedHash = crypto.createHash('sha256').update(chunkData).digest('hex');
                if (calculatedHash !== chunk.hash) {
                    throw new Error(`Chunk hash verification failed for ${chunk.hash}`);
                }
                
                // Write chunk to file
                const offset = chunk.offset || totalWritten;
                await fileHandle.write(chunkData, 0, chunkData.length, offset);
                totalWritten += chunkData.length;
                
                // Report progress
                if (onProgress) {
                    onProgress({
                        chunksProcessed: i + 1,
                        totalChunks: sortedChunks.length,
                        bytesWritten: totalWritten,
                        totalBytes: totalSize,
                        progress: (totalWritten / totalSize) * 100
                    });
                }
            }
        } finally {
            await fileHandle.close();
        }
        
        return {
            path: outputPath,
            size: totalWritten,
            chunksUsed: sortedChunks.length
        };
    }
    
    /**
     * Compare local file chunks with server manifest chunks
     * Returns: { missingChunks, existingChunks, totalChunks }
     */
    async compareChunks(localChunks, serverChunks) {
        const localHashes = new Set(localChunks.map(c => c.hash));
        const serverHashes = new Set(serverChunks.map(c => c.hash));
        
        const missingChunks = serverChunks.filter(c => !localHashes.has(c.hash));
        const existingChunks = serverChunks.filter(c => localHashes.has(c.hash));
        
        return {
            missingChunks,
            existingChunks,
            totalChunks: serverChunks.length,
            missingCount: missingChunks.length,
            existingCount: existingChunks.length
        };
    }
    
    /**
     * Clean up old chunks (optional - for cache management)
     */
    async cleanupOldChunks(keepHashes) {
        // Implementation for cleaning up unused chunks
        // This is optional and can be implemented later
    }
}

module.exports = { FastCDC, ChunkManager };

