#!/usr/bin/env bash
set -euo pipefail

echo "🛑 Остановка продакшен-сервисов ТТК..."
cd "$(dirname "$0")"

COMPOSE=(docker compose)
if ! docker compose version &> /dev/null; then
    if command -v docker-compose &> /dev/null; then
        COMPOSE=(docker-compose)
    fi
fi

"${COMPOSE[@]}" -f docker-compose.prod.yml down --remove-orphans
echo "✅ Продакшен-контейнеры остановлены."
