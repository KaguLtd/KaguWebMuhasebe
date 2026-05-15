# Reports Status

Bu dokuman KaguWebMuhasebe rapor yuzeylerinin mevcut durumunu ozetler.

| Rapor | Durum | Test/Kabul |
| --- | --- | --- |
| Dashboard satis ozetleri | Aktif | Regression ve build kontrolleri |
| Stok toplam degeri | Aktif | Regression |
| Depo envanteri | Aktif | `warehouse-inventory-regression.test.mjs` |
| Malzeme hareketleri | Aktif | Local acceptance |
| Cari ekstre | Aktif | Local acceptance |
| Proje malzeme kullanimi | Aktif | Local acceptance |
| Proje faturalari | Aktif | Local acceptance |
| Tahmini proje marji | Aktif | Local acceptance |

## Rapor Ilkeleri

- Raporlar yalnizca effective belge, stok hareketi ve ledger kayitlarini kullanir.
- Iptal veya revizyon sonrasi etkisiz kayitlar operasyon raporlarina toplam olarak yansimaz.
- Yeni rapor davranislari icin once urun acceptance senaryosu, sonra regression testi eklenir.
