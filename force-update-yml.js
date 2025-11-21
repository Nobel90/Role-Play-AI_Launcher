const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const distDir = path.join(__dirname, 'dist');
const installerName = 'Role-Play-AI-Launcher-Setup-1.0.5.exe';
const installerPath = path.join(distDir, installerName);
const yamlPath = path.join(distDir, 'latest.yml');

if (fs.existsSync(installerPath) && fs.existsSync(yamlPath)) {
    console.log(`Updating latest.yml for ${installerName}...`);
    const fileContent = fs.readFileSync(installerPath);
    const newSha512 = crypto.createHash('sha512').update(fileContent).digest('base64');
    const newSize = fs.statSync(installerPath).size;
    
    let yamlContent = fs.readFileSync(yamlPath, 'utf8');
    
    // Update sha512
    const shaRegex = /sha512:\s*([A-Za-z0-9+/=]+)/g;
    yamlContent = yamlContent.replace(shaRegex, (match, oldSha) => {
        console.log(`Replacing SHA: ${oldSha.substring(0, 8)}... -> ${newSha512.substring(0, 8)}...`);
        return `sha512: ${newSha512}`;
    });
    
    // Update size
    const sizeRegex = /size:\s*(\d+)/g;
    yamlContent = yamlContent.replace(sizeRegex, (match, oldSize) => {
        console.log(`Replacing Size: ${oldSize} -> ${newSize}`);
        return `size: ${newSize}`;
    });
    
    fs.writeFileSync(yamlPath, yamlContent);
    console.log('latest.yml updated.');
    
    // Delete blockmap
    const blockmapPath = path.join(distDir, `${installerName}.blockmap`);
    if (fs.existsSync(blockmapPath)) {
        fs.unlinkSync(blockmapPath);
        console.log('Deleted blockmap.');
    }
} else {
    console.error('Files not found.');
}

