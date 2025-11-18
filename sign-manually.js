/**
 * Manual signing script - Run this after building to sign all files
 * Usage: node sign-manually.js
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const signModule = require('./sign.js');

const certificateSha1 = process.env.WIN_CERTIFICATE_SHA1;
const timestampServer = process.env.WIN_TIMESTAMP_SERVER || 'http://timestamp.digicert.com';

if (!certificateSha1) {
  console.error('ERROR: WIN_CERTIFICATE_SHA1 environment variable is not set!');
  console.error('Please set it before running this script:');
  console.error('  PowerShell: $env:WIN_CERTIFICATE_SHA1 = "your-thumbprint"');
  console.error('  CMD: set WIN_CERTIFICATE_SHA1=your-thumbprint');
  process.exit(1);
}

const distDir = path.join(__dirname, 'dist');

console.log('=== Manual Signing Script ===\n');
console.log(`Certificate thumbprint: ${certificateSha1.substring(0, 8)}...`);
console.log(`Dist directory: ${distDir}\n`);

// Find signtool
const signToolPath = signModule.findSignTool();
if (!signToolPath) {
  console.error('ERROR: signtool.exe not found!');
  process.exit(1);
}
console.log(`Using signtool: ${signToolPath}\n`);

// Files to sign
const filesToSign = [
  path.join(distDir, 'Role-Play-AI-Launcher-Setup-1.0.4.exe'),
  path.join(distDir, '__uninstaller-nsis-role-play-ai-launcher.exe'),
  path.join(distDir, 'win-unpacked', 'Role-Play-AI-Launcher.exe'),
  path.join(distDir, 'win-unpacked', 'resources', 'elevate.exe')
];

// Sign specific files
console.log('Signing specific files...\n');
let signedCount = 0;
for (const filePath of filesToSign) {
  if (fs.existsSync(filePath)) {
    console.log(`Signing: ${path.basename(filePath)}`);
    const command = `"${signToolPath}" sign /sha1 "${certificateSha1}" /t "${timestampServer}" /fd sha256 /tr "${timestampServer}" /td sha256 "${filePath}"`;
    try {
      execSync(command, { stdio: 'inherit' });
      
      // Verify
      try {
        const verifyCommand = `"${signToolPath}" verify /pa "${filePath}"`;
        execSync(verifyCommand, { stdio: 'pipe' });
        console.log(`✓ Successfully signed and verified: ${path.basename(filePath)}\n`);
        signedCount++;
      } catch (verifyError) {
        console.warn(`⚠ Signed but verification failed: ${path.basename(filePath)}\n`);
      }
    } catch (error) {
      console.error(`✗ Failed to sign: ${path.basename(filePath)}`);
      console.error(`Error: ${error.message}\n`);
    }
  } else {
    console.log(`⚠ File not found: ${path.basename(filePath)}\n`);
  }
}

// Sign all DLLs in win-unpacked
const winUnpackedDir = path.join(distDir, 'win-unpacked');
if (fs.existsSync(winUnpackedDir)) {
  console.log('Signing DLLs in win-unpacked directory...\n');
  const dllCount = signModule.signAllFiles(winUnpackedDir, certificateSha1, timestampServer);
  signedCount += dllCount;
}

console.log(`\n=== Manual Signing Complete ===`);
console.log(`Total files signed: ${signedCount}`);
