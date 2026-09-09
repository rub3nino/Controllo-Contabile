#!/bin/bash
# ===========================================
# Quadra - Script di Backup
# ===========================================
# Uso: ./scripts/backup.sh
#
# Backup:
# - PostgreSQL (pg_dump)
# - MinIO bucket (mc mirror)
#
# I backup vengono salvati in ./backups/YYYY-MM-DD/

set -e

# Configurazione
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DATE=$(date +%Y-%m-%d-%H%M)
BACKUP_PATH="$BACKUP_DIR/$DATE"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# Colori
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       QUADRA - BACKUP SCRIPT           ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo "📅 Data: $DATE"
echo "📁 Destinazione: $BACKUP_PATH"
echo ""

# Crea directory backup
mkdir -p "$BACKUP_PATH/postgres"
mkdir -p "$BACKUP_PATH/minio"

# -------------------------------------------
# 1. BACKUP POSTGRESQL
# -------------------------------------------
echo -e "${YELLOW}[1/3] Backup PostgreSQL...${NC}"

if docker ps | grep -q quadra-postgres; then
    # Backup da container Docker
    docker exec quadra-postgres pg_dump \
        -U "${POSTGRES_USER:-quadra}" \
        -d "${POSTGRES_DB:-quadra}" \
        --format=custom \
        --file=/tmp/backup.dump
    
    docker cp quadra-postgres:/tmp/backup.dump "$BACKUP_PATH/postgres/quadra.dump"
    docker exec quadra-postgres rm /tmp/backup.dump
    
    echo -e "${GREEN}✓ PostgreSQL backup completato${NC}"
else
    # Backup locale (se PostgreSQL gira localmente)
    if command -v pg_dump &> /dev/null; then
        pg_dump \
            -h localhost \
            -U "${POSTGRES_USER:-quadra}" \
            -d "${POSTGRES_DB:-quadra}" \
            --format=custom \
            -f "$BACKUP_PATH/postgres/quadra.dump"
        
        echo -e "${GREEN}✓ PostgreSQL backup completato${NC}"
    else
        echo -e "${RED}✗ PostgreSQL non raggiungibile${NC}"
    fi
fi

# -------------------------------------------
# 2. BACKUP MINIO
# -------------------------------------------
echo -e "${YELLOW}[2/3] Backup MinIO...${NC}"

if docker ps | grep -q quadra-minio; then
    # Usa mc (MinIO Client) per il backup
    if command -v mc &> /dev/null; then
        # Configura alias se non esiste
        mc alias set quadra-backup \
            "http://${MINIO_ENDPOINT:-localhost:9000}" \
            "${MINIO_ACCESS_KEY:-minioadmin}" \
            "${MINIO_SECRET_KEY:-minioadmin}" \
            2>/dev/null || true
        
        # Mirror del bucket
        mc mirror \
            "quadra-backup/${MINIO_BUCKET:-quadra-documents}" \
            "$BACKUP_PATH/minio/" \
            --quiet
        
        echo -e "${GREEN}✓ MinIO backup completato${NC}"
    else
        # Fallback: copia diretto dal volume Docker
        docker cp quadra-minio:/data "$BACKUP_PATH/minio/"
        echo -e "${GREEN}✓ MinIO backup completato (volume copy)${NC}"
    fi
else
    # Backup storage locale
    if [ -d "${STORAGE_LOCAL_PATH:-./storage}" ]; then
        cp -r "${STORAGE_LOCAL_PATH:-./storage}" "$BACKUP_PATH/storage/"
        echo -e "${GREEN}✓ Storage locale backup completato${NC}"
    else
        echo -e "${YELLOW}⚠ Nessuno storage da backuppare${NC}"
    fi
fi

# -------------------------------------------
# 3. COMPRIMI BACKUP
# -------------------------------------------
echo -e "${YELLOW}[3/3] Compressione backup...${NC}"

cd "$BACKUP_DIR"
tar -czf "$DATE.tar.gz" "$DATE"
rm -rf "$DATE"

BACKUP_SIZE=$(du -h "$DATE.tar.gz" | cut -f1)
echo -e "${GREEN}✓ Backup compresso: $DATE.tar.gz ($BACKUP_SIZE)${NC}"

# -------------------------------------------
# PULIZIA VECCHI BACKUP
# -------------------------------------------
echo ""
echo "🧹 Pulizia backup più vecchi di $RETENTION_DAYS giorni..."

find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/*.tar.gz 2>/dev/null | wc -l)
echo "📊 Backup presenti: $BACKUP_COUNT"

# -------------------------------------------
# SUMMARY
# -------------------------------------------
echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       BACKUP COMPLETATO                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo "📦 File: $BACKUP_DIR/$DATE.tar.gz"
echo "📏 Dimensione: $BACKUP_SIZE"
echo ""
echo "Per ripristinare:"
echo "  ./scripts/restore.sh $DATE.tar.gz"
