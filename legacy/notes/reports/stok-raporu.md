# Report Capture Template

## Rapor

- Ad: Stok Raporu / Depo Envanteri
- Modul: Stok Ve Urun
- Ornek dosya: `tests/parity/legacy-acceptance/fixtures/warehouse-inventory-main.golden.csv`

## Legacy Kaniti

- Kaynak kod: `legacy/source/KAGU-ERP-D1/src/main/services.ts#getWarehouseInventory`
- Sorgu semantigi: secili depo icin `SUM(qty_in - qty_out)` ile net miktar hesaplanir.

## Filtreler

- Depo secimi zorunlu.

## Kolonlar

- `itemCode`
- `itemName`
- `unitLabel`
- `quantity`

## Toplamlar

- Satir bazinda net miktar gosterilir.
- `ABS(net miktar) <= 0.000001` olan satirlar rapora girmez.

## Siralama / Gruplama

- `itemCode` artan sirada listelenir.
- Her malzeme tek satira gruplanir.

## Export Bicimleri

- PDF: Bekliyor
- Excel: Bekliyor
- Print: Bekliyor
- CSV golden: `tests/parity/legacy-acceptance/fixtures/warehouse-inventory-main.golden.csv`

## Parity Notlari

- Acceptance fixture'i purchase invoice, sales invoice ve iade irsaliyesi kombinasyonuyla net stok miktarini dogrular.
- Bu not `legacy/notes/PARITY_EVIDENCE_CHECKLIST.md` icindeki warehouse inventory ornegiyle baglidir.
