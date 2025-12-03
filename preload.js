// preload.js

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // --- Persistence & Versioning ---
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    loadGameData: () => ipcRenderer.invoke('load-game-data'),
    saveGameData: (data) => ipcRenderer.send('save-game-data', data),
    getLocalVersion: (installPath) => ipcRenderer.invoke('get-local-version', installPath),

    // --- File Operations & Updates ---
    selectInstallDir: () => ipcRenderer.invoke('select-install-dir'),
    verifyInstallPath: (args) => ipcRenderer.invoke('verify-install-path', args),
    moveInstallPath: (currentPath) => ipcRenderer.invoke('move-install-path', currentPath),
    launchGame: (args) => ipcRenderer.send('launch-game', args),
    checkForUpdates: (args) => ipcRenderer.invoke('check-for-updates', args),
    checkVersionOnly: (args) => ipcRenderer.invoke('check-version-only', args),
    syncFiles: (args) => ipcRenderer.invoke('sync-files', args),
    openInstallFolder: (path) => ipcRenderer.send('open-install-folder', path),
    uninstallGame: (path) => ipcRenderer.send('uninstall-game', path),
    getFileSize: (url) => ipcRenderer.invoke('get-file-size', url),

    // --- New Unified Download Controls ---
    handleDownloadAction: (action) => ipcRenderer.send('handle-download-action', action),
    onDownloadStateUpdate: (callback) => ipcRenderer.on('download-state-update', (event, state) => callback(state)),
    
    // --- Browser/OS Interaction ---
    openExternal: (url) => ipcRenderer.send('open-external', url),
    closeWindow: () => ipcRenderer.send('close-window'),
    
    // --- Other Event Listeners ---
    onUninstallComplete: (callback) => ipcRenderer.on('uninstall-complete', () => callback()),
    onMoveProgress: (callback) => ipcRenderer.on('move-progress', (event, value) => callback(value)),
    onGameLaunched: (callback) => ipcRenderer.on('game-launched', () => callback()),
    onGameClosed: (callback) => ipcRenderer.on('game-closed', () => callback()),
    
    // --- Auto-Updater Status Events ---
    onAutoUpdaterStatus: (callback) => ipcRenderer.on('auto-updater-status', (event, status) => callback(status)),
    
    // --- Chunk Check Progress Events ---
    onChunkCheckProgress: (callback) => ipcRenderer.on('chunk-check-progress', (event, progress) => callback(progress)),
    onChunkCheckComplete: (callback) => ipcRenderer.on('chunk-check-complete', (event, data) => callback(data)),
    onChunkCheckResult: (callback) => ipcRenderer.on('chunk-check-result', (event, result) => callback(result)),
    onChunkCheckError: (callback) => ipcRenderer.on('chunk-check-error', (event, error) => callback(error)),
    cancelVerification: () => ipcRenderer.send('cancel-verification'),
    removeChunkCheckListeners: () => {
        ipcRenderer.removeAllListeners('chunk-check-progress');
        ipcRenderer.removeAllListeners('chunk-check-complete');
        ipcRenderer.removeAllListeners('chunk-check-result');
        ipcRenderer.removeAllListeners('chunk-check-error');
    },
    
    // --- DLC Management ---
    getDLCs: (args) => ipcRenderer.invoke('get-dlcs', args),
    downloadDLC: (args) => ipcRenderer.invoke('download-dlc', args),
    uninstallDLC: (args) => ipcRenderer.invoke('uninstall-dlc', args),
    verifyDLC: (args) => ipcRenderer.invoke('verify-dlc', args),
    getDLCStatus: (args) => ipcRenderer.invoke('get-dlc-status', args),
    
    // --- Catalog Management ---
    fetchCatalog: () => ipcRenderer.invoke('fetch-catalog'),
    getCatalogBaseGame: () => ipcRenderer.invoke('get-catalog-base-game'),
    getCatalogDLCs: () => ipcRenderer.invoke('get-catalog-dlcs'),
    
    // --- Build Type Management ---
    getBuildType: () => ipcRenderer.invoke('get-build-type'),
    setBuildType: (buildType) => ipcRenderer.invoke('set-build-type', buildType),
    onBuildTypeChanged: (callback) => {
        ipcRenderer.on('build-type-changed', (event, data) => callback(data));
    },
    removeBuildTypeListener: () => {
        ipcRenderer.removeAllListeners('build-type-changed');
    }
});
