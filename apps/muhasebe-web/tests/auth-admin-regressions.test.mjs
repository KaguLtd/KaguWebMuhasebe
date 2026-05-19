import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { resetTestState, setPrismaMock } from "./runtime/mock-state.mjs";

beforeEach(() => {
  resetTestState();
});

async function importAppModule(relativePath) {
  const url = new URL(`../${relativePath}?t=${Date.now()}-${Math.random()}`, import.meta.url);
  return import(url);
}

test("login auth source wires lockout storage with 5 failures over 15 minutes", async () => {
  const [authSource, lockoutSource] = await Promise.all([
    readFile(new URL("../lib/auth/server.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/auth/lockout.ts", import.meta.url), "utf8"),
  ]);

  assert.match(authSource, /assertLoginAllowed|recordLoginFailure|clearLoginFailures/);
  assert.match(lockoutSource, /lockedUntil|failureCount/);
  assert.match(lockoutSource, /15\s*\*\s*60|900_?000|minutes?\s*[:=]\s*15/i);
  assert.match(lockoutSource, /MAX_LOGIN_FAILURES\s*=\s*5|failureCount\s*>?=\s*5/);
});

test("updateUser blocks removing or deactivating the last active admin", async () => {
  const { updateUser } = await importAppModule("lib/admin/user-repository.ts");
  let updateCalled = 0;

  setPrismaMock({
    role: {
      findMany: async () => [{ id: "role-accountant", key: "ACCOUNTANT" }],
    },
    user: {
      count: async () => 1,
      findUnique: async ({ where }) => {
        if (where.id === "user-1") {
          return {
            displayName: "Admin User",
            email: "admin@test.local",
            id: "user-1",
            isActive: true,
            passwordHash: "scrypt$salt$hash",
            roles: [{ role: { key: "ADMIN" }, roleId: "role-admin" }],
            sessions: [],
            username: "admin",
          };
        }

        return null;
      },
      update: async () => {
        updateCalled += 1;
        return {
          displayName: "Admin User",
          email: "admin@test.local",
          id: "user-1",
          isActive: false,
          passwordHash: "scrypt$salt$hash",
          roles: [{ role: { key: "ACCOUNTANT" }, roleId: "role-accountant" }],
          sessions: [],
          username: "admin",
        };
      },
    },
  });

  await assert.rejects(
    updateUser("user-1", {
      isActive: false,
      roleIds: ["role-accountant"],
    }),
  );
  assert.equal(updateCalled, 0);
});

test("audit writes require actorUserId in document and master repositories", async () => {
  const [documentSource, masterSource] = await Promise.all([
    readFile(new URL("../lib/kagu/document-repository.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/kagu/master-repository.ts", import.meta.url), "utf8"),
  ]);

  assert.match(documentSource, /actorUserId/);
  assert.match(masterSource, /actorUserId/);
});

test("document repository keeps history through supersede flow and period lock checks", async () => {
  const source = await readFile(
    new URL("../lib/kagu/document-repository.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /SUPERSEDED/);
  assert.match(source, /DbDocumentStatus\.SUPERSEDED/);
  assert.match(source, /deactivateDocumentEffects/);
  assert.match(source, /assertPeriodLockAllows/);
  assert.match(source, /CREATE_REVISION_DRAFT|SUPERSEDE/);
});

test("user-facing config labels and document list column order stay Turkish", async () => {
  const { documentModules, accountKindOptions, workspaceMenu } = await importAppModule("lib/kagu/config.ts");
  const delivery = documentModules.find((module) => module.entity === "deliveryNotes");
  const invoices = documentModules.find((module) => module.entity === "invoices");

  assert.deepEqual(
    delivery.columns.map((column) => column.title),
    [
      "Tarih",
      "Cari",
      "Proje",
      "Sistem Evrak No",
      "Harici Evrak No",
      "İrsaliye Tipi",
      "Hareket Yönü",
      "İade",
      "Durum",
    ],
  );
  assert.deepEqual(
    invoices.columns.map((column) => column.title),
    [
      "Tarih",
      "Cari",
      "Proje",
      "Sistem Evrak No",
      "Harici Evrak No",
      "Fatura Türü",
      "Durum",
      "Yıldız",
      "Toplam",
    ],
  );
  assert(accountKindOptions.some((option) => option.label === "Müşteri"));
  assert(workspaceMenu.some((item) => item.title === "Panel"));

  const configSource = await readFile(new URL("../lib/kagu/config.ts", import.meta.url), "utf8");
  assert.doesNotMatch(configSource, /Doviz Kuru/);
});

test("dashboard invoice totals include only approved effective 120 account invoices by currency", async () => {
  const { getDbDashboardTotals } = await importAppModule("lib/kagu/report-repository.ts");
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");

  setPrismaMock({
    deliveryNote: { count: async () => 0 },
    invoice: {
      count: async () => 0,
      findMany: async ({ where }) => {
        assert.equal(where.status, "APPROVED");
        assert.equal(where.isEffective, true);
        assert.deepEqual(where.account, { code: { startsWith: "120" } });
        assert(where.docDate.gte instanceof Date);

        return [
          {
            currency: "TRY",
            docDate: new Date(`${year}-${month}-02T00:00:00.000Z`),
            documentTotalMinor: 1000,
            invoiceKind: "SALES",
          },
        ];
      },
    },
    item: { findMany: async () => [] },
    receipt: { count: async () => 0 },
    stockMovement: { groupBy: async () => [] },
    transfer: { count: async () => 0 },
  });

  const totals = await getDbDashboardTotals();

  assert.equal(totals.invoiceTotalsByCurrency.TRY.monthlyMinor, 1000);
  assert.equal(totals.invoiceTotalsByCurrency.TRY.yearlyMinor, 1000);
  assert.equal(totals.invoiceTotalsByCurrency.USD.yearlyMinor, 0);
  assert.equal(totals.invoiceTotalsByCurrency.EUR.yearlyMinor, 0);
});

test("admin bootstrap default user uses scrypt hash and keeps existing password", async () => {
  const {
    DEFAULT_ADMIN_PASSWORD_HASH,
    DEFAULT_ADMIN_USERNAME,
    ensureDefaultAdminUser,
  } = await import(new URL("../scripts/admin-bootstrap-shared.mjs", import.meta.url));
  const calls = [];
  const existingPasswordHash = "scrypt$existing$hash";
  const prisma = {
    user: {
      create: async ({ data }) => {
        calls.push(["create", data]);
        return { id: "user-default", ...data };
      },
      findUnique: async () => null,
      update: async ({ data }) => {
        calls.push(["update", data]);
        return { id: "user-default", username: DEFAULT_ADMIN_USERNAME, ...data };
      },
    },
    userRole: {
      createMany: async ({ data, skipDuplicates }) => {
        calls.push(["role", { data, skipDuplicates }]);
      },
    },
  };

  await ensureDefaultAdminUser(prisma, { adminRoleId: "role-admin" });
  assert.match(DEFAULT_ADMIN_PASSWORD_HASH, /^scrypt\$[a-f0-9]+\$[a-f0-9]+$/);
  assert.equal(calls[0][1].username, DEFAULT_ADMIN_USERNAME);
  assert.equal(calls[0][1].passwordHash, DEFAULT_ADMIN_PASSWORD_HASH);

  prisma.user.findUnique = async () => ({
    displayName: "Ahmet Can",
    id: "user-default",
    isActive: false,
    passwordHash: existingPasswordHash,
    username: DEFAULT_ADMIN_USERNAME,
  });
  calls.length = 0;
  await ensureDefaultAdminUser(prisma, { adminRoleId: "role-admin" });
  assert.equal(calls[0][0], "update");
  assert.equal(Object.hasOwn(calls[0][1], "passwordHash"), false);

  const sharedSource = await readFile(
    new URL("../scripts/admin-bootstrap-shared.mjs", import.meta.url),
    "utf8",
  );
  assert.equal(sharedSource.includes(["616", "800", "asd"].join("")), false);
});

test("delivery merge and invoicing workflows keep separate semantic fields", async () => {
  const [schemaSource, repositorySource] = await Promise.all([
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(new URL("../lib/kagu/document-repository.ts", import.meta.url), "utf8"),
  ]);

  assert.match(schemaSource, /invoicedByInvoiceId\s+String\?/);
  assert.match(schemaSource, /invoiced_by_invoice_id/);
  assert.match(schemaSource, /@@index\(\[invoicedByInvoiceId\]\)/);
  assert.match(schemaSource, /model DeliveryNoteMergeSource/);
  assert.match(schemaSource, /model DeliveryNoteLineSource/);
  assert.match(schemaSource, /signedQuantity\s+Decimal/);
  assert.match(repositorySource, /createDbMergedDeliveryNoteDraft/);
  assert.match(repositorySource, /unmergeDbDeliveryNote/);
  assert.match(repositorySource, /finalizeInvoiceDeliveryTransfer/);
  assert.match(repositorySource, /restoreDeliveryNotesFromVoidedInvoice/);
  assert.match(repositorySource, /B-Irsaliye iptal edilemez; Birlesimi Coz kullanilmalidir\./);
  assert.match(repositorySource, /assertDeliveryNoteCanRevise/);
  assert.match(repositorySource, /Birlesmis veya birlesim kaynagi irsaliyeler revize edilemez/);
  assert.match(repositorySource, /Faturaya bagli irsaliyeler revize edilemez/);
  assert.match(repositorySource, /assertLinkedInvoiceLinesPreserved/);
  assert.match(repositorySource, /B-Irsaliye taslagi elle degistirilemez/);
  assert.match(repositorySource, /MERGED_SOURCE[\s\S]+faturaya aktarilamaz/);
  assert.match(repositorySource, /Negatif net miktar reddedildi/);
  assert.match(repositorySource, /return isReturn \? -quantity : quantity/);
});

test("warehouse document movements and invoice candidates use go-live filters", async () => {
  const [repositorySource, reportSource, workspaceSource] = await Promise.all([
    readFile(new URL("../lib/kagu/document-repository.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/kagu/report-repository.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/kagu/DocumentWorkspace.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(repositorySource, /resolveInvoiceKindForAccount/);
  assert.match(repositorySource, /where\.direction = dbDeliveryDirection\(invoiceKind === "SALES" \? "OUT" : "IN"\)/);
  assert.match(repositorySource, /getSourceIdsInActiveMerge/);
  assert.match(reportSource, /where: \{ isEffective: true, warehouseId \}/);
  assert.match(reportSource, /sourceDeliveryNoteNos/);
  assert.match(workspaceSource, /canShowVoidAction/);
  assert.match(workspaceSource, /canReviseDeliveryNote/);
  assert.match(workspaceSource, /saveInFlightRef/);
  assert.match(workspaceSource, /isLinkedInvoiceLine/);
  assert.match(workspaceSource, /isLockedMergeDraft/);
  assert.match(workspaceSource, /tableLocked/);
  assert.match(workspaceSource, /lineField\.name === "itemId" \|\| lineField\.name === "quantity"/);
  assert.match(workspaceSource, /values\.sourceDeliveryLineIds = \[\]/);
  assert.match(workspaceSource, /next\.sourceDeliveryLineIds = deliveryNoteLineId/);
});

test("master aggregates use effective account ledger and stock movements", async () => {
  const source = await readFile(
    new URL("../lib/kagu/master-repository.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /docType: \{ in: INVOICE_LEDGER_DOC_TYPES \}/);
  assert.match(source, /isEffective: true/);
  assert.match(source, /where: \{ itemId, isEffective: true \}/);
  assert.match(source, /where: \{ warehouseId, isEffective: true \}/);
});

test("approved delivery note revision draft save should not reuse deliveryNoteLine ids", async () => {
  const { saveDbDocumentDraft } = await importAppModule("lib/kagu/document-repository.ts");

  const deliveryResult = await saveRevisionDraftWithCopiedLineId("deliveryNotes", saveDbDocumentDraft);
  assert.notEqual(deliveryResult.createdLine.id, deliveryResult.oldLineId);
  assert.equal(deliveryResult.detail.lines[0].id, deliveryResult.createdLine.id);
});

test("approved invoice revision draft save should not reuse invoiceLine ids", async () => {
  const { saveDbDocumentDraft } = await importAppModule("lib/kagu/document-repository.ts");
  const invoiceResult = await saveRevisionDraftWithCopiedLineId("invoices", saveDbDocumentDraft);

  assert.notEqual(invoiceResult.createdLine.id, invoiceResult.oldLineId);
  assert.equal(invoiceResult.createdLine.deliveryNoteLineId, "delivery-source-line-1");
  assert.deepEqual(invoiceResult.createdLine.sourceDeliveryLineIds, ["delivery-source-line-1"]);
});

test("revision approval should not double count stock or ledger effects", async () => {
  const { approveDbDocument } = await importAppModule("lib/kagu/document-repository.ts");
  const result = await approveInvoiceRevisionAndCaptureEffects(approveDbDocument);

  assert.equal(result.effectiveLedgerEntries.length, 1);
  assert.equal(result.effectiveLedgerEntries[0].docId, result.newInvoiceId);
  assert.equal(result.effectiveStockMovements.length, 1);
  assert.equal(result.effectiveStockMovements[0].docId, result.newInvoiceId);
  assert.equal(result.oldLedgerEntry.isEffective, false);
  assert.equal(result.oldLedgerEntry.replacedByDocId, result.newInvoiceId);
  assert.equal(result.oldStockMovement.isEffective, false);
  assert.equal(result.oldStockMovement.replacedByDocId, result.newInvoiceId);
});

test("seed-dev script refuses production-like environments before seeding", async () => {
  const source = await readFile(
    new URL("../scripts/seed-dev.mjs", import.meta.url),
    "utf8",
  );

  assert.match(source, /assertSafeDevSeedEnvironment\(\)/);
  assert.match(source, /NODE_ENV=production|NODE_ENV.*production/);
  assert.match(source, /--production/);
  assert.match(source, /non-local database host|DATABASE_URL/i);
});

async function saveRevisionDraftWithCopiedLineId(entity, saveDbDocumentDraft) {
  const now = new Date("2026-05-14T12:00:00.000Z");
  const sourceId = `${entity}-approved`;
  const oldLineId = `${entity}-old-line`;
  const createdLines = [];
  let savedHeader = null;

  const sourceHeader =
    entity === "deliveryNotes"
      ? {
          accountId: "account-1",
          actualDocNo: "IRS-OLD-001",
          approvedAt: now,
          changeNote: null,
          changedByUserId: "user-old",
          createdAt: now,
          description: null,
          direction: "OUT",
          docDate: now,
          docNo: "140526_IRC_000001",
          id: sourceId,
          isEffective: true,
          isReturn: false,
          mergeRole: "NORMAL",
          projectId: null,
          status: "APPROVED",
          supersededAt: null,
          supersededById: null,
          supersedesId: null,
          updatedAt: now,
          voidReason: null,
          voidedAt: null,
          warehouseId: "warehouse-1",
        }
      : {
          accountId: "account-1",
          actualDocNo: "FAT-OLD-001",
          approvedAt: now,
          changeNote: null,
          changedByUserId: "user-old",
          createdAt: now,
          currency: "TRY",
          description: null,
          discountBps: 0,
          docDate: now,
          docNo: "140526_SF_000001",
          documentTotalMinor: 1200,
          exchangeRate: 1,
          id: sourceId,
          invoiceKind: "SALES",
          invoiceType: "STANDARD",
          isEffective: true,
          netTotalMinor: 1000,
          projectId: null,
          status: "APPROVED",
          supersededAt: null,
          supersededById: null,
          supersedesId: null,
          updatedAt: now,
          vatTotalMinor: 200,
          voidReason: null,
          voidedAt: null,
          warehouseId: "warehouse-1",
        };

  const tx = {
    $transaction: undefined,
    account: {
      findUnique: async () => ({ currency: "TRY", id: "account-1", isActive: true }),
    },
    accountLedgerEntry: { findMany: async () => [] },
    auditEvent: {
      create: async () => undefined,
      findMany: async () => [],
    },
    deliveryNote: {
      findMany: async () => [],
      findUnique: async ({ where }) => {
        if (where.id === sourceId) {
          return sourceHeader;
        }

        return savedHeader?.id === where.id ? savedHeader : null;
      },
      upsert: async ({ create, update, where }) => {
        savedHeader = {
          ...(savedHeader?.id === where.id ? update : create),
          createdAt: savedHeader?.createdAt ?? now,
          id: where.id,
          updatedAt: now,
        };
      },
    },
    deliveryNoteLine: {
      createMany: async ({ data }) => {
        throwOnCopiedLineId(data, oldLineId);
        createdLines.splice(0, createdLines.length, ...data);
      },
      deleteMany: async () => undefined,
      findMany: async () => createdLines,
    },
    deliveryNoteMergeSource: {
      findMany: async () => [],
    },
    documentCounter: {
      upsert: async () => ({ nextSeq: 2 }),
    },
    documentNumberRegistry: {
      create: async () => undefined,
    },
    documentRevision: { findMany: async () => [] },
    invoice: {
      findUnique: async ({ where }) => {
        if (where.id === sourceId) {
          return sourceHeader;
        }

        return savedHeader?.id === where.id ? savedHeader : null;
      },
      upsert: async ({ create, update, where }) => {
        savedHeader = {
          ...(savedHeader?.id === where.id ? update : create),
          createdAt: savedHeader?.createdAt ?? now,
          id: where.id,
          updatedAt: now,
        };
      },
    },
    invoiceLine: {
      createMany: async ({ data }) => {
        throwOnCopiedLineId(data, oldLineId);
        createdLines.splice(0, createdLines.length, ...data);
      },
      deleteMany: async () => undefined,
      findMany: async () => createdLines,
    },
    item: {
      findUnique: async () => ({ id: "item-1", isActive: true }),
    },
    project: {
      findUnique: async () => null,
    },
    setting: {
      findUnique: async () => null,
    },
    stockMovement: { findMany: async () => [] },
    warehouse: {
      findUnique: async () => ({ id: "warehouse-1", isActive: true }),
    },
  };

  setPrismaMock({
    $transaction: async (callback) => callback(tx),
  });

  const payload =
    entity === "deliveryNotes"
      ? {
          actualDocNo: "IRS-NEW-001",
          accountId: "account-1",
          direction: "OUT",
          docDate: "2026-05-14",
          editReason: "line id regression",
          supersedesId: sourceId,
          warehouseId: "warehouse-1",
          lines: [
            {
              id: oldLineId,
              itemId: "item-1",
              quantity: 1,
              unitPriceMinor: 1000,
              vatRateBps: 2000,
            },
          ],
        }
      : {
          actualDocNo: "FAT-NEW-001",
          accountId: "account-1",
          currency: "TRY",
          docDate: "2026-05-14",
          editReason: "line id regression",
          invoiceKind: "SALES",
          invoiceType: "STANDARD",
          supersedesId: sourceId,
          warehouseId: "warehouse-1",
          lines: [
            {
              deliveryNoteLineId: "delivery-source-line-1",
              id: oldLineId,
              itemId: "item-1",
              quantity: 1,
              sourceDeliveryLineIds: ["delivery-source-line-1"],
              unitPriceMinor: 1000,
              vatRateBps: 2000,
            },
          ],
        };

  const detail = await saveDbDocumentDraft(entity, payload, "user-1");

  return { createdLine: createdLines[0], detail, oldLineId };
}

async function approveInvoiceRevisionAndCaptureEffects(approveDbDocument) {
  const now = new Date("2026-05-14T12:00:00.000Z");
  const oldInvoiceId = "invoice-approved-old";
  const newInvoiceId = "invoice-revision-draft";
  const headers = new Map([
    [
      oldInvoiceId,
      invoiceHeaderRow({
        actualDocNo: "FAT-OLD-001",
        approvedAt: now,
        docNo: "140526_SF_000001",
        id: oldInvoiceId,
        status: "APPROVED",
      }),
    ],
    [
      newInvoiceId,
      invoiceHeaderRow({
        actualDocNo: "FAT-NEW-001",
        docNo: "DRAFT-invoice-revision-draft",
        id: newInvoiceId,
        status: "DRAFT",
        supersedesId: oldInvoiceId,
      }),
    ],
  ]);
  const lines = [
    {
      deliveryNoteLineId: null,
      description: null,
      discountBps: 0,
      grossTotalMinor: 1200,
      id: "invoice-revision-line",
      invoiceId: newInvoiceId,
      itemId: "item-1",
      lineTotalMinor: 1200,
      netTotalMinor: 1000,
      quantity: 1,
      sourceDeliveryLineIds: [],
      unitPriceMinor: 1000,
      vatRateBps: 2000,
      vatTotalMinor: 200,
    },
  ];
  const ledgerEntries = [
    {
      accountId: "account-1",
      cancelledAt: null,
      createdAt: now,
      creditMinor: 0,
      currency: "TRY",
      debitMinor: 1200,
      description: "Satis faturasi",
      docDate: now,
      docId: oldInvoiceId,
      docNo: "140526_SF_000001",
      docType: "SALES_INVOICE_STANDARD",
      id: "ledger-old",
      isEffective: true,
      projectId: null,
      relatedAccountId: null,
      replacedByDocId: null,
    },
  ];
  const stockMovements = [
    {
      cancelledAt: null,
      createdAt: now,
      docDate: now,
      docId: oldInvoiceId,
      docNo: "140526_SF_000001",
      docType: "SALES_INVOICE_STANDARD",
      id: "stock-old",
      isEffective: true,
      itemId: "item-1",
      projectId: null,
      qtyIn: 0,
      qtyOut: 1,
      replacedByDocId: null,
      warehouseId: "warehouse-1",
    },
  ];

  const tx = {
    account: {
      findUnique: async () => ({ currency: "TRY", id: "account-1", isActive: true }),
    },
    accountLedgerEntry: {
      create: async ({ data }) => {
        ledgerEntries.push({ ...data, createdAt: now, id: "ledger-new" });
      },
      findMany: async ({ where }) => ledgerEntries.filter((entry) => entry.docId === where.docId),
      updateMany: async ({ data, where }) => {
        for (const entry of ledgerEntries) {
          if (entry.docId === where.docId && entry.isEffective === where.isEffective) {
            Object.assign(entry, data);
          }
        }
      },
    },
    auditEvent: {
      create: async () => undefined,
      findMany: async () => [],
    },
    documentCounter: {
      upsert: async () => ({ nextSeq: 2 }),
    },
    documentNumberRegistry: {
      create: async () => undefined,
    },
    documentRevision: {
      count: async () => 0,
      create: async () => undefined,
      findMany: async () => [],
    },
    invoice: {
      findUnique: async ({ where }) => headers.get(where.id) ?? null,
      upsert: async ({ create, update, where }) => {
        const previous = headers.get(where.id);
        headers.set(where.id, {
          ...(previous ? { ...previous, ...update } : create),
          createdAt: previous?.createdAt ?? now,
          id: where.id,
          updatedAt: now,
        });
      },
    },
    invoiceLine: {
      findMany: async ({ where }) =>
        lines.filter((line) => line.invoiceId === where.invoiceId),
    },
    project: {
      findUnique: async () => null,
    },
    setting: {
      findUnique: async () => null,
    },
    stockMovement: {
      createMany: async ({ data }) => {
        stockMovements.push(
          ...data.map((row, index) => ({ ...row, createdAt: now, id: `stock-new-${index}` })),
        );
      },
      findMany: async ({ where }) =>
        stockMovements.filter((movement) => movement.docId === where.docId),
      updateMany: async ({ data, where }) => {
        for (const movement of stockMovements) {
          if (movement.docId === where.docId && movement.isEffective === where.isEffective) {
            Object.assign(movement, data);
          }
        }
      },
    },
    warehouse: {
      findUnique: async () => ({ id: "warehouse-1", isActive: true }),
    },
  };

  setPrismaMock({
    $transaction: async (callback) => callback(tx),
  });

  await approveDbDocument("invoices", newInvoiceId, "user-1");

  return {
    effectiveLedgerEntries: ledgerEntries.filter((entry) => entry.isEffective),
    effectiveStockMovements: stockMovements.filter((movement) => movement.isEffective),
    newInvoiceId,
    oldLedgerEntry: ledgerEntries.find((entry) => entry.docId === oldInvoiceId),
    oldStockMovement: stockMovements.find((movement) => movement.docId === oldInvoiceId),
  };
}

function invoiceHeaderRow(overrides) {
  const now = new Date("2026-05-14T12:00:00.000Z");

  return {
    accountId: "account-1",
    actualDocNo: null,
    approvedAt: null,
    changeNote: null,
    changedByUserId: null,
    createdAt: now,
    currency: "TRY",
    description: null,
    discountBps: 0,
    docDate: now,
    docNo: "DRAFT-test",
    documentTotalMinor: 1200,
    exchangeRate: 1,
    id: "invoice",
    invoiceKind: "SALES",
    invoiceType: "STANDARD",
    isEffective: true,
    netTotalMinor: 1000,
    projectId: null,
    status: "DRAFT",
    supersededAt: null,
    supersededById: null,
    supersedesId: null,
    updatedAt: now,
    vatTotalMinor: 200,
    voidReason: null,
    voidedAt: null,
    warehouseId: "warehouse-1",
    ...overrides,
  };
}

function throwOnCopiedLineId(lines, copiedLineId) {
  if (lines.some((line) => line.id === copiedLineId)) {
    const error = new Error("Unique constraint failed on the fields: (`id`)");
    error.code = "P2002";
    throw error;
  }
}
