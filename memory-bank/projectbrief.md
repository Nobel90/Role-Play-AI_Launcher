# Project Brief

## Overview
This project is a launcher and updater for VRC's Role-Play-AI App. It provides a user-friendly interface for installing, updating, and launching the Role-Play-AI game application.

## Core Requirements

### Primary Goals
1. **Game Installation & Updates**: Automate the process of installing and updating the Role-Play-AI game
2. **Delta Updates**: Efficient updates using Content-Defined Chunking (CDC) to minimize bandwidth usage
3. **Self-Updating Launcher**: The launcher itself can be updated automatically via GitHub releases
4. **User Experience**: Simple, intuitive interface for managing game installation and launching

### Key Features
- One-click install/update process
- Delta updates (only changed chunks downloaded)
- Chunk-based deduplication across files
- Smart installation path detection
- File integrity verification (SHA256 checksums)
- Pause/resume/cancel download support
- Game launcher functionality
- Auto-updating launcher

### Technical Requirements
- Electron-based desktop application
- Windows platform support (x64)
- Code signing with USB token (Sectigo)
- GitHub releases for launcher updates
- Cloudflare R2 bucket for game file distribution
- Content-Defined Chunking (FastCDC) for efficient updates
- NSIS installer for distribution

## Project Scope
- Launcher application development and maintenance
- Update mechanism implementation
- Chunking system for delta updates
- Build and signing automation
- Manifest generation and management
- Integration with R2 bucket for production downloads

## Success Criteria
- Users can easily install and update the game
- Updates are efficient (minimal bandwidth usage)
- Launcher updates automatically
- Code signing works reliably
- Build process is automated and repeatable
