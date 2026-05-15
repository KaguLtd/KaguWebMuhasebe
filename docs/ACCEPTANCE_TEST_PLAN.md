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

## Manuel Senaryolar A1-A16

- A1: Admin kullanicisi ile login ol, session cookie'nin production'da `Secure` ve `HttpOnly` geldigini dogrula.
- A2: Session olmadan kritik API route'larina erisim dene; 401/403 ile korunmali.
- A3: Cari, proje, depo, stok kalemi ve temel referans kayitlarini olustur/guncelle.
- A4: Giris irsaliyesi olustur, onayla; stok artisini depo envanterinde dogrula.
- A5: Projeye bagli cikis irsaliyesi olustur, onayla; stok dususunu ve proje malzeme kullanimi raporunu dogrula.
- A6: Irsaliye ekraninda `Irsaliye Birlestir` drawerini ac; ayni cari/proje/depo icin OUT normal ve IN iade irsaliyelerini sec. Onizlemede net miktarin pozitif oldugunu dogrula, B-Irsaliye taslagi olustur, onayla. Kaynaklar K-Irsaliye ve ineffective, B-Irsaliye tek effective stok kaynagi olmali.
- A7: Satis/alis faturasi onayla; cari hesap ekstresi ve ilgili rapor etkilerini kontrol et.
- A8: Tahsilat/odeme ve transfer belgelerini onayla; cari ledger etkilerini kontrol et.
- A9: Onayli belge iptalini test et; stok hareketi ve ledger kayitlari ineffective olmali, raporlardan dusmeli.
- A10: Onayli belge revizyonunu test et; eski belge `SUPERSEDED` ve ineffective, yeni belge effective olmali.
- A11: Alim/tedarikci girisi netlestirme icin IN normal ve OUT iade irsaliyelerini birlestir; net giris miktarinin dogru oldugunu dogrula.
- A12: Onayli ve effective B-Irsaliye uzerinde `Coz` aksiyonunu calistir; B-Irsaliye VOID/isEffective=false kalmali, kaynak K-Irsaliyeler NORMAL/isEffective=true olmali.
- A13: Fatura drawerinda cari secmeden `Irsaliye Aktar` butonunun pasif oldugunu dogrula. CUSTOMER cari secildiginde SALES, SUPPLIER cari secildiginde PURCHASE kilitli olmali; BOTH cari icin kullanici tur secebilmelidir.
- A14: Satis faturasi icin OUT etkili normal veya B-Irsaliye aktar; fatura onaylaninca kaynak irsaliye F-Irsaliye/invoicedByInvoiceId dolu/isEffective=false, fatura stock movement effective olmali. Depo stok raporunda cift hareket olmamali.
- A15: Alis faturasi icin IN etkili normal veya B-Irsaliye aktar; fatura onayinda stok etkisinin faturaya gectigini dogrula. Faturayi VOID et; fatura hareketleri ineffective, kaynak irsaliye tekrar invoicedByInvoiceId=null/isEffective=true olmali.
- A16: Yasak kombinasyonlari dene: K-Irsaliye faturaya aktarilamaz, F-Irsaliye birlestirilemez, faturalanmis B-Irsaliye cozulmez, faturalanmis irsaliye tekrar secilmez, farkli cari/proje/depo birlesimi ve negatif net miktar reddedilir.

## Kritik Acceptance Kriterleri

- Temiz PostgreSQL DB uzerinde `migrate deploy` ve `migrate status` temiz gecmeli.
- `npm ci`, Prisma, typecheck, lint, test, build ve production readiness zinciri gecmeli.
- `/api/health` saglikli DB ile 200 `status: ok`, DB hatasinda secret/connection string sizdirmadan 503 donmeli.
- Placeholder auth production'da kapali kalmali; pasif kullanici login olamamali.
- Admin bootstrap sifreyi loglamamali ve mevcut kullaniciyi aktif `ADMIN` olarak guncelleyebilmeli.
- Iptal/revizyon sonrasi yalnizca effective stok hareketleri ve ledger kayitlari raporlara yansimali.
- Irsaliye birlestirme, cozumleme ve faturaya aktarma islemlerinde kaynak belge rolleri ile faturalama linkleri ayri tutulmali: merge icin `mergeRole`, faturalama icin `invoicedByInvoiceId/invoicedAt` kullanilmali.
- Depo ekraninda `Stok` mevcut envanteri, `Evrak Hareketleri` ise effective/ineffective belge hareketlerini tarih, belge, cari, proje, malzeme, giris/cikis, durum ve rol bilgisiyle gostermeli.
