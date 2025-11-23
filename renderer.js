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
            // PRODUCTION URLs (default)
            //manifestUrl: 'https://vrcentre.com.au/RolePlay_Ai/RolePlay_AI_Package/roleplayai_manifest.json',
            //versionUrl: 'https://vrcentre.com.au/RolePlay_Ai/RolePlay_AI_Package/1.0.0.2/version.json',
            // TEST SERVER URLs (uncomment to use local test server)
             manifestUrl: 'http://localhost:8080/roleplayai_manifest.json',
             versionUrl: 'http://localhost:8080/version.json',
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
        gameVersionEl.innerText = 'Version ' + (game.version || 'N/A');
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
        cancelButtonEl.classList.add('hidden'); // Hide cancel button by default
        progressContainerEl.style.display = 'none';
        locateGameContainerEl.classList.add('hidden');
        
        // Reset button styles to defaults
        settingsButtonEl.style.cursor = '';
        uninstallButtonEl.style.cursor = '';
        cancelButtonEl.style.cursor = '';
        
        switch (game.status) {
            case 'installed':
                actionButtonEl.innerText = 'LAUNCH';
                actionButtonEl.classList.add('bg-green-500', 'hover:bg-green-600', 'btn-glow');
                gameStatusTextEl.innerText = 'Ready to Launch!';
                settingsButtonEl.classList.remove('hidden');
                uninstallButtonEl.classList.remove('hidden');
                checkUpdateButtonEl.classList.remove('hidden');
                // Re-enable buttons (in case they were disabled during sync)
                settingsButtonEl.disabled = false;
                uninstallButtonEl.disabled = false;
                settingsButtonEl.style.opacity = '';
                settingsButtonEl.style.pointerEvents = '';
                settingsButtonEl.style.cursor = 'pointer';
                uninstallButtonEl.style.opacity = '';
                uninstallButtonEl.style.pointerEvents = '';
                uninstallButtonEl.style.cursor = 'pointer';
                break;
            case 'needs_update':
                actionButtonEl.innerText = 'UPDATE';
                actionButtonEl.classList.add('bg-yellow-500', 'hover:bg-yellow-600');
                gameStatusTextEl.innerText = `Update available!`;
                settingsButtonEl.classList.remove('hidden');
                uninstallButtonEl.classList.remove('hidden');
                // Re-enable buttons (in case they were disabled during sync)
                settingsButtonEl.disabled = false;
                uninstallButtonEl.disabled = false;
                settingsButtonEl.style.opacity = '';
                settingsButtonEl.style.pointerEvents = '';
                settingsButtonEl.style.cursor = 'pointer';
                uninstallButtonEl.style.opacity = '';
                uninstallButtonEl.style.pointerEvents = '';
                uninstallButtonEl.style.cursor = 'pointer';
                break;
            case 'needs_sync':
                actionButtonEl.innerText = 'SYNC FILES';
                actionButtonEl.classList.add('bg-orange-500', 'hover:bg-orange-600');
                gameStatusTextEl.innerText = 'Version mismatch detected. Click to sync files.';
                settingsButtonEl.classList.remove('hidden');
                uninstallButtonEl.classList.remove('hidden');
                // Re-enable buttons (in case they were disabled during sync)
                settingsButtonEl.disabled = false;
                uninstallButtonEl.disabled = false;
                settingsButtonEl.style.opacity = '';
                settingsButtonEl.style.pointerEvents = '';
                settingsButtonEl.style.cursor = 'pointer';
                uninstallButtonEl.style.opacity = '';
                uninstallButtonEl.style.pointerEvents = '';
                uninstallButtonEl.style.cursor = 'pointer';
                break;
            case 'syncing':
                actionButtonEl.disabled = true;
                // Add spinner to button
                actionButtonEl.innerHTML = `
                    <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    SYNCING...
                `;
                actionButtonEl.classList.add('bg-gray-500', 'cursor-not-allowed');
                gameStatusTextEl.innerText = 'Syncing files... This may take a few minutes.';
                // Show progress container - ensure it's visible
                progressContainerEl.style.display = 'block';
                progressContainerEl.classList.remove('hidden');
                if (progressBarEl) {
                    progressBarEl.style.width = '0%';
                }
                if (progressTextEl) {
                    progressTextEl.innerText = 'Starting sync... This process may take a few minutes.';
                }
                // Show download controls container (for cancel button) but hide pause button
                downloadControlsEl.classList.remove('hidden');
                pauseResumeButtonEl.classList.add('hidden');
                cancelButtonEl.classList.remove('hidden');
                cancelButtonEl.disabled = false;
                cancelButtonEl.style.opacity = '';
                cancelButtonEl.style.pointerEvents = '';
                cancelButtonEl.style.cursor = '';
                // Show but disable settings and uninstall buttons
                settingsButtonEl.classList.remove('hidden');
                uninstallButtonEl.classList.remove('hidden');
                settingsButtonEl.disabled = true;
                uninstallButtonEl.disabled = true;
                settingsButtonEl.style.opacity = '0.5';
                settingsButtonEl.style.pointerEvents = 'none';
                settingsButtonEl.style.cursor = 'not-allowed';
                uninstallButtonEl.style.opacity = '0.5';
                uninstallButtonEl.style.pointerEvents = 'none';
                uninstallButtonEl.style.cursor = 'not-allowed';
                break;
            case 'uninstalled':
                actionButtonEl.innerText = 'INSTALL';
                actionButtonEl.classList.add('bg-blue-500', 'hover:bg-blue-600', 'btn-glow');
                gameStatusTextEl.innerText = 'Not Installed';
                locateGameContainerEl.classList.remove('hidden');
                break;
            case 'verifying':
                actionButtonEl.disabled = true;
                // Add spinner to button
                actionButtonEl.innerHTML = `
                    <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    VERIFYING...
                `;
                actionButtonEl.classList.add('bg-gray-500', 'cursor-not-allowed');
                gameStatusTextEl.innerText = 'Verifying game files... This may take a few minutes.';
                // Show progress container - ensure it's visible
                progressContainerEl.style.display = 'block';
                progressContainerEl.classList.remove('hidden');
                if (progressBarEl) {
                    progressBarEl.style.width = '0%';
                }
                if (progressTextEl) {
                    progressTextEl.innerText = 'Starting verification... This process may take a few minutes.';
                }
                // Show download controls container (for cancel button) but hide pause button
                downloadControlsEl.classList.remove('hidden');
                pauseResumeButtonEl.classList.add('hidden');
                cancelButtonEl.classList.remove('hidden');
                cancelButtonEl.disabled = false;
                cancelButtonEl.style.opacity = '';
                cancelButtonEl.style.pointerEvents = '';
                cancelButtonEl.style.cursor = '';
                // Show but disable settings and uninstall buttons
                settingsButtonEl.classList.remove('hidden');
                uninstallButtonEl.classList.remove('hidden');
                settingsButtonEl.disabled = true;
                uninstallButtonEl.disabled = true;
                settingsButtonEl.style.opacity = '0.5';
                settingsButtonEl.style.pointerEvents = 'none';
                settingsButtonEl.style.cursor = 'not-allowed';
                uninstallButtonEl.style.opacity = '0.5';
                uninstallButtonEl.style.pointerEvents = 'none';
                uninstallButtonEl.style.cursor = 'not-allowed';
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
                // Add spinner to button
                actionButtonEl.innerHTML = `
                    <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    VERIFYING...
                `;
                actionButtonEl.classList.add('bg-gray-500', 'cursor-not-allowed');
                gameStatusTextEl.innerText = 'Verifying files... This may take a few minutes.';
                // Show progress container - ensure it's visible
                progressContainerEl.style.display = 'block';
                progressContainerEl.classList.remove('hidden');
                if (progressBarEl) {
                    progressBarEl.style.width = '0%';
                }
                if (progressTextEl) {
                    progressTextEl.innerText = 'Starting verification... This process may take a few minutes.';
                }
                // Show download controls container (for cancel button) but hide pause button
                downloadControlsEl.classList.remove('hidden');
                pauseResumeButtonEl.classList.add('hidden');
                cancelButtonEl.classList.remove('hidden');
                cancelButtonEl.disabled = false;
                cancelButtonEl.style.opacity = '';
                cancelButtonEl.style.pointerEvents = '';
                cancelButtonEl.style.cursor = '';
                // Show but disable settings and uninstall buttons
                settingsButtonEl.classList.remove('hidden');
                uninstallButtonEl.classList.remove('hidden');
                settingsButtonEl.disabled = true;
                uninstallButtonEl.disabled = true;
                settingsButtonEl.style.opacity = '0.5';
                settingsButtonEl.style.pointerEvents = 'none';
                settingsButtonEl.style.cursor = 'not-allowed';
                uninstallButtonEl.style.opacity = '0.5';
                uninstallButtonEl.style.pointerEvents = 'none';
                uninstallButtonEl.style.cursor = 'not-allowed';
                break;
            case 'downloading':
            case 'paused':
                actionButtonEl.classList.add('hidden');
                downloadControlsEl.classList.remove('hidden');
                pauseResumeButtonEl.classList.remove('hidden');
                cancelButtonEl.classList.remove('hidden');
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
            case 'needs_sync':
                // User clicked "Sync Files" - start chunk matching
                await syncFiles(currentGameId);
                break;
            case 'needs_update':
                 gameStatusTextEl.innerText = 'Preparing to download...';
                 actionButtonEl.disabled = true;

                 // For file-based manifests, fetch file sizes
                 if (game.manifestType !== 'chunk-based') {
                     const promises = game.filesToUpdate.map((file, index) => {
                         return window.electronAPI.getFileSize(file.url).then(size => {
                             file.size = size;
                             gameStatusTextEl.innerText = `Preparing to download... (Checked ${index + 1}/${game.filesToUpdate.length} files)`;
                         });
                     });
                     await Promise.all(promises);
                 }
                 
                 await window.electronAPI.saveGameData(gameLibrary);

                 // Pass manifest for chunk-based, files for file-based
                 const downloadPayload = {
                     gameId: currentGameId,
                     installPath: game.installPath,
                     latestVersion: game.version,
                 };

                 if (game.manifestType === 'chunk-based' && game.manifest) {
                     downloadPayload.manifest = game.manifest;
                 } else {
                     downloadPayload.files = game.filesToUpdate;
                 }

                 window.electronAPI.handleDownloadAction({
                     type: 'START',
                     payload: downloadPayload
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

    async function checkVersionOnly(gameId) {
        const game = gameLibrary[gameId];
        console.log(`Fast version check for ${gameId}, installPath: ${game.installPath}`);
        
        if (!game.installPath) {
            game.status = 'uninstalled';
            renderGame(gameId);
            return;
        }

        try {
            const result = await window.electronAPI.checkVersionOnly({
                gameId,
                installPath: game.installPath,
                manifestUrl: game.manifestUrl,
                versionUrl: game.versionUrl
            });

            if (result.error) {
                console.error('Version check error:', result.error);
                game.status = 'installed'; // Assume installed if check fails
                renderGame(gameId);
                return;
            }

            if (result.versionMismatch) {
                // Version mismatch - show "Sync Files" button
                game.status = 'needs_sync';
                game.localVersion = result.localVersion;
                game.version = result.serverVersion;
                gameStatusTextEl.innerText = `Version mismatch: Local ${result.localVersion} → Server ${result.serverVersion}`;
            } else {
                // Versions match - game is up to date
                game.status = 'installed';
                game.version = result.serverVersion;
                game.localVersion = result.localVersion;
            }

            window.electronAPI.saveGameData(gameLibrary);
            renderGame(gameId);
        } catch (error) {
            console.error('Version check failed:', error);
            game.status = 'installed'; // Fallback to installed
            renderGame(gameId);
        }
    }

    async function syncFiles(gameId) {
        const game = gameLibrary[gameId];
        console.log(`Syncing files for ${gameId}`);
        
        if (!game.installPath) {
            game.status = 'uninstalled';
            renderGame(gameId);
            return;
        }

        game.status = 'syncing';
        renderGame(gameId);

        // Set up progress listeners for chunk-based verification
        const progressHandler = (progress) => {
            console.log('Progress update received:', progress);
            const percentage = Math.round((progress.checked / progress.total) * 100);
            const message = progress.message || `Verifying ${progress.checked}/${progress.total} files...`;
            
            // Update status text
            gameStatusTextEl.innerText = `Syncing files... ${percentage}% (${progress.checked}/${progress.total})`;
            
            // Update progress bar
            if (progressBarEl) {
                progressBarEl.style.width = `${percentage}%`;
            }
            
            // Update progress text
            if (progressTextEl) {
                progressTextEl.innerText = message;
            }
            
            // Ensure progress container is visible
            if (progressContainerEl) {
                progressContainerEl.style.display = 'block';
            }
        };

        const resultHandler = (result) => {
            // Final result received - process it
            console.log('Sync result received:', result);
            
            if (result.error) {
                game.status = 'needs_sync';
                gameStatusTextEl.innerText = `Sync error: ${result.error}`;
            } else if (result.isUpdateAvailable) {
                game.status = 'needs_update';
                game.filesToUpdate = result.filesToUpdate || [];
                game.manifest = result.manifest;
                game.manifestType = result.manifestType || 'chunk-based';
                game.version = result.latestVersion;
                
                if (result.executableMissing) {
                    gameStatusTextEl.innerText = result.message || `Main executable missing. Will download ${game.filesToUpdate.length} files including the executable.`;
                } else {
                    if (game.manifestType === 'chunk-based') {
                        const totalChunks = game.filesToUpdate.reduce((sum, file) => sum + (file.chunks ? file.chunks.length : 0), 0);
                        gameStatusTextEl.innerText = result.message || `Update available. ${game.filesToUpdate.length} files, ${totalChunks} chunks to download.`;
                    } else {
                        gameStatusTextEl.innerText = result.message || `Update available. ${game.filesToUpdate.length} files to download.`;
                    }
                }
            } else {
                // No update needed - versions match after sync
                game.status = 'installed';
                game.version = result.latestVersion;
                gameStatusTextEl.innerText = 'Files are up to date!';
            }
            
            window.electronAPI.saveGameData(gameLibrary);
            renderGame(gameId);
            
            // Clean up listeners
            if (window.electronAPI.removeChunkCheckListeners) {
                window.electronAPI.removeChunkCheckListeners();
            }
        };

        const errorHandler = (error) => {
            // Handle cancellation
            if (error.cancelled) {
                gameStatusTextEl.innerText = 'Sync cancelled.';
                game.status = 'needs_sync';
            } else {
                gameStatusTextEl.innerText = `Sync error: ${error.error}`;
                game.status = 'needs_sync';
            }
            renderGame(gameId);
            
            // Clean up listeners
            if (window.electronAPI.removeChunkCheckListeners) {
                window.electronAPI.removeChunkCheckListeners();
            }
        };

        // Remove any existing listeners first to avoid duplicates
        if (window.electronAPI.removeChunkCheckListeners) {
            window.electronAPI.removeChunkCheckListeners();
        }
        
        // Set up listeners for chunk verification progress
        if (window.electronAPI.onChunkCheckProgress) {
            window.electronAPI.onChunkCheckProgress(progressHandler);
        }
        if (window.electronAPI.onChunkCheckResult) {
            window.electronAPI.onChunkCheckResult(resultHandler);
        }
        if (window.electronAPI.onChunkCheckError) {
            window.electronAPI.onChunkCheckError(errorHandler);
        }

        try {
            const result = await window.electronAPI.syncFiles({
                gameId,
                installPath: game.installPath,
                manifestUrl: game.manifestUrl
            });

            // If result indicates syncing is in progress, wait for async result
            if (result.isSyncing) {
                // Don't process result here - wait for chunk-check-result event
                game.manifest = result.manifest;
                game.manifestType = result.manifestType;
                game.version = result.latestVersion;
                return; // Exit early, result will come via event
            }
            
            // For file-based or immediate results, process normally
            if (result.error) {
                game.status = 'needs_sync';
                gameStatusTextEl.innerText = result.error;
            } else if (result.isUpdateAvailable) {
                game.status = 'needs_update';
                game.filesToUpdate = result.filesToUpdate || [];
                game.manifest = result.manifest;
                game.manifestType = result.manifestType || 'file-based';
                game.version = result.latestVersion;
            } else {
                game.status = 'installed';
                game.version = result.latestVersion;
            }
            
            // Clean up listeners if not waiting for async result
            if (window.electronAPI.removeChunkCheckListeners) {
                window.electronAPI.removeChunkCheckListeners();
            }
            
            window.electronAPI.saveGameData(gameLibrary);
            renderGame(gameId);
        } catch (error) {
            console.error('Sync files failed:', error);
            game.status = 'needs_sync';
            gameStatusTextEl.innerText = `Sync failed: ${error.message}`;
            renderGame(gameId);
            
            // Clean up listeners
            if (window.electronAPI.removeChunkCheckListeners) {
                window.electronAPI.removeChunkCheckListeners();
            }
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

        // Set up progress listeners for chunk-based verification
        const progressHandler = (progress) => {
            if (game.status === 'checking_update') {
                console.log('Verification progress update received:', progress);
                const percentage = Math.round((progress.checked / progress.total) * 100);
                const message = progress.message || `Verifying ${progress.checked}/${progress.total} files...`;
                
                // Update status text
                gameStatusTextEl.innerText = `Verifying files... ${percentage}% (${progress.checked}/${progress.total})`;
                
                // Update progress bar
                if (progressBarEl) {
                    progressBarEl.style.width = `${percentage}%`;
                }
                
                // Update progress text
                if (progressTextEl) {
                    progressTextEl.innerText = message;
                }
                
                // Ensure progress container is visible
                if (progressContainerEl) {
                    progressContainerEl.style.display = 'block';
                    progressContainerEl.classList.remove('hidden');
                }
            }
        };

        const resultHandler = (result) => {
            // Final result received - process it
            console.log('Chunk check result received:', result);
            
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
                game.filesToUpdate = result.filesToUpdate || [];
                game.manifest = result.manifest;
                game.manifestType = result.manifestType || 'chunk-based';
                game.version = result.latestVersion;
                
                if (result.executableMissing) {
                    gameStatusTextEl.innerText = result.message || `Main executable missing. Will download ${game.filesToUpdate.length} files including the executable.`;
                } else {
                    if (game.manifestType === 'chunk-based') {
                        const totalChunks = game.filesToUpdate.reduce((sum, file) => sum + (file.chunks ? file.chunks.length : 0), 0);
                        gameStatusTextEl.innerText = result.message || `Update available. ${game.filesToUpdate.length} files, ${totalChunks} chunks to download.`;
                    } else {
                        gameStatusTextEl.innerText = result.message || `Update available. ${game.filesToUpdate.length} files to download.`;
                    }
                }
            } else {
                game.status = 'installed';
                game.version = result.latestVersion;
            }
            
            window.electronAPI.saveGameData(gameLibrary);
            renderGame(gameId);
            
            // Clean up listeners
            if (window.electronAPI.removeChunkCheckListeners) {
                window.electronAPI.removeChunkCheckListeners();
            }
        };

        const errorHandler = (error) => {
            // Handle cancellation
            if (error.cancelled) {
                gameStatusTextEl.innerText = 'Verification cancelled.';
                game.status = 'installed';
            } else {
                gameStatusTextEl.innerText = `Verification error: ${error.error}`;
                game.status = 'installed';
            }
            renderGame(gameId);
            
            // Clean up listeners
            if (window.electronAPI.removeChunkCheckListeners) {
                window.electronAPI.removeChunkCheckListeners();
            }
        };

        // Set up listeners for chunk verification progress
        if (window.electronAPI.onChunkCheckProgress) {
            window.electronAPI.onChunkCheckProgress(progressHandler);
        }
        if (window.electronAPI.onChunkCheckResult) {
            window.electronAPI.onChunkCheckResult(resultHandler);
        }
        if (window.electronAPI.onChunkCheckError) {
            window.electronAPI.onChunkCheckError(errorHandler);
        }

        console.log(`Calling checkForUpdates with manifestUrl: ${game.manifestUrl}`);
        const result = await window.electronAPI.checkForUpdates({ gameId, installPath: game.installPath, manifestUrl: game.manifestUrl });
        console.log('checkForUpdates result:', result);
        
        // If result indicates checking is in progress, wait for async result
        if (result.isChecking) {
            // Don't process result here - wait for chunk-check-result event
            game.manifest = result.manifest;
            game.manifestType = result.manifestType;
            game.version = result.latestVersion;
            return; // Exit early, result will come via event
        }
        
        // For file-based or immediate results, process normally
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
            game.filesToUpdate = result.filesToUpdate || [];
            game.manifest = result.manifest;
            game.manifestType = result.manifestType || 'file-based';
            game.version = result.latestVersion;
            
            if (result.executableMissing) {
                gameStatusTextEl.innerText = result.message || `Main executable missing. Will download ${game.filesToUpdate.length} files including the executable.`;
            } else {
                if (game.manifestType === 'chunk-based') {
                    const totalChunks = game.filesToUpdate.reduce((sum, file) => sum + (file.chunks ? file.chunks.length : 0), 0);
                    gameStatusTextEl.innerText = result.message || `Update available. ${game.filesToUpdate.length} files, ${totalChunks} chunks to download.`;
                } else {
                    gameStatusTextEl.innerText = result.message || `Update available. ${game.filesToUpdate.length} files to download.`;
                }
            }
        } else {
            game.status = 'installed';
            game.version = result.latestVersion;
        }
        
        // Clean up listeners if not waiting for async result
        if (window.electronAPI.removeChunkCheckListeners) {
            window.electronAPI.removeChunkCheckListeners();
        }
        
        window.electronAPI.saveGameData(gameLibrary);
        renderGame(gameId);
    }

    async function init() {
        if (!window.electronAPI) { console.error("Fatal Error: window.electronAPI is not defined."); return; }
        
        const launcherVersionTextEl = document.getElementById('launcher-version-text');
        const updateIndicatorEl = document.getElementById('update-indicator');
        const updateStatusTextEl = document.getElementById('update-status-text');
        const appVersion = await window.electronAPI.getAppVersion();
        launcherVersionTextEl.innerText = `Launcher Version: v${appVersion}`;
        
        let updateDownloaded = false; // Track if update was successfully downloaded
        
        // Set up auto-updater status listener
        window.electronAPI.onAutoUpdaterStatus((statusData) => {
            const { status, progress, error } = statusData;
            
            switch (status) {
                case 'checking':
                    updateDownloaded = false; // Reset flag
                    updateIndicatorEl.classList.remove('hidden');
                    updateStatusTextEl.innerText = 'Checking for updates...';
                    updateStatusTextEl.classList.remove('text-red-400');
                    updateStatusTextEl.classList.add('text-blue-400');
                    break;
                case 'update-available':
                    updateDownloaded = false; // Reset flag
                    updateIndicatorEl.classList.remove('hidden');
                    updateStatusTextEl.innerText = 'Update available, downloading...';
                    updateStatusTextEl.classList.remove('text-red-400');
                    updateStatusTextEl.classList.add('text-blue-400');
                    break;
                case 'download-progress':
                    updateIndicatorEl.classList.remove('hidden');
                    const percent = Math.round(progress.percent);
                    updateStatusTextEl.innerText = `Downloading update: ${percent}%`;
                    updateStatusTextEl.classList.remove('text-red-400');
                    updateStatusTextEl.classList.add('text-blue-400');
                    break;
                case 'update-downloaded':
                    updateDownloaded = true; // Mark as downloaded
                    updateIndicatorEl.classList.remove('hidden');
                    updateStatusTextEl.innerText = 'Update ready! Restart to apply.';
                    updateStatusTextEl.classList.remove('text-red-400');
                    updateStatusTextEl.classList.add('text-blue-400');
                    break;
                case 'update-not-available':
                    updateDownloaded = false; // Reset flag
                    updateIndicatorEl.classList.add('hidden');
                    break;
                case 'error':
                    // Don't show error if update was already successfully downloaded
                    // Errors after download are usually related to installation and are expected
                    if (!updateDownloaded) {
                        updateIndicatorEl.classList.remove('hidden');
                        updateStatusTextEl.innerText = error || 'Update error';
                        updateStatusTextEl.classList.add('text-red-400');
                        updateStatusTextEl.classList.remove('text-blue-400');
                        // Hide after 5 seconds
                        setTimeout(() => {
                            updateIndicatorEl.classList.add('hidden');
                            updateStatusTextEl.classList.remove('text-red-400');
                            updateStatusTextEl.classList.add('text-blue-400');
                        }, 5000);
                    } else {
                        // Update was already downloaded, just log the error silently
                        console.log('Error occurred after update was downloaded (likely during installation):', error);
                    }
                    break;
            }
        });

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

        // On startup, do fast version check instead of full chunk matching
        for (const gameId in gameLibrary) {
            const game = gameLibrary[gameId];
            if (game.installPath && (game.status === 'installed' || game.status === 'needs_update' || game.status === 'needs_sync')) {
                console.log(`Fast version check for ${gameId} at ${game.installPath}`);
                // Do fast version check instead of full chunk matching
                await checkVersionOnly(gameId);
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
        cancelButtonEl.addEventListener('click', () => {
            const game = gameLibrary[currentGameId];
            if (game.status === 'downloading' || game.status === 'paused') {
                // Cancel download
                window.electronAPI.handleDownloadAction({ type: 'CANCEL' });
            } else if (game.status === 'checking_update' || game.status === 'verifying' || game.status === 'syncing') {
                // Cancel verification
                if (window.electronAPI.cancelVerification) {
                    window.electronAPI.cancelVerification();
                }
            }
        });
        
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

            // Update install path before calling checkForUpdates
            game.installPath = selectedPath;
            await window.electronAPI.saveGameData(gameLibrary);

            // Use the local checkForUpdates function which sets up progress listeners
            // This will show the verification UI with progress bar and throbber
            await checkForUpdates(currentGameId);
        });

    window.electronAPI.onGameLaunched(() => {
        const game = gameLibrary[currentGameId];
        game.status = 'running';
        actionButtonEl.innerText = 'Running...';
        actionButtonEl.disabled = true;
        actionButtonEl.classList.add('bg-green-800', 'cursor-not-allowed');
        actionButtonEl.classList.remove('bg-green-600', 'hover:bg-green-500', 'hover:shadow-lg', 'hover:shadow-green-500/50');
    });

    window.electronAPI.onGameClosed(() => {
        const game = gameLibrary[currentGameId];
        if (game.status === 'running') {
             game.status = 'installed';
        }
        renderGame(currentGameId);
    });

        window.electronAPI.onDownloadStateUpdate((state) => {
            const game = gameLibrary[currentGameId];
            game.status = state.status;
            renderGame(currentGameId);

            switch (state.status) {
                case 'downloading':
                    progressBarEl.style.width = `${state.progress.toFixed(2)}%`;
                    
                    // Display different messages based on operation type
                    if (state.currentOperation === 'reconstructing') {
                        progressTextEl.innerText = `Reconstructing: ${state.currentFileName || 'files'}...`;
                        gameStatusTextEl.innerText = `Reconstructing files... (${state.filesDownloaded}/${state.totalFiles})`;
                    } else {
                        // Chunk-based or file-based downloading
                        if (state.totalChunks && state.chunksDownloaded !== undefined) {
                            // Chunk-based download
                            if (state.totalBytes > 0) {
                                progressTextEl.innerText = `Downloading chunks: ${state.chunksDownloaded}/${state.totalChunks} (${formatBytes(state.downloadedBytes)} / ${formatBytes(state.totalBytes)})`;
                            } else {
                                progressTextEl.innerText = `Downloading chunks: ${state.chunksDownloaded}/${state.totalChunks}`;
                            }
                            gameStatusTextEl.innerText = `Downloading chunks... (${state.chunksDownloaded}/${state.totalChunks} chunks)`;
                        } else {
                            // File-based download
                            if (state.totalBytes > 0) {
                                progressTextEl.innerText = `Downloading: ${state.currentFileName} (${formatBytes(state.downloadedBytes)} / ${formatBytes(state.totalBytes)})`;
                            } else {
                                progressTextEl.innerText = `Downloading: ${state.currentFileName}`;
                            }
                            gameStatusTextEl.innerText = `Downloading update... (${state.filesDownloaded}/${state.totalFiles} files)`;
                        }
                    }
                    
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
    }
    
    // This is the initial call that starts the launcher logic
    init();
}
