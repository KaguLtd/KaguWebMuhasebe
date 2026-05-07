# KAGU ERP Web Rebuild

Bu repo, mevcut KAGU ERP masaustu muhasebe uygulamasinin kontrollu web yeniden
insasi icin hazirlanmistir.

## Mevcut Durum

- Planlama ve parity dokumanlari `docs/` altinda hazir.
- Yeni web uygulamasi iskeleti `apps/muhasebe-web` altinda kurulu.
- Legacy intake yapisi `legacy/` altinda hazir.
- Finansal modul tasimasi henuz baslamadi; legacy artefaktlar bekleniyor.

## Klasorler

- `apps/muhasebe-web`: Next.js tabanli yeni web uygulamasi
- `docs`: migration, parity, veri modeli ve deployment kayitlari
- `legacy`: read-only masaustu kaynaklari icin intake alani
- `scripts`: migration, import ve export planlari
- `tests/parity`: legacy ile web esitligini dogrulayan testler

## Calistirma

```bash
cd apps/muhasebe-web
npm run dev
```

## Legacy Inventory

Root klasorde legacy intake ozetini uretmek icin:

```bash
npm run legacy:inventory:write
```

Bu komut [docs/LEGACY_INVENTORY.md](docs/LEGACY_INVENTORY.md)
dosyasini gunceller.

Modul ve rapor capture dosyalarini otomatik acmak icin:

```bash
npm run legacy:bootstrap:modules
```

Genel readiness ozetini yazmak icin:

```bash
npm run legacy:readiness:write
```

## Kontroller

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Bir Sonraki Gereken Sey

`legacy/` altina su kanitlari koy:

- kaynak kod veya calisan binary
- ekran goruntuleri
- rapor ornekleri
- veri exportlari veya veritabani ornekleri
- kullanici akis notlari
