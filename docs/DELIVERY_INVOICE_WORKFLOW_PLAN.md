# Delivery Invoice Workflow Plan

Bu not irsaliye ve fatura akislarinin mevcut urun beklentilerini ozetler. Davranis ayrintilari uygulama kodu ve acceptance planindaki senaryolarla dogrulanir.

## Irsaliye Akisi

- Irsaliye taslak olarak olusturulur ve onaylandiginda stok hareketi uretir.
- Giris, cikis ve iade bilgileri belge header ve satirlarindan hesaplanir.
- Irsaliye birlestirme ayni cari/proje/depo baglaminda net miktar kontroluyle yapilir.
- Birlestirilmis irsaliye cozuldugunde kaynak belgelerin etkisi tekrar acilir.

## Fatura Akisi

- Fatura taslak olarak olusturulur ve onaylandiginda cari ledger etkisi uretir.
- Irsaliye aktarimi fatura turu, cari tipi, depo ve belge durumuna gore kontrol edilir.
- Faturaya aktarilan irsaliye stok etkisini fatura uzerine devreder ve cift hareket olusmaz.
- Fatura iptalinde ilgili stok ve cari etkileri etkisiz hale getirilir.

## Kabul

- Detayli manuel senaryolar [ACCEPTANCE_TEST_PLAN.md](ACCEPTANCE_TEST_PLAN.md) icindeki A4-A16 araliginda tutulur.
- Otomatik regresyon testleri belge guardrail'leri, raporlar ve temel hesaplama davranislarini kapsar.
