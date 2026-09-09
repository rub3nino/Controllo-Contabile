#!/bin/bash
# ===========================================
# Quadra - Script di Restore
# ===========================================
# Uso: ./scripts/restore.sh backup-file.tar.gz
#
# Ripristina:
# - PostgreSQL (pg_restore)
# - MinIO bucket (mc mirror)

set -e

# Colori
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
    echo -e "${RED}Errore: Specifica il file di backup${NC}"
    echo ""
    echo "Uso: $0 <backup-file.tar.gz>"
    echo ""
    echo "Backup disponibili:"
    ls -1 ./backups/*.tar.gz 2>/dev/null || echo "  (nessuno)"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    # Prova nella cartella backups
    if [ -f "./backups/$BACKUP_FILE" ]; then
        BACKUP_FILE="./backups/$BACKUP_FILE"
    else
        echo -e "${RED}Errore: File non trovato: $BACKUP_FILE${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       QUADRA - RESTORE SCRIPT          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo "📦 Backup: $BACKUP_FILE"
echo ""

# Conferma
echo -e "${YELLOW}⚠️  ATTENZIONE: Questo sovrascriverà i dati esistenti!${NC}"
read -p "Continuare? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Operazione annullata."
    exit 1
fi

# Estrai backup
TEMP_DIR=$(mktemp -d)
echo "📂 Estrazione in $TEMP_DIR..."
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

# Trova la cartella estratta
BACKUP_DIR=$(ls -1 "$TEMP_DIR")
RESTORE_PATH="$TEMP_DIR/$BACKUP_DIR"

# -------------------------------------------
# 1. RESTORE POSTGRESQL
# -------------------------------------------
echo ""
echo -e "${YELLOW}[1/2] Restore PostgreSQL...${NC}"

if [ -f "$RESTORE_PATH/postgres/quadra.dump" ]; then
    if docker ps | grep -q quadra-postgres; then
        # Copia dump nel container
        docker cp "$RESTORE_PATH/postgres/quadra.dump" quadra-postgres:/tmp/backup.dump
        
        # Restore
        docker exec quadra-postgres pg_restore \
            -U "${POSTGRES_USER:-quadra}" \
            -d "${POSTGRES_DB:-quadra}" \
            --clean \
            --if-exists \
            /tmp/backup.dump || true
        
        docker exec quadra-postgres rm /tmp/backup.dump
        
        echo -e "${GREEN}✓ PostgreSQL restore completato${NC}"
    else
        # Restore locale
        if command -v pg_restore &> /dev/null; then
            pg_restore \
                -h localhost \
                -U "${POSTGRES_USER:-quadra}" \
                -d "${POSTGRES_DB:-quadra}" \
                --clean \
                --if-exists \
                "$RESTORE_PATH/postgres/quadra.dump" || true
            
            echo -e "${GREEN}✓ PostgreSQL restore completato${NC}"
        else
            echo -e "${RED}✗ pg_restore non disponibile${NC}"
        fi
    fi
else
    echo -e "${YELLOW}⚠ Nessun backup PostgreSQL trovato${NC}"
fi

# -------------------------------------------
# 2. RESTORE MINIO/STORAGE
# -------------------------------------------
echo ""
echo -e "${YELLOW}[2/2] Restore Storage...${NC}"

if [ -d "$RESTORE_PATH/minio" ]; then
    if docker ps | grep -q quadra-minio && command -v mc &> /dev/null; then
        # Restore MinIO
        mc alias set quadra-restore \
            "http://${MINIO_ENDPOINT:-localhost:9000}" \
            "${MINIO_ACCESS_KEY:-minioadmin}" \
            "${MINIO_SECRET_KEY:-minioadmin}" \
            2>/dev/null || true
        
        mc mirror \
            "$RESTORE_PATH/minio/" \
            "quadra-restore/${MINIO_BUCKET:-quadra-documents}" \
            --overwrite \
            --quiet
        
        echo -e "${GREEN}✓ MinIO restore completato${NC}"
    else
        echo -e "${YELLOW}⚠ MinIO non disponibile, copio in storage locale${NC}"
        mkdir -p "${STORAGE_LOCAL_PATH:-./storage}"
        cp -r "$RESTORE_PATH/minio/"* "${STORAGE_LOCAL_PATH:-./storage}/"
        echo -e "${GREEN}✓ Storage locale restore completato${NC}"
    fi
elif [ -d "$RESTORE_PATH/storage" ]; then
    mkdir -p "${STORAGE_LOCAL_PATH:-./storage}"
    cp -r "$RESTORE_PATH/storage/"* "${STORAGE_LOCAL_PATH:-./storage}/"
    echo -e "${GREEN}✓ Storage locale restore completato${NC}"
else
    echo -e "${YELLOW}⚠ Nessun backup storage trovato${NC}"
fi

# Cleanup
rm -rf "$TEMP_DIR"

# -------------------------------------------
# SUMMARY
# -------------------------------------------
echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       RESTORE COMPLETATO               ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo "🔄 Riavvia i servizi per applicare le modifiche:"
echo "   docker-compose restart"
