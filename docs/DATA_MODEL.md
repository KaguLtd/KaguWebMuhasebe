# Data Model Working Notes

## Status

- Durum: `PostgreSQL repository aktif`
- Schema: `apps/muhasebe-web/prisma/schema.prisma`
- Migration dosyalari: `apps/muhasebe-web/prisma/migrations/`
- Runtime source of truth: PostgreSQL via Prisma repository layer

## Modeling Rules

- Para alanlari minor-unit integer olarak tutulur: `amount_minor`, `debit_minor`, `credit_minor`, `unit_price_minor`, `document_total_minor`.
- KDV ve iskonto basis point olarak tutulur: `rate_bps`, `discount_bps`, `vat_rate_bps`.
- ID yaklasimi string UUID olarak korunur.
- Finansal ve belge degisiklikleri `audit_events` ve `document_revisions` ile izlenir.
- Bu uygulama resmi genel muhasebe motoru degil; operasyonel cari/stok subledger olarak tasarlanir.
- Tek cari altinda tek doviz kullanilir. Ayni ticari taraf icin farkli doviz gerekiyorsa ayri cari acilir.
- Onayli belge duzeltmeleri mevcut belgeyi ezmez; eski belge `SUPERSEDED` veya `VOID` olarak sistemde kalir, etkisi `is_effective=false` ile kapanir.
- Donem kilidi `settings.periodLock` JSON ayariyla yonetilir ve secilen tarihten onceki onayli belgelerde degisiklik/iptal/revizyonu engeller.
- Belge numaralari `document_counters` ve `document_number_registry` ile tek transaction icinde uretilir/kaydedilir.
- Prisma schema bilincli olarak explicit relation tanimlari olmadan FK alanlariyla sade tutulur; repository katmani FK sorgularini manuel yapar.

## Aktif Entity Gruplari

| Grup | Tablolar | Durum |
| --- | --- | --- |
| Ayarlar | `settings`, `units`, `item_classes`, `vat_rates` | Aktif |
| Master data | `accounts`, `projects`, `warehouses`, `items` | Aktif |
| Belge altyapisi | `document_counters`, `document_number_registry`, `document_revisions`, `audit_events` | Aktif |
| Irsaliye | `delivery_notes`, `delivery_note_lines` | Aktif |
| Fatura | `invoices`, `invoice_lines` | Aktif |
| Tahsilat/Odeme | `receipts` | Aktif |
| Virman | `transfers` | Aktif |
| Muhasebe ve stok etkisi | `account_ledger_entries`, `stock_movements` | Aktif |
| Sayim | `stock_counts` | Schema var; UI/engine sonraki faz |

## Repository Katmani

- `master-repository.ts`: master CRUD, lookup, next-code ve bootstrap master metrikleri.
- `document-repository.ts`: draft save, approve, void, supersede/revizyon, belge numarasi, registry, revisions, ledger ve stock posting.
- `report-repository.ts`: dashboard totals, cari ekstre, depo envanteri, malzeme hareketleri ve invoice metrics.
- `store.ts` ve `document-engine.ts`: test/demo helper olarak korunur; production API path'leri DB repository katmanina baglidir.

## Sonraki Data Model Isleri

- Gercek migration deploy testi ve partial seed davranisini sertlestirme.
- Manuel muhasebe fisi, auth/roles ve kullanici/firma modeli.
- KDV, kasa, banka ve ek operasyon raporlarinin urun ihtiyacina gore netlestirilmesi.
