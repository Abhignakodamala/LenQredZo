#!/usr/bin/env bash
# ==============================================================================
#   LENQREDZO AUTOMATED BACKUP CRON INSTALLER
#   Sets up daily 02:00 AM automated backup with instant failure email alerts.
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================================="
echo "   🛡️ SETTING UP LENQREDZO AUTOMATED BACKUP SYSTEM        "
echo "=========================================================="

# 1. Ensure scripts are executable
chmod +x "$SCRIPT_DIR/backup-db.sh"
chmod +x "$SCRIPT_DIR/restore-db.sh"

# 2. Ensure directories exist
mkdir -p "$BASE_DIR/backups/db"

# 3. Create or update cron job in /etc/cron.d/lenqredzo-backup
CRON_FILE="/etc/cron.d/lenqredzo-backup"
echo "# LenQredzo Daily Automated Database Backup at 02:00 AM" > "$CRON_FILE"
echo "0 2 * * * root $SCRIPT_DIR/backup-db.sh >> $BASE_DIR/backups/backup.log 2>&1" >> "$CRON_FILE"
chmod 644 "$CRON_FILE"

echo "✅ Cron schedule configured: Runs every day at 02:00 AM (server time)"
echo "   Cron file: $CRON_FILE"
echo "   Log file:  $BASE_DIR/backups/backup.log"
echo "   Store:     $BASE_DIR/backups/db/"

# 4. Trigger an immediate test backup now to verify everything works
echo ""
echo "🚀 Running an immediate verification backup to test system..."
"$SCRIPT_DIR/backup-db.sh"

echo ""
echo "📊 Current Backups in Storage:"
ls -lh "$BASE_DIR/backups/db/"

echo ""
echo "=========================================================="
echo "   ✅ AUTOMATED BACKUP SYSTEM IS FULLY ACTIVE & RUNNING!  "
echo "=========================================================="
