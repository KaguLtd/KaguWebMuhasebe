# Documentation Index

Bu klasor, KAGU ERP masaustu uygulamasinin web yeniden insasi icin ana referans dokumantasyonunu tutar.

## Cekirdek Planlama

| Dosya | Amac |
| --- | --- |
| `MIGRATION_PLAN.md` | Faz bazli genel gecis stratejisi |
| `DECISIONS.md` | Teknik ve surec karar kaydi |
| `SUBAGENT_PLAN.md` | Fazlara gore onerilen subagent uzmanliklari |

## Legacy ve Parity

| Dosya | Amac |
| --- | --- |
| `LEGACY_AUDIT.md` | Masaustu uygulama analizi |
| `LEGACY_INVENTORY.md` | `legacy/` klasor doluluk raporu |
| `LEGACY_READYNESS.md` | Intake ve capture hazirlik ozet raporu |
| `MODULE_PARITY.md` | Modul bazli takip tablosu |
| `UI_PARITY.md` | Ekran ve gorunum esleme kaydi |
| `REPORTS_PARITY.md` | Rapor ciktilari ve export parity kaydi |

## Veri ve Operasyon

| Dosya | Amac |
| --- | --- |
| `DATA_MODEL.md` | PostgreSQL modelleme notlari |
| `DATA_MIGRATION.md` | Veri tasima ve dogrulama plani |
| `DEPLOYMENT.md` | Production dagitim ve operasyon notlari |

## DevOps Surface

| Dosya | Amac |
| --- | --- |
| `../scripts/README.md` | Root script contract'i ve evidence refresh akisi |
| `.github/workflows/docs-devops.yml` | Docs/devops surface CI contract'i |

## Su Anki En Buyuk Blokaj

- Legacy masaustu uygulama kaynaklari bu repoda bulunmuyor.
- Bu nedenle parity ve finansal davranis cikarimi ancak `legacy/` klasoru doldurulduktan sonra derinlestirilebilir.

## Evidence Yorumu

- `LEGACY_INVENTORY.md` ve `LEGACY_READYNESS.md` doluluk ve capture coverage
  snapshot'idir; parity kabul kaydi degildir.
- `tests/parity/README.md` altindaki test stratejisi, evidence gelmeden
  "acceptance parity" iddiasi uretmemelidir.
