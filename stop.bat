@echo off
chcp 65001 >nul
title ТТК - Остановка сервисов
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop.ps1"
