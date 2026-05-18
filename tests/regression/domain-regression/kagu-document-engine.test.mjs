import assert from "node:assert/strict";
import test from "node:test";

import { loadKaguModules, resetKaguGlobals } from "../_support/load-kagu-modules.mjs";

resetKaguGlobals();
const { requireTemp } = loadKaguModules(
  ["helpers.ts", "document-engine.ts"],
  "kagu-engine-",
);
const engine = requireTemp("./document-engine.js");

test("receipt approval posts a single account ledger entry and void unposts it", () => {
  const draft = engine.saveDocumentDraft("receipts", {
    receiptKind: "COLLECTION",
    accountId: "account-customer-1",
    projectId: "project-web",
    docDate: "2026-05-04",
    amountMinor: 12345,
    currency: "TRY",
  });
  const approved = engine.approveDocument("receipts", draft.header.id);

  assert.equal(approved.header.status, "APPROVED");
  assert.match(approved.header.doc_no, /^040526_TAH_\d{6}$/);
  assert.equal(approved.ledgerEntries.length, 1);
  assert.equal(approved.ledgerEntries[0].debitMinor, 0);
  assert.equal(approved.ledgerEntries[0].creditMinor, 12345);

  const voided = engine.voidDocument("receipts", draft.header.id, "test void");

  assert.equal(voided.header.status, "VOID");
  assert.equal(voided.ledgerEntries.length, 0);
});

test("transfer approval creates balanced debit and credit entries", () => {
  const draft = engine.saveDocumentDraft("transfers", {
    fromAccountId: "account-customer-1",
    toAccountId: "account-supplier-1",
    docDate: "2026-05-04",
    amountMinor: 50000,
    currency: "TRY",
  });
  const approved = engine.approveDocument("transfers", draft.header.id);
  const totalDebit = approved.ledgerEntries.reduce(
    (sum, entry) => sum + entry.debitMinor,
    0,
  );
  const totalCredit = approved.ledgerEntries.reduce(
    (sum, entry) => sum + entry.creditMinor,
    0,
  );

  assert.equal(approved.header.status, "APPROVED");
  assert.match(approved.header.doc_no, /^040526_VIR_\d{6}$/);
  assert.equal(approved.ledgerEntries.length, 2);
  assert.equal(totalDebit, 50000);
  assert.equal(totalCredit, 50000);
});

test("sales invoice approval posts receivable debit and outbound stock movement", () => {
  const draft = engine.saveDocumentDraft("invoices", {
    invoiceKind: "SALES",
    invoiceType: "STANDARD",
    actualDocNo: "FAT-TEST-001",
    accountId: "account-customer-1",
    projectId: "project-web",
    warehouseId: "warehouse-main",
    docDate: "2026-05-04",
    currency: "TRY",
    discountBps: 0,
    lines: [
      {
        itemId: "item-erp-service",
        description: "Test hizmet",
        quantity: 2,
        unitPriceMinor: 10000,
        vatRateBps: 2000,
      },
    ],
  });
  const approved = engine.approveDocument("invoices", draft.header.id);

  assert.equal(approved.header.status, "APPROVED");
  assert.match(approved.header.doc_no, /^040526_SF_\d{6}$/);
  assert.equal(approved.header.document_total_minor, 24000);
  assert.equal(approved.ledgerEntries[0].debitMinor, 24000);
  assert.equal(approved.ledgerEntries[0].creditMinor, 0);
  assert.equal(approved.stockMovements[0].qtyIn, 0);
  assert.equal(approved.stockMovements[0].qtyOut, 2);
});

test("invoice draft save reserves document number consistently", () => {
  const draft = engine.saveDocumentDraft("invoices", {
    invoiceKind: "SALES",
    invoiceType: "STAR",
    accountId: "account-customer-1",
    warehouseId: "warehouse-main",
    docDate: "2026-05-04",
    currency: "TRY",
    lines: [
      {
        itemId: "item-erp-service",
        quantity: 1,
        unitPriceMinor: 100,
        vatRateBps: 0,
      },
    ],
  });

  assert.match(draft.header.doc_no, /^040526_SF_\d{6}$/);
  assert.equal(draft.header.actual_doc_no, draft.header.doc_no);
  assert.equal(draft.header.status, "DRAFT");
});

test("invoice total follows header-discount rounding allocation", () => {
  const draft = engine.saveDocumentDraft("invoices", {
    invoiceKind: "SALES",
    invoiceType: "STANDARD",
    actualDocNo: "FAT-ROUND-001",
    accountId: "account-customer-1",
    warehouseId: "warehouse-main",
    docDate: "2026-05-04",
    currency: "TRY",
    discountBps: 1250,
    lines: [
      {
        itemId: "item-erp-service",
        quantity: 1,
        unitPriceMinor: 99,
        vatRateBps: 1,
      },
      {
        itemId: "item-raw-steel",
        quantity: 1,
        unitPriceMinor: 100,
        vatRateBps: 2000,
      },
    ],
  });

  assert.equal(draft.header.net_total_minor, 174);
  assert.equal(draft.header.vat_total_minor, 17);
  assert.equal(draft.header.document_total_minor, 191);
});

test("return delivery notes flip stock direction", () => {
  const draft = engine.saveDocumentDraft("deliveryNotes", {
    direction: "OUT",
    isReturn: true,
    actualDocNo: "IRS-IADE-001",
    accountId: "account-customer-1",
    projectId: "project-web",
    warehouseId: "warehouse-main",
    docDate: "2026-05-04",
    lines: [
      {
        itemId: "item-raw-steel",
        quantity: 3,
        unitPriceMinor: 0,
        vatRateBps: 2000,
      },
    ],
  });
  const approved = engine.approveDocument("deliveryNotes", draft.header.id);

  assert.equal(approved.stockMovements[0].qtyIn, 3);
  assert.equal(approved.stockMovements[0].qtyOut, 0);
});

test("customer delivery notes only allow OUT direction, including returns", () => {
  assert.throws(
    () =>
      engine.saveDocumentDraft("deliveryNotes", {
        direction: "IN",
        actualDocNo: "IRS-CUST-IN-001",
        accountId: "account-customer-1",
        warehouseId: "warehouse-main",
        docDate: "2026-05-04",
        lines: [
          {
            itemId: "item-raw-steel",
            quantity: 1,
            unitPriceMinor: 0,
            vatRateBps: 2000,
          },
        ],
      }),
    /Musteri carilerde yalnizca cikis irsaliyesi kesilebilir\./,
  );

  const normal = engine.saveDocumentDraft("deliveryNotes", {
    direction: "OUT",
    actualDocNo: "IRS-CUST-OUT-001",
    accountId: "account-customer-1",
    warehouseId: "warehouse-main",
    docDate: "2026-05-04",
    lines: [
      {
        itemId: "item-raw-steel",
        quantity: 1,
        unitPriceMinor: 0,
        vatRateBps: 2000,
      },
    ],
  });
  const returned = engine.saveDocumentDraft("deliveryNotes", {
    direction: "OUT",
    isReturn: true,
    actualDocNo: "IRS-CUST-RETURN-001",
    accountId: "account-customer-1",
    warehouseId: "warehouse-main",
    docDate: "2026-05-04",
    lines: [
      {
        itemId: "item-raw-steel",
        quantity: 1,
        unitPriceMinor: 0,
        vatRateBps: 2000,
      },
    ],
  });

  assert.equal(engine.approveDocument("deliveryNotes", normal.header.id).header.status, "APPROVED");
  assert.equal(engine.approveDocument("deliveryNotes", returned.header.id).header.status, "APPROVED");
});

test("supplier delivery notes only allow IN direction, including returns", () => {
  assert.throws(
    () =>
      engine.saveDocumentDraft("deliveryNotes", {
        direction: "OUT",
        actualDocNo: "IRS-SUP-OUT-001",
        accountId: "account-supplier-1",
        warehouseId: "warehouse-main",
        docDate: "2026-05-04",
        lines: [
          {
            itemId: "item-raw-steel",
            quantity: 1,
            unitPriceMinor: 0,
            vatRateBps: 2000,
          },
        ],
      }),
    /Tedarikci carilerde yalnizca giris irsaliyesi kesilebilir\./,
  );

  const normal = engine.saveDocumentDraft("deliveryNotes", {
    direction: "IN",
    actualDocNo: "IRS-SUP-IN-001",
    accountId: "account-supplier-1",
    warehouseId: "warehouse-main",
    docDate: "2026-05-04",
    lines: [
      {
        itemId: "item-raw-steel",
        quantity: 1,
        unitPriceMinor: 0,
        vatRateBps: 2000,
      },
    ],
  });
  const returned = engine.saveDocumentDraft("deliveryNotes", {
    direction: "IN",
    isReturn: true,
    actualDocNo: "IRS-SUP-RETURN-001",
    accountId: "account-supplier-1",
    warehouseId: "warehouse-main",
    docDate: "2026-05-04",
    lines: [
      {
        itemId: "item-raw-steel",
        quantity: 1,
        unitPriceMinor: 0,
        vatRateBps: 2000,
      },
    ],
  });

  assert.equal(engine.approveDocument("deliveryNotes", normal.header.id).header.status, "APPROVED");
  assert.equal(engine.approveDocument("deliveryNotes", returned.header.id).header.status, "APPROVED");
});

test("both account delivery notes allow IN and OUT directions", () => {
  const out = engine.saveDocumentDraft("deliveryNotes", {
    direction: "OUT",
    actualDocNo: "IRS-BOTH-OUT-001",
    accountId: "account-both-1",
    warehouseId: "warehouse-main",
    docDate: "2026-05-04",
    lines: [
      {
        itemId: "item-raw-steel",
        quantity: 1,
        unitPriceMinor: 0,
        vatRateBps: 2000,
      },
    ],
  });
  const inbound = engine.saveDocumentDraft("deliveryNotes", {
    direction: "IN",
    actualDocNo: "IRS-BOTH-IN-001",
    accountId: "account-both-1",
    warehouseId: "warehouse-main",
    docDate: "2026-05-04",
    lines: [
      {
        itemId: "item-raw-steel",
        quantity: 1,
        unitPriceMinor: 0,
        vatRateBps: 2000,
      },
    ],
  });

  assert.equal(engine.approveDocument("deliveryNotes", out.header.id).header.status, "APPROVED");
  assert.equal(engine.approveDocument("deliveryNotes", inbound.header.id).header.status, "APPROVED");
});

test("invoice lines linked to delivery lines move stock effect from delivery to invoice", () => {
  const delivery = engine.saveDocumentDraft("deliveryNotes", {
    direction: "OUT",
    actualDocNo: "IRS-LINK-001",
    accountId: "account-customer-1",
    projectId: "project-web",
    warehouseId: "warehouse-main",
    docDate: "2026-05-04",
    lines: [
      {
        itemId: "item-raw-steel",
        quantity: 4,
        unitPriceMinor: 0,
        vatRateBps: 2000,
      },
    ],
  });
  const lineId = delivery.lines[0].id;
  engine.approveDocument("deliveryNotes", delivery.header.id);

  const invoice = engine.saveDocumentDraft("invoices", {
    invoiceKind: "SALES",
    invoiceType: "STANDARD",
    actualDocNo: "FAT-LINK-001",
    accountId: "account-customer-1",
    warehouseId: "warehouse-main",
    docDate: "2026-05-04",
    currency: "TRY",
    lines: [
      {
        itemId: "item-raw-steel",
        quantity: 4,
        unitPriceMinor: 100,
        vatRateBps: 2000,
        sourceDeliveryLineIds: [lineId],
      },
    ],
  });
  const approved = engine.approveDocument("invoices", invoice.header.id);

  assert.equal(approved.ledgerEntries.length, 1);
  assert.equal(approved.stockMovements.length, 1);
  assert.equal(approved.stockMovements[0].qtyOut, 4);
  const restoredDelivery = engine.getDocument("deliveryNotes", delivery.header.id);
  assert.equal(restoredDelivery.header.is_effective, false);
  assert.equal(restoredDelivery.header.invoiced_by_invoice_id, invoice.header.id);
});

test("account balances and item stock are derived from effective posted movements", () => {
  const accountId = "account-derived-balance";
  const itemId = "item-derived-stock";
  const receipt = engine.saveDocumentDraft("receipts", {
    receiptKind: "COLLECTION",
    accountId,
    docDate: "2026-05-04",
    amountMinor: 8000,
    currency: "TRY",
  });
  const invoice = engine.saveDocumentDraft("invoices", {
    invoiceKind: "SALES",
    invoiceType: "STANDARD",
    actualDocNo: "FAT-BAL-001",
    accountId,
    warehouseId: "warehouse-main",
    docDate: "2026-05-04",
    currency: "TRY",
    lines: [
      {
        itemId,
        quantity: 3,
        unitPriceMinor: 1000,
        vatRateBps: 2000,
      },
    ],
  });

  engine.approveDocument("receipts", receipt.header.id);
  engine.approveDocument("invoices", invoice.header.id);

  assert.equal(engine.getAccountBalanceMinor(accountId), 3600);
  assert.equal(engine.getItemStockQuantity(itemId), -3);
});

test("invoice metrics use net sales and latest purchase fallback cost", () => {
  const itemId = "item-metrics-profit";
  const purchase = engine.saveDocumentDraft("invoices", {
    invoiceKind: "PURCHASE",
    invoiceType: "STANDARD",
    actualDocNo: "AF-METRIC-001",
    accountId: "account-supplier-1",
    warehouseId: "warehouse-main",
    docDate: "2026-05-04",
    currency: "TRY",
    lines: [
      {
        itemId,
        quantity: 10,
        unitPriceMinor: 400,
        vatRateBps: 2000,
      },
    ],
  });
  const sales = engine.saveDocumentDraft("invoices", {
    invoiceKind: "SALES",
    invoiceType: "STANDARD",
    actualDocNo: "SF-METRIC-001",
    accountId: "account-customer-1",
    warehouseId: "warehouse-main",
    docDate: "2026-05-05",
    currency: "TRY",
    lines: [
      {
        itemId,
        quantity: 2,
        unitPriceMinor: 1000,
        vatRateBps: 2000,
      },
    ],
  });

  engine.approveDocument("invoices", purchase.header.id);
  engine.approveDocument("invoices", sales.header.id);

  const metrics = engine.getInvoiceMetrics(sales.header.id);

  assert.equal(metrics.invoiceNetTotalMinor, 2000);
  assert.equal(metrics.invoiceGrossTotalMinor, 2400);
  assert.equal(metrics.costTotalMinor, 800);
  assert.equal(metrics.profitMinor, 1200);
  assert.equal(metrics.marginPercent, 60);
});
