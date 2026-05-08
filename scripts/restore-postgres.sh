#!/usr/bin/env bash
set -euo pipefail

archive_path="${1:-}"
target_database_url="${TARGET_DATABASE_URL:-}"

if [[ -z "$archive_path" ]]; then
  echo "Usage: $0 /path/to/backup.dump" >&2
  exit 1
fi

if [[ ! -f "$archive_path" ]]; then
  echo "Backup archive not found: $archive_path" >&2
  exit 1
fi

if [[ -z "$target_database_url" ]]; then
  echo "TARGET_DATABASE_URL is required" >&2
  exit 1
fi

if [[ "$target_database_url" == "${DATABASE_URL:-}" ]]; then
  echo "TARGET_DATABASE_URL must not match DATABASE_URL" >&2
  exit 1
fi

checksum_path="${archive_path}.sha256"

if [[ -f "$checksum_path" ]]; then
  sha256sum --check "$checksum_path"
fi

pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname="$target_database_url" \
  "$archive_path"

echo "Restore completed into target database."
