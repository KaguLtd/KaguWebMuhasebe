# KAGU Mini Muhasebe / Operasyon Paneli

Bu repo, kucuk ve orta olcekli firmalar icin `cari hesap`, `stok`, `irsaliye`,
`fatura`, `tahsilat/odeme` ve `proje bazli hareket takibi` sunan mini
muhasebe/operasyon panelinin web uygulama kodunu icerir.

Bu urun bilincli olarak dar kapsamli konumlanir. `Genel muhasebe`,
`beyanname`, `mizan`, `bilanco` ve tam yasal raporlama uretimi hedeflenmez.

## Kapsam

- Cari hesap ve proje baglantili hareket takibi
- Depo, malzeme ve stok hareketi gorunurlugu
- Irsaliye, fatura, tahsilat/odeme ve virman akislari
- Proje bazli operasyon raporlari
- PostgreSQL tabanli veri modeli, oturum ve production guardrail'leri

## Sinirlar

- Legacy masaustu uygulama parity'si tamamlanmis kabul edilmez
- `production:check` ve test varligi tek basina production-ready iddiasi degildir
- Tam kur cevrimi, PITR/HA ve full project P&L bu fazin disindadir

## Mevcut Durum

- `apps/muhasebe-web` altinda calisan Next.js uygulamasi bulunur
- Prisma/PostgreSQL veri modeli, master data, belge akislari ve temel raporlar aktiftir
- Yetki, oturum, period lock ve deployment guardrail'leri vardir
- Legacy evidence ve parity dokumanlari `docs/` altinda tutulur

## Klasorler

- `apps/muhasebe-web`: uygulama, API route'lari ve UI
- `docs`: veri modeli, deployment, parity ve operasyon notlari
- `scripts`: operasyon, migration ve destek script'leri
- `tests/parity`: parity ve regresyon testleri
- `legacy`: referans masaustu kaynaklari ve evidence alani

## Hizli Baslangic

```bash
npm run dev
```

Yerel referans veri yuklemek icin:

```bash
npm run seed:dev
```

Temel kontrol zinciri:

```bash
npm run verify
npm run production:check
```

## Operasyon Notlari

- Backup ve restore runbook'u: [docs/BACKUP_RESTORE.md](/C:/Users/ahmet/OneDrive/Belgeler/New%20project%202/docs/BACKUP_RESTORE.md)
- Deployment guardrail'leri: [docs/DEPLOYMENT.md](/C:/Users/ahmet/OneDrive/Belgeler/New%20project%202/docs/DEPLOYMENT.md)
- Dokuman haritasi: [docs/INDEX.md](/C:/Users/ahmet/OneDrive/Belgeler/New%20project%202/docs/INDEX.md)
- Script katalogu: [scripts/README.md](/C:/Users/ahmet/OneDrive/Belgeler/New%20project%202/scripts/README.md)

## Legacy ve Parity

Bu repo legacy masaustu urunden gelen akislari referans alir, ancak legacy kanit
olmadan tam parity vaadi vermez. Evidence snapshot'lari ilerlemeyi gosterir;
tek basina kabul kriteri yerine gecmez.
