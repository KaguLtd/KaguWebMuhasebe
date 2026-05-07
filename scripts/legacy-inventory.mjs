import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outputPath = path.join(root, "docs", "LEGACY_INVENTORY.md");
const manifestPath = path.join(root, "config", "legacy-manifest.json");

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

async function readBucket(bucket) {
  const fullPath = path.join(root, bucket.path);

  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    const visibleEntries = entries
      .filter((entry) => entry.name !== ".gitkeep")
      .map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? "dir" : "file",
      }));

    return {
      name: bucket.title,
      purpose: bucket.purpose,
      count: visibleEntries.length,
      entries: visibleEntries,
    };
  } catch {
    return {
      name: bucket.title,
      purpose: bucket.purpose,
      count: 0,
      entries: [],
    };
  }
}

function buildMarkdown(results) {
  const generatedAt = new Date().toISOString();
  const totalEntries = results.reduce((sum, item) => sum + item.count, 0);
  const readyBuckets = results.filter((item) => item.count > 0).length;

  const lines = [
    "# Legacy Inventory",
    "",
    `- Generated at: ${generatedAt}`,
    `- Total buckets: ${results.length}`,
    `- Buckets with content: ${readyBuckets}`,
    `- Total visible legacy items: ${totalEntries}`,
    "",
    "| Bucket | Count | Purpose |",
    "| --- | ---: | --- |",
    ...results.map(
      (item) => `| ${item.name} | ${item.count} | ${item.purpose} |`,
    ),
    "",
    "## Details",
    "",
  ];

  for (const item of results) {
    lines.push(`### ${item.name}`);
    if (item.entries.length === 0) {
      lines.push("");
      lines.push("- Bos");
      lines.push("");
      continue;
    }

    lines.push("");
    for (const entry of item.entries) {
      lines.push(`- ${entry.name} (${entry.type})`);
    }
    lines.push("");
  }

  lines.push("## Notes");
  lines.push("");
  lines.push("- Bu rapor yalnizca legacy intake doluluk durumunu ozetler.");
  lines.push("- Finansal parity veya davranis cikarimi icin tek basina yeterli degildir.");
  lines.push("- Legacy artefakt eklendikce bu rapor tekrar uretilmelidir.");
  lines.push("");

  return lines.join("\n");
}

async function main() {
  const results = await Promise.all(manifest.intakeBuckets.map(readBucket));
  const markdown = buildMarkdown(results);

  if (process.argv.includes("--write")) {
    await fs.writeFile(outputPath, markdown, "utf8");
    console.log(`Wrote ${path.relative(root, outputPath)}`);
    return;
  }

  console.log(markdown);
}

await main();
