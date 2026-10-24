FROM python:3.11-slim

# UID/GID можно переопределить при сборке, чтобы пользователь контейнера
# совпадал с владельцем ./data/uploads на Linux-хосте.
ARG APP_UID=1000
ARG APP_GID=1000

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    CV_INPUT_DIR=/app/uploads \
    CV_OUTPUT_DIR=/app/uploads/panoramas \
    CV_WATCH_INTERVAL=5 \
    CV_SETTLE_SECONDS=2 \
    CV_PUBLIC_PREFIX=/uploads/panoramas

RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid "$APP_GID" cvworker \
    && useradd --uid "$APP_UID" --gid "$APP_GID" --create-home --shell /usr/sbin/nologin cvworker

COPY --chown=cvworker:cvworker requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=cvworker:cvworker . .
RUN mkdir -p /app/uploads && chown -R cvworker:cvworker /app

USER cvworker

# Воркер обновляет heartbeat в начале и конце каждого прохода.
# Если файл старше 120 секунд, контейнер считается нездоровым.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import os,sys,time; p=os.path.join(os.environ['CV_OUTPUT_DIR'],'.cv-worker-heartbeat'); sys.exit(0 if os.path.exists(p) and time.time()-os.path.getmtime(p) <= 120 else 1)"

CMD ["python", "worker.py", "watch"]
