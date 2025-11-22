# Quick Fix - Server Not Running

## The Problem
The test server is **NOT running**. That's why downloads aren't happening.

## The Solution

### Step 1: Start the Test Server

**Option A: Using the batch file (Easiest)**
- Double-click `START-TEST-SERVER.bat`
- Keep the window open!

**Option B: Using npm**
```bash
npm run test-server
```
- Keep the terminal open!

You should see:
```
==================================================
Test Server Started
==================================================
Server: http://localhost:8080
Serving from: D:\VR Centre\Perforce\RolePlay_AI\Package\noChubks\Windows
==================================================
```

### Step 2: Verify Server is Running

In a **new terminal**, run:
```bash
npm run test-server-status
```

Should show: `✅ Test server is RUNNING!`

Or test in browser: `http://localhost:8080/version.json`

### Step 3: Start the Launcher

In a **different terminal** (keep server running!):
```bash
npm start
```

### Step 4: Test Download

1. Click "INSTALL" in launcher
2. Select installation directory
3. Download should start

## Important Notes

- **Keep the server terminal open!** Closing it stops the server
- The server must be running **before** you start the launcher
- Check launcher console (F12) if downloads still don't work

## Still Not Working?

1. Check `renderer.js` lines 166-167 - should have test URLs uncommented
2. Open launcher DevTools (F12) and check Console for errors
3. See `TROUBLESHOOTING.md` for more help

