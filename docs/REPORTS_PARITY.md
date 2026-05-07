# Reports Parity

## Durum

- Durum: `Kismi`
- Source of truth: `legacy/source/KAGU-ERP-D1`
- Kural: Muhasebesel toplamlar minor-unit integer ve basis-point oran mantigiyla hesaplanir; raporlar PostgreSQL repository kaynaklidir.
- Test yuzeyi: `tests/parity/domain-regression` rapor kurallarini korur, `tests/parity/legacy-acceptance` ise fixture + golden output kabulunu yapar.

## Aktif Raporlar

| Rapor Alani | Web Durumu | Not |
| --- | --- | --- |
| Dashboard satis toplamlari | Aktif | Etkili/onayli satis faturalarindan gunluk/haftalik/aylik currency bazli toplam |
| Dashboard stok degeri | Aktif | Etkili stok hareketlerinden miktar, son alis faturasi veya inbound irsaliye maliyetiyle degerleme |
| Cari ekstre | Aktif | Etkili account ledger entries uzerinden borc/alacak/bakiye ve tarih araligi |
| Cari ekstre PDF | Aktif | Print-friendly sayfa; tarayici yazdir/PDF kaydet akisi |
| Depo envanteri | Aktif | Etkili stock movements uzerinden depo ve malzeme miktarlari |
| Malzeme hareketleri | Aktif | Etkili stock movements uzerinden malzeme bazli giris/cikis |
| Fatura metrikleri | Aktif | Net/brut, bagli irsaliye tarihine gore yaklasik maliyet, kar ve marj hesaplari |
| KDV, mizan, kasa/banka detay raporlari | Bekliyor | Legacy cikti ornekleriyle sonraki fazda genisletilecek |

## Acceptance Kaniti

| Rapor | Kanit | Test |
| --- | --- | --- |
| Depo envanteri / stok raporu | `legacy/notes/reports/stok-raporu.md` ve `legacy/source/KAGU-ERP-D1/src/main/services.ts#getWarehouseInventory` | `tests/parity/legacy-acceptance/warehouse-inventory-golden.test.mjs` |

## Parity Riskleri

- Legacy rapor ciktilari gelmeden kolon sirasi ve export dosya adi tam onayli sayilmaz.
- Dashboard stok degeri artik prototip ile ayni sekilde purchase invoice ve inbound delivery cost adaylarini birlikte siralar; outbound/iade maliyetleri degerlemeye girmez.
- Fatura karliligi tam maliyet muhasebesi degil, operasyonel yaklasik karlilik icindir; bagli irsaliye tarihi bazli son satin alma maliyetini kullanir.
- Server-side PDF dependency eklenmedi; secilen yol tarayici print/PDF akisi.

## Sonraki Kanit Gereksinimi

- Her kritik rapor icin en az bir legacy cikti.
- Rapor filtre ekranlari ve kolon sirasi.
- Alt toplam/genel toplam kurallari.
- Export formatlari ve dosya adlandirma davranisi.
- Eksik fixture backlog'u `tests/parity/legacy-acceptance/pending-legacy-fixtures.test.mjs` altinda tutulur.
