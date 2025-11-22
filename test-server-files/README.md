# Test Server Files Directory

This directory contains files that will be served by the local test server.

## Setup Instructions

1. **Place your game files here** matching the paths in your manifest
   - For example, if your manifest has `"path": "RolePlay_AI.exe"`, place `RolePlay_AI.exe` in this directory
   - If your manifest has `"path": "AFEOS/Binaries/Win64/AFEOS.exe"`, create the directory structure: `AFEOS/Binaries/Win64/` and place the file there

2. **Update the manifest** (`roleplayai_manifest.json`) with:
   - Correct file paths
   - File sizes (in bytes)
   - URLs pointing to `http://localhost:8080/[file-path]`

3. **Update version.json** with your version number

## Example Structure

```
test-server-files/
├── roleplayai_manifest.json
├── version.json
├── RolePlay_AI.exe
└── AFEOS/
    └── Binaries/
        └── Win64/
            └── AFEOS.exe
```

## Starting the Test Server

Run: `npm run test-server`

The server will start on `http://localhost:8080`

## Updating Launcher to Use Test Server

In `renderer.js`, temporarily change the manifest URL:
```javascript
manifestUrl: 'http://localhost:8080/roleplayai_manifest.json',
versionUrl: 'http://localhost:8080/version.json',
```

