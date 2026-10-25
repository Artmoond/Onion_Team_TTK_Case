$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "🛑 Остановка всех сервисов ТТК..." -ForegroundColor Yellow

# 1. Проверяем наличие нативного Docker
$hasNativeDocker = $false
try {
    $null = docker --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        $hasNativeDocker = $true
    }
} catch {}

if ($hasNativeDocker) {
    docker compose down --remove-orphans 2>$null
    docker compose -f docker-compose.prod.yml down --remove-orphans 2>$null
} else {
    $winPath = (Get-Location).Path
    $drive = $winPath.Substring(0, 1).ToLower()
    $rest = $winPath.Substring(2).Replace('\', '/')
    $wslPath = "/mnt/$drive$rest"

    $wslDistros = (wsl -l -q 2>$null) | Out-String
    $distroArg = @()
    if ($wslDistros -match "Ubuntu") {
        $ubuntuName = (($wslDistros -split "`r?`n") | Where-Object { $_ -match "Ubuntu" } | Select-Object -First 1).Trim()
        if ($ubuntuName) {
            $distroArg = @("-d", $ubuntuName)
        }
    }

    wsl @distroArg bash -c "cd '$wslPath' && docker compose down --remove-orphans 2>/dev/null; docker compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null; pkill -f 'sleep infinity' 2>/dev/null || true"
}

Write-Host "✅ Все контейнеры (Dev и Prod) остановлены." -ForegroundColor Green
