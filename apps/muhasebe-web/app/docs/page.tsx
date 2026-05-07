import fs from "node:fs/promises";
import path from "node:path";

const docFiles = [
  "INDEX.md",
  "MIGRATION_PLAN.md",
  "DECISIONS.md",
  "LEGACY_AUDIT.md",
  "LEGACY_INVENTORY.md",
  "LEGACY_READYNESS.md",
  "MODULE_PARITY.md",
  "DATA_MODEL.md",
  "UI_PARITY.md",
  "REPORTS_PARITY.md",
  "DATA_MIGRATION.md",
  "DEPLOYMENT.md",
  "SUBAGENT_PLAN.md",
];

export default async function DocsPage() {
  const docsRoot = path.resolve(process.cwd(), "..", "..", "docs");

  const docs = await Promise.all(
    docFiles.map(async (file) => {
      const fullPath = path.join(docsRoot, file);
      const content = await fs.readFile(fullPath, "utf8");

      return {
        file,
        preview: content.split("\n").slice(0, 18).join("\n"),
        lineCount: content.split("\n").length,
      };
    }),
  );

  const readinessDoc = docs.find((doc) => doc.file === "LEGACY_READYNESS.md");
  const legacyStatus = readinessDoc?.preview.includes("Faz 1 legacy audit")
    ? "Audit acilabilir"
    : "Legacy bekleniyor";

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-4">
      <section className="desktop-window mx-auto max-w-7xl rounded-sm">
        <header className="border-b border-[var(--line-strong)] bg-[var(--accent)] px-4 py-3 text-white">
          <h1 className="text-lg font-bold">Planlama Dokumantasyonu</h1>
          <p className="mt-1 text-sm text-white/80">
            Root docs klasorunden ilk faz ciktilari okunuyor.
          </p>
        </header>
        <div className="grid gap-px border-b border-[var(--line)] bg-[var(--line)] md:grid-cols-3">
          {[
            ["Toplam Dokuman", String(docs.length)],
            ["Legacy Durumu", legacyStatus],
            ["Web Faz", "Faz 3 aktif"],
          ].map(([label, value]) => (
            <div key={label} className="bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {label}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          {docs.map((doc) => (
            <article
              key={doc.file}
              className="border border-[var(--line)] bg-white"
            >
              <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2 text-sm font-semibold">
                <span>{doc.file}</span>
                <span className="status-pill px-2 py-1 text-[11px] font-normal text-slate-600">
                  {doc.lineCount} satir
                </span>
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap px-4 py-3 text-xs leading-5 text-slate-700">
                {doc.preview}
              </pre>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
