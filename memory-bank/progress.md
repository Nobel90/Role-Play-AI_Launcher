# Progress

## What Works
- The basic launcher structure is in place.
- It can check for updates against a remote manifest.
- It can download files and verify them with checksums.
- It can launch the application.
- It supports pausing, resuming, and canceling downloads.
- It can move the installation directory.
- It can uninstall the game.
- The launcher itself is auto-updatable.
- **Code Signing**: Full support for USB token signing.
- **Build System**: Automated build, sign, and manifest patching.
- **UI**: "Running..." button state and correct version display.

## What's Left to Build
- Further UI improvements.
- More robust error handling and user feedback.

## Current Status
Version 1.0.6 is successfully built and signed. It addresses critical update bugs and improves UI feedback.

## Known Issues
- **Game Update**: A large number of files (394) might be flagged for update if the server manifest sizes don't exactly match the user's local files. This is expected behavior for size-based verification but relies on accurate manifest generation.
