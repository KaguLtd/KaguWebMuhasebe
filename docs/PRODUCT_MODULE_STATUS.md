# Product Module Status

Bu tablo KaguWebMuhasebe icindeki ana modul yuzeylerinin mevcut durumunu ozetler.

| Modul | UI | API/Repository | Test Yuzeyi | Not |
| --- | --- | --- | --- | --- |
| Cari Hesaplar | Aktif | Aktif | Regression | Cari tipi, doviz kilidi ve ekstre akislarini kapsar |
| Projeler | Aktif | Aktif | Regression | Cari baglantili proje filtreleri korunur |
| Depolar | Aktif | Aktif | Regression | Envanter ve hareket gorunurlugu vardir |
| Malzemeler | Aktif | Aktif | Regression | Birim, sinif, KDV ve stok hareketleri izlenir |
| Irsaliye | Aktif | Aktif | Regression + local acceptance | Taslak, onay, iptal, revizyon, birlestirme ve cozme akislarini kapsar |
| Fatura | Aktif | Aktif | Regression + local acceptance | Satis/alis, irsaliye aktarimi ve stok/cari etkilerini kapsar |
| Tahsilat/Odeme | Aktif | Aktif | Regression | Cari ledger etkileri izlenir |
| Virman | Aktif | Aktif | Regression | Cari arasi aktarim ve capraz kur guardrail'i vardir |
| Proje Raporlari | Aktif | Aktif | Local acceptance | Malzeme kullanimi, fatura ve tahmini marj raporlari bulunur |
| Ayarlar/Admin | Aktif | Aktif | App tests | Kullanici, rol, donem kilidi ve referans kayitlari bulunur |

## Test Stratejisi

- `tests/regression` urun davranislarinin bozulmadigini kontrol eder.
- `apps/muhasebe-web/tests` route guard, auth ve runtime regressions testlerini kapsar.
- Manuel kabul senaryolari [ACCEPTANCE_TEST_PLAN.md](ACCEPTANCE_TEST_PLAN.md) uzerinden yurur.
