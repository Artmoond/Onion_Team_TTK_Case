# Скрипт остановки сервисов ТТК
Write-Host "Остановка контейнеров ТТК..." -ForegroundColor Yellow

$winPath = (Get-Location).Path
$wslPath = "/mnt/" + $winPath.Substring(0,1).ToLower() + $winPath.Substring(2).Replace('\', '/')

wsl -d Ubuntu bash -c "cd '$wslPath' && docker compose down"

Write-Host "Контейнеры остановлены." -ForegroundColor Green
