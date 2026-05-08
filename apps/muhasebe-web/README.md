# Muhasebe Web Uygulamasi

Bu uygulama, kucuk ve orta olcekli firmalar icin `cari hesap`, `stok`,
`irsaliye`, `fatura`, `tahsilat/odeme` ve `proje bazli hareket takibi` saglayan
mini muhasebe/operasyon panelinin Next.js uygulamasidir.

Urun siniri bilincli olarak dardir: resmi `genel muhasebe`, `beyanname`,
`mizan`, `bilanco` ve tam yasal raporlama hedeflenmez.

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
NEXT_PUBLIC_APP_NAME="KAGU Muhasebe Web"
```

Production guardrail'leri ve backup acknowledgement ayrintisi icin
[docs/DEPLOYMENT.md](/C:/Users/ahmet/OneDrive/Belgeler/New%20project%202/docs/DEPLOYMENT.md)
ile [docs/BACKUP_RESTORE.md](/C:/Users/ahmet/OneDrive/Belgeler/New%20project%202/docs/BACKUP_RESTORE.md)
dosyalarina bakin.

## Sinirlar ve Non-Goals

- Legacy parity tamamlanmis kabul edilmez
- Approximate invoice margin veya proje brut marji, tam muhasebesel karlilik degildir
- Mixed currency konsolidasyonu ancak acik FX politikasi tanimlandiginda eklenmelidir

## Devam Dokumanlari

- Veri modeli: [docs/DATA_MODEL.md](/C:/Users/ahmet/OneDrive/Belgeler/New%20project%202/docs/DATA_MODEL.md)
- Rapor durumu: [docs/REPORTS_PARITY.md](/C:/Users/ahmet/OneDrive/Belgeler/New%20project%202/docs/REPORTS_PARITY.md)
- Migration ve parity notlari: [docs/INDEX.md](/C:/Users/ahmet/OneDrive/Belgeler/New%20project%202/docs/INDEX.md)
