FROM python:3.12-slim

WORKDIR /app

# Install system dependencies (minimal)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl wget git gnupg \
    libssl-dev libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend .

# Create data directory
RUN mkdir -p data

EXPOSE 8000

# Use Railway's dynamic PORT env var, fall back to 8000 locally
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
