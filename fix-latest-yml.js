const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function updateLatestYml(distDir, installerName) {
  const yamlPath = path.join(distDir, 'latest.yml');
  const installerPath = path.join(distDir, installerName);

  if (!fs.existsSync(yamlPath)) {
    console.error('latest.yml not found!');
    return;
  }

  if (!fs.existsSync(installerPath)) {
    console.error(`Installer ${installerName} not found!`);
    return;
  }

  console.log(`Updating latest.yml for ${installerName}...`);

  const fileContent = fs.readFileSync(installerPath);
  const newSha512 = crypto.createHash('sha512').update(fileContent).digest('base64');
  const newSize = fs.statSync(installerPath).size;

  let yamlContent = fs.readFileSync(yamlPath, 'utf8');
  
  // Regex to find the file entry and update its properties
  // We look for the file entry to find the OLD hash
  const fileEntryRegex = new RegExp(`url:\\s*${escapeRegExp(installerName)}[\\s\\S]*?sha512:\\s*([A-Za-z0-9+/=]+)`);
  const match = yamlContent.match(fileEntryRegex);
  
  if (match) {
    const oldSha512 = match[1];
    console.log(`Found old SHA512: ${oldSha512.substring(0, 8)}...`);
    console.log(`New SHA512: ${newSha512.substring(0, 8)}...`);
    
    if (oldSha512 !== newSha512) {
        // Replace all occurrences of old SHA512 with new SHA512
        yamlContent = yamlContent.split(oldSha512).join(newSha512);
        console.log('Updated SHA512.');
    } else {
        console.log('SHA512 is already correct.');
    }
    
    // Update size
    const sizeRegex = new RegExp(`(url:\\s*${escapeRegExp(installerName)}[\\s\\S]*?size:\\s*)(\\d+)`);
    const sizeMatch = yamlContent.match(sizeRegex);
    if (sizeMatch) {
      const oldSize = sizeMatch[2];
      console.log(`Found old size: ${oldSize}`);
      console.log(`New size: ${newSize}`);
      
      if (parseInt(oldSize) !== newSize) {
         yamlContent = yamlContent.replace(sizeRegex, `$1${newSize}`);
         console.log('Updated size.');
      } else {
        console.log('Size is already correct.');
      }
    }
    
    fs.writeFileSync(yamlPath, yamlContent);
    console.log('Successfully updated latest.yml');
    
    // Delete blockmap to force full download and avoid mismatch
    const blockmapPath = path.join(distDir, `${installerName}.blockmap`);
    if (fs.existsSync(blockmapPath)) {
        console.log('Deleting .blockmap file to force full download...');
        fs.unlinkSync(blockmapPath);
        console.log('Deleted .blockmap file.');
    }
    
  } else {
    console.error(`Could not find entry for ${installerName} in latest.yml`);
  }
}

// Run
const distDir = path.join(__dirname, 'dist');
const version = require('./package.json').version;
const installerName = `Role-Play-AI-Launcher-Setup-${version}.exe`;

updateLatestYml(distDir, installerName);

