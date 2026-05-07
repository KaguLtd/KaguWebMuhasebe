# Legacy Audit

## Audit Status

- Durum: `Partially unblocked`
- Neden: `legacy/source/KAGU-ERP-D1` altinda legacy kaynak kodu artik mevcut.
- Kalan blokaj: ekran goruntuleri, rapor ornekleri ve operator akis kaniti hala eksik.
- Kural: Legacy uygulama source of truth olarak kalacak ve read-only analiz edilecek.

## Repository Evidence Reviewed

- Mevcut klasorler: `apps/`, `docs/`, `legacy/`, `scripts/`, `tests/`, `.codex/`
- Legacy uygulamaya ait dogrulanabilir artefakt:
  - `legacy/source/KAGU-ERP-D1/package.json`
  - `legacy/source/KAGU-ERP-D1/src/main/schema.ts`
  - `legacy/source/KAGU-ERP-D1/src/main/document-engine.ts`
  - `legacy/source/KAGU-ERP-D1/src/renderer/App.tsx`
  - `legacy/source/KAGU-ERP-D1/src/renderer/styles.css`

## Teknoloji Stack

- Confirmed:
  - Electron
  - React 19
  - Vite
  - Ant Design
  - better-sqlite3
  - TypeScript

## Entry Points

- Confirmed:
  - Electron main process: `src/main/main.ts`
  - Preload bridge: `src/preload/index.ts`
  - Renderer root: `src/renderer/main.tsx`
  - UI shell: `src/renderer/App.tsx`
- Belirsiz / tekrar kontrol edilmeli:
  - operator tarafinda login veya ayrik auth akisi var mi

## Veri Saklama

- Confirmed:
  - local SQLite persistence via `better-sqlite3`
  - schema tanimi `src/main/schema.ts` icinde
  - backup ve audit alanlari kodda ayri moduller halinde mevcut
- Dikkat:
  - hedef web uygulamasi PostgreSQL olacaksa mevcut SQLite davranisi korunmali

## Moduller

- Confirmed UI/menu modulleri:
  - Dashboard
  - Cari Hesaplar
  - Projeler
  - Malzemeler
  - Depolar
  - Sevk / Irsaliye
  - Faturalar
  - Tahsilat / Odeme
  - Virman
  - Ayarlar
- Not:
  - roadmap'teki `stok`, `kasa`, `banka`, `muhasebe fisleri`, `raporlar` kavramlari mevcut koda birebir ayni menu adlariyla cikmiyor olabilir
  - bunlar davranis seviyesinde tekrar eslenmeli

## Ekranlar ve Menu Aklari

- Confirmed:
  - sol sider menu + ust header yapisi var
  - dashboard + master workspace + document workspace ayrimi var
  - fatura ekrani satis/alIs sekmeleri ile ayriliyor
- Belirsiz / tekrar kontrol edilmeli:
  - tum popup/modal akislari
  - kullanici bazli gercek operator akis sirasi

## Muhasebe Kurallari

- Confirmed:
  - belge numaralandirma servisi mevcut
  - audit trail ve revision kayitlari mevcut
  - ledger entry ve stock movement baglari belge bazinda tutuluyor
  - `amount_minor`, `debit_minor`, `credit_minor`, `unit_price_minor` gibi minor-unit saklama mantigi kullaniliyor
  - invoice ve delivery note baglantilari belge etkisini izliyor
- Belirsiz / tekrar kontrol edilmeli:
  - tum borc/alacak dengeleme kurallarinin tam operator sonucu
  - tum KDV varyasyonlari
  - period-end / mizan / resmi muhasebe fis ekranlari ayni kod tabaninda var mi

## Validasyonlar

- Confirmed:
  - VOID belge duzenleme engeli
  - APPROVED/FINISHED belge duzenlemede edit reason zorunlulugu
  - belge status akislari (`DRAFT`, `APPROVED`, `VOID`, `FINISHED`)
- Belirsiz / tekrar kontrol edilmeli:
  - kullanici/rol bazli kisitlar
  - operator seviyesinde tum hata mesajlari

## Raporlar

- Koddan dolayli gorulenler:
  - statement preview / statement generation sozlesmeleri mevcut
  - dashboard metrics ve satis/envanter ozetleri mevcut
- Belirsiz / tekrar kontrol edilmeli:
  - son kullaniciya sunulan tum rapor ekranlari
  - PDF/Excel/print ciktilarinin tam bicimi

## Import / Export

- Belirsiz / tekrar kontrol edilmeli
- Koddan kesin teyit icin ek inceleme gerekli:
  - Excel/CSV import
  - PDF/Excel export
  - yazdirma formatlari

## UI Gorunum Ozellikleri

- Confirmed:
  - bej / kirik beyaz / kahverengi aksanli acik tema
  - Ant Design tabanli layout
  - sol menulu workspace kurgusu
  - `Segoe UI`, `Tahoma`, sans-serif yazi ailesi
  - yumusak golge ve ince border dili
- Bu nedenle:
  - mevcut web placeholder'lar mavi/gri kurgu yerine bu palete yaklastirilmali
  - menu isimleri legacy adlarina gore guncellenmeli

## Web'e Tasinabilir Kodlar

- TypeScript domain modelleri
- modul adlandirmalari
- form/kolon konfigurasyon desenleri
- belge numaralandirma, audit ve document engine mantiginin davranissal kurgusu

## Yeniden Yazilmasi Gereken Kodlar

- Electron main/preload entegrasyonu
- local SQLite bagimliligi
- masaustu dosya sistemi ve native packaging akislari

## Riske Acik Alanlar

- legacy kodu okuyup yine de UI'yi kendi zevkimize gore yeniden yorumlamak parity'yi bozar
- minor-unit para saklama mantigini PostgreSQL'e tasirken anlamsal kayip olursa finansal parity bozulur
- roadmap'teki modul isimleri ile gercek uygulama menu isimleri birebir eslenmezse kapsam kayar

## Unblock Checklist

- `legacy/screenshots` altina ekran goruntuleri eklenmeli.
- `legacy/reports` altina ornek rapor ciktilari eklenmeli.
- operator akislarina dair saha notlari `legacy/notes` altina eklenmeli.
- mizan, banka, kasa ve rapor modullerinin koddaki karsiliklari daha derin taranmalı.
