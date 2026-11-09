#!/usr/bin/env bash
# ==============================================================================
#   LENQREDZO AUTOMATED PRODUCTION DATABASE BACKUP & ALERT SYSTEM
#   - Daily automated compressed pg_dump
#   - Backup file integrity & size verification
#   - Instant Resend Email Alert on any failure
#   - Automatic 30-day retention pruning
# ==============================================================================

set -eo pipefail

# 1. Determine Project Directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# 2. Load Environment Variables (for Resend API Key & Owner Email)
ENV_FILE="$BASE_DIR/.env"
if [ -f "$ENV_FILE" ]; then
    # Safely extract variables without breaking on special chars
    RESEND_API_KEY=$(grep -E '^RESEND_API_KEY=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'")
    PLATFORM_OWNER_EMAIL=$(grep -E '^PLATFORM_OWNER_EMAIL=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'")
fi

# Fallback defaults
PLATFORM_OWNER_EMAIL="${PLATFORM_OWNER_EMAIL:-abhignakodamala742@gmail.com}"
RESEND_API_KEY="${RESEND_API_KEY:-}"
CONTAINER_NAME="lenqredzo_postgres"
DB_NAME="lenqredzo"
DB_USER="postgres"

# 3. Directories & Files
BACKUP_DIR="$BASE_DIR/backups/db"
LOG_FILE="$BASE_DIR/backups/backup.log"
mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
HUMAN_DATE="$(date +"%Y-%m-%d %H:%M:%S %Z")"
BACKUP_FILE="$BACKUP_DIR/lenqredzo_${TIMESTAMP}.sql.gz"

log() {
    local level="$1"
    local msg="$2"
    echo "[$HUMAN_DATE] [$level] $msg" | tee -a "$LOG_FILE"
}

# 4. Email Alert Dispatcher (Uses Resend API)
send_failure_alert() {
    local error_reason="$1"
    local disk_usage
    disk_usage="$(df -h / | tail -n 1 | awk '{print $5 " used (" $4 " free)"}')"

    log "ERROR" "Dispatching CRITICAL FAILURE alert email to $PLATFORM_OWNER_EMAIL..."

    local email_json
    email_json=$(cat <<EOF
{
  "from": "LenQredzo System <onboarding@resend.dev>",
  "to": ["$PLATFORM_OWNER_EMAIL"],
  "subject": "🚨 [CRITICAL ALERT] LenQredzo Daily Database Backup FAILED",
  "html": "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #fecaca; border-radius: 12px; background: #fff5f5;'><h2 style='color: #b91c1c; margin-top: 0;'>🚨 Critical Database Backup Alert</h2><p style='color: #374151; font-size: 14px;'>The automated daily database backup failed on your LenQredzo production server.</p><div style='background: white; border-radius: 8px; padding: 16px; border: 1px solid #fee2e2; margin: 16px 0;'><table style='width: 100%; font-size: 13px; color: #1f2937;'><tr style='border-bottom: 1px solid #f3f4f6;'><td style='padding: 6px 0; font-weight: 600;'>Server Host:</td><td>$(hostname) (187.127.163.34)</td></tr><tr style='border-bottom: 1px solid #f3f4f6;'><td style='padding: 6px 0; font-weight: 600;'>Failure Timestamp:</td><td>$HUMAN_DATE</td></tr><tr style='border-bottom: 1px solid #f3f4f6;'><td style='padding: 6px 0; font-weight: 600;'>Disk Space:</td><td>$disk_usage</td></tr><tr><td style='padding: 6px 0; font-weight: 600; color: #dc2626;'>Error Reason:</td><td style='color: #dc2626; font-weight: 700;'>$error_reason</td></tr></table></div><p style='font-size: 13px; color: #4b5563; line-height: 1.5;'>Please log in to your Hostinger terminal and check the logs: <code style='background: #f3f4f6; padding: 2px 6px; border-radius: 4px;'>cat /root/finsmart/backups/backup.log</code></p><p style='font-size: 11px; color: #9ca3af; margin-top: 24px; text-align: center;'>LenQredzo Automated Disaster Recovery Agent</p></div>"
}
EOF
)

    if [ -n "$RESEND_API_KEY" ]; then
        curl -s -X POST "https://api.resend.com/emails" \
            -H "Authorization: Bearer $RESEND_API_KEY" \
            -H "Content-Type: application/json" \
            -d "$email_json" >> "$LOG_FILE" 2>&1 || true
    fi
}

log "INFO" "=========================================================="
log "INFO" "Starting LenQredzo Automated Database Backup..."

# 5. Check Docker Container Status
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    log "ERROR" "PostgreSQL container ($CONTAINER_NAME) is NOT running!"
    send_failure_alert "PostgreSQL Docker container ($CONTAINER_NAME) is stopped or unhealthy."
    exit 1
fi

# 6. Execute PostgreSQL Dump via Docker
log "INFO" "Executing pg_dump inside container $CONTAINER_NAME for database '$DB_NAME'..."

set +e
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"
DUMP_EXIT_CODE=$?
set -e

if [ $DUMP_EXIT_CODE -ne 0 ]; then
    log "ERROR" "pg_dump failed with exit code $DUMP_EXIT_CODE"
    rm -f "$BACKUP_FILE"
    send_failure_alert "pg_dump command failed inside PostgreSQL container (Exit code: $DUMP_EXIT_CODE)."
    exit 1
fi

# 7. Verification: Ensure file exists and is not empty
if [ ! -f "$BACKUP_FILE" ]; then
    log "ERROR" "Backup file $BACKUP_FILE was not created!"
    send_failure_alert "Backup file was not created on the filesystem."
    exit 1
fi

FILE_SIZE_BYTES=$(wc -c < "$BACKUP_FILE" | tr -d ' ')
if [ "$FILE_SIZE_BYTES" -lt 1024 ]; then
    log "ERROR" "Backup file is suspiciously small ($FILE_SIZE_BYTES bytes). Possible corrupt dump!"
    send_failure_alert "Backup file size is suspiciously small ($FILE_SIZE_BYTES bytes). Database tables may not have dumped."
    exit 1
fi

# 8. Integrity Check: Verify GZIP stream
if ! gzip -t "$BACKUP_FILE" 2>/dev/null; then
    log "ERROR" "GZIP integrity check failed! The backup file is corrupted."
    send_failure_alert "GZIP archive test failed; the created backup file is corrupted."
    exit 1
fi

HUMAN_SIZE=$(du -h "$BACKUP_FILE" | awk '{print $1}')
log "SUCCESS" "Database backup verified successfully: $(basename "$BACKUP_FILE") (Size: $HUMAN_SIZE)"

# 9. Retention Pruning: Delete backups older than 30 days
log "INFO" "Pruning database backups older than 30 days..."
DELETED_COUNT=$(find "$BACKUP_DIR" -type f -name "lenqredzo_*.sql.gz" -mtime +30 | wc -l)
find "$BACKUP_DIR" -type f -name "lenqredzo_*.sql.gz" -mtime +30 -delete
log "INFO" "Pruned $DELETED_COUNT expired backup(s). Remaining disk space: $(df -h "$BACKUP_DIR" | tail -n 1 | awk '{print $4 " free"}')"

log "INFO" "Database backup completed cleanly."
log "INFO" "=========================================================="
exit 0
