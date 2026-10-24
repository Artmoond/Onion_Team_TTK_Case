$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "🚀 Запуск всех сервисов ТТК..." -ForegroundColor Cyan

# 1. Проверяем наличие нативного Docker (Docker Desktop на Windows)
$hasNativeDocker = $false
try {
    $null = docker --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        $hasNativeDocker = $true
    }
} catch {}

if ($hasNativeDocker) {
    Write-Host "-> Обнаружен Docker Desktop на Windows. Запуск напрямую..." -ForegroundColor Gray
    docker compose up -d
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Ошибка при выполнении docker compose up -d" -ForegroundColor Red
        exit $LASTEXITCODE
    }
} else {
    # 2. Если нативного Docker нет, пробуем через WSL
    Write-Host "-> Docker Desktop в Windows не найден, пробуем через WSL..." -ForegroundColor Gray
    
    $winPath = (Get-Location).Path
    $wslPath = ""
    try {
        $wslPath = (wsl wslpath -u "$winPath" 2>$null).Trim()
    } catch {}

    if (-not $wslPath) {
        $wslPath = "/mnt/" + $winPath.Substring(0, 1).ToLower() + $winPath.Substring(2).Replace('\', '/')
    }

    # Проверяем наличие дистрибутива Ubuntu или используем дефолтный
    $wslDistros = (wsl -l -q 2>$null) | Out-String
    $distroArg = @()
    if ($wslDistros -match "Ubuntu") {
        # Ищем точное имя Ubuntu (Ubuntu, Ubuntu-22.04 и т.д.)
        $ubuntuName = (($wslDistros -split "`r?`n") | Where-Object { $_ -match "Ubuntu" } | Select-Object -First 1).Trim()
        if ($ubuntuName) {
            $distroArg = @("-d", $ubuntuName)
        }
    }

    wsl @distroArg bash -c "cd '$wslPath' && docker compose up -d"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Не удалось запустить Docker через WSL. Убедитесь, что Docker установлен и запущен." -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

Write-Host ""
Write-Host "✅ Все сервисы запущены!" -ForegroundColor Green
Write-Host "📱 Мобильный клиент посетителя: http://localhost:3000" -ForegroundColor Yellow
Write-Host "🛠 Студия организатора:        http://localhost:3001" -ForegroundColor Yellow
Write-Host "🚀 Бэкенд API and Swagger:     http://localhost:8000/docs" -ForegroundColor Yellow
Write-Host ""
Write-Host "Для просмотра логов выполните: docker compose logs -f (или wsl docker compose logs -f)" -ForegroundColor Gray
