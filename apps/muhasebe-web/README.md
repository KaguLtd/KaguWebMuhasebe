# Muhasebe Web Uygulamasi

Bu uygulama KaguWebMuhasebe urununun Next.js web panelidir. Cari, proje, stok, irsaliye, fatura, tahsilat/odeme, virman ve proje bazli malzeme takibi icin operasyonel bir yuzey saglar.

Urun siniri bilincli olarak dardir: resmi genel muhasebe, beyanname, e-defter, e-fatura ve tam yasal raporlama hedeflenmez.

## Uygulama Yuzeyi

- App Router tabanli Next.js uygulamasi
- Prisma/PostgreSQL source of truth
- Oturum, rol ve yetki temeli
- Master data yonetimi
- Belge taslak/onay/iptal akislari
- Dashboard ve operasyon raporlari
- Period lock ve admin/settings yuzeyleri

## Gelistirme

```bash
npm run dev
```

Repo root'undan ayni akisi calistirmak icin:

```bash
npm run dev
```

Yerel dogrulama:

```bash
npm run test
npm run build
npm run verify
npm run production:check
```

## Ortam Degiskenleri

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/kagu_muhasebe?schema=public"
NEXT_PUBLIC_APP_NAME="KaguWebMuhasebe"
```

Production guardrail'leri ve backup acknowledgement ayrintisi icin [docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md) ile [docs/BACKUP_RESTORE.md](../../docs/BACKUP_RESTORE.md) dosyalarina bakin.

## Devam Dokumanlari

- Veri modeli: [docs/DATA_MODEL.md](../../docs/DATA_MODEL.md)
- Acceptance test plani: [docs/ACCEPTANCE_TEST_PLAN.md](../../docs/ACCEPTANCE_TEST_PLAN.md)
- Deployment: [docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md)
