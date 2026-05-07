# Legacy Intake

Bu klasor, mevcut KAGU ERP masaustu uygulamasinin read-only referanslari icin ayrilmistir.

## Kurallar

- Bu klasordeki dosyalar degistirilmeyecek.
- Legacy kaynaklar source of truth olarak ele alinacak.
- Yeni web uygulamasi davranisi bu klasordeki kanitlardan turetilecek.

## Buraya Eklenmesi Beklenenler

- kaynak kod
- derlenmis uygulama ciktilari
- ekran goruntuleri
- rapor ornekleri
- veritabani dosyalari veya exportlar
- kullanici kilavuzlari veya saha notlari

## Onerilen Alt Yapi

```txt
legacy/
  source/
  binaries/
  screenshots/
  reports/
  data-samples/
  notes/
```

## Intake Checklist

- Ana menu ekran goruntuleri eklendi mi?
- Login akisi kanitlandi mi?
- Cari, stok, fatura, kasa, banka ekranlari var mi?
- Ornek rapor ciktisi var mi?
- Veri saklama formati net mi?
- Belge numaralandirma ve muhasebe fisleri icin ornek kayit var mi?

## Parity Evidence Ayrimi

- `legacy/notes/modules/*`: domain-regression testlerini besleyen ekran, kural ve validasyon notlari
- `legacy/notes/reports/*`: legacy-acceptance testlerinde kullanilan rapor kolonlari, siralama ve toplam kurallari
- `legacy/notes/PARITY_EVIDENCE_CHECKLIST.md`: bir fixture veya golden output'un hangi legacy kanita dayandigini netlestiren checklist
