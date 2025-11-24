/**
 * afterAllArtifactBuild Hook Script
 * Signs all installer artifacts (installer exe, uninstaller exe, etc.)
 */

const path = require('path');
const fs = require('fs');
const { signFileWithToken } = require('../sign-utils');

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

  // Loop through artifacts and sign .exe files
  for (const artifactPath of artifactPaths) {
    if (typeof artifactPath === 'string' && artifactPath.endsWith('.exe')) {
      if (fs.existsSync(artifactPath)) {
        try {
          signFileWithToken(artifactPath, certificateSha1, timestampServer);
          signedCount++;
        } catch (error) {
          // Re-throw to fail the build
          throw new Error(`Failed to sign installer artifact ${path.basename(artifactPath)}: ${error.message}`);
        }
      } else {
        console.warn(`⚠ Artifact not found: ${artifactPath}`);
      }
    }
  }

  console.log(`✓ Signed ${signedCount} installer artifact(s)\n`);
};

