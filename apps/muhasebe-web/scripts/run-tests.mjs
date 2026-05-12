import { readdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const testRoots = [resolve(appRoot, "tests"), resolve(appRoot, "..", "..", "tests", "parity")];

async function collectTests(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectTests(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".test.mjs")) {
      files.push(fullPath);
    }
  }

  return files;
}

const testFiles = (await Promise.all(testRoots.map(collectTests)))
  .flat()
  .sort()
  .map((file) => relative(appRoot, file));

const result = spawnSync(
  process.execPath,
  [
    "--import",
    "./tests/runtime/register-hooks.mjs",
    "--test",
    "--test-concurrency=1",
    ...testFiles,
  ],
  { cwd: appRoot, stdio: "inherit" },
);

process.exit(result.status ?? 1);
