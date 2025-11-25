/**
 * afterAllArtifactBuild Hook Script
 * Signs all installer artifacts (installer exe, uninstaller exe, etc.)
 * Updates latest.yml with correct SHA512 checksum after signing
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { signFileWithToken } = require('../sign-utils');

/**
 * Update latest.yml with new SHA512 checksum and size after signing
 * @param {string} distDir - Directory containing latest.yml
 * @param {string} installerPath - Path to the signed installer
 */
function updateLatestYml(distDir, installerPath) {
  const yamlPath = path.join(distDir, 'latest.yml');
  const fileName = path.basename(installerPath);

  if (!fs.existsSync(yamlPath)) {
    console.log('⚠ latest.yml not found, skipping update.');
    return;
  }

  console.log(`\n[Manifest Update] Updating latest.yml for ${fileName}...`);

  // Calculate new SHA512 hash and size of signed installer
  const fileContent = fs.readFileSync(installerPath);
  const newSha512 = crypto.createHash('sha512').update(fileContent).digest('base64');
  const newSize = fs.statSync(installerPath).size;

  let yamlContent = fs.readFileSync(yamlPath, 'utf8');
  
  // Find and update SHA512 checksum
  // Pattern: sha512: <hash>
  const sha512Regex = new RegExp(`(sha512:\\s*)([A-Za-z0-9+/=]+)`, 'g');
  const sha512Match = yamlContent.match(sha512Regex);
  
  if (sha512Match) {
    // Replace all SHA512 values (there might be multiple entries)
    yamlContent = yamlContent.replace(sha512Regex, `$1${newSha512}`);
    console.log(`[Manifest Update] Updated SHA512 checksum`);
  } else {
    console.warn(`[Manifest Update] Could not find sha512 field in latest.yml`);
  }
  
  // Find and update file size
  // Pattern: size: <number>
  const sizeRegex = /(size:\s*)(\d+)/g;
  const sizeMatch = yamlContent.match(sizeRegex);
  
  if (sizeMatch) {
    yamlContent = yamlContent.replace(sizeRegex, `$1${newSize}`);
    console.log(`[Manifest Update] Updated size: ${newSize} bytes`);
  } else {
    console.warn(`[Manifest Update] Could not find size field in latest.yml`);
  }
  
  // Write updated content back
  fs.writeFileSync(yamlPath, yamlContent);
  console.log(`[Manifest Update] Successfully updated latest.yml\n`);
}

module.exports = async function (context) {
  console.log('\n=== AfterAllArtifactBuild Hook: Signing Installer Artifacts ===');
  
  // Get artifact paths from context
  const artifactPaths = context.artifactPaths || [];
  
  if (artifactPaths.length === 0) {
    console.warn('⚠ No artifacts found in context');
    return;
  }

  // Check for certificate
  const certificateSha1 = process.env.WIN_CERTIFICATE_SHA1;
  if (!certificateSha1) {
    throw new Error('❌ BUILD FAILED: WIN_CERTIFICATE_SHA1 environment variable must be set');
  }

  const timestampServer = process.env.WIN_TIMESTAMP_SERVER || 'http://timestamp.digicert.com';
  let signedCount = 0;
  let installerPath = null;

  // Loop through artifacts and sign .exe files
  for (const artifactPath of artifactPaths) {
    if (typeof artifactPath === 'string' && artifactPath.endsWith('.exe')) {
      // Skip uninstaller
      if (artifactPath.includes('uninstaller')) {
        continue;
      }
      
      if (fs.existsSync(artifactPath)) {
        try {
          signFileWithToken(artifactPath, certificateSha1, timestampServer);
          signedCount++;
          installerPath = artifactPath; // Save installer path for latest.yml update
        } catch (error) {
          // Re-throw to fail the build
          throw new Error(`Failed to sign installer artifact ${path.basename(artifactPath)}: ${error.message}`);
        }
      } else {
        console.warn(`⚠ Artifact not found: ${artifactPath}`);
      }
    }
  }

  console.log(`✓ Signed ${signedCount} installer artifact(s)`);

  // Update latest.yml with correct checksum after signing
  if (installerPath) {
    const distDir = path.dirname(installerPath);
    try {
      updateLatestYml(distDir, installerPath);
    } catch (error) {
      console.warn(`⚠ Failed to update latest.yml: ${error.message}`);
      // Don't fail the build if latest.yml update fails, but warn about it
    }
  }

  console.log('');
};

