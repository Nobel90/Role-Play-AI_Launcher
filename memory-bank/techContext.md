# Tech Context

- **Framework**: Electron.js
- **Main Dependencies**:
  - `axios`: For making HTTP requests to download files and check for updates.
  - `electron-updater`: To handle automatic updates.
  - `firebase`: For potential backend services (authentication, database).
  - `adm-zip`: For handling zip files.
- **Dev Dependencies**:
  - `electron`: Core Electron framework.
  - `electron-builder`: To create installers.
- **Build System**: `electron-builder` is used to package the application for Windows (`nsis`).
- **Code Signing**:
  - **Method**: Supports both USB Token (Sectigo) and file-based certificates.
  - **Configuration**: Uses `WIN_CERTIFICATE_SHA1` environment variable for USB tokens.
  - **Scripts**: `sign.js` handles signing hooks (`afterPack`, `afterSign`, `afterAllArtifactBuild`), and `sign-manually.js` allows manual signing of built artifacts.
  - **Auto-Update**: `latest.yml` is automatically patched after signing to ensure SHA512 checksum matches the signed binary.
- **Scripts**:
  - `npm start`: Runs the application in development mode.
  - `npm run dist`: Builds the application installer.
