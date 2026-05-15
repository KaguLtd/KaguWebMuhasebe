import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { loadKaguModules, resetKaguGlobals } from "../_support/load-kagu-modules.mjs";

const fixturePath = fileURLToPath(
  new URL("../fixtures/warehouse-inventory-main.fixture.json", import.meta.url),
);
const goldenCsvPath = fileURLToPath(
  new URL("../fixtures/warehouse-inventory-main.golden.csv", import.meta.url),
);
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const goldenCsv = readFileSync(goldenCsvPath, "utf8").trim();
resetKaguGlobals();
const { requireTemp } = loadKaguModules(
  ["helpers.ts", "config.ts", "document-engine.ts", "store.ts", "reports.ts"],
  "kagu-acceptance-",
);
const engine = requireTemp("./document-engine.js");
const reports = requireTemp("./reports.js");

test("warehouse inventory report matches the product regression fixture", () => {
  resetKaguGlobals();

  for (const operation of fixture.operations) {
    const draft = engine.saveDocumentDraft(operation.entity, operation.payload);

    if (operation.approve !== false) {
      engine.approveDocument(operation.entity, draft.header.id);
    }
  }

  const report = reports.getWarehouseInventoryReport(fixture.reportArgs.warehouseId);

  assert.ok(report, "Warehouse inventory report should resolve for fixture warehouse");
  assert.equal(report.warehouse.id, fixture.reportArgs.warehouseId);
  assert.equal(report.rows.length, fixture.expected.rowCount);
  assert.equal(renderWarehouseInventoryCsv(report.rows), goldenCsv);
});

function renderWarehouseInventoryCsv(rows) {
  const header = "itemCode,itemName,unitLabel,quantity";
  const body = rows.map((row) =>
    [row.itemCode, row.itemName, row.unitLabel ?? "", formatQuantity(row.quantity)].join(","),
  );

  return [header, ...body].join("\n");
}

function formatQuantity(quantity) {
  return Number.isInteger(quantity) ? String(quantity) : String(quantity);
}
