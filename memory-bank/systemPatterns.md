# System Patterns

This is an Electron application that serves as a launcher and updater for another application, with support for multiple build types and hierarchical DLC content.

## Core Components
- **`main.js`**: The main process of the Electron application. It handles window creation, application lifecycle events, and all backend logic including DLC management and catalog fetching.
- **`renderer.js`**: The renderer process, responsible for the UI. It communicates with the main process via IPC and handles catalog-based DLC discovery.
- **`preload.js`**: A script that runs before the renderer process, used to expose specific Node.js APIs to the renderer in a secure way.
- **`index.html`**: The main HTML file for the UI including build type switcher and DLC section.
- **`chunkManager.js`**: Implements Content-Defined Chunking (FastCDC) for delta updates
- **`manifestUtils.js`**: Utilities for parsing manifests and calculating download sizes
- **`fileVerifier.js`**: Handles file verification and integrity checks
- **`verifierWorker.js`**: Web Worker for background file verification

## High-Level Flow
1.  **Startup**: The application starts, creates a browser window, and loads `index.html`.
2.  **Build Type Loading**: Loads saved build type (production/staging) from `launcher-settings.json`
3.  **Auto-Update**: It checks for updates for the launcher itself using `electron-updater`.
    - Uses GitHub releases API (configured in `package.json` publish section)
    - Repository: `Nobel90/Role-Play-AI_Launcher`
4.  **Game Data**: It loads game data (like installation path) from a local JSON file (`launcher-data.json`) per build type.
5.  **Catalog Fetch**: Fetches `catalog.json` from R2 for DLC discovery (with Firebase fallback)
6.  **Update Check**: The user can check for updates for the game. This involves:
    - Fetching a remote manifest file from R2 bucket (build-type specific)
    - Comparing local file checksums with the manifest
    - Identifying files that need to be updated
    - Using chunk-based comparison for delta updates
7.  **Chunking System**: 
    - Files are chunked using FastCDC algorithm (Content-Defined Chunking)
    - Chunks are cached locally to avoid re-downloading unchanged content
    - Cross-file chunk tracking enables deduplication across multiple files
    - Only changed chunks are downloaded, not entire files
8.  **Downloading**: A `DownloadManager` class handles downloading files/chunks:
    - Support for progress tracking, pause, resume, and cancel
    - Chunk-based downloads from R2 bucket
    - Automatic chunk caching and verification
    - File reconstruction from chunks after download
9.  **Verification**: Files are verified after download using SHA256 checksums
10. **Launching**: The user can launch the game.
11. **IPC Communication**: The renderer process (`renderer.js`) communicates with the main process (`main.js`) using `ipcMain` and `ipcRenderer` to trigger actions like downloading, launching, selecting directories, etc.

## Build Type System

### Two Build Types
- **Production**: Stable releases for end users
- **Staging**: Beta/testing builds with latest features

### Build Type Features
- **Header Dropdown Switcher**: Quick access to switch builds
- **Separate Install Paths**: Each build type maintains independent installations
- **Per-Build Data**: Game state tracked separately per build type
- **Manifest URLs**: Dynamically constructed based on current build type

### Data Storage
```
{userData}/
├── launcher-settings.json    # { buildType: "production" }
├── launcher-data.json        # Game library per build type
└── dlc-state.json           # DLC installation state per build type
```

## DLC Hierarchy System

### Two-Level Structure
```
Level 1 (Environment)          Level 2 (Character)
├── DLC_Hospital         ───── DLC_Hospital_Rachael
│                              DLC_Hospital_Doctor
├── DLC_Office           ───── DLC_Office_Secretary
```

### DLC Metadata (from manifest)
```javascript
{
  id: "DLC_Hospital",
  name: "Hospital Environment",
  folderName: "DLC_Hospital",
  type: "environment",      // or "character"
  level: 1,                 // or 2
  parentId: null,           // Character DLCs reference parent
  parentVersion: null,      // Required parent version
  requiredBaseVersion: "1.0.0",
  requiredDLCs: [],
  manifestUrl: "https://..."
}
```

### Dependency Rules
1. **Character DLCs require parent Environment to be installed**
2. **Environments cannot be uninstalled if children are installed**
3. **Version compatibility checked for parent DLC requirements**

## Catalog System

### Catalog Structure
```javascript
{
  catalogVersion: "1.0",
  lastUpdated: "2024-12-02T...",
  generatedBy: "admin-site",
  builds: {
    production: {
      baseGame: {
        version: "1.0.1.6",
        manifestUrl: "https://.../production/roleplayai_manifest.json",
        minLauncherVersion: "1.0.0"
      },
      dlcs: [
        { id, name, folderName, type, level, ... }
      ]
    },
    staging: { ... }
  }
}
```

### Catalog Fetching Priority
1. **catalog.json from R2** (primary, 5-minute cache)
2. **Firebase** (fallback)
3. **IPC to main process** (final fallback)

### Cache Invalidation
- On build type change
- After 5-minute TTL expires
- On explicit refresh

## Key Features Logic

### Content-Defined Chunking (CDC)
- **Algorithm**: FastCDC using Gear hash for rolling hash calculation
- **Chunk Sizes**: 5MB minimum, 10MB average, 20MB maximum
- **Benefits**: 
  - Enables delta updates (only changed chunks downloaded)
  - Cross-file deduplication (same chunk in different files only downloaded once)
  - Efficient bandwidth usage for large game files
- **Implementation**: `chunkManager.js` handles chunking, caching, and reconstruction

### Checksum Verification
- Uses SHA256 checksums to verify file integrity after download
- Manifest files contain checksums for all files and chunks
- Verification can run in background worker for large file sets

### File Filtering
- Skips certain non-essential files during the update process (e.g., `Saved` folders, specific manifests)
- Excludes version.json from manifest generation

### Installation Path Management
- Smart path detection handles multiple installation scenarios
- Allows users to select and move the game installation directory
- Enforces `RolePlay_AI` folder naming convention for new installations
- Preserves existing installation paths to avoid breaking user setups
- **Per-Build Paths**: Each build type has its own installation path

### State Management
- The `DownloadManager` maintains a state machine for the download process (`idle`, `downloading`, `paused`, etc.) and sends updates to the UI
- Chunk manager tracks download progress per chunk
- File verification state is tracked separately
- **DLC State**: Tracked per build type in `dlc-state.json`

### Error Handling
- Includes retries for downloads
- Provides error messages to the user
- Handles reconstruction errors gracefully
- Verifies chunks before assembly
- **DLC Dependency Errors**: User-friendly messages for dependency violations

### R2 Bucket Integration
- Production and Staging downloads from Cloudflare R2 bucket
- Chunk URLs constructed from base URL and relative paths
- Supports both relative and absolute URLs for backward compatibility
- **Catalog**: Master catalog.json for DLC discovery

## End-to-End Data Flow

```
UPLOADER                    R2 BUCKET                  ADMIN SITE
   │                            │                          │
   │ Upload DLC w/ metadata     │                          │
   ├───────────────────────────►│                          │
   │                            │◄──────── R2 Sync ────────┤
   │                            │                          │
   │                            │◄─── Publish catalog.json─┤
   │                            │                          │
                                │                          │
                         ┌──────┴──────┐                   │
                         │ catalog.json│         ┌─────────┴─────────┐
                         │ manifest.json│        │     Firebase      │
                         │ chunks/     │         │ (fallback config) │
                         └──────┬──────┘         └─────────┬─────────┘
                                │                          │
                                └────────────┬─────────────┘
                                             │
                                      ┌──────▼──────┐
                                      │  LAUNCHER   │
                                      │             │
                                      │ - Catalog   │
                                      │ - DLC List  │
                                      │ - Downloads │
                                      └─────────────┘
```

## Build and Signing Flow
1.  **Build**: `electron-builder` compiles the application.
2.  **After Pack**: `scripts/sign-app.js` (`afterSign`) signs the main executable and recursively signs all DLLs in `win-unpacked`.
3.  **Installer Creation**: `electron-builder` creates the NSIS installer.
4.  **Post-Build**: `scripts/sign-installer.js` (`afterAllArtifactBuild`) signs the final NSIS installer.
5.  **Manifest Update**: `scripts/sign-installer.js` recalculates SHA512 checksum and size of the signed installer and updates `latest.yml` to ensure auto-update compatibility.

## Signing System Architecture
- **`sign-utils.js`**: Core signing utilities (USB token and file-based certificate support)
- **`scripts/sign-app.js`**: Handles application signing (afterPack/afterSign hooks)
- **`scripts/sign-installer.js`**: Handles installer signing and latest.yml updates (afterAllArtifactBuild hook)
- **Environment Variables**: `WIN_CERTIFICATE_SHA1` for USB token thumbprint
- **Compatibility**: Updated for Electron-Builder v26+ requirements
