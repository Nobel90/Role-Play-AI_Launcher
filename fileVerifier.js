// fileVerifier.js
// Tiered file verification system using worker threads

const { Worker } = require('worker_threads');
const path = require('path');

// Global instance for cancellation support
let currentVerifierInstance = null;

/**
 * FileVerifier class
 * Manages worker thread for file verification to keep UI responsive
 */
class FileVerifier {
    constructor() {
        this.worker = null;
        this.isVerifying = false;
        this.cancelled = false;
    }

    /**
     * Filter files (exclude saved/, manifest files, etc.)
     */
    filterFiles(files) {
        return files.filter(file => {
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
    }

    /**
     * Create and configure worker thread
     */
    createWorker() {
        const workerPath = path.join(__dirname, 'verifierWorker.js');
        this.worker = new Worker(workerPath);
        this.cancelled = false;
        
        return this.worker;
    }

    /**
     * Clean up worker thread
     */
    cleanupWorker() {
        if (this.worker) {
            try {
                this.worker.terminate();
            } catch (error) {
                // Ignore termination errors
            }
            this.worker = null;
        }
        this.isVerifying = false;
    }

    /**
     * Tier 1: Instant Check (Metadata)
     * Check file existence and size only
     * Should take < 200ms
     */
    async verifyTier1(manifest, installPath, onProgress = null) {
        if (this.isVerifying) {
            throw new Error('Verification already in progress');
        }

        this.isVerifying = true;
        this.cancelled = false;
        currentVerifierInstance = this;
        const worker = this.createWorker();

        try {
            const filteredFiles = this.filterFiles(manifest.files);
            
            return new Promise((resolve, reject) => {
                const failedFiles = [];
                
                // Handle progress updates
                worker.on('message', (message) => {
                    if (message.type === 'progress') {
                        if (onProgress) {
                            onProgress({
                                tier: 1,
                                checked: message.checked,
                                total: message.total,
                                currentFile: message.currentFile,
                                message: `Checking ${message.currentFile}... (${message.checked}/${message.total})`
                            });
                        }
                    } else if (message.type === 'result') {
                        resolve({
                            tier: 1,
                            failedFiles: message.failedFiles,
                            totalFiles: filteredFiles.length,
                            checkedFiles: filteredFiles.length
                        });
                    } else if (message.type === 'cancelled') {
                        reject(new Error('Verification cancelled'));
                    } else if (message.type === 'error') {
                        reject(new Error(message.error));
                    }
                });

                // Handle worker errors
                worker.on('error', (error) => {
                    reject(error);
                });

                // Start verification
                worker.postMessage({
                    type: 'tier1',
                    files: filteredFiles,
                    installPath: installPath
                });

                // Check for cancellation before starting
                if (this.cancelled) {
                    worker.terminate();
                    reject(new Error('Verification cancelled'));
                    return;
                }
            });
        } finally {
            if (currentVerifierInstance === this) {
                currentVerifierInstance = null;
            }
            this.cleanupWorker();
        }
    }

    /**
     * Tier 2: Smart Sparse Check (Random Sampling)
     * Verify 5 random chunks from each file
     */
    async verifyTier2(manifest, installPath, onProgress = null) {
        if (this.isVerifying) {
            throw new Error('Verification already in progress');
        }

        this.isVerifying = true;
        this.cancelled = false;
        currentVerifierInstance = this;
        const worker = this.createWorker();

        try {
            const filteredFiles = this.filterFiles(manifest.files);
            
            return new Promise((resolve, reject) => {
                // Handle progress updates
                worker.on('message', (message) => {
                    if (message.type === 'progress') {
                        if (onProgress) {
                            onProgress({
                                tier: 2,
                                checked: message.checked,
                                total: message.total,
                                currentFile: message.currentFile,
                                message: `Verifying chunks in ${message.currentFile}... (${message.checked}/${message.total})`
                            });
                        }
                    } else if (message.type === 'result') {
                        resolve({
                            tier: 2,
                            failedFiles: message.failedFiles,
                            totalFiles: filteredFiles.length,
                            checkedFiles: filteredFiles.length
                        });
                    } else if (message.type === 'cancelled') {
                        reject(new Error('Verification cancelled'));
                    } else if (message.type === 'error') {
                        reject(new Error(message.error));
                    }
                });

                // Handle worker errors
                worker.on('error', (error) => {
                    reject(error);
                });

                // Start verification
                worker.postMessage({
                    type: 'tier2',
                    files: filteredFiles,
                    installPath: installPath
                });

                // Check for cancellation before starting
                if (this.cancelled) {
                    worker.terminate();
                    reject(new Error('Verification cancelled'));
                    return;
                }
            });
        } finally {
            if (currentVerifierInstance === this) {
                currentVerifierInstance = null;
            }
            this.cleanupWorker();
        }
    }

    /**
     * Tier 3: Deep Verify (Repair Mode)
     * Verify all chunks in all files
     */
    async verifyTier3(manifest, installPath, onProgress = null) {
        if (this.isVerifying) {
            throw new Error('Verification already in progress');
        }

        this.isVerifying = true;
        this.cancelled = false;
        currentVerifierInstance = this;
        const worker = this.createWorker();

        try {
            const filteredFiles = this.filterFiles(manifest.files);
            
            return new Promise((resolve, reject) => {
                // Handle progress updates
                worker.on('message', (message) => {
                    if (message.type === 'progress') {
                        if (onProgress) {
                            onProgress({
                                tier: 3,
                                checked: message.checked,
                                total: message.total,
                                currentFile: message.currentFile,
                                message: `Deep verifying ${message.currentFile}... (${message.checked}/${message.total})`
                            });
                        }
                    } else if (message.type === 'result') {
                        resolve({
                            tier: 3,
                            failedFiles: message.failedFiles,
                            totalFiles: filteredFiles.length,
                            checkedFiles: filteredFiles.length
                        });
                    } else if (message.type === 'cancelled') {
                        reject(new Error('Verification cancelled'));
                    } else if (message.type === 'error') {
                        reject(new Error(message.error));
                    }
                });

                // Handle worker errors
                worker.on('error', (error) => {
                    reject(error);
                });

                // Start verification
                worker.postMessage({
                    type: 'tier3',
                    files: filteredFiles,
                    installPath: installPath
                });

                // Check for cancellation before starting
                if (this.cancelled) {
                    worker.terminate();
                    reject(new Error('Verification cancelled'));
                    return;
                }
            });
        } finally {
            if (currentVerifierInstance === this) {
                currentVerifierInstance = null;
            }
            this.cleanupWorker();
        }
    }

    /**
     * Cancel current verification
     */
    cancel() {
        this.cancelled = true;
        if (this.worker) {
            try {
                // Send cancellation message to worker
                this.worker.postMessage({ type: 'cancel' });
                // Give worker a moment to handle cancellation, then terminate
                setTimeout(() => {
                    try {
                        this.worker.terminate();
                    } catch (error) {
                        // Ignore termination errors
                    }
                }, 100);
            } catch (error) {
                // If postMessage fails, just terminate
                try {
                    this.worker.terminate();
                } catch (termError) {
                    // Ignore termination errors
                }
            }
        }
        this.cleanupWorker();
    }

    /**
     * Check if verification is in progress
     */
    get verifying() {
        return this.isVerifying;
    }
}

/**
 * Cancel current verification instance (for IPC integration)
 */
function cancelCurrentVerification() {
    if (currentVerifierInstance) {
        currentVerifierInstance.cancel();
    }
}

module.exports = { FileVerifier, cancelCurrentVerification };

