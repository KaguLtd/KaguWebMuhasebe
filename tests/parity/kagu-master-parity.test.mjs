import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

const requireFromWebApp = createRequire(
  new URL("../../apps/muhasebe-web/package.json", import.meta.url),
);
const ts = requireFromWebApp("typescript");
const sourceDir = fileURLToPath(
  new URL("../../apps/muhasebe-web/lib/kagu/", import.meta.url),
);
const tempDir = mkdtempSync(join(tmpdir(), "kagu-master-"));

for (const fileName of [
  "config.ts",
  "helpers.ts",
  "document-engine.ts",
  "store.ts",
  "document-guards.ts",
]) {
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

const requireTemp = createRequire(join(tempDir, "store.js"));
const store = requireTemp("./store.js");
const guards = requireTemp("./document-guards.js");

test("D1 account and item code suggestions keep legacy prefixes", () => {
  assert.equal(
    store.suggestNextCode("accounts", { accountKind: "CUSTOMER" }),
    "120.MUS.002",
  );
  assert.equal(
    store.suggestNextCode("accounts", { accountKind: "SUPPLIER" }),
    "320.TED.002",
  );
  assert.equal(
    store.suggestNextCode("items", { classId: "class-hammadde" }),
    "HMA_MLZ_002",
  );
});

test("saveMaster falls back to the D1-style generated code", () => {
  const account = store.saveMaster("accounts", {
    accountKind: "CUSTOMER",
    currency: "TRY",
    name: "Yeni Musteri",
  });

  assert.equal(account.code, "120.MUS.002");
});

test("project lookups carry account ownership for D1 project filtering", () => {
  const project = store.getLookups("projects").find((item) => item.id === "project-web");

  assert.equal(project.accountId, "account-customer-1");
  assert.equal(project.accountCode, "120.MUS.001");
});

test("document parity guard blocks account currency mismatch", () => {
  assert.throws(
    () =>
      guards.assertDraftDocumentParity("receipts", {
        accountId: "account-customer-1",
        amountMinor: 1000,
        currency: "USD",
        docDate: "2026-05-04",
        receiptKind: "COLLECTION",
      }),
    /Cari doviz kuru TRY/,
  );
});

test("document parity guard blocks projects from another account", () => {
  assert.throws(
    () =>
      guards.assertDraftDocumentParity("invoices", {
        accountId: "account-supplier-1",
        currency: "TRY",
        docDate: "2026-05-04",
        invoiceKind: "PURCHASE",
        invoiceType: "STANDARD",
        projectId: "project-web",
      }),
    /Secilen proje bu cariye bagli degil/,
  );
});

test("different-currency transfers require a cross rate", () => {
  const usdAccount = store.saveMaster("accounts", {
    accountKind: "SUPPLIER",
    currency: "USD",
    name: "USD Tedarikci",
  });

  assert.throws(
    () =>
      guards.assertDraftDocumentParity("transfers", {
        amountMinor: 1000,
        currency: "TRY",
        docDate: "2026-05-04",
        fromAccountId: "account-customer-1",
        toAccountId: usdAccount.id,
      }),
    /capraz kur zorunludur/,
  );
});
