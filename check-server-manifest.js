const https = require('https');

async function checkServerManifest() {
    console.log('🔍 Checking server manifest...');
    
    const manifestUrl = 'https://vrcentre.com.au/RolePlay_Ai/RolePlay_AI_Package/roleplayai_manifest.json';
    
    try {
        const response = await new Promise((resolve, reject) => {
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
        
        console.log(`✅ Server manifest loaded: ${response.files.length} files`);
        
        // Find the VkLayer file
        const vkLayerFile = response.files.find(f => f.path === 'Engine/Binaries/ThirdParty/Vulkan/Win64/VkLayer_api_dump.json');
        
        if (vkLayerFile) {
            console.log(`📋 VkLayer_api_dump.json checksum: ${vkLayerFile.checksum}`);
            console.log(`📏 VkLayer_api_dump.json size: ${vkLayerFile.size || 'not specified'}`);
        } else {
            console.log('❌ VkLayer_api_dump.json not found in server manifest');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkServerManifest();
