#!/usr/bin/env sh
# Restore RavenClaw SQLite database from a backup file.
# Usage: ./scripts/restore.sh <backup_file> [target_directory]
# The current database is moved to <db>.pre-restore-<timestamp> before restore.

set -eu

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <backup_file> [target_directory]" >&2
  exit 1
fi

BACKUP_FILE="$1"
DATA_DIR="${2:-./data}"
DB_NAME="${DB_NAME:-ddp.sqlite}"
DB_PATH="${DATA_DIR}/${DB_NAME}"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

mkdir -p "${DATA_DIR}"
TS=$(date -u +%Y%m%dT%H%M%SZ)

if [ -f "${DB_PATH}" ]; then
  mv "${DB_PATH}" "${DB_PATH}.pre-restore-${TS}"
fi

# Copy backup to live location so the original backup remains untouched.
cp "${BACKUP_FILE}" "${DB_PATH}"

echo "Restored ${BACKUP_FILE} -> ${DB_PATH}"
echo "Previous database (if any) preserved as ${DB_PATH}.pre-restore-${TS}"

# Validate the restored database can be opened.
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "${DB_PATH}" "PRAGMA quick_check;"
else
  node - "${DB_PATH}" <<'EOF'
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(process.argv[2]);
const row = db.prepare('PRAGMA quick_check').get();
console.log(row['quick_check']);
EOF
fi
