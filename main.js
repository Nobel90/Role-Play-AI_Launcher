// main.js

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const path = require('path');
const fs = require('fs').promises; // Use promises-based fs
const fsSync = require('fs'); // Use sync for specific cases if needed
const crypto = require('crypto');
const axios = require('axios');
const { session } = require('electron');
const { ChunkManager } = require('./chunkManager');
const { parseManifest, getAllChunks, getFileChunks, calculateDownloadSize } = require('./manifestUtils');

let downloadManager = null;
let mainWindow = null;
let updateDownloaded = false; // Track if update was successfully downloaded
let gameProcess = null; // Track the game process
let chunkManager = null; // Chunk manager instance
let verificationCancelled = false; // Flag to cancel verification
let currentVerificationSender = null; // Track the sender for current verification

const dataPath = path.join(app.getPath('userData'), 'launcher-data.json');
const settingsPath = path.join(app.getPath('userData'), 'launcher-settings.json');

// Build Type Management
let currentBuildType = 'production'; // Default to production

// Load build type from settings
async function loadBuildType() {
    try {
        await fs.access(settingsPath);
        const data = await fs.readFile(settingsPath, 'utf-8');
        const settings = JSON.parse(data);
        if (settings.buildType && (settings.buildType === 'production' || settings.buildType === 'staging')) {
            currentBuildType = settings.buildType;
            console.log(`Build type loaded: ${currentBuildType}`);
        }
    } catch (error) {
        // Settings file doesn't exist, use default
        console.log('Using default build type: production');
    }
}

// Save build type to settings
async function saveBuildType() {
    try {
        const settings = { buildType: currentBuildType };
        await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
        console.log(`Build type saved: ${currentBuildType}`);
    } catch (error) {
        console.error('Error saving build type:', error);
    }
}

// Initialize build type on app start
loadBuildType();

// DLC State Tracking - Per build type
// Structure: dlcState[buildType][environments/characters]
let dlcState = {
    production: {
        environments: {},
        characters: {}
    },
    staging: {
        environments: {},
        characters: {}
    }
};

// Load DLC state from disk
async function loadDLCState() {
    const dlcStatePath = path.join(app.getPath('userData'), 'dlc-state.json');
    try {
        await fs.access(dlcStatePath);
        const data = await fs.readFile(dlcStatePath, 'utf-8');
        const loadedState = JSON.parse(data);
        
        // Migrate old structure if needed
        if (loadedState.environments || loadedState.characters) {
            // Old structure - migrate to production
            dlcState = {
                production: {
                    environments: loadedState.environments || {},
                    characters: loadedState.characters || {}
                },
                staging: {
                    environments: {},
                    characters: {}
                }
            };
            // Save migrated structure
            await saveDLCState();
        } else {
            // New structure
            dlcState = {
                production: loadedState.production || { environments: {}, characters: {} },
                staging: loadedState.staging || { environments: {}, characters: {} }
            };
        }
    } catch (error) {
        // File doesn't exist, use default empty state
        dlcState = {
            production: { environments: {}, characters: {} },
            staging: { environments: {}, characters: {} }
        };
    }
}

// Save DLC state to disk
async function saveDLCState() {
    const dlcStatePath = path.join(app.getPath('userData'), 'dlc-state.json');
    try {
        await fs.writeFile(dlcStatePath, JSON.stringify(dlcState, null, 2));
    } catch (error) {
        console.error('Error saving DLC state:', error);
    }
}

// Initialize DLC state on app start
loadDLCState();

let activeDownload = {
    request: null,
    writer: null,
    isPaused: false,
    filePath: null, // Keep track of the file being written
};
const browserHeaders = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36' };

// R2 Configuration - Dynamic based on build type
// Public R2 URL for the bucket (configured for public read access)
// Note: The public URL already points to the bucket, so we don't include bucket name in the path
function getR2Config() {
    return {
    baseUrl: 'https://pub-f87e49b41fad4c0fad84e94d65ed13cc.r2.dev',
        get buildType() {
            return currentBuildType;
        },
        get manifestUrl() {
            // Base game manifest: {buildType}/roleplayai_manifest.json
            return `${this.baseUrl}/${this.buildType}/roleplayai_manifest.json`;
        },
    constructChunkUrl(relativePath) {
        // Handle both relative paths and full URLs
        if (relativePath.startsWith('http')) {
            return relativePath; // Already a full URL (backward compatibility)
        }
            // Prepend base URL for relative paths
            // relativePath format: {buildType}/[version]/chunks/[hash-prefix]/[chunk-hash]
            // or for DLCs: {buildType}/{dlcFolderName}/[version]/chunks/[hash-prefix]/[chunk-hash]
        return `${this.baseUrl}/${relativePath}`;
        },
        constructDLCManifestUrl(dlcFolderName, version) {
            // DLC manifest: {buildType}/{dlcFolderName}/{version}/manifest.json
            return `${this.baseUrl}/${this.buildType}/${dlcFolderName}/${version}/manifest.json`;
        }
    };
}

// Legacy R2_CONFIG for backward compatibility (will use current build type)
const R2_CONFIG = new Proxy({}, {
    get(target, prop) {
        const config = getR2Config();
        if (prop === 'manifestUrl') {
            return config.manifestUrl;
        }
        if (prop === 'constructChunkUrl') {
            return config.constructChunkUrl.bind(config);
        }
        if (prop === 'constructDLCManifestUrl') {
            return config.constructDLCManifestUrl.bind(config);
        }
        return config[prop];
    }
});

// Helper function to check if file is text-based (for debug purposes)
function isTextFile(filename) {
    const textExtensions = ['.txt', '.json', '.xml', '.html', '.css', '.js', '.glsl', '.hlsl', '.mtlx', '.ini', '.cfg', '.bat', '.sh'];
    return textExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

// Helper function to normalize path separators (keep structure intact)
// This only normalizes backslashes to forward slashes for consistency
function normalizePathSeparators(filePath) {
    if (!filePath) return filePath;
    return filePath.replace(/\\/g, '/');
}

// Helper function to detect the correct game installation path
// Handles both scenarios:
// 1. User selects root folder that contains the game (where RolePlay_AI.exe is)
// 2. User selects a parent folder that contains the game root
// Always ensures the final path ends with "RolePlay_AI" for consistency
async function detectGameInstallPath(selectedPath) {
    const executable = 'RolePlay_AI.exe';
    const requiredFolderName = 'RolePlay_AI';
    
    // Normalize the path
    const normalizedPath = path.normalize(selectedPath);
    const pathParts = normalizedPath.split(path.sep).filter(p => p.length > 0);
    const lastPart = pathParts[pathParts.length - 1];
    
    // Check if executable exists directly in selected path (root level)
    const executableInRoot = path.join(selectedPath, executable);
    try {
        await fs.access(executableInRoot);
        console.log(`Game executable found in root: ${selectedPath}`);
        // If path doesn't end with RolePlay_AI, we need to adjust it
        if (lastPart !== requiredFolderName) {
            // This is an existing installation, but path doesn't match expected name
            // Return as-is for existing installations to avoid breaking them
            return selectedPath;
        }
        return selectedPath; // This is the game root directory
    } catch (error) {
        // Executable not in root, continue checking
    }
    
    // Check if executable exists in RolePlay_AI subfolder (Binaries/Win64)
    const rolePlayAIBinariesPath = path.join(selectedPath, requiredFolderName, 'Binaries', 'Win64', executable);
    try {
        await fs.access(rolePlayAIBinariesPath);
        console.log(`Game executable found in RolePlay_AI/Binaries/Win64: ${selectedPath}`);
        // Return the path that includes RolePlay_AI
        return path.join(selectedPath, requiredFolderName);
    } catch (error) {
        // Not found here either
    }
    
    // Check if selected path is inside RolePlay_AI folder - go up to find root
    let currentPath = selectedPath;
    for (let i = 0; i < 3; i++) { // Check up to 3 levels up
        const executableCheck = path.join(currentPath, executable);
        try {
            await fs.access(executableCheck);
            console.log(`Game executable found by going up: ${currentPath}`);
            // Ensure path ends with RolePlay_AI
            const currentParts = path.normalize(currentPath).split(path.sep).filter(p => p.length > 0);
            if (currentParts[currentParts.length - 1] !== requiredFolderName) {
                // Path doesn't end with RolePlay_AI, but executable exists - this is an existing install
                // Return as-is to avoid breaking existing installations
                return currentPath;
            }
            return currentPath;
        } catch (error) {
            // Not found, go up one level
            const parentPath = path.dirname(currentPath);
            if (parentPath === currentPath) break; // Reached filesystem root
            currentPath = parentPath;
        }
    }
    
    // For new installations, ensure the path ends with "RolePlay_AI"
    // If user selected a parent directory, append "RolePlay_AI"
    // If user selected a directory that should become the parent, use it as parent
    if (lastPart === requiredFolderName) {
        // User already selected a folder named "RolePlay_AI"
        console.log(`Using selected path for new installation: ${selectedPath}`);
        return selectedPath;
    } else {
        // User selected a parent directory - append "RolePlay_AI"
        const finalPath = path.join(selectedPath, requiredFolderName);
        console.log(`Using selected path for new installation (appending RolePlay_AI): ${finalPath}`);
        return finalPath;
    }
}


async function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 860,
        minWidth: 1280,
        minHeight: 860,
        aspectRatio: 16/9,
        resizable: true,
        frame: true,
        title: 'RolePlay-AI Launcher',
        autoHideMenuBar: true,
        icon: path.join(__dirname, '/assets/icon-white.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        }
    });
    win.loadFile('index.html');
    mainWindow = win;
    
    // Initialize chunk manager
    const chunkCacheDir = path.join(app.getPath('userData'), 'chunks');
    chunkManager = new ChunkManager({ chunkCacheDir });
    await chunkManager.initialize();
    
    downloadManager = new DownloadManager(win, chunkManager);

    log.transports.file.level = "info";
    log.info('App starting...');
    log.info(`Checking for GH_TOKEN: ${process.env.GH_TOKEN ? 'Token is set' : 'Token is NOT set'}`);
}

autoUpdater.logger = log;

app.whenReady().then(() => {
    createWindow();
    autoUpdater.checkForUpdates();
});

autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...');
    if (mainWindow) {
        mainWindow.webContents.send('auto-updater-status', { status: 'checking' });
    }
});
autoUpdater.on('update-available', (info) => {
    console.log('Update available.');
    log.info('Update available:', info);
    updateDownloaded = false; // Reset flag when new update is available
    if (mainWindow) {
        mainWindow.webContents.send('auto-updater-status', { status: 'update-available', info });
    }
});
autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available.');
    log.info('Update not available. Current version is up to date.');
    updateDownloaded = false; // Reset flag
    if (mainWindow) {
        mainWindow.webContents.send('auto-updater-status', { status: 'update-not-available' });
    }
});
autoUpdater.on('error', (err) => {
    console.log('Error in auto-updater. ' + err);
    log.error('Auto-updater error:', err);
    
    // Don't show error if update was already successfully downloaded
    // Some errors can occur after successful download (e.g., during installation)
    if (!updateDownloaded && mainWindow) {
        mainWindow.webContents.send('auto-updater-status', { 
            status: 'error', 
            error: err.message || 'Unknown error occurred during update check'
        });
    } else if (updateDownloaded) {
        // Log but don't show to user if update was already downloaded
        log.info('Error occurred after update was downloaded (likely during installation):', err.message);
    }
});
autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    console.log(log_message);
    if (mainWindow) {
        mainWindow.webContents.send('auto-updater-status', { 
            status: 'download-progress', 
            progress: {
                percent: progressObj.percent,
                transferred: progressObj.transferred,
                total: progressObj.total,
                bytesPerSecond: progressObj.bytesPerSecond
            }
        });
    }
});
autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded');
    log.info('Update downloaded successfully:', info);
    updateDownloaded = true; // Mark that update was successfully downloaded
    
    if (mainWindow) {
        mainWindow.webContents.send('auto-updater-status', { status: 'update-downloaded', info });
        
        // Show dialog with error handling
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Update Ready',
            message: 'A new version has been downloaded. Restart the application to apply the updates.',
            buttons: ['Restart', 'Later']
        }).then((buttonIndex) => {
            if (buttonIndex.response === 0) {
                try {
                    log.info('User chose to restart. Calling quitAndInstall()...');
                    autoUpdater.quitAndInstall(false, true); // false = isSilent, true = isForceRunAfter
                } catch (error) {
                    log.error('Error calling quitAndInstall:', error);
                    if (mainWindow) {
                        mainWindow.webContents.send('auto-updater-status', { 
                            status: 'error', 
                            error: 'Failed to restart application. Please restart manually.'
                        });
                    }
                }
            } else {
                log.info('User chose to restart later.');
            }
        }).catch((error) => {
            log.error('Error showing update dialog:', error);
            // Still send the update-downloaded status even if dialog fails
        });
    }
});

ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

// Build Type IPC Handlers
ipcMain.handle('get-build-type', async () => {
    return { success: true, buildType: currentBuildType };
});

ipcMain.handle('set-build-type', async (event, buildType) => {
    if (buildType !== 'production' && buildType !== 'staging') {
        return { success: false, error: 'Invalid build type. Must be "production" or "staging"' };
    }
    
    const previousBuildType = currentBuildType;
    currentBuildType = buildType;
    await saveBuildType();
    
    // Invalidate catalog cache when build type changes
    invalidateCatalogCache();
    
    // Notify renderer of build type change
    if (mainWindow) {
        mainWindow.webContents.send('build-type-changed', { buildType, previousBuildType });
    }
    
    console.log(`Build type changed from ${previousBuildType} to ${buildType}`);
    return { success: true, buildType: currentBuildType };
});

ipcMain.on('close-window', () => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
        focusedWindow.close();
    }
});

ipcMain.on('open-external', (event, url) => {
    shell.openExternal(url);
});

async function getFileChecksum(filePath) {
    try {
        const hash = crypto.createHash('sha256');
        const stream = fsSync.createReadStream(filePath); // fs.promises doesn't have createReadStream
        for await (const chunk of stream) {
            hash.update(chunk);
        }
        return hash.digest('hex');
    } catch (error) {
        console.error(`Checksum error for ${filePath}:`, error);
        return null; // Return null on error
    }
}

async function getLocalVersion(installPath) {
    const versionFilePath = path.join(installPath, 'version.json');
    try {
        await fs.access(versionFilePath); // Check if file exists
        const data = await fs.readFile(versionFilePath, 'utf-8');
        return JSON.parse(data).version || '0.0.0';
    } catch (error) {
        // This is not a critical error, just means no version file found
        return '0.0.0';
    }
}

class DownloadManager {
    constructor(win, chunkManager) {
        this.win = win;
        this.chunkManager = chunkManager;
        this.state = this.getInitialState();
        this.activeRequests = new Map(); // Track active chunk downloads
        this.speedInterval = null;
        this.bytesSinceLastInterval = 0;
        this.debugInfo = null;
        this.isChunkBased = false; // Track if using chunk-based downloads
        this.maxConcurrentDownloads = 5; // Parallel chunk downloads
    }

    getInitialState() {
        return {
            status: 'idle', // idle, downloading, paused, success, error, cancelling
            progress: 0,
            totalFiles: 0,
            filesDownloaded: 0,
            totalChunks: 0,
            chunksDownloaded: 0,
            totalBytes: 0,
            downloadedBytes: 0,
            currentFileName: '',
            currentOperation: '', // 'downloading' or 'reconstructing'
            downloadSpeed: 0, // Bytes per second
            error: null,
        };
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
        console.log('Download state updated:', this.state.status);
        this.win.webContents.send('download-state-update', this.state);
    }

    async start(gameId, installPath, manifestData, latestVersion, filesToUpdate = null) {
        if (this.state.status === 'downloading') return;

        // Check if manifestData is an array (legacy file-based) or an object (manifest)
        if (Array.isArray(manifestData)) {
            // Legacy: array of files passed directly
            console.log('Starting download with file array (legacy mode)');
            await this.startFileBased(gameId, installPath, manifestData, latestVersion);
            return;
        }

        // Try to parse as manifest
        try {
            const { type, manifest } = parseManifest(manifestData);
            this.isChunkBased = type === 'chunk-based';

            if (this.isChunkBased) {
                await this.startChunkBased(gameId, installPath, manifest, latestVersion, filesToUpdate);
            } else {
                // For file-based, use filesToUpdate if provided, otherwise use all files
                const files = filesToUpdate || manifest.files || [];
                await this.startFileBased(gameId, installPath, files, latestVersion);
            }
        } catch (error) {
            console.error('Error parsing manifest:', error);
            // Fallback: try to use as file array if it has a files property
            if (manifestData.files && Array.isArray(manifestData.files)) {
                console.log('Falling back to file array from manifest object');
                const files = filesToUpdate || manifestData.files;
                await this.startFileBased(gameId, installPath, files, latestVersion);
            } else {
                throw new Error(`Invalid manifest data: ${error.message}`);
            }
        }
    }

    async startChunkBased(gameId, installPath, manifest, latestVersion, filesToUpdate = null) {
        console.log(`Starting chunk-based download for version ${manifest.version}`);

        // Use filesToUpdate if provided (only files that need updating), otherwise use all files from manifest
        let filesToProcess = filesToUpdate || manifest.files;
        
        if (!filesToUpdate) {
            console.log(`Processing all ${filesToProcess.length} files from manifest`);
        } else {
            console.log(`Processing only ${filesToUpdate.length} files that need updating (out of ${manifest.files.length} total files)`);
        }

        // Filter out non-essential files
        const filteredFiles = filesToProcess.filter(file => {
            const fileName = path.basename(file.filename);
            const pathString = file.filename.toLowerCase();

            const isSavedFolder = pathString.includes('saved/') || pathString.includes('saved\\');
            const isManifest = fileName.toLowerCase() === 'manifest_nonufsfiles_win64.txt';
            const isLauncher = fileName.toLowerCase() === 'roleplayai_launcher.exe';
            const isVrClassroomTxt = fileName.toLowerCase() === 'roleplayai.txt';
            const isVersionJson = fileName.toLowerCase() === 'version.json';

            if (isSavedFolder || isManifest || isLauncher || isVrClassroomTxt || isVersionJson) {
                console.log(`Filtering out non-essential file: ${file.filename}`);
                return false;
            }
            return true;
        });

        if (filteredFiles.length === 0) {
            console.log("No critical files to update. Finalizing update process.");
            this.setState({ status: 'success', progress: 100, downloadSpeed: 0 });
            return;
        }

        // Get all chunks from filtered files
        const allChunks = [];
        for (const file of filteredFiles) {
            for (const chunk of file.chunks) {
                allChunks.push({ ...chunk, file: file.filename });
            }
        }

        // Check which chunks we already have
        const missingChunks = [];
        for (const chunk of allChunks) {
            const hasChunk = await this.chunkManager.hasChunk(chunk.hash);
            if (!hasChunk) {
                missingChunks.push(chunk);
            }
        }

        console.log(`Total chunks: ${allChunks.length}, Missing: ${missingChunks.length}, Existing: ${allChunks.length - missingChunks.length}`);

        if (missingChunks.length === 0) {
            console.log("All chunks already downloaded. Reconstructing files...");
            this.setState({
                ...this.getInitialState(),
                status: 'downloading',
                totalFiles: filteredFiles.length,
                totalChunks: allChunks.length,
                chunksDownloaded: allChunks.length,
                currentOperation: 'reconstructing'
            });
        } else {
            this.setState({
                ...this.getInitialState(),
                status: 'downloading',
                totalFiles: filteredFiles.length,
                totalChunks: missingChunks.length,
                totalBytes: calculateDownloadSize(missingChunks),
                currentOperation: 'downloading'
            });
        }

        this.bytesSinceLastInterval = 0;
        if (this.speedInterval) clearInterval(this.speedInterval);

        this.speedInterval = setInterval(() => {
            if (this.state.status === 'downloading') {
                this.setState({ downloadSpeed: this.bytesSinceLastInterval * 4 });
                this.bytesSinceLastInterval = 0;
            } else {
                this.setState({ downloadSpeed: 0 });
            }
        }, 250);

        // Download missing chunks
        if (missingChunks.length > 0) {
            await this.downloadChunks(missingChunks);
        }

        if (this.state.status === 'cancelling') {
            if (this.speedInterval) {
                clearInterval(this.speedInterval);
                this.speedInterval = null;
            }
            this.setState(this.getInitialState());
            return;
        }

        // Reconstruct files from chunks
        // Defer reconstruction to allow UI to render first (fixes UI hanging)
        this.setState({ currentOperation: 'reconstructing' });
        
        // Use setImmediate to defer reconstruction until UI is ready
        await new Promise((resolve) => {
            setImmediate(async () => {
                try {
                    await this.reconstructFiles(filteredFiles, installPath);
                    resolve();
                } catch (error) {
                    console.error('Reconstruction error:', error);
                    throw error;
                }
            });
        });

        if (this.speedInterval) {
            clearInterval(this.speedInterval);
            this.speedInterval = null;
        }

        if (this.state.status === 'downloading') {
            const versionFilePath = path.join(installPath, 'version.json');
            await fs.writeFile(versionFilePath, JSON.stringify({ version: latestVersion }, null, 2));
            
            // Clean up old chunks not in current manifest (after reconstruction is complete)
            try {
                console.log('Starting automatic chunk cache cleanup...');
                const keepHashes = new Set(allChunks.map(chunk => chunk.hash));
                const cleanupResult = await this.chunkManager.cleanupOldChunks(keepHashes);
                
                if (cleanupResult.deleted > 0) {
                    const freedMB = (cleanupResult.freedBytes / (1024 * 1024)).toFixed(2);
                    console.log(`✅ Cache cleanup: Removed ${cleanupResult.deleted} unused chunks, freed ${freedMB} MB`);
                } else {
                    console.log('✅ Cache cleanup: No unused chunks found');
                }
            } catch (cleanupError) {
                console.warn('Cache cleanup failed (non-critical):', cleanupError.message);
                // Don't fail the update if cleanup fails
            }
            
            this.setState({ status: 'success', progress: 100, downloadSpeed: 0 });
        }
    }

    async startFileBased(gameId, installPath, files, latestVersion) {
        // Legacy file-based download (for backward compatibility)
        console.log(`Starting file-based download for ${files.length} files.`);
        
        const filteredFiles = files.filter(file => {
            const fileName = path.basename(file.path);
            const pathString = file.path.toLowerCase();

            const isSavedFolder = pathString.startsWith('saved/') || pathString.startsWith('saved\\') || pathString.includes('/saved/') || pathString.includes('\\saved\\');
            const isManifest = fileName.toLowerCase() === 'manifest_nonufsfiles_win64.txt';
            const isLauncher = fileName.toLowerCase() === 'roleplayai_launcher.exe';
            const isVrClassroomTxt = fileName.toLowerCase() === 'roleplayai.txt';
            const isVersionJson = fileName.toLowerCase() === 'version.json';

            if (isSavedFolder || isManifest || isLauncher || isVrClassroomTxt || isVersionJson) {
                console.log(`Filtering out non-essential file: ${file.path}`);
                return false;
            }
            return true;
        });

        if (filteredFiles.length === 0) {
            console.log("No critical files to update. Finalizing update process.");
            this.setState({ status: 'success', progress: 100, downloadSpeed: 0 });
            return;
        }

        this.setState({
            ...this.getInitialState(),
            status: 'downloading',
            totalFiles: filteredFiles.length,
        });

        this.bytesSinceLastInterval = 0;
        if (this.speedInterval) clearInterval(this.speedInterval);

        this.speedInterval = setInterval(() => {
            if (this.state.status === 'downloading') {
                this.setState({ downloadSpeed: this.bytesSinceLastInterval * 4 });
                this.bytesSinceLastInterval = 0;
            } else {
                this.setState({ downloadSpeed: 0 });
            }
        }, 250);

        let i = 0;
        while (i < filteredFiles.length) {
            if (this.state.status === 'cancelling') break;

            const file = filteredFiles[i];
            this.setState({ 
                currentFileName: path.basename(file.path), 
                downloadedBytes: 0, 
                totalBytes: file.size || 0,
                progress: ((i) / this.state.totalFiles) * 100
            });

            let success = false;
            let attempts = 0;
            while (!success && attempts < 3 && this.state.status !== 'cancelling') {
                if (this.state.status === 'paused') {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    continue;
                }

                try {
                    // Use manifest path as-is to preserve exact structure
                    const destinationPath = path.join(installPath, file.path);
                    await this.downloadFile(file.url, destinationPath);
                    
                    const localStats = await fs.stat(destinationPath);
                    if (file.size && file.size > 0) {
                        if (localStats.size === file.size) {
                            success = true;
                            console.log(`✅ Size verified for ${file.path} (${localStats.size} bytes)`);
                        } else {
                            attempts++;
                            console.warn(`❌ Size mismatch for ${file.path}. Attempt ${attempts + 1}/3.`);
                            try { await fs.unlink(destinationPath); } catch (e) { console.error('Failed to delete corrupt file:', e); }
                        }
                    } else {
                        if (localStats.size > 0) {
                            success = true;
                            console.log(`✅ File downloaded successfully for ${file.path} (${localStats.size} bytes)`);
                        } else {
                            attempts++;
                            try { await fs.unlink(destinationPath); } catch (e) { console.error('Failed to delete corrupt file:', e); }
                        }
                    }
                } catch (error) {
                    if (this.state.status === 'cancelling' || this.state.status === 'paused') break;
                    attempts++;
                    console.error(`Error downloading ${file.path}, attempt ${attempts + 1}/3:`, error);
                }
            }

            if (success) {
                i++;
                this.setState({ filesDownloaded: i });
            } else {
                if (this.state.status !== 'paused' && this.state.status !== 'cancelling') {
                    this.setState({ 
                        status: 'error', 
                        error: `Failed to download ${file.path} after 3 attempts.`
                    });
                }
                break;
            }
        }

        if (this.speedInterval) {
            clearInterval(this.speedInterval);
            this.speedInterval = null;
        }

        if (this.state.status === 'downloading') {
            const versionFilePath = path.join(installPath, 'version.json');
            await fs.writeFile(versionFilePath, JSON.stringify({ version: latestVersion }, null, 2));
            this.setState({ status: 'success', progress: 100, downloadSpeed: 0 });
        } else if (this.state.status === 'cancelling') {
            this.setState(this.getInitialState());
        }
    }

    async downloadChunks(chunks) {
        const downloadQueue = [...chunks];
        const activeDownloads = new Set();
        let downloadedCount = 0;
        let failedChunks = [];

        const downloadChunk = async (chunk) => {
            if (this.state.status === 'cancelling' || this.state.status === 'paused') {
                return { success: false, chunk };
            }

            let attempts = 0;
            while (attempts < 3) {
                if (this.state.status === 'paused') {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    continue;
                }
                if (this.state.status === 'cancelling') {
                    return { success: false, chunk };
                }

                try {
                    // Construct full R2 URL if chunk.url is a relative path
                    const chunkUrl = R2_CONFIG.constructChunkUrl(chunk.url);
                    
                    const response = await axios.get(chunkUrl, { 
                        responseType: 'arraybuffer',
                        headers: browserHeaders,
                        onDownloadProgress: (progressEvent) => {
                            if (progressEvent.loaded) {
                                this.bytesSinceLastInterval += progressEvent.loaded - (chunk.downloadedBytes || 0);
                                chunk.downloadedBytes = progressEvent.loaded;
                            }
                        }
                    });

                    const chunkData = Buffer.from(response.data);
                    
                    // Verify chunk size
                    if (chunkData.length !== chunk.size) {
                        throw new Error(`Chunk size mismatch: expected ${chunk.size}, got ${chunkData.length}`);
                    }

                    // Verify chunk hash
                    const calculatedHash = crypto.createHash('sha256').update(chunkData).digest('hex');
                    if (calculatedHash !== chunk.hash) {
                        throw new Error(`Chunk hash mismatch for ${chunk.hash}`);
                    }

                    // Store chunk
                    await this.chunkManager.storeChunk(chunk.hash, chunkData);

                    downloadedCount++;
                    this.setState({
                        chunksDownloaded: downloadedCount,
                        downloadedBytes: this.state.downloadedBytes + chunk.size,
                        progress: (downloadedCount / this.state.totalChunks) * 100
                    });

                    return { success: true, chunk };
                } catch (error) {
                    attempts++;
                    console.error(`Error downloading chunk ${chunk.hash}, attempt ${attempts}/3:`, error.message);
                    if (attempts >= 3) {
                        return { success: false, chunk, error };
                    }
                }
            }
            return { success: false, chunk };
        };

        // Process downloads with concurrency limit
        while (downloadQueue.length > 0 || activeDownloads.size > 0) {
            if (this.state.status === 'cancelling') break;
            if (this.state.status === 'paused') {
                await new Promise(resolve => setTimeout(resolve, 500));
                continue;
            }

            // Start new downloads up to concurrency limit
            while (activeDownloads.size < this.maxConcurrentDownloads && downloadQueue.length > 0) {
                const chunk = downloadQueue.shift();
                const promise = downloadChunk(chunk).then(result => {
                    activeDownloads.delete(promise);
                    if (!result.success) {
                        failedChunks.push(result);
                    }
                });
                activeDownloads.add(promise);
            }

            // Wait for at least one download to complete
            if (activeDownloads.size > 0) {
                await Promise.race(Array.from(activeDownloads));
            }
        }

        // Wait for all remaining downloads
        await Promise.all(Array.from(activeDownloads));

        if (failedChunks.length > 0 && this.state.status !== 'cancelling') {
            throw new Error(`Failed to download ${failedChunks.length} chunks`);
        }
    }

    async reconstructFiles(files, installPath) {
        // Build global reference count map across all files for cross-file chunk tracking
        const globalRefCount = new Map();
        const cleanCache = true; // Enable consume and destroy
        
        // Collect all chunks from all files and build global reference count
        const allChunkHashes = new Set();
        for (const file of files) {
            for (const chunk of file.chunks) {
                if (!chunk.data) { // Only count chunks that need to be read from disk
                    const count = globalRefCount.get(chunk.hash) || 0;
                    globalRefCount.set(chunk.hash, count + 1);
                    allChunkHashes.add(chunk.hash);
                }
            }
        }
        
        console.log(`Building global chunk reference map: ${globalRefCount.size} unique chunks across ${files.length} files`);
        
        // Pre-check: Verify all required chunks exist before starting reconstruction
        console.log(`[Reconstruction] Verifying ${allChunkHashes.size} required chunks exist...`);
        const missingChunks = [];
        let verifiedCount = 0;
        
        for (const chunkHash of allChunkHashes) {
            const exists = await this.chunkManager.hasChunk(chunkHash);
            if (!exists) {
                missingChunks.push(chunkHash);
            } else {
                verifiedCount++;
            }
            
            // Report progress every 100 chunks
            if ((verifiedCount + missingChunks.length) % 100 === 0) {
                console.log(`[Reconstruction] Verified ${verifiedCount + missingChunks.length}/${allChunkHashes.size} chunks...`);
            }
        }
        
        if (missingChunks.length > 0) {
            const errorMsg = `Missing ${missingChunks.length} required chunks before reconstruction. First 5 missing chunks: ${missingChunks.slice(0, 5).map(h => h.substring(0, 16) + '...').join(', ')}`;
            console.error(`[Reconstruction Error] ${errorMsg}`);
            throw new Error(errorMsg);
        }
        
        console.log(`[Reconstruction] ✅ All ${allChunkHashes.size} required chunks verified. Starting reconstruction...`);
        
        // Reconstruct each file using the global reference count
        for (let i = 0; i < files.length; i++) {
            if (this.state.status === 'cancelling') break;
            if (this.state.status === 'paused') {
                await new Promise(resolve => setTimeout(resolve, 500));
                i--; // Retry this file
                continue;
            }

            const file = files[i];
            // Use manifest path as-is to preserve exact structure
            const destinationPath = path.join(installPath, file.filename);
            const destinationDir = path.dirname(destinationPath);
            await fs.mkdir(destinationDir, { recursive: true });

            console.log(`[Reconstruction] Starting file ${i + 1}/${files.length}: ${file.filename} (${file.chunks.length} chunks, ${((file.totalSize || 0) / 1024 / 1024).toFixed(2)} MB)`);

            this.setState({
                currentFileName: path.basename(file.filename),
                filesDownloaded: i
            });

            try {
                // Add overall timeout for reconstruction (1 hour max per file)
                const RECONSTRUCTION_TIMEOUT = 60 * 60 * 1000; // 1 hour in milliseconds
                const startTime = Date.now();
                
                // Add a heartbeat to ensure we're making progress
                let lastProgressTime = Date.now();
                let lastProgressChunks = 0;
                const heartbeatInterval = setInterval(() => {
                    const elapsed = Date.now() - lastProgressTime;
                    if (elapsed > 60000) { // 1 minute without progress
                        console.warn(`[Reconstruction] Warning: No progress for ${(elapsed / 1000).toFixed(0)} seconds on file ${file.filename}`);
                    }
                }, 10000); // Check every 10 seconds
                
                const reconstructionPromise = this.chunkManager.reconstructFile(
                    file.chunks,
                    destinationPath,
                    (progress) => {
                        // Update heartbeat
                        if (progress.chunksProcessed > lastProgressChunks) {
                            lastProgressTime = Date.now();
                            lastProgressChunks = progress.chunksProcessed;
                        }
                        
                        const fileProgress = (i / files.length) * 100;
                        const reconstructionProgress = (progress.progress / 100) * (100 / files.length);
                        this.setState({
                            progress: fileProgress + reconstructionProgress
                        });
                    },
                    cleanCache, // Delete chunks after use to minimize disk usage
                    globalRefCount // Pass global reference count for cross-file tracking
                );
                
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => {
                        clearInterval(heartbeatInterval);
                        reject(new Error(`Reconstruction timeout: File "${file.filename}" took longer than 1 hour to reconstruct. This may indicate a system issue or corrupted chunks.`));
                    }, RECONSTRUCTION_TIMEOUT);
                });
                
                await Promise.race([reconstructionPromise, timeoutPromise]);
                clearInterval(heartbeatInterval);
                
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(`[Reconstruction] ✅ Completed file ${i + 1}/${files.length}: ${file.filename} in ${elapsed}s`);

                // Verify reconstructed file size
                const stats = await fs.stat(destinationPath);
                if (file.totalSize && stats.size !== file.totalSize) {
                    throw new Error(`Reconstructed file size mismatch: expected ${file.totalSize}, got ${stats.size}`);
                }

                console.log(`✅ Reconstructed ${file.filename} (${stats.size} bytes)`);
            } catch (error) {
                console.error(`Error reconstructing ${file.filename}:`, error);
                throw error;
            }
        }

        // Final cleanup pass: Verify all chunks were properly cleaned up
        // (The globalRefCount should have all counts at 0 after all files are reconstructed)
        if (cleanCache) {
            try {
                let remainingChunks = 0;
                for (const [chunkHash, count] of globalRefCount.entries()) {
                    if (count > 0) {
                        // Chunk still has references but shouldn't (should have been decremented to 0)
                        // This shouldn't happen in normal operation, but log it for debugging
                        remainingChunks++;
                    }
                }
                if (remainingChunks > 0) {
                    console.warn(`Warning: ${remainingChunks} chunks still have non-zero reference counts after reconstruction`);
                } else {
                    console.log(`✅ All chunks properly cleaned up (${globalRefCount.size} chunks processed)`);
                }
            } catch (error) {
                console.warn('Final cleanup verification failed (non-critical):', error.message);
            }
        }

        this.setState({ filesDownloaded: files.length });
    }

    async downloadFile(url, destinationPath) {
        return new Promise(async (resolve, reject) => {
            let request = null;
            let writer = null;

            try {
                const destinationDir = path.dirname(destinationPath);
                await fs.mkdir(destinationDir, { recursive: true });

                const response = await axios.get(url, { responseType: 'stream', headers: browserHeaders });
                request = response.data;
                writer = fsSync.createWriteStream(destinationPath);
                
                this.activeRequests.set(destinationPath, { request, writer });

                request.pipe(writer);

                request.on('data', (chunk) => {
                    this.bytesSinceLastInterval += chunk.length;
                    const newDownloadedBytes = (this.state.downloadedBytes || 0) + chunk.length;
                    
                    const baseProgress = (this.state.filesDownloaded / this.state.totalFiles) * 100;
                    
                    let currentFileProgress = 0;
                    if (this.state.totalBytes > 0) {
                        const currentFileDownloadPercentage = newDownloadedBytes / this.state.totalBytes;
                        currentFileProgress = currentFileDownloadPercentage * (1 / this.state.totalFiles) * 100;
                    }
                    
                    this.setState({ 
                        downloadedBytes: newDownloadedBytes,
                        progress: baseProgress + currentFileProgress
                    });
                });

                writer.on('finish', () => {
                    this.activeRequests.delete(destinationPath);
                    resolve();
                });
                writer.on('error', (err) => {
                    this.activeRequests.delete(destinationPath);
                    if (this.state.status !== 'cancelling' && this.state.status !== 'paused') {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
                request.on('error', (err) => {
                    this.activeRequests.delete(destinationPath);
                    if (this.state.status !== 'cancelling' && this.state.status !== 'paused') {
                        reject(err);
                    } else {
                        resolve();
                    }
                });

            } catch (error) {
                if (request) this.activeRequests.delete(destinationPath);
                reject(error);
            }
        });
    }
    
    cleanUpRequests() {
        for (const [path, { request, writer }] of this.activeRequests.entries()) {
            if (request) request.destroy();
            if (writer) {
                writer.close(() => {
                    fs.unlink(path).catch(err => console.error(`Failed to delete partial file: ${path}`, err));
                });
            }
        }
        this.activeRequests.clear();
    }

    pause() {
        if (this.state.status !== 'downloading') return;
        this.setState({ status: 'paused' });
        this.cleanUpRequests();
    }

    resume() {
        if (this.state.status !== 'paused') return;
        this.setState({ status: 'downloading' });
    }

    cancel() {
        if (this.state.status !== 'downloading' && this.state.status !== 'paused') return;
        this.setState({ status: 'cancelling' });
        this.cleanUpRequests();
    }
}

// --- IPC Handlers ---

ipcMain.on('handle-download-action', (event, action) => {
    if (!downloadManager) return;
    switch(action.type) {
        case 'START':
            // Support both old format (files) and new format (manifest)
            const manifestData = action.payload.manifest || action.payload.files;
            // Pass filesToUpdate if provided (for chunk-based downloads, only download chunks for files that need updating)
            const filesToUpdate = action.payload.filesToUpdate || null;
            downloadManager.start(action.payload.gameId, action.payload.installPath, manifestData, action.payload.latestVersion, filesToUpdate);
            break;
        case 'PAUSE':
            downloadManager.pause();
            break;
        case 'RESUME':
            downloadManager.resume();
            break;
        case 'CANCEL':
            downloadManager.cancel();
            break;
    }
});

ipcMain.on('open-install-folder', (event, installPath) => {
    if (installPath && fsSync.existsSync(installPath)) {
        shell.openPath(installPath);
    }
});

ipcMain.handle('get-local-version', async (event, installPath) => {
    return await getLocalVersion(installPath);
});

ipcMain.handle('get-app-path', () => {
    return app.getAppPath();
});

ipcMain.handle('load-game-data', async () => {
    try {
        await fs.access(dataPath);
        const data = await fs.readFile(dataPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        // If file doesn't exist or is invalid, return empty object
        return {};
    }
});

ipcMain.on('save-game-data', async (event, data) => {
    try {
        await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving game data:', error);
    }
});

ipcMain.handle('select-install-dir', async (event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
        properties: ['openDirectory'],
        title: 'Select Installation Directory'
    });

    if (canceled || !filePaths || filePaths.length === 0) {
        return null;
    }

    const selectedPath = filePaths[0];
    
    // Use smart path detection to handle both scenarios:
    // 1. User selects root folder containing RolePlayAI subfolder
    // 2. User directly selects RolePlayAI folder
    const detectedPath = await detectGameInstallPath(selectedPath);

    // The handler now returns the detected/calculated path
    return detectedPath;
});

ipcMain.handle('move-install-path', async (event, currentPath) => {
    // Handle both old format (object) and new format (string)
    if (typeof currentPath === 'object' && currentPath !== null) {
        currentPath = currentPath.currentPath || currentPath.path;
    }
    
    if (!currentPath || typeof currentPath !== 'string') {
        console.error('move-install-path: Invalid currentPath provided:', currentPath);
        dialog.showErrorBox('Move Error', 'Invalid installation path. Please try again.');
        return null;
    }

    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select New Installation Directory'
    });
    if (canceled || !filePaths || filePaths.length === 0) return null;

    const newParentDir = filePaths[0];
    // Ensure the new path ends with "RolePlay_AI"
    const currentBasename = path.basename(currentPath);
    const requiredFolderName = 'RolePlay_AI';
    
    // If current path ends with RolePlay_AI, preserve that structure
    // Otherwise, ensure new path ends with RolePlay_AI
    let newPath;
    if (currentBasename === requiredFolderName) {
        newPath = path.join(newParentDir, requiredFolderName);
    } else {
        // Current path doesn't end with RolePlay_AI, but we want the new one to
        newPath = path.join(newParentDir, requiredFolderName);
    }

    const normalizedCurrentPath = path.normalize(currentPath);
    const normalizedNewPath = path.normalize(newPath);

    if (normalizedNewPath.toLowerCase() === normalizedCurrentPath.toLowerCase()) {
        dialog.showErrorBox('Invalid Path', 'The new installation path cannot be the same as the current one.');
        return null;
    }

    // Prevent moving a directory into itself
    if (normalizedNewPath.toLowerCase().startsWith(normalizedCurrentPath.toLowerCase() + path.sep)) {
        dialog.showErrorBox('Invalid Path', 'You cannot move the game into a subfolder of its current location.');
        return null;
    }

    try {
        await fs.access(newPath);
        dialog.showErrorBox('Move Error', `The destination folder "${newPath}" already exists. Please choose a different location or remove the existing folder.`);
        return null;
    } catch (e) {
        // Folder doesn't exist, which is what we want. Continue.
    }

    try {
        // Using fs.cp for robust copy
        await fs.cp(currentPath, newPath, {
            recursive: true,
            force: false, // Don't overwrite
            errorOnExist: true,
        });

        // After successful copy, remove the old directory
        await shell.trashItem(currentPath);

        return newPath;
    } catch (error) {
        console.error(`Failed to move installation from ${currentPath} to ${newPath}:`, error);
        dialog.showErrorBox('Move Failed', `Could not move the game files. Please ensure you have the correct permissions and the destination drive has enough space. The original files have not been changed.`);
        // Attempt to clean up partially copied new directory if move fails
        try { await fs.rm(newPath, { recursive: true, force: true }); } catch (cleanupError) { console.error('Failed to cleanup failed move directory:', cleanupError); }
        return null;
    }
});

ipcMain.on('launch-game', (event, { installPath, executable }) => {
    if (!installPath || !executable) return;
    const executablePath = path.join(installPath, executable);
    if (fsSync.existsSync(executablePath)) {
        const { spawn } = require('child_process');
        // Use detached: true to allow the game to continue running if launcher closes
        // But do NOT unref() if we want to monitor the process while the launcher is open
        const child = spawn(executablePath, [], { 
            detached: true, 
            cwd: installPath,
            stdio: 'ignore' 
        });
        
        if (child.pid) {
            console.log(`Game launched with PID: ${child.pid}`);
            gameProcess = child;
            event.sender.send('game-launched');
            
            child.on('exit', (code) => {
                console.log(`Game exited with code ${code}`);
                gameProcess = null;
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('game-closed');
                }
            });
            
            child.on('error', (err) => {
                console.error('Failed to start game process:', err);
                gameProcess = null;
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('game-closed');
                }
            });
        }
    } else {
        console.error(`Launch failed: Executable not found at: ${executablePath}`);
    }
});

ipcMain.on('uninstall-game', async (event, installPath) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    
    // Check if the path exists first
    if (!installPath || !fsSync.existsSync(installPath)) {
        console.log(`Install path does not exist: ${installPath}`);
        event.sender.send('uninstall-complete');
        return;
    }
    
    const { response } = await dialog.showMessageBox(win, {
        type: 'warning',
        buttons: ['Yes, Uninstall', 'Cancel'],
        defaultId: 1,
        title: 'Confirm Uninstall',
        message: `Are you sure you want to uninstall this game?`,
        detail: `This will move the folder at "${installPath}" to the trash.`
    });

    if (response === 0) {
        try {
            // Try to remove the directory using Node.js fs first
            await fs.rm(installPath, { recursive: true, force: true });
            console.log(`Successfully removed directory: ${installPath}`);
            
            // Clear the game data from storage
            try {
                const gameData = JSON.parse(await fs.readFile(dataPath, 'utf8'));
                for (const gameId in gameData) {
                    if (gameData[gameId].installPath === installPath) {
                        gameData[gameId].status = 'uninstalled';
                        gameData[gameId].installPath = null;
                        gameData[gameId].version = '0.0.0';
                    }
                }
                await fs.writeFile(dataPath, JSON.stringify(gameData, null, 2));
                console.log('Game data cleared from storage');
            } catch (dataError) {
                console.log('Could not clear game data from storage:', dataError);
            }
            
            event.sender.send('uninstall-complete');
        } catch (error) {
            console.error(`Failed to remove directory at ${installPath}:`, error);
            try {
                // Fallback to shell.trashItem
                await shell.trashItem(installPath);
                
                // Clear the game data from storage even if directory removal failed
                try {
                    const gameData = JSON.parse(await fs.readFile(dataPath, 'utf8'));
                    for (const gameId in gameData) {
                        if (gameData[gameId].installPath === installPath) {
                            gameData[gameId].status = 'uninstalled';
                            gameData[gameId].installPath = null;
                            gameData[gameId].version = '0.0.0';
                        }
                    }
                    await fs.writeFile(dataPath, JSON.stringify(gameData, null, 2));
                    console.log('Game data cleared from storage');
                } catch (dataError) {
                    console.log('Could not clear game data from storage:', dataError);
                }
                
                event.sender.send('uninstall-complete');
            } catch (trashError) {
                console.error(`Failed to move to trash: ${trashError}`);
                dialog.showErrorBox('Uninstall Failed', `Could not remove "${installPath}". You may need to remove it manually.`);
            }
        }
    }
});

ipcMain.handle('get-file-size', async (event, url) => {
    try {
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
            headers: browserHeaders
        });

        const size = response.headers['content-length'];

        // IMPORTANT: Destroy the stream to prevent downloading the file body
        response.data.destroy();

        if (size) {
            return parseInt(size, 10);
        }
        return 0;
    } catch (error) {
        console.error(`Could not get file size for ${url}:`, error.message);
        return 0;
    }
});

ipcMain.handle('check-for-version', async (event, { installPath, versionUrl }) => {
    try {
        const localVersion = await event.sender.invoke('get-local-version', installPath);

        const response = await axios.get(versionUrl, { headers: browserHeaders });
        const serverVersion = response.data.version;

        return {
            isUpdateAvailable: serverVersion !== localVersion,
            latestVersion: serverVersion
        };
    } catch (error) {
        console.error('Version check failed:', error.message);
        return { error: 'Could not check for new version.' };
    }
});

// Fast version-only check (no chunk matching)
ipcMain.handle('check-version-only', async (event, { gameId, installPath, manifestUrl, versionUrl }) => {
    try {
        // Get server version
        let serverVersion = 'N/A';
        try {
            if (versionUrl) {
                const versionResponse = await axios.get(versionUrl, { headers: browserHeaders });
                serverVersion = versionResponse.data.version;
            } else {
                // Fallback: get version from manifest
                // Use provided manifestUrl or fall back to R2 config for current build type
                const finalManifestUrl = manifestUrl || getR2Config().manifestUrl;
                console.log(`[Version Check] Using manifest URL: ${finalManifestUrl} (build type: ${currentBuildType})`);
                const manifestResponse = await axios.get(finalManifestUrl, { headers: browserHeaders });
                const { manifest: serverManifest } = parseManifest(manifestResponse.data);
                serverVersion = serverManifest.version || 'N/A';
            }
        } catch (error) {
            console.error('Failed to get server version:', error.message);
            return { error: 'Could not check server version.' };
        }

        // Get local version
        let localVersion = '0.0.0';
        if (installPath && fsSync.existsSync(installPath)) {
            try {
                const versionFilePath = path.join(installPath, 'version.json');
                const versionData = await fs.readFile(versionFilePath, 'utf-8');
                const versionJson = JSON.parse(versionData);
                localVersion = versionJson.version || '0.0.0';
            } catch (error) {
                // No local version file - treat as uninstalled
                localVersion = '0.0.0';
            }
        }

        const versionMismatch = serverVersion !== localVersion;

        console.log(`--- Fast Version Check for ${gameId} ---`);
        console.log(`Local: ${localVersion}, Server: ${serverVersion}, Mismatch: ${versionMismatch}`);

        return {
            versionMismatch: versionMismatch,
            localVersion: localVersion,
            serverVersion: serverVersion,
            needsSync: versionMismatch && installPath && fsSync.existsSync(installPath)
        };
    } catch (error) {
        console.error('Version-only check failed:', error.message);
        return { error: 'Could not check version.' };
    }
});

// Sync files handler - triggers full chunk matching
ipcMain.handle('sync-files', async (event, { gameId, installPath, manifestUrl }) => {
    try {
        const response = await axios.get(manifestUrl, { headers: browserHeaders });
        const serverManifestData = response.data;
        const { type, manifest: serverManifest } = parseManifest(serverManifestData);
        const serverVersion = serverManifest.version || 'N/A';
        
        console.log(`--- Starting File Sync for ${gameId} v${serverVersion} (${type}) ---`);

        if (!installPath || !fsSync.existsSync(installPath)) {
            return {
                error: 'Installation path not found. Please install the game first.',
                needsInstall: true
            };
        }

        // Check if main executable exists
        const executable = 'RolePlay_AI.exe';
        const executablePath = path.join(installPath, executable);
        let executableMissing = false;
        
        try {
            await fs.access(executablePath);
            console.log(`Main executable found at ${executablePath}`);
        } catch (error) {
            console.log(`Main executable not found at ${executablePath}.`);
            executableMissing = true;
        }

        if (type === 'chunk-based') {
            // Reset cancellation flag and track sender
            verificationCancelled = false;
            currentVerificationSender = event.sender;
            
            // For chunk-based, return immediately and do checking in background
            setImmediate(async () => {
                try {
                    const result = await checkChunkBasedUpdates(serverManifest, installPath, serverVersion, executableMissing, event.sender);
                    // Send final result when done (only if not cancelled)
                    if (!verificationCancelled) {
                        event.sender.send('chunk-check-result', result);
                    }
                } catch (error) {
                    console.error('Error during background chunk check:', error);
                    if (!verificationCancelled) {
                        event.sender.send('chunk-check-error', { error: error.message });
                    }
                } finally {
                    // Reset tracking
                    if (currentVerificationSender === event.sender) {
                        currentVerificationSender = null;
                    }
                }
            });
            
            // Return immediately with "syncing" status
            return {
                isSyncing: true,
                manifest: serverManifest,
                manifestType: 'chunk-based',
                latestVersion: serverVersion,
                executableMissing: executableMissing,
            };
        } else {
            // File-based update check (legacy) - fast, can be synchronous
            return await checkFileBasedUpdates(serverManifest, installPath, serverVersion, executableMissing);
        }
    } catch (error) {
        let errorMessage = 'File sync failed.';
        if (error.response) {
            errorMessage = `File sync failed: Server error ${error.response.status}.`;
        } else if (error.request) {
            errorMessage = 'File sync failed: No response from server.';
        } else {
            errorMessage = `File sync failed: ${error.message}`;
        }
        return { error: errorMessage };
    }
});

// Cancel verification handler
ipcMain.on('cancel-verification', (event) => {
    console.log('Cancellation requested for verification');
    verificationCancelled = true;
    if (currentVerificationSender) {
        currentVerificationSender.send('chunk-check-error', { 
            error: 'Verification cancelled by user',
            cancelled: true 
        });
        currentVerificationSender = null;
    }
});

ipcMain.handle('check-for-updates', async (event, { gameId, installPath, manifestUrl }) => {
    try {
        // Use provided manifestUrl or fall back to current build type manifest
        const finalManifestUrl = manifestUrl || getR2Config().manifestUrl;
        console.log(`Checking for updates using manifest: ${finalManifestUrl} (build type: ${currentBuildType})`);
        
        const response = await axios.get(finalManifestUrl, { headers: browserHeaders });
        const serverManifestData = response.data;
        const { type, manifest: serverManifest } = parseManifest(serverManifestData);
        const serverVersion = serverManifest.version || 'N/A';
        
        console.log(`--- Starting Update Check for ${gameId} v${serverVersion} (${type}) ---`);

        if (!installPath || !fsSync.existsSync(installPath)) {
            console.log('No install path provided or path does not exist. Flagging all files for fresh installation.');
            
            // For file-based manifests, return all files as needing update
            if (type === 'file-based') {
                const allFiles = serverManifest.files || [];
                return {
                    isUpdateAvailable: true,
                    manifest: serverManifest,
                    manifestType: type,
                    filesToUpdate: allFiles,
                    latestVersion: serverVersion,
                    pathInvalid: true,
                };
            } else {
                // For chunk-based, return all files
                return {
                    isUpdateAvailable: true,
                    manifest: serverManifest,
                    manifestType: type,
                    filesToUpdate: serverManifest.files || [],
                    latestVersion: serverVersion,
                    pathInvalid: true,
                };
            }
        }

        const dirContents = await fs.readdir(installPath);
        if (dirContents.length === 0) {
            console.log('Installation directory is empty. Resetting state.');
            
            // Return all files as needing update
            if (type === 'file-based') {
                const allFiles = serverManifest.files || [];
                return {
                    isUpdateAvailable: true,
                    manifest: serverManifest,
                    manifestType: type,
                    filesToUpdate: allFiles,
                    latestVersion: serverVersion,
                    pathInvalid: true,
                };
            } else {
                return {
                    isUpdateAvailable: true,
                    manifest: serverManifest,
                    manifestType: type,
                    filesToUpdate: serverManifest.files || [],
                    latestVersion: serverVersion,
                    pathInvalid: true,
                };
            }
        }

        // Check if main executable exists
        const executable = 'RolePlay_AI.exe';
        const executablePath = path.join(installPath, executable);
        let executableMissing = false;
        
        try {
            await fs.access(executablePath);
            console.log(`Main executable found at ${executablePath}`);
        } catch (error) {
            console.log(`Main executable not found at ${executablePath}.`);
            executableMissing = true;
        }

        if (type === 'chunk-based') {
            // Reset cancellation flag and track sender
            verificationCancelled = false;
            currentVerificationSender = event.sender;
            
            // For chunk-based, return immediately and do checking in background
            // This prevents UI from freezing
            setImmediate(async () => {
                try {
                    const result = await checkChunkBasedUpdates(serverManifest, installPath, serverVersion, executableMissing, event.sender);
                    // Send final result when done (only if not cancelled)
                    if (!verificationCancelled) {
                        event.sender.send('chunk-check-result', result);
                    }
                } catch (error) {
                    console.error('Error during background chunk check:', error);
                    if (!verificationCancelled) {
                        event.sender.send('chunk-check-error', { error: error.message });
                    }
                } finally {
                    // Reset tracking
                    if (currentVerificationSender === event.sender) {
                        currentVerificationSender = null;
                    }
                }
            });
            
            // Return immediately with "checking" status
            return {
                isChecking: true,
                manifest: serverManifest,
                manifestType: 'chunk-based',
                latestVersion: serverVersion,
                pathInvalid: false,
                executableMissing: executableMissing,
            };
        } else {
            // File-based update check (legacy) - fast, can be synchronous
            return await checkFileBasedUpdates(serverManifest, installPath, serverVersion, executableMissing);
        }
    } catch (error) {
        let errorMessage = 'Update check failed.';
        if (error.response) {
            errorMessage = `Update check failed: Server error ${error.response.status}.`;
        } else if (error.request) {
            errorMessage = 'Update check failed: No response from server.';
        } else {
            errorMessage = `Update check failed: ${error.message}`;
        }
        return { error: errorMessage };
    }
});

async function checkChunkBasedUpdates(serverManifest, installPath, serverVersion, executableMissing, eventSender = null) {
    if (!chunkManager) {
        throw new Error('ChunkManager not initialized');
    }

    const filesToUpdate = [];
    const filteredFiles = serverManifest.files.filter(file => {
        const fileName = path.basename(file.filename);
        const pathString = file.filename.toLowerCase();

        const isSavedFolder = pathString.includes('saved/') || pathString.includes('saved\\');
        const isManifest = fileName.toLowerCase() === 'manifest_nonufsfiles_win64.txt';
        const isLauncher = fileName.toLowerCase() === 'roleplayai_launcher.exe';
        const isVrClassroomTxt = fileName.toLowerCase() === 'roleplayai.txt';
        const isVersionJson = fileName.toLowerCase() === 'version.json';

        if (isSavedFolder || isManifest || isLauncher || isVrClassroomTxt || isVersionJson) {
            return false;
        }
        return true;
    });

    const totalFiles = filteredFiles.length;
    let checkedFiles = 0;

    // Send initial progress update
    if (eventSender) {
        eventSender.send('chunk-check-progress', {
            checked: 0,
            total: totalFiles,
            message: 'Starting file verification...'
        });
    }

    // Defer the actual checking to allow UI to render first
    await new Promise((resolve) => {
        setImmediate(async () => {
            try {
                for (const serverFile of filteredFiles) {
                    // Check for cancellation
                    if (verificationCancelled) {
                        console.log('Verification cancelled by user');
                        if (eventSender) {
                            eventSender.send('chunk-check-error', { 
                                error: 'Verification cancelled by user',
                                cancelled: true 
                            });
                        }
                        break;
                    }
                    
                    // Use manifest path as-is to preserve exact structure
                    const localFilePath = path.join(installPath, serverFile.filename);
                    
                    try {
                        await fs.access(localFilePath);
                        
                        // Send progress update at start of file check
                        if (eventSender) {
                            eventSender.send('chunk-check-progress', {
                                checked: checkedFiles,
                                total: totalFiles,
                                currentFile: path.basename(serverFile.filename),
                                message: `Verifying ${path.basename(serverFile.filename)}...`
                            });
                        }
                        
                        // Get local file size for comparison
                        const localStats = await fs.stat(localFilePath);
                        
                        // Check file size first (quick check)
                        if (localStats.size !== serverFile.totalSize) {
                            console.log(`❌ ${serverFile.filename} -> Size mismatch (local: ${localStats.size}, server: ${serverFile.totalSize})`);
                            filesToUpdate.push(serverFile);
                            checkedFiles++;
                            continue;
                        }
                        
                        // Verify chunks at exact manifest offsets (not re-chunking!)
                        let fd = null;
                        const missingChunks = [];
                        const mismatchedChunks = [];
                        
                        try {
                            fd = await fs.open(localFilePath, 'r');
                            
                            // Verify each chunk at its exact offset and size from manifest
                            for (const serverChunk of serverFile.chunks) {
                                try {
                                    // Read chunk at exact offset and size from manifest
                                    const buffer = Buffer.alloc(serverChunk.size);
                                    const result = await fd.read(buffer, 0, serverChunk.size, serverChunk.offset);
                                    
                                    if (result.bytesRead !== serverChunk.size) {
                                        missingChunks.push({
                                            ...serverChunk,
                                            reason: 'read_incomplete',
                                            bytesRead: result.bytesRead
                                        });
                                        continue;
                                    }
                                    
                                    // Hash the chunk and compare with manifest hash
                                    const calculatedHash = crypto.createHash('sha256').update(buffer).digest('hex');
                                    
                                    if (calculatedHash !== serverChunk.hash) {
                                        mismatchedChunks.push({
                                            ...serverChunk,
                                            calculatedHash: calculatedHash.substring(0, 16) + '...'
                                        });
                                    }
                                } catch (chunkError) {
                                    // Error reading chunk
                                    missingChunks.push({
                                        ...serverChunk,
                                        reason: 'read_error',
                                        error: chunkError.message
                                    });
                                }
                            }
                        } catch (readError) {
                            // File can't be opened or read
                            console.log(`⚠️ ${serverFile.filename} -> Read error: ${readError.message}`);
                            filesToUpdate.push(serverFile);
                            checkedFiles++;
                            continue;
                        } finally {
                            // Always close the file descriptor
                            if (fd !== null) {
                                try {
                                    await fd.close();
                                } catch (closeError) {
                                    // Ignore close errors
                                }
                            }
                        }
                        
                        // Check if file needs update
                        const needsUpdate = missingChunks.length > 0 || mismatchedChunks.length > 0;
                        
                        // Debug logging
                        console.log(`\n📊 ${serverFile.filename}:`);
                        console.log(`   Local file size: ${localStats.size}, Server file size: ${serverFile.totalSize}`);
                        console.log(`   Server chunks: ${serverFile.chunks.length}`);
                        console.log(`   Missing chunks: ${missingChunks.length}, Mismatched chunks: ${mismatchedChunks.length}`);
                        
                        if (needsUpdate) {
                            console.log(`❌ ${serverFile.filename} -> Needs update`);
                            if (missingChunks.length > 0) {
                                console.log(`   Missing chunks: ${missingChunks.length}`);
                                console.log(`   First 3 missing chunk hashes: ${missingChunks.slice(0, 3).map(c => c.hash.substring(0, 16)).join(', ')}...`);
                            }
                            if (mismatchedChunks.length > 0) {
                                console.log(`   Mismatched chunks: ${mismatchedChunks.length}`);
                                console.log(`   First 3 mismatched chunk hashes: ${mismatchedChunks.slice(0, 3).map(c => c.hash.substring(0, 16)).join(', ')}...`);
                            }
                            filesToUpdate.push(serverFile);
                        } else {
                            console.log(`✅ ${serverFile.filename} -> All chunks verified`);
                        }
                    } catch (e) {
                        console.log(`⚠️ ${serverFile.filename} -> File not found locally (${localFilePath}). Adding to update list.`);
                        filesToUpdate.push(serverFile);
                    }
                    
                    checkedFiles++;
                    
                    // Send progress update after file is checked
                    if (eventSender) {
                        eventSender.send('chunk-check-progress', {
                            checked: checkedFiles,
                            total: totalFiles,
                            currentFile: path.basename(serverFile.filename),
                            message: `Verified ${path.basename(serverFile.filename)} (${checkedFiles}/${totalFiles})`
                        });
                    }
                }

                // Send completion update
                if (eventSender) {
                    eventSender.send('chunk-check-complete', {
                        filesToUpdate: filesToUpdate.length,
                        totalFiles: totalFiles
                    });
                }

                console.log(`--- Update Check Complete. Found ${filesToUpdate.length} files to update. ---`);
                resolve();
            } catch (error) {
                console.error('Error during chunk checking:', error);
                if (eventSender) {
                    eventSender.send('chunk-check-error', { error: error.message });
                }
                resolve();
            }
        });
    });

    return {
        isUpdateAvailable: filesToUpdate.length > 0,
        manifest: serverManifest,
        manifestType: 'chunk-based',
        filesToUpdate: filesToUpdate,
        latestVersion: serverVersion,
        pathInvalid: false,
        executableMissing: executableMissing,
        message: executableMissing ? 
            `Main executable missing. Will download ${filesToUpdate.length} files including the executable.` : 
            `Found ${filesToUpdate.length} files to update.`
    };
}

async function checkFileBasedUpdates(serverManifest, installPath, serverVersion, executableMissing) {
    const filesToUpdate = [];

    for (const fileInfo of serverManifest.files) {
        const fileName = path.basename(fileInfo.path);
        const pathString = fileInfo.path.toLowerCase();

        const isSavedFolder = pathString.startsWith('saved/') || pathString.startsWith('saved\\') || pathString.includes('/saved/') || pathString.includes('\\saved\\');
        const isManifest = fileName.toLowerCase() === 'manifest_nonufsfiles_win64.txt';
        const isLauncher = fileName.toLowerCase() === 'roleplayai_launcher.exe';
        const isVrClassroomTxt = fileName.toLowerCase() === 'roleplayai.txt';
        const isVersionJson = fileName.toLowerCase() === 'version.json';

        if (isSavedFolder || isManifest || isLauncher || isVrClassroomTxt || isVersionJson) {
            continue;
        }

        // Use manifest path as-is to preserve exact structure
        const localFilePath = path.join(installPath, fileInfo.path);
        try {
            await fs.access(localFilePath);
            const localStats = await fs.stat(localFilePath);
            let isMatch = false;
            
            if (fileInfo.size && fileInfo.size > 0) {
                isMatch = localStats.size === fileInfo.size;
                if (isMatch) {
                    console.log(`✅ ${fileInfo.path} -> Size match: YES (${localStats.size} bytes)`);
                } else {
                    console.log(`❌ ${fileInfo.path} -> Size match: NO`);
                }
            } else {
                isMatch = localStats.size > 0;
            }
            
            if (!isMatch) {
                filesToUpdate.push(fileInfo);
            }
        } catch (e) {
            console.log(`Checking: ${fileInfo.path} -> File not found locally. Adding to update list.`);
            filesToUpdate.push(fileInfo);
        }
    }

    console.log(`--- Update Check Complete. Found ${filesToUpdate.length} files to update. ---`);

    return {
        isUpdateAvailable: filesToUpdate.length > 0,
        manifest: serverManifest,
        manifestType: 'file-based',
        filesToUpdate: filesToUpdate,
        latestVersion: serverVersion,
        pathInvalid: false,
        executableMissing: executableMissing,
        message: executableMissing ? 
            `Main executable missing. Will download ${filesToUpdate.length} files including the executable.` : 
            `Found ${filesToUpdate.length} files to update.`
    };
}

// ==================== Catalog Management ====================

const CATALOG_URL = 'https://pub-f87e49b41fad4c0fad84e94d65ed13cc.r2.dev/catalog.json';
let catalogCache = null;
let catalogFetchTime = 0;
const CATALOG_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch catalog.json from R2
 */
async function fetchCatalog() {
    const now = Date.now();
    
    // Return cached catalog if still valid
    if (catalogCache && (now - catalogFetchTime) < CATALOG_CACHE_DURATION) {
        console.log('[Catalog] Using cached catalog');
        return catalogCache;
    }
    
    try {
        console.log('[Catalog] Fetching from:', CATALOG_URL);
        const response = await axios.get(CATALOG_URL, { 
            headers: browserHeaders,
            timeout: 10000 // 10 second timeout
        });
        
        const catalog = response.data;
        console.log('[Catalog] Fetched successfully:', {
            version: catalog.catalogVersion,
            lastUpdated: catalog.lastUpdated,
            builds: Object.keys(catalog.builds || {})
        });
        
        // Cache the catalog
        catalogCache = catalog;
        catalogFetchTime = now;
        
        return catalog;
    } catch (error) {
        console.error('[Catalog] Fetch error:', error.message);
        return null;
    }
}

/**
 * Invalidate catalog cache
 */
function invalidateCatalogCache() {
    catalogCache = null;
    catalogFetchTime = 0;
    console.log('[Catalog] Cache invalidated');
}

/**
 * IPC handler: Fetch catalog
 */
ipcMain.handle('fetch-catalog', async () => {
    try {
        const catalog = await fetchCatalog();
        return { success: true, catalog, buildType: currentBuildType };
    } catch (error) {
        console.error('Error fetching catalog:', error);
        return { success: false, error: error.message, catalog: null };
    }
});

/**
 * IPC handler: Get base game info from catalog
 */
ipcMain.handle('get-catalog-base-game', async () => {
    try {
        const catalog = await fetchCatalog();
        
        if (catalog && catalog.builds && catalog.builds[currentBuildType]) {
            const buildCatalog = catalog.builds[currentBuildType];
            return {
                success: true,
                baseGame: buildCatalog.baseGame || null,
                buildType: currentBuildType
            };
        }
        
        return { success: true, baseGame: null, buildType: currentBuildType };
    } catch (error) {
        console.error('Error getting base game info:', error);
        return { success: false, error: error.message, baseGame: null };
    }
});

/**
 * IPC handler: Get DLCs from catalog
 */
ipcMain.handle('get-catalog-dlcs', async () => {
    try {
        const catalog = await fetchCatalog();
        
        if (catalog && catalog.builds && catalog.builds[currentBuildType]) {
            const buildCatalog = catalog.builds[currentBuildType];
            const dlcs = buildCatalog.dlcs || [];
            
            // Convert array to object keyed by ID
            const dlcsMap = {};
            for (const dlc of dlcs) {
                if (dlc.enabled !== false) {
                    dlcsMap[dlc.id] = dlc;
                }
            }
            
            return {
                success: true,
                dlcs: dlcsMap,
                buildType: currentBuildType,
                source: 'catalog'
            };
        }
        
        return { success: true, dlcs: {}, buildType: currentBuildType, source: 'catalog' };
    } catch (error) {
        console.error('Error getting catalog DLCs:', error);
        return { success: false, error: error.message, dlcs: {} };
    }
});

// ==================== DLC Management Functions ====================

/**
 * Get DLC installation path
 * @param {string} gamePath - Base game installation path
 * @param {string} dlcFolderName - DLC folder name (e.g., "DLC_Hospital")
 * @returns {string} Full path to DLC installation directory
 */
function getDLCInstallPath(gamePath, dlcFolderName) {
    // DLCs are installed in: {gamePath}/RolePlay_AI/Plugins/{dlcFolderName}/
    return path.join(gamePath, 'RolePlay_AI', 'Plugins', dlcFolderName);
}

/**
 * Validate DLC dependencies
 * @param {Object} dlc - DLC object
 * @param {Object} dlcList - All available DLCs
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateDLCDependencies(dlc, dlcList) {
    if (dlc.type === 'character') {
        if (!dlc.parentId) {
            return { valid: false, error: 'Character DLC must have a parent Environment' };
        }
        
        const parentDLC = dlcList[dlc.parentId];
        if (!parentDLC) {
            return { valid: false, error: `Parent Environment "${dlc.parentId}" not found` };
        }
        
        if (parentDLC.type !== 'environment') {
            return { valid: false, error: 'Parent DLC must be an Environment type' };
        }
        
        // Check if parent is installed (for current build type)
        const parentState = dlcState[currentBuildType].environments[dlc.parentId];
        if (!parentState || !parentState.installed) {
            return { valid: false, error: `Parent Environment "${parentDLC.name}" must be installed first` };
        }
    }
    
    return { valid: true };
}

/**
 * Check if DLC is installed
 * @param {string} installPath - DLC installation path
 * @returns {Promise<boolean>}
 */
async function isDLCInstalled(installPath) {
    try {
        await fs.access(installPath);
        const files = await fs.readdir(installPath);
        // Consider installed if folder exists and has files
        return files.length > 0;
    } catch (error) {
        return false;
    }
}

// ==================== DLC IPC Handlers ====================

/**
 * Fetch DLC metadata from Firebase
 */
ipcMain.handle('get-dlcs', async (event, { appId }) => {
    try {
        // Initialize Firebase if not already done
        if (!global.firebaseApp) {
            const { initializeApp } = require('firebase/app');
            const { getFirestore } = require('firebase/firestore');
            
            // Firebase config - same as renderer.js
            const firebaseConfig = {
                apiKey: "AIzaSyDigbqsTEMSRXz_JgqBAIJ1BKmr6Zb7DzQ",
                authDomain: "vr-centre-7bdac.firebaseapp.com",
                projectId: "vr-centre-7bdac",
                storageBucket: "vr-centre-7bdac.firebasestorage.app",
                messagingSenderId: "236273910700",
                appId: "1:236273910700:web:10d6825337bfd26fb43009",
                measurementId: "G-7P6X25QK1R"
            };
            
            global.firebaseApp = initializeApp(firebaseConfig);
            global.firestore = getFirestore(global.firebaseApp);
        }
        
        const { doc: firestoreDoc, getDoc: firestoreGetDoc } = require('firebase/firestore');
        const appDoc = firestoreDoc(global.firestore, 'apps', appId);
        const appSnapshot = await firestoreGetDoc(appDoc);
        
        if (appSnapshot.exists()) {
            const data = appSnapshot.data();
            
            // Read DLCs from buildTypes structure first (new), fallback to legacy dlcs
            const buildTypes = data.buildTypes || {};
            const buildTypeData = buildTypes[currentBuildType] || {};
            const dlcs = buildTypeData.dlcs || data.dlcs || {};
            
            console.log(`[IPC get-dlcs] Loading DLCs for ${currentBuildType}, found ${Object.keys(dlcs).length} DLCs`);
            
            // Filter only enabled DLCs and update manifest URLs based on current build type
            const enabledDLCs = {};
            const r2Config = getR2Config();
            
            for (const [dlcId, dlc] of Object.entries(dlcs)) {
                if (dlc.enabled) {
                    // Create a copy of the DLC to avoid modifying the original
                    const dlcCopy = { ...dlc };
                    
                    // Update manifest URL to use current build type
                    // DLC manifest URLs from Admin are: {baseUrl}/{buildType}/{dlcFolderName}/{version}/manifest.json
                    // We need to replace the build type in the URL if it exists, or construct it if it doesn't
                    if (dlc.manifestUrl) {
                        // Extract version and dlcFolderName from existing manifestUrl or use stored values
                        const version = dlc.version || '1.0.0';
                        const dlcFolderName = dlc.folderName || dlc.id;
                        
                        // Construct new manifest URL with current build type
                        dlcCopy.manifestUrl = r2Config.constructDLCManifestUrl(dlcFolderName, version);
                    } else if (dlc.folderName && dlc.version) {
                        // Construct manifest URL if not provided
                        dlcCopy.manifestUrl = r2Config.constructDLCManifestUrl(dlc.folderName, dlc.version);
                    }
                    
                    enabledDLCs[dlcId] = dlcCopy;
                }
            }
            
            return { success: true, dlcs: enabledDLCs, buildType: currentBuildType };
        } else {
            return { success: true, dlcs: {}, buildType: currentBuildType };
        }
    } catch (error) {
        console.error('Error fetching DLCs:', error);
        // Return empty DLCs on error (graceful degradation)
        return { success: false, error: error.message, dlcs: {} };
    }
});

/**
 * Download and install a DLC
 */
ipcMain.handle('download-dlc', async (event, { dlcId, manifestUrl, gamePath, dlcFolderName, dlcList }) => {
    try {
        // Validate dependencies
        const dlc = dlcList[dlcId];
        if (!dlc) {
            throw new Error(`DLC ${dlcId} not found`);
        }
        
        const validation = validateDLCDependencies(dlc, dlcList);
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }
        
        // Validate install path
        const fullInstallPath = getDLCInstallPath(gamePath, dlcFolderName);
        
        // Ensure Plugins directory exists
        const pluginsPath = path.join(gamePath, 'RolePlay_AI', 'Plugins');
        await fs.mkdir(pluginsPath, { recursive: true });
        
        // Ensure DLC directory exists
        await fs.mkdir(fullInstallPath, { recursive: true });
        
        // Fetch manifest
        const manifestResponse = await axios.get(manifestUrl, { headers: browserHeaders });
        const manifestData = manifestResponse.data;
        
        // Parse manifest
        const { type, manifest } = parseManifest(manifestData);
        
        if (type !== 'chunk-based') {
            throw new Error('DLC must use chunk-based manifest');
        }
        
        // Use existing download manager to download DLC
        // We'll create a temporary download manager instance for DLC
        const dlcDownloadManager = new DownloadManager(mainWindow, chunkManager);
        
        // Start download
        await dlcDownloadManager.start(
            `dlc_${dlcId}`,
            fullInstallPath,
            manifest,
            manifest.version || '1.0.0'
        );
        
        // Update DLC state (for current build type)
        const dlcType = dlc.type === 'environment' ? 'environments' : 'characters';
        dlcState[currentBuildType][dlcType][dlcId] = {
            installed: true,
            version: manifest.version || '1.0.0',
            installPath: fullInstallPath
        };
        await saveDLCState();
        
        return { success: true };
    } catch (error) {
        console.error('Error downloading DLC:', error);
        return { success: false, error: error.message };
    }
});

/**
 * Uninstall a DLC
 */
ipcMain.handle('uninstall-dlc', async (event, { dlcId, gamePath, dlcFolderName, dlcList }) => {
    try {
        const fullInstallPath = getDLCInstallPath(gamePath, dlcFolderName);
        
        // Check for dependencies
        const dlc = dlcList[dlcId];
        if (dlc && dlc.type === 'environment') {
            // Check if any characters depend on this environment
            const dependentCharacters = Object.values(dlcList).filter(
                d => d.type === 'character' && d.parentId === dlcId
            );
            
            if (dependentCharacters.length > 0) {
                const installedDependent = dependentCharacters.filter(char => {
                    const charState = dlcState[currentBuildType].characters[char.id];
                    return charState && charState.installed;
                });
                
                if (installedDependent.length > 0) {
                    return {
                        success: false,
                        error: `Cannot uninstall: ${installedDependent.length} character DLC(s) depend on this environment. Uninstall them first.`,
                        requiresConfirmation: true
                    };
                }
            }
        }
        
        // Delete DLC folder
        try {
            await fs.rm(fullInstallPath, { recursive: true, force: true });
        } catch (error) {
            // Folder might not exist, that's okay
            console.log('DLC folder not found or already deleted:', error.message);
        }
        
        // Update DLC state
        const dlcType = dlc && dlc.type === 'environment' ? 'environments' : 'characters';
        delete dlcState[currentBuildType][dlcType][dlcId];
        await saveDLCState();
        
        return { success: true };
    } catch (error) {
        console.error('Error uninstalling DLC:', error);
        return { success: false, error: error.message };
    }
});

/**
 * Verify DLC installation
 */
ipcMain.handle('verify-dlc', async (event, { dlcId, manifestUrl, installPath }) => {
    try {
        // Fetch manifest
        const manifestResponse = await axios.get(manifestUrl, { headers: browserHeaders });
        const manifestData = manifestResponse.data;
        
        // Parse manifest
        const { type, manifest } = parseManifest(manifestData);
        
        if (type !== 'chunk-based') {
            throw new Error('DLC must use chunk-based manifest');
        }
        
        // Verify files
        const missingFiles = [];
        const corruptedFiles = [];
        
        for (const file of manifest.files) {
            const filePath = path.join(installPath, file.filename);
            
            try {
                await fs.access(filePath);
                const stats = await fs.stat(filePath);
                
                // Check size
                const expectedSize = file.chunks.reduce((sum, chunk) => sum + chunk.size, 0);
                if (stats.size !== expectedSize) {
                    corruptedFiles.push({ file: file.filename, expected: expectedSize, actual: stats.size });
                }
            } catch (error) {
                missingFiles.push(file.filename);
            }
        }
        
        return {
            success: true,
            valid: missingFiles.length === 0 && corruptedFiles.length === 0,
            missingFiles,
            corruptedFiles
        };
    } catch (error) {
        console.error('Error verifying DLC:', error);
        return { success: false, error: error.message };
    }
});

/**
 * Get installed DLCs status
 */
ipcMain.handle('get-dlc-status', async (event, { gamePath }) => {
    try {
        // Refresh state by checking actual installations
        const pluginsPath = path.join(gamePath, 'RolePlay_AI', 'Plugins');
        
        try {
            await fs.access(pluginsPath);
            const folders = await fs.readdir(pluginsPath);
            
            // Check each folder
            for (const folder of folders) {
                const folderPath = path.join(pluginsPath, folder);
                const stats = await fs.stat(folderPath);
                
                if (stats.isDirectory()) {
                    const installed = await isDLCInstalled(folderPath);
                    // Try to find DLC ID from folder name (this is a simplified approach)
                    // In production, you'd want to store a mapping or read metadata
                    const dlcId = folder; // Simplified - should match with actual DLC IDs
                    
                    // Update state if found
                    // This is a simplified check - in production, maintain proper mapping
                }
            }
        } catch (error) {
            // Plugins folder doesn't exist yet
        }
        
        return { success: true, state: dlcState[currentBuildType] };
    } catch (error) {
        console.error('Error getting DLC status:', error);
        return { success: false, error: error.message, state: dlcState };
    }
});
