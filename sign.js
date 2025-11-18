/**
 * Code Signing Script for Electron Builder
 * Supports USB token signing (Sectigo) via Windows Certificate Store
 * Signs all executable files: .exe, .dll, .sys, .ocx, .msi, etc.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// File extensions that should be signed
const SIGNABLE_EXTENSIONS = ['.exe', '.dll', '.sys', '.ocx', '.msi', '.cab', '.cat'];

/**
 * Check if a file should be signed based on its extension
 * @param {string} filePath - Path to the file
 * @returns {boolean} True if file should be signed
 */
function shouldSignFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return SIGNABLE_EXTENSIONS.includes(ext);
}

/**
 * Sign a file using signtool.exe with USB token (certificate thumbprint)
 * @param {string} filePath - Path to the file to sign
 * @param {string} certificateSha1 - SHA1 thumbprint of the certificate on USB token
 * @param {string} timestampServer - Timestamp server URL
 */
function signFileWithToken(filePath, certificateSha1, timestampServer = 'http://timestamp.digicert.com') {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found: ${filePath}`);
      return false;
    }

    // Check if certificate thumbprint is provided
    if (!certificateSha1) {
      console.warn('Certificate SHA1 thumbprint not provided. Set WIN_CERTIFICATE_SHA1 environment variable.');
      console.warn('Skipping code signing.');
      return false;
    }

    // Build signtool command
    const signToolPath = findSignTool();
    if (!signToolPath) {
      console.warn('signtool.exe not found. Skipping code signing.');
      return false;
    }

    // Use /sha1 to specify certificate by thumbprint (for USB tokens)
    // /a flag can also be used to auto-select certificate, but /sha1 is more specific
    const command = `"${signToolPath}" sign /sha1 "${certificateSha1}" /t "${timestampServer}" /fd sha256 /tr "${timestampServer}" /td sha256 "${filePath}"`;

    console.log(`Signing: ${path.basename(filePath)}`);
    console.log(`Using certificate thumbprint: ${certificateSha1.substring(0, 8)}...`);
    execSync(command, { stdio: 'inherit' });
    console.log(`✓ Successfully signed: ${path.basename(filePath)}`);
    return true;
  } catch (error) {
    console.error(`Error signing ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Sign a file using certificate file (fallback method)
 * @param {string} filePath - Path to the file to sign
 * @param {string} certificateFile - Path to the certificate file (.pfx or .p12)
 * @param {string} certificatePassword - Password for the certificate
 * @param {string} timestampServer - Timestamp server URL
 */
function signFileWithCertificate(filePath, certificateFile, certificatePassword, timestampServer = 'http://timestamp.digicert.com') {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found: ${filePath}`);
      return false;
    }

    if (!certificateFile || !fs.existsSync(certificateFile)) {
      console.warn(`Certificate file not found: ${certificateFile}`);
      return false;
    }

    const signToolPath = findSignTool();
    if (!signToolPath) {
      console.warn('signtool.exe not found. Skipping code signing.');
      return false;
    }

    const command = `"${signToolPath}" sign /f "${certificateFile}" /p "${certificatePassword}" /t "${timestampServer}" /fd sha256 /tr "${timestampServer}" /td sha256 "${filePath}"`;

    console.log(`Signing: ${path.basename(filePath)}`);
    execSync(command, { stdio: 'inherit' });
    console.log(`✓ Successfully signed: ${path.basename(filePath)}`);
    return true;
  } catch (error) {
    console.error(`Error signing ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Find signtool.exe in common locations
 * @returns {string|null} Path to signtool.exe or null if not found
 */
function findSignTool() {
  const possiblePaths = [
    // Windows SDK locations
    'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.22621.0\\x64\\signtool.exe',
    'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\x64\\signtool.exe',
    'C:\\Program Files\\Windows Kits\\10\\bin\\10.0.22621.0\\x64\\signtool.exe',
    'C:\\Program Files\\Windows Kits\\10\\bin\\x64\\signtool.exe',
    // Visual Studio locations
    'C:\\Program Files (x86)\\Microsoft SDKs\\Windows\\v10.0A\\bin\\NETFX 4.8 Tools\\signtool.exe',
    // System PATH
    'signtool.exe'
  ];

  for (const toolPath of possiblePaths) {
    try {
      if (toolPath === 'signtool.exe') {
        // Try to find in PATH
        execSync('where signtool.exe', { stdio: 'ignore' });
        return toolPath;
      } else if (fs.existsSync(toolPath)) {
        return toolPath;
      }
    } catch (error) {
      continue;
    }
  }

  return null;
}

/**
 * Sign all executable files in a directory recursively
 * @param {string} dirPath - Directory path to sign files in
 * @param {string} certificateSha1 - SHA1 thumbprint of the certificate
 * @param {string} timestampServer - Timestamp server URL
 * @returns {number} Number of files signed
 */
function signDirectoryRecursive(dirPath, certificateSha1, timestampServer) {
  if (!fs.existsSync(dirPath)) {
    return 0;
  }

  const files = fs.readdirSync(dirPath);
  let signedCount = 0;

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    
    try {
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        // Recursively sign files in subdirectories
        signedCount += signDirectoryRecursive(filePath, certificateSha1, timestampServer);
      } else if (shouldSignFile(filePath)) {
        if (signFileWithToken(filePath, certificateSha1, timestampServer)) {
          signedCount++;
        }
      }
    } catch (error) {
      // Skip files that can't be accessed
      continue;
    }
  }

  return signedCount;
}

/**
 * Electron Builder afterSign hook
 * This is called by electron-builder after it processes each file
 * The context structure: { path, electronPlatformName, arch, packager }
 */
exports.default = async function(context) {
  // Get the file path from context
  // The context.path contains the path to the file that was just processed
  const filePath = context.path;
  
  // Get certificate details from environment variables
  const certificateSha1 = process.env.WIN_CERTIFICATE_SHA1;
  const certificateFile = process.env.WIN_CERTIFICATE_FILE;
  const certificatePassword = process.env.WIN_CERTIFICATE_PASSWORD || '';
  const timestampServer = process.env.WIN_TIMESTAMP_SERVER || 'http://timestamp.digicert.com';

  // Sign all signable file types (exe, dll, sys, ocx, msi, etc.)
  if (filePath && shouldSignFile(filePath)) {
    // Priority 1: USB Token signing (Sectigo)
    if (certificateSha1) {
      signFileWithToken(filePath, certificateSha1, timestampServer);
    }
    // Priority 2: Certificate file signing (fallback)
    else if (certificateFile) {
      signFileWithCertificate(filePath, certificateFile, certificatePassword, timestampServer);
    }
    // No signing method configured
    else {
      console.warn(`No signing method configured for ${filePath}.`);
      console.warn('For USB token signing, set WIN_CERTIFICATE_SHA1 environment variable.');
      console.warn('For certificate file signing, set WIN_CERTIFICATE_FILE environment variable.');
    }
  }
};

/**
 * After all artifacts are built, sign all files in the unpacked directory
 * This can be called as a post-build step if needed
 * @param {string} unpackedDir - Path to the unpacked directory
 * @param {string} certificateSha1 - SHA1 thumbprint of the certificate
 * @param {string} timestampServer - Timestamp server URL
 */
exports.signAllFiles = async function(unpackedDir, certificateSha1, timestampServer) {
  console.log('Signing all executable files in:', unpackedDir);
  const signedCount = signDirectoryRecursive(unpackedDir, certificateSha1, timestampServer);
  console.log(`✓ Signed ${signedCount} files`);
};
