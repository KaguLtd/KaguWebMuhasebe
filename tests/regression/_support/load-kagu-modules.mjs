import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const requireFromWebApp = createRequire(
  new URL("../../../apps/muhasebe-web/package.json", import.meta.url),
);
const ts = requireFromWebApp("typescript");
const sourceDir = fileURLToPath(
  new URL("../../../apps/muhasebe-web/lib/kagu/", import.meta.url),
);

export function loadKaguModules(fileNames, tempPrefix = "kagu-regression-") {
  const tempDir = mkdtempSync(join(tmpdir(), tempPrefix));

  for (const fileName of fileNames) {
    const source = readFileSync(join(sourceDir, fileName), "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        esModuleInterop: true,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    });

    writeFileSync(join(tempDir, fileName.replace(".ts", ".js")), compiled.outputText);
  }

  return {
    requireTemp: createRequire(join(tempDir, "index.js")),
    tempDir,
  };
}

export function resetKaguGlobals() {
  delete globalThis.__kaguDocumentStore;
  delete globalThis.__kaguMasterStore;
}
