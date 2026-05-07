import fs from "node:fs/promises";
import path from "node:path";

async function loadManifest() {
  const root = path.resolve(process.cwd(), "..", "..");
  const manifestPath = path.join(root, "config", "legacy-manifest.json");
  return JSON.parse(await fs.readFile(manifestPath, "utf8"));
}

async function getBucketStatus(relativePath: string) {
  const root = path.resolve(process.cwd(), "..", "..");
  const fullPath = path.join(root, relativePath);

  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    const realEntries = entries.filter((entry) => entry.name !== ".gitkeep");

    return {
      count: realEntries.length,
      status: realEntries.length > 0 ? "Hazir" : "Bos",
    };
  } catch {
    return {
      count: 0,
      status: "Eksik",
    };
  }
}

export default async function IntakePage() {
  const manifest = await loadManifest();
  const buckets = await Promise.all(
    manifest.intakeBuckets.map(async (bucket: {
      title: string;
      path: string;
      items: string[];
    }) => ({
      ...bucket,
      ...(await getBucketStatus(bucket.path)),
    })),
  );

  const readyCount = buckets.filter((bucket) => bucket.status === "Hazir").length;

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-4">
      <section className="desktop-window mx-auto max-w-7xl rounded-sm">
        <header className="border-b border-[var(--line-strong)] bg-[var(--accent)] px-4 py-3 text-white">
          <h1 className="text-lg font-bold">Legacy Intake Paneli</h1>
          <p className="mt-1 text-sm text-white/80">
            Legacy materyaller geldikce bu alan Faz 1 audit icin kaynak olacak.
          </p>
        </header>
        <div className="grid gap-px border-b border-[var(--line)] bg-[var(--line)] md:grid-cols-3">
          {[
            ["Toplam Kova", String(buckets.length)],
            ["Hazir Kova", String(readyCount)],
            ["Genel Durum", readyCount > 0 ? "Parcali dolu" : "Bekleniyor"],
          ].map(([label, value]) => (
            <div key={label} className="bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {label}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
            </div>
          ))}
        </div>
        <div className="border-b border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-sm text-slate-700">
          Bu sayfa, root altindaki `legacy/` klasoru icin beklenen kanit setini
          ve mevcut doluluk durumunu gosterir. Dosyalar read-only referans
          olarak ele alinmali.
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
          {buckets.map((bucket) => (
            <article
              key={bucket.title}
              className="border border-[var(--line)] bg-white"
            >
              <div className="border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{bucket.title}</p>
                  <span
                    className={`status-pill px-2 py-1 text-[11px] ${
                      bucket.status === "Hazir"
                        ? "text-[var(--success)]"
                        : "text-slate-600"
                    }`}
                  >
                    {bucket.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600">{bucket.path}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {bucket.count} gercek oge
                </p>
              </div>
              <div className="grid gap-2 p-4">
                {bucket.items.map((item: string) => (
                  <div
                    key={item}
                    className="flex items-center justify-between gap-3 border border-[var(--line)] bg-[#fafbfd] px-3 py-2 text-sm"
                  >
                    <span>{item}</span>
                    <span className="status-pill px-2 py-1 text-[11px] text-slate-600">
                      Bekleniyor
                    </span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
