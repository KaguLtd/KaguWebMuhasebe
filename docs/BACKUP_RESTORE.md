# Backup And Restore

## MVP Hedefi

- `RPO <= 24 saat`
- `RTO <= 4 saat`
- Kurtarma modu: manuel restore + smoke dogrulama

Bu repo su an point-in-time recovery veya automatic failover vadetmez. Bu runbook,
kucuk/orta olcekli kullanim icin minimum guvenli operasyon disiplini tanimlar.

## Artefaktlar

- `scripts/backup-postgres.sh`
- `scripts/restore-postgres.sh`
- `scripts/restore-smoke.sh`

## Gecelik Backup

```bash
DATABASE_URL="postgresql://..." \
BACKUP_ROOT="/var/backups/kagu/postgres" \
OFFSITE_BACKUP_DIR="/mnt/offsite/kagu/postgres" \
./scripts/backup-postgres.sh
```

Beklenen sonuc:

- `.dump` dosyasi olusur
- `.sha256` checksum olusur
- `.manifest` olusur
- Off-host kopya basariliysa ayni dosyalar ikinci hedefe yazilir

Retention onerisi:

- `7` gunluk dump
- `4` haftalik off-host kopya
- Her `prisma migrate deploy` oncesi ek ad-hoc backup

## Manuel Restore

```bash
TARGET_DATABASE_URL="postgresql://.../kagu_restore" \
./scripts/restore-postgres.sh /var/backups/kagu/postgres/kagu-postgres-YYYYMMDDTHHMMSSZ.dump
```

Kurallar:

- Restore her zaman ayri bir hedef veritabanina yapilir
- `TARGET_DATABASE_URL`, production `DATABASE_URL` ile ayni olamaz
- Checksum varsa restore oncesi dogrulanir

## Haftalik Restore Drill

```bash
TARGET_DATABASE_URL="postgresql://.../kagu_restore" \
RESTORE_HEALTH_URL="http://127.0.0.1:3000/api/health" \
./scripts/restore-smoke.sh /var/backups/kagu/postgres/kagu-postgres-YYYYMMDDTHHMMSSZ.dump
```

Smoke adimlari:

- archive restore
- `npm run db:check-orphans`
- `npm run production:check`
- varsa health endpoint probe

## Linux Scheduler Ornegi

`/etc/systemd/system/kagu-postgres-backup.service`

```ini
[Unit]
Description=KAGU PostgreSQL backup

[Service]
Type=oneshot
WorkingDirectory=/srv/kagu
Environment=DATABASE_URL=postgresql://...
Environment=BACKUP_ROOT=/var/backups/kagu/postgres
Environment=OFFSITE_BACKUP_DIR=/mnt/offsite/kagu/postgres
ExecStart=/srv/kagu/scripts/backup-postgres.sh
```

`/etc/systemd/system/kagu-postgres-backup.timer`

```ini
[Unit]
Description=Run KAGU PostgreSQL backup nightly

[Timer]
OnCalendar=*-*-* 02:15:00
Persistent=true

[Install]
WantedBy=timers.target
```

Alternatif cron:

```cron
15 2 * * * cd /srv/kagu && DATABASE_URL="postgresql://..." BACKUP_ROOT="/var/backups/kagu/postgres" OFFSITE_BACKUP_DIR="/mnt/offsite/kagu/postgres" ./scripts/backup-postgres.sh
```

## Operasyon Kurallari

- Production veritabanina yalnizca admin/operator erisimi olmali
- Backup dosyasinin acilabildigi restore drill ile kanitlanmali
- `KAGU_BACKUP_PLAN_ACK=true` ancak bu runbook aktif kullaniliyorsa verilmelidir
- Restore test sonucu, tarih ve operator bilgisi ayri bir operasyon kaydinda tutulmalidir
