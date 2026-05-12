# Deployment

## Durum

- Durum: `Production guardrails active`
- Hedef domain: `muhasebe.kagultd.com`
- Runtime: Linux kiralik server uzerinde Node.js/Next.js, reverse proxy ve HTTPS arkasi
- Veritabani: PostgreSQL source of truth

## Production Guardrails

- Muhasebe verisi local dosya, Electron, SQLite veya browser state uzerinden tutulmaz; runtime API path'leri Prisma/PostgreSQL repository katmanina baglidir.
- API route'lari proxy seviyesinde session cookie olmadan 401 dondurur; public kalan route'lar sadece `/login`, `/api/health` ve sign-out akisi gibi guvenli giris/cikis noktalaridir.
- Placeholder auth production'da default olarak kapali kalir. Gecici demo icin acilacaksa `KAGU_ALLOW_PLACEHOLDER_AUTH=true` bilincli olarak verilmelidir; gercek kullanici erisimi icin auth/roles fazi tamamlanmalidir.
- Belge numarasi, registry, ledger entry, stock movement, audit ve revision yazimlari transaction tabanli repository katmaninda kalir.
- Production migration icin `prisma migrate deploy` kullanilir; serverda `migrate dev` calistirilmez.

## Required Environment

| Env | Zorunluluk | Not |
| --- | --- | --- |
| `DATABASE_URL` | Zorunlu | PostgreSQL connection string |
| `KAGU_APP_ORIGIN` veya `NEXT_PUBLIC_APP_URL` | Zorunlu | `https://muhasebe.kagultd.com` |
| `AUTH_SECRET`, `KAGU_SESSION_SECRET` veya `SESSION_SECRET` | Zorunlu | Gercek auth/session fazi icin uzun random secret |
| `KAGU_BACKUP_PLAN_ACK=true` | Zorunlu | Sadece backup/restore planlari yazildiktan sonra true yapilir |
| `KAGU_ALLOW_PLACEHOLDER_AUTH` | Varsayilan false | Production'da true olmamali |

## Release Checklist

- Repo root'unda `npm run evidence:refresh`
- Repo root'unda `npm run verify`
- Repo root'unda `npm run production:check`
- `npx prisma migrate deploy`
- Ilk admin hesabi gerekiyorsa `First admin bootstrap` adimini calistir.
- `/api/health` response `status: "ok"` donmeli.
- Reverse proxy HTTPS, request size limiti, gzip/brotli ve timeout ayarlari kontrol edilmeli.
- Backup ve restore testi yapilmadan canli muhasebe verisi alinmamali.
- Runbook referansi: `docs/BACKUP_RESTORE.md`

## First Admin Bootstrap

```bash
cd apps/muhasebe-web

DATABASE_URL="postgresql://..." \
ADMIN_USERNAME="admin" \
ADMIN_PASSWORD="your-password" \
ADMIN_FULL_NAME="Admin" \
npm run admin:bootstrap
```

Script sifreyi log'a yazmaz; sadece ADMIN rolunu, sistem permission kayitlarini
ve aktif ADMIN kullanicisini hazirlar.

## Workflow Contract

- Workflow dosyasi: `.github/workflows/docs-devops.yml`
- Tetikleyiciler: `push`, `pull_request`, `workflow_dispatch`
- Yuzey: root `README.md`, root `package.json`, `scripts/README.md`, `docs/**`,
  `tests/parity/README.md`, `apps/muhasebe-web/README.md`, workflow dosyalari
- Sira:
  1. `npm ci --prefix apps/muhasebe-web`
  2. `npm run evidence:refresh`
  3. `npm run verify`
  4. `npm run production:check`
- Workflow `docs/LEGACY_INVENTORY.md` ve `docs/LEGACY_READYNESS.md`
  snapshot'larini `legacy-evidence` artifact'i olarak saklar.
- Workflow'daki `production:check`, gercek deploy yapmaz; yalnizca env contract'inin
  eksik olmadigini dogrular.
- Bu workflow bilerek docs/devops contract gate'idir; tam uygulama release gate'i
  olarak `lint`, `typecheck`, `build` sonucunu temsil etmez.

## Health Endpoint

- `/api/health` PostgreSQL baglantisini ve runtime readiness check'lerini dondurur.
- Production'da eksik secret/origin/backup acknowledgement veya DB baglanti hatasi varsa HTTP 503 dondurur.
- Endpoint secret degeri veya connection string dondurmez.

## Rollout Notlari

- Ilk canli deploy oncesi staging/preview PostgreSQL uzerinde migration ve belge onay smoke testi yapilacak.
- Server restart sonrasi belge numarasi kaldigi yerden devam etmeli.
- Ayni anda iki belge onayi numara cakistirmamali; bunun kaynagi DB transaction ve registry unique constraint'idir.
- Gercek auth/roles gelmeden domain herkese acik hale getirilmeyecek.

## CI Icinde Beklenen Env

`npm run production:check` icin CI tarafinda asagidaki minimum contract verilir:

| Env | Deger Tipi | Amaç |
| --- | --- | --- |
| `DATABASE_URL` | Dummy PostgreSQL URL | Source of truth DB zorunlulugunu kontrol eder |
| `AUTH_SECRET` | Dummy secret | Session secret guardrail'i |
| `KAGU_APP_ORIGIN` | HTTPS origin | Public origin guardrail'i |
| `KAGU_BACKUP_PLAN_ACK` | `true` | Backup/restore acknowledgement guardrail'i |

Bu env'ler sadece contract check icindir; canli ortamin gercek secret ve adreslerini
temsil etmez.
