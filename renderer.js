// Import Firebase modules. The 'type="module"' in the HTML script tag makes this possible.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- FIREBASE CONFIGURATION ---
// Use the same configuration from your web dashboard
const firebaseConfig = {
    apiKey: "AIzaSyDigbqsTEMSRXz_JgqBAIJ1BKmr6Zb7DzQ",
    authDomain: "vr-centre-7bdac.firebaseapp.com",
    projectId: "vr-centre-7bdac",
    storageBucket: "vr-centre-7bdac.firebasestorage.app",
    messagingSenderId: "236273910700",
    appId: "1:236273910700:web:10d6825337bfd26fb43009",
    measurementId: "G-7P6X25QK1R"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


// --- VIEWS & DOM Elements ---
const loginView = document.getElementById('login-view');
const launcherVIew = document.getElementById('launcher-view');
const loginForm = document.getElementById('electron-login-form');
const errorMessage = document.getElementById('error-message');
const loginButton = document.getElementById('login-button');
const usernameDisplay = document.getElementById('username-display');
const logoutButton = document.getElementById('logout-button');
const userInfo = document.getElementById('user-info');
const guestInfo = document.getElementById('guest-info');
const showLoginButton = document.getElementById('show-login-button');
const backToLauncherButton = document.getElementById('back-to-launcher');
const websiteLink = document.getElementById('website-link');
const myAccountLink = document.getElementById('my-account-link');

// --- AUTHENTICATION LOGIC ---

// Listen for auth state changes to handle automatic login
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in, now let's verify them against our Firestore database
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists() && userDoc.data().isVerified) {
            // User is verified, show the launcher
            showLauncher(userDoc.data());
        } else {
            // User is not verified or doesn't exist in Firestore, so sign them out and show login
            if (userDoc.exists() && !userDoc.data().isVerified) {
                console.log('User is not verified.');
                errorMessage.textContent = 'Account has not been verified by an administrator.';
            } else {
                console.log('User document does not exist.');
                errorMessage.textContent = 'Account not found in user records.';
            }
            await signOut(auth);
            showLauncher(null);
        }
    } else {
        // User is signed out, show the launcher screen
        showLauncher(null);
    }
});


loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    errorMessage.textContent = '';
    loginButton.disabled = true;
    loginButton.textContent = 'Signing In...';

    try {
        // signInWithEmailAndPassword will trigger the onAuthStateChanged listener if successful
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error("Login failed:", error);
        errorMessage.textContent = "Login failed. Please check your credentials.";
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = 'Log In';
    }
});

logoutButton.addEventListener('click', () => {
    signOut(auth);
});

showLoginButton.addEventListener('click', () => {
    showLogin();
});

backToLauncherButton.addEventListener('click', () => {
    showLauncher(null);
});

websiteLink.addEventListener('click', (e) => {
    e.preventDefault();
    window.electronAPI.openExternal('https://vrcentre.com.au/');
});

myAccountLink.addEventListener('click', (e) => {
    e.preventDefault();
    window.electronAPI.openExternal('https://vrcentre.com.au/account/');
});


// --- VIEW MANAGEMENT ---
let launcherInitialized = false;

function showLauncher(userData) {
    if (userData) {
        // User is logged in
        usernameDisplay.textContent = userData.username || 'PlayerOne';
        userInfo.classList.remove('hidden');
        userInfo.classList.add('flex');
        guestInfo.classList.add('hidden');
    } else {
        // User is logged out or anonymous
        userInfo.classList.add('hidden');
        userInfo.classList.remove('flex');
        // guestInfo.classList.remove('hidden');
    }
    
    loginView.classList.add('hidden');
    launcherVIew.classList.remove('hidden');
    
    // Initialize the launcher logic only once
    if (!launcherInitialized) {
        initLauncher(); 
        launcherInitialized = true;
    }
}

function showLogin() {
    loginView.classList.remove('hidden');
    launcherVIew.classList.add('hidden');
    errorMessage.textContent = '';
}


// --- LAUNCHER LOGIC (Moved from index.html) ---

function initLauncher() {
    // All of your original launcher code goes here.
    let gameLibrary = {
        'RolePlayAI': {
            name: 'Role Play AI',
            tagline: 'SYNTHETIC SCENES™ – Avatar-Led Role Play Platform',
            version: '1.0.0',
            status: 'uninstalled',
            logoUrl: 'assets/icon-white_s.png',
            backgroundUrl: 'assets/BG.png',
            installPath: null,
            executable: 'RolePlay_AI.exe',
            manifestUrl: 'https://vrcentre.com.au/RolePlay_Ai/RolePlay_AI_Package/roleplayai_manifest.json',
            versionUrl: 'https://vrcentre.com.au/RolePlay_Ai/RolePlay_AI_Package/1.0.0.2/version.json',
            filesToUpdate: [],
            isPaused: false,
        },
    };

    let currentGameId = 'RolePlayAI';

    // --- DOM Elements ---
    const gameListEl = document.getElementById('game-list'),
          gameBgEl = document.getElementById('game-background'),
          gameTitleEl = document.getElementById('game-title'),
          gameTaglineEl = document.getElementById('game-tagline'),
          gameVersionEl = document.getElementById('game-version'),
          gameStatusTextEl = document.getElementById('game-status-text'),
          actionButtonEl = document.getElementById('action-button'),
          downloadControlsEl = document.getElementById('download-controls'),
          pauseResumeButtonEl = document.getElementById('pause-resume-button'),
          cancelButtonEl = document.getElementById('cancel-button'),
          settingsButtonEl = document.getElementById('settings-button'),
          uninstallButtonEl = document.getElementById('uninstall-button'),
          checkUpdateButtonEl = document.getElementById('check-update-button'),
          progressContainerEl = document.getElementById('progress-container'),
          progressBarEl = document.getElementById('progress-bar'),
          progressTextEl = document.getElementById('progress-text'),
          downloadSpeedEl = document.getElementById('download-speed'),
          locateGameContainerEl = document.getElementById('locate-game-container'),
          settingsModalEl = document.getElementById('settings-modal'),
          closeSettingsButtonEl = document.getElementById('close-settings-button'),
          installPathDisplayEl = document.getElementById('install-path-display'),
          changePathButtonEl = document.getElementById('change-path-button'),
          locateGameLinkEl = document.getElementById('locate-game-link'),
          sidebarEl = document.getElementById('sidebar'),
          sidebarToggleEl = document.getElementById('sidebar-toggle');

    function formatBytes(bytes, decimals = 2) {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // Sidebar toggle functionality
    function toggleSidebar() {
        sidebarEl.classList.toggle('expanded');
        sidebarEl.classList.toggle('collapsed');
        
        // Save sidebar state to localStorage
        const isExpanded = sidebarEl.classList.contains('expanded');
        localStorage.setItem('sidebarExpanded', isExpanded);
    }

    // Initialize sidebar state from localStorage
    function initializeSidebar() {
        const savedState = localStorage.getItem('sidebarExpanded');
        if (savedState === null) {
            // Default to collapsed on first visit for better UX
            sidebarEl.classList.add('collapsed');
            localStorage.setItem('sidebarExpanded', 'false');
        } else if (savedState === 'true') {
            sidebarEl.classList.add('expanded');
        } else {
            sidebarEl.classList.add('collapsed');
        }
    }

    function renderGame(gameId) {
        const game = gameLibrary[gameId];
        if (!game) return;
        gameBgEl.style.opacity = '0';
        setTimeout(() => {
            gameBgEl.src = game.backgroundUrl;
            gameBgEl.onload = () => { gameBgEl.style.opacity = '1'; };
        }, 500);
        gameTitleEl.innerText = game.name;
        gameTaglineEl.innerText = game.tagline;
        gameVersionEl.innerText = `Version ${game.version || 'N/A'}`;
        updateButtonAndStatus(game);
        document.querySelectorAll('.game-logo').forEach(logo => {
            logo.classList.toggle('game-logo-active', logo.dataset.gameId === gameId);
        });
    }
    
    function updateButtonAndStatus(game) {
        actionButtonEl.className = 'px-12 py-4 text-xl font-bold rounded-lg transition-all duration-300 flex items-center justify-center min-w-[200px]';
        actionButtonEl.disabled = false;
        actionButtonEl.classList.remove('hidden');
        downloadControlsEl.classList.add('hidden');
        settingsButtonEl.classList.add('hidden');
        uninstallButtonEl.classList.add('hidden');
        checkUpdateButtonEl.classList.add('hidden');
        progressContainerEl.style.display = 'none';
        locateGameContainerEl.classList.add('hidden');
        
        switch (game.status) {
            case 'installed':
                actionButtonEl.innerText = 'LAUNCH';
                actionButtonEl.classList.add('bg-green-500', 'hover:bg-green-600', 'btn-glow');
                gameStatusTextEl.innerText = 'Ready to Launch!';
                settingsButtonEl.classList.remove('hidden');
                uninstallButtonEl.classList.remove('hidden');
                checkUpdateButtonEl.classList.remove('hidden');
                break;
            case 'needs_update':
                actionButtonEl.innerText = 'UPDATE';
                actionButtonEl.classList.add('bg-yellow-500', 'hover:bg-yellow-600');
                gameStatusTextEl.innerText = `Update available!`;
                settingsButtonEl.classList.remove('hidden');
                uninstallButtonEl.classList.remove('hidden');
                break;
            case 'uninstalled':
                actionButtonEl.innerText = 'INSTALL';
                actionButtonEl.classList.add('bg-blue-500', 'hover:bg-blue-600', 'btn-glow');
                gameStatusTextEl.innerText = 'Not Installed';
                locateGameContainerEl.classList.remove('hidden');
                break;
            case 'verifying':
                actionButtonEl.disabled = true;
                actionButtonEl.innerText = 'VERIFYING...';
                actionButtonEl.classList.add('bg-gray-500', 'cursor-not-allowed');
                gameStatusTextEl.innerText = 'Verifying game files...';
                break;
            case 'moving':
                actionButtonEl.disabled = true;
                actionButtonEl.innerText = 'MOVING...';
                actionButtonEl.classList.add('bg-gray-500', 'cursor-not-allowed');
                gameStatusTextEl.innerText = 'Moving game files to a new location...';
                settingsButtonEl.classList.add('hidden');
                uninstallButtonEl.classList.add('hidden');
                checkUpdateButtonEl.classList.add('hidden');
                break;
            case 'checking_update':
                actionButtonEl.disabled = true;
                actionButtonEl.innerText = 'Please wait...';
                actionButtonEl.classList.add('bg-gray-500', 'cursor-not-allowed');
                gameStatusTextEl.innerText = 'Checking for updates...';
                settingsButtonEl.classList.remove('hidden');
                uninstallButtonEl.classList.remove('hidden');
                break;
            case 'downloading':
            case 'paused':
                actionButtonEl.classList.add('hidden');
                downloadControlsEl.classList.remove('hidden');
                progressContainerEl.style.display = 'block';
                break;
        }
    }

    function openSettingsModal() {
        const game = gameLibrary[currentGameId];
        installPathDisplayEl.value = game.installPath || 'Not Set';
        settingsModalEl.classList.remove('hidden');
    }

    function closeSettingsModal() {
        settingsModalEl.classList.add('hidden');
    }
    
    async function handleActionButtonClick() {
        const game = gameLibrary[currentGameId];
        console.log(`Action button clicked for ${currentGameId}, status: ${game.status}`);
        
        switch (game.status) {
            case 'uninstalled':
                console.log('Game is uninstalled, selecting install directory...');
                const selectedPath = await window.electronAPI.selectInstallDir();
                console.log('Selected path:', selectedPath);
                if (selectedPath) {
                    game.installPath = selectedPath;
                    await window.electronAPI.saveGameData(gameLibrary);
                    console.log('Calling checkForUpdates...');
                    await checkForUpdates(currentGameId);
                    console.log(`After checkForUpdates, status is: ${game.status}`);
                    if (game.status === 'needs_update') {
                        console.log('Status is needs_update, calling handleActionButtonClick again...');
                        handleActionButtonClick();
                    }
                }
                break;
            case 'needs_update':
                 // Fetch file sizes before starting the download
                 gameStatusTextEl.innerText = 'Preparing to download...';
                 actionButtonEl.disabled = true;

                 const promises = game.filesToUpdate.map((file, index) => {
                     return window.electronAPI.getFileSize(file.url).then(size => {
                         file.size = size;
                         // Update progress text on the fly
                         gameStatusTextEl.innerText = `Preparing to download... (Checked ${index + 1}/${game.filesToUpdate.length} files)`;
                     });
                 });
                 
                 await Promise.all(promises);
                 await window.electronAPI.saveGameData(gameLibrary);


                 window.electronAPI.handleDownloadAction({
                     type: 'START',
                     payload: {
                        gameId: currentGameId,
                        installPath: game.installPath,
                        files: game.filesToUpdate,
                        latestVersion: game.version,
                     }
                 });
                break;
            case 'installed':
                window.electronAPI.launchGame({ installPath: game.installPath, executable: game.executable });
                actionButtonEl.innerText = 'LAUNCHING...';
                setTimeout(() => renderGame(currentGameId), 1000);
                break;
        }
    }

    function handlePauseResumeClick() {
        const game = gameLibrary[currentGameId];
        if (game.status === 'downloading') {
            window.electronAPI.handleDownloadAction({ type: 'PAUSE' });
        } else if (game.status === 'paused') {
            window.electronAPI.handleDownloadAction({ type: 'RESUME' });
        }
    }

    async function checkForUpdates(gameId) {
        const game = gameLibrary[gameId];
        console.log(`Checking for updates for ${gameId}, status: ${game.status}, installPath: ${game.installPath}`);
        
        if (!game.installPath && game.status !== 'uninstalled') {
            game.status = 'uninstalled';
            renderGame(gameId);
            return;
        }
        
        game.status = 'checking_update';
        renderGame(gameId);

        console.log(`Calling checkForUpdates with manifestUrl: ${game.manifestUrl}`);
        const result = await window.electronAPI.checkForUpdates({ gameId, installPath: game.installPath, manifestUrl: game.manifestUrl });
        console.log('checkForUpdates result:', result);
        if (result.error) {
            if (result.needsReinstall) {
                game.status = 'uninstalled';
                game.installPath = null;
                gameStatusTextEl.innerText = result.error;
            } else {
                game.status = 'installed';
                gameStatusTextEl.innerText = result.error;
            }
        } else if (result.isUpdateAvailable) {
            game.status = 'needs_update';
            game.filesToUpdate = result.filesToUpdate;
            game.version = result.latestVersion;
            
            // Show appropriate message based on whether executable is missing
            if (result.executableMissing) {
                gameStatusTextEl.innerText = result.message || 'Main executable missing. Click INSTALL to download missing files.';
            } else {
                gameStatusTextEl.innerText = result.message || `Update available. ${result.filesToUpdate.length} files to download.`;
            }
        } else {
            game.status = 'installed';
            game.version = result.latestVersion;
        }
        window.electronAPI.saveGameData(gameLibrary);
        renderGame(gameId);
    }

    async function init() {
        if (!window.electronAPI) { console.error("Fatal Error: window.electronAPI is not defined."); return; }
        
        const launcherVersionEl = document.getElementById('launcher-version');
        const appVersion = await window.electronAPI.getAppVersion();
        launcherVersionEl.innerText = `Launcher Version: v${appVersion}`;

        const loadedLibrary = await window.electronAPI.loadGameData();
        if (loadedLibrary) {
            for (const gameId in gameLibrary) {
                if (loadedLibrary[gameId]) {
                    // Merge loaded data but preserve the correct manifest URLs and executable name
                    const correctManifestUrl = gameLibrary[gameId].manifestUrl;
                    const correctVersionUrl = gameLibrary[gameId].versionUrl;
                    const correctExecutable = gameLibrary[gameId].executable;
                    gameLibrary[gameId] = { ...gameLibrary[gameId], ...loadedLibrary[gameId] };
                    // Ensure we always use the correct URLs and executable name
                    gameLibrary[gameId].manifestUrl = correctManifestUrl;
                    gameLibrary[gameId].versionUrl = correctVersionUrl;
                    gameLibrary[gameId].executable = correctExecutable;
                }
            }
        }

        for (const gameId in gameLibrary) {
            const game = gameLibrary[gameId];
            if (game.installPath && (game.status === 'installed' || game.status === 'needs_update')) {
                console.log(`Verifying installation for ${gameId} at ${game.installPath}`);
                // Verify the installation is still valid
                const result = await window.electronAPI.checkForUpdates({ 
                    gameId, 
                    installPath: game.installPath, 
                    manifestUrl: game.manifestUrl 
                });
                
                if (result.pathInvalid) {
                    // Installation is invalid, reset to uninstalled
                    console.log(`Game ${gameId} marked as uninstalled due to invalid installation`);
                    game.status = 'uninstalled';
                    game.installPath = null;
                    game.version = '0.0.0';
                } else {
                    const localVersion = await window.electronAPI.getLocalVersion(game.installPath);
                    game.version = localVersion;
                }
            }
        }

        gameListEl.innerHTML = '';
        for (const gameId in gameLibrary) {
            const game = gameLibrary[gameId];
            
            // Create container for each game item
            const gameItemEl = document.createElement('div');
            gameItemEl.className = 'flex items-center space-x-3';
            
            // Create logo element - larger size
            const logoEl = document.createElement('img');
            logoEl.src = game.logoUrl;
            logoEl.alt = `${game.name} Logo`;
            logoEl.className = 'w-12 h-12 rounded-lg cursor-pointer transition-all duration-300 hover:scale-110 game-logo flex-shrink-0';
            logoEl.dataset.gameId = gameId;
            logoEl.title = game.name; // Tooltip for collapsed state
            
            // Create text element (hidden when collapsed) - larger size
            const textEl = document.createElement('span');
            textEl.textContent = game.name;
            textEl.className = 'text-white font-medium text-base whitespace-nowrap opacity-0 transition-opacity duration-300 game-text';
            
            // Add click handler to the container
            gameItemEl.addEventListener('click', () => {
               if (gameLibrary[currentGameId].status !== 'downloading' && gameLibrary[currentGameId].status !== 'paused') {
                   currentGameId = gameId;
                   renderGame(gameId);
               }
            });
            
            gameItemEl.appendChild(logoEl);
            gameItemEl.appendChild(textEl);
            gameListEl.appendChild(gameItemEl);
        }
        actionButtonEl.addEventListener('click', handleActionButtonClick);
        pauseResumeButtonEl.addEventListener('click', handlePauseResumeClick);
        cancelButtonEl.addEventListener('click', () => window.electronAPI.handleDownloadAction({ type: 'CANCEL' }));
        
        settingsButtonEl.addEventListener('click', openSettingsModal);
        closeSettingsButtonEl.addEventListener('click', closeSettingsModal);
        
        // Sidebar toggle functionality
        sidebarToggleEl.addEventListener('click', toggleSidebar);
        initializeSidebar();

        uninstallButtonEl.addEventListener('click', () => {
            const game = gameLibrary[currentGameId];
            if (game.installPath) {
                window.electronAPI.uninstallGame(game.installPath);
            }
        });

        // Add a manual reset function for debugging
        window.resetGameStatus = () => {
            const game = gameLibrary[currentGameId];
            console.log('Manually resetting game status to uninstalled');
            game.status = 'uninstalled';
            game.installPath = null;
            game.version = '0.0.0';
            game.filesToUpdate = [];
            window.electronAPI.saveGameData(gameLibrary);
            renderGame(currentGameId);
        };

        // Add a function to clear all stored data and reset URLs
        window.clearAllGameData = async () => {
            console.log('Clearing all stored game data and resetting URLs');
            for (const gameId in gameLibrary) {
                gameLibrary[gameId].status = 'uninstalled';
                gameLibrary[gameId].installPath = null;
                gameLibrary[gameId].version = '0.0.0';
                gameLibrary[gameId].filesToUpdate = [];
                // Ensure correct URLs and executable name are set
                gameLibrary[gameId].manifestUrl = 'https://vrcentre.com.au/RolePlay_Ai/RolePlay_AI_Package/roleplayai_manifest.json';
                gameLibrary[gameId].versionUrl = 'https://vrcentre.com.au/RolePlay_Ai/RolePlay_AI_Package/1.0.0.2/version.json';
                gameLibrary[gameId].executable = 'RolePlay_AI.exe';
            }
            await window.electronAPI.saveGameData(gameLibrary);
            renderGame(currentGameId);
            console.log('All game data cleared and URLs reset');
        };

        checkUpdateButtonEl.addEventListener('click', () => checkForUpdates(currentGameId));

        changePathButtonEl.addEventListener('click', async () => {
            const game = gameLibrary[currentGameId];
            if (!game.installPath) return;

            game.status = 'moving';
            renderGame(currentGameId);
            closeSettingsModal();

            const newPath = await window.electronAPI.moveInstallPath(game.installPath);
            if (newPath) {
                game.installPath = newPath;
                await window.electronAPI.saveGameData(gameLibrary);
                game.status = 'installed';
                renderGame(currentGameId);
            } else {
                game.status = 'installed';
                renderGame(currentGameId);
            }
        });

        locateGameLinkEl.addEventListener('click', async (e) => {
            e.preventDefault();
            const game = gameLibrary[currentGameId];

            // This just opens a dialog and returns a path, no verification happens here.
            const selectedPath = await window.electronAPI.selectInstallDir();
            if (!selectedPath) {
                // User cancelled the dialog, so we revert to the last known state.
                renderGame(currentGameId);
                return;
            }

            game.status = 'checking_update'; // Use a more descriptive status
            renderGame(currentGameId);

            // Use checkForUpdates for a full integrity check on the selected path
            const result = await window.electronAPI.checkForUpdates({
                gameId: currentGameId,
                installPath: selectedPath, // Use the new path
                manifestUrl: game.manifestUrl
            });

            if (result.error) {
                game.status = 'uninstalled';
                renderGame(currentGameId);
                gameStatusTextEl.innerText = result.error || "Could not validate the selected folder.";
            } else {
                // Path is valid, now update the state
                game.installPath = selectedPath;
                game.version = result.latestVersion;
                game.filesToUpdate = result.filesToUpdate;

                if (result.isUpdateAvailable) {
                    game.status = 'needs_update';
                } else {
                    game.status = 'installed';
                }

                await window.electronAPI.saveGameData(gameLibrary);
                renderGame(currentGameId);
            }
        });

        window.electronAPI.onDownloadStateUpdate((state) => {
            const game = gameLibrary[currentGameId];
            game.status = state.status;
            renderGame(currentGameId);

            switch (state.status) {
                case 'downloading':
                    progressBarEl.style.width = `${state.progress.toFixed(2)}%`;
                    if (state.totalBytes > 0) {
                        progressTextEl.innerText = `Downloading: ${state.currentFileName} (${formatBytes(state.downloadedBytes)} / ${formatBytes(state.totalBytes)})`;
                    } else {
                        progressTextEl.innerText = `Downloading: ${state.currentFileName}`;
                    }
                    gameStatusTextEl.innerText = `Downloading update... (${state.filesDownloaded}/${state.totalFiles})`;
                    downloadSpeedEl.innerText = `Speed: ${formatBytes(state.downloadSpeed)}/s`;
                    pauseResumeButtonEl.innerText = 'Pause';
                    break;
                case 'paused':
                    gameStatusTextEl.innerText = 'Download paused.';
                    pauseResumeButtonEl.innerText = 'Resume';
                    downloadSpeedEl.innerText = '';
                    break;
                case 'success':
                    game.status = 'installed';
                    game.filesToUpdate = [];
                    window.electronAPI.saveGameData(gameLibrary);
                    renderGame(currentGameId);
                    downloadSpeedEl.innerText = '';
                    break;
                case 'error':
                    game.status = 'needs_update';
                    renderGame(currentGameId);
                    
                    // Enhanced error display with debug information
                    let errorMessage = `Error: ${state.error}`;
                    if (state.debugInfo) {
                        errorMessage += `\n\n🔍 Debug Info (${state.debugInfo.method}):`;
                        
                        if (state.debugInfo.method === 'size_verification') {
                            errorMessage += `\n📋 Expected size: ${state.debugInfo.expectedSize} bytes`;
                            errorMessage += `\n💾 Actual size:   ${state.debugInfo.actualSize} bytes`;
                            errorMessage += `\n📊 Difference:    ${state.debugInfo.difference} bytes`;
                        } else if (state.debugInfo.method === 'size_verification_no_manifest_size') {
                            errorMessage += `\n📏 File size: ${state.debugInfo.actualSize} bytes`;
                            errorMessage += `\n⚠️  No size info in manifest - using basic verification`;
                        }
                        
                        errorMessage += `\n📁 File: ${state.debugInfo.fileName}`;
                    }
                    
                    gameStatusTextEl.innerText = errorMessage;
                    downloadSpeedEl.innerText = '';
                    break;
                case 'idle':
                    game.status = 'uninstalled';
                    renderGame(currentGameId);
                    downloadSpeedEl.innerText = '';
                    break;
            }
        });

        window.electronAPI.onUninstallComplete(() => {
            const game = gameLibrary[currentGameId];
            game.status = 'uninstalled';
            game.installPath = null;
            game.version = '0.0.0';
            window.electronAPI.saveGameData(gameLibrary);
            renderGame(currentGameId);
        });

        window.electronAPI.onMoveProgress((data) => {
            gameStatusTextEl.innerText = `Moving: ${data.file} (${data.progress.toFixed(0)}%)`;
        });

        renderGame(currentGameId);
        for (const gameId in gameLibrary) {
            const game = gameLibrary[gameId];
            if (game.installPath && game.status !== 'uninstalled') {
                const versionResult = await window.electronAPI.checkForUpdates({
                    gameId: gameId,
                    installPath: game.installPath,
                    manifestUrl: game.manifestUrl
                });

                if (versionResult.pathInvalid) {
                    game.status = 'uninstalled';
                    game.installPath = null;
                } else if (versionResult.isUpdateAvailable) {
                    game.status = 'needs_update';
                    game.version = versionResult.latestVersion;
                    game.filesToUpdate = versionResult.filesToUpdate;
                    
                    // Show appropriate message based on whether executable is missing
                    if (versionResult.executableMissing) {
                        gameStatusTextEl.innerText = versionResult.message || 'Main executable missing. Click INSTALL to download missing files.';
                    } else {
                        gameStatusTextEl.innerText = versionResult.message || `Update available. ${versionResult.filesToUpdate.length} files to download.`;
                    }
                } else {
                    game.status = 'installed';
                    game.version = versionResult.latestVersion;
                }
                renderGame(gameId);
            }
        }
    }
    
    // This is the initial call that starts the launcher logic
    init();
}
