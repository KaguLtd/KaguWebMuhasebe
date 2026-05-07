# KAGU Muhasebe Web

Bu uygulama, KAGU ERP masaustu muhasebe yaziliminin web yeniden insa calismasi
icin hazirlanan Next.js iskeletidir.

## Faz Durumu

- Faz 0-2: Plan, audit ve parity dokumanlari hazirlandi.
- Faz 3: Next.js iskeleti, placeholder login, dashboard ve route guard eklendi.
- Faz 4+: Legacy kaynaklar repoya eklenmeden finansal modelleme ve modul tasima
  baslatilmamali.

## Mevcut Ozellikler

- App Router tabanli Next.js kurulumu
- Tailwind CSS v4
- Placeholder login ekrani
- Placeholder dashboard
- Legacy intake durumu gosteren `/intake` sayfasi
- Middleware ile korumali rota iskeleti
- Prisma datasource ve client hazirligi
- Root `docs/` klasorundeki roadmap ciktilarini gosteren `/docs` sayfasi

## Gelistirme

```bash
npm run dev
```

Varsayilan akis:

- `/` kullaniciyi oturum durumuna gore `/login` veya `/dashboard` sayfasina yonlendirir.
- `/login` sayfasindaki buton yalnizca Faz 3 placeholder oturumu acar.
- Gercek auth sistemi Faz 5'te eklenecektir.

## Ortam Degiskenleri

`.env.example` dosyasini temel al:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/kagu_muhasebe?schema=public"
NEXT_PUBLIC_APP_NAME="KAGU Muhasebe Web"
```

## Onemli Not

Bu uygulama bilincli olarak modern bir ERP redesign'i gibi davranmaz. Legacy
masaustu uygulama kaynaklari geldikten sonra UI, veri modeli ve muhasebe
davranislarinin parity odakli olarak daraltilmasi gerekir.

Workspace seviyesinde legacy doluluk raporu almak icin root klasorde:

```bash
npm run legacy:inventory:write
```
