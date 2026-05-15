# Migration Scripts

Bu klasor veritabani veya veri tasima yardimcilari icin ayrilmistir.

Kurallar:

- Prisma schema ve migration dosyalari app altinda tutulur.
- Canli ortamda `prisma migrate deploy` kullanilir.
- Veri tasima scriptleri idempotent, loglanabilir ve once test verisiyle dogrulanabilir olmalidir.
