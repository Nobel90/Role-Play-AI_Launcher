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
- **Scripts**:
  - `npm start`: Runs the application in development mode.
  - `npm run dist`: Builds the application installer.


