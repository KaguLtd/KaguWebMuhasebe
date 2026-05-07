# Data Migration

## Durum

- Durum: `Blocked`
- Neden: Legacy veritabani, dosya yapisi veya export ornekleri repoda yok.
- Kural: Veri donusum kurallari legacy kaniti olmadan tasarlanmamali.

## Repo Evidence

- Hedef veri katmani yonu mevcut: PostgreSQL + Prisma
- Kanit: `apps/muhasebe-web/prisma/schema.prisma` yalnizca datasource placeholder'i iceriyor
- Legacy veri modeli: `Belirsiz / tekrar kontrol edilmeli`

## Migration Kapsami

| Alan | Mevcut Durum | Risk | Sonraki Adim |
| --- | --- | --- | --- |
| Kaynak sistem tipi | Belirsiz / tekrar kontrol edilmeli | Yuksek | DB dosyasi veya export alinmali |
| Tablo/dosya envanteri | Belirsiz / tekrar kontrol edilmeli | Yuksek | Legacy schema veya alan listesi cikarilmali |
| Primary key / numaralandirma | Belirsiz / tekrar kontrol edilmeli | Yuksek | Belge ve fis numaralari dogrulanmali |
| Referans iliskileri | Belirsiz / tekrar kontrol edilmeli | Yuksek | Cari, stok ve fis baglantilari incelenmeli |
| Temizlik/donusum kurallari | Belirsiz / tekrar kontrol edilmeli | Orta | Bos alan, kodlama ve tarih formatlari teyit edilmeli |
| Geri donus / rollback | Belirsiz / tekrar kontrol edilmeli | Orta | Ilk migration denemesi icin snapshot plani tanimlanmali |

## Minimum Intake Listesi

- Ornek legacy veritabani veya read-only dump
- Tablo/alan aciklamalari varsa teknik dokuman
- En az bir sirket verisi iceren anonimlestirilmis ornek
- Rapor toplamlarini dogrulayacak sample output

## Hemen Yapilabilecekler

- Legacy veri artefaktlari icin read-only intake yolu belirle.
- Alan esleme tablosu bu dosyada ancak legacy schema geldikten sonra ac.
- Web tarafinda Prisma modellerini ancak parity audit sonrasinda ekle.

