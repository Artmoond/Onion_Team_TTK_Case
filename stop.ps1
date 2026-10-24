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
    docker compose down
} else {
    $winPath = (Get-Location).Path
    $wslPath = ""
    try {
        $wslPath = (wsl wslpath -u "$winPath" 2>$null).Trim()
    } catch {}

    if (-not $wslPath) {
        $wslPath = "/mnt/" + $winPath.Substring(0, 1).ToLower() + $winPath.Substring(2).Replace('\', '/')
    }

    $wslDistros = (wsl -l -q 2>$null) | Out-String
    $distroArg = @()
    if ($wslDistros -match "Ubuntu") {
        $ubuntuName = (($wslDistros -split "`r?`n") | Where-Object { $_ -match "Ubuntu" } | Select-Object -First 1).Trim()
        if ($ubuntuName) {
            $distroArg = @("-d", $ubuntuName)
        }
    }

    wsl @distroArg bash -c "cd '$wslPath' && docker compose down"
}

Write-Host "✅ Все контейнеры остановлены." -ForegroundColor Green
