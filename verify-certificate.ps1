# Certificate Verification Script
# Verifies USB token certificate is available and can be used for signing

param(
    [string]$CertificateThumbprint = $env:WIN_CERTIFICATE_SHA1
)

Write-Host "=== Certificate Verification ===" -ForegroundColor Cyan
Write-Host ""

if (-not $CertificateThumbprint) {
    Write-Host "Certificate thumbprint not provided." -ForegroundColor Yellow
    Write-Host "Please provide it as parameter or set WIN_CERTIFICATE_SHA1 environment variable." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Usage: .\verify-certificate.ps1 -CertificateThumbprint 'YOUR_THUMBPRINT'" -ForegroundColor Gray
    Write-Host "Or: `$env:WIN_CERTIFICATE_SHA1 = 'YOUR_THUMBPRINT'; .\verify-certificate.ps1" -ForegroundColor Gray
    exit 1
}

Write-Host "Checking certificate: $($CertificateThumbprint.Substring(0, 8))..." -ForegroundColor Yellow
Write-Host ""

# Check certificate in store
try {
    $cert = Get-ChildItem Cert:\CurrentUser\My | Where-Object { $_.Thumbprint -eq $CertificateThumbprint }
    
    if (-not $cert) {
        Write-Host "✗ Certificate not found in Personal store" -ForegroundColor Red
        Write-Host ""
        Write-Host "Available certificates:" -ForegroundColor Yellow
        Get-ChildItem Cert:\CurrentUser\My | ForEach-Object {
            Write-Host "  Thumbprint: $($_.Thumbprint)" -ForegroundColor Gray
            Write-Host "  Subject: $($_.Subject)" -ForegroundColor Gray
            Write-Host ""
        }
        exit 1
    }
    
    Write-Host "✓ Certificate found" -ForegroundColor Green
    Write-Host "  Subject: $($cert.Subject)" -ForegroundColor Gray
    Write-Host "  Issuer: $($cert.Issuer)" -ForegroundColor Gray
    Write-Host "  Valid from: $($cert.NotBefore)" -ForegroundColor Gray
    Write-Host "  Valid to: $($cert.NotAfter)" -ForegroundColor Gray
    Write-Host ""
    
    # Check expiration
    $now = Get-Date
    if ($cert.NotAfter -lt $now) {
        Write-Host "✗ Certificate has EXPIRED!" -ForegroundColor Red
        Write-Host "  Expired on: $($cert.NotAfter)" -ForegroundColor Red
        exit 1
    } elseif ($cert.NotAfter -lt $now.AddDays(30)) {
        Write-Host "⚠ Certificate expires soon: $($cert.NotAfter)" -ForegroundColor Yellow
    } else {
        Write-Host "✓ Certificate is valid" -ForegroundColor Green
    }
    Write-Host ""
    
    # Check if certificate has private key
    if ($cert.HasPrivateKey) {
        Write-Host "✓ Certificate has private key" -ForegroundColor Green
    } else {
        Write-Host "✗ Certificate does not have private key" -ForegroundColor Red
        Write-Host "  This may indicate the USB token is not connected or certificate is not properly installed." -ForegroundColor Yellow
        exit 1
    }
    Write-Host ""
    
} catch {
    Write-Host "✗ Error checking certificate: $_" -ForegroundColor Red
    exit 1
}

# Check signtool
Write-Host "Checking signtool.exe..." -ForegroundColor Yellow
$signToolPath = $null
$possiblePaths = @(
    "C:\Program Files (x86)\Windows Kits\10\bin\x64\signtool.exe",
    "C:\Program Files\Windows Kits\10\bin\x64\signtool.exe",
    "signtool.exe"
)

foreach ($path in $possiblePaths) {
    if ($path -eq "signtool.exe") {
        try {
            $whereResult = where.exe signtool.exe 2>$null
            if ($whereResult) {
                $signToolPath = $whereResult.Split("`n")[0].Trim()
                break
            }
        } catch {
            continue
        }
    } elseif (Test-Path $path) {
        $signToolPath = $path
        break
    }
}

if (-not $signToolPath) {
    Write-Host "✗ signtool.exe not found" -ForegroundColor Red
    Write-Host "  Please install Windows SDK" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ signtool.exe found: $signToolPath" -ForegroundColor Green
Write-Host ""

# Test signing (create a dummy file and try to sign it)
Write-Host "Testing signing capability..." -ForegroundColor Yellow
$testFile = Join-Path $env:TEMP "test-sign-$(Get-Random).exe"
try {
    # Create a dummy executable file
    [System.IO.File]::WriteAllBytes($testFile, @(0x4D, 0x5A)) # MZ header
    
    $testCommand = "& `"$signToolPath`" sign /sha1 `"$CertificateThumbprint`" /fd sha256 /tr http://timestamp.digicert.com /td sha256 `"$testFile`""
    
    try {
        Invoke-Expression $testCommand 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Test signing successful" -ForegroundColor Green
            
            # Verify signature
            $verifyCommand = "& `"$signToolPath`" verify /pa `"$testFile`""
            Invoke-Expression $verifyCommand 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✓ Signature verification successful" -ForegroundColor Green
            } else {
                Write-Host "⚠ Signature created but verification failed" -ForegroundColor Yellow
            }
        } else {
            Write-Host "✗ Test signing failed (exit code: $LASTEXITCODE)" -ForegroundColor Red
            Write-Host "  This may indicate:" -ForegroundColor Yellow
            Write-Host "  - USB token is not connected" -ForegroundColor Yellow
            Write-Host "  - Certificate requires PIN/password" -ForegroundColor Yellow
            Write-Host "  - Certificate permissions issue" -ForegroundColor Yellow
            exit 1
        }
    } catch {
        Write-Host "✗ Test signing error: $_" -ForegroundColor Red
        exit 1
    } finally {
        # Clean up test file
        if (Test-Path $testFile) {
            Remove-Item $testFile -Force -ErrorAction SilentlyContinue
        }
    }
} catch {
    Write-Host "✗ Error creating test file: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Certificate Verification Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "✓ Certificate is ready for signing" -ForegroundColor Green
Write-Host ""

