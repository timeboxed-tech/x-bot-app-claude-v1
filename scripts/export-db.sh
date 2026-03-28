#!/usr/bin/env bash
set -euo pipefail

# Export entire PostgreSQL database (schema + data) to a local dump file.
# Usage: ./scripts/export-db.sh <source_jdbc_url> [output_file]
#
# Example:
#   ./scripts/export-db.sh "jdbc:postgresql://user:pass@host:5432/dbname"
#   ./scripts/export-db.sh "jdbc:postgresql://user:pass@host:5432/dbname" my_backup.sql

if [ $# -lt 1 ]; then
  echo "Usage: $0 <source_jdbc_url> [output_file]"
  echo "  URL should be JDBC format: jdbc:postgresql://user:pass@host:port/dbname"
  echo "  Output defaults to: db_export_YYYY-MM-DD_HHMMSS.sql"
  exit 1
fi

SOURCE_JDBC="$1"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
OUTPUT_FILE="${2:-db_export_${TIMESTAMP}.sql}"

# Parse JDBC URL into pg connection string
parse_jdbc() {
  local jdbc="$1"
  echo "$jdbc" | sed 's|^jdbc:||'
}

SOURCE_URL=$(parse_jdbc "$SOURCE_JDBC")

echo "=== Database Export ==="
echo "Source: ${SOURCE_URL%%@*}@***"
echo "Output: $OUTPUT_FILE"
echo ""

echo "Dumping database..."
pg_dump --no-owner --no-acl "$SOURCE_URL" > "$OUTPUT_FILE"

FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
echo "Done. Exported to: $OUTPUT_FILE ($FILE_SIZE)"
