import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ auth?: string; next?: string }>;
}) {
  const params = await searchParams;
  const authMessage =
    params?.auth === "locked"
      ? "Oturumunuz sona erdi. Devam etmek icin yeniden giris yapin."
      : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-10">
      <section className="desktop-window w-full max-w-5xl overflow-hidden rounded-sm">
        <div className="border-b border-[var(--line-strong)] bg-[var(--accent)] px-4 py-3 text-sm font-bold tracking-[0.18em] text-white">
          KAGU LTD. MUHASEBE WEB
        </div>
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="border-r border-[var(--line)] bg-[var(--panel)] p-6">
            <div className="mb-4 flex items-center justify-between border border-[var(--line)] bg-white px-4 py-2 text-sm">
              <span className="font-semibold">Operasyon Modulleri</span>
              <span className="status-pill px-2 py-1 text-xs text-[var(--warning)]">
                Web Paneli
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
                    Yetkiya bagli erisim ve web akislari uzerinden yonetilir.
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-6 border border-dashed border-[var(--line)] bg-white/70 px-4 py-3 text-xs leading-6 text-slate-600">
              Kullanici girisi, ayarlar ve ana operasyon modulleri ayni oturum
              modeliyle calisir. Bu panel yerel kabul testleri ve urun regresyon
              kontrolleriyle dogrudan uretim akisini destekler.
            </div>
          </div>
          <div className="bg-[#e5ebf3] p-6">
            <LoginForm authMessage={authMessage} nextPath={params?.next} />
          </div>
        </div>
      </section>
    </main>
  );
}
