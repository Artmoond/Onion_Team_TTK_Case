@echo off
chcp 65001 >nul
title ТТК - Запуск сервисов
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ОШИБКА] Не удалось запустить сервисы.
    pause
)
