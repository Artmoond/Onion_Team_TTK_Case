# Скрипт запуска всего проекта ТТК через WSL Docker Compose
Write-Host "Запуск всех сервисов ТТК через WSL Docker Compose..." -ForegroundColor Cyan

# Преобразуем текущий Windows путь в формат WSL
$winPath = (Get-Location).Path
$wslPath = "/mnt/" + $winPath.Substring(0,1).ToLower() + $winPath.Substring(2).Replace('\', '/')

wsl -d Ubuntu bash -c "cd '$wslPath' && docker compose up -d"

Write-Host ""
Write-Host " Все сервисы запущены!" -ForegroundColor Green
Write-Host " 📱 Мобильный клиент посетителя: http://localhost:3000" -ForegroundColor Yellow
Write-Host " 🛠 Студия организатора:        http://localhost:3001" -ForegroundColor Yellow
Write-Host " 🚀 Бэкенд API & Swagger:        http://localhost:8000/docs" -ForegroundColor Yellow
Write-Host ""
Write-Host "Для просмотра логов выполните: wsl docker compose logs -f" -ForegroundColor Gray
