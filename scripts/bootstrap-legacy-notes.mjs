import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const notesRoot = path.join(root, "legacy", "notes");
const modulesRoot = path.join(notesRoot, "modules");
const reportsRoot = path.join(notesRoot, "reports");
const manifestPath = path.join(root, "config", "legacy-manifest.json");

const moduleTemplatePath = path.join(notesRoot, "MODULE_CAPTURE_TEMPLATE.md");
const reportTemplatePath = path.join(notesRoot, "REPORT_CAPTURE_TEMPLATE.md");

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

function titleize(slug) {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function ensureFileFromTemplate(targetPath, template, replacements) {
  try {
    await fs.access(targetPath);
    return false;
  } catch {
    let content = template;
    for (const [needle, value] of replacements) {
      content = content.replace(needle, value);
    }
    await fs.writeFile(targetPath, content, "utf8");
    return true;
  }
}

async function main() {
  await ensureDir(modulesRoot);
  await ensureDir(reportsRoot);

  const moduleTemplate = await fs.readFile(moduleTemplatePath, "utf8");
  const reportTemplate = await fs.readFile(reportTemplatePath, "utf8");

  let createdModules = 0;
  let createdReports = 0;

  for (const slug of manifest.modules) {
    const filePath = path.join(modulesRoot, `${slug}.md`);
    const created = await ensureFileFromTemplate(filePath, moduleTemplate, [
      ["- Ad:", `- Ad: ${titleize(slug)}`],
      ["- Menu yolu:", "- Menu yolu: Belirsiz / tekrar kontrol edilmeli"],
      ["- Risk seviyesi:", "- Risk seviyesi: Belirsiz / tekrar kontrol edilmeli"],
    ]);
    if (created) createdModules += 1;
  }

  for (const slug of manifest.reports) {
    const filePath = path.join(reportsRoot, `${slug}.md`);
    const created = await ensureFileFromTemplate(filePath, reportTemplate, [
      ["- Ad:", `- Ad: ${titleize(slug)}`],
      ["- Modul:", "- Modul: Belirsiz / tekrar kontrol edilmeli"],
      ["- Ornek dosya:", "- Ornek dosya: Belirsiz / tekrar kontrol edilmeli"],
    ]);
    if (created) createdReports += 1;
  }

  console.log(`Created module notes: ${createdModules}`);
  console.log(`Created report notes: ${createdReports}`);
}

await main();
