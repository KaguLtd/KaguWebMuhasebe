import assert from "node:assert/strict";
import test from "node:test";

import { loadKaguModules, resetKaguGlobals } from "../_support/load-kagu-modules.mjs";

resetKaguGlobals();
const { requireTemp } = loadKaguModules(["helpers.ts"], "kagu-money-");
const helpers = requireTemp("./helpers.js");

test("money values keep legacy minor-unit integer semantics", () => {
  assert.equal(helpers.parseMoneyToMinor("1.234,56 TRY"), 123456);
  assert.equal(helpers.parseMoneyToMinor(12.34), 1234);
  assert.equal(helpers.formatMinor(123456, "TRY"), "1.234,56 TRY");
});

test("vat rates are stored as basis points and shown as percentage", () => {
  assert.equal(helpers.formatRateBps(2000), "20%");
  assert.equal(helpers.formatRateBps(1750), "17,5%");
});
