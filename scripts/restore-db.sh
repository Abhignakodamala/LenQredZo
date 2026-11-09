#!/usr/bin/env bash
# ==============================================================================
#   LENQREDZO ONE-CLICK DATABASE RESTORE UTILITY
#   Usage: ./scripts/restore-db.sh /path/to/backup.sql.gz [-y]
# ==============================================================================

set -eo pipefail

BACKUP_FILE="$1"
CONFIRM_FLAG="$2"
CONTAINER_NAME="lenqredzo_postgres"
DB_NAME="lenqredzo"
DB_USER="postgres"

if [ -z "$BACKUP_FILE" ]; then
    echo "❌ Usage: $0 <path_to_backup_file.sql.gz> [-y]"
    echo ""
    echo "Available backups in default location:"
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    BASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
    ls -lh "$BASE_DIR/backups/db/"*.sql.gz 2>/dev/null || echo "  (No backups found in $BASE_DIR/backups/db/)"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: Backup file '$BACKUP_FILE' not found!"
    exit 1
fi

# Verify GZIP integrity before attempting restore
echo "🔍 Checking backup file integrity..."
if ! gzip -t "$BACKUP_FILE" 2>/dev/null; then
    echo "❌ Error: Backup file is corrupted or not a valid gzip file!"
    exit 1
fi

echo "✅ Backup file verified: $(basename "$BACKUP_FILE") ($(du -h "$BACKUP_FILE" | awk '{print $1}'))"

# Confirmation prompt unless -y is passed
if [ "$CONFIRM_FLAG" != "-y" ] && [ "$CONFIRM_FLAG" != "--yes" ]; then
    echo ""
    echo "⚠️  WARNING: This operation will OVERWRITE the current live database '$DB_NAME'!"
    echo "All current data will be replaced with the contents of this backup file."
    read -rp "Are you absolutely sure you want to proceed? (Type 'yes' to confirm): " USER_INPUT
    if [ "$USER_INPUT" != "yes" ]; then
        echo "🛑 Restore aborted by user."
        exit 0
    fi
fi

echo ""
echo "🚀 Restoring database from $(basename "$BACKUP_FILE")..."

# Ensure postgres container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "❌ Error: PostgreSQL container ($CONTAINER_NAME) is not running!"
    exit 1
fi

# Restore database
gunzip -c "$BACKUP_FILE" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME"

echo ""
echo "🔄 Restarting API container to refresh connections..."
docker restart lenqredzo_api || true

echo ""
echo "=========================================================="
echo "   ✅ DATABASE RESTORE COMPLETED SUCCESSFULLY!           "
echo "=========================================================="
