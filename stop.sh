#!/usr/bin/env bash
set -e

echo "🛑 Остановка контейнеров ТТК..."
cd "$(dirname "$0")"

if docker compose version &>/dev/null; then
    docker compose down
elif command -v docker-compose &>/dev/null; then
    docker-compose down
else
    echo "❌ Ошибка: Docker Compose не найден."
    exit 1
fi

echo "✅ Все контейнеры остановлены."
