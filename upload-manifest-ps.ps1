# PowerShell script to upload manifest with sizes
Write-Host "Uploading manifest with sizes to server..." -ForegroundColor Green

# FTP Configuration
$ftpServer = "ftp.vrcentre.com.au"
$ftpUser = "mostafa@vrcentre.com.au"
$ftpPass = "rg@422t#44lm"
$ftpPort = 21

# Local files
$localManifest = "D:\VR Centre\Perforce\RolePlay_AI\Package\Chunks\v2\Windows\roleplayai_manifest_with_sizes.json"
$localVersion = "D:\VR Centre\Perforce\RolePlay_AI\Package\Chunks\v2\Windows\version.json"

# Remote paths
$remoteManifest = "/RolePlay_Ai/RolePlay_AI_Package/roleplayai_manifest.json"
$remoteVersion = "/RolePlay_Ai/RolePlay_AI_Package/1.0.0.2/version.json"

try {
    Write-Host "Uploading manifest file..." -ForegroundColor Yellow
    
    # Create FTP request for manifest
    $ftpRequest = [System.Net.FtpWebRequest]::Create("ftp://$ftpServer$remoteManifest")
    $ftpRequest.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPass)
    $ftpRequest.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
    $ftpRequest.UseBinary = $true
    
    # Upload manifest
    $fileContent = [System.IO.File]::ReadAllBytes($localManifest)
    $ftpRequest.ContentLength = $fileContent.Length
    $requestStream = $ftpRequest.GetRequestStream()
    $requestStream.Write($fileContent, 0, $fileContent.Length)
    $requestStream.Close()
    
    $response = $ftpRequest.GetResponse()
    Write-Host "✅ Manifest uploaded successfully!" -ForegroundColor Green
    
    Write-Host "Uploading version file..." -ForegroundColor Yellow
    
    # Create FTP request for version
    $ftpRequest2 = [System.Net.FtpWebRequest]::Create("ftp://$ftpServer$remoteVersion")
    $ftpRequest2.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPass)
    $ftpRequest2.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
    $ftpRequest2.UseBinary = $true
    
    # Upload version
    $fileContent2 = [System.IO.File]::ReadAllBytes($localVersion)
    $ftpRequest2.ContentLength = $fileContent2.Length
    $requestStream2 = $ftpRequest2.GetRequestStream()
    $requestStream2.Write($fileContent2, 0, $fileContent2.Length)
    $requestStream2.Close()
    
    $response2 = $ftpRequest2.GetResponse()
    Write-Host "✅ Version uploaded successfully!" -ForegroundColor Green
    
    Write-Host "`n🎉 Upload completed successfully!" -ForegroundColor Green
    Write-Host "📁 Manifest: https://vrcentre.com.au/RolePlay_Ai/RolePlay_AI_Package/roleplayai_manifest.json" -ForegroundColor Cyan
    Write-Host "📁 Version: https://vrcentre.com.au/RolePlay_Ai/RolePlay_AI_Package/1.0.0.2/version.json" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ Upload failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Please try uploading manually via FTP client" -ForegroundColor Yellow
}

Write-Host "`nPress any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
