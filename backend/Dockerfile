FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System deps (psycopg, mails, etc. add as needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl && \
    rm -rf /var/lib/apt/lists/*

# Install python deps
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy app
COPY . .

# Expose FastAPI
EXPOSE 8000

# If you have alembic, uncomment to run migrations on start
# CMD alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 8000

CMD ["uvicorn","main:app","--host","0.0.0.0","--port","8000"]
