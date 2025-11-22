// generate-chunk-manifest.js
// Generate a chunk-based manifest from all files in the Unreal package directory

const fs = require('fs').promises;
const path = require('path');
const { ChunkManager } = require('./chunkManager');
const { createChunkManifest } = require('./manifestUtils');

// Configuration
const config = {
    // Source directory (Unreal package)
    sourceGameDirectory: 'D:\\VR Centre\\Perforce\\RolePlay_AI\\Package\\noChubks\\V2\\Windows',
    
    // Where to store chunks (for test server to serve)
    chunksOutputDir: path.join(__dirname, 'test-server-files', 'chunks'),
    
    // Where to save the manifest (preserve old manifest)
    manifestOutputPath: path.join(__dirname, 'test-server-files', 'roleplayai_manifest_v1.0.4.json'),
    
    // Base URL for chunks (test server)
    chunkBaseUrl: 'http://localhost:8080/chunks',
    
    // Game version
    version: '1.0.4'
};

// Filter out non-essential files (same as launcher)
function shouldIncludeFile(relativePath) {
    const fileName = path.basename(relativePath);
    const pathString = relativePath.toLowerCase();
    
    const isSavedFolder = pathString.includes('saved/') || pathString.includes('saved\\');
    const isManifest = fileName.toLowerCase().startsWith('manifest_') && fileName.toLowerCase().endsWith('.txt');
    const isLauncher = fileName.toLowerCase() === 'roleplayai_launcher.exe';
    const isVrClassroomTxt = fileName.toLowerCase() === 'roleplayai.txt';
    const isVersionJson = fileName.toLowerCase() === 'version.json';
    
    return !(isSavedFolder || isManifest || isLauncher || isVrClassroomTxt || isVersionJson);
}

async function getAllFiles(dir) {
    const files = [];
    
    async function walkDir(currentPath) {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);
            const relativePath = path.relative(dir, fullPath);
            
            if (entry.isDirectory()) {
                await walkDir(fullPath);
            } else {
                if (shouldIncludeFile(relativePath)) {
                    files.push(fullPath);
                }
            }
        }
    }
    
    await walkDir(dir);
    return files;
}

async function generateChunkManifest() {
    console.log('🚀 Starting Chunk-Based Manifest Generation');
    console.log('='.repeat(60));
    console.log(`Source Directory: ${config.sourceGameDirectory}`);
    console.log(`Chunks Output: ${config.chunksOutputDir}`);
    console.log(`Manifest Output: ${config.manifestOutputPath}`);
    console.log(`Version: ${config.version}`);
    console.log('='.repeat(60));
    console.log();
    
    // Check if source directory exists
    try {
        await fs.access(config.sourceGameDirectory);
    } catch (error) {
        console.error(`❌ Error: Source directory not found: ${config.sourceGameDirectory}`);
        process.exit(1);
    }
    
    // Initialize chunk manager
    console.log('📦 Initializing chunk manager...');
    const chunkManager = new ChunkManager({
        chunkCacheDir: config.chunksOutputDir
    });
    await chunkManager.initialize();
    
    // Get all files
    console.log('🔍 Scanning for files...');
    const allFiles = await getAllFiles(config.sourceGameDirectory);
    console.log(`   Found ${allFiles.length} files to process\n`);
    
    if (allFiles.length === 0) {
        console.error('❌ No files found to process!');
        process.exit(1);
    }
    
    // Process each file
    const processedFiles = [];
    let totalChunks = 0;
    let totalSize = 0;
    let uniqueChunks = new Set();
    
    for (let i = 0; i < allFiles.length; i++) {
        const filePath = allFiles[i];
        const relativePath = path.relative(config.sourceGameDirectory, filePath).replace(/\\/g, '/');
        const stats = await fs.stat(filePath);
        
        console.log(`[${i + 1}/${allFiles.length}] Processing: ${relativePath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        
        try {
            // Chunk the file (chunkFile already includes data in each chunk)
            const chunks = await chunkManager.fastCDC.chunkFile(filePath);
            console.log(`   Generated ${chunks.length} chunks`);
            
            // Process chunks
            const fileChunks = [];
            let offset = 0;
            
            for (const chunk of chunks) {
                // Store chunk (deduplication happens automatically - same hash = same file)
                // Only store if we haven't seen this chunk before
                if (!uniqueChunks.has(chunk.hash)) {
                    await chunkManager.storeChunk(chunk.hash, chunk.data);
                    uniqueChunks.add(chunk.hash);
                }
                
                // Create chunk entry for manifest
                fileChunks.push({
                    hash: chunk.hash,
                    size: chunk.size,
                    offset: offset,
                    url: `${config.chunkBaseUrl}/${chunk.hash.substring(0, 2)}/${chunk.hash}`
                });
                
                offset += chunk.size;
            }
            
            processedFiles.push({
                filename: relativePath,
                totalSize: stats.size,
                chunks: fileChunks
            });
            
            totalChunks += chunks.length;
            totalSize += stats.size;
            
        } catch (error) {
            console.error(`   ❌ Error processing file: ${error.message}`);
            // Continue with other files
        }
    }
    
    console.log('\n📝 Generating manifest...');
    
    // Create manifest
    const manifest = createChunkManifest(config.version, processedFiles);
    
    // Ensure output directory exists
    const manifestDir = path.dirname(config.manifestOutputPath);
    await fs.mkdir(manifestDir, { recursive: true });
    
    // Write manifest
    await fs.writeFile(config.manifestOutputPath, JSON.stringify(manifest, null, 2));
    
    // Print summary
    console.log('\n✅ Manifest Generated Successfully!');
    console.log('='.repeat(60));
    console.log(`Version: ${manifest.version}`);
    console.log(`Files: ${manifest.files.length}`);
    console.log(`Total Chunks: ${totalChunks}`);
    console.log(`Unique Chunks: ${uniqueChunks.size}`);
    console.log(`Deduplication Ratio: ${((1 - uniqueChunks.size / totalChunks) * 100).toFixed(2)}%`);
    console.log(`Total Size: ${(totalSize / 1024 / 1024 / 1024).toFixed(2)} GB`);
    console.log(`Average Chunk Size: ${(totalSize / totalChunks / 1024).toFixed(2)} KB`);
    console.log(`Manifest saved to: ${config.manifestOutputPath}`);
    console.log('='.repeat(60));
    console.log('\n💡 Next steps:');
    console.log('   1. Make sure test server is running: npm run test-server');
    console.log('   2. Start the launcher: npm start');
    console.log('   3. The launcher will automatically detect chunk-based mode');
}

// Run if called directly
if (require.main === module) {
    generateChunkManifest().catch(error => {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { generateChunkManifest };

