const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

async function fixVkLayerChecksum() {
    console.log('🔧 Fixing VkLayer_api_dump.json checksum...');
    
    // Load the manifest
    const manifest = JSON.parse(fs.readFileSync('roleplayai_manifest_BACKUP.json', 'utf8'));
    
    // Find the file in the manifest
    const fileInfo = manifest.files.find(f => f.path === 'Engine/Binaries/ThirdParty/Vulkan/Win64/VkLayer_api_dump.json');
    
    if (!fileInfo) {
        console.log('❌ File not found in manifest');
        return;
    }
    
    console.log(`📋 Current checksum: ${fileInfo.checksum}`);
    
    // Download the file from server and calculate actual checksum
    const serverUrl = 'https://vrcentre.com.au/RolePlay_Ai/RolePlay_AI_Package/1.0.0.2/Engine/Binaries/ThirdParty/Vulkan/Win64/VkLayer_api_dump.json';
    
    try {
        console.log('🌐 Downloading file from server...');
        const response = await new Promise((resolve, reject) => {
            https.get(serverUrl, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                    return;
                }
                resolve(res);
            }).on('error', reject);
        });
        
        const hash = crypto.createHash('sha256');
        let data = '';
        
        response.on('data', (chunk) => {
            hash.update(chunk);
            data += chunk;
        });
        
        response.on('end', () => {
            const actualChecksum = hash.digest('hex');
            const fileSize = data.length;
            
            console.log(`✅ Server checksum: ${actualChecksum}`);
            console.log(`📏 File size: ${fileSize} bytes`);
            
            // Update the manifest
            fileInfo.checksum = actualChecksum;
            fileInfo.size = fileSize;
            
            // Save updated manifest
            fs.writeFileSync('roleplayai_manifest_fixed.json', JSON.stringify(manifest, null, 2));
            
            console.log('✅ Updated manifest saved as: roleplayai_manifest_fixed.json');
            console.log('🚀 Upload this file to replace the server manifest.');
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

fixVkLayerChecksum();
