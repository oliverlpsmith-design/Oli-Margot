#!/usr/bin/env bash
# Dump the Investor Scout MySQL database to a timestamped gzip file.
#
#   DATABASE_URL='mysql://user:pass@host:3306/db' ./scripts/backup-database.sh [dest-dir]
#
# Destination defaults to ./backups, which is gitignored. Dumps contain user
# records — keep them out of version control and off the app host.
#
# Restore with:  gunzip -c <file>.sql.gz | mysql "$DATABASE_URL"

set -euo pipefail

DEST="${1:-./backups}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set. Export it or prefix the command." >&2
  exit 1
fi

if ! command -v mysqldump >/dev/null 2>&1; then
  echo "mysqldump not found. Install the MySQL client tools." >&2
  exit 1
fi

# Parse mysql://user:password@host:port/database — password may contain
# percent-encoded characters, so decode it before handing it to mysqldump.
proto_stripped="${DATABASE_URL#mysql://}"
credentials="${proto_stripped%%@*}"
location="${proto_stripped#*@}"

DB_USER="${credentials%%:*}"
DB_PASS_RAW="${credentials#*:}"
host_port="${location%%/*}"
DB_NAME="${location#*/}"
DB_NAME="${DB_NAME%%\?*}"
DB_HOST="${host_port%%:*}"
DB_PORT="${host_port#*:}"
[[ "$DB_PORT" == "$DB_HOST" ]] && DB_PORT=3306

urldecode() { printf '%b' "${1//%/\\x}"; }
DB_PASS="$(urldecode "$DB_PASS_RAW")"

if [[ -z "$DB_NAME" ]]; then
  echo "Could not parse a database name out of DATABASE_URL." >&2
  exit 1
fi

mkdir -p "$DEST"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$DEST/investor-scout-$DB_NAME-$STAMP.sql.gz"

echo "Dumping $DB_NAME from $DB_HOST:$DB_PORT to $OUT"

# --single-transaction keeps the dump consistent without locking out a running
# nightly scan. Credentials go through the environment so they stay out of ps.
MYSQL_PWD="$DB_PASS" mysqldump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --user="$DB_USER" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  --default-character-set=utf8mb4 \
  "$DB_NAME" | gzip -9 > "$OUT"

SIZE="$(du -h "$OUT" | cut -f1)"
echo "Done: $OUT ($SIZE)"
echo "Restore with: gunzip -c '$OUT' | mysql \"\$DATABASE_URL\""
