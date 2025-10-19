const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const readline = require('readline');

// Configuration
const manifestUrl = 'https://vrcentre.com.au/RolePlay_Ai/RolePlay_AI_Package/roleplayai_manifest.json';
const baseUrl = 'https://vrcentre.com.au/RolePlay_Ai/RolePlay_AI_Package/1.0.0.2';

// Create readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Function to ask user for input
function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

// Function to download file and calculate checksum
function downloadAndCalculateChecksum(url) {
    return new Promise((resolve, reject) => {
        console.log(`Downloading: ${url}`);
        
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                return;
            }
            
            const hash = crypto.createHash('sha256');
            let totalSize = 0;
            
            response.on('data', (chunk) => {
                hash.update(chunk);
                totalSize += chunk.length;
            });
            
            response.on('end', () => {
                const checksum = hash.digest('hex');
                resolve({
                    checksum,
                    size: totalSize,
                    status: 'success'
                });
            });
            
        }).on('error', (error) => {
            reject(error);
        });
    });
}

// Function to normalize text files (same as launcher does)
function calculateNormalizedChecksum(data) {
    const normalizedText = data.trim().replace(/\r\n/g, '\n');
    return crypto.createHash('sha256').update(normalizedText).digest('hex');
}

// Function to check if file is text-based
function isTextFile(filename) {
    const textExtensions = ['.txt', '.json', '.xml', '.html', '.css', '.js', '.glsl', '.hlsl', '.mtlx', '.ini', '.cfg', '.bat', '.sh'];
    return textExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

// Main function
async function checkFiles() {
    try {
        console.log('🔍 File Checksum Checker');
        console.log('========================\n');
        
        // Load manifest
        console.log('Loading manifest...');
        const manifestResponse = await new Promise((resolve, reject) => {
            https.get(manifestUrl, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => resolve(JSON.parse(data)));
            }).on('error', reject);
        });
        
        console.log(`✅ Manifest loaded: ${manifestResponse.files.length} files\n`);
        
        // Get files to check
        const filesToCheck = [];
        
        console.log('Enter file paths to check (one per line):');
        console.log('Examples:');
        console.log('  Engine/Binaries/ThirdParty/MaterialX/libraries/bxdf/disney_brdf_2012.mtlx');
        console.log('  Engine/Binaries/ThirdParty/MaterialX/libraries/pbrlib/genglsl/lib/mx_generate_prefilter_env.glsl');
        console.log('  RolePlay_AI/Binaries/Win64/RolePlay_AI.exe');
        console.log('\nEnter files (empty line to finish):');
        
        while (true) {
            const filePath = await askQuestion('File path: ');
            if (filePath.trim() === '') {
                break;
            }
            filesToCheck.push(filePath.trim());
        }
        
        if (filesToCheck.length === 0) {
            console.log('No files specified. Exiting.');
            rl.close();
            return;
        }
        
        console.log(`\nChecking ${filesToCheck.length} files...\n`);
        
        const results = [];
        
        for (let i = 0; i < filesToCheck.length; i++) {
            const filePath = filesToCheck[i];
            console.log(`[${i + 1}/${filesToCheck.length}] Checking: ${filePath}`);
            console.log('-'.repeat(60));
            
            // Find file in manifest
            const manifestFile = manifestResponse.files.find(f => f.path === filePath);
            
            if (!manifestFile) {
                console.log(`❌ File not found in manifest`);
                results.push({
                    file: filePath,
                    status: 'not_in_manifest',
                    manifestChecksum: null,
                    serverChecksum: null,
                    match: false
                });
                console.log('');
                continue;
            }
            
            console.log(`📋 Manifest checksum: ${manifestFile.checksum}`);
            
            // Download and calculate server checksum
            const serverUrl = `${baseUrl}/${filePath}`;
            
            try {
                const serverResult = await downloadAndCalculateChecksum(serverUrl);
                console.log(`🌐 Server checksum:  ${serverResult.checksum}`);
                console.log(`📏 File size: ${serverResult.size.toLocaleString()} bytes`);
                
                // Check if it's a text file and needs normalization
                let normalizedServerChecksum = serverResult.checksum;
                if (isTextFile(filePath)) {
                    console.log('📝 Text file detected - checking normalized checksum...');
                    
                    // For text files, we need to download the content and normalize it
                    const contentResponse = await new Promise((resolve, reject) => {
                        https.get(serverUrl, (res) => {
                            let data = '';
                            res.on('data', (chunk) => data += chunk);
                            res.on('end', () => resolve(data));
                        }).on('error', reject);
                    });
                    
                    normalizedServerChecksum = calculateNormalizedChecksum(contentResponse);
                    console.log(`🔄 Normalized checksum: ${normalizedServerChecksum}`);
                }
                
                const match = manifestFile.checksum === normalizedServerChecksum;
                console.log(`✅ Match: ${match ? 'YES' : 'NO'}`);
                
                if (!match) {
                    console.log(`⚠️  MISMATCH DETECTED!`);
                    console.log(`   Manifest:  ${manifestFile.checksum}`);
                    console.log(`   Server:    ${serverResult.checksum}`);
                    if (normalizedServerChecksum !== serverResult.checksum) {
                        console.log(`   Normalized: ${normalizedServerChecksum}`);
                    }
                }
                
                results.push({
                    file: filePath,
                    status: 'checked',
                    manifestChecksum: manifestFile.checksum,
                    serverChecksum: serverResult.checksum,
                    normalizedServerChecksum: normalizedServerChecksum,
                    size: serverResult.size,
                    match: match,
                    needsUpdate: !match
                });
                
            } catch (error) {
                console.log(`❌ Error downloading: ${error.message}`);
                results.push({
                    file: filePath,
                    status: 'download_error',
                    manifestChecksum: manifestFile.checksum,
                    serverChecksum: null,
                    match: false,
                    error: error.message
                });
            }
            
            console.log('');
        }
        
        // Summary
        console.log('='.repeat(80));
        console.log('📊 SUMMARY');
        console.log('='.repeat(80));
        
        const checked = results.filter(r => r.status === 'checked');
        const matches = checked.filter(r => r.match);
        const mismatches = checked.filter(r => !r.match);
        const errors = results.filter(r => r.status === 'download_error');
        const notInManifest = results.filter(r => r.status === 'not_in_manifest');
        
        console.log(`📁 Total files checked: ${results.length}`);
        console.log(`✅ Matches: ${matches.length}`);
        console.log(`❌ Mismatches: ${mismatches.length}`);
        console.log(`⚠️  Download errors: ${errors.length}`);
        console.log(`❓ Not in manifest: ${notInManifest.length}`);
        
        if (mismatches.length > 0) {
            console.log('\n🔧 MISMATCHED FILES:');
            console.log('-'.repeat(50));
            mismatches.forEach(result => {
                console.log(`File: ${result.file}`);
                console.log(`  Manifest:  ${result.manifestChecksum}`);
                console.log(`  Server:    ${result.serverChecksum}`);
                if (result.normalizedServerChecksum !== result.serverChecksum) {
                    console.log(`  Normalized: ${result.normalizedServerChecksum}`);
                }
                console.log('');
            });
            
            // Ask if user wants to generate update script
            const generateUpdate = await askQuestion('\nGenerate update script for mismatched files? (y/n): ');
            if (generateUpdate.toLowerCase() === 'y' || generateUpdate.toLowerCase() === 'yes') {
                console.log('\n🔧 Generating update script...');
                const updateScript = generateUpdateScript(manifestResponse, mismatches);
                fs.writeFileSync('update-manifest-checksums.js', updateScript);
                console.log('✅ Created update-manifest-checksums.js');
                console.log('Run: node update-manifest-checksums.js');
            }
        }
        
        if (errors.length > 0) {
            console.log('\n❌ DOWNLOAD ERRORS:');
            console.log('-'.repeat(50));
            errors.forEach(result => {
                console.log(`File: ${result.file}`);
                console.log(`  Error: ${result.error}`);
                console.log('');
            });
        }
        
        if (notInManifest.length > 0) {
            console.log('\n❓ FILES NOT IN MANIFEST:');
            console.log('-'.repeat(50));
            notInManifest.forEach(result => {
                console.log(`File: ${result.file}`);
                console.log('');
            });
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        rl.close();
    }
}

// Generate update script for mismatched files
function generateUpdateScript(manifest, mismatches) {
    return `const fs = require('fs');

console.log('🔧 Updating manifest with corrected checksums...');

try {
    // Load the manifest
    const manifest = ${JSON.stringify(manifest, null, 2)};
    
    // Update checksums for mismatched files
    const updates = ${JSON.stringify(mismatches.map(m => ({
        file: m.file,
        oldChecksum: m.manifestChecksum,
        newChecksum: m.normalizedServerChecksum || m.serverChecksum
    })), null, 2)};
    
    let updatedCount = 0;
    
    console.log(\`Found \${updates.length} files to update:\`);
    updates.forEach(update => {
        console.log(\`  - \${update.file}\`);
    });
    console.log('');
    
    updates.forEach(update => {
        const file = manifest.files.find(f => f.path === update.file);
        if (file) {
            console.log(\`Updating \${update.file}\`);
            console.log(\`  Old: \${file.checksum}\`);
            console.log(\`  New: \${update.newChecksum}\`);
            file.checksum = update.newChecksum;
            updatedCount++;
        }
    });
    
    // Save updated manifest
    fs.writeFileSync('roleplayai_manifest_updated.json', JSON.stringify(manifest, null, 2));
    
    console.log(\`\\n✅ Updated \${updatedCount} files in manifest\`);
    console.log('📁 Updated manifest saved as: roleplayai_manifest_updated.json');
    console.log('🚀 Upload this file to replace the server manifest.');
    
} catch (error) {
    console.error('❌ Error updating manifest:', error.message);
}`;
}

// Run the script
checkFiles();
