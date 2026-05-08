#!/usr/bin/env bash
set -euo pipefail

timestamp="$(date -u +"%Y%m%dT%H%M%SZ")"
backup_root="${BACKUP_ROOT:-./backups/postgres}"
app_version="${APP_VERSION:-$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")}"
database_url="${DATABASE_URL:?DATABASE_URL is required}"
offsite_target="${OFFSITE_BACKUP_DIR:-}"

mkdir -p "$backup_root"

base_name="kagu-postgres-${timestamp}"
archive_path="${backup_root}/${base_name}.dump"
checksum_path="${archive_path}.sha256"
manifest_path="${backup_root}/${base_name}.manifest"

pg_dump -Fc --no-owner --no-privileges --dbname="$database_url" --file="$archive_path"

if [[ ! -s "$archive_path" ]]; then
  echo "Backup archive is empty: $archive_path" >&2
  exit 1
fi

sha256sum "$archive_path" > "$checksum_path"

archive_size="$(wc -c < "$archive_path" | tr -d ' ')"
cat > "$manifest_path" <<EOF
timestamp=${timestamp}
archive_path=${archive_path}
archive_size_bytes=${archive_size}
app_version=${app_version}
database_url_redacted=$(printf '%s' "$database_url" | sed -E 's#(://)[^:@/]+(:[^@/]+)?@#\1***:***@#')
EOF

if [[ -n "$offsite_target" ]]; then
  mkdir -p "$offsite_target"
  cp "$archive_path" "$checksum_path" "$manifest_path" "$offsite_target/"
fi

echo "Backup completed: $archive_path"
