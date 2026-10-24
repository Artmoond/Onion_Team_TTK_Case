#!/usr/bin/env bash
set -e

echo "🚀 Запуск всех сервисов ТТК..."

# Переход в папку со скриптом
cd "$(dirname "$0")"

# Запуск docker compose
if docker compose version &>/dev/null; then
    docker compose up -d
elif command -v docker-compose &>/dev/null; then
    docker-compose up -d
else
    echo "❌ Ошибка: Docker Compose не найден. Пожалуйста, установите Docker."
    exit 1
fi

echo ""
echo "✅ Все сервисы запущены!"
echo "📱 Мобильный клиент посетителя: http://localhost:3000"
echo "🛠 Студия организатора:        http://localhost:3001"
echo "🚀 Бэкенд API and Swagger:     http://localhost:8000/docs"
echo ""
echo "Для просмотра логов выполните: docker compose logs -f"
