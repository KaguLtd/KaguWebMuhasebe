# Product Regression Tests

Bu klasor KaguWebMuhasebe urun davranisinin bozulmadigini kontrol eden root seviye testleri tutar.

## Kapsam

- `domain-regression/`: master data, belge guardrail'leri, para hesabi ve rapor davranislari
- `_support/`: app icindeki TypeScript modullerini test icin gecici CommonJS ciktilarina ceviren yardimcilar
- `fixtures/`: regression testlerinde kullanilan urun fixture ve beklenen ciktilar

## Ilkeler

- Testler mevcut urun davranisini korur; yeni is mantigi karari yerine gecmez.
- Beklenen ciktilar urun acceptance senaryolariyla uyumlu olmalidir.
- Skip edilen bekleme testleri tutulmaz; eksik kapsam dokuman veya issue olarak izlenir.
- App icindeki auth, route guard ve runtime testleri `apps/muhasebe-web/tests` altinda kalir.

## Calistirma

```bash
npm run test
```
