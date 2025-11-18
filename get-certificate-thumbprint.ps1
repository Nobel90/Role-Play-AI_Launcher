# PowerShell script to find and display certificate thumbprints
# This helps you find the SHA1 thumbprint for your USB token certificate

Write-Host "=== Finding Certificates in Personal Store ===" -ForegroundColor Cyan
Write-Host ""

# Get all certificates from Personal store
$certificates = Get-ChildItem Cert:\CurrentUser\My

if ($certificates.Count -eq 0) {
    Write-Host "No certificates found in Personal store." -ForegroundColor Yellow
    Write-Host "Make sure your USB token is connected and the certificate is installed." -ForegroundColor Yellow
    exit
}

Write-Host "Found $($certificates.Count) certificate(s):" -ForegroundColor Green
Write-Host ""

# Display certificates with thumbprint, subject, and issuer
$certificates | ForEach-Object {
    Write-Host "Thumbprint: $($_.Thumbprint)" -ForegroundColor White
    Write-Host "  Subject: $($_.Subject)" -ForegroundColor Gray
    Write-Host "  Issuer: $($_.Issuer)" -ForegroundColor Gray
    Write-Host "  Friendly Name: $($_.FriendlyName)" -ForegroundColor Gray
    Write-Host "  Valid From: $($_.NotBefore)" -ForegroundColor Gray
    Write-Host "  Valid To: $($_.NotAfter)" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "=== To set the environment variable, use: ===" -ForegroundColor Cyan
Write-Host '$env:WIN_CERTIFICATE_SHA1 = "THUMBPRINT_HERE"' -ForegroundColor Yellow
Write-Host ""
Write-Host "Example:" -ForegroundColor Cyan
Write-Host '$env:WIN_CERTIFICATE_SHA1 = "A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0"' -ForegroundColor Yellow
Write-Host ""

