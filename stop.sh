#!/usr/bin/env bash
set -e

echo "🛑 Остановка контейнеров ТТК..."
cd "$(dirname "$0")"

if docker compose version &>/dev/null; then
    docker compose down --remove-orphans 2>/dev/null || true
    docker compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
elif command -v docker-compose &>/dev/null; then
    docker-compose down --remove-orphans 2>/dev/null || true
    docker-compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
else
    echo "❌ Ошибка: Docker Compose не найден."
    exit 1
fi

echo "✅ Все контейнеры остановлены."
