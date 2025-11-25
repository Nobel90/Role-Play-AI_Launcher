/**
 * Simple script to calculate SHA512 hash and file size
 * Usage: node get-file-hash.js <file-path>
 */

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// Get file path from command line arguments
const filePath = process.argv[2];

if (!filePath) {
    console.error('❌ Error: Please provide a file path');
    console.log('\nUsage: node get-file-hash.js <file-path>');
    console.log('Example: node get-file-hash.js dist\\Role-Play-AI-Launcher-Setup-1.0.8.exe');
    process.exit(1);
}

// Check if file exists
if (!fs.existsSync(filePath)) {
    console.error(`❌ Error: File not found: ${filePath}`);
    process.exit(1);
}

try {
    // Read file
    console.log(`\n📁 Processing: ${path.basename(filePath)}`);
    console.log(`   Full path: ${filePath}\n`);
    
    const fileContent = fs.readFileSync(filePath);
    
    // Calculate SHA512 hash (base64 encoded, as used in latest.yml)
    const sha512 = crypto.createHash('sha512').update(fileContent).digest('base64');
    
    // Get file size
    const stats = fs.statSync(filePath);
    const size = stats.size;
    
    // Format size for readability
    const sizeKB = (size / 1024).toFixed(2);
    const sizeMB = (size / (1024 * 1024)).toFixed(2);
    
    // Output results
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 File Information:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`\n📦 File Name: ${path.basename(filePath)}`);
    console.log(`📏 File Size: ${size.toLocaleString()} bytes (${sizeKB} KB / ${sizeMB} MB)`);
    console.log(`\n🔐 SHA512 Hash (base64):`);
    console.log(sha512);
    console.log('\n═══════════════════════════════════════════════════════════\n');
    
    // Also output in a format that can be easily copied for latest.yml
    console.log('💡 For latest.yml:');
    console.log(`   sha512: ${sha512}`);
    console.log(`   size: ${size}\n`);
    
} catch (error) {
    console.error(`❌ Error processing file: ${error.message}`);
    process.exit(1);
}

