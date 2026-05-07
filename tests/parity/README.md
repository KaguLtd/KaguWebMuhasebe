# Parity Tests

Bu klasor, legacy masaustu uygulama ile web uygulamasinin ayni sonucu uretip uretmedigini kontrol eden testler icin ayrildi.

## Planlanan Test Gruplari

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

## Blocker

Golden input/output ornekleri olmadan gercek parity testi yazilamaz.
