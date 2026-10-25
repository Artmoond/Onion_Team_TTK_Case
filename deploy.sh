#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Скрипт автоматического продакшен-деплоя ТТК «Интерактивная карта пространства»
# ==============================================================================

cd "$(dirname "$0")"

echo "🚀 Начинаем продакшен-деплой ТТК Интерактивная карта пространства..."

# 1. Проверка Docker и Docker Compose
if ! command -v docker &> /dev/null; then
    echo "❌ Ошибка: Docker не установлен. Установите Docker: https://docs.docker.com/engine/install/"
    exit 1
fi

COMPOSE=(docker compose)
if ! docker compose version &> /dev/null; then
    if command -v docker-compose &> /dev/null; then
        COMPOSE=(docker-compose)
    else
        echo "❌ Ошибка: Docker Compose плагин не найден."
        exit 1
    fi
fi

# 2. Создание .env если его нет
if [ ! -f .env ]; then
    echo "⚙️ Создаём файл .env на основе .env.example..."
    cp .env.example .env
    # Генерируем уникальный JWT Secret
    if command -v openssl &> /dev/null; then
        RAND_SECRET=$(openssl rand -hex 32)
        sed -i.bak "s/TTK_JWT_SECRET=.*/TTK_JWT_SECRET=${RAND_SECRET}/" .env && rm -f .env.bak
    fi
    echo "✅ Файл .env создан с уникальным JWT секретом."
fi

# 3. Подготовка директорий хранения данных
echo "📁 Подготовка директорий данных..."
mkdir -p data/uploads/panoramas data/uploads/venues shared
chmod -R 777 data/uploads 2>/dev/null || true

# 4. Сборка и запуск продакшен-контейнеров
echo "📦 Сборка и запуск оптимизированных продакшен-образов..."
"${COMPOSE[@]}" -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
"${COMPOSE[@]}" -f docker-compose.prod.yml up -d --build --remove-orphans

# 5. Ожидание готовности Gateway и Backend
echo "⏳ Проверка готовности сервисов..."
READY=false
for i in {1..30}; do
    if curl -s -f http://127.0.0.1/api/health > /dev/null 2>&1 || curl -s -f http://127.0.0.1:8000/api/health > /dev/null 2>&1; then
        READY=true
        break
    fi
    sleep 2
done

echo ""
if [ "$READY" = true ]; then
    echo "============================================================"
    echo "✅ ПРОДАКШЕН-ДЕПЛОЙ УСПЕШНО ЗАВЕРШЁН!"
    echo "============================================================"
    echo "🌐 Единая точка входа (Gateway): http://localhost"
    echo "   ├─ Мобильный клиент посетителя: http://localhost/"
    echo "   ├─ Студия организатора:        http://localhost/admin/"
    echo "   ├─ API бэкенда:                http://localhost/api/"
    echo "   └─ Swagger документация:       http://localhost/docs"
    echo ""
    echo "Прямые порты микросервисов:"
    echo "   ├─ Клиент (порт 3000):         http://localhost:3000"
    echo "   ├─ Студия (порт 3001):         http://localhost:3001"
    echo "   └─ Бэкенд (порт 8000):         http://localhost:8000"
    echo ""
    echo "Демо-доступы:"
    echo "   • Посетитель:  user@ttk.example.com  / User12345!"
    echo "   • Организатор: admin@ttk.example.com / Admin12345!"
    echo "   • Инвайт-код:  TTK-ADMIN-2026"
    echo "============================================================"
    echo "Просмотр логов: ${COMPOSE[*]} -f docker-compose.prod.yml logs -f"
else
    echo "⚠️ Сервисы запустились, но healthcheck ещё не ответил."
    echo "Проверьте логи: ${COMPOSE[*]} -f docker-compose.prod.yml logs --tail=50"
fi
