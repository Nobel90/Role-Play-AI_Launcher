# System Patterns

This is an Electron application that serves as a launcher and updater for another application.

## Core Components
- **`main.js`**: The main process of the Electron application. It handles window creation, application lifecycle events, and all backend logic.
- **`renderer.js`**: The renderer process, responsible for the UI. It communicates with the main process via IPC.
- **`preload.js`**: A script that runs before the renderer process, used to expose specific Node.js APIs to the renderer in a secure way.
- **`index.html`**: The main HTML file for the UI.

## High-Level Flow
1.  **Startup**: The application starts, creates a browser window, and loads `index.html`.
2.  **Auto-Update**: It checks for updates for the launcher itself using `electron-updater`.
3.  **Game Data**: It loads game data (like installation path) from a local JSON file.
4.  **Update Check**: The user can check for updates for the game. This involves:
    - Fetching a remote manifest file.
    - Comparing local file checksums with the manifest.
    - Identifying files that need to be updated.
5.  **Downloading**: A `DownloadManager` class handles downloading files, with support for progress tracking, pause, resume, and cancel.
6.  **Launching**: The user can launch the game.
7.  **IPC Communication**: The renderer process (`renderer.js`) communicates with the main process (`main.js`) using `ipcMain` and `ipcRenderer` to trigger actions like downloading, launching, selecting directories, etc.

## Key Features Logic
- **Checksum Verification**: Uses SHA256 checksums to verify file integrity after download.
- **File Filtering**: Skips certain non-essential files during the update process (e.g., `Saved` folders, specific manifests).
- **Installation Path Management**: Allows users to select and move the game installation directory.
- **State Management**: The `DownloadManager` maintains a state machine for the download process (`idle`, `downloading`, `paused`, etc.) and sends updates to the UI.
- **Error Handling**: Includes retries for downloads and provides error messages to the user.


