FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    CV_INPUT_DIR=/app/uploads \
    CV_OUTPUT_DIR=/app/uploads/panoramas \
    CV_WATCH_INTERVAL=5 \
    CV_PUBLIC_PREFIX=/uploads/panoramas

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "worker.py", "watch"]
