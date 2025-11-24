# Build and Release Script for RolePlayAI Launcher
# Builds NSIS installer, signs with USB token, and creates GitHub release

param(
    [string]$CertificateThumbprint = $env:WIN_CERTIFICATE_SHA1,
    [string]$GitHubToken = $env:GH_TOKEN,
    [string]$TimestampServer = "http://timestamp.digicert.com",
    [string]$ReleaseNotes = "",
    [switch]$SkipVersionUpdate
)

$ErrorActionPreference = "Stop"

Write-Host "=== RolePlayAI Launcher Build and Release ===" -ForegroundColor Cyan
Write-Host ""

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Step 1: Check Prerequisites
Write-Host "Step 1: Checking Prerequisites..." -ForegroundColor Yellow

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "  [OK] Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Node.js not found. Please install Node.js." -ForegroundColor Red
    exit 1
}

# Check npm
try {
    $npmVersion = npm --version
    Write-Host "  [OK] npm: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] npm not found. Please install npm." -ForegroundColor Red
    exit 1
}

# Check Git
try {
    $gitVersion = git --version
    Write-Host "  [OK] Git: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Git not found. Please install Git." -ForegroundColor Red
    exit 1
}

# Check certificate thumbprint
if (-not $CertificateThumbprint) {
    Write-Host "  [ERROR] WIN_CERTIFICATE_SHA1 not set." -ForegroundColor Red
    Write-Host "  Please set it: `$env:WIN_CERTIFICATE_SHA1 = 'YOUR_THUMBPRINT'" -ForegroundColor Yellow
    Write-Host "  Or run: .\get-certificate-thumbprint.ps1" -ForegroundColor Yellow
    exit 1
}
Write-Host "  [OK] Certificate thumbprint: $($CertificateThumbprint.Substring(0, 8))..." -ForegroundColor Green

# Check GitHub token
if (-not $GitHubToken) {
    Write-Host "  [ERROR] GH_TOKEN not set." -ForegroundColor Red
    Write-Host "  Please set it: `$env:GH_TOKEN = 'YOUR_TOKEN'" -ForegroundColor Yellow
    exit 1
}
Write-Host "  [OK] GitHub token: Set" -ForegroundColor Green

# Check signtool
$signToolPath = $null
$basePaths = @(
    "C:\Program Files (x86)\Windows Kits\10\bin",
    "C:\Program Files\Windows Kits\10\bin"
)

# First, try to find in versioned directories (newer Windows SDK structure)
foreach ($basePath in $basePaths) {
    if (Test-Path $basePath) {
        $versionDirs = Get-ChildItem -Path $basePath -Directory -ErrorAction SilentlyContinue | 
            Where-Object { $_.Name -match '^\d+\.\d+\.\d+\.\d+$' } | 
            Sort-Object Name -Descending
        foreach ($versionDir in $versionDirs) {
            $x64Path = Join-Path (Join-Path $versionDir.FullName "x64") "signtool.exe"
            if (Test-Path $x64Path) {
                $signToolPath = $x64Path
                break
            }
        }
        if ($signToolPath) { break }
    }
}

# Fallback to non-versioned paths
if (-not $signToolPath) {
    $possiblePaths = @(
        "C:\Program Files (x86)\Windows Kits\10\bin\x64\signtool.exe",
        "C:\Program Files\Windows Kits\10\bin\x64\signtool.exe"
    )
    foreach ($path in $possiblePaths) {
        if (Test-Path $path) {
            $signToolPath = $path
            break
        }
    }
}

# Last resort: try PATH
if (-not $signToolPath) {
    try {
        $whereResult = where.exe signtool.exe 2>$null
        if ($whereResult) {
            $signToolPath = $whereResult.Split("`n")[0].Trim()
        }
    } catch {
        # Not found
    }
}

if (-not $signToolPath) {
    Write-Host "  [ERROR] signtool.exe not found." -ForegroundColor Red
    Write-Host "  Please install Windows SDK." -ForegroundColor Yellow
    exit 1
}
Write-Host "  [OK] signtool.exe: $signToolPath" -ForegroundColor Green

# Check USB token certificate
Write-Host ""
Write-Host "  Checking USB token certificate..." -ForegroundColor Yellow
try {
    $cert = Get-ChildItem Cert:\CurrentUser\My | Where-Object { $_.Thumbprint -eq $CertificateThumbprint }
    if ($cert) {
        Write-Host "  [OK] Certificate found: $($cert.Subject)" -ForegroundColor Green
        Write-Host "  [OK] Valid from: $($cert.NotBefore) to $($cert.NotAfter)" -ForegroundColor Green
        if ($cert.NotAfter -lt (Get-Date)) {
            Write-Host "  [WARNING] Certificate has expired!" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "  [ERROR] Certificate with thumbprint $($CertificateThumbprint.Substring(0, 8))... not found." -ForegroundColor Red
        Write-Host "  Please ensure USB token is connected and certificate is installed." -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "  [ERROR] Error checking certificate: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 2: Updating Version..." -ForegroundColor Yellow

# Read package.json
$packageJsonPath = Join-Path $scriptDir "package.json"
$packageJson = Get-Content $packageJsonPath | ConvertFrom-Json

if (-not $SkipVersionUpdate) {
    $currentVersion = $packageJson.version
    Write-Host "  Current version: $currentVersion" -ForegroundColor Gray
    
    if ($currentVersion -ne "1.0.7") {
        $packageJson.version = "1.0.7"
        $packageJson | ConvertTo-Json -Depth 10 | Set-Content $packageJsonPath
        Write-Host "  [OK] Updated version to 1.0.7" -ForegroundColor Green
    } else {
        Write-Host "  [OK] Version already 1.0.7" -ForegroundColor Green
    }
} else {
    Write-Host "  [SKIP] Skipping version update (using current: $($packageJson.version))" -ForegroundColor Yellow
}

$version = $packageJson.version
Write-Host ""

# Step 3: Set Environment Variables
Write-Host "Step 3: Setting Environment Variables..." -ForegroundColor Yellow
$env:WIN_CERTIFICATE_SHA1 = $CertificateThumbprint
$env:WIN_TIMESTAMP_SERVER = $TimestampServer
$env:GH_TOKEN = $GitHubToken
Write-Host "  [OK] Environment variables set" -ForegroundColor Green
Write-Host ""

# Step 4: Clean Previous Build
Write-Host "Step 4: Cleaning Previous Build..." -ForegroundColor Yellow
$distDir = Join-Path $scriptDir "dist"
if (Test-Path $distDir) {
    Remove-Item -Path $distDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  [OK] Cleaned dist directory" -ForegroundColor Green
} else {
    Write-Host "  [OK] No previous build to clean" -ForegroundColor Green
}
Write-Host ""

# Step 5: Build NSIS Installer
Write-Host "Step 5: Building NSIS Installer..." -ForegroundColor Yellow
Write-Host "  Running: npm run dist" -ForegroundColor Gray
try {
    npm run dist
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed with exit code $LASTEXITCODE"
    }
    Write-Host "  [OK] Build completed successfully" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Build failed: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 6: Verify Installer Created
Write-Host "Step 6: Verifying Installer..." -ForegroundColor Yellow
$installerPattern = "Role-Play-AI-Launcher-Setup-$version.exe"
$installerPath = Get-ChildItem -Path $distDir -Filter $installerPattern -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $installerPath) {
    Write-Host "  [ERROR] Installer not found: $installerPattern" -ForegroundColor Red
    Write-Host "  Available files:" -ForegroundColor Yellow
    Get-ChildItem -Path $distDir | ForEach-Object { Write-Host "    - $($_.Name)" -ForegroundColor Gray }
    exit 1
}

$installerPath = $installerPath.FullName
Write-Host "  [OK] Installer found: $(Split-Path -Leaf $installerPath)" -ForegroundColor Green
Write-Host "  Size: $([math]::Round((Get-Item $installerPath).Length / 1MB, 2)) MB" -ForegroundColor Gray
Write-Host ""

# Step 7: Verify Signature
Write-Host "Step 7: Verifying Signature..." -ForegroundColor Yellow
try {
    & "$signToolPath" verify /pa "$installerPath" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] Installer is properly signed" -ForegroundColor Green
    } else {
        Write-Host "  [WARNING] Signature verification returned exit code $LASTEXITCODE" -ForegroundColor Yellow
        Write-Host "  Installer may still be signed, but verification had issues." -ForegroundColor Yellow
    }
} catch {
    Write-Host "  [WARNING] Could not verify signature: $_" -ForegroundColor Yellow
}
Write-Host ""

# Step 8: Create Git Tag
Write-Host "Step 8: Creating Git Tag..." -ForegroundColor Yellow
$tagName = "v$version"
try {
    # Check if tag already exists
    $existingTag = git tag -l $tagName
    if ($existingTag) {
        Write-Host "  [WARNING] Tag $tagName already exists" -ForegroundColor Yellow
        $overwrite = Read-Host "  Do you want to delete and recreate it? (y/N)"
        if ($overwrite -eq "y" -or $overwrite -eq "Y") {
            git tag -d $tagName
            git push origin :refs/tags/$tagName 2>$null
            Write-Host "  [OK] Deleted existing tag" -ForegroundColor Green
        } else {
            Write-Host "  [SKIP] Using existing tag" -ForegroundColor Yellow
        }
    }
    
    if (-not (git tag -l $tagName)) {
        git tag -a $tagName -m "Release version $version"
        Write-Host "  [OK] Created tag: $tagName" -ForegroundColor Green
    }
} catch {
    Write-Host "  [WARNING] Error creating tag: $_" -ForegroundColor Yellow
    Write-Host "  You may need to create the tag manually: git tag -a $tagName -m 'Release version $version'" -ForegroundColor Yellow
}
Write-Host ""

# Step 9: Create GitHub Release
Write-Host "Step 9: Creating GitHub Release..." -ForegroundColor Yellow

# Get repository info
$remoteUrl = git remote get-url origin
if ($remoteUrl -match "github\.com[:/]([^/]+)/([^/]+?)(?:\.git)?$") {
    $repoOwner = $matches[1]
    $repoName = $matches[2] -replace '\.git$', ''
} else {
    Write-Host "  [ERROR] Could not determine repository from remote URL: $remoteUrl" -ForegroundColor Red
    exit 1
}

Write-Host "  Repository: $repoOwner/$repoName" -ForegroundColor Gray

# Prepare release notes
if (-not $ReleaseNotes) {
    $changelogPath = Join-Path $scriptDir "CHANGELOG.md"
    if (Test-Path $changelogPath) {
        # Try to extract release notes from CHANGELOG.md
        $changelogContent = Get-Content $changelogPath -Raw
        if ($changelogContent -match "(?s)## \[?$version\]?.*?(?=##|$)") {
            $ReleaseNotes = $matches[0].Trim()
            Write-Host "  [OK] Found release notes in CHANGELOG.md" -ForegroundColor Green
        }
    }
    
    if (-not $ReleaseNotes) {
        $ReleaseNotes = "Release version $version`n`nSee CHANGELOG.md for details."
    }
}

# Create release using GitHub API
$releaseBody = @{
    tag_name = $tagName
    name = "Release $version"
    body = $ReleaseNotes
    draft = $false
    prerelease = $false
} | ConvertTo-Json

$headers = @{
    "Authorization" = "token $GitHubToken"
    "Accept" = "application/vnd.github.v3+json"
}

try {
    $releaseUrl = "https://api.github.com/repos/$repoOwner/$repoName/releases"
    Write-Host "  Creating release..." -ForegroundColor Gray
    
    $releaseResponse = Invoke-RestMethod -Uri $releaseUrl -Method Post -Headers $headers -Body $releaseBody -ContentType "application/json"
    $releaseId = $releaseResponse.id
    Write-Host "  [OK] Release created: $($releaseResponse.html_url)" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 422) {
        # Release might already exist
        Write-Host "  [WARNING] Release may already exist, checking..." -ForegroundColor Yellow
        try {
            $existingRelease = Invoke-RestMethod -Uri "$releaseUrl/tags/$tagName" -Method Get -Headers $headers
            $releaseId = $existingRelease.id
            Write-Host "  [OK] Found existing release: $($existingRelease.html_url)" -ForegroundColor Green
        } catch {
            Write-Host "  [ERROR] Error checking for existing release: $_" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "  [ERROR] Error creating release: $_" -ForegroundColor Red
        exit 1
    }
}
Write-Host ""

# Step 10: Upload Installer to Release
Write-Host "Step 10: Uploading Installer to Release..." -ForegroundColor Yellow
$uploadUrl = "https://uploads.github.com/repos/$repoOwner/$repoName/releases/$releaseId/assets"
$installerFileName = Split-Path -Leaf $installerPath

$uploadHeaders = @{
    "Authorization" = "token $GitHubToken"
    "Accept" = "application/vnd.github.v3+json"
    "Content-Type" = "application/octet-stream"
}

try {
    Write-Host "  Uploading: $installerFileName" -ForegroundColor Gray
    $fileBytes = [System.IO.File]::ReadAllBytes($installerPath)
    
    $uploadParams = @{
        Uri = "$uploadUrl?name=$installerFileName"
        Method = "Post"
        Headers = $uploadHeaders
        Body = $fileBytes
        ContentType = "application/octet-stream"
    }
    
    $uploadResponse = Invoke-RestMethod @uploadParams
    Write-Host "  [OK] Installer uploaded successfully" -ForegroundColor Green
    Write-Host "  Download URL: $($uploadResponse.browser_download_url)" -ForegroundColor Gray
} catch {
    Write-Host "  [ERROR] Error uploading installer: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 11: Push Tag to GitHub
Write-Host "Step 11: Pushing Tag to GitHub..." -ForegroundColor Yellow
try {
    git push origin $tagName
    Write-Host "  [OK] Tag pushed to GitHub" -ForegroundColor Green
} catch {
    Write-Host "  [WARNING] Error pushing tag: $_" -ForegroundColor Yellow
    Write-Host "  You may need to push manually: git push origin $tagName" -ForegroundColor Yellow
}
Write-Host ""

# Summary
Write-Host "=== Build and Release Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Version: $version" -ForegroundColor Green
Write-Host "Installer: $installerPath" -ForegroundColor Green
Write-Host "Release: $($releaseResponse.html_url)" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Verify the release on GitHub" -ForegroundColor Gray
Write-Host "  2. Test the installer download" -ForegroundColor Gray
Write-Host "  3. Update release notes if needed" -ForegroundColor Gray
Write-Host ""
