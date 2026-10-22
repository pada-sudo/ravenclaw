#!/usr/bin/env sh
# Backup RavenClaw SQLite database.
# Usage: ./scripts/backup.sh [target_directory]
# Produces a timestamped backup file and runs WAL checkpoint before copying.

set -eu

DATA_DIR="${DATA_DIR:-./data}"
BACKUP_DIR="${1:-./backups}"
DB_NAME="${DB_NAME:-ddp.sqlite}"
DB_PATH="${DATA_DIR}/${DB_NAME}"

if [ ! -f "${DB_PATH}" ]; then
  echo "Database not found: ${DB_PATH}" >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"
TS=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_FILE="${BACKUP_DIR}/ravenclaw-${TS}.sqlite"

echo "Checkpointing WAL and creating backup: ${BACKUP_FILE}"

# Use sqlite3 CLI if available; otherwise fall back to Node.
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "${DB_PATH}" "PRAGMA wal_checkpoint(TRUNCATE);" ".backup '${BACKUP_FILE}'"
else
  node - "${DB_PATH}" "${BACKUP_FILE}" <<'EOF'
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const [src, dst] = process.argv.slice(2);
const db = new DatabaseSync(src);
db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
db.exec(`VACUUM INTO '${dst}'`);
console.log(`Backup written to ${dst}`);
EOF
fi

echo "Backup complete: ${BACKUP_FILE}"
