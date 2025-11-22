// build-chunk-manifest.js
// Builder script to generate chunk-based manifests from Unreal .pak files

const { ChunkManager } = require('./chunkManager');
const { createChunkManifest } = require('./manifestUtils');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

/**
 * Configuration
 */
const config = {
    // Base URL for chunk CDN
    cdnBaseUrl: process.env.CDN_BASE_URL || 'https://vrcentre.com.au/RolePlay_Ai/RolePlay_AI_Package/chunks',
    
    // Directory containing .pak files to process
    pakFilesDir: process.env.PAK_FILES_DIR || path.join(process.cwd(), 'pak_files'),
    
    // Output directory for chunks
    chunksOutputDir: process.env.CHUNKS_OUTPUT_DIR || path.join(process.cwd(), 'chunks_output'),
    
    // Output directory for manifests
    manifestOutputDir: process.env.MANIFEST_OUTPUT_DIR || process.cwd(),
    
    // Version for the manifest
    version: process.env.VERSION || '1.0.0',
    
    // Whether to upload chunks to CDN (requires CDN_UPLOAD_URL and credentials)
    uploadToCDN: process.env.UPLOAD_TO_CDN === 'true',
    
    // CDN upload configuration (if uploadToCDN is true)
    cdnUploadUrl: process.env.CDN_UPLOAD_URL,
    cdnApiKey: process.env.CDN_API_KEY,
};

/**
 * Upload a chunk to CDN
 */
async function uploadChunkToCDN(chunkHash, chunkData, chunkPath) {
    if (!config.uploadToCDN || !config.cdnUploadUrl) {
        console.log(`Skipping CDN upload for chunk ${chunkHash} (upload disabled or URL not configured)`);
        return null;
    }

    try {
        // This is a placeholder - implement your CDN upload logic here
        // For example, using AWS S3, Azure Blob, or your custom CDN API
        // Note: For production, you may want to use a library like 'form-data' for multipart uploads
        // or use the CDN's specific SDK (e.g., AWS SDK, Azure SDK)
        
        // Example using axios with buffer (adjust based on your CDN API)
        const response = await axios.put(
            `${config.cdnUploadUrl}/chunks/${chunkHash.substring(0, 2)}/${chunkHash}`,
            chunkData,
            {
                headers: {
                    'Authorization': `Bearer ${config.cdnApiKey}`,
                    'Content-Type': 'application/octet-stream'
                }
            }
        );

        return response.data.url || `${config.cdnBaseUrl}/${chunkHash.substring(0, 2)}/${chunkHash}`;
    } catch (error) {
        console.error(`Failed to upload chunk ${chunkHash} to CDN:`, error.message);
        // Return local path as fallback
        return `${config.cdnBaseUrl}/${chunkHash.substring(0, 2)}/${chunkHash}`;
    }
}

/**
 * Process a single .pak file and generate chunks
 */
async function processPakFile(pakFilePath, chunkManager) {
    console.log(`\n📦 Processing: ${path.basename(pakFilePath)}`);
    
    const stats = await fs.stat(pakFilePath);
    console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    // Generate chunks
    console.log(`   Generating chunks...`);
    const chunks = await chunkManager.chunkLocalFile(pakFilePath);
    console.log(`   Generated ${chunks.length} chunks`);

    // Store chunks locally
    const fileChunks = [];
    let offset = 0;

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkPath = path.join(config.chunksOutputDir, chunk.hash.substring(0, 2), chunk.hash);
        const chunkDir = path.dirname(chunkPath);

        // Create directory if it doesn't exist
        await fs.mkdir(chunkDir, { recursive: true });

        // Write chunk to disk
        await fs.writeFile(chunkPath, chunk.data);

        // Upload to CDN if configured
        let chunkUrl;
        if (config.uploadToCDN) {
            chunkUrl = await uploadChunkToCDN(chunk.hash, chunk.data, chunkPath);
        } else {
            // Use local CDN URL structure
            chunkUrl = `${config.cdnBaseUrl}/${chunk.hash.substring(0, 2)}/${chunk.hash}`;
        }

        fileChunks.push({
            hash: chunk.hash,
            size: chunk.size,
            offset: offset,
            url: chunkUrl
        });

        offset += chunk.size;

        if ((i + 1) % 100 === 0) {
            console.log(`   Processed ${i + 1}/${chunks.length} chunks...`);
        }
    }

    console.log(`   ✅ Completed processing ${chunks.length} chunks`);

    return {
        filename: path.basename(pakFilePath),
        totalSize: stats.size,
        chunks: fileChunks
    };
}

/**
 * Main function to build chunk manifest
 */
async function buildChunkManifest() {
    console.log('🚀 Starting Chunk Manifest Builder');
    console.log('=====================================\n');
    console.log(`Version: ${config.version}`);
    console.log(`Pak Files Directory: ${config.pakFilesDir}`);
    console.log(`Chunks Output Directory: ${config.chunksOutputDir}`);
    console.log(`Manifest Output Directory: ${config.manifestOutputDir}`);
    console.log(`Upload to CDN: ${config.uploadToCDN ? 'Yes' : 'No'}\n`);

    try {
        // Initialize chunk manager
        const chunkManager = new ChunkManager({
            chunkCacheDir: config.chunksOutputDir
        });
        await chunkManager.initialize();

        // Create output directories
        await fs.mkdir(config.chunksOutputDir, { recursive: true });
        await fs.mkdir(config.manifestOutputDir, { recursive: true });

        // Find all .pak files
        const pakFiles = [];
        const entries = await fs.readdir(config.pakFilesDir, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isFile() && entry.name.toLowerCase().endsWith('.pak')) {
                pakFiles.push(path.join(config.pakFilesDir, entry.name));
            }
        }

        if (pakFiles.length === 0) {
            console.error('❌ No .pak files found in', config.pakFilesDir);
            process.exit(1);
        }

        console.log(`Found ${pakFiles.length} .pak file(s) to process\n`);

        // Process each .pak file
        const processedFiles = [];
        for (const pakFile of pakFiles) {
            try {
                const fileData = await processPakFile(pakFile, chunkManager);
                processedFiles.push(fileData);
            } catch (error) {
                console.error(`❌ Error processing ${pakFile}:`, error.message);
                throw error;
            }
        }

        // Generate manifest
        console.log('\n📝 Generating manifest...');
        const manifest = createChunkManifest(config.version, processedFiles);

        // Save manifest to file
        const manifestPath = path.join(config.manifestOutputDir, `roleplayai_manifest_v${config.version.replace(/\./g, '_')}.json`);
        await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

        console.log(`✅ Manifest saved to: ${manifestPath}`);

        // Print summary
        console.log('\n📊 Summary');
        console.log('=====================================');
        console.log(`Version: ${manifest.version}`);
        console.log(`Files: ${manifest.files.length}`);
        
        let totalChunks = 0;
        let totalSize = 0;
        for (const file of manifest.files) {
            totalChunks += file.chunks.length;
            totalSize += file.totalSize;
        }
        
        console.log(`Total Chunks: ${totalChunks}`);
        console.log(`Total Size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`Average Chunk Size: ${(totalSize / totalChunks / 1024).toFixed(2)} KB`);
        console.log('\n✅ Build complete!');

        return manifest;
    } catch (error) {
        console.error('\n❌ Build failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    buildChunkManifest().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { buildChunkManifest, processPakFile };

