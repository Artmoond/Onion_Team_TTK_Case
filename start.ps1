$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "🚀 Запуск всех сервисов ТТК..." -ForegroundColor Cyan

function Show-ComposeFailure {
    Write-Host ""
    Write-Host "❌ Не удалось запустить сервисы. Последние логи:" -ForegroundColor Red
    docker compose ps
    docker compose logs --tail=120
}

# 1. Проверяем наличие Docker CLI и доступность демона.
$hasNativeDocker = $false
try {
    $null = docker --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        $hasNativeDocker = $true
    }
} catch {}

$useWsl = $false

if ($hasNativeDocker) {
    $null = docker info 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "-> Docker Desktop доступен. Запуск с пересборкой образов..." -ForegroundColor Gray
        # --build обязателен после изменения requirements.txt, иначе backend
        # запустится на старом образе без новых зависимостей.
        docker compose up -d --build --remove-orphans
        if ($LASTEXITCODE -ne 0) {
            $exitCode = $LASTEXITCODE
            Show-ComposeFailure
            exit $exitCode
        }
    } else {
        Write-Host "-> Docker CLI найден, но демон недоступен. Пробуем через WSL..." -ForegroundColor Yellow
        $useWsl = $true
    }
} else {
    Write-Host "-> Docker Desktop не найден, пробуем через WSL..." -ForegroundColor Gray
    $useWsl = $true
}

if ($useWsl) {
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
        $ubuntuName = (($wslDistros -split "`r?`n") | Where-Object { $_ -match "Ubuntu" } | Select-Object -First 1).Trim()
        if ($ubuntuName) {
            $distroArg = @("-d", $ubuntuName)
        }
    }

    wsl @distroArg bash -c "cd '$wslPath' && docker compose up -d --build --remove-orphans"
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "❌ Не удалось запустить Docker через WSL." -ForegroundColor Red
        Write-Host "Проверьте, что Docker Desktop или Docker Engine запущен, а WSL-дистрибутив доступен." -ForegroundColor Yellow
        Write-Host "Логи: wsl @distroArg docker compose logs --tail=120" -ForegroundColor Gray
        exit $LASTEXITCODE
    }
}

# 2. Ждём готовности backend.
Write-Host ""
Write-Host "⏳ Ждём готовности backend..." -ForegroundColor Gray
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:8000/api/health" -TimeoutSec 2
        if ($health.status -eq "ok") {
            $ready = $true
            break
        }
    } catch {}
    Start-Sleep -Seconds 1
}

if ($ready) {
    Write-Host "✅ Backend готов." -ForegroundColor Green
} else {
    Write-Host "⚠️  Backend не ответил за 60 секунд. Последние логи:" -ForegroundColor Yellow
    if ($useWsl) {
        wsl @distroArg docker compose ps
        wsl @distroArg docker compose logs --tail=80 backend
    } else {
        docker compose ps
        docker compose logs --tail=80 backend
    }
}

Write-Host ""
Write-Host "✅ Все сервисы запущены!" -ForegroundColor Green
Write-Host "📱 Мобильный клиент посетителя: http://localhost:3000" -ForegroundColor Yellow
Write-Host "🛠 Студия организатора:        http://localhost:3001" -ForegroundColor Yellow
Write-Host "🚀 Бэкенд API and Swagger:     http://localhost:8000/docs" -ForegroundColor Yellow
Write-Host ""
Write-Host "Демо-доступ:" -ForegroundColor Cyan
Write-Host "  Посетитель:  user@ttk.example.com  / User12345!"
Write-Host "  Организатор: admin@ttk.example.com / Admin12345!"
Write-Host "  Код регистрации организатора: TTK-ADMIN-2026"
Write-Host ""
Write-Host "Для просмотра логов: docker compose logs -f (или wsl docker compose logs -f)" -ForegroundColor Gray
