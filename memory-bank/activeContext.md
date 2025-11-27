# Active Context

The project has been successfully rebranded from VRC Launcher to Role-Play-AI Launcher and is now ready for development.

## Recent Changes

### Version 1.0.7 (Latest)
- **Signing System Refactor**: Complete refactor for Electron-Builder v26+ compatibility
  - Moved signing logic to separate `sign-utils.js` module
  - Updated `scripts/sign-app.js` and `scripts/sign-installer.js` to use new utilities
  - Improved error handling and logging for signing operations
- **Content-Defined Chunking (CDC)**: Implemented FastCDC algorithm for delta updates
  - Uses Gear hash for rolling hash calculation
  - Chunk sizes: 5MB min, 10MB avg, 20MB max
  - Enables efficient delta updates by only downloading changed chunks
  - Cross-file chunk tracking for optimal deduplication
- **R2 Bucket Integration**: Configured for Cloudflare R2 production downloads
  - Base URL: `https://pub-f87e49b41fad4c0fad84e94d65ed13cc.r2.dev`
  - Chunk-based downloads from R2 bucket
  - Production build type support
- **Smart Path Detection**: Enhanced game installation path detection
  - Handles multiple installation scenarios (root, subfolder, parent directory)
  - Enforces `RolePlay_AI` folder naming convention
  - Preserves existing installation paths to avoid breaking user setups
- **Reconstruction Hang Fix**: Fixed issues with file reconstruction during delta updates
  - Improved chunk verification and assembly
  - Better error handling during reconstruction
- **Download Optimization**: Only processes files that need updating
  - Cross-file chunk tracking reduces redundant downloads
  - Improved manifest comparison logic

### Version 1.0.6
- **Fixes Included**: `version.json` download error, UI double version text, "Running..." button state
- **Signing**: Signed with Sectigo USB token
- **Auto-Update**: `latest.yml` was automatically patched
- **Game Version**: Updated target game version to `1.0.0.3` in `version.json` and `generate-manifest-with-sizes.js`
- **Manifest Generation**: Updated script to exclude `version.json` from manifests

## Auto-Updater Patterns (Learned from Uploader Project)

### Critical Configuration
- **Feed URL Configuration**: Must be set explicitly in both development and production modes
  - For portable builds, `autoUpdater.setFeedURL()` must be called outside conditional blocks
  - Uses GitHub API directly, not local YML files
  - Repository: `Nobel90/Role-Play-AI_Launcher` (note: repo name uses hyphens)
- **Development Mode**: Requires `forceDevUpdateConfig = true` to enable update checks
  - `dev-app-update.yml` should be created minimally to prevent write errors
  - GitHub feed URL should still be set explicitly
- **Production Mode**: Relies on `package.json` publish config, but explicit feed URL is recommended for reliability

### Direct GitHub Download Pattern
- For portable executables, consider bypassing `electron-updater`'s download mechanism
- Direct GitHub API queries provide more reliable download URLs
- Handles redirects and provides better progress tracking

## Current Status
- **Build System**: Functional and signing correctly with Electron-Builder v26+
- **Application**: v1.0.7 is built and ready for distribution
- **Chunking System**: Fully implemented and tested
- **R2 Integration**: Production downloads configured
- **Ready for**: Deployment and testing

## Next Steps
- Test delta update mechanism with real game files
- Verify R2 bucket download performance
- Consider implementing explicit auto-updater feed URL configuration (learned from Uploader)
- Monitor chunk cache effectiveness
- Test reconstruction with various file change scenarios
