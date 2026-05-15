# KaguWebMuhasebe

KaguWebMuhasebe, KAGU icin bagimsiz web tabanli operasyon panelidir. Uygulama cari, proje, stok, irsaliye, fatura, tahsilat/odeme, virman ve proje bazli malzeme takibi akislarini tek bir web yuzeyinde toplar.

## Kapsam

- Cari hesap ve proje baglantili hareket takibi
- Depo, malzeme ve stok hareketi gorunurlugu
- Irsaliye, fatura, tahsilat/odeme ve virman akislari
- Proje bazli malzeme kullanimi ve operasyon raporlari
- PostgreSQL tabanli veri modeli, oturum, rol ve production guardrail'leri

## Kapsam Disi

- Resmi muhasebe ve beyanname uretimi
- E-defter, e-fatura ve tam yasal raporlama
- Tam kur cevrimi, PITR/HA ve full project P&L

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

## Dokumanlar

- Acceptance test plani: [docs/ACCEPTANCE_TEST_PLAN.md](docs/ACCEPTANCE_TEST_PLAN.md)
- Deployment: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- Backup ve restore: [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md)
- Veri modeli: [docs/DATA_MODEL.md](docs/DATA_MODEL.md)
- Dokuman indeksi: [docs/INDEX.md](docs/INDEX.md)
