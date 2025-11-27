# Tech Context

## Framework
- **Electron.js**: Core framework for desktop application

## Main Dependencies
- **`axios`**: For making HTTP requests to download files and check for updates
- **`electron-updater`**: To handle automatic updates for the launcher itself
  - Uses GitHub releases API
  - Repository: `Nobel90/Role-Play-AI_Launcher`
  - Configured via `package.json` publish section
- **`firebase`**: For potential backend services (authentication, database)
- **`adm-zip`**: For handling zip files
- **`electron-log`**: For logging throughout the application
- **`electron-store`**: For persistent data storage (if used)

## Dev Dependencies
- **`electron`**: Core Electron framework
- **`electron-builder`**: To create installers (v26+)
- **`electron-packager`**: Alternative packaging tool

## Build System
- **`electron-builder`**: Used to package the application for Windows (`nsis` installer)
- **Build Scripts**:
  - `npm start`: Runs the application in development mode
  - `npm run dist`: Builds the application installer
  - `npm run build:release`: PowerShell script for release builds
  - `build.bat`: Windows batch script for building
  - `build-signed.ps1`: PowerShell script for signed builds
  - `build-and-release.ps1`: Complete build and release process

## Code Signing
- **Method**: Supports both USB Token (Sectigo) and file-based certificates
- **Configuration**: 
  - Uses `WIN_CERTIFICATE_SHA1` environment variable for USB tokens
  - SHA1 thumbprint identifies the certificate on the USB token
- **Scripts**: 
  - `sign-utils.js`: Core signing utilities (shared module)
  - `scripts/sign-app.js`: Handles signing hooks (`afterSign`) for application files
  - `scripts/sign-installer.js`: Handles signing hooks (`afterAllArtifactBuild`) for installer and updates `latest.yml`
- **Auto-Update**: `latest.yml` is automatically patched after signing to ensure SHA512 checksum matches the signed binary
- **Compatibility**: Updated for Electron-Builder v26+ (separated signing hooks)

## Content-Defined Chunking (CDC)
- **Algorithm**: FastCDC (Fast Content-Defined Chunking)
- **Implementation**: `chunkManager.js`
- **Hash Algorithm**: Gear hash (rolling hash) for boundary detection
- **Chunk Parameters**:
  - Minimum: 5MB
  - Average: 10MB
  - Maximum: 20MB
- **Storage**: Chunks cached in `userData/chunks` directory
- **Benefits**: Delta updates, cross-file deduplication, bandwidth efficiency

## Download Infrastructure
- **Production**: Cloudflare R2 bucket
  - Base URL: `https://pub-f87e49b41fad4c0fad84e94d65ed13cc.r2.dev`
  - Public read access configured
  - Chunk-based downloads
- **Development**: Local test server (`test-server.js`)
  - Serves manifests and chunks for testing
  - Supports chunk downloads

## Manifest System
- **Format**: JSON manifest files containing file metadata
- **Contents**: File paths, sizes, SHA256 checksums, chunk information
- **Generation**: `generate-chunk-manifest.js` creates manifests with chunk data
- **Comparison**: `manifestUtils.js` provides utilities for comparing manifests
- **Version**: `version.json` tracks target game version (excluded from manifests)

## Auto-Updater Configuration
- **Provider**: GitHub releases
- **Repository**: `Nobel90/Role-Play-AI_Launcher` (note: uses hyphens in repo name)
- **Configuration**: Set in `package.json` build.publish section
- **Patterns Learned**:
  - For portable builds, explicit `setFeedURL()` call recommended
  - Development mode requires `forceDevUpdateConfig = true`
  - `dev-app-update.yml` should exist minimally to prevent write errors
  - Direct GitHub API downloads more reliable than YML-based downloads for portables

## File Verification
- **Algorithm**: SHA256 checksums
- **Implementation**: `fileVerifier.js` and `verifierWorker.js` (Web Worker)
- **Purpose**: Verify file integrity after download and during updates

## Platform Support
- **Primary**: Windows (x64)
- **Installer**: NSIS (Nullsoft Scriptable Install System)
- **Target**: Windows 10+
