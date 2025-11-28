# Battle.net-Style Launcher Redesign Plan

## Overview
Redesign the RolePlayAI Launcher to match Battle.net's two-level header structure with navigation tabs, app library, and improved visual hierarchy.

## Current Structure Analysis
- Single header with dynamic links and user info
- Left sidebar with collapsible game list
- Main content area with game-specific view (background, title, action buttons)
- Game library stored in `gameLibrary` object in `renderer.js`

## Implementation Steps

### 1. Header Level 1 - Top Navigation Bar
**File: `index.html`**

Create a new top-level header with:
- **Left Section:**
  - VR Centre logo (`assets/icon-white_s.png`) with dropdown menu
  - Dropdown menu items:
    - Settings (placeholder, icon)
    - Account (placeholder, icon with external link)
    - Support (placeholder, icon with external link)
    - Separator
    - Logout (functional, icon)
    - Exit (functional, icon)
    - Separator
    - Social links section (placeholder for future links)
  
- **Center Section:**
  - Navigation tabs: "HOME", "APPS", "SHOP"
  - Active tab highlighting
  - Hover effects

- **Right Section:**
  - User profile (avatar, name, online status) when logged in
  - Login button when logged out
  - Notification bell (optional, placeholder)

**Styling:**
- Dark background (`bg-gray-900/95`)
- Height: ~60px
- Fixed position at top
- Z-index above main content

### 2. Header Level 2 - App Favorites Bar
**File: `index.html`**

Create a second header level below Level 1:
- **Left Section:**
  - "FAVORITES" label
  - Horizontal scrollable app icons
  - Role Play AI app icon (from `gameLibrary`)
  - "+" button to add more apps (placeholder)
  - "+N" indicator if more apps exist

- **Styling:**
  - Height: ~80px
  - Horizontal scroll if needed
  - App icons: 64x64px with hover effects
  - Selected app highlighted with border/glow

### 3. View Management System
**File: `renderer.js`**

Add view state management:
- `currentView` variable: 'home', 'apps', 'shop', or 'app-detail'
- `currentSelectedApp` variable: gameId when in app-detail view
- Functions:
  - `switchView(viewName)` - Switch between Home, Apps, Shop
  - `selectApp(gameId)` - Show app detail view
  - `renderHomeView()` - Render home dashboard
  - `renderAppsView()` - Render apps grid
  - `renderShopView()` - Render shop placeholder
  - `renderAppDetailView(gameId)` - Render existing game detail view

### 4. Home Dashboard View
**File: `index.html` and `renderer.js`**

Create home view container:
- Featured content section
- Recent activity/news
- Quick access to favorite apps
- Welcome message/user greeting
- Battle.net-style card layout

**Implementation:**
- New `<div id="home-view">` container
- Hide/show based on `currentView`
- Populate with dynamic content from Firestore (future enhancement)

### 5. Apps Grid View
**File: `index.html` and `renderer.js`**

Create apps library view:
- Grid layout showing all apps from `gameLibrary`
- Each app card shows:
  - App icon/logo
  - App name
  - Status badge (Installed, Update Available, Not Installed)
  - Hover effect with app preview
- Clicking app card switches to app detail view
- Battle.net-style card design with shadows and hover effects

**Implementation:**
- New `<div id="apps-view">` container
- Function `renderAppsGrid()` that iterates `gameLibrary`
- Cards styled similar to Battle.net game library

### 6. Shop View Placeholder
**File: `index.html` and `renderer.js`**

Create shop view:
- Placeholder message: "Shop coming soon"
- Future: Store, purchases, featured items

**Implementation:**
- New `<div id="shop-view">` container
- Simple placeholder content

### 7. App Detail View (Existing)
**File: `index.html` and `renderer.js`**

Keep existing game detail view:
- Current main content area becomes app detail view
- Show when `currentView === 'app-detail'`
- All existing functionality preserved (background, buttons, progress, etc.)

**Modification:**
- Wrap existing main content in `<div id="app-detail-view">`
- Show/hide based on view state

### 8. Logo Dropdown Menu
**File: `index.html` and `renderer.js`**

Implement dropdown:
- Click logo to toggle dropdown
- Dropdown menu with sections:
  - Settings (gear icon) - placeholder
  - Account (person icon + external link) - placeholder
  - Support (question mark icon + external link) - placeholder
  - Separator
  - Logout (arrow icon) - connect to existing logout
  - Exit (X icon) - connect to window close
  - Separator
  - Social links section (empty for now, ready for future links)
- Click outside to close
- Proper z-index to appear above content

### 9. Navigation Tab Functionality
**File: `renderer.js`**

Add click handlers:
- HOME tab → `switchView('home')`
- APPS tab → `switchView('apps')`
- SHOP tab → `switchView('shop')`
- Update active tab styling on switch

### 10. App Favorites Bar Functionality
**File: `renderer.js`**

- Render app icons from `gameLibrary`
- Click app icon → `selectApp(gameId)` → switch to app detail view
- Highlight selected app
- Show update indicators on app icons if available

### 11. CSS Styling Updates
**File: `index.html` (style section)**

Add Battle.net-inspired styles:
- Dark theme colors matching Battle.net
- Smooth transitions
- Hover effects on interactive elements
- Proper spacing and typography
- Card shadows and borders
- Active state indicators

### 12. Integration with Existing Features
**File: `renderer.js`**

Ensure compatibility:
- News bar still works (show in all views or only app detail?)
- Dynamic settings from Firestore still apply
- Sidebar toggle still functional
- All existing game management functions work
- Login/logout flow preserved

## File Changes Summary

### `index.html`
- Restructure header into Level 1 and Level 2
- Add logo dropdown menu HTML
- Add navigation tabs (HOME, APPS, SHOP)
- Add view containers (home-view, apps-view, shop-view, app-detail-view)
- Update CSS for Battle.net styling
- Keep existing sidebar structure

### `renderer.js`
- Add view state management
- Add `switchView()`, `selectApp()`, `renderHomeView()`, `renderAppsView()`, `renderShopView()` functions
- Modify existing `renderGame()` to work with view system
- Add dropdown menu toggle logic
- Add navigation tab click handlers
- Add app favorites bar rendering logic
- Ensure all existing functionality preserved

## Testing Checklist
- [ ] Logo dropdown opens/closes correctly
- [ ] Navigation tabs switch views correctly
- [ ] Home view displays properly
- [ ] Apps grid shows all apps from gameLibrary
- [ ] Clicking app in grid shows app detail view
- [ ] App favorites bar shows apps and highlights selected
- [ ] Sidebar still works with new layout
- [ ] Existing game management functions work
- [ ] Login/logout flow works
- [ ] Dynamic settings from Firestore apply correctly
- [ ] News bar displays (decide which views to show it in)

## Future Enhancements (Not in Scope)
- Social links in dropdown
- Settings page implementation
- Account page implementation
- Shop functionality
- Multiple apps support (currently only Role Play AI)
- App installation from Apps view

