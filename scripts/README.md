# Scripts

Bu klasor, workspace seviyesindeki otomasyon girislerini ve uretilen evidence
raporlarini yonetir.

## Root Komut Contract

Bu komutlar repo root'undan calistirilir ve README, deployment dokusu ve GitHub
Actions workflow'u ile ayni contract'i paylasir:

| Komut | Amac |
| --- | --- |
| `npm run dev` | `apps/muhasebe-web` gelistirme sunucusunu root'tan baslatir |
| `npm run lint` | Web uygulamasi lint kontrolu |
| `npm run typecheck` | Web uygulamasi TypeScript kontrolu |
| `npm run test` | `tests/parity` altindaki mevcut otomatik testleri calistirir |
| `npm run build` | Web uygulamasi production build'i |
| `npm run verify` | Docs/devops surface icin parity regression gate'i |
| `npm run production:check` | Production env guardrail kontrolu |
| `npm run evidence:refresh` | `docs/LEGACY_INVENTORY.md` ve `docs/LEGACY_READYNESS.md` snapshot'larini yeniler |

## Legacy Evidence Komutlari

| Komut | Cikti |
| --- | --- |
| `npm run legacy:inventory:write` | `docs/LEGACY_INVENTORY.md` |
| `npm run legacy:readiness:write` | `docs/LEGACY_READYNESS.md` |
| `npm run legacy:bootstrap:modules` | `legacy/notes` altindaki module/report capture taslaklarini acmaya yardim eder |

## Workflow Kullanimi

- `.github/workflows/docs-devops.yml` once `npm run evidence:refresh`, sonra
  `npm run verify` ve `npm run production:check` calistirir.
- Workflow, evidence snapshot dosyalarini artifact olarak yukler.
- `npm run verify`, bilerek yalnizca bu yuzeyin test/evidence contract'ini gate'ler;
  uygulama tarafindaki daha genis `lint`, `typecheck` ve `build` kontrolleri
  ayri komutlar olarak korunur.
- Root contract degistiginde bu dosya, root `README.md` ve
  `docs/DEPLOYMENT.md` birlikte guncellenmelidir.
