# Product Context

## Problem
The core problem is to provide a user-friendly way for users to install, update, and launch the VRC Role-Play-AI application. Manually managing application files is cumbersome and error-prone for users. Additionally, users need access to DLC content (environments and characters) with proper dependency management, and the ability to switch between Production and Staging builds.

## Solution
This project is an Electron-based launcher that automates the process:
- **One-Click Install/Update**: Simplifies getting the latest version of the application.
- **Game Launcher**: Provides a simple interface to launch the game.
- **Self-Updating**: The launcher itself can be updated automatically.
- **Build Type Switching**: Users can switch between Production (stable) and Staging (beta) builds.
- **DLC Management**: Browse, install, and manage DLC content with hierarchical dependencies.
- **Delta Updates**: Efficient updates using Content-Defined Chunking to minimize bandwidth.
- **Catalog Discovery**: Automatic DLC discovery from catalog.json with Firebase fallback.

## User Experience Goals
- The user should be able to easily select an installation directory.
- The download and update process should be clear, with visible progress and status.
- The user should be able to launch the game with a single click once it's installed/updated.
- The interface should be simple and intuitive.
- Users can easily switch between Production and Staging builds.
- DLC content is discoverable and manageable with clear dependency information.
- Updates are efficient and minimize bandwidth usage.
- DLC installation respects parent-child relationships and version requirements.


