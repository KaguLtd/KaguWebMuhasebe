# Module Parity Checklist

Bu tablo KAGU-ERP-D1 web donusumunde mevcut uygulama durumunu gosterir. `legacy/source/KAGU-ERP-D1` source of truth olarak kalir; web tarafinda master data, belge engine ve temel raporlar artik Prisma/PostgreSQL repository katmani uzerinden calisir.

| Modul | Eski Programda Var | Web'de Var | Test Var | Durum | Not |
| --- | --- | --- | --- | --- | --- |
| Login | Evet | Kismi | Hayir | Web'de Yapildi | Placeholder session var; gercek auth/roles sonraki faz |
| Ana Menu | Evet | Evet | Hayir | Web'de Yapildi | Legacy menu isimleri ve Ant Design shell tasindi |
| Dashboard | Evet | Evet | Kismi | Test Edildi | PostgreSQL dashboard snapshot ve master/belge metrikleri aktif |
| Cari Hesaplar | Evet | Evet | Evet | Test Edildi | CRUD, kod onerisi, kur kilidi, cari hareketleri ve print ekstre aktif |
| Projeler | Evet | Evet | Evet | Test Edildi | CRUD ve cari bazli proje filtreleme aktif |
| Depolar | Evet | Evet | Evet | Test Edildi | CRUD, lookup ve depo envanter raporu aktif |
| Stok ve Urun | Evet | Evet | Evet | Test Edildi | Malzeme kod onerisi, KDV default, stok hareketleri ve hareket raporu aktif |
| Alis Faturasi | Evet | Evet | Evet | Test Edildi | Draft/approve/void, ledger/stock posting ve maliyet etkisi aktif |
| Satis Faturasi | Evet | Evet | Evet | Test Edildi | Draft/approve/void, KDV/iskonto/toplam ve cari bakiyesi aktif |
| Sevk / Irsaliye | Evet | Evet | Evet | Test Edildi | Cari-proje filtresi, depo hareketi, iade yonu ve fatura link kontrolleri aktif |
| Tahsilat / Odeme | Evet | Evet | Evet | Test Edildi | Cari kur kilidi ve account ledger posting aktif |
| Virman | Evet | Evet | Evet | Test Edildi | Cikis carisi kuru, cross-rate ve dengeli borc/alacak kaydi aktif |
| Muhasebe Fisleri | Evet | Kismi | Evet | Test Edildi | Belge kaynakli ledger entries aktif; manuel fis ekrani sonraki faz |
| Raporlar | Evet | Kismi | Kismi | Web'de Yapildi | Cari ekstre, depo envanteri, malzeme hareketleri ve invoice metrics aktif |
| Ayarlar | Evet | Evet | Evet | Test Edildi | Birim, malzeme sinifi ve KDV tanimlari PostgreSQL uzerinde aktif |
| Firma Bilgileri | Belirsiz / tekrar kontrol edilmeli | Hayir | Hayir | Bekliyor | PoC adayi legacy teyidine bagli |
| Kullanici Listesi | Evet / tekrar teyit edilmeli | Hayir | Hayir | Bekliyor | Gercek auth/roles sonraki faz |

## Durum Anlamlari

- `Bekliyor`: Legacy kaniti henuz yok veya web tarafinda is baslamadi.
- `Analiz Edildi`: Legacy ekran, veri ve davranis dokumante edildi.
- `Web'de Yapildi`: Implementasyon bitti ancak legacy acceptance fixture'i eksik.
- `Test Edildi`: Domain-regression veya legacy-acceptance testi var.
- `Onaylandi`: Legacy ile davranis esitligi kullanici tarafindan kabul edildi.

## Test Yuzeyi

- `Domain regression`: `tests/parity/domain-regression/*`
  Legacy'den cikarilan is kurallari, numaralandirma ve guard davranislarini hizli regresyon olarak korur.
- `Legacy acceptance`: `tests/parity/legacy-acceptance/*`
  `legacy/**` altindaki kanit, fixture ve golden output ile calisir; bir module `Onaylandi` demek icin hedef suite budur.

## Evidence Checklist

- Moduller icin ekran/akis/hesap kurali notlari `legacy/notes/modules/*` altinda doldurulmus olmali.
- Raporlar icin kolon, siralama, toplam ve export beklentisi `legacy/notes/reports/*` altinda kayitli olmali.
- Acceptance fixture'i varsa ayni kanitin ornek veri/golden output izi `legacy/notes/PARITY_EVIDENCE_CHECKLIST.md` ile baglanmali.

## Sonraki Parity Odaklari

- PostgreSQL uzerinde gercek veriyle migration smoke testi.
- Manuel muhasebe fisi, kasa/banka ayrintilari ve kullanici yetki modeli.
- Legacy rapor ciktilari geldikce `tests/parity/legacy-acceptance` altina golden-output parity testleri.
