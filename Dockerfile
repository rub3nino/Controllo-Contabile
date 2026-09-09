# Quadra API - Dockerfile
# Multi-stage build per immagine leggera

# ============================================
# Stage 1: Builder
# ============================================
FROM python:3.12-slim as builder

WORKDIR /app

# Installa dipendenze di build
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copia requirements e installa dipendenze
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ============================================
# Stage 2: Runtime
# ============================================
FROM python:3.12-slim as runtime

# Metadata
LABEL org.opencontainers.image.title="Quadra API"
LABEL org.opencontainers.image.description="Backend FastAPI per controllo contabile"
LABEL org.opencontainers.image.source="https://github.com/tuorepo/quadra"

# Non-root user per sicurezza
RUN groupadd -r quadra && useradd -r -g quadra quadra

WORKDIR /app

# Dipendenze runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copia dipendenze Python dal builder
COPY --from=builder /root/.local /home/quadra/.local
ENV PATH=/home/quadra/.local/bin:$PATH

# Copia codice applicazione
COPY --chown=quadra:quadra backend/ ./backend/
COPY --chown=quadra:quadra regole/ ./regole/
COPY --chown=quadra:quadra fixtures/ ./fixtures/

# Switch a non-root user
USER quadra

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Porta esposta
EXPOSE 8000

# Variabili d'ambiente di default
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    ENVIRONMENT=production

# Comando di avvio
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
