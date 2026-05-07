# UI Parity

## Durum

- Durum: `Web'de Yapildi`
- Source of truth: `legacy/source/KAGU-ERP-D1`
- Kural: UI dili D1'in Ant Design masaustu mantigina yakin tutulur; webde Electron/preload yerine Next.js route/API akisi kullanilir.

## Parity Tablosu

| Alan | Legacy Durumu | Web Durumu | Not |
| --- | --- | --- | --- |
| Login ekrani | Evet | Kismi | Gecici session; gercek auth/roles sonraki faz |
| Dashboard / ana ekran | Evet | Evet | KAGU workspace shell, header, sol menu ve kart yapisi aktif |
| Ana menu | Evet | Evet | `Dashboard`, `Cari Hesaplar`, `Projeler`, `Malzemeler`, `Depolar`, `Sevk / Irsaliye`, `Faturalar`, `Tahsilat / Odeme`, `Virman`, `Ayarlar` korundu |
| Master formlari | Evet | Evet | Drawer genislikleri buyutuldu; CRUD PostgreSQL'e bagli |
| Belge formlari | Evet | Evet | Draft drawer, cari kur kilidi, proje filtresi ve editable line table aktif |
| Belge listeleri | Evet | Evet | Arama, durum, tarih ve modul bazli lookup filtreleri aktif |
| Satir girisi | Evet | Evet | Kart yapisi yerine Ant Design Table + Form.List editable grid kullaniliyor |
| Hata mesajlari | Evet | Evet | API `{ error }` mesaji client tarafinda okunabilir metinle gosteriliyor |
| Cari ekstre PDF | Evet | Kismi | Print-friendly ekstre sayfasi ve tarayici `PDF olarak kaydet` akisi aktif |

## Sonraki UI Isleri

- Gercek auth/roles geldikten sonra menu yetki filtreleri.
- Rapor ekranlarini legacy ornek ciktilara gore genisletme.
- Mobil/tablet gorunumleri icin kabul testi.
