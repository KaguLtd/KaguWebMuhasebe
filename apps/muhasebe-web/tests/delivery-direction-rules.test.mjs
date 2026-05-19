import assert from "node:assert/strict";
import test from "node:test";

import {
  assertDeliveryDirectionAllowedForAccount,
  signedQuantityForMerge,
  validateMergeSources,
} from "../lib/kagu/document-repository.ts";

test("delivery direction is locked by account kind", () => {
  assert.doesNotThrow(() =>
    assertDeliveryDirectionAllowedForAccount("CUSTOMER", { direction: "OUT" }),
  );
  assert.throws(
    () => assertDeliveryDirectionAllowedForAccount("CUSTOMER", { direction: "IN" }),
    /Müşteri carilerde yalnızca çıkış irsaliyesi kesilebilir\./,
  );

  assert.doesNotThrow(() =>
    assertDeliveryDirectionAllowedForAccount("SUPPLIER", { direction: "IN" }),
  );
  assert.throws(
    () => assertDeliveryDirectionAllowedForAccount("SUPPLIER", { direction: "OUT" }),
    /Tedarikçi carilerde yalnızca giriş irsaliyesi kesilebilir\./,
  );

  assert.doesNotThrow(() =>
    assertDeliveryDirectionAllowedForAccount("BOTH", { direction: "IN" }),
  );
  assert.doesNotThrow(() =>
    assertDeliveryDirectionAllowedForAccount("BOTH", { direction: "OUT" }),
  );
});

test("merge signed quantity follows direction plus isReturn", () => {
  assert.equal(signedQuantityForMerge("OUT", false, 5, "SALES_OUT"), 5);
  assert.equal(signedQuantityForMerge("OUT", true, 5, "SALES_OUT"), -5);
  assert.throws(
    () => signedQuantityForMerge("IN", false, 5, "SALES_OUT"),
    /Secilen irsaliye net akis tipiyle uyumlu degil/,
  );

  assert.equal(signedQuantityForMerge("IN", false, 7, "PURCHASE_IN"), 7);
  assert.equal(signedQuantityForMerge("IN", true, 7, "PURCHASE_IN"), -7);
  assert.throws(
    () => signedQuantityForMerge("OUT", false, 7, "PURCHASE_IN"),
    /Secilen irsaliye net akis tipiyle uyumlu degil/,
  );
});

test("merge validation rejects sources with a direction outside the flow", () => {
  const base = {
    accountId: "account-customer-1",
    id: "delivery-1",
    invoicedByInvoiceId: null,
    isEffective: true,
    isReturn: false,
    mergeRole: "NORMAL",
    projectId: null,
    status: "APPROVED",
    warehouseId: "warehouse-main",
  };

  assert.doesNotThrow(() =>
    validateMergeSources(
      [
        { ...base, direction: "OUT", id: "delivery-1" },
        { ...base, direction: "OUT", id: "delivery-2", isReturn: true },
      ],
      "SALES_OUT",
    ),
  );
  assert.throws(
    () =>
      validateMergeSources(
        [
          { ...base, direction: "OUT", id: "delivery-1" },
          { ...base, direction: "IN", id: "delivery-2" },
        ],
        "SALES_OUT",
      ),
    /Secilen irsaliye net akis tipiyle uyumlu degil/,
  );

  assert.doesNotThrow(() =>
    validateMergeSources(
      [
        { ...base, direction: "IN", id: "delivery-1" },
        { ...base, direction: "IN", id: "delivery-2", isReturn: true },
      ],
      "PURCHASE_IN",
    ),
  );
  assert.throws(
    () =>
      validateMergeSources(
        [
          { ...base, direction: "IN", id: "delivery-1" },
          { ...base, direction: "OUT", id: "delivery-2" },
        ],
        "PURCHASE_IN",
      ),
    /Secilen irsaliye net akis tipiyle uyumlu degil/,
  );
});
