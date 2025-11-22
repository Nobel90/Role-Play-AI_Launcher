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

const dataPath = path.join(app.getPath('userData'), 'launcher-data.json');

let activeDownload = {
    request: null,
    writer: null,
    isPaused: false,
    filePath: null, // Keep track of the file being written
};
const browserHeaders = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36' };

// Helper function to check if file is text-based (for debug purposes)
function isTextFile(filename) {
    const textExtensions = ['.txt', '.json', '.xml', '.html', '.css', '.js', '.glsl', '.hlsl', '.mtlx', '.ini', '.cfg', '.bat', '.sh'];
    return textExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}


async function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        minWidth: 1280,
        minHeight: 720,
        aspectRatio: 16/9,
        resizable: true,
        frame: true,
        title: 'Role-Play-AI Launcher',
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

    async start(gameId, installPath, manifestData, latestVersion) {
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
                await this.startChunkBased(gameId, installPath, manifest, latestVersion);
            } else {
                await this.startFileBased(gameId, installPath, manifest.files || [], latestVersion);
            }
        } catch (error) {
            console.error('Error parsing manifest:', error);
            // Fallback: try to use as file array if it has a files property
            if (manifestData.files && Array.isArray(manifestData.files)) {
                console.log('Falling back to file array from manifest object');
                await this.startFileBased(gameId, installPath, manifestData.files, latestVersion);
            } else {
                throw new Error(`Invalid manifest data: ${error.message}`);
            }
        }
    }

    async startChunkBased(gameId, installPath, manifest, latestVersion) {
        console.log(`Starting chunk-based download for version ${manifest.version}`);

        // Filter out non-essential files
        const filteredFiles = manifest.files.filter(file => {
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
        this.setState({ currentOperation: 'reconstructing' });
        await this.reconstructFiles(filteredFiles, installPath);

        if (this.speedInterval) {
            clearInterval(this.speedInterval);
            this.speedInterval = null;
        }

        if (this.state.status === 'downloading') {
            const versionFilePath = path.join(installPath, 'version.json');
            await fs.writeFile(versionFilePath, JSON.stringify({ version: latestVersion }, null, 2));
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
                    const response = await axios.get(chunk.url, { 
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
        for (let i = 0; i < files.length; i++) {
            if (this.state.status === 'cancelling') break;
            if (this.state.status === 'paused') {
                await new Promise(resolve => setTimeout(resolve, 500));
                i--; // Retry this file
                continue;
            }

            const file = files[i];
            const destinationPath = path.join(installPath, file.filename);
            const destinationDir = path.dirname(destinationPath);
            await fs.mkdir(destinationDir, { recursive: true });

            this.setState({
                currentFileName: path.basename(file.filename),
                filesDownloaded: i
            });

            try {
                await this.chunkManager.reconstructFile(
                    file.chunks,
                    destinationPath,
                    (progress) => {
                        const fileProgress = (i / files.length) * 100;
                        const reconstructionProgress = (progress.progress / 100) * (100 / files.length);
                        this.setState({
                            progress: fileProgress + reconstructionProgress
                        });
                    }
                );

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
            downloadManager.start(action.payload.gameId, action.payload.installPath, manifestData, action.payload.latestVersion);
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

    let selectedPath = filePaths[0];
    
    // Enforce installation in a "RolePlayAI" folder
    if (path.basename(selectedPath).toLowerCase() !== 'roleplayai') {
        selectedPath = path.join(selectedPath, 'RolePlayAI');
    }

    // The handler now returns the potentially modified path
    return selectedPath;
});

ipcMain.handle('move-install-path', async (event, { currentPath, manifestUrl }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select New Installation Directory'
    });
    if (canceled || !filePaths || filePaths.length === 0) return null;

    const newParentDir = filePaths[0];
    const newPath = path.join(newParentDir, path.basename(currentPath));

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

ipcMain.handle('check-for-updates', async (event, { gameId, installPath, manifestUrl }) => {
    try {
        const response = await axios.get(manifestUrl, { headers: browserHeaders });
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
            // Chunk-based update check
            return await checkChunkBasedUpdates(serverManifest, installPath, serverVersion, executableMissing);
        } else {
            // File-based update check (legacy)
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

async function checkChunkBasedUpdates(serverManifest, installPath, serverVersion, executableMissing) {
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

    for (const serverFile of filteredFiles) {
        const localFilePath = path.join(installPath, serverFile.filename);
        
        try {
            await fs.access(localFilePath);
            
            // Chunk the local file
            const localChunks = await chunkManager.chunkLocalFile(localFilePath);
            const localHashes = new Set(localChunks.map(c => c.hash));
            
            // Compare with server chunks
            const serverHashes = new Set(serverFile.chunks.map(c => c.hash));
            const missingChunks = serverFile.chunks.filter(c => !localHashes.has(c.hash));
            
            if (missingChunks.length > 0 || localChunks.length !== serverFile.chunks.length) {
                console.log(`❌ ${serverFile.filename} -> Missing ${missingChunks.length} chunks`);
                filesToUpdate.push(serverFile);
            } else {
                console.log(`✅ ${serverFile.filename} -> All chunks match`);
            }
        } catch (e) {
            console.log(`Checking: ${serverFile.filename} -> File not found locally. Adding to update list.`);
            filesToUpdate.push(serverFile);
        }
    }

    console.log(`--- Update Check Complete. Found ${filesToUpdate.length} files to update. ---`);

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
