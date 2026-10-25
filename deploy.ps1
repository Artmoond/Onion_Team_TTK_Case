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
    docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
} else {
    Write-Host "-> Launching via WSL..." -ForegroundColor Yellow
    wsl @distroArg bash -c "cd '$wslPath' && docker compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null; docker compose -f docker-compose.prod.yml up -d --build --remove-orphans"
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
        } catch {
            if (-not $hasNativeDocker) {
                $wslHealth = (wsl @distroArg curl -s http://127.0.0.1/api/health 2>$null) | Out-String
                if ($wslHealth -match '"status":\s*"ok"') { $ready = $true; break }
            }
        }
    }
    Start-Sleep -Seconds 2
}

Write-Host ""
if ($ready) {
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "PRODUCTION DEPLOY COMPLETED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "Local Gateway (WSL):" -ForegroundColor Cyan
    $wslIp = (wsl @distroArg bash -c "ip -4 addr show eth0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}'" 2>$null).Trim()
    if ($wslIp) {
        Write-Host "  Client (Visitor):       http://$wslIp/" -ForegroundColor Gray
        Write-Host "  Studio (Admin CAD):     http://$wslIp/admin/" -ForegroundColor Gray
        Write-Host "  Backend API:            http://$wslIp/api/" -ForegroundColor Gray
        Write-Host "  Swagger Docs:           http://$wslIp/docs" -ForegroundColor Gray
    } else {
        Write-Host "  Client (Visitor):       http://localhost/" -ForegroundColor Gray
        Write-Host "  Studio (Admin CAD):     http://localhost/admin/" -ForegroundColor Gray
    }

    # Автозапуск Cloudflare Tunnel для доступа с телефона без настроек сети
    $cfBin = "/mnt/$drive$rest/tools/cloudflared-linux"
    $cfLog = "$PSScriptRoot\tools\cloudflared.log"
    if (Test-Path "$PSScriptRoot\tools\cloudflared-linux") {
        Write-Host ""
        Write-Host "-> Запуск Cloudflare туннеля для доступа со смартфона..." -ForegroundColor Gray
        wsl @distroArg bash -c "pkill -f cloudflared 2>/dev/null || true" 2>$null
        wsl @distroArg bash -c "nohup $cfBin tunnel --url http://127.0.0.1:80 --no-autoupdate > '$wslPath/tools/cloudflared.log' 2>&1 &"
        Start-Sleep -Seconds 4
        if (Test-Path $cfLog) {
            $cfContent = Get-Content $cfLog -Raw
            if ($cfContent -match "(https://[a-zA-Z0-9-]+\.trycloudflare\.com)") {
                $publicUrl = $matches[1]
                Write-Host ""
                Write-Host "🌐 ПУБЛИЧНЫЙ ДОСТУП (ДЛЯ СМАРТФОНА И ПК):" -ForegroundColor Magenta
                Write-Host "  📱 Мобильный клиент:    $publicUrl/" -ForegroundColor Cyan
                Write-Host "  🗺 Карта test:          $publicUrl/m/test" -ForegroundColor Cyan
                Write-Host "  🛠 Студия организатора: $publicUrl/admin/" -ForegroundColor Cyan
            }
        }
    }

    Write-Host ""
    Write-Host "Demo Credentials:" -ForegroundColor Cyan
    Write-Host "  User:  user@ttk.example.com  / User12345!" -ForegroundColor Gray
    Write-Host "  Admin: admin@ttk.example.com / Admin12345! (Code: TTK-ADMIN-2026)" -ForegroundColor Gray
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "Services are running in background." -ForegroundColor Green
} else {
    Write-Host "Services are starting up. Please check logs with: wsl docker compose -f docker-compose.prod.yml logs" -ForegroundColor Yellow
}
