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
    gameLibrary = {
        'RolePlayAI': {
            name: 'Role Play AI',
            tagline: 'SYNTHETIC SCENES™ – Avatar-Led Role Play Platform',
            version: '1.0.0',
            status: 'uninstalled',
            logoUrl: 'assets/icon-white_s.png',
            backgroundUrl: 'assets/BG.png',
            installPath: null,
            executable: 'RolePlay_AI.exe',
            // R2 Configuration for Production
            manifestUrl: R2_CONFIG.manifestUrl,
            // OLD PRODUCTION URLs (commented out - using R2 now)
            //manifestUrl: 'https://vrcentre.com.au/RolePlay_Ai/RolePlay_AI_Package/roleplayai_manifest.json',
            //versionUrl: 'https://vrcentre.com.au/RolePlay_Ai/RolePlay_AI_Package/1.0.0.2/version.json',
            // TEST SERVER URLs (uncomment to use local test server)
            //manifestUrl: 'http://localhost:8080/roleplayai_manifest.json',
            //versionUrl: 'http://localhost:8080/version.json',
            filesToUpdate: [],
            isPaused: false,
        },
    };

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
            const game = gameLibrary[currentGameId];
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
        const game = gameLibrary[gameId];
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
        }
        if (settingsButtonEl) {
        settingsButtonEl.addEventListener('click', openSettingsModal);
        }
        if (closeSettingsButtonEl) {
        closeSettingsButtonEl.addEventListener('click', closeSettingsModal);
        }
        
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
            const game = gameLibrary[currentGameId];
            if (game.installPath) {
                window.electronAPI.uninstallGame(game.installPath);
            }
        });
        }

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
                gameLibrary[gameId].manifestUrl = R2_CONFIG.manifestUrl;
                gameLibrary[gameId].versionUrl = 'https://vrcentre.com.au/RolePlay_Ai/RolePlay_AI_Package/1.0.0.2/version.json';
                gameLibrary[gameId].executable = 'RolePlay_AI.exe';
            }
            await window.electronAPI.saveGameData(gameLibrary);
            renderGame(currentGameId);
            console.log('All game data cleared and URLs reset');
        };

        if (checkUpdateButtonEl) {
        checkUpdateButtonEl.addEventListener('click', () => checkForUpdates(currentGameId));
        }

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
        
        // Start slideshow after UI is initialized
        startBackgroundSlideshow();
        
        // Trigger UI update after initialization to apply any loaded settings
        if (typeof triggerUIUpdate === 'function') {
            triggerUIUpdate();
        }
    }
    
    // This is the initial call that starts the launcher logic
    init();
}
