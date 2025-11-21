const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

// Configuration
const baseDir = 'D:\\VR Centre\\Perforce\\RolePlay_AI\\Package\\Chunks\\v2\\Windows';
const manifestVersion = '1.0.0.3';
const baseUrl = `https://vrcentre.com.au/RolePlay_Ai/RolePlay_AI_Package/${manifestVersion}`;

// Helper function to calculate file checksum
async function getFileChecksum(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

// Helper function to get file size
function getFileSize(filePath) {
    try {
        const stats = fs.statSync(filePath);
        return stats.size;
    } catch (error) {
        console.error(`Error getting size for ${filePath}:`, error.message);
        return 0;
    }
}

// Function to scan directory and generate manifest
async function generateManifestWithSizes() {
    console.log('🔧 Generating manifest with file sizes...');
    console.log(`📁 Scanning directory: ${baseDir}`);
    
    const manifest = {
        version: manifestVersion,
        files: []
    };
    
    // Files to exclude
    const excludeFiles = [
        'generate-manifest-with-sizes.js',
        'generate-manifest-v2.js',
        'check-server-files-v2.js',
        'check-local-files-v2.js',
        'upload-v2.bat',
        'update-manifest-with-server-checksums.js',
        'analyze-mismatched-file-types.js',
        'version.json'
    ];
    
    // Directories to exclude
    const excludeDirs = [
        'node_modules',
        '.git',
        '.vscode',
        'temp',
        'cache'
    ];
    
    function scanDirectory(dir, relativePath = '') {
        try {
            const items = fs.readdirSync(dir);
            
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const relativeItemPath = path.join(relativePath, item).replace(/\\/g, '/');
                
                // Skip excluded files
                if (excludeFiles.includes(item)) {
                    console.log(`⏭️  Skipping excluded file: ${relativeItemPath}`);
                    continue;
                }
                
                const stats = fs.statSync(fullPath);
                
                if (stats.isDirectory()) {
                    // Skip excluded directories
                    if (excludeDirs.includes(item)) {
                        console.log(`⏭️  Skipping excluded directory: ${relativeItemPath}`);
                        continue;
                    }
                    
                    // Recursively scan subdirectory
                    scanDirectory(fullPath, relativeItemPath);
                } else if (stats.isFile()) {
                    // Process file
                    const fileSize = stats.size;
                    const fileUrl = `${baseUrl}/${relativeItemPath}`;
                    
                    console.log(`📄 Processing: ${relativeItemPath} (${fileSize} bytes)`);
                    
                    // Calculate checksum
                    getFileChecksum(fullPath).then(checksum => {
                        const fileInfo = {
                            path: relativeItemPath,
                            checksum: checksum,
                            size: fileSize,
                            url: fileUrl
                        };
                        
                        manifest.files.push(fileInfo);
                        
                        // Log progress
                        if (manifest.files.length % 50 === 0) {
                            console.log(`📊 Processed ${manifest.files.length} files...`);
                        }
                    }).catch(error => {
                        console.error(`❌ Error calculating checksum for ${relativeItemPath}:`, error.message);
                    });
                }
            }
        } catch (error) {
            console.error(`❌ Error scanning directory ${dir}:`, error.message);
        }
    }
    
    // Start scanning
    scanDirectory(baseDir);
    
    // Wait a bit for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Sort files by path for consistent output
    manifest.files.sort((a, b) => a.path.localeCompare(b.path));
    
    // Save manifest
    const manifestPath = path.join(baseDir, 'roleplayai_manifest_with_sizes.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    
    console.log(`\n✅ Manifest generated successfully!`);
    console.log(`📁 File: ${manifestPath}`);
    console.log(`📊 Total files: ${manifest.files.length}`);
    console.log(`📏 Total size: ${manifest.files.reduce((sum, file) => sum + file.size, 0).toLocaleString()} bytes`);
    
    // Generate version.json
    const versionInfo = {
        version: manifestVersion,
        buildDate: new Date().toISOString(),
        totalFiles: manifest.files.length,
        totalSize: manifest.files.reduce((sum, file) => sum + file.size, 0)
    };
    
    const versionPath = path.join(baseDir, 'version.json');
    fs.writeFileSync(versionPath, JSON.stringify(versionInfo, null, 2));
    
    console.log(`📄 Version file: ${versionPath}`);
    console.log(`\n🚀 Upload these files to your server:`);
    console.log(`   - roleplayai_manifest_with_sizes.json → https://vrcentre.com.au/RolePlay_Ai/RolePlay_AI_Package/roleplayai_manifest.json`);
    console.log(`   - version.json → https://vrcentre.com.au/RolePlay_Ai/RolePlay_AI_Package/${manifestVersion}/version.json`);
}

// Run the script
generateManifestWithSizes().catch(console.error);
