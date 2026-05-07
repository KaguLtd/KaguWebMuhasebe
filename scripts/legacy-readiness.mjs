import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outputPath = path.join(root, "docs", "LEGACY_READYNESS.md");
const manifestPath = path.join(root, "config", "legacy-manifest.json");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

async function countVisibleEntries(relativePath) {
  try {
    const entries = await fs.readdir(path.join(root, relativePath), {
      withFileTypes: true,
    });
    return entries.filter((entry) => entry.name !== ".gitkeep").length;
  } catch {
    return 0;
  }
}

async function countCompletedNotes(relativePath, expectedSlugs) {
  try {
    const entries = await fs.readdir(path.join(root, relativePath), {
      withFileTypes: true,
    });
    const files = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => entry.name.replace(/\.md$/u, ""))
      .filter((name) => !name.endsWith("_TEMPLATE"));

    const matched = expectedSlugs.filter((slug) => files.includes(slug)).length;
    return matched;
  } catch {
    return 0;
  }
}

function buildMarkdown(readiness) {
  const lines = [
    "# Legacy Readiness",
    "",
    `- Generated at: ${new Date().toISOString()}`,
    "",
    "## Intake Buckets",
    "",
    "| Bucket | Count | Status |",
    "| --- | ---: | --- |",
    ...readiness.bucketRows.map(
      (row) => `| ${row.title} | ${row.count} | ${row.status} |`,
    ),
    "",
    "## Capture Coverage",
    "",
    `- Module capture files: ${readiness.moduleCaptures}/${manifest.modules.length}`,
    `- Report capture files: ${readiness.reportCaptures}/${manifest.reports.length}`,
    "",
    "## Next Action",
    "",
    readiness.nextAction,
    "",
  ];

  return lines.join("\n");
}

async function main() {
  const bucketRows = await Promise.all(
    manifest.intakeBuckets.map(async (bucket) => {
      const count = await countVisibleEntries(bucket.path);
      return {
        title: bucket.title,
        count,
        status: count > 0 ? "Hazir" : "Bekleniyor",
      };
    }),
  );

  const moduleCaptures = await countCompletedNotes(
    "legacy/notes/modules",
    manifest.modules,
  );
  const reportCaptures = await countCompletedNotes(
    "legacy/notes/reports",
    manifest.reports,
  );

  const hasScreenshots = bucketRows.find((row) => row.title === "screenshots")?.count > 0;
  const hasReports = bucketRows.find((row) => row.title === "reports")?.count > 0;
  const nextAction =
    hasScreenshots && hasReports
      ? "- Faz 1 legacy audit detaylandirilabilir."
      : "- Ilk olarak `legacy/screenshots` ve `legacy/reports` altina gercek artefakt eklenmeli.";

  const markdown = buildMarkdown({
    bucketRows,
    moduleCaptures,
    reportCaptures,
    nextAction,
  });

  if (process.argv.includes("--write")) {
    await fs.writeFile(outputPath, markdown, "utf8");
    console.log(`Wrote ${path.relative(root, outputPath)}`);
    return;
  }

  console.log(markdown);
}

await main();
