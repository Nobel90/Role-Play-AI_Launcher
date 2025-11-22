// generate-test-manifest.js
// Generate a test manifest from the Unreal package directory

const fs = require('fs');
const path = require('path');

const packageDir = 'D:\\VR Centre\\Perforce\\RolePlay_AI\\Package\\noChubks\\Windows';
const outputFile = path.join(__dirname, 'test-server-files', 'roleplayai_manifest.json');
const baseUrl = 'http://localhost:8080';
const version = '1.0.0';

// Files/folders to exclude
const excludePatterns = [
    /manifest.*\.txt$/i,
    /manifest.*\.json$/i,
    /^saved\//i,
    /\.log$/i,
    /\.tmp$/i
];

function shouldIncludeFile(filePath) {
    const fileName = path.basename(filePath);
    const relativePath = path.relative(packageDir, filePath).replace(/\\/g, '/');
    
    for (const pattern of excludePatterns) {
        if (pattern.test(fileName) || pattern.test(relativePath)) {
            return false;
        }
    }
    
    return true;
}

function getAllFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            getAllFiles(filePath, fileList);
        } else {
            if (shouldIncludeFile(filePath)) {
                fileList.push(filePath);
            }
        }
    });
    
    return fileList;
}

function generateManifest() {
    console.log('Generating test manifest...');
    console.log(`Source directory: ${packageDir}`);
    console.log(`Output file: ${outputFile}\n`);
    
    if (!fs.existsSync(packageDir)) {
        console.error(`Error: Directory not found: ${packageDir}`);
        process.exit(1);
    }
    
    // Get all files
    const allFiles = getAllFiles(packageDir);
    console.log(`Found ${allFiles.length} files to include\n`);
    
    // Generate manifest entries
    const manifestFiles = allFiles.map(filePath => {
        const relativePath = path.relative(packageDir, filePath).replace(/\\/g, '/');
        const stats = fs.statSync(filePath);
        const url = `${baseUrl}/${relativePath.replace(/\\/g, '/')}`;
        
        return {
            path: relativePath,
            size: stats.size,
            url: url
        };
    });
    
    // Sort by path for consistency
    manifestFiles.sort((a, b) => a.path.localeCompare(b.path));
    
    // Create manifest
    const manifest = {
        version: version,
        files: manifestFiles
    };
    
    // Write to file
    fs.writeFileSync(outputFile, JSON.stringify(manifest, null, 2));
    
    // Print summary
    const totalSize = manifestFiles.reduce((sum, file) => sum + file.size, 0);
    console.log('Manifest generated successfully!');
    console.log(`Total files: ${manifestFiles.length}`);
    console.log(`Total size: ${(totalSize / 1024 / 1024 / 1024).toFixed(2)} GB`);
    console.log(`Manifest saved to: ${outputFile}`);
}

generateManifest();

