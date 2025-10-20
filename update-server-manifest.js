const https = require('https');
const crypto = require('crypto');

async function updateServerManifest() {
    console.log('🔧 Updating server manifest with correct checksum...');
    
    // Download current server manifest
    const manifestUrl = 'https://vrcentre.com.au/RolePlay_Ai/RolePlay_AI_Package/roleplayai_manifest.json';
    
    try {
        console.log('📥 Downloading current server manifest...');
        const manifest = await new Promise((resolve, reject) => {
            https.get(manifestUrl, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                    return;
                }
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => resolve(JSON.parse(data)));
            }).on('error', reject);
        });
        
        console.log(`✅ Manifest loaded: ${manifest.files.length} files`);
        
        // Find the VkLayer file
        const vkLayerFile = manifest.files.find(f => f.path === 'Engine/Binaries/ThirdParty/Vulkan/Win64/VkLayer_api_dump.json');
        
        if (!vkLayerFile) {
            console.log('❌ VkLayer_api_dump.json not found in manifest');
            return;
        }
        
        console.log(`📋 Current checksum: ${vkLayerFile.checksum}`);
        
        // Download the actual file and calculate correct checksum
        const fileUrl = 'https://vrcentre.com.au/RolePlay_Ai/RolePlay_AI_Package/1.0.0.2/Engine/Binaries/ThirdParty/Vulkan/Win64/VkLayer_api_dump.json';
        
        console.log('🌐 Downloading actual file to get correct checksum...');
        const fileResponse = await new Promise((resolve, reject) => {
            https.get(fileUrl, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                    return;
                }
                resolve(res);
            }).on('error', reject);
        });
        
        const hash = crypto.createHash('sha256');
        let fileData = '';
        
        fileResponse.on('data', (chunk) => {
            hash.update(chunk);
            fileData += chunk;
        });
        
        fileResponse.on('end', () => {
            const correctChecksum = hash.digest('hex');
            const fileSize = fileData.length;
            
            console.log(`✅ Correct checksum: ${correctChecksum}`);
            console.log(`📏 File size: ${fileSize} bytes`);
            
            // Update the manifest
            vkLayerFile.checksum = correctChecksum;
            vkLayerFile.size = fileSize;
            
            // Save updated manifest
            const fs = require('fs');
            fs.writeFileSync('roleplayai_manifest_updated.json', JSON.stringify(manifest, null, 2));
            
            console.log('✅ Updated manifest saved as: roleplayai_manifest_updated.json');
            console.log('🚀 Upload this file to replace the server manifest at:');
            console.log('   https://vrcentre.com.au/RolePlay_Ai/RolePlay_AI_Package/roleplayai_manifest.json');
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

updateServerManifest();
