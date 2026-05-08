#!/usr/bin/env bash
set -euo pipefail

archive_path="${1:-}"
target_database_url="${TARGET_DATABASE_URL:-}"
health_url="${RESTORE_HEALTH_URL:-http://127.0.0.1:3000/api/health}"

if [[ -z "$archive_path" ]]; then
  echo "Usage: $0 /path/to/backup.dump" >&2
  exit 1
fi

TARGET_DATABASE_URL="$target_database_url" "$(dirname "$0")/restore-postgres.sh" "$archive_path"

DATABASE_URL="$target_database_url" npm run db:check-orphans
DATABASE_URL="$target_database_url" KAGU_BACKUP_PLAN_ACK=true npm run production:check

if command -v curl >/dev/null 2>&1; then
  curl --fail --silent "$health_url" >/dev/null
else
  echo "curl not found; skipping HTTP health probe" >&2
fi

echo "Restore smoke checks completed."
