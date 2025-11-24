@echo off
echo ==========================================
echo   DEBUG BUILD - VERBOSE LOGGING ENABLED
echo ==========================================

REM Set verbose logging for Electron Builder
set DEBUG=electron-builder

REM Force full cleanup first
if exist "dist" rmdir /s /q "dist"

REM Run the build with verbose output
REM "call" is REQUIRED or the script will exit immediately after npm finishes
echo Starting build...
call npm run dist

echo.
echo ==========================================
echo   CRASH ANALYSIS
echo ==========================================
echo.
echo ERROR CODE: %ERRORLEVEL%
echo.
echo If it crashed with -1073741819 (0xC0000005):
echo 1. RCEDIT CRASH? (See logs above for "spawning rcedit.exe")
echo    - Cause: Your .ico file is likely corrupt or a renamed PNG.
echo    - Fix: Create a valid .ico file (256x256) using a proper tool.
echo.
echo 2. SIGNTOOL CRASH? (See logs above for "signing file...")
echo    - Cause: USB Token driver conflict or Antivirus.
echo    - Fix: Unplug token, wait 5s, replug. Disable Antivirus temporarily.
echo.
pause