#!/usr/bin/env bash
set -euo pipefail

# Migrate entire PostgreSQL database from source to destination.
# Usage: ./scripts/migrate-db.sh <source_jdbc_url> <destination_jdbc_url>
#
# Example:
#   ./scripts/migrate-db.sh \
#     "jdbc:postgresql://user:pass@src-host:5432/dbname" \
#     "jdbc:postgresql://user:pass@dst-host:5432/dbname"

if [ $# -ne 2 ]; then
  echo "Usage: $0 <source_jdbc_url> <destination_jdbc_url>"
  echo "  URLs should be JDBC format: jdbc:postgresql://user:pass@host:port/dbname"
  exit 1
fi

SOURCE_JDBC="$1"
DEST_JDBC="$2"

# Parse JDBC URL into pg connection string
# jdbc:postgresql://user:pass@host:port/dbname -> postgresql://user:pass@host:port/dbname
parse_jdbc() {
  local jdbc="$1"
  echo "$jdbc" | sed 's|^jdbc:||'
}

SOURCE_URL=$(parse_jdbc "$SOURCE_JDBC")
DEST_URL=$(parse_jdbc "$DEST_JDBC")

echo "=== Database Migration ==="
echo "Source: ${SOURCE_URL%%@*}@***"
echo "Dest:   ${DEST_URL%%@*}@***"
echo ""

read -p "This will OVERWRITE the destination database. Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "[1/3] Dumping source database..."
pg_dump --no-owner --no-acl --clean --if-exists "$SOURCE_URL" > /tmp/db_migration_dump.sql
echo "  Done. Dump size: $(du -h /tmp/db_migration_dump.sql | cut -f1)"

echo "[2/3] Restoring to destination database..."
psql "$DEST_URL" < /tmp/db_migration_dump.sql 2>&1 | tail -5
echo "  Done."

echo "[3/3] Cleaning up..."
rm -f /tmp/db_migration_dump.sql

echo ""
echo "Migration complete."
