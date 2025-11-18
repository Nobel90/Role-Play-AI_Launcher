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

    console.log(`\n[Signing] ${path.basename(filePath)}`);
    console.log(`[Signing] Full path: ${filePath}`);
    console.log(`[Signing] Using certificate thumbprint: ${certificateSha1.substring(0, 8)}...`);
    console.log(`[Signing] Command: ${command.replace(certificateSha1, certificateSha1.substring(0, 8) + '...')}`);
    
    execSync(command, { stdio: 'inherit' });
    
    // Verify the signature
    try {
      const verifyCommand = `"${signToolPath}" verify /pa "${filePath}"`;
      execSync(verifyCommand, { stdio: 'pipe' });
      console.log(`✓ Successfully signed and verified: ${path.basename(filePath)}\n`);
    } catch (verifyError) {
      console.warn(`⚠ Signed but verification failed: ${path.basename(filePath)}`);
      console.warn(`Verification error: ${verifyError.message}`);
    }
    
    return true;
  } catch (error) {
    console.error(`\n❌ Error signing ${filePath}:`);
    console.error(`Error message: ${error.message}`);
    if (error.stdout) console.error(`stdout: ${error.stdout}`);
    if (error.stderr) console.error(`stderr: ${error.stderr}`);
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
    // Windows SDK locations - try to find latest version dynamically
    'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\x64\\signtool.exe',
    'C:\\Program Files\\Windows Kits\\10\\bin\\x64\\signtool.exe',
    // Visual Studio locations
    'C:\\Program Files (x86)\\Microsoft SDKs\\Windows\\v10.0A\\bin\\NETFX 4.8 Tools\\signtool.exe',
    // System PATH
    'signtool.exe'
  ];

  // First, try to find signtool.exe in Windows Kits with versioned folders
  try {
    const kitsPath86 = 'C:\\Program Files (x86)\\Windows Kits\\10\\bin';
    const kitsPath64 = 'C:\\Program Files\\Windows Kits\\10\\bin';
    
    for (const basePath of [kitsPath86, kitsPath64]) {
      if (fs.existsSync(basePath)) {
        // Look for versioned folders (e.g., 10.0.22621.0)
        const versionDirs = fs.readdirSync(basePath).filter(dir => {
          const fullPath = path.join(basePath, dir);
          return fs.statSync(fullPath).isDirectory() && /^\d+\.\d+\.\d+\.\d+$/.test(dir);
        }).sort().reverse(); // Sort descending to get latest version first
        
        for (const versionDir of versionDirs) {
          const x64Path = path.join(basePath, versionDir, 'x64', 'signtool.exe');
          if (fs.existsSync(x64Path)) {
            return x64Path;
          }
        }
        
        // Try non-versioned x64 path
        const x64Path = path.join(basePath, 'x64', 'signtool.exe');
        if (fs.existsSync(x64Path)) {
          return x64Path;
        }
      }
    }
  } catch (error) {
    // Continue to other methods
  }

  // Try static paths
  for (const toolPath of possiblePaths) {
    try {
      if (toolPath === 'signtool.exe') {
        // Try to find in PATH using where command
        try {
          const result = execSync('where signtool.exe', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
          if (result && result.trim()) {
            return result.trim().split('\n')[0]; // Return first match
          }
        } catch (error) {
          // Not in PATH, continue
        }
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

  // Debug logging
  if (filePath) {
    console.log(`\n[afterSign Hook] Processing: ${path.basename(filePath)}`);
    console.log(`[afterSign Hook] Full path: ${filePath}`);
  } else {
    console.log(`\n[afterSign Hook] No file path provided in context`);
    // Don't stringify context as it may contain circular references
    console.log(`[afterSign Hook] Context keys:`, Object.keys(context || {}));
    if (context && context.path) {
      console.log(`[afterSign Hook] Context.path:`, context.path);
    }
  }

  // Skip signing if no file path provided
  if (!filePath) {
    return;
  }

  // Skip signing files in NSIS cache directory (these are temporary build files)
  if (filePath.includes('electron-builder\\Cache\\nsis') || 
      filePath.includes('electron-builder/Cache/nsis')) {
    console.log(`[afterSign Hook] Skipping NSIS cache file: ${path.basename(filePath)}`);
    return;
  }

  // Skip signing elevate.exe during build - it's used by NSIS and signing it can cause crashes
  // It will be signed after the build completes
  if (filePath.includes('elevate.exe')) {
    console.log('[afterSign Hook] Skipping elevate.exe signing during build (will be signed after build)');
    return;
  }

  // Skip signing if it's a temporary NSIS file during build
  if (filePath.includes('__uninstaller-nsis-') && !filePath.endsWith('.exe')) {
    console.log(`[afterSign Hook] Skipping temporary NSIS file: ${path.basename(filePath)}`);
    return;
  }

  // Check if certificate is configured
  if (!certificateSha1 && !certificateFile) {
    console.warn(`[afterSign Hook] ⚠ No certificate configured. Set WIN_CERTIFICATE_SHA1 or WIN_CERTIFICATE_FILE environment variable.`);
    console.warn(`[afterSign Hook] Skipping signing for: ${path.basename(filePath)}`);
    return;
  }

  // Sign all signable file types (exe, dll, sys, ocx, msi, etc.)
  if (shouldSignFile(filePath)) {
    try {
      // Priority 1: USB Token signing (Sectigo)
      if (certificateSha1) {
        console.log(`[afterSign Hook] Attempting to sign with USB token...`);
        signFileWithToken(filePath, certificateSha1, timestampServer);
      }
      // Priority 2: Certificate file signing (fallback)
      else if (certificateFile) {
        console.log(`[afterSign Hook] Attempting to sign with certificate file...`);
        signFileWithCertificate(filePath, certificateFile, certificatePassword, timestampServer);
      }
    } catch (error) {
      // Log error but don't fail the build
      console.error(`[afterSign Hook] ❌ Error signing ${path.basename(filePath)}: ${error.message}`);
      console.error(`[afterSign Hook] Stack: ${error.stack}`);
    }
  } else {
    console.log(`[afterSign Hook] File type not signable: ${path.basename(filePath)} (extension: ${path.extname(filePath)})`);
  }
};

/**
 * After all artifacts are built, sign the final installer and uninstaller
 * This is called by electron-builder after all artifacts are created
 * @param {object} context - Build context with artifactPaths array
 */
exports.afterAllArtifactBuild = async function(context) {
  console.log('\n=== Post-Build Signing ===');
  
  const certificateSha1 = process.env.WIN_CERTIFICATE_SHA1;
  const certificateFile = process.env.WIN_CERTIFICATE_FILE;
  const certificatePassword = process.env.WIN_CERTIFICATE_PASSWORD || '';
  const timestampServer = process.env.WIN_TIMESTAMP_SERVER || 'http://timestamp.digicert.com';

  if (!certificateSha1 && !certificateFile) {
    console.warn('⚠ No certificate configured. Skipping post-build signing.');
    console.warn('Set WIN_CERTIFICATE_SHA1 or WIN_CERTIFICATE_FILE environment variable.');
    return;
  }

  // Get artifact paths from context
  const artifactPaths = context.artifactPaths || [];
  console.log(`Found ${artifactPaths.length} artifact(s) to sign`);

  for (const artifactPath of artifactPaths) {
    if (shouldSignFile(artifactPath)) {
      console.log(`\n[Post-Build] Signing artifact: ${path.basename(artifactPath)}`);
      try {
        if (certificateSha1) {
          signFileWithToken(artifactPath, certificateSha1, timestampServer);
        } else if (certificateFile) {
          signFileWithCertificate(artifactPath, certificateFile, certificatePassword, timestampServer);
        }
      } catch (error) {
        console.error(`[Post-Build] ❌ Failed to sign ${path.basename(artifactPath)}: ${error.message}`);
      }
    }
  }

  // Also sign the uninstaller if it exists
  const distDir = path.dirname(artifactPaths[0] || 'dist');
  const uninstallerPath = path.join(distDir, '__uninstaller-nsis-role-play-ai-launcher.exe');
  if (fs.existsSync(uninstallerPath)) {
    console.log(`\n[Post-Build] Signing uninstaller: ${path.basename(uninstallerPath)}`);
    try {
      if (certificateSha1) {
        signFileWithToken(uninstallerPath, certificateSha1, timestampServer);
      } else if (certificateFile) {
        signFileWithCertificate(uninstallerPath, certificateFile, certificatePassword, timestampServer);
      }
    } catch (error) {
      console.error(`[Post-Build] ❌ Failed to sign uninstaller: ${error.message}`);
    }
  }

  console.log('\n=== Post-Build Signing Complete ===\n');
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
