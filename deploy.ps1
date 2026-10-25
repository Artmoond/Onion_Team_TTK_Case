$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "Deploying TTK Production Services..." -ForegroundColor Cyan

# 1. Check .env
if (-not (Test-Path ".env")) {
    Write-Host "Creating .env from .env.example..." -ForegroundColor Gray
    Copy-Item ".env.example" ".env"
    $randBytes = New-Object byte[] 32
    (New-Object System.Security.Cryptography.RNGCryptoServiceProvider).GetBytes($randBytes)
    $randSecret = ($randBytes | ForEach-Object { "{0:x2}" -f $_ }) -join ""
    (Get-Content ".env") -replace "TTK_JWT_SECRET=.*", "TTK_JWT_SECRET=$randSecret" | Set-Content ".env"
    Write-Host "File .env created." -ForegroundColor Green
}

# 2. Data dirs
New-Item -ItemType Directory -Force -Path "data/uploads/panoramas", "data/uploads/venues", "shared" | Out-Null

# 3. Native Docker vs WSL
$hasNativeDocker = $false
try {
    $null = docker --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        $null = docker info 2>$null
        if ($LASTEXITCODE -eq 0) { $hasNativeDocker = $true }
    }
} catch {}

$winPath = (Get-Location).Path
$drive = $winPath.Substring(0, 1).ToLower()
$rest = $winPath.Substring(2).Replace('\', '/')
$wslPath = "/mnt/$drive$rest"

$distroArg = @()
if (-not $hasNativeDocker) {
    $wslDistros = (wsl -l -q 2>$null) | Out-String
    if ($wslDistros -match "Ubuntu") {
        $ubuntuName = (($wslDistros -split "`r?`n") | Where-Object { $_ -match "Ubuntu" } | Select-Object -First 1).Trim()
        if ($ubuntuName) {
            $distroArg = @("-d", $ubuntuName)
        }
    }
}

if ($hasNativeDocker) {
    Write-Host "-> Launching via Docker Engine..." -ForegroundColor Gray
    docker compose -f docker-compose.prod.yml down --remove-orphans 2>$null
    docker compose -f docker-compose.prod.yml up -d --remove-orphans
} else {
    Write-Host "-> Launching via WSL..." -ForegroundColor Yellow
    wsl @distroArg bash -c "cd '$wslPath' && docker compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null; docker compose -f docker-compose.prod.yml up -d --remove-orphans"
}

# 4. Check readiness
Write-Host "Waiting for services..." -ForegroundColor Gray
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $resp = Invoke-RestMethod -Uri "http://localhost/api/health" -TimeoutSec 2
        if ($resp.status -eq "ok") { $ready = $true; break }
    } catch {
        try {
            $resp2 = Invoke-RestMethod -Uri "http://localhost:8000/api/health" -TimeoutSec 2
            if ($resp2.status -eq "ok") { $ready = $true; break }
        } catch {}
    }
    Start-Sleep -Seconds 2
}

Write-Host ""
if ($ready) {
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "PRODUCTION DEPLOY COMPLETED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "Gateway URL:              http://localhost" -ForegroundColor Cyan
    Write-Host "  Client (Visitor):       http://localhost/" -ForegroundColor Gray
    Write-Host "  Studio (Admin CAD):     http://localhost/admin/" -ForegroundColor Gray
    Write-Host "  Backend API:            http://localhost/api/" -ForegroundColor Gray
    Write-Host "  Swagger Docs:           http://localhost/docs" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Direct Ports:" -ForegroundColor Cyan
    Write-Host "  Client:                 http://localhost:3000" -ForegroundColor Gray
    Write-Host "  Studio:                 http://localhost:3001" -ForegroundColor Gray
    Write-Host "  Backend:                http://localhost:8000" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Demo Credentials:" -ForegroundColor Cyan
    Write-Host "  User:  user@ttk.example.com  / User12345!" -ForegroundColor Gray
    Write-Host "  Admin: admin@ttk.example.com / Admin12345! (Code: TTK-ADMIN-2026)" -ForegroundColor Gray
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "Services are running in background." -ForegroundColor Green
} else {
    Write-Host "Services are starting up. Please check logs with: wsl docker compose -f docker-compose.prod.yml logs" -ForegroundColor Yellow
}
