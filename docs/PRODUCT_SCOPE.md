# Product Scope

KaguWebMuhasebe, KAGU icin bagimsiz web tabanli operasyon panelidir. Amac cari, proje, stok, irsaliye, fatura, tahsilat/odeme, virman ve proje bazli malzeme takip sureclerini tek bir web uygulamasinda izlenebilir hale getirmektir.

## Kapsam

- Cari hesap ve cari bakiyesi takibi
- Proje kayitlari ve projeye bagli operasyon gorunurlugu
- Depo, malzeme, birim, sinif ve KDV referanslari
- Giris/cikis irsaliyesi, iade ve birlestirme/cozme akislarinin izlenmesi
- Satis ve alis faturasi operasyonlari
- Tahsilat, odeme ve virman belgeleri
- Proje bazli malzeme kullanimi ve temel operasyon raporlari
- Admin, rol, oturum ve donem kilidi kontrolleri

## Kapsam Disi

- Resmi muhasebe sistemi
- Beyanname, e-defter, e-fatura ve tam yasal raporlama
- Tam finansal konsolidasyon, PITR/HA ve kapsamli project P&L

## Kabul Yaklasimi

- Teknik dogrulama `npm run prisma:generate`, `npm run prisma:validate`, `npm run typecheck`, `npm run lint`, `npm run test` ve `npm run build` ile yapilir.
- Manuel local acceptance senaryolari [ACCEPTANCE_TEST_PLAN.md](ACCEPTANCE_TEST_PLAN.md) uzerinden yurur.
- Urun davranisi icin otomatik kontroller `tests/regression` ve `apps/muhasebe-web/tests` altinda tutulur.
