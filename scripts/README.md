# Scripts

Bu klasor workspace seviyesindeki operasyon, backup, restore ve local acceptance yardimci scriptlerini tutar.

## Root Komut Contract

Bu komutlar repo root'undan calistirilir:

| Komut | Amac |
| --- | --- |
| `npm run dev` | `apps/muhasebe-web` gelistirme sunucusunu baslatir |
| `npm run lint` | Web uygulamasi lint kontrolu |
| `npm run typecheck` | Web uygulamasi TypeScript kontrolu |
| `npm run test` | App ve urun regression testlerini calistirir |
| `npm run build` | Web uygulamasi production build'i |
| `npm run verify` | Prisma, typecheck, lint, test ve build zinciri |
| `npm run production:check` | Production env guardrail kontrolu |
| `npm run seed:dev` | Yerel gelistirme verisi yukler |
| `npm run admin:bootstrap` | Admin kullanicisini hazirlar |
| `npm run db:check-orphans` | Veritabani orphan kontrolu |

## Backup Ve Restore Scriptleri

| Script | Amac |
| --- | --- |
| `./scripts/backup-postgres.sh` | `pg_dump -Fc`, checksum ve manifest ureterek gecelik backup alir |
| `./scripts/restore-postgres.sh /path/to/archive.dump` | hedef veritabanina manuel restore yapar |
| `./scripts/restore-smoke.sh /path/to/archive.dump` | restore sonrasi orphan, readiness ve health smoke kontrolu calistirir |
| `./scripts/windows-local-acceptance.ps1` | Windows uzerinde izole local acceptance ortamlarini yonetir |

Detayli runbook icin [docs/BACKUP_RESTORE.md](../docs/BACKUP_RESTORE.md) dosyasina bakin.

## Workflow Kullanimi

- `.github/workflows/docs-devops.yml` Prisma, typecheck, lint, test, build ve production readiness adimlarini calistirir.
- Root contract degistiginde bu dosya, root `README.md` ve `docs/DEPLOYMENT.md` birlikte guncellenmelidir.
