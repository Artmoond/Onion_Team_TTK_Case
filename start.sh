#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "🚀 Запуск всех сервисов ТТК..."

# 1. Проверяем, что Docker вообще установлен и демон доступен.
if ! command -v docker &>/dev/null; then
    echo "❌ Docker не найден. Установите Docker Desktop / Docker Engine."
    exit 1
fi

if ! docker info &>/dev/null; then
    echo "❌ Docker установлен, но демон недоступен."
    echo ""
    echo "Что проверить:"
    echo "  • Windows/macOS: запущен ли Docker Desktop?"
    echo "  • Linux: sudo systemctl start docker"
    echo "  • Права: sudo usermod -aG docker \$USER  (после этого перезайдите в систему)"
    echo "  • Или запустите Docker с sudo: sudo ./start.sh"
    exit 1
fi

# 2. Выбираем доступную команду Compose.
if docker compose version &>/dev/null; then
    COMPOSE=(docker compose)
elif command -v docker-compose &>/dev/null; then
    COMPOSE=(docker-compose)
else
    echo "❌ Docker Compose не найден. Обновите Docker Desktop или установите docker-compose."
    exit 1
fi

# 3. --build обязателен: после изменения requirements.txt старый образ без
#    новых Python-зависимостей приведёт к падению backend.
if ! "${COMPOSE[@]}" up -d --build --remove-orphans; then
    echo ""
    echo "❌ Не удалось запустить сервисы. Последние логи:"
    "${COMPOSE[@]}" ps || true
    "${COMPOSE[@]}" logs --tail=120 || true
    exit 1
fi

# 4. Ждём, пока backend ответит на health-check (если установлен curl).
if command -v curl &>/dev/null; then
    echo ""
    echo "⏳ Ждём готовности backend..."
    READY=0
    for _ in $(seq 1 60); do
        if curl -fsS http://localhost:8000/api/health >/dev/null 2>&1; then
            READY=1
            break
        fi
        sleep 1
    done
    if [ "$READY" -eq 1 ]; then
        echo "✅ Backend готов."
    else
        echo "⚠️  Backend не ответил за 60 секунд. Последние логи:"
        "${COMPOSE[@]}" ps || true
        "${COMPOSE[@]}" logs --tail=80 backend || true
        echo ""
        echo "Если в логах Permission denied на package.json/main.py/uploads —"
        echo "это SELinux на Fedora. Пересоздайте контейнеры:"
        echo "    sudo docker compose down --remove-orphans && sudo ./start.sh"
    fi
fi

echo ""
"${COMPOSE[@]}" ps
echo ""
echo "✅ Все сервисы запущены!"
echo "📱 Мобильный клиент посетителя: http://localhost:3000"
echo "🛠 Студия организатора:        http://localhost:3001"
echo "🚀 Бэкенд API and Swagger:     http://localhost:8000/docs"
echo ""
echo "Демо-доступ:"
echo "  Посетитель:  user@ttk.example.com  / User12345!"
echo "  Организатор: admin@ttk.example.com / Admin12345!"
echo "  Код регистрации организатора: TTK-ADMIN-2026"
echo ""
echo "Для просмотра логов: ${COMPOSE[*]} logs -f"
