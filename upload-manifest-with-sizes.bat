@echo off
echo Uploading manifest with sizes to server...

REM FTP Configuration
set FTP_SERVER=ftp.vrcentre.com.au
set FTP_USER=mostafa@vrcentre.com.au
set FTP_PASS=rg@422t#44lm
set FTP_PORT=21

REM Local files
set LOCAL_MANIFEST=D:\VR Centre\Perforce\RolePlay_AI\Package\Chunks\v2\Windows\roleplayai_manifest_with_sizes.json
set LOCAL_VERSION=D:\VR Centre\Perforce\RolePlay_AI\Package\Chunks\v2\Windows\version.json

REM Remote paths
set REMOTE_MANIFEST=/RolePlay_Ai/RolePlay_AI_Package/roleplayai_manifest.json
set REMOTE_VERSION=/RolePlay_Ai/RolePlay_AI_Package/1.0.0.2/version.json

echo.
echo Uploading manifest file...
echo open %FTP_SERVER% %FTP_PORT% > ftp_commands.txt
echo user %FTP_USER% %FTP_PASS% >> ftp_commands.txt
echo binary >> ftp_commands.txt
echo put "%LOCAL_MANIFEST%" "%REMOTE_MANIFEST%" >> ftp_commands.txt
echo put "%LOCAL_VERSION%" "%REMOTE_VERSION%" >> ftp_commands.txt
echo quit >> ftp_commands.txt

ftp -s:ftp_commands.txt

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Upload successful!
    echo 📁 Manifest uploaded to: https://vrcentre.com.au/RolePlay_Ai/RolePlay_AI_Package/roleplayai_manifest.json
    echo 📁 Version uploaded to: https://vrcentre.com.au/RolePlay_Ai/RolePlay_AI_Package/1.0.0.2/version.json
) else (
    echo.
    echo ❌ Upload failed! Error code: %ERRORLEVEL%
)

del ftp_commands.txt
pause
