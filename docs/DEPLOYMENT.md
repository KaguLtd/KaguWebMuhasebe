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

- `npm run verify`
- `npm run production:check`
- `npx prisma migrate deploy`
- `/api/health` response `status: "ok"` donmeli.
- Reverse proxy HTTPS, request size limiti, gzip/brotli ve timeout ayarlari kontrol edilmeli.
- Backup ve restore testi yapilmadan canli muhasebe verisi alinmamali.

## Health Endpoint

- `/api/health` PostgreSQL baglantisini ve runtime readiness check'lerini dondurur.
- Production'da eksik secret/origin/backup acknowledgement veya DB baglanti hatasi varsa HTTP 503 dondurur.
- Endpoint secret degeri veya connection string dondurmez.

## Rollout Notlari

- Ilk canli deploy oncesi staging/preview PostgreSQL uzerinde migration ve belge onay smoke testi yapilacak.
- Server restart sonrasi belge numarasi kaldigi yerden devam etmeli.
- Ayni anda iki belge onayi numara cakistirmamali; bunun kaynagi DB transaction ve registry unique constraint'idir.
- Gercek auth/roles gelmeden domain herkese acik hale getirilmeyecek.
