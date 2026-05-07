# Parity Tests

Bu klasor parity yuzeyini iki ayri amaca boler:

- `domain-regression/`: legacy'den alinmis kurallarin web domain katmaninda bozulmadigini kontrol eden hizli regresyon testleri
- `legacy-acceptance/`: legacy kaniti, fixture ve golden output ile birebir kabul testi yapan suite

## Mevcut Sprint Contract

- `domain-regression` testleri web davranisinin regress etmeme kontroludur; tek basina acceptance parity kaniti sayilmaz.
- `legacy-acceptance` altindaki her test bir legacy evidence referansi, fixture dosyasi ve golden output ile gelmelidir.
- Placeholder veya eksik fixture notlari yalnizca `legacy-acceptance/` altinda tutulur.

## Aktif Test Kapsami

- `domain-regression`: monetary invariants, master data davranis regresyonlari, belge engine / posting davranisi
- `legacy-acceptance`: depo envanteri icin JSON fixture + golden CSV kabul testi

## Evidence-First Test Gruplari

- cari bakiye parity
- stok miktari parity
- fatura toplam/KDV parity
- kasa bakiye parity
- banka bakiye parity
- muhasebe fisi borc/alacak parity
- migration sonrasi toplam dogrulama

## Test Kurallari

- Finansal sonuclarda tolerans kullanilmayacak.
- Decimal bazli birebir esitlik beklenecek.
- Her testte legacy kaynak kaniti referanslanacak.
- Evidence referansi yoksa test `domain-regression` olarak kalir, `legacy-acceptance` etiketi tasimaz.

## Acceptance Kaniti

- `legacy-acceptance/warehouse-inventory-golden.test.mjs`
  Legacy stok raporu sirasi ve kolon semantigini `legacy/source/KAGU-ERP-D1/src/main/services.ts#getWarehouseInventory` ile hizali golden CSV uzerinden dogrular.

## Sonraki Acceptance Hedefleri

- cari ekstre golden fixture
- item movement golden fixture
- dashboard totals export fixture
