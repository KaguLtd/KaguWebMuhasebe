import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const requireFromWebApp = createRequire(
  new URL("../../apps/muhasebe-web/package.json", import.meta.url),
);
const ts = requireFromWebApp("typescript");
const helperPath = fileURLToPath(
  new URL("../../apps/muhasebe-web/lib/kagu/helpers.ts", import.meta.url),
);
const source = readFileSync(helperPath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
});
const moduleContext = { exports: {} };

vm.runInNewContext(compiled.outputText, {
  Intl,
  module: moduleContext,
  exports: moduleContext.exports,
});

const helpers = moduleContext.exports;

test("money values keep legacy minor-unit integer semantics", () => {
  assert.equal(helpers.parseMoneyToMinor("1.234,56 TRY"), 123456);
  assert.equal(helpers.parseMoneyToMinor(12.34), 1234);
  assert.equal(helpers.formatMinor(123456, "TRY"), "1.234,56 TRY");
});

test("vat rates are stored as basis points and shown as percentage", () => {
  assert.equal(helpers.formatRateBps(2000), "20%");
  assert.equal(helpers.formatRateBps(1750), "17,5%");
});
