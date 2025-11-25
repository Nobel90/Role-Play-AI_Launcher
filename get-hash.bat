@echo off
if "%~1"=="" (
    echo Usage: get-hash.bat ^<file-path^>
    echo Example: get-hash.bat dist\Role-Play-AI-Launcher-Setup-1.0.8.exe
    echo.
    pause
    exit /b 1
)

node get-file-hash.js "%~1"
pause

