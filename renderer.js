// Import Firebase modules. The 'type="module"' in the HTML script tag makes this possible.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, onSnapshot, collection, query, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

// --- DYNAMIC SETTINGS ---
let launcherSettings = {
    ui: {
        gameTitle: 'Role Play AI',
        tagline: 'SYNTHETIC SCENES™ – Avatar-Led Role Play Platform',
        buttons: {},
        backgroundImageUrl: '',
        backgroundImages: [],
        backgroundTransitionTime: 1000,
        backgroundDisplayTime: 5000,
        logoUrl: '',
        gameName: '',
        headerLinks: []
    },
    news: {
        active: false,
        text: ''
    }
};

// Apps library - stores all apps from Firestore
let appsLibrary = {};

// Favorites management
const FAVORITES_STORAGE_KEY = 'launcher_favorites';
const DEFAULT_FAVORITES = ['RolePlayAI'];

function getFavorites() {
    try {
        const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Ensure RolePlayAI is always in favorites
            if (!parsed.includes('RolePlayAI')) {
                parsed.unshift('RolePlayAI');
                localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(parsed));
            }
            return parsed;
        }
    } catch (e) {
        console.error('Error reading favorites:', e);
    }
    return DEFAULT_FAVORITES;
}

function addToFavorites(appId) {
    const favorites = getFavorites();
    if (!favorites.includes(appId)) {
        favorites.push(appId);
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
        return true;
    }
    return false;
}

function removeFromFavorites(appId) {
    // Don't allow removing RolePlayAI
    if (appId === 'RolePlayAI') {
        return false;
    }
    const favorites = getFavorites();
    const index = favorites.indexOf(appId);
    if (index > -1) {
        favorites.splice(index, 1);
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
        return true;
    }
    return false;
}

function isFavorite(appId) {
    return getFavorites().includes(appId);
}

// Toast notification function
function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast-notification');
    const toastMessage = document.getElementById('toast-message');
    
    if (!toast || !toastMessage) return;
    
    toastMessage.textContent = message;
    
    // Remove hidden class and reset to initial state
    toast.classList.remove('hidden');
    toast.classList.add('opacity-0', '-translate-y-2');
    
    // Force reflow to ensure initial state is applied
    void toast.offsetHeight;
    
    // Animate in
    setTimeout(() => {
        toast.classList.remove('opacity-0', '-translate-y-2');
        toast.classList.add('opacity-100', 'translate-y-0');
    }, 10);
    
    // Auto-dismiss after duration
    setTimeout(() => {
        toast.classList.remove('opacity-100', 'translate-y-0');
        toast.classList.add('opacity-0', '-translate-y-2');
        
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 300); // Wait for fade-out animation
    }, duration);
}

// Background slideshow state
let backgroundSlideshowInterval = null;
let currentBackgroundIndex = 0;

// Global function to trigger UI updates (will be assigned inside initLauncher)
let triggerUIUpdate = () => {};

// Helper function to update launcherSettings from app data
function updateLauncherSettingsFromApp(data) {
    if (data.ui) {
        if (data.ui.gameTitle) launcherSettings.ui.gameTitle = data.ui.gameTitle;
        if (data.ui.tagline) launcherSettings.ui.tagline = data.ui.tagline;
        if (data.ui.buttons) {
            launcherSettings.ui.buttons = { ...launcherSettings.ui.buttons, ...data.ui.buttons };
        }
        if (data.ui.backgroundImageUrl !== undefined) launcherSettings.ui.backgroundImageUrl = data.ui.backgroundImageUrl;
        if (data.ui.backgroundImages) launcherSettings.ui.backgroundImages = data.ui.backgroundImages;
        if (data.ui.backgroundTransitionTime !== undefined) launcherSettings.ui.backgroundTransitionTime = data.ui.backgroundTransitionTime || 1000;
        if (data.ui.backgroundDisplayTime !== undefined) launcherSettings.ui.backgroundDisplayTime = data.ui.backgroundDisplayTime || 5000;
        if (data.ui.logoUrl !== undefined) launcherSettings.ui.logoUrl = data.ui.logoUrl;
        if (data.ui.gameName !== undefined) launcherSettings.ui.gameName = data.ui.gameName;
        if (data.ui.headerLinks) launcherSettings.ui.headerLinks = data.ui.headerLinks;
    }
    if (data.news) {
        launcherSettings.news = { ...launcherSettings.news, ...data.news };
    }
}

// Listen for all apps in the collection
// Try new structure first: apps collection
// Fallback to legacy: settings/launcher
const appsQuery = query(collection(db, "apps"));
onSnapshot(appsQuery, (querySnapshot) => {
    let hasRolePlayAI = false;
    let hasAnyApps = false;
    
    // Process all document changes
    querySnapshot.docChanges().forEach((change) => {
        const appId = change.doc.id;
        const data = change.doc.data();
        hasAnyApps = true;
        
        if (change.type === 'added' || change.type === 'modified') {
            // Add or update app in library
            appsLibrary[appId] = {
                appId: appId,
                name: data.name || appId,
                ui: data.ui || {},
                news: data.news || { active: false, text: '' }
            };
            
            if (appId === 'RolePlayAI') {
                hasRolePlayAI = true;
            }
            
            // If this is the current app, update launcherSettings
            if (appId === currentGameId || (!currentGameId && appId === 'RolePlayAI')) {
                updateLauncherSettingsFromApp(data);
                if (typeof triggerUIUpdate === 'function') {
                    triggerUIUpdate();
                }
            }
        } else if (change.type === 'removed') {
            // Remove app from library (but don't remove RolePlayAI)
            if (appId !== 'RolePlayAI') {
                delete appsLibrary[appId];
            }
        }
    });
    
    // Check if we have any apps (for fallback logic)
    if (querySnapshot.empty === false) {
        querySnapshot.forEach((docSnapshot) => {
            if (docSnapshot.id === 'RolePlayAI') {
                hasRolePlayAI = true;
            }
        });
    }
    
    // Update UI after processing all changes
    if (typeof renderAppFavorites === 'function') {
        renderAppFavorites();
    }
    if (typeof renderAppsGrid === 'function') {
        renderAppsGrid();
    }
    
    // Fallback to legacy if no apps found
    if (!hasAnyApps) {
        console.log('No apps found in collection, trying legacy launcher document');
        // Fallback to legacy launcher document
        onSnapshot(doc(db, "settings", "launcher"), (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                appsLibrary['RolePlayAI'] = {
                    appId: 'RolePlayAI',
                    name: 'Role Play AI',
                    ui: data.ui || {},
                    news: data.news || { active: false, text: '' }
                };
                
                // Update launcherSettings if RolePlayAI is current
                if (currentGameId === 'RolePlayAI' || !currentGameId) {
                    updateLauncherSettingsFromApp(data);
                    // Trigger UI update
                    if (typeof triggerUIUpdate === 'function') {
                        triggerUIUpdate();
                    }
                }
                
                if (typeof renderAppFavorites === 'function') {
                    renderAppFavorites();
                }
                if (typeof renderAppsGrid === 'function') {
                    renderAppsGrid();
                }
            }
        }, (legacyError) => {
            console.error('Error listening to legacy launcher settings:', legacyError);
        });
    }
}, (error) => {
    console.error('Error listening to apps collection:', error);
    console.log('Falling back to legacy launcher document');
    // Fallback to legacy launcher document
    onSnapshot(doc(db, "settings", "launcher"), (docSnapshot) => {
        if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            appsLibrary['RolePlayAI'] = {
                appId: 'RolePlayAI',
                name: 'Role Play AI',
                ui: data.ui || {},
                news: data.news || { active: false, text: '' }
            };
            
            // Update launcherSettings if RolePlayAI is current
            if (currentGameId === 'RolePlayAI' || !currentGameId) {
                updateLauncherSettingsFromApp(data);
                // Trigger UI update
                if (typeof triggerUIUpdate === 'function') {
                    triggerUIUpdate();
                }
            }
            
            if (typeof renderAppFavorites === 'function') {
                renderAppFavorites();
            }
            if (typeof renderAppsGrid === 'function') {
                renderAppsGrid();
            }
        }
    }, (legacyError) => {
        console.error('Error listening to legacy launcher settings:', legacyError);
    });
});


// --- VIEWS & DOM Elements ---
const loginView = document.getElementById('login-view');
const launcherVIew = document.getElementById('launcher-view');
const loginForm = document.getElementById('electron-login-form');
const errorMessage = document.getElementById('error-message');
const loginButton = document.getElementById('login-button');
const usernameDisplay = document.getElementById('username-display');
const logoutButton = document.getElementById('logout-button'); // Old logout button (may not exist in new design)
const userInfo = document.getElementById('user-info');
const guestInfo = document.getElementById('guest-info');
const showLoginButton = document.getElementById('show-login-button');
const backToLauncherButton = document.getElementById('back-to-launcher');
// Header links are now dynamically rendered - no static references needed

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

// Logout button handler (if it exists - new design uses dropdown)
if (logoutButton) {
logoutButton.addEventListener('click', () => {
    signOut(auth);
});
}

showLoginButton.addEventListener('click', () => {
    showLogin();
});

backToLauncherButton.addEventListener('click', () => {
    showLauncher(null);
});

// Header links are now dynamically rendered in triggerUIUpdate()


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

// --- VIEW MANAGEMENT SYSTEM ---
let currentView = 'home'; // 'home', 'apps', 'shop', 'app-detail'
let currentSelectedApp = null;
let gameLibrary = null; // Will be set in initLauncher

const homeView = document.getElementById('home-view');
const appsView = document.getElementById('apps-view');
const shopView = document.getElementById('shop-view');
const appDetailView = document.getElementById('app-detail-view');
const navTabs = document.querySelectorAll('.nav-tab');
const logoDropdown = document.getElementById('logo-dropdown');
const logoDropdownToggle = document.getElementById('logo-dropdown-toggle');
const appFavoritesContainer = document.getElementById('app-favorites-container');
const appsGrid = document.getElementById('apps-grid');

// Switch between views
function switchView(viewName) {
    // Hide all views
    homeView.classList.add('hidden');
    appsView.classList.add('hidden');
    shopView.classList.add('hidden');
    appDetailView.classList.add('hidden');
    
    // Remove active class from all tabs
    navTabs.forEach(tab => tab.classList.remove('active'));
    
    // Show selected view
    if (viewName === 'home') {
        homeView.classList.remove('hidden');
        document.querySelector('.nav-tab[data-view="home"]')?.classList.add('active');
        currentView = 'home';
    } else if (viewName === 'apps') {
        appsView.classList.remove('hidden');
        document.querySelector('.nav-tab[data-view="apps"]')?.classList.add('active');
        currentView = 'apps';
        renderAppsGrid();
    } else if (viewName === 'shop') {
        shopView.classList.remove('hidden');
        document.querySelector('.nav-tab[data-view="shop"]')?.classList.add('active');
        currentView = 'shop';
    } else if (viewName === 'app-detail') {
        appDetailView.classList.remove('hidden');
        currentView = 'app-detail';
        console.log('Switched to app-detail view');
    }
}

// Global renderGame function (will be assigned in initLauncher)
let renderGame = null;

// Global currentGameId (will be set in initLauncher, but needs to be accessible globally)
let currentGameId = 'RolePlayAI'; // Default value

// Select an app and show its detail view
function selectApp(gameId) {
    console.log('selectApp called with:', gameId);
    console.log('gameLibrary:', gameLibrary);
    console.log('appsLibrary:', appsLibrary);
    
    if (!gameId) {
        console.error('selectApp called with invalid gameId');
        return;
    }
    
    // Check if game exists
    if (!gameLibrary || !gameLibrary[gameId]) {
        console.error('Game not found in gameLibrary:', gameId, 'Available games:', gameLibrary ? Object.keys(gameLibrary) : 'gameLibrary is null');
        return;
    }
    
    currentSelectedApp = gameId;
    currentGameId = gameId;
    
    // Load app settings from appsLibrary
    if (appsLibrary[gameId]) {
        const appData = appsLibrary[gameId];
        if (appData.ui) {
            launcherSettings.ui = { ...launcherSettings.ui, ...appData.ui };
        }
        if (appData.news) {
            launcherSettings.news = { ...launcherSettings.news, ...appData.news };
        }
    }
    
    console.log('Switching to app-detail view for:', gameId);
    switchView('app-detail');
    
    if (renderGame && typeof renderGame === 'function') {
        console.log('Calling renderGame for:', gameId);
        renderGame(gameId);
    } else {
        console.warn('renderGame not yet initialized');
    }
    
    // Update favorites bar selection
    updateFavoritesSelection(gameId);
    
    // Trigger UI update
    if (typeof triggerUIUpdate === 'function') {
        triggerUIUpdate();
    }
}

// Render apps grid
function renderAppsGrid() {
    if (!appsGrid) return;
    
    appsGrid.innerHTML = '';
    
    // Combine apps from appsLibrary and gameLibrary
    const allAppIds = new Set();
    if (appsLibrary) {
        Object.keys(appsLibrary).forEach(id => allAppIds.add(id));
    }
    if (gameLibrary) {
        Object.keys(gameLibrary).forEach(id => allAppIds.add(id));
    }
    
    const favorites = getFavorites();
    
    allAppIds.forEach((appId) => {
        const appData = appsLibrary[appId];
        const gameData = gameLibrary && gameLibrary[appId];
        
        const appName = appData?.name || gameData?.name || appId;
        const tagline = appData?.ui?.tagline || gameData?.tagline || '';
        const status = gameData?.status || 'uninstalled';
        const statusBadge = getStatusBadge(status);
        const logoUrl = (appData?.ui?.logoUrl) || (gameData?.logoUrl) || 'assets/icon-white_s.png';
        const isFav = isFavorite(appId);
        
        const card = document.createElement('div');
        card.className = 'app-card p-6 relative cursor-pointer';
        card.dataset.appId = appId; // Store app ID for easier access
        
        card.innerHTML = `
            <div class="flex flex-col items-center text-center">
                <div class="relative w-24 h-24 mb-4">
                    <img src="${logoUrl}" alt="${appName}" class="w-full h-full rounded-lg object-cover">
                    <button class="favorite-toggle absolute top-0 right-0 p-1 rounded-full bg-gray-900/80 hover:bg-gray-800 transition-all ${isFav ? 'text-yellow-400' : 'text-gray-400'}" 
                            data-app-id="${appId}" data-is-favorite="${isFav}">
                        <svg class="w-5 h-5" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                    </button>
                </div>
                <h3 class="text-lg font-semibold mb-2">${appName}</h3>
                <p class="text-sm text-gray-400 mb-3">${tagline}</p>
                ${statusBadge}
            </div>
        `;
        
        // Add click handler for the card (but not for the favorite button)
        card.addEventListener('click', (e) => {
            // Don't trigger if clicking the favorite button
            if (e.target.closest('.favorite-toggle')) return;
            console.log('App card clicked:', appId);
            selectApp(appId);
        });
        
        // Add click handler for the favorite button
        const favoriteButton = card.querySelector('.favorite-toggle');
        if (favoriteButton) {
            favoriteButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent card click
                const appIdToToggle = favoriteButton.dataset.appId;
                const isCurrentlyFavorite = favoriteButton.dataset.isFavorite === 'true';
                
                if (isCurrentlyFavorite) {
                    removeFromFavorites(appIdToToggle);
                } else {
                    addToFavorites(appIdToToggle);
                }
                
                // Re-render to update UI
                renderAppFavorites();
                renderAppsGrid();
            });
        }
        
        appsGrid.appendChild(card);
    });
    
    // Make functions available globally for onclick handlers
    if (typeof window !== 'undefined') {
        window.addToFavorites = addToFavorites;
        window.removeFromFavorites = removeFromFavorites;
        window.renderAppFavorites = renderAppFavorites;
        window.renderAppsGrid = renderAppsGrid;
    }
}

// Get status badge HTML
function getStatusBadge(status) {
    const badges = {
        'installed': '<span class="px-3 py-1 bg-green-600/20 text-green-400 rounded-full text-xs font-semibold">Installed</span>',
        'needs_update': '<span class="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-full text-xs font-semibold">Update Available</span>',
        'uninstalled': '<span class="px-3 py-1 bg-gray-600/20 text-gray-400 rounded-full text-xs font-semibold">Not Installed</span>',
        'downloading': '<span class="px-3 py-1 bg-yellow-600/20 text-yellow-400 rounded-full text-xs font-semibold">Downloading</span>',
        'paused': '<span class="px-3 py-1 bg-orange-600/20 text-orange-400 rounded-full text-xs font-semibold">Paused</span>',
        'syncing': '<span class="px-3 py-1 bg-purple-600/20 text-purple-400 rounded-full text-xs font-semibold">Syncing</span>',
        'verifying': '<span class="px-3 py-1 bg-indigo-600/20 text-indigo-400 rounded-full text-xs font-semibold">Verifying</span>',
        'checking_update': '<span class="px-3 py-1 bg-cyan-600/20 text-cyan-400 rounded-full text-xs font-semibold">Checking</span>'
    };
    return badges[status] || badges['uninstalled'];
}

// Render app favorites bar
function renderAppFavorites() {
    if (!appFavoritesContainer) return;
    
    appFavoritesContainer.innerHTML = '';
    
    const favorites = getFavorites();
    
    // Only show favorited apps
    favorites.forEach((appId) => {
        // Check if app exists in appsLibrary or gameLibrary
        const appData = appsLibrary[appId];
        const gameData = gameLibrary && gameLibrary[appId];
        
        if (!appData && !gameData) return; // Skip if app doesn't exist
        
        const appName = appData?.name || gameData?.name || appId;
        const logoUrl = (appData?.ui?.logoUrl) || (gameData?.logoUrl) || 'assets/icon-white_s.png';
        
        const icon = document.createElement('div');
        icon.className = `app-favorite-icon ${currentSelectedApp === appId ? 'selected' : ''} cursor-pointer`;
        icon.dataset.appId = appId; // Add data attribute for easier identification
        icon.title = appName;
        
        const img = document.createElement('img');
        img.src = logoUrl;
        img.alt = appName;
        img.className = 'w-full h-full object-cover rounded-lg';
        
        icon.appendChild(img);
        
        // Add click handler after creating the element
        icon.addEventListener('click', () => {
            console.log('Favorite icon clicked:', appId);
            selectApp(appId);
        });
        
        appFavoritesContainer.appendChild(icon);
    });
    
    // Update selection highlight
    if (currentSelectedApp) {
        updateFavoritesSelection(currentSelectedApp);
    }
}

// Update favorites selection highlight
function updateFavoritesSelection(gameId) {
    if (!appFavoritesContainer) return;
    const icons = appFavoritesContainer.querySelectorAll('.app-favorite-icon');
    
    icons.forEach((icon) => {
        // Use data attribute to identify the app
        if (icon.dataset.appId === gameId) {
            icon.classList.add('selected');
        } else {
            icon.classList.remove('selected');
        }
    });
}

// Navigation tab click handlers
navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const view = tab.getAttribute('data-view');
        switchView(view);
    });
});

// Logo dropdown toggle
if (logoDropdownToggle && logoDropdown) {
    logoDropdownToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        logoDropdown.classList.toggle('hidden');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!logoDropdownToggle.contains(e.target) && !logoDropdown.contains(e.target)) {
            logoDropdown.classList.add('hidden');
        }
    });
}

// Dropdown menu handlers
const dropdownLogout = document.getElementById('dropdown-logout');
const dropdownExit = document.getElementById('dropdown-exit');

if (dropdownLogout) {
    dropdownLogout.addEventListener('click', () => {
        signOut(auth);
        logoDropdown.classList.add('hidden');
    });
}

if (dropdownExit) {
    dropdownExit.addEventListener('click', () => {
        if (window.electronAPI && window.electronAPI.closeWindow) {
            window.electronAPI.closeWindow();
        }
        logoDropdown.classList.add('hidden');
    });
}

// Social links handlers
const socialLinkedIn = document.getElementById('social-linkedin');
const socialInstagram = document.getElementById('social-instagram');
const socialFacebook = document.getElementById('social-facebook');

if (socialLinkedIn) {
    socialLinkedIn.addEventListener('click', () => {
        if (window.electronAPI && window.electronAPI.openExternal) {
            window.electronAPI.openExternal('https://www.linkedin.com/company/vr-centre-aus/');
        }
        logoDropdown.classList.add('hidden');
    });
}

if (socialInstagram) {
    socialInstagram.addEventListener('click', () => {
        if (window.electronAPI && window.electronAPI.openExternal) {
            window.electronAPI.openExternal('https://www.instagram.com/vrcentreaus/');
        }
        logoDropdown.classList.add('hidden');
    });
}

if (socialFacebook) {
    socialFacebook.addEventListener('click', () => {
        if (window.electronAPI && window.electronAPI.openExternal) {
            window.electronAPI.openExternal('https://www.facebook.com/vrcentreaus');
        }
        logoDropdown.classList.add('hidden');
    });
}

// --- LAUNCHER LOGIC (Moved from index.html) ---

// R2 Configuration for Production Downloads
// Public R2 URL for the bucket (configured for public read access)
// Note: The public URL already points to the bucket, so we don't include bucket name in the path
const R2_CONFIG = {
    baseUrl: 'https://pub-f87e49b41fad4c0fad84e94d65ed13cc.r2.dev',
    buildType: 'production',
    get manifestUrl() {
        // Public R2 URL format: baseUrl/[object-key]
        // Object key is: production/roleplayai_manifest.json
        return `${this.baseUrl}/${this.buildType}/roleplayai_manifest.json`;
    },
    constructChunkUrl(relativePath) {
        // Handle both relative paths and full URLs
        if (relativePath.startsWith('http')) {
            return relativePath; // Already a full URL
        }
        // Prepend base URL for relative paths (bucket name not needed in public URL)
        // relativePath is already: production/[version]/chunks/[hash-prefix]/[chunk-hash]
        return `${this.baseUrl}/${relativePath}`;
    }
};

function initLauncher() {
    // Assign the global trigger function
    triggerUIUpdate = () => {
        console.log('triggerUIUpdate called with settings:', launcherSettings);
        
        // Update News Bar
        const newsBar = document.getElementById('news-bar');
        const newsText = document.getElementById('news-text');
        if (newsBar && newsText) {
            if (launcherSettings.news.active && launcherSettings.news.text) {
                newsBar.classList.remove('hidden');
                newsBar.classList.add('flex');
                newsText.innerText = launcherSettings.news.text;
                console.log('News bar shown:', launcherSettings.news.text);
            } else {
                newsBar.classList.add('hidden');
                newsBar.classList.remove('flex');
                console.log('News bar hidden');
            }
        } else {
            console.warn('News bar elements not found:', { newsBar, newsText });
        }
        
        // Update Header Links
        const headerLinksContainer = document.getElementById('header-links-container');
        if (headerLinksContainer) {
            headerLinksContainer.innerHTML = '';
            if (launcherSettings.ui.headerLinks && launcherSettings.ui.headerLinks.length > 0) {
                const sortedLinks = [...launcherSettings.ui.headerLinks].sort((a, b) => (a.order || 0) - (b.order || 0));
                sortedLinks.forEach(link => {
                    const linkEl = document.createElement('a');
                    linkEl.href = link.url || '#';
                    linkEl.textContent = link.text || 'LINK';
                    linkEl.className = 'hover:text-white transition-all duration-300 font-semibold hover:scale-105 active:scale-95';
                    linkEl.addEventListener('click', (e) => {
                        if (link.url && link.url !== '#') {
                            e.preventDefault();
                            window.electronAPI.openExternal(link.url);
                        }
                    });
                    headerLinksContainer.appendChild(linkEl);
                });
            } else {
                // Fallback to default links if none configured
                const defaultWebsite = document.createElement('a');
                defaultWebsite.href = '#';
                defaultWebsite.textContent = 'WEBSITE';
                defaultWebsite.className = 'hover:text-white transition-all duration-300 font-semibold hover:scale-105 active:scale-95';
                defaultWebsite.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.electronAPI.openExternal('https://vrcentre.com.au/');
                });
                headerLinksContainer.appendChild(defaultWebsite);
            }
        }
        
        // Sidebar removed - no longer updating sidebar elements
        
        // Restart slideshow if settings changed
        if (typeof startBackgroundSlideshow === 'function') {
            startBackgroundSlideshow();
        }
        
        // Update game UI if launcher is initialized
        if (typeof currentGameId !== 'undefined' && typeof renderGame === 'function') {
            console.log('Calling renderGame for:', currentGameId);
            renderGame(currentGameId);
        } else {
            console.warn('Cannot update game UI - launcher not fully initialized:', {
                currentGameId: typeof currentGameId,
                renderGame: typeof renderGame
            });
        }
    };

    // All of your original launcher code goes here.
    // Make gameLibrary accessible to view management functions
    // Structure: gameLibrary[gameId][buildType] = { ... }
    gameLibrary = {
        'RolePlayAI': {
            production: {
            name: 'Role Play AI',
            tagline: 'SYNTHETIC SCENES™ – Avatar-Led Role Play Platform',
            version: '1.0.0',
            status: 'uninstalled',
            logoUrl: 'assets/icon-white_s.png',
            backgroundUrl: 'assets/BG.png',
            installPath: null,
            executable: 'RolePlay_AI.exe',
                manifestUrl: '', // Will be set by updateManifestUrls()
            filesToUpdate: [],
            isPaused: false,
        },
            staging: {
                name: 'Role Play AI',
                tagline: 'SYNTHETIC SCENES™ – Avatar-Led Role Play Platform',
                version: '1.0.0',
                status: 'uninstalled',
                logoUrl: 'assets/icon-white_s.png',
                backgroundUrl: 'assets/BG.png',
                installPath: null,
                executable: 'RolePlay_AI.exe',
                manifestUrl: '', // Will be set by updateManifestUrls()
                filesToUpdate: [],
                isPaused: false,
            }
        },
    };
    
    // Migration function to convert old structure to new structure
    function migrateGameLibrary(oldLibrary) {
        if (!oldLibrary || typeof oldLibrary !== 'object') return oldLibrary;
        
        const migrated = {};
        for (const [gameId, gameData] of Object.entries(oldLibrary)) {
            // Check if already migrated (has production/staging keys)
            if (gameData.production || gameData.staging) {
                migrated[gameId] = gameData;
            } else {
                // Migrate: copy data to both build types
                migrated[gameId] = {
                    production: { ...gameData },
                    staging: { ...gameData, installPath: null, status: 'uninstalled' }
                };
            }
        }
        return migrated;
    }

    // currentGameId is now global, just set it if needed
    if (!currentGameId) {
        currentGameId = 'RolePlayAI';
    }

    // --- DOM Elements ---
    const gameBgEl = document.getElementById('game-background'),
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
          locateGameLinkEl = document.getElementById('locate-game-link');

    function formatBytes(bytes, decimals = 2) {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // Sidebar removed - no longer needed

    // Background slideshow function
    function startBackgroundSlideshow() {
        // Clear existing interval
        if (backgroundSlideshowInterval) {
            clearInterval(backgroundSlideshowInterval);
            backgroundSlideshowInterval = null;
        }
        
        const gameBgEl = document.getElementById('game-background');
        const gameBgNextEl = document.getElementById('game-background-next');
        
        if (!gameBgEl) {
            console.warn('Background element not found, skipping slideshow');
            return;
        }
        
        const images = launcherSettings.ui.backgroundImages || [];
        if (images.length === 0) {
            // No slideshow images, use single background URL or default
            const defaultUrl = launcherSettings.ui.backgroundImageUrl || gameLibrary[currentGameId]?.backgroundUrl || '';
            if (defaultUrl) {
                gameBgEl.src = defaultUrl;
                gameBgEl.style.opacity = '1';
            }
            return;
        }
        
        // Filter out empty URLs and sort by order
        const validImages = images.filter(img => img.url && img.url.trim() !== '').sort((a, b) => (a.order || 0) - (b.order || 0));
        if (validImages.length === 0) {
            const defaultUrl = launcherSettings.ui.backgroundImageUrl || gameLibrary[currentGameId]?.backgroundUrl || '';
            if (defaultUrl) {
                gameBgEl.src = defaultUrl;
                gameBgEl.style.opacity = '1';
            }
            return;
        }
        
        const transitionTime = launcherSettings.ui.backgroundTransitionTime || 1000;
        const displayTime = launcherSettings.ui.backgroundDisplayTime || 5000;
        currentBackgroundIndex = 0;
        
        // Set initial image
        if (validImages[0]) {
            gameBgEl.src = validImages[0].url;
            gameBgEl.style.opacity = '1';
            gameBgEl.style.transition = `opacity ${transitionTime}ms ease-in-out`;
        }
        
        // If only one image, no need for slideshow
        if (validImages.length === 1) return;
        
        // Start slideshow
        backgroundSlideshowInterval = setInterval(() => {
            const bgEl = document.getElementById('game-background');
            const bgNextEl = document.getElementById('game-background-next');
            
            if (!bgEl) {
                console.warn('Background element not found in slideshow interval');
                return;
            }
            
            // Skip transition during active operations
            const game = getCurrentGame();
            const activeStates = ['downloading', 'paused', 'syncing', 'verifying', 'checking_update', 'moving'];
            if (game && activeStates.includes(game.status)) {
                return;
            }
            
            currentBackgroundIndex = (currentBackgroundIndex + 1) % validImages.length;
            const nextImage = validImages[currentBackgroundIndex];
            
            // Crossfade: fade out current, fade in next
            if (bgNextEl) {
                // Set next image
                bgNextEl.src = nextImage.url;
                bgNextEl.style.opacity = '0';
                bgNextEl.style.transition = `opacity ${transitionTime}ms ease-in-out`;
                
                // Fade in next, fade out current
                setTimeout(() => {
                    bgNextEl.style.opacity = '1';
                    bgEl.style.opacity = '0';
                }, 50);
                
                // Swap after transition
                setTimeout(() => {
                    bgEl.src = nextImage.url;
                    bgEl.style.opacity = '1';
                    bgNextEl.style.opacity = '0';
                }, transitionTime);
        } else {
                // Fallback if next element doesn't exist - simple fade
                bgEl.style.opacity = '0';
                setTimeout(() => {
                    bgEl.src = nextImage.url;
                    bgEl.style.opacity = '1';
                }, transitionTime);
            }
        }, displayTime + transitionTime);
    }

    // Assign renderGame to global variable so selectApp can access it
    renderGame = function(gameId) {
        const game = gameLibrary[gameId]?.[currentBuildType] || gameLibrary[gameId];
        if (!game) {
            console.warn('Game not found in gameLibrary:', gameId);
            return;
        }
        
        // Don't update background during active operations to prevent flashing
        const activeStates = ['downloading', 'paused', 'syncing', 'verifying', 'checking_update', 'moving'];
        const isActiveOperation = activeStates.includes(game.status);
        
        // Handle background: slideshow if configured, otherwise single image or default
        if (!isActiveOperation) {
            const hasSlideshowImages = launcherSettings.ui.backgroundImages && launcherSettings.ui.backgroundImages.length > 0;
            if (hasSlideshowImages) {
                // Start slideshow
                startBackgroundSlideshow();
            } else {
                // No slideshow, use single background URL or default
                const newBackgroundUrl = launcherSettings.ui.backgroundImageUrl || game.backgroundUrl;
                if (gameBgEl.src !== newBackgroundUrl && gameBgEl.src !== '') {
        gameBgEl.style.opacity = '0';
        setTimeout(() => {
                        gameBgEl.src = newBackgroundUrl;
            gameBgEl.onload = () => { gameBgEl.style.opacity = '1'; };
        }, 500);
                } else if (gameBgEl.src === '' && newBackgroundUrl) {
                    // Initial load
                    gameBgEl.src = newBackgroundUrl;
                    gameBgEl.onload = () => { gameBgEl.style.opacity = '1'; };
                }
            }
        }
        
        gameTitleEl.innerText = launcherSettings.ui.gameTitle || game.name;
        gameTaglineEl.innerText = launcherSettings.ui.tagline || game.tagline;
        
        // Enhanced version display: show current and latest if update available
        const currentVersion = game.localVersion || game.version || 'N/A';
        const latestVersion = game.version || 'N/A';
        if (game.status === 'needs_update' && latestVersion !== currentVersion) {
            gameVersionEl.innerText = `v${currentVersion} (Latest: v${latestVersion})`;
        } else {
            gameVersionEl.innerText = `v${currentVersion}`;
        }
        
        updateButtonAndStatus(game);
        document.querySelectorAll('.game-logo').forEach(logo => {
            logo.classList.toggle('game-logo-active', logo.dataset.gameId === gameId);
        });
        
        // Load DLCs for this app
        if (typeof window.loadDLCs === 'function') {
            window.loadDLCs(gameId);
        }
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
                actionButtonEl.innerText = launcherSettings.ui.buttons.installed || 'LAUNCH';
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
                actionButtonEl.innerText = launcherSettings.ui.buttons.needs_update || 'UPDATE';
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
                actionButtonEl.innerText = launcherSettings.ui.buttons.needs_sync || 'SYNC FILES';
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
                    ${launcherSettings.ui.buttons.syncing || 'SYNCING...'}
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
                actionButtonEl.innerText = launcherSettings.ui.buttons.uninstalled || 'INSTALL';
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
                    ${launcherSettings.ui.buttons.verifying || 'VERIFYING...'}
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
                actionButtonEl.innerText = launcherSettings.ui.buttons.moving || 'MOVING...';
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
                    ${launcherSettings.ui.buttons.checking_update || 'VERIFYING...'}
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

    // Build Type Management
    let currentBuildType = 'production';
    
    // Helper function to get current game data (with build type)
    function getCurrentGame(gameId = currentGameId) {
        if (!gameId || !gameLibrary[gameId]) return null;
        const gameData = gameLibrary[gameId];
        // Check if old structure (no build types)
        if (gameData.production || gameData.staging) {
            return gameData[currentBuildType] || gameData.production || null;
        }
        // Old structure - return as-is for backward compatibility during migration
        return gameData;
    }
    
    // Helper function to set current game data
    function setCurrentGame(gameId, data) {
        if (!gameId || !gameLibrary[gameId]) {
            gameLibrary[gameId] = { production: {}, staging: {} };
        }
        const gameData = gameLibrary[gameId];
        // Ensure build type structure exists
        if (!gameData.production && !gameData.staging) {
            // Migrate old structure
            gameLibrary[gameId] = {
                production: { ...gameData },
                staging: { ...gameData, installPath: null, status: 'uninstalled' }
            };
        }
        // Set data for current build type
        gameLibrary[gameId][currentBuildType] = { ...gameLibrary[gameId][currentBuildType], ...data };
    }
    
    async function loadBuildType() {
        try {
            const result = await window.electronAPI.getBuildType();
            if (result.success) {
                currentBuildType = result.buildType;
                updateBuildTypeUI();
                updateManifestUrls();
            }
        } catch (error) {
            console.error('Error loading build type:', error);
        }
    }
    
    function updateBuildTypeUI() {
        const buildTypeSelect = document.getElementById('build-type-select');
        const buildTypeBadge = document.getElementById('build-type-badge');
        const buildTypeBadgeHeader = document.getElementById('build-type-badge-header');
        const dlcBuildTypeBadge = document.getElementById('dlc-build-type-badge');
        const buildSwitcherLabel = document.getElementById('build-switcher-label');
        const productionCheck = document.getElementById('production-check');
        const stagingCheck = document.getElementById('staging-check');
        
        if (buildTypeSelect) {
            buildTypeSelect.value = currentBuildType;
        }
        
        const badgeClass = `px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            currentBuildType === 'production' 
                ? 'bg-green-600/30 text-green-300' 
                : 'bg-yellow-600/30 text-yellow-300'
        }`;
        const badgeText = currentBuildType.charAt(0).toUpperCase() + currentBuildType.slice(1);
        
        if (buildTypeBadge) {
            buildTypeBadge.textContent = badgeText;
            buildTypeBadge.className = badgeClass.replace('text-xs', 'text-sm');
        }
        
        if (buildTypeBadgeHeader) {
            buildTypeBadgeHeader.textContent = badgeText;
            buildTypeBadgeHeader.className = badgeClass;
        }
        
        if (dlcBuildTypeBadge) {
            dlcBuildTypeBadge.textContent = `(${badgeText})`;
            dlcBuildTypeBadge.className = badgeClass;
        }
        
        // Update build switcher dropdown
        if (buildSwitcherLabel) {
            buildSwitcherLabel.textContent = badgeText;
        }
        
        // Update checkmarks in dropdown
        if (productionCheck) {
            productionCheck.classList.toggle('hidden', currentBuildType !== 'production');
        }
        if (stagingCheck) {
            stagingCheck.classList.toggle('hidden', currentBuildType !== 'staging');
        }
        
        // Update active state on options
        document.querySelectorAll('.build-type-option').forEach(opt => {
            const isActive = opt.dataset.buildType === currentBuildType;
            opt.classList.toggle('active', isActive);
        });
    }
    
    // Build Switcher Dropdown Toggle
    function initBuildSwitcher() {
        const buildSwitcherToggle = document.getElementById('build-switcher-toggle');
        const buildSwitcherDropdown = document.getElementById('build-switcher-dropdown');
        
        if (buildSwitcherToggle && buildSwitcherDropdown) {
            // Toggle dropdown
            buildSwitcherToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = buildSwitcherDropdown.classList.contains('show');
                
                // Close all other dropdowns
                document.querySelectorAll('.logo-dropdown').forEach(dd => {
                    dd.classList.remove('show');
                    dd.classList.add('hidden');
                });
                
                if (!isOpen) {
                    buildSwitcherDropdown.classList.remove('hidden');
                    buildSwitcherDropdown.classList.add('show');
                    buildSwitcherToggle.classList.add('open');
                } else {
                    buildSwitcherDropdown.classList.remove('show');
                    buildSwitcherDropdown.classList.add('hidden');
                    buildSwitcherToggle.classList.remove('open');
                }
            });
            
            // Build type option clicks
            document.querySelectorAll('.build-type-option').forEach(opt => {
                opt.addEventListener('click', async () => {
                    const newBuildType = opt.dataset.buildType;
                    if (newBuildType && newBuildType !== currentBuildType) {
                        await handleBuildTypeChange(newBuildType);
                    }
                    // Close dropdown
                    buildSwitcherDropdown.classList.remove('show');
                    buildSwitcherDropdown.classList.add('hidden');
                    buildSwitcherToggle.classList.remove('open');
                });
            });
            
            // Close on outside click
            document.addEventListener('click', (e) => {
                if (!buildSwitcherToggle.contains(e.target) && !buildSwitcherDropdown.contains(e.target)) {
                    buildSwitcherDropdown.classList.remove('show');
                    buildSwitcherDropdown.classList.add('hidden');
                    buildSwitcherToggle.classList.remove('open');
                }
            });
        }
    }
    
    async function updateManifestUrls() {
        // Update manifest URLs for all games based on current build type
        const r2BaseUrl = 'https://pub-f87e49b41fad4c0fad84e94d65ed13cc.r2.dev';
        
        for (const gameId in gameLibrary) {
            const game = gameLibrary[gameId]?.[currentBuildType] || gameLibrary[gameId];
            // Update manifest URL to use current build type
            game.manifestUrl = `${r2BaseUrl}/${currentBuildType}/roleplayai_manifest.json`;
        }
        
        // Reload DLCs to update their manifest URLs
        if (currentGameId) {
            await loadDLCs(currentGameId);
        }
        
        // Trigger UI update
        if (typeof renderGame === 'function' && currentGameId) {
            renderGame(currentGameId);
        }
    }
    
    async function handleBuildTypeChange(newBuildType) {
        if (newBuildType === currentBuildType) return;
        
        try {
            // Save current build type's state before switching
            if (currentGameId && gameLibrary[currentGameId]) {
                await window.electronAPI.saveGameData(gameLibrary);
            }
            
            const result = await window.electronAPI.setBuildType(newBuildType);
            if (result.success) {
                const previousBuildType = currentBuildType;
                currentBuildType = newBuildType;
                
                // Invalidate catalog cache to fetch fresh data for new build type
                if (typeof invalidateCatalogCache === 'function') {
                    invalidateCatalogCache();
                }
                
                // Ensure build type structure exists for all games
                for (const gameId in gameLibrary) {
                    const gameData = gameLibrary[gameId];
                    if (!gameData.production && !gameData.staging) {
                        // Migrate old structure
                        gameLibrary[gameId] = {
                            production: { ...gameData },
                            staging: { ...gameData, installPath: null, status: 'uninstalled' }
                        };
                    }
                    // Ensure both build types exist
                    if (!gameLibrary[gameId].production) {
                        gameLibrary[gameId].production = { ...gameLibrary[gameId].staging, installPath: null, status: 'uninstalled' };
                    }
                    if (!gameLibrary[gameId].staging) {
                        gameLibrary[gameId].staging = { ...gameLibrary[gameId].production, installPath: null, status: 'uninstalled' };
                    }
                }
                
                // Reload game data to get the new build type's state
                const loadedData = await window.electronAPI.loadGameData();
                if (loadedData && Object.keys(loadedData).length > 0) {
                    // Migrate loaded data if needed
                    for (const gameId in loadedData) {
                        const gameData = loadedData[gameId];
                        if (!gameData.production && !gameData.staging) {
                            loadedData[gameId] = {
                                production: { ...gameData },
                                staging: { ...gameData, installPath: null, status: 'uninstalled' }
                            };
                        }
                    }
                    Object.assign(gameLibrary, loadedData);
                }
                
                updateBuildTypeUI();
                await updateManifestUrls();
                
                // Reload DLCs for new build type
                if (currentGameId) {
                    await loadDLCs(currentGameId);
                }
                
                // Update UI
                if (typeof renderGame === 'function' && currentGameId) {
                    renderGame(currentGameId);
                }
                
                showToast(`Build type changed to ${newBuildType}`, 3000);
            } else {
                showToast(`Error: ${result.error}`, 3000);
            }
        } catch (error) {
            console.error('Error setting build type:', error);
            showToast(`Error changing build type: ${error.message}`, 3000);
        }
    }
    
    // Listen for build type changes from main process
    window.electronAPI.onBuildTypeChanged((data) => {
        currentBuildType = data.buildType;
        updateBuildTypeUI();
        updateManifestUrls();
    });

    function openSettingsModal() {
        const game = getCurrentGame();
        installPathDisplayEl.value = game?.installPath || 'Not Set';
        // Update build type UI when opening settings
        updateBuildTypeUI();
        settingsModalEl.classList.remove('hidden');
    }

    function closeSettingsModal() {
        settingsModalEl.classList.add('hidden');
    }
    
    async function handleActionButtonClick() {
        const game = getCurrentGame();
        if (!game) {
            console.error('Game not found:', currentGameId);
            return;
        }
        console.log(`Action button clicked for ${currentGameId}, status: ${game.status}`);
        
        switch (game.status) {
            case 'uninstalled':
                console.log('Game is uninstalled, selecting install directory...');
                const selectedPath = await window.electronAPI.selectInstallDir();
                console.log('Selected path:', selectedPath);
                if (selectedPath) {
                    setCurrentGame(currentGameId, { installPath: selectedPath });
                    await window.electronAPI.saveGameData(gameLibrary);
                    console.log('Calling checkForUpdates...');
                    await checkForUpdates(currentGameId);
                    const updatedGame = getCurrentGame();
                    console.log(`After checkForUpdates, status is: ${updatedGame?.status}`);
                    if (updatedGame?.status === 'needs_update') {
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
                     // For chunk-based, also pass filesToUpdate so only those files' chunks are downloaded
                     if (game.filesToUpdate && game.filesToUpdate.length > 0) {
                         downloadPayload.filesToUpdate = game.filesToUpdate;
                     }
                 } else {
                     downloadPayload.files = game.filesToUpdate;
                 }

                 window.electronAPI.handleDownloadAction({
                     type: 'START',
                     payload: downloadPayload
                 });
                break;
            case 'installed':
                const currentGame = getCurrentGame();
                if (currentGame) {
                    window.electronAPI.launchGame({ installPath: currentGame.installPath, executable: currentGame.executable });
                }
                actionButtonEl.innerText = 'LAUNCHING...';
                setTimeout(() => renderGame(currentGameId), 1000);
                break;
        }
    }

    function handlePauseResumeClick() {
        const game = getCurrentGame();
        if (!game) return;
        if (game.status === 'downloading') {
            window.electronAPI.handleDownloadAction({ type: 'PAUSE' });
        } else if (game.status === 'paused') {
            window.electronAPI.handleDownloadAction({ type: 'RESUME' });
        }
    }

    async function checkVersionOnly(gameId) {
        const game = gameLibrary[gameId]?.[currentBuildType] || gameLibrary[gameId];
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
        const game = gameLibrary[gameId]?.[currentBuildType] || gameLibrary[gameId];
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
                        gameStatusTextEl.innerText = result.message || `Update available. ${game.filesToUpdate.length} files, ${totalChunks} parts to download.`;
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
        const game = gameLibrary[gameId]?.[currentBuildType] || gameLibrary[gameId];
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
                        gameStatusTextEl.innerText = result.message || `Update available. ${game.filesToUpdate.length} files, ${totalChunks} parts to download.`;
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
                    const gameData = gameLibrary[gameId];
                    const correctManifestUrl = (gameData[currentBuildType] || gameData.production || gameData)?.manifestUrl;
                    const correctVersionUrl = (gameData[currentBuildType] || gameData.production || gameData)?.versionUrl;
                    const correctExecutable = (gameData[currentBuildType] || gameData.production || gameData)?.executable;
                    gameLibrary[gameId] = { ...gameLibrary[gameId], ...loadedLibrary[gameId] };
                    // Ensure we always use the correct URLs and executable name
                    // Ensure build type structure exists
                    if (!gameLibrary[gameId].production && !gameLibrary[gameId].staging) {
                        gameLibrary[gameId] = {
                            production: { ...gameLibrary[gameId] },
                            staging: { ...gameLibrary[gameId], installPath: null, status: 'uninstalled' }
                        };
                    }
                    gameLibrary[gameId][currentBuildType].manifestUrl = correctManifestUrl;
                    gameLibrary[gameId][currentBuildType].versionUrl = correctVersionUrl;
                    gameLibrary[gameId][currentBuildType].executable = correctExecutable;
                }
            }
        }

        // On startup, do fast version check instead of full chunk matching
        for (const gameId in gameLibrary) {
            const game = gameLibrary[gameId]?.[currentBuildType] || gameLibrary[gameId];
            if (game.installPath && (game.status === 'installed' || game.status === 'needs_update' || game.status === 'needs_sync')) {
                console.log(`Fast version check for ${gameId} at ${game.installPath}`);
                // Do fast version check instead of full chunk matching
                await checkVersionOnly(gameId);
            }
        }

        // Sidebar removed - game list no longer rendered in sidebar
        // Attach event listeners to buttons
        if (actionButtonEl) {
        actionButtonEl.addEventListener('click', handleActionButtonClick);
        }
        if (pauseResumeButtonEl) {
        pauseResumeButtonEl.addEventListener('click', handlePauseResumeClick);
        }
        if (cancelButtonEl) {
        cancelButtonEl.addEventListener('click', () => {
            const game = getCurrentGame();
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
        }
        if (settingsButtonEl) {
        settingsButtonEl.addEventListener('click', openSettingsModal);
        }
        if (closeSettingsButtonEl) {
        closeSettingsButtonEl.addEventListener('click', closeSettingsModal);
        }
        
        // Build type selector
        const buildTypeSelect = document.getElementById('build-type-select');
        if (buildTypeSelect) {
            buildTypeSelect.addEventListener('change', (e) => {
                handleBuildTypeChange(e.target.value);
            });
        }
        
        // Load build type on initialization and update manifest URLs
        loadBuildType().then(() => {
            // Manifest URLs will be updated by loadBuildType -> updateManifestUrls
            // Initialize build switcher dropdown
            initBuildSwitcher();
        }).catch(err => {
            console.error('Error loading build type:', err);
        });
        
        // Render app favorites bar
        renderAppFavorites();
        
        // Initialize view - show app detail view by default with RolePlayAI or first favorite
        // Always show RolePlayAI by default since gameLibrary is initialized with it
        const favorites = getFavorites();
        const defaultAppId = 'RolePlayAI'; // Always default to RolePlayAI since it's in gameLibrary
        
        console.log('Initializing launcher view. gameLibrary:', gameLibrary);
        console.log('Default app ID:', defaultAppId);
        
        if (gameLibrary && gameLibrary[defaultAppId]) {
            console.log('Selecting default app:', defaultAppId);
            currentGameId = defaultAppId;
            selectApp(defaultAppId);
        } else if (gameLibrary && Object.keys(gameLibrary).length > 0) {
            // Fallback to first available game
            const firstGameId = Object.keys(gameLibrary)[0];
            console.log('Selecting first available game:', firstGameId);
            currentGameId = firstGameId;
            selectApp(firstGameId);
        } else {
            // Fallback to home view if no game is available
            console.warn('No games available in gameLibrary, showing home view');
            switchView('home');
        }
        
        // App selector modal handlers
        const addFavoriteButton = document.getElementById('add-favorite-button');
        const addFavoriteButtonAppsView = document.getElementById('add-favorite-button-apps-view');
        const appSelectorModal = document.getElementById('app-selector-modal');
        const appSelectorModalContent = document.getElementById('app-selector-modal-content');
        const closeAppSelector = document.getElementById('close-app-selector');
        const appSelectorList = document.getElementById('app-selector-list');
        
        // Function to open the app selector modal
        function openAppSelectorModal() {
            if (!appSelectorModal || !appSelectorList) return;
            
            // Populate app selector list
            appSelectorList.innerHTML = '';
            const favorites = getFavorites();
            const allAppIds = new Set();
            if (appsLibrary) Object.keys(appsLibrary).forEach(id => allAppIds.add(id));
            if (gameLibrary) Object.keys(gameLibrary).forEach(id => allAppIds.add(id));
            
            allAppIds.forEach((appId) => {
                if (favorites.includes(appId)) return; // Skip already favorited
                
                const appData = appsLibrary[appId];
                const gameData = gameLibrary && gameLibrary[appId];
                const appName = appData?.name || gameData?.name || appId;
                const logoUrl = (appData?.ui?.logoUrl) || (gameData?.logoUrl) || 'assets/icon-white_s.png';
                
                const appCard = document.createElement('div');
                appCard.className = 'bg-gray-700/50 rounded-lg p-4 cursor-pointer hover:bg-gray-700 transition-all border border-gray-600 hover:border-blue-500 hover:scale-105 transform duration-200';
                appCard.innerHTML = `
                    <div class="flex flex-col items-center text-center">
                        <img src="${logoUrl}" alt="${appName}" class="w-16 h-16 mb-2 rounded-lg object-cover shadow-lg">
                        <h3 class="text-sm font-semibold text-white">${appName}</h3>
                        <p class="text-xs text-gray-400 mt-1">Click to add</p>
                    </div>
                `;
                appCard.addEventListener('click', () => {
                    addToFavorites(appId);
                    renderAppFavorites();
                    renderAppsGrid(); // Update grid to show favorite status
                    closeAppSelectorModal();
                    showToast(`${appName} added to favorites`, 2000);
                });
                appSelectorList.appendChild(appCard);
            });
            
            if (appSelectorList.children.length === 0) {
                // Show message if no apps available
                appSelectorList.innerHTML = `
                    <div class="col-span-full text-center py-12">
                        <svg class="w-16 h-16 mx-auto text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <p class="text-gray-400 text-lg">All available apps are already in favorites</p>
                    </div>
                `;
            }
            
            // Show modal with animation
            appSelectorModal.classList.remove('hidden');
            appSelectorModal.classList.add('animate-fade-in');
            // Trigger content animation
            requestAnimationFrame(() => {
                setTimeout(() => {
                    if (appSelectorModalContent) {
                        appSelectorModalContent.classList.remove('scale-95', 'opacity-0');
                        appSelectorModalContent.classList.add('scale-100', 'opacity-100');
                    }
                }, 10);
            });
        }
        
        // Function to close the app selector modal
        function closeAppSelectorModal() {
            if (!appSelectorModal) return;
            
            // Trigger close animation
            if (appSelectorModalContent) {
                appSelectorModalContent.classList.remove('scale-100', 'opacity-100');
                appSelectorModalContent.classList.add('scale-95', 'opacity-0');
            }
            appSelectorModal.classList.remove('animate-fade-in');
            
            setTimeout(() => {
                appSelectorModal.classList.add('hidden');
            }, 300);
        }
        
        // Add event listeners for opening modal
        if (addFavoriteButton) {
            addFavoriteButton.addEventListener('click', openAppSelectorModal);
        }
        
        if (addFavoriteButtonAppsView) {
            addFavoriteButtonAppsView.addEventListener('click', openAppSelectorModal);
        }
        
        // Close modal handlers
        if (closeAppSelector) {
            closeAppSelector.addEventListener('click', closeAppSelectorModal);
        }
        
        // Close modal on outside click
        if (appSelectorModal) {
            appSelectorModal.addEventListener('click', (e) => {
                if (e.target === appSelectorModal) {
                    closeAppSelectorModal();
                }
            });
        }
        
        // Close modal on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && appSelectorModal && !appSelectorModal.classList.contains('hidden')) {
                closeAppSelectorModal();
            }
        });

        if (uninstallButtonEl) {
        uninstallButtonEl.addEventListener('click', () => {
            const game = getCurrentGame();
            if (game.installPath) {
                window.electronAPI.uninstallGame(game.installPath);
            }
        });
        }

        // Add a manual reset function for debugging
        window.resetGameStatus = () => {
            const game = getCurrentGame();
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
                // Ensure build type structure exists
                if (!gameLibrary[gameId].production && !gameLibrary[gameId].staging) {
                    gameLibrary[gameId] = {
                        production: { ...gameLibrary[gameId] },
                        staging: { ...gameLibrary[gameId], installPath: null, status: 'uninstalled' }
                    };
                }
                gameLibrary[gameId][currentBuildType].status = 'uninstalled';
                gameLibrary[gameId][currentBuildType].installPath = null;
                gameLibrary[gameId][currentBuildType].version = '0.0.0';
                gameLibrary[gameId][currentBuildType].filesToUpdate = [];
                // Ensure correct URLs and executable name are set
                // Manifest URL will be set by updateManifestUrls() based on current build type
                const r2BaseUrl = 'https://pub-f87e49b41fad4c0fad84e94d65ed13cc.r2.dev';
                gameLibrary[gameId][currentBuildType].manifestUrl = `${r2BaseUrl}/${currentBuildType}/roleplayai_manifest.json`;
                gameLibrary[gameId][currentBuildType].versionUrl = 'https://vrcentre.com.au/RolePlay_Ai/RolePlay_AI_Package/1.0.0.2/version.json';
                gameLibrary[gameId][currentBuildType].executable = 'RolePlay_AI.exe';
            }
            await window.electronAPI.saveGameData(gameLibrary);
            renderGame(currentGameId);
            console.log('All game data cleared and URLs reset');
        };

        if (checkUpdateButtonEl) {
        checkUpdateButtonEl.addEventListener('click', () => checkForUpdates(currentGameId));
        }

        changePathButtonEl.addEventListener('click', async () => {
            const game = getCurrentGame();
            if (!game || !game.installPath) return;

            setCurrentGame(currentGameId, { status: 'moving' });
            renderGame(currentGameId);
            closeSettingsModal();

            const newPath = await window.electronAPI.moveInstallPath(game.installPath);
            if (newPath) {
                setCurrentGame(currentGameId, { installPath: newPath, status: 'installed' });
                await window.electronAPI.saveGameData(gameLibrary);
                renderGame(currentGameId);
            } else {
                setCurrentGame(currentGameId, { status: 'installed' });
                renderGame(currentGameId);
            }
        });

        locateGameLinkEl.addEventListener('click', async (e) => {
            e.preventDefault();
            const game = getCurrentGame();

            // This just opens a dialog and returns a path, no verification happens here.
            const selectedPath = await window.electronAPI.selectInstallDir();
            if (!selectedPath) {
                // User cancelled the dialog, so we revert to the last known state.
                renderGame(currentGameId);
                return;
            }

            // Update install path before calling checkForUpdates
            setCurrentGame(currentGameId, { installPath: selectedPath });
            await window.electronAPI.saveGameData(gameLibrary);

            // Use the local checkForUpdates function which sets up progress listeners
            // This will show the verification UI with progress bar and throbber
            await checkForUpdates(currentGameId);
        });

    window.electronAPI.onGameLaunched(() => {
        setCurrentGame(currentGameId, { status: 'running' });
        actionButtonEl.innerText = 'Running...';
        actionButtonEl.disabled = true;
        actionButtonEl.classList.add('bg-green-800', 'cursor-not-allowed');
        actionButtonEl.classList.remove('bg-green-600', 'hover:bg-green-500', 'hover:shadow-lg', 'hover:shadow-green-500/50');
    });

    window.electronAPI.onGameClosed(() => {
        const game = getCurrentGame();
        if (game && game.status === 'running') {
            setCurrentGame(currentGameId, { status: 'installed' });
        }
        renderGame(currentGameId);
    });

        window.electronAPI.onDownloadStateUpdate((state) => {
            const game = getCurrentGame();
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
                                progressTextEl.innerText = `Downloading parts: ${state.chunksDownloaded}/${state.totalChunks} (${formatBytes(state.downloadedBytes)} / ${formatBytes(state.totalBytes)})`;
                            } else {
                                progressTextEl.innerText = `Downloading parts: ${state.chunksDownloaded}/${state.totalChunks}`;
                            }
                            gameStatusTextEl.innerText = `Downloading parts... (${state.chunksDownloaded}/${state.totalChunks} parts)`;
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
            const game = getCurrentGame();
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
        
        // Start slideshow after UI is initialized
        startBackgroundSlideshow();
        
        // Trigger UI update after initialization to apply any loaded settings
        if (typeof triggerUIUpdate === 'function') {
            triggerUIUpdate();
        }
    }
    
    // ==================== DLC Management Functions ====================
    
    let dlcList = {};
    let dlcStatus = { environments: {}, characters: {} };
    let catalogCache = null; // Cache the catalog to avoid repeated fetches
    let catalogFetchTime = 0;
    const CATALOG_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
    
    const R2_BASE_URL = 'https://pub-f87e49b41fad4c0fad84e94d65ed13cc.r2.dev';
    const CATALOG_URL = `${R2_BASE_URL}/catalog.json`;
    
    /**
     * Fetch catalog.json from R2
     * @returns {Object|null} Catalog data or null if fetch fails
     */
    async function fetchCatalog() {
        const now = Date.now();
        
        // Return cached catalog if still valid
        if (catalogCache && (now - catalogFetchTime) < CATALOG_CACHE_DURATION) {
            console.log('Using cached catalog');
            return catalogCache;
        }
        
        try {
            console.log('Fetching catalog from:', CATALOG_URL);
            const response = await fetch(CATALOG_URL, {
                cache: 'no-store', // Always fetch fresh
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                console.warn('Catalog fetch failed:', response.status, response.statusText);
                return null;
            }
            
            const catalog = await response.json();
            console.log('Catalog fetched successfully:', {
                version: catalog.catalogVersion,
                lastUpdated: catalog.lastUpdated,
                builds: Object.keys(catalog.builds || {})
            });
            
            // Cache the catalog
            catalogCache = catalog;
            catalogFetchTime = now;
            
            return catalog;
        } catch (error) {
            console.error('Error fetching catalog:', error);
            return null;
        }
    }
    
    /**
     * Convert catalog DLC entry to internal DLC format
     */
    function catalogDLCToInternal(dlcEntry) {
        return {
            id: dlcEntry.id,
            name: dlcEntry.name,
            folderName: dlcEntry.folderName,
            type: dlcEntry.type,
            level: dlcEntry.level,
            parentId: dlcEntry.parentId,
            parentVersion: dlcEntry.parentVersion,
            version: dlcEntry.version,
            manifestUrl: dlcEntry.manifestUrl,
            requiredBaseVersion: dlcEntry.requiredBaseVersion,
            requiredDLCs: dlcEntry.requiredDLCs || [],
            description: dlcEntry.description || '',
            iconUrl: dlcEntry.iconUrl || '',
            size: dlcEntry.size || 0,
            enabled: dlcEntry.enabled !== false // Default to true
        };
    }
    
    /**
     * Load DLCs for the current app
     * Priority: catalog.json (R2) → Firebase → IPC fallback
     */
    async function loadDLCs(appId) {
        console.log(`[DLC] Loading DLCs for ${appId} (build type: ${currentBuildType})`);
        
        // Strategy 1: Try catalog.json first (canonical source published by Admin)
        const catalog = await fetchCatalog();
        
        console.log('[DLC] Catalog fetch result:', catalog ? 'SUCCESS' : 'FAILED');
        if (catalog) {
            console.log('[DLC] Catalog builds available:', Object.keys(catalog.builds || {}));
            console.log('[DLC] Current build type:', currentBuildType);
        }
        
        if (catalog && catalog.builds && catalog.builds[currentBuildType]) {
            const buildCatalog = catalog.builds[currentBuildType];
            const catalogDLCs = buildCatalog.dlcs || [];
            
            console.log(`[DLC] DLCs in catalog for ${currentBuildType}:`, catalogDLCs.length, catalogDLCs.map(d => d.id));
            
            if (catalogDLCs.length > 0) {
                console.log(`[DLC] Found ${catalogDLCs.length} DLCs in catalog for ${currentBuildType}`);
                
                // Convert catalog DLCs to internal format
                dlcList = {};
                for (const dlcEntry of catalogDLCs) {
                    if (dlcEntry.enabled !== false) { // Include if enabled or not specified
                        dlcList[dlcEntry.id] = catalogDLCToInternal(dlcEntry);
                    }
                }
                
                await refreshDLCStatus();
                renderDLCs();
                return;
            }
        }
        
        console.log('Catalog empty or unavailable, falling back to Firebase...');
        
        // Strategy 2: Fallback to Firebase
        try {
            const appDoc = doc(db, 'apps', appId);
            const appSnapshot = await getDoc(appDoc);
            
            if (appSnapshot.exists()) {
                const data = appSnapshot.data();
                const allDlcs = data.dlcs || {};
                
                // Filter only enabled DLCs and update manifest URLs based on current build type
                dlcList = {};
                
                for (const [dlcId, dlc] of Object.entries(allDlcs)) {
                    if (dlc.enabled) {
                        const dlcCopy = { ...dlc };
                        
                        // Update manifest URL to use current build type
                        if (dlc.folderName && dlc.version) {
                            dlcCopy.manifestUrl = `${R2_BASE_URL}/${currentBuildType}/${dlc.folderName}/${dlc.version}/manifest.json`;
                        }
                        
                        dlcList[dlcId] = dlcCopy;
                    }
                }
                
                if (Object.keys(dlcList).length > 0) {
                    console.log(`Found ${Object.keys(dlcList).length} DLCs in Firebase`);
                    await refreshDLCStatus();
                    renderDLCs();
                    return;
                }
            }
        } catch (firebaseError) {
            console.error('Firebase DLC fetch failed:', firebaseError);
        }
        
        console.log('Firebase empty or unavailable, trying IPC fallback...');
        
        // Strategy 3: Final fallback to IPC handler (main process Firebase)
        try {
            const result = await window.electronAPI.getDLCs({ appId });
            if (result.success && Object.keys(result.dlcs || {}).length > 0) {
                dlcList = result.dlcs;
                console.log(`Found ${Object.keys(dlcList).length} DLCs via IPC`);
                await refreshDLCStatus();
                renderDLCs();
                return;
            }
        } catch (ipcError) {
            console.error('IPC DLC fetch failed:', ipcError);
        }
        
        // No DLCs found from any source
        console.log('No DLCs found from any source');
        dlcList = {};
        renderDLCs();
    }
    
    /**
     * Get base game info from catalog
     */
    async function getBaseGameInfoFromCatalog() {
        const catalog = await fetchCatalog();
        
        if (catalog && catalog.builds && catalog.builds[currentBuildType]) {
            const buildCatalog = catalog.builds[currentBuildType];
            return {
                version: buildCatalog.baseGame?.version || 'N/A',
                manifestUrl: buildCatalog.baseGame?.manifestUrl || null,
                minLauncherVersion: buildCatalog.baseGame?.minLauncherVersion || '1.0.0',
                lastUpdated: buildCatalog.baseGame?.lastUpdated || null
            };
        }
        
        return null;
    }
    
    /**
     * Invalidate catalog cache (call after build type change)
     */
    function invalidateCatalogCache() {
        catalogCache = null;
        catalogFetchTime = 0;
        console.log('Catalog cache invalidated');
    }
    
    /**
     * Refresh DLC installation status
     */
    async function refreshDLCStatus() {
        // IMPORTANT: Use build-type-specific game data
        const game = gameLibrary[currentGameId]?.[currentBuildType] || gameLibrary[currentGameId];
        if (!game || !game.installPath) {
            dlcStatus = { environments: {}, characters: {} };
            return;
        }
        
        try {
            const result = await window.electronAPI.getDLCStatus({ gamePath: game.installPath });
            if (result.success) {
                dlcStatus = result.state || { environments: {}, characters: {} };
            }
        } catch (error) {
            console.error('Error refreshing DLC status:', error);
        }
    }
    
    /**
     * Render DLCs in the UI
     */
    function renderDLCs() {
        const dlcSection = document.getElementById('dlc-section');
        const dlcContainer = document.getElementById('dlc-container');
        
        console.log('[DLC Render] dlcSection:', dlcSection ? 'found' : 'NOT FOUND');
        console.log('[DLC Render] dlcContainer:', dlcContainer ? 'found' : 'NOT FOUND');
        console.log('[DLC Render] dlcList:', dlcList);
        console.log('[DLC Render] dlcList keys:', Object.keys(dlcList));
        
        if (!dlcSection || !dlcContainer) return;
        
        // Clear container
        dlcContainer.innerHTML = '';
        
        // Check if there are any DLCs
        const enabledDLCs = Object.values(dlcList).filter(dlc => dlc.enabled);
        console.log('[DLC Render] enabledDLCs count:', enabledDLCs.length);
        console.log('[DLC Render] enabledDLCs:', enabledDLCs);
        
        if (enabledDLCs.length === 0) {
            dlcSection.classList.add('hidden');
            console.log('[DLC Render] No enabled DLCs, hiding section');
            return;
        }
        
        dlcSection.classList.remove('hidden');
        
        // Separate environments and characters
        const environments = enabledDLCs.filter(dlc => dlc.type === 'environment');
        const characters = enabledDLCs.filter(dlc => dlc.type === 'character');
        console.log('[DLC Render] environments:', environments.length, environments.map(e => e.id));
        console.log('[DLC Render] characters:', characters.length, characters.map(c => c.id));
        
        // Group characters by parent
        const charactersByParent = {};
        characters.forEach(char => {
            const parentId = char.parentId || 'orphaned';
            if (!charactersByParent[parentId]) {
                charactersByParent[parentId] = [];
            }
            charactersByParent[parentId].push(char);
        });
        
        // Render Base App info
        console.log('[DLC Render] Creating Base App card...');
        try {
            const baseAppCard = createDLCCard({
                id: 'base-app',
                name: 'Base App',
                type: 'base',
                description: 'Contains the base game files',
                installed: true
            }, null);
            dlcContainer.appendChild(baseAppCard);
            console.log('[DLC Render] Base App card added');
        } catch (e) {
            console.error('[DLC Render] Error creating Base App card:', e);
        }
        
        // Render environments with their characters
        console.log('[DLC Render] Creating environment cards...');
        environments.forEach((env, idx) => {
            console.log(`[DLC Render] Creating env card ${idx}:`, env.id, env.name);
            try {
                const envCard = createDLCCard(env, charactersByParent[env.id] || []);
                dlcContainer.appendChild(envCard);
                console.log(`[DLC Render] Env card ${idx} added`);
            } catch (e) {
                console.error(`[DLC Render] Error creating env card ${idx}:`, e);
            }
        });
        
        // Render orphaned characters
        if (charactersByParent['orphaned']) {
            console.log('[DLC Render] Creating orphaned character cards...');
            charactersByParent['orphaned'].forEach((char, idx) => {
                console.log(`[DLC Render] Creating orphan char card ${idx}:`, char.id, char.name);
                try {
                    const charCard = createDLCCard(char, []);
                    dlcContainer.appendChild(charCard);
                    console.log(`[DLC Render] Orphan char card ${idx} added`);
                } catch (e) {
                    console.error(`[DLC Render] Error creating orphan char card ${idx}:`, e);
                }
            });
        }
        
        console.log('[DLC Render] Rendering complete. dlcContainer children:', dlcContainer.children.length);
    }
    
    /**
     * Create a DLC card element
     */
    function createDLCCard(dlc, childCharacters = []) {
        const card = document.createElement('div');
        
        // Determine card styling based on type
        const cardClass = dlc.type === 'environment' 
            ? 'bg-gray-800/80 backdrop-blur-xl border border-gray-700/50 rounded-lg p-4 dlc-environment-card'
            : dlc.type === 'character'
            ? 'bg-gray-800/80 backdrop-blur-xl border border-gray-700/50 rounded-lg p-4 dlc-character-card'
            : 'bg-gray-800/80 backdrop-blur-xl border border-gray-700/50 rounded-lg p-4';
        card.className = cardClass;
        
        const isInstalled = dlc.type === 'base' || 
            (dlc.type === 'environment' && dlcStatus.environments[dlc.id]?.installed) ||
            (dlc.type === 'character' && dlcStatus.characters[dlc.id]?.installed);
        
        // Check if parent environment is installed (for characters)
        const parentInstalled = dlc.parentId ? dlcStatus.environments[dlc.parentId]?.installed : true;
        
        // Check version compatibility
        const parentVersionOk = !dlc.parentVersion || 
            !dlcStatus.environments[dlc.parentId]?.version ||
            dlcStatus.environments[dlc.parentId]?.version >= dlc.parentVersion;
        
        const canInstall = dlc.type === 'base' ? false :
            dlc.type === 'environment' ? true :
            dlc.type === 'character' ? (parentInstalled && parentVersionOk) : false;
        
        // Get level display
        const levelBadge = dlc.level === 1 
            ? '<span class="px-1.5 py-0.5 text-[10px] bg-blue-500/20 text-blue-400 rounded">L1</span>'
            : dlc.level === 2 
            ? '<span class="px-1.5 py-0.5 text-[10px] bg-purple-500/20 text-purple-400 rounded">L2</span>'
            : '';
        
        // Build metadata display
        const metadataItems = [];
        if (dlc.version) metadataItems.push(`v${dlc.version}`);
        if (dlc.folderName) metadataItems.push(dlc.folderName);
        if (dlc.requiredBaseVersion) metadataItems.push(`Base ≥${dlc.requiredBaseVersion}`);
        if (dlc.parentVersion) metadataItems.push(`Parent ≥${dlc.parentVersion}`);
        
        // Count installed children for environment
        const installedChildrenCount = dlc.type === 'environment' 
            ? childCharacters.filter(c => dlcStatus.characters[c.id]?.installed).length 
            : 0;
        
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2 flex-wrap">
                        ${levelBadge}
                        <h3 class="text-lg font-semibold text-white">${dlc.name || dlc.id}</h3>
                        ${dlc.type === 'environment' ? '<span class="px-2 py-1 text-xs bg-blue-600/30 text-blue-300 rounded">Environment</span>' : ''}
                        ${dlc.type === 'character' ? '<span class="px-2 py-1 text-xs bg-purple-600/30 text-purple-300 rounded">Character</span>' : ''}
                        ${dlc.type === 'base' ? '<span class="px-2 py-1 text-xs bg-green-600/30 text-green-300 rounded">Base</span>' : ''}
                        ${isInstalled ? '<span class="px-2 py-1 text-xs bg-green-600/30 text-green-300 rounded flex items-center gap-1"><svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>Installed</span>' : ''}
                        ${installedChildrenCount > 0 ? `<span class="px-2 py-1 text-xs bg-purple-600/20 text-purple-300 rounded">${installedChildrenCount} Character${installedChildrenCount > 1 ? 's' : ''}</span>` : ''}
                    </div>
                    ${dlc.description ? `<p class="text-sm text-gray-400 mb-2">${dlc.description}</p>` : ''}
                    <div class="flex flex-wrap gap-2 text-xs text-gray-500">
                        ${metadataItems.map(item => `<span class="bg-gray-700/50 px-2 py-0.5 rounded">${item}</span>`).join('')}
                    </div>
                </div>
                <div class="flex gap-2 items-center">
                    ${dlc.type !== 'base' ? `
                        ${!isInstalled && canInstall ? `
                            <button class="dlc-install-btn px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2" data-dlc-id="${dlc.id}">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Install
                            </button>
                        ` : ''}
                        ${!isInstalled && !canInstall && dlc.type === 'character' ? `
                            <div class="flex flex-col items-end gap-1">
                                <button class="px-4 py-2 bg-gray-600 text-gray-400 rounded-lg text-sm font-medium cursor-not-allowed" disabled>
                                    Install
                                </button>
                                <span class="text-[10px] text-yellow-500">${!parentInstalled ? 'Install parent first' : 'Parent version mismatch'}</span>
                            </div>
                        ` : ''}
                        ${isInstalled ? `
                            <button class="dlc-uninstall-btn px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2" data-dlc-id="${dlc.id}" ${installedChildrenCount > 0 ? 'data-has-children="true"' : ''}>
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Uninstall
                            </button>
                            <button class="dlc-verify-btn px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-all" data-dlc-id="${dlc.id}" title="Verify Files">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </button>
                        ` : ''}
                    ` : ''}
                </div>
            </div>
            ${childCharacters.length > 0 ? `
                <div class="mt-4 dlc-child-container space-y-2">
                    <div class="text-xs text-gray-500 mb-2 flex items-center gap-2">
                        <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Characters (${childCharacters.length})
                    </div>
                    ${childCharacters.map(char => {
                        const charInstalled = dlcStatus.characters[char.id]?.installed;
                        const charMetadata = [];
                        if (char.version) charMetadata.push(`v${char.version}`);
                        if (char.folderName) charMetadata.push(char.folderName);
                        
                        return `
                            <div class="bg-gray-700/50 rounded-lg p-3 flex justify-between items-center hover:bg-gray-700/70 transition-colors">
                                <div class="flex items-center gap-3">
                                    <span class="px-1.5 py-0.5 text-[10px] bg-purple-500/20 text-purple-400 rounded">L2</span>
                                    <div>
                                        <div class="text-white font-medium">${char.name || char.folderName}</div>
                                        <div class="text-xs text-gray-400">${charMetadata.join(' • ')}</div>
                                    </div>
                                    ${charInstalled ? '<span class="px-1.5 py-0.5 text-[10px] bg-green-600/30 text-green-300 rounded">Installed</span>' : ''}
                                </div>
                                <div class="flex gap-2">
                                    ${!charInstalled && isInstalled ? `
                                        <button class="dlc-install-btn px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-all flex items-center gap-1" data-dlc-id="${char.id}">
                                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                            Install
                                        </button>
                                    ` : ''}
                                    ${!charInstalled && !isInstalled ? `
                                        <span class="text-[10px] text-gray-500">Install environment first</span>
                                    ` : ''}
                                    ${charInstalled ? `
                                        <button class="dlc-uninstall-btn px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-all flex items-center gap-1" data-dlc-id="${char.id}">
                                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                            Uninstall
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            ` : ''}
        `;
        
        // Add event listeners for all install/uninstall buttons
        card.querySelectorAll('.dlc-install-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleDLCInstall(btn.dataset.dlcId);
            });
        });
        
        card.querySelectorAll('.dlc-uninstall-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const dlcId = btn.dataset.dlcId;
                const hasChildren = btn.dataset.hasChildren === 'true';
                
                if (hasChildren) {
                    // Show warning about dependent children
                    handleDLCUninstallWithDependents(dlcId);
                } else {
                    handleDLCUninstall(dlcId);
                }
            });
        });
        
        card.querySelectorAll('.dlc-verify-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleDLCVerify(btn.dataset.dlcId);
            });
        });
        
        return card;
    }
    
    /**
     * Handle DLC uninstall with dependency check
     */
    async function handleDLCUninstallWithDependents(dlcId) {
        const dlc = dlcList[dlcId];
        if (!dlc) return;
        
        // Find all installed children
        const installedChildren = Object.values(dlcList)
            .filter(d => d.type === 'character' && d.parentId === dlcId && dlcStatus.characters[d.id]?.installed);
        
        if (installedChildren.length > 0) {
            const childNames = installedChildren.map(c => c.name || c.folderName).join(', ');
            const confirmMsg = `This environment has ${installedChildren.length} installed character(s): ${childNames}\n\nYou must uninstall these characters first before removing the environment.\n\nWould you like to uninstall all characters first?`;
            
            if (confirm(confirmMsg)) {
                // Uninstall all children first
                for (const child of installedChildren) {
                    showToast(`Uninstalling ${child.name}...`, 2000);
                    await handleDLCUninstall(child.id);
                }
                // Then uninstall the parent
                await handleDLCUninstall(dlcId);
            }
        } else {
            // No installed children, proceed with normal uninstall
            handleDLCUninstall(dlcId);
        }
    }
    
    /**
     * Handle DLC installation
     */
    async function handleDLCInstall(dlcId) {
        const dlc = dlcList[dlcId];
        if (!dlc) {
            showToast('DLC not found', 3000);
            return;
        }
        
        // IMPORTANT: Use build-type-specific game data for correct install path
        const game = gameLibrary[currentGameId]?.[currentBuildType] || gameLibrary[currentGameId];
        console.log(`[DLC Install] Using game path for ${currentBuildType}:`, game?.installPath);
        
        if (!game || !game.installPath) {
            showToast('Game must be installed first', 3000);
            return;
        }
        
        try {
            showToast(`Installing ${dlc.name}...`, 3000);
            
            const result = await window.electronAPI.downloadDLC({
                dlcId: dlc.id,
                manifestUrl: dlc.manifestUrl,
                gamePath: game.installPath,
                dlcFolderName: dlc.folderName,
                dlcList: dlcList
            });
            
            if (result.success) {
                showToast(`${dlc.name} installed successfully!`, 3000);
                await refreshDLCStatus();
                renderDLCs();
            } else {
                showToast(`Installation failed: ${result.error}`, 5000);
            }
        } catch (error) {
            console.error('Error installing DLC:', error);
            showToast(`Error installing DLC: ${error.message}`, 5000);
        }
    }
    
    /**
     * Handle DLC uninstallation
     */
    async function handleDLCUninstall(dlcId) {
        const dlc = dlcList[dlcId];
        if (!dlc) {
            showToast('DLC not found', 3000);
            return;
        }
        
        // IMPORTANT: Use build-type-specific game data for correct install path
        const game = gameLibrary[currentGameId]?.[currentBuildType] || gameLibrary[currentGameId];
        console.log(`[DLC Uninstall] Using game path for ${currentBuildType}:`, game?.installPath);
        
        if (!game || !game.installPath) {
            showToast('Game path not found', 3000);
            return;
        }
        
        if (!confirm(`Are you sure you want to uninstall ${dlc.name}?`)) {
            return;
        }
        
        try {
            showToast(`Uninstalling ${dlc.name}...`, 3000);
            
            const result = await window.electronAPI.uninstallDLC({
                dlcId: dlc.id,
                gamePath: game.installPath,
                dlcFolderName: dlc.folderName,
                dlcList: dlcList
            });
            
            if (result.success) {
                showToast(`${dlc.name} uninstalled successfully!`, 3000);
                await refreshDLCStatus();
                renderDLCs();
            } else {
                showToast(`Uninstallation failed: ${result.error}`, 5000);
            }
        } catch (error) {
            console.error('Error uninstalling DLC:', error);
            showToast(`Error uninstalling DLC: ${error.message}`, 5000);
        }
    }
    
    /**
     * Handle DLC verification
     */
    async function handleDLCVerify(dlcId) {
        const dlc = dlcList[dlcId];
        if (!dlc) {
            showToast('DLC not found', 3000);
            return;
        }
        
        // IMPORTANT: Use build-type-specific game data for correct install path
        const game = gameLibrary[currentGameId]?.[currentBuildType] || gameLibrary[currentGameId];
        console.log(`[DLC Verify] Using game path for ${currentBuildType}:`, game?.installPath);
        
        if (!game || !game.installPath) {
            showToast('Game path not found', 3000);
            return;
        }
        
        // Construct install path (path.join is not available in browser, use string concatenation)
        const installPath = `${game.installPath.replace(/\\/g, '/')}/RolePlay_AI/Plugins/${dlc.folderName}`;
        
        try {
            showToast(`Verifying ${dlc.name}...`, 3000);
            
            const result = await window.electronAPI.verifyDLC({
                dlcId: dlc.id,
                manifestUrl: dlc.manifestUrl,
                installPath: installPath
            });
            
            if (result.success) {
                if (result.valid) {
                    showToast(`${dlc.name} verification passed!`, 3000);
                } else {
                    const issues = [];
                    if (result.missingFiles?.length > 0) {
                        issues.push(`${result.missingFiles.length} missing files`);
                    }
                    if (result.corruptedFiles?.length > 0) {
                        issues.push(`${result.corruptedFiles.length} corrupted files`);
                    }
                    showToast(`${dlc.name} verification failed: ${issues.join(', ')}`, 5000);
                }
            } else {
                showToast(`Verification failed: ${result.error}`, 5000);
            }
        } catch (error) {
            console.error('Error verifying DLC:', error);
            showToast(`Error verifying DLC: ${error.message}`, 5000);
        }
    }
    
    // Expose DLC functions globally
    window.loadDLCs = loadDLCs;
    window.renderDLCs = renderDLCs;
    
    // This is the initial call that starts the launcher logic
    init();
}
