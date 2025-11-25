# Release Notes - Version 1.0.7

## 🎉 Major Update: Signing System Refactoring

This release includes a complete refactoring of the code signing system to ensure compatibility with Electron-Builder v26+ and improve build reliability.

---

## ✨ New Features

### Build System Improvements
- **New Build Wrapper**: Added `build.bat` for better error visibility and debugging
- **Enhanced PowerShell Script**: Updated `build-signed.ps1` with improved cache clearing and error handling
- **Automated Cache Management**: Script now automatically clears Electron Builder cache and dist folder before building

### Signing System Refactoring
- **Modular Signing Utilities**: Created `sign-utils.js` as a reusable utility module for signing functions
- **Hook-Based Signing**: Migrated from deprecated `win.sign` to proper Electron-Builder hooks:
  - `afterSign` hook for signing the main application executable
  - `afterAllArtifactBuild` hook for signing installer artifacts
- **Improved Error Handling**: All signing functions now throw errors on failure, ensuring builds fail fast if signing issues occur

---

## 🔧 Technical Changes

### File Structure
- **New Files**:
  - `build.bat` - Batch wrapper for build process
  - `build-signed.ps1` - Enhanced PowerShell build script
  - `sign-utils.js` - Utility module for signing functions
  - `scripts/sign-app.js` - Hook script for signing application executable
  - `scripts/sign-installer.js` - Hook script for signing installer artifacts

### Configuration Updates
- **package.json**:
  - Removed deprecated `win.sign` property
  - Added `afterSign` and `afterAllArtifactBuild` hooks
  - Maintained `signAndEditExecutable: true` to preserve icon during signing

### Signing Process
1. Electron-Builder embeds icon first (`signAndEditExecutable: true`)
2. `afterSign` hook signs the main app executable (`Role-Play-AI-Launcher.exe`)
3. `afterAllArtifactBuild` hook signs installer and uninstaller executables
4. Build fails immediately if certificate is missing or signing fails

---

## 🐛 Bug Fixes

- **Fixed**: Build crashes due to deprecated `win.sign` property in Electron-Builder v26+
- **Fixed**: Signing conflicts with icon generation
- **Fixed**: Build window closing too fast to see errors
- **Fixed**: Cache not being properly cleared between builds

---

## 📋 Build Instructions

### Prerequisites
- Windows 10/11
- Node.js and npm installed
- Windows SDK (for signtool.exe)
- Sectigo USB Token connected
- SafeNet Client running and ready

### Building the Application

1. **Double-click `build.bat`** or run from command line:
   ```batch
   build.bat
   ```

2. **If prompted**, enter your Sectigo Certificate Thumbprint (SHA1)

3. **Wait for build to complete** - The window will stay open to show results

### Manual Build (PowerShell)
```powershell
.\build-signed.ps1
```

---

## 🔐 Signing Requirements

- **Environment Variable**: `WIN_CERTIFICATE_SHA1` must be set (or entered when prompted)
- **USB Token**: Sectigo USB Token must be plugged in
- **SafeNet Client**: Must be running and showing "Ready" status

---

## 📝 Notes

- The old `sign.js` file is still present but no longer used by the build system
- All signing now uses the hook-based approach for better compatibility
- Icon preservation is handled automatically by Electron-Builder before signing

---

## 🚀 What's Next

- Continue monitoring build reliability
- Potential future improvements to signing workflow
- Enhanced error messages and diagnostics

---

## 📦 Files Changed

### New Files
- `build.bat`
- `build-signed.ps1`
- `sign-utils.js`
- `scripts/sign-app.js`
- `scripts/sign-installer.js`

### Modified Files
- `package.json` - Updated build configuration
- `sign.js` - (No longer used, but kept for reference)

---

**Version**: 1.0.7  
**Release Date**: November 25, 2025  
**Compatibility**: Electron-Builder v26+

