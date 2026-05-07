# Parity Evidence Checklist

Bu checklist parity kanitini iki seviyede netlestirir:

## Domain Regression

- Legacy davranis veya kural en az bir `legacy/notes/modules/*` ya da `legacy/notes/reports/*` notunda kayitli.
- Web testinin adi ilgili davranisi acikca tarif ediyor.
- Test fixture yerine kurali dogruluyorsa `tests/parity/domain-regression/*` altinda duruyor.

## Legacy Acceptance

- Test `tests/parity/legacy-acceptance/*` altinda.
- En az bir fixture dosyasi var.
- En az bir golden output dosyasi var.
- Legacy kanit referansi notta veya fixture metadata'sinda acik.
- Kullanilan kolon sirasi, toplam ve filtre davranisi legacy note icinde yazili.
- Placeholder durumlar skip test olarak acceptance backlog'unda tutuluyor.

## Warehouse Inventory Ornegi

- Legacy note: `legacy/notes/reports/stok-raporu.md`
- Legacy source: `legacy/source/KAGU-ERP-D1/src/main/services.ts#getWarehouseInventory`
- Fixture: `tests/parity/legacy-acceptance/fixtures/warehouse-inventory-main.fixture.json`
- Golden output: `tests/parity/legacy-acceptance/fixtures/warehouse-inventory-main.golden.csv`
- Acceptance test: `tests/parity/legacy-acceptance/warehouse-inventory-golden.test.mjs`
