# Reports Parity

## Durum

- Durum: `Kismi`
- Source of truth: `legacy/source/KAGU-ERP-D1`
- Kural: Muhasebesel toplamlar minor-unit integer ve basis-point oran mantigiyla hesaplanir; raporlar PostgreSQL repository kaynaklidir.

## Aktif Raporlar

| Rapor Alani | Web Durumu | Not |
| --- | --- | --- |
| Dashboard satis toplamlari | Aktif | Onayli satis faturalarindan gunluk/haftalik/aylik currency bazli toplam |
| Dashboard stok degeri | Aktif | Stok hareketlerinden miktar, son alis faturasi veya inbound irsaliye maliyetiyle degerleme |
| Cari ekstre | Aktif | Account ledger entries uzerinden borc/alacak/bakiye ve tarih araligi |
| Cari ekstre PDF | Aktif | Print-friendly sayfa; tarayici yazdir/PDF kaydet akisi |
| Depo envanteri | Aktif | Stock movements uzerinden depo ve malzeme miktarlari |
| Malzeme hareketleri | Aktif | Stock movements uzerinden malzeme bazli giris/cikis |
| Fatura metrikleri | Aktif | Net/brut, maliyet, kar ve marj hesaplari |
| KDV, mizan, kasa/banka detay raporlari | Bekliyor | Legacy cikti ornekleriyle sonraki fazda genisletilecek |

## Parity Riskleri

- Legacy rapor ciktilari gelmeden kolon sirasi ve export dosya adi tam onayli sayilmaz.
- Dashboard stok degeri artik prototip ile ayni sekilde purchase invoice ve inbound delivery cost adaylarini birlikte siralar; outbound/iade maliyetleri degerlemeye girmez.
- Server-side PDF dependency eklenmedi; secilen yol tarayici print/PDF akisi.

## Sonraki Kanit Gereksinimi

- Her kritik rapor icin en az bir legacy cikti.
- Rapor filtre ekranlari ve kolon sirasi.
- Alt toplam/genel toplam kurallari.
- Export formatlari ve dosya adlandirma davranisi.
