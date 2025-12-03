# Active Context

The project has been enhanced with a comprehensive Build Type and DLC management system, integrated with the Admin site and Uploader for end-to-end content delivery.

## Recent Changes

### Version 1.1.0 (Latest) - Build Types & DLC System

#### Build Type Management
- **Header Dropdown Switcher**: Quick access to switch between Production and Staging builds
  - Visual badges (green for Production, yellow for Staging)
  - Dropdown with descriptions of each build type
  - Immediate UI update on switch
- **Separate Install Paths**: Each build type maintains independent installation locations
- **Per-Build Game Data**: `launcher-data.json` structure supports both build types
- **Catalog Cache Invalidation**: Automatic cache clear on build type change

#### DLC Hierarchy System
- **Two-Level Structure**:
  - Level 1 (L1): Environment DLCs - standalone environments like `DLC_Hospital`
  - Level 2 (L2): Character DLCs - require parent environment like `DLC_Hospital_Rachael`
- **Visual Hierarchy Display**:
  - Environment cards with blue left border
  - Character cards nested under parent with purple indicators
  - Level badges (L1/L2) for quick identification
  - Installed children count on parent cards
- **Rich Metadata Display**:
  - Version numbers, folder names
  - Required base game version
  - Required parent DLC version
  - Install/Uninstall/Verify buttons

#### DLC Dependency Validation
- **Install Blocking**: Character DLCs cannot be installed without parent environment
- **Uninstall Blocking**: Environments with installed children show confirmation dialog
- **Cascading Uninstall**: Option to uninstall all children before parent
- **Version Compatibility**: Validates parent DLC version meets requirements

#### Catalog Integration
- **R2 catalog.json**: Primary source for DLC discovery
  - URL: `https://pub-f87e49b41fad4c0fad84e94d65ed13cc.r2.dev/catalog.json`
  - Published by Admin site
  - Contains all DLCs for all build types
- **Fallback Chain**: catalog.json → Firebase → IPC (main process)
- **Caching**: 5-minute TTL with automatic invalidation on build type change
- **Build-Type Aware**: Fetches DLCs specific to current build type

### Data Flow Architecture
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  UPLOADER   │ ──▶ │   R2 BUCKET │ ◀── │ ADMIN SITE  │ ──▶ │  FIREBASE   │
│             │     │             │     │             │     │             │
│ DLC Upload  │     │ manifest.json│     │ R2 Sync    │     │ DLC Config  │
│ w/ metadata │     │ chunks/     │     │ Catalog Gen │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           │                   │
                           ▼                   ▼
                    ┌─────────────┐     ┌─────────────┐
                    │catalog.json │     │  Firebase   │
                    │  (R2)       │     │ (fallback)  │
                    └─────────────┘     └─────────────┘
                           │                   │
                           └───────┬───────────┘
                                   ▼
                           ┌─────────────┐
                           │  LAUNCHER   │
                           │             │
                           │ DLC Display │
                           │ Install/    │
                           │ Uninstall   │
                           └─────────────┘
```

### R2 Bucket Structure
```
vrcentre-roleplay-ai-bucket/
├── catalog.json                     # Master catalog (managed by Admin)
│
├── production/
│   ├── roleplayai_manifest.json     # Latest base game manifest
│   ├── {version}/                   # e.g., 1.0.1.6
│   │   ├── manifest.json
│   │   └── chunks/...
│   ├── DLC_Hospital/
│   │   ├── manifest.json            # Latest DLC manifest
│   │   └── {version}/
│   │       ├── manifest.json
│   │       └── chunks/...
│   └── DLC_Hospital_Rachael/
│       ├── manifest.json
│       └── {version}/...
│
└── staging/
    └── (same structure)
```

## Current Status
- **Build System**: Functional with signing
- **Application**: v1.1.0 with full build type and DLC support
- **Integration**: Connected to Admin site and Uploader workflows
- **Ready for**: End-to-end testing with real DLC content

## Next Steps
1. Test end-to-end DLC workflow with real content
2. Verify catalog.json generation from Admin site
3. Test build type switching with installed content
4. Validate DLC dependency enforcement
5. Performance testing with multiple DLCs
