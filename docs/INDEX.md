# KaguWebMuhasebe Documentation Index

Bu indeks KaguWebMuhasebe urun dokumantasyonunun ana girisidir. Dokumanlar cari, proje, stok, irsaliye, fatura ve operasyon takibi yapan bagimsiz web panelinin kapsam, kabul, veri modeli ve canliya alma sureclerini anlatir.

## Ana Dokumanlar

| Dokuman | Amac |
| --- | --- |
| [PRODUCT_SCOPE.md](PRODUCT_SCOPE.md) | Urun kapsami, kapsam disi alanlar ve operasyonel sinirlar |
| [DATA_MODEL.md](DATA_MODEL.md) | PostgreSQL/Prisma veri modeli ve repository katmani notlari |
| [DELIVERY_INVOICE_WORKFLOW_PLAN.md](DELIVERY_INVOICE_WORKFLOW_PLAN.md) | Irsaliye ve fatura akisi plan notlari |
| [ACCEPTANCE_TEST_PLAN.md](ACCEPTANCE_TEST_PLAN.md) | Teknik ve manuel local acceptance akisi |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Production guardrail'leri ve release checklist |
| [BACKUP_RESTORE.md](BACKUP_RESTORE.md) | Backup, restore ve smoke test runbook'u |

## Destek Dokumanlari

| Dokuman | Amac |
| --- | --- |
| [PRODUCT_MODULE_STATUS.md](PRODUCT_MODULE_STATUS.md) | Modul durumlari ve test yuzeyleri |
| [UI_NOTES.md](UI_NOTES.md) | Canli uygulama UI notlari |
| [REPORTS_STATUS.md](REPORTS_STATUS.md) | Rapor yuzeyi durum notlari |

## Kullanim

- Local acceptance icin [ACCEPTANCE_TEST_PLAN.md](ACCEPTANCE_TEST_PLAN.md) izlenir.
- Canliya alma ve ortam kontrati icin [DEPLOYMENT.md](DEPLOYMENT.md) izlenir.
- Veri modeli degisiklikleri icin [DATA_MODEL.md](DATA_MODEL.md) ve app icindeki Prisma dosyalari birlikte kontrol edilir.
