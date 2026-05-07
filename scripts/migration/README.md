# Migration Scripts Plan

Bu klasor, legacy veriyi PostgreSQL'e tasirken kullanilacak scriptler icindir.

## Hedef Script Tipleri

- `analyze-*`: legacy veri formatini cozen scriptler
- `import-*`: yeni veritabanina yukleyen scriptler
- `validate-*`: legacy ve web toplamlarini karsilastiran scriptler

## Kurallar

- Finansal alanlarda `Decimal` mantigi korunmali.
- Veri kaybi kabul edilmez.
- Scriptler dry-run desteklemeli.
- Hata raporlari ayri dosya veya tabloya yazilmali.

## Blocker

Legacy veri ornegi gelmeden script implementasyonu baslatilmayacak.
