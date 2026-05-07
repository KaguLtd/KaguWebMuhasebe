import { signInPlaceholder } from "./actions";
import { isPlaceholderAuthEnabled } from "@/lib/auth/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ auth?: string }>;
}) {
  const params = await searchParams;
  const placeholderAuthEnabled = isPlaceholderAuthEnabled();
  const authLocked = params?.auth === "locked" || !placeholderAuthEnabled;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-10">
      <section className="desktop-window w-full max-w-5xl overflow-hidden rounded-sm">
        <div className="border-b border-[var(--line-strong)] bg-[var(--accent)] px-4 py-3 text-sm font-bold tracking-[0.18em] text-white">
          KAGU LTD. MUHASEBE OTOMASYONU
        </div>
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="border-r border-[var(--line)] bg-[var(--panel)] p-6">
            <div className="mb-4 flex items-center justify-between border border-[var(--line)] bg-white px-4 py-2 text-sm">
              <span className="font-semibold">Web Rebuild Workspace</span>
              <span className="status-pill px-2 py-1 text-xs text-[var(--warning)]">
                Faz 3 Placeholder
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                "Cari Hesaplar",
                "Projeler",
                "Malzemeler",
                "Sevk / Irsaliye",
                "Faturalar",
                "Tahsilat / Odeme",
              ].map((module) => (
                <div
                  key={module}
                  className="border border-[var(--line)] bg-white px-3 py-4 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
                >
                  <div className="mb-2 h-2 w-14 bg-[var(--accent-soft)]" />
                  <p className="font-semibold">{module}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-600">
                    Legacy parity analizi bekleniyor.
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-6 border border-dashed border-[var(--line)] bg-white/70 px-4 py-3 text-xs leading-6 text-slate-600">
              Bu ekran bilincli olarak modernize edilmedi. Nihai gorunum,
              legacy masaustu ekranlari repoya eklendiginde birebir parity
              calismasi ile netlestirilecek.
            </div>
          </div>
          <div className="bg-[#e5ebf3] p-6">
            <div className="border border-[var(--line)] bg-white">
              <div className="border-b border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-sm font-semibold">
                Kullanici Girisi
              </div>
              <form action={signInPlaceholder} className="grid gap-4 p-4">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Kullanici Adi</span>
                  <input
                    className="border border-[var(--line)] bg-[#f9fbfd] px-3 py-2 outline-none focus:border-[var(--accent)]"
                    defaultValue="admin"
                    disabled
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Sifre</span>
                  <input
                    className="border border-[var(--line)] bg-[#f9fbfd] px-3 py-2 outline-none focus:border-[var(--accent)]"
                    defaultValue="********"
                    disabled
                    type="password"
                  />
                </label>
                <div className="border border-[var(--line)] bg-[var(--accent-soft)] px-3 py-2 text-xs leading-5 text-slate-700">
                  {authLocked
                    ? "Production ortaminda placeholder giris kapali. Gercek auth/roles kurulmadan canli kullanici erisimi acilmayacak."
                    : "Bu giris akisi yalnizca protected route iskeletini gostermek icin var. Gercek kimlik dogrulama Faz 5'te custom server-side session ile kurulacak."}
                </div>
                <button
                  className="toolbar-button mt-2 px-4 py-2 text-sm font-semibold"
                  disabled={!placeholderAuthEnabled}
                  type="submit"
                >
                  {placeholderAuthEnabled
                    ? "Placeholder Oturumu Ac"
                    : "Production Girisi Kilitli"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
