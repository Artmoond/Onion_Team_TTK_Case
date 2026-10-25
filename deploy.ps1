$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "🚀 Начинаем продакшен-деплой ТТК Интерактивная карта пространства..." -ForegroundColor Cyan

# 1. Проверка наличия .env
if (-not (Test-Path ".env")) {
    Write-Host "⚙️ Создаём файл .env на основе .env.example..." -ForegroundColor Gray
    Copy-Item ".env.example" ".env"
    $randBytes = New-Object byte[] 32
    (New-Object System.Security.Cryptography.RNGCryptoServiceProvider).GetBytes($randBytes)
    $randSecret = ($randBytes | ForEach-Object { "{0:x2}" -f $_ }) -join ""
    (Get-Content ".env") -replace "TTK_JWT_SECRET=.*", "TTK_JWT_SECRET=$randSecret" | Set-Content ".env"
    Write-Host "✅ Файл .env создан с уникальным JWT секретом." -ForegroundColor Green
}

# 2. Подготовка папок данных
New-Item -ItemType Directory -Force -Path "data/uploads/panoramas", "data/uploads/venues", "shared" | Out-Null

# 3. Проверка нативного Docker или WSL
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
    Write-Host "-> Запуск сборки через Docker Engine..." -ForegroundColor Gray
    docker compose -f docker-compose.prod.yml down --remove-orphans 2>$null
    docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
} else {
    Write-Host "-> Docker Desktop не активен. Сборка через WSL..." -ForegroundColor Yellow
    wsl @distroArg bash -c "cd '$wslPath' && docker compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null; docker compose -f docker-compose.prod.yml up -d --build --remove-orphans"
}

# 4. Проверка готовности
Write-Host "⏳ Проверка готовности сервисов..." -ForegroundColor Gray
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
    Write-Host "✅ ПРОДАКШЕН-ДЕПЛОЙ УСПЕШНО ЗАВЕРШЁН!" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "🌐 Единая точка входа (Gateway): http://localhost" -ForegroundColor Cyan
    Write-Host "   ├─ Мобильный клиент посетителя: http://localhost/" -ForegroundColor Gray
    Write-Host "   ├─ Студия организатора:        http://localhost/admin/" -ForegroundColor Gray
    Write-Host "   ├─ API бэкенда:                http://localhost/api/" -ForegroundColor Gray
    Write-Host "   └─ Swagger документация:       http://localhost/docs" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Прямые порты микросервисов:" -ForegroundColor Cyan
    Write-Host "   ├─ Клиент (порт 3000):         http://localhost:3000" -ForegroundColor Gray
    Write-Host "   ├─ Студия (порт 3001):         http://localhost:3001" -ForegroundColor Gray
    Write-Host "   └─ Бэкенд (порт 8000):         http://localhost:8000" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Демо-доступы:" -ForegroundColor Cyan
    Write-Host "   • Посетитель:  user@ttk.example.com  / User12345!"
    Write-Host "   • Организатор: admin@ttk.example.com / Admin12345!"
    Write-Host "   • Инвайт-код:  TTK-ADMIN-2026"
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "📡 Трансляция логов сервисов (Ctrl+C для выхода)..." -ForegroundColor Cyan
    if ($hasNativeDocker) {
        docker compose -f docker-compose.prod.yml logs -f
    } else {
        wsl @distroArg bash -c "cd '$wslPath' && docker compose -f docker-compose.prod.yml logs -f"
    }
} else {
    Write-Host "⚠️  Сервисы собираются или не ответили на healthcheck вовремя." -ForegroundColor Yellow
}
