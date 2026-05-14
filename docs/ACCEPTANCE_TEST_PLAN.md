# KaguWebMuhasebe Acceptance Test Plan

Bu plan test deploy oncesi teknik kabul ve manuel kabul kapsamlarini ayirir. Uygulama resmi muhasebe, e-fatura, beyanname veya e-defter sistemi degildir; kabul testleri cari, proje, stok, malzeme hareketi, irsaliye, fatura, tahsilat/odeme ve proje bazli malzeme kullanimi takibiyle sinirlidir.

## Codex Teknik Acceptance Sorumluluklari

- Repo `main` branch uzerinde ve `origin/main` ile guncel mi kontrol edilir.
- Temiz paket kurulumu, Prisma generate/validate, temiz PostgreSQL migration deploy, drift kontrolu, typecheck, lint, test, build ve production readiness komutlari calistirilir.
- Migration dosyalarinda BOM olmadigi, `DocumentStatus` enum degerlerinin schema ve migration tarafinda uyumlu oldugu, auth tablolari ve kritik API route'larinin build/type acisindan saglam oldugu kontrol edilir.
- Admin bootstrap, health endpoint, auth/session guard ve production-like seed refusal davranislari dogrulanir.
- Blocker veya kritik kabul engeli varsa minimal patch uygulanir; yeni ozellik, UI degisikligi veya urun karari eklenmez.

## Kullanici Manuel Acceptance Sorumluluklari

- Local PostgreSQL acceptance DB uzerinde uygulamayi kendi test verileriyle kullanarak A1-A10 senaryolarini tamamlamak.
- Is akisi, ekran metinleri, belge durumlari, rapor rakamlari ve stok/proje etkilerinin beklenen operasyonel davranisa uydugunu onaylamak.
- Test deploy sonrasi ortam degiskenlerinin gercek degerlerle girildigini ve sifrelerin dokumanlara/loglara yazilmadigini kontrol etmek.

## Local PostgreSQL Acceptance DB Kurulumu

Onerilen DB adi: `kagu_muhasebe_acceptance`.

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -U postgres -h localhost -p 5432 -d postgres -c "DROP DATABASE IF EXISTS kagu_muhasebe_acceptance WITH (FORCE);"
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -U postgres -h localhost -p 5432 -d postgres -c "CREATE DATABASE kagu_muhasebe_acceptance;"
```

## Windows C:\KaguLocal Isolated PostgreSQL Cluster

Bu local acceptance akisi mevcut Windows PostgreSQL servisine dokunmadan `C:\KaguLocal\pgdata` altinda ayri bir PostgreSQL cluster kullanir. Varsayilan port `55432`, host `localhost`, DB adi `kagu_muhasebe_acceptance`, kullanici `postgres` olur. Repo checkout konumu `C:\KaguLocal\KaguWebMuhasebe` olmalidir.

PostgreSQL 18 disinda bir surum kullaniyorsan `-PgBin` degerini kurulu PostgreSQL `bin` klasorune gore degistir.

```powershell
cd C:\KaguLocal\KaguWebMuhasebe

.\scripts\windows-local-acceptance.ps1 init -PgBin "C:\Program Files\PostgreSQL\18\bin"
.\scripts\windows-local-acceptance.ps1 start -PgBin "C:\Program Files\PostgreSQL\18\bin"
.\scripts\windows-local-acceptance.ps1 reset-db -PgBin "C:\Program Files\PostgreSQL\18\bin"
.\scripts\windows-local-acceptance.ps1 app-check -PgBin "C:\Program Files\PostgreSQL\18\bin"
.\scripts\windows-local-acceptance.ps1 bootstrap-admin -PgBin "C:\Program Files\PostgreSQL\18\bin"
.\scripts\windows-local-acceptance.ps1 dev -PgBin "C:\Program Files\PostgreSQL\18\bin"
```

`POSTGRES_PASSWORD` env varsa DB komutlari onu kullanir; yoksa script sifreyi guvenli prompt ile ister. `bootstrap-admin` modu `ADMIN_PASSWORD` env varsa onu kullanir; yoksa admin sifresini guvenli prompt ile ister. Sifreler loglanmaz.

## Teknik Komut Sirasi

```powershell
cd apps/muhasebe-web
npm ci
npm run prisma:generate
npm run prisma:validate
$env:DATABASE_URL = "postgresql://postgres:<POSTGRES_PASSWORD>@localhost:5432/kagu_muhasebe_acceptance?schema=public"
npx prisma migrate deploy
npx prisma migrate status
npm run typecheck
npm run lint
npm run test
npm run build
$env:AUTH_SECRET = "<AUTH_SECRET>"
$env:KAGU_APP_ORIGIN = "<PUBLIC_HTTPS_ORIGIN>"
$env:KAGU_BACKUP_PLAN_ACK = "true"
npm run production:check
```

## Admin Bootstrap Testi

Gercek sifre dokumana veya loga yazilmaz; placeholder kullanilir.

```powershell
$env:DATABASE_URL = "postgresql://postgres:<POSTGRES_PASSWORD>@localhost:5432/kagu_muhasebe_acceptance?schema=public"
$env:ADMIN_USERNAME = "<ADMIN_USERNAME>"
$env:ADMIN_PASSWORD = "<ADMIN_PASSWORD>"
$env:ADMIN_FULL_NAME = "<ADMIN_FULL_NAME>"
npm run admin:bootstrap
```

Beklenen sonuc:

- Kullanici yoksa aktif `ADMIN` kullanicisi olusur.
- Kullanici varsa sifresi guncellenir, kullanici aktif kalir ve `ADMIN` rolune sahip olur.
- Loglarda `ADMIN_PASSWORD` degeri gorunmez.

## Manuel Senaryolar A1-A10

- A1: Admin kullanicisi ile login ol, session cookie'nin production'da `Secure` ve `HttpOnly` geldigini dogrula.
- A2: Session olmadan kritik API route'larina erisim dene; 401/403 ile korunmali.
- A3: Cari, proje, depo, stok kalemi ve temel referans kayitlarini olustur/guncelle.
- A4: Giris irsaliyesi olustur, onayla; stok artisini depo envanterinde dogrula.
- A5: Projeye bagli cikis irsaliyesi olustur, onayla; stok dususunu ve proje malzeme kullanimi raporunu dogrula.
- A6: Cikis irsaliyesini faturaya bagla; fatura onayinda ayni stok hareketinin ikinci kez yazilmadigini dogrula.
- A7: Satis/alis faturasi onayla; cari hesap ekstresi ve ilgili rapor etkilerini kontrol et.
- A8: Tahsilat/odeme ve transfer belgelerini onayla; cari ledger etkilerini kontrol et.
- A9: Onayli belge iptalini test et; stok hareketi ve ledger kayitlari ineffective olmali, raporlardan dusmeli.
- A10: Onayli belge revizyonunu test et; eski belge `SUPERSEDED` ve ineffective, yeni belge effective olmali.

## Kritik Acceptance Kriterleri

- Temiz PostgreSQL DB uzerinde `migrate deploy` ve `migrate status` temiz gecmeli.
- `npm ci`, Prisma, typecheck, lint, test, build ve production readiness zinciri gecmeli.
- `/api/health` saglikli DB ile 200 `status: ok`, DB hatasinda secret/connection string sizdirmadan 503 donmeli.
- Placeholder auth production'da kapali kalmali; pasif kullanici login olamamali.
- Admin bootstrap sifreyi loglamamali ve mevcut kullaniciyi aktif `ADMIN` olarak guncelleyebilmeli.
- Iptal/revizyon sonrasi yalnizca effective stok hareketleri ve ledger kayitlari raporlara yansimali.
