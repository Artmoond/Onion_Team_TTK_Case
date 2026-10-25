$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "🛑 Остановка продакшен-сервисов ТТК..." -ForegroundColor Yellow

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
    docker compose -f docker-compose.prod.yml down --remove-orphans
} else {
    wsl @distroArg bash -c "cd '$wslPath' && docker compose -f docker-compose.prod.yml down --remove-orphans"
}

# Остановка Cloudflare туннеля (если был запущен)
Write-Host "-> Остановка Cloudflare туннеля..." -ForegroundColor Gray
try {
    Stop-Process -Name "cloudflared" -Force -ErrorAction SilentlyContinue
} catch {}
try {
    wsl @distroArg bash -c "pkill -f cloudflared 2>/dev/null || true" 2>$null
} catch {}

Write-Host "✅ Все продакшен-сервисы и туннели полностью остановлены." -ForegroundColor Green
