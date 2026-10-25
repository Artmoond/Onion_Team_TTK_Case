$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "🌐 Запуск Cloudflare Tunnel для публичного доступа в интернет..." -ForegroundColor Cyan

$cloudflaredPath = Join-Path $PSScriptRoot "tools\cloudflared.exe"

if (-not (Test-Path $cloudflaredPath)) {
    Write-Host "Скачивание cloudflared.exe..." -ForegroundColor Gray
    Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $cloudflaredPath -TimeoutSec 60
}

Write-Host ""
Write-Host "Подключение туннеля к Nginx Gateway (http://127.0.0.1:80)..." -ForegroundColor Yellow
Write-Host "Ищите в логах строчку вида: https://xxxx.trycloudflare.com" -ForegroundColor Green
Write-Host ""

& $cloudflaredPath tunnel --url http://127.0.0.1:80 --no-autoupdate
