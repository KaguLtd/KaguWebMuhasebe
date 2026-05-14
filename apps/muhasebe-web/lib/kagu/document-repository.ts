import {
  Currency as DbCurrency,
  DeliveryDirection as DbDeliveryDirection,
  DeliveryMergeRole as DbDeliveryMergeRole,
  DocumentStatus as DbDocumentStatus,
  InvoiceKind as DbInvoiceKind,
  InvoiceType as DbInvoiceType,
  PrismaClient,
  ReceiptKind as DbReceiptKind,
  type Prisma,
} from "@prisma/client";
import { randomUUID } from "node:crypto";

import type {
  Currency,
  DataRecord,
  DocumentDetail,
  DocumentEntity,
  DocumentPayload,
  InvoiceMetrics,
  LedgerEntry,
  ListQuery,
  PaginatedResult,
  StockMovement,
} from "./contracts";
import {
  cleanRecord,
  currency,
  dataValue,
  dateString,
  isoString,
  nullableString,
  number,
  roundMinor,
  text,
  toDate,
  today,
} from "./db-shared";
import { camelToSnake } from "./helpers";
import { prisma } from "@/server/db";

type Tx = Prisma.TransactionClient;
type DbClient = PrismaClient | Prisma.TransactionClient;

const documentEntities = new Set<DocumentEntity>([
  "deliveryNotes",
  "invoices",
  "receipts",
  "transfers",
]);

const docCodes = {
  DELIVERY_NOTE_IN: "IRG",
  DELIVERY_NOTE_OUT: "IRC",
  DELIVERY_NOTE_MERGED_RESULT_IN: "BIRG",
  DELIVERY_NOTE_MERGED_RESULT_OUT: "BIRC",
  DELIVERY_NOTE_MERGED_SOURCE_IN: "IIRG",
  DELIVERY_NOTE_MERGED_SOURCE_OUT: "IIRC",
  PURCHASE_INVOICE_STANDARD: "AF",
  PURCHASE_INVOICE_STAR: "AF",
  RECEIPT_COLLECTION: "TAH",
  RECEIPT_PAYMENT: "ODM",
  SALES_INVOICE_STANDARD: "SF",
  SALES_INVOICE_STAR: "SF",
  TRANSFER: "VIR",
} as const;

export function isDbDocumentEntity(entity: string): entity is DocumentEntity {
  return documentEntities.has(entity as DocumentEntity);
}

export async function listDbDocuments(
  entity: DocumentEntity,
  query: ListQuery = {},
): Promise<PaginatedResult<DataRecord>> {
  const page = Math.max(1, Number(query.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20)));
  const skip = (page - 1) * pageSize;

  if (entity === "deliveryNotes") {
    const where = buildDeliveryNoteWhere(query);
    const [rows, total] = await Promise.all([
      prisma.deliveryNote.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        where,
      }),
      prisma.deliveryNote.count({ where }),
    ]);

    return { items: rows.map(deliveryHeaderRecord), page, pageSize, total };
  }

  if (entity === "invoices") {
    const where = buildInvoiceWhere(query);
    const [rows, total] = await Promise.all([
      prisma.invoice.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        where,
      }),
      prisma.invoice.count({ where }),
    ]);

    return { items: rows.map(invoiceRecord), page, pageSize, total };
  }

  if (entity === "receipts") {
    const where = buildReceiptWhere(query);
    const [rows, total] = await Promise.all([
      prisma.receipt.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        where,
      }),
      prisma.receipt.count({ where }),
    ]);

    return { items: rows.map(receiptRecord), page, pageSize, total };
  }

  const where = buildTransferWhere(query);
  const [rows, total] = await Promise.all([
    prisma.transfer.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      where,
    }),
    prisma.transfer.count({ where }),
  ]);

  return { items: rows.map(transferRecord), page, pageSize, total };
}

export async function getDbDocument(
  entity: DocumentEntity,
  id: string,
): Promise<DocumentDetail<DataRecord> | null> {
  return getDocumentWithTx(prisma, entity, id);
}

export async function saveDbDocumentDraft(
  entity: DocumentEntity,
  payload: DocumentPayload,
  actorUserId: string,
) {
  return prisma.$transaction(async (tx) => {
    const supersedesId =
      typeof payload.supersedesId === "string" && payload.supersedesId.trim()
        ? payload.supersedesId.trim()
        : null;
    const editingId = typeof payload.id === "string" && payload.id ? payload.id : null;
    const id = editingId ?? randomUUID();
    const existing = editingId ? await findHeader(tx, entity, id) : null;
    const superseded =
      supersedesId && supersedesId !== id ? await findHeader(tx, entity, supersedesId) : null;

    if (existing?.status === "VOID" || existing?.status === "SUPERSEDED") {
      throw new Error("Voided or superseded documents cannot be edited");
    }

    if (existing?.status === "APPROVED") {
      throw new Error("Approved documents must be revised through a new document");
    }

    if (superseded) {
      if (superseded.status !== "APPROVED" || superseded.is_effective !== true) {
        throw new Error("Only effective approved documents can be revised");
      }

      if (!payload.editReason?.trim()) {
        throw new Error("Revising an approved document requires an edit reason");
      }

      await assertPeriodLockAllows(tx, String(superseded.doc_date), "Bu belge kilitli donemde");
    }

    const status = existing?.status ?? "DRAFT";
    const nextHeader: DataRecord = cleanRecord({
      ...(superseded ?? existing ?? {}),
      ...defaultsFor(entity),
      ...normalizeDocumentPayload(payload),
      change_note:
        typeof payload.editReason === "string" && payload.editReason.trim()
          ? payload.editReason.trim()
          : existing?.change_note ?? superseded?.change_note ?? null,
      changed_by_user_id: actorUserId,
      doc_no: existing?.doc_no ?? draftDocNo(id),
      id,
      is_effective: existing?.is_effective ?? true,
      status,
      supersedes_id: supersedesId ?? existing?.supersedes_id ?? null,
      superseded_at: existing?.superseded_at ?? null,
      superseded_by_id: existing?.superseded_by_id ?? null,
    });

    await assertDocumentParityWithTx(tx, entity, nextHeader, payload.lines ?? []);
    await reserveInvoiceDraftNumber(tx, entity, id, nextHeader);

    const nextLines = normalizeLines(entity, id, payload.lines ?? []);

    if (entity === "invoices") {
      applyInvoiceTotals(nextHeader, nextLines);
    }

    await upsertHeader(tx, entity, id, nextHeader);
    await replaceLines(tx, entity, id, nextLines);

    await recordAudit(
      tx,
      entity,
      id,
      supersedesId ? "CREATE_REVISION_DRAFT" : existing ? "UPDATE_DRAFT" : "CREATE_DRAFT",
      nextHeader,
      actorUserId,
    );

    return getDocumentWithTx(tx, entity, id);
  });
}

export async function approveDbDocument(
  entity: DocumentEntity,
  id: string,
  actorUserId: string,
) {
  return prisma.$transaction(async (tx) => {
    const header = await findHeader(tx, entity, id);

    if (!header) {
      throw new Error("Document not found");
    }

    if (header.status === "VOID" || header.status === "SUPERSEDED") {
      throw new Error("Cannot approve a voided or superseded document");
    }

    if (header.status === "APPROVED") {
      return getDocumentWithTx(tx, entity, id);
    }

    const lines = await getLines(tx, entity, id);

    await assertDocumentParityWithTx(tx, entity, header, lines);
    validateApproval(entity, header, lines);
    await assertPeriodLockAllows(tx, String(header.doc_date), "Belge tarihi kilitli donemde");

    const docType = documentType(entity, header);
    const docNo = String(header.doc_no).startsWith("DRAFT-")
      ? await allocateDocumentNumber(tx, docType, id, String(header.doc_date))
      : String(header.doc_no);
    const supersedesId =
      typeof header.supersedes_id === "string" && header.supersedes_id.trim()
        ? header.supersedes_id.trim()
        : null;
    const superseded =
      supersedesId && supersedesId !== id ? await findHeader(tx, entity, supersedesId) : null;

    if (superseded) {
      if (superseded.status !== "APPROVED" || superseded.is_effective !== true) {
        throw new Error("Superseded document is no longer active");
      }

      await assertPeriodLockAllows(
        tx,
        String(superseded.doc_date),
        "Degistirilmek istenen belge kilitli donemde",
      );
    }

    const nextHeader: DataRecord = {
      ...header,
      actual_doc_no:
        entity === "invoices" && header.invoice_type === "STAR"
          ? docNo
          : header.actual_doc_no,
      approved_at: new Date().toISOString(),
      changed_by_user_id: actorUserId,
      doc_no: docNo,
      is_effective: true,
      status: "APPROVED",
    };

    await upsertHeader(tx, entity, id, nextHeader);
    await postDocument(tx, entity, nextHeader, lines);

    if (superseded) {
      await supersedeDocument(tx, entity, superseded, String(nextHeader.id), actorUserId);
      await recordRevision(
        tx,
        documentType(entity, superseded),
        String(superseded.id),
        text(nextHeader.change_note) || "Belge yeni revizyon ile degistirildi",
        {
          replaced_by_doc_id: String(nextHeader.id),
        },
      );
    }

    await recordAudit(tx, entity, id, "APPROVE", nextHeader, actorUserId);

    return getDocumentWithTx(tx, entity, id);
  });
}

export async function voidDbDocument(
  entity: DocumentEntity,
  id: string,
  reason: string,
  actorUserId: string,
) {
  return prisma.$transaction(async (tx) => {
    const header = await findHeader(tx, entity, id);

    if (!header) {
      throw new Error("Document not found");
    }

    if (!reason.trim()) {
      throw new Error("Void reason is required");
    }

    if (header.status === "VOID") {
      return getDocumentWithTx(tx, entity, id);
    }

    if (header.status === "SUPERSEDED") {
      throw new Error("Superseded documents cannot be voided");
    }

    if (entity === "deliveryNotes") {
      await assertDeliveryNoteCanVoid(tx, header);
    }

    await assertPeriodLockAllows(tx, String(header.doc_date), "Bu belge kilitli donemde");
    await deactivateDocumentEffects(tx, id, null);

    const nextHeader: DataRecord = {
      ...header,
      changed_by_user_id: actorUserId,
      change_note: reason,
      is_effective: false,
      status: "VOID",
      void_reason: reason,
      voided_at: new Date().toISOString(),
    };

    await upsertHeader(tx, entity, id, nextHeader);
    await recordRevision(tx, documentType(entity, header), id, reason, nextHeader);
    await recordAudit(tx, entity, id, "VOID", nextHeader, actorUserId);

    return getDocumentWithTx(tx, entity, id);
  });
}

export async function getDbInvoiceMetrics(invoiceId: string): Promise<InvoiceMetrics | null> {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });

  if (!invoice) {
    return null;
  }

  const lines = await prisma.invoiceLine.findMany({ where: { invoiceId } });
  const invoiceHeader = invoiceRecord(invoice);
  const effectiveAt = effectiveDocumentTime(invoiceHeader);
  const invoiceCurrency = currency(invoice.currency);
  let invoiceNetTotalMinor = 0;
  let invoiceGrossTotalMinor = 0;
  let costTotalMinor = 0;

  for (const line of lines.map(invoiceLineRecord)) {
    const base = roundMinor(number(line.quantity) * number(line.unit_price_minor));
    const vat = roundMinor((base * number(line.vat_rate_bps)) / 10000);

    invoiceNetTotalMinor += base;
    invoiceGrossTotalMinor += base + vat;
    costTotalMinor += await resolveInvoiceLineApproximateCost(
      line,
      invoiceHeader,
      invoiceCurrency,
      effectiveAt,
    );
  }

  const profitMinor = invoiceNetTotalMinor - costTotalMinor;

  return {
    costTotalMinor,
    invoiceGrossTotalMinor,
    invoiceNetTotalMinor,
    marginPercent:
      invoiceNetTotalMinor === 0
        ? null
        : Number(((profitMinor / invoiceNetTotalMinor) * 100).toFixed(2)),
    profitMinor,
  };
}

async function resolveInvoiceLineApproximateCost(
  line: DataRecord,
  invoiceHeader: DataRecord,
  invoiceCurrency: Currency,
  fallbackEffectiveAt: string,
) {
  const itemId = text(line.item_id);
  const quantity = number(line.quantity);

  if (!itemId || quantity <= 0) {
    return 0;
  }

  const sourceLineIds = getStoredSourceDeliveryLineIds(line);

  if (!sourceLineIds.length) {
    return roundMinor(
      quantity * (await resolveLatestPurchaseCost(itemId, invoiceCurrency, fallbackEffectiveAt)),
    );
  }

  const sourceLines = await prisma.deliveryNoteLine.findMany({
    include: { deliveryNote: true },
    where: { id: { in: sourceLineIds }, itemId },
  });

  let trackedQuantity = 0;
  let costTotalMinor = 0;

  for (const sourceLine of sourceLines) {
    const deliveryHeader = deliveryHeaderRecord(sourceLine.deliveryNote);

    if (
      deliveryHeader.status !== "APPROVED" ||
      deliveryHeader.isEffective !== true ||
      resolveDeliveryStockDirection(deliveryHeader) !== "OUT"
    ) {
      continue;
    }

    const deliveryEffectiveAt = effectiveDocumentTime(deliveryHeader);
    const unitCostMinor = await resolveLatestPurchaseCost(
      itemId,
      invoiceCurrency,
      deliveryEffectiveAt,
    );
    const deliveryQuantity = number(sourceLine.quantity);

    trackedQuantity += deliveryQuantity;
    costTotalMinor += roundMinor(deliveryQuantity * unitCostMinor);
  }

  const remainingQuantity = Math.max(0, quantity - trackedQuantity);

  if (remainingQuantity > 0) {
    costTotalMinor += roundMinor(
      remainingQuantity *
        (await resolveLatestPurchaseCost(itemId, invoiceCurrency, fallbackEffectiveAt)),
    );
  }

  return costTotalMinor;
}

export async function getAllDbLedgerEntries() {
  const rows = await prisma.accountLedgerEntry.findMany({
    orderBy: [{ docDate: "asc" }, { createdAt: "asc" }],
    where: { isEffective: true },
  });

  return rows.map(ledgerEntryRecord);
}

export async function getAllDbStockMovements() {
  const rows = await prisma.stockMovement.findMany({
    orderBy: [{ docDate: "asc" }, { createdAt: "asc" }],
    where: { isEffective: true },
  });

  return rows.map(stockMovementRecord);
}

async function getDocumentWithTx(
  tx: DbClient,
  entity: DocumentEntity,
  id: string,
): Promise<DocumentDetail<DataRecord> | null> {
  const header = await findHeader(tx, entity, id);

  if (!header) {
    return null;
  }

  const [lines, revisions, ledgerEntries, stockMovements, auditEvents] = await Promise.all([
    getLines(tx, entity, id),
    tx.documentRevision
      .findMany({ orderBy: { revisionNo: "asc" }, where: { docId: id } })
      .then((rows) => rows.map(revisionRecord)),
    tx.accountLedgerEntry
      .findMany({ orderBy: { createdAt: "asc" }, where: { docId: id } })
      .then((rows) => rows.map(ledgerEntryRecord)),
    tx.stockMovement
      .findMany({ orderBy: { createdAt: "asc" }, where: { docId: id } })
      .then((rows) => rows.map(stockMovementRecord)),
    tx.auditEvent
      .findMany({ orderBy: { createdAt: "desc" }, where: { entity, entityId: id } })
      .then((rows) => rows.map(auditEventRecord)),
  ]);

  return { auditEvents, header, ledgerEntries, lines, revisions, stockMovements };
}

async function findHeader(tx: DbClient, entity: DocumentEntity, id: string) {
  switch (entity) {
    case "deliveryNotes": {
      const row = await tx.deliveryNote.findUnique({ where: { id } });

      return row ? deliveryHeaderRecord(row) : null;
    }
    case "invoices": {
      const row = await tx.invoice.findUnique({ where: { id } });

      return row ? invoiceRecord(row) : null;
    }
    case "receipts": {
      const row = await tx.receipt.findUnique({ where: { id } });

      return row ? receiptRecord(row) : null;
    }
    case "transfers": {
      const row = await tx.transfer.findUnique({ where: { id } });

      return row ? transferRecord(row) : null;
    }
  }
}

async function getLines(tx: DbClient, entity: DocumentEntity, id: string) {
  if (entity === "deliveryNotes") {
    const rows = await tx.deliveryNoteLine.findMany({
      orderBy: { id: "asc" },
      where: { deliveryNoteId: id },
    });

    return rows.map(deliveryLineRecord);
  }

  if (entity === "invoices") {
    const rows = await tx.invoiceLine.findMany({
      orderBy: { id: "asc" },
      where: { invoiceId: id },
    });

    return rows.map(invoiceLineRecord);
  }

  return [];
}

async function upsertHeader(
  tx: Tx,
  entity: DocumentEntity,
  id: string,
  header: DataRecord,
) {
  switch (entity) {
    case "deliveryNotes":
      await tx.deliveryNote.upsert({
        create: {
          accountId: text(header.account_id),
          actualDocNo: nullableString(header.actual_doc_no),
          approvedAt: optionalDate(header.approved_at),
          changeNote: nullableString(header.change_note),
          changedByUserId: nullableString(header.changed_by_user_id),
          description: nullableString(header.description),
          direction: dbDeliveryDirection(header.direction),
          docDate: toDate(header.doc_date),
          docNo: text(header.doc_no),
          id,
          isEffective: header.is_effective !== false,
          isReturn: header.is_return === true,
          mergeRole: dbDeliveryMergeRole(header.merge_role),
          projectId: nullableString(header.project_id),
          status: dbDocumentStatus(header.status),
          supersededAt: optionalDate(header.superseded_at),
          supersededById: nullableString(header.superseded_by_id),
          supersedesId: nullableString(header.supersedes_id),
          voidReason: nullableString(header.void_reason),
          voidedAt: optionalDate(header.voided_at),
          warehouseId: text(header.warehouse_id),
        },
        update: {
          accountId: text(header.account_id),
          actualDocNo: nullableString(header.actual_doc_no),
          approvedAt: optionalDate(header.approved_at),
          changeNote: nullableString(header.change_note),
          changedByUserId: nullableString(header.changed_by_user_id),
          description: nullableString(header.description),
          direction: dbDeliveryDirection(header.direction),
          docDate: toDate(header.doc_date),
          docNo: text(header.doc_no),
          isEffective: header.is_effective !== false,
          isReturn: header.is_return === true,
          mergeRole: dbDeliveryMergeRole(header.merge_role),
          projectId: nullableString(header.project_id),
          status: dbDocumentStatus(header.status),
          supersededAt: optionalDate(header.superseded_at),
          supersededById: nullableString(header.superseded_by_id),
          supersedesId: nullableString(header.supersedes_id),
          voidReason: nullableString(header.void_reason),
          voidedAt: optionalDate(header.voided_at),
          warehouseId: text(header.warehouse_id),
        },
        where: { id },
      });
      return;
    case "invoices":
      await tx.invoice.upsert({
        create: {
          accountId: text(header.account_id),
          actualDocNo: nullableString(header.actual_doc_no),
          approvedAt: optionalDate(header.approved_at),
          changeNote: nullableString(header.change_note),
          changedByUserId: nullableString(header.changed_by_user_id),
          currency: dbCurrency(header.currency),
          description: nullableString(header.description),
          discountBps: number(header.discount_bps),
          docDate: toDate(header.doc_date),
          docNo: text(header.doc_no),
          documentTotalMinor: number(header.document_total_minor),
          exchangeRate: number(header.exchange_rate) || 1,
          id,
          isEffective: header.is_effective !== false,
          invoiceKind: dbInvoiceKind(header.invoice_kind),
          invoiceType: dbInvoiceType(header.invoice_type),
          netTotalMinor: number(header.net_total_minor),
          projectId: nullableString(header.project_id),
          status: dbDocumentStatus(header.status),
          supersededAt: optionalDate(header.superseded_at),
          supersededById: nullableString(header.superseded_by_id),
          supersedesId: nullableString(header.supersedes_id),
          vatTotalMinor: number(header.vat_total_minor),
          voidReason: nullableString(header.void_reason),
          voidedAt: optionalDate(header.voided_at),
          warehouseId: nullableString(header.warehouse_id),
        },
        update: {
          accountId: text(header.account_id),
          actualDocNo: nullableString(header.actual_doc_no),
          approvedAt: optionalDate(header.approved_at),
          changeNote: nullableString(header.change_note),
          changedByUserId: nullableString(header.changed_by_user_id),
          currency: dbCurrency(header.currency),
          description: nullableString(header.description),
          discountBps: number(header.discount_bps),
          docDate: toDate(header.doc_date),
          docNo: text(header.doc_no),
          documentTotalMinor: number(header.document_total_minor),
          exchangeRate: number(header.exchange_rate) || 1,
          isEffective: header.is_effective !== false,
          invoiceKind: dbInvoiceKind(header.invoice_kind),
          invoiceType: dbInvoiceType(header.invoice_type),
          netTotalMinor: number(header.net_total_minor),
          projectId: nullableString(header.project_id),
          status: dbDocumentStatus(header.status),
          supersededAt: optionalDate(header.superseded_at),
          supersededById: nullableString(header.superseded_by_id),
          supersedesId: nullableString(header.supersedes_id),
          vatTotalMinor: number(header.vat_total_minor),
          voidReason: nullableString(header.void_reason),
          voidedAt: optionalDate(header.voided_at),
          warehouseId: nullableString(header.warehouse_id),
        },
        where: { id },
      });
      return;
    case "receipts":
      await tx.receipt.upsert({
        create: {
          accountId: text(header.account_id),
          amountMinor: number(header.amount_minor),
          approvedAt: optionalDate(header.approved_at),
          changeNote: nullableString(header.change_note),
          changedByUserId: nullableString(header.changed_by_user_id),
          currency: dbCurrency(header.currency),
          description: nullableString(header.description),
          docDate: toDate(header.doc_date),
          docNo: text(header.doc_no),
          id,
          isEffective: header.is_effective !== false,
          projectId: nullableString(header.project_id),
          receiptKind: dbReceiptKind(header.receipt_kind),
          status: dbDocumentStatus(header.status),
          supersededAt: optionalDate(header.superseded_at),
          supersededById: nullableString(header.superseded_by_id),
          supersedesId: nullableString(header.supersedes_id),
          voidReason: nullableString(header.void_reason),
          voidedAt: optionalDate(header.voided_at),
        },
        update: {
          accountId: text(header.account_id),
          amountMinor: number(header.amount_minor),
          approvedAt: optionalDate(header.approved_at),
          changeNote: nullableString(header.change_note),
          changedByUserId: nullableString(header.changed_by_user_id),
          currency: dbCurrency(header.currency),
          description: nullableString(header.description),
          docDate: toDate(header.doc_date),
          docNo: text(header.doc_no),
          isEffective: header.is_effective !== false,
          projectId: nullableString(header.project_id),
          receiptKind: dbReceiptKind(header.receipt_kind),
          status: dbDocumentStatus(header.status),
          supersededAt: optionalDate(header.superseded_at),
          supersededById: nullableString(header.superseded_by_id),
          supersedesId: nullableString(header.supersedes_id),
          voidReason: nullableString(header.void_reason),
          voidedAt: optionalDate(header.voided_at),
        },
        where: { id },
      });
      return;
    case "transfers":
      await tx.transfer.upsert({
        create: {
          amountMinor: number(header.amount_minor),
          approvedAt: optionalDate(header.approved_at),
          changeNote: nullableString(header.change_note),
          changedByUserId: nullableString(header.changed_by_user_id),
          crossRate: number(header.cross_rate) || 1,
          currency: dbCurrency(header.currency),
          description: nullableString(header.description),
          docDate: toDate(header.doc_date),
          docNo: text(header.doc_no),
          fromAccountId: text(header.from_account_id),
          id,
          isEffective: header.is_effective !== false,
          projectId: nullableString(header.project_id),
          status: dbDocumentStatus(header.status),
          supersededAt: optionalDate(header.superseded_at),
          supersededById: nullableString(header.superseded_by_id),
          supersedesId: nullableString(header.supersedes_id),
          targetAmountMinor: nullableNumber(header.target_amount_minor),
          toAccountId: text(header.to_account_id),
          voidReason: nullableString(header.void_reason),
          voidedAt: optionalDate(header.voided_at),
        },
        update: {
          amountMinor: number(header.amount_minor),
          approvedAt: optionalDate(header.approved_at),
          changeNote: nullableString(header.change_note),
          changedByUserId: nullableString(header.changed_by_user_id),
          crossRate: number(header.cross_rate) || 1,
          currency: dbCurrency(header.currency),
          description: nullableString(header.description),
          docDate: toDate(header.doc_date),
          docNo: text(header.doc_no),
          fromAccountId: text(header.from_account_id),
          isEffective: header.is_effective !== false,
          projectId: nullableString(header.project_id),
          status: dbDocumentStatus(header.status),
          supersededAt: optionalDate(header.superseded_at),
          supersededById: nullableString(header.superseded_by_id),
          supersedesId: nullableString(header.supersedes_id),
          targetAmountMinor: nullableNumber(header.target_amount_minor),
          toAccountId: text(header.to_account_id),
          voidReason: nullableString(header.void_reason),
          voidedAt: optionalDate(header.voided_at),
        },
        where: { id },
      });
  }
}

async function replaceLines(
  tx: Tx,
  entity: DocumentEntity,
  documentId: string,
  lines: DataRecord[],
) {
  if (entity === "deliveryNotes") {
    await tx.deliveryNoteLine.deleteMany({ where: { deliveryNoteId: documentId } });

    if (lines.length) {
      await tx.deliveryNoteLine.createMany({
        data: lines.map((line) => ({
          currency: dbCurrency(line.currency),
          deliveryNoteId: documentId,
          description: nullableString(line.description),
          grossTotalMinor: number(line.gross_total_minor),
          id: text(line.id),
          itemId: text(line.item_id),
          lineTotalMinor: number(line.line_total_minor),
          netTotalMinor: number(line.net_total_minor),
          quantity: number(line.quantity),
          unitPriceMinor: number(line.unit_price_minor),
          vatRateBps: number(line.vat_rate_bps),
          vatTotalMinor: number(line.vat_total_minor),
        })),
      });
    }
  }

  if (entity === "invoices") {
    await tx.invoiceLine.deleteMany({ where: { invoiceId: documentId } });

    if (lines.length) {
      await tx.invoiceLine.createMany({
        data: lines.map((line) => ({
          deliveryNoteLineId: nullableString(line.delivery_note_line_id),
          description: nullableString(line.description),
          discountBps: number(line.discount_bps),
          grossTotalMinor: number(line.gross_total_minor),
          id: text(line.id),
          invoiceId: documentId,
          itemId: text(line.item_id),
          lineTotalMinor: number(line.line_total_minor),
          netTotalMinor: number(line.net_total_minor),
          quantity: number(line.quantity),
          sourceDeliveryLineIds: Array.isArray(line.source_delivery_line_ids)
            ? line.source_delivery_line_ids.map((value) => String(value))
            : [],
          unitPriceMinor: number(line.unit_price_minor),
          vatRateBps: number(line.vat_rate_bps),
          vatTotalMinor: number(line.vat_total_minor),
        })),
      });
    }
  }
}

function normalizeDocumentPayload(payload: DocumentPayload) {
  const normalized: DataRecord = {};

  for (const [key, value] of Object.entries(payload)) {
    if (
      key === "id" ||
      key === "lines" ||
      key === "editReason" ||
      typeof value === "undefined"
    ) {
      continue;
    }

    normalized[camelToSnake(key)] = dataValue(value);
  }

  return normalized;
}

function normalizeLines(
  entity: DocumentEntity,
  documentId: string,
  lines: NonNullable<DocumentPayload["lines"]>,
) {
  if (entity === "receipts" || entity === "transfers") {
    return [];
  }

  return lines.map((line) => {
    const quantity = number(line.quantity ?? line.qty);
    const unitPriceMinor = number(line.unitPriceMinor);
    const discountBps = number(line.discountBps);
    const vatRateBps = number(line.vatRateBps);
    const sourceDeliveryLineIds = getInvoiceSourceDeliveryLineIds(line);
    const netTotalMinor = roundMinor(quantity * unitPriceMinor * (1 - discountBps / 10000));
    const vatTotalMinor = roundMinor(netTotalMinor * (vatRateBps / 10000));
    const grossTotalMinor = netTotalMinor + vatTotalMinor;

    return {
      currency: currency(line.currency),
      delivery_note_line_id:
        typeof line.deliveryNoteLineId === "string" ? line.deliveryNoteLineId : null,
      description: typeof line.description === "string" ? line.description : null,
      gross_total_minor: grossTotalMinor,
      id: line.id ?? randomUUID(),
      item_id: line.itemId ?? null,
      line_total_minor: grossTotalMinor,
      net_total_minor: netTotalMinor,
      [parentKey(entity)]: documentId,
      quantity,
      source_delivery_line_ids: sourceDeliveryLineIds,
      unit_price_minor: unitPriceMinor,
      vat_rate_bps: vatRateBps,
      vat_total_minor: vatTotalMinor,
    } satisfies DataRecord;
  });
}

function applyInvoiceTotals(header: DataRecord, lines: DataRecord[]) {
  const totals = computeInvoiceTotals(lines, number(header.discount_bps));

  header.document_total_minor = totals.documentTotalMinor;
  header.net_total_minor = totals.netTotalMinor;
  header.vat_total_minor = totals.vatTotalMinor;
}

function validateApproval(entity: DocumentEntity, header: DataRecord, lines: DataRecord[]) {
  if (["deliveryNotes", "invoices", "receipts"].includes(entity) && !header.account_id) {
    throw new Error("Account is required");
  }

  if (
    ["deliveryNotes", "invoices"].includes(entity) &&
    !String(header.actual_doc_no ?? "").trim()
  ) {
    throw new Error("Gercek evrak numarasi zorunludur");
  }

  if (["deliveryNotes", "invoices"].includes(entity) && lines.length === 0) {
    throw new Error("At least one line is required");
  }

  if (entity === "deliveryNotes" && !header.warehouse_id) {
    throw new Error("Depo secimi zorunludur");
  }

  if (entity === "invoices") {
    const hasDirectInvoiceLines = lines.some((line) => !hasDeliveryLink(line));

    if (header.invoice_kind === "SALES" && hasDirectInvoiceLines && !header.warehouse_id) {
      throw new Error("Depo secimi zorunludur");
    }
  }

  if (entity === "receipts" && number(header.amount_minor) <= 0) {
    throw new Error("Receipt amount must be greater than zero");
  }

  if (entity === "transfers") {
    if (!header.from_account_id || !header.to_account_id) {
      throw new Error("Transfer accounts are required");
    }

    if (header.from_account_id === header.to_account_id) {
      throw new Error("Transfer accounts must be different");
    }

    if (number(header.amount_minor) <= 0) {
      throw new Error("Transfer amount must be greater than zero");
    }
  }
}

async function postDocument(
  tx: Tx,
  entity: DocumentEntity,
  header: DataRecord,
  lines: DataRecord[],
) {
  const docType = documentType(entity, header);
  const docNo = String(header.doc_no);
  const docDate = toDate(header.doc_date);

  if (entity === "deliveryNotes") {
    const stockDirection = resolveDeliveryStockDirection(header);

    await tx.stockMovement.createMany({
      data: lines.map((line) => ({
        cancelledAt: null,
        docDate,
        docId: String(header.id),
        docNo,
        docType,
        itemId: String(line.item_id),
        isEffective: true,
        projectId: nullableString(header.project_id),
        qtyIn: stockDirection === "IN" ? number(line.quantity) : 0,
        qtyOut: stockDirection === "OUT" ? number(line.quantity) : 0,
        replacedByDocId: null,
        warehouseId: String(header.warehouse_id),
      })),
    });

    return;
  }

  if (entity === "invoices") {
    const totalMinor = number(header.document_total_minor);
    const isSales = header.invoice_kind === "SALES";

    await tx.accountLedgerEntry.create({
      data: {
        accountId: String(header.account_id),
        cancelledAt: null,
        creditMinor: isSales ? 0 : totalMinor,
        currency: currency(header.currency),
        debitMinor: isSales ? totalMinor : 0,
        description: isSales ? "Satis faturasi" : "Alis faturasi",
        docDate,
        docId: String(header.id),
        docNo,
        docType,
        isEffective: true,
        projectId: nullableString(header.project_id),
        relatedAccountId: null,
        replacedByDocId: null,
      },
    });

    if (header.warehouse_id) {
      const directLines = lines.filter((line) => !hasDeliveryLink(line));

      if (directLines.length) {
        await tx.stockMovement.createMany({
          data: directLines.map((line) => ({
            cancelledAt: null,
            docDate,
            docId: String(header.id),
            docNo,
            docType,
            itemId: String(line.item_id),
            isEffective: true,
            projectId: nullableString(header.project_id),
            qtyIn: isSales ? 0 : number(line.quantity),
            qtyOut: isSales ? number(line.quantity) : 0,
            replacedByDocId: null,
            warehouseId: String(header.warehouse_id),
          })),
        });
      }
    }

    return;
  }

  if (entity === "receipts") {
    const isPayment = header.receipt_kind === "PAYMENT";

    await tx.accountLedgerEntry.create({
      data: {
        accountId: String(header.account_id),
        cancelledAt: null,
        creditMinor: isPayment ? 0 : number(header.amount_minor),
        currency: currency(header.currency),
        debitMinor: isPayment ? number(header.amount_minor) : 0,
        description: nullableString(header.description) ?? String(header.receipt_kind),
        docDate,
        docId: String(header.id),
        docNo,
        docType,
        isEffective: true,
        projectId: nullableString(header.project_id),
        relatedAccountId: null,
        replacedByDocId: null,
      },
    });

    return;
  }

  await tx.accountLedgerEntry.createMany({
    data: [
      {
        accountId: String(header.from_account_id),
        cancelledAt: null,
        creditMinor: number(header.amount_minor),
        currency: currency(header.currency),
        debitMinor: 0,
        description: await describeTransferSide(tx, "OUT", header),
        docDate,
        docId: String(header.id),
        docNo,
        docType,
        isEffective: true,
        projectId: null,
        relatedAccountId: String(header.to_account_id),
        replacedByDocId: null,
      },
      {
        accountId: String(header.to_account_id),
        cancelledAt: null,
        creditMinor: 0,
        currency: await resolveTransferTargetCurrency(tx, header),
        debitMinor: resolveTransferTargetAmount(header),
        description: await describeTransferSide(tx, "IN", header),
        docDate,
        docId: String(header.id),
        docNo,
        docType,
        isEffective: true,
        projectId: null,
        relatedAccountId: String(header.from_account_id),
        replacedByDocId: null,
      },
    ],
  });
}

async function deactivateDocumentEffects(
  tx: Tx,
  id: string,
  replacedByDocId: string | null,
) {
  const cancelledAt = new Date();

  await tx.accountLedgerEntry.updateMany({
    data: {
      cancelledAt,
      isEffective: false,
      replacedByDocId,
    },
    where: { docId: id, isEffective: true },
  });
  await tx.stockMovement.updateMany({
    data: {
      cancelledAt,
      isEffective: false,
      replacedByDocId,
    },
    where: { docId: id, isEffective: true },
  });
}

async function supersedeDocument(
  tx: Tx,
  entity: DocumentEntity,
  header: DataRecord,
  replacedByDocId: string,
  actorUserId: string,
) {
  const supersededAt = new Date().toISOString();
  const nextHeader: DataRecord = {
    ...header,
    changed_by_user_id: actorUserId,
    is_effective: false,
    status: "SUPERSEDED",
    superseded_at: supersededAt,
    superseded_by_id: replacedByDocId,
  };

  await upsertHeader(tx, entity, String(header.id), nextHeader);
  await deactivateDocumentEffects(tx, String(header.id), replacedByDocId);
  await recordAudit(tx, entity, String(header.id), "SUPERSEDE", nextHeader, actorUserId);
}

async function assertPeriodLockAllows(
  tx: Tx,
  docDate: string,
  message: string,
) {
  const setting = await tx.setting.findUnique({ where: { key: "periodLock" } });
  const value =
    setting?.value && typeof setting.value === "object"
      ? (setting.value as { isActive?: boolean; lockDate?: string | null })
      : null;
  const lockDate =
    value?.isActive === true && typeof value.lockDate === "string" && value.lockDate.trim()
      ? value.lockDate.trim()
      : null;

  if (lockDate && docDate < lockDate) {
    throw new Error(message);
  }
}

async function resolveTransferTargetCurrency(tx: Tx, header: DataRecord): Promise<Currency> {
  const toAccountId = text(header.to_account_id);

  if (!toAccountId) {
    return currency(header.currency);
  }

  const account = await tx.account.findUnique({ where: { id: toAccountId } });

  return currency(account?.currency);
}

async function describeTransferSide(
  tx: Tx,
  side: "IN" | "OUT",
  header: DataRecord,
) {
  const fromAccountId = text(header.from_account_id);
  const toAccountId = text(header.to_account_id);
  const [fromAccount, toAccount] = await Promise.all([
    fromAccountId ? tx.account.findUnique({ where: { id: fromAccountId } }) : null,
    toAccountId ? tx.account.findUnique({ where: { id: toAccountId } }) : null,
  ]);
  const targetLabel = toAccount ? `${toAccount.code} - ${toAccount.name}` : toAccountId;
  const sourceLabel = fromAccount ? `${fromAccount.code} - ${fromAccount.name}` : fromAccountId;
  const note = nullableString(header.description);

  return side === "OUT"
    ? `${note ? `${note} | ` : ""}Virman -> ${targetLabel}`
    : `${note ? `${note} | ` : ""}Virman <- ${sourceLabel}`;
}

async function assertDocumentParityWithTx(
  tx: Tx,
  entity: DocumentEntity,
  header: DataRecord,
  lines: DataRecord[] | NonNullable<DocumentPayload["lines"]>,
) {
  if (entity === "deliveryNotes" || entity === "invoices" || entity === "receipts") {
    const accountId = text(header.account_id);

    if (!accountId) {
      return;
    }

    const account = await tx.account.findUnique({ where: { id: accountId } });

    if (!account) {
      throw new Error("Secilen cari bulunamadi");
    }

    if (!account.isActive) {
      throw new Error("Pasif cari ile yeni islem yapilamaz");
    }

    const expectedCurrency = currency(account?.currency);

    if (header.project_id) {
      const project = await tx.project.findUnique({ where: { id: text(header.project_id) } });

      if (!project) {
        throw new Error("Secilen proje bulunamadi");
      }

      if (!project.isActive) {
        throw new Error("Pasif proje ile yeni islem yapilamaz");
      }

      if (project && project.accountId !== accountId) {
        throw new Error("Secilen proje bu cariye bagli degil");
      }
    }

    if (header.warehouse_id) {
      const warehouse = await tx.warehouse.findUnique({
        where: { id: text(header.warehouse_id) },
      });

      if (!warehouse) {
        throw new Error("Secilen depo bulunamadi");
      }

      if (!warehouse.isActive) {
        throw new Error("Pasif depo ile yeni islem yapilamaz");
      }
    }

    if (entity === "invoices" || entity === "receipts") {
      if (currency(header.currency) !== expectedCurrency) {
        throw new Error(currencyLockMessage(expectedCurrency));
      }

      return;
    }

    for (const line of lines) {
      const item = await tx.item.findUnique({ where: { id: text(line.itemId ?? line.item_id) } });

      if (!item) {
        throw new Error("Secilen malzeme bulunamadi");
      }

      if (!item.isActive) {
        throw new Error("Pasif malzeme ile yeni islem yapilamaz");
      }

      const lineCurrency = "currency" in line ? line.currency : undefined;

      if (currency(lineCurrency) !== expectedCurrency) {
        throw new Error(currencyLockMessage(expectedCurrency));
      }
    }

    return;
  }

  const fromAccount = await tx.account.findUnique({
    where: { id: text(header.from_account_id) },
  });
  const toAccount = await tx.account.findUnique({
    where: { id: text(header.to_account_id) },
  });

  if (!fromAccount || !toAccount) {
    throw new Error("Virman carileri bulunamadi");
  }

  if (!fromAccount.isActive || !toAccount.isActive) {
    throw new Error("Pasif cari ile yeni virman yapilamaz");
  }

  const fromCurrency = currency(fromAccount?.currency);

  if (currency(header.currency) !== fromCurrency) {
    throw new Error(currencyLockMessage(fromCurrency));
  }

  if (toAccount && currency(toAccount.currency) !== fromCurrency) {
    if (
      number(header.cross_rate) <= 0 &&
      number(header.target_amount_minor) <= 0
    ) {
      throw new Error("Farkli dovizli virman icin capraz kur zorunludur");
    }
  }
}

function currencyLockMessage(expectedCurrency: Currency) {
  return `Cari doviz kuru ${expectedCurrency}. Bu caride sadece ${expectedCurrency} ile islem yapilabilir.`;
}

function dbCurrency(value: unknown): DbCurrency {
  return value === "USD"
    ? DbCurrency.USD
    : value === "EUR"
      ? DbCurrency.EUR
      : value === "GBP"
        ? DbCurrency.GBP
        : DbCurrency.TRY;
}

function dbDeliveryDirection(value: unknown): DbDeliveryDirection {
  return value === "IN" ? DbDeliveryDirection.IN : DbDeliveryDirection.OUT;
}

function dbDeliveryMergeRole(value: unknown): DbDeliveryMergeRole {
  return value === "MERGED_RESULT"
    ? DbDeliveryMergeRole.MERGED_RESULT
    : value === "MERGED_SOURCE"
      ? DbDeliveryMergeRole.MERGED_SOURCE
      : DbDeliveryMergeRole.NORMAL;
}

function dbDocumentStatus(value: unknown): DbDocumentStatus {
  return value === "APPROVED"
    ? DbDocumentStatus.APPROVED
    : value === "VOID"
      ? DbDocumentStatus.VOID
      : value === "SUPERSEDED"
        ? DbDocumentStatus.SUPERSEDED
        : DbDocumentStatus.DRAFT;
}

function dbInvoiceKind(value: unknown): DbInvoiceKind {
  return value === "PURCHASE" ? DbInvoiceKind.PURCHASE : DbInvoiceKind.SALES;
}

function dbInvoiceType(value: unknown): DbInvoiceType {
  return value === "STAR" ? DbInvoiceType.STAR : DbInvoiceType.STANDARD;
}

function dbReceiptKind(value: unknown): DbReceiptKind {
  return value === "PAYMENT" ? DbReceiptKind.PAYMENT : DbReceiptKind.COLLECTION;
}

async function assertDeliveryNoteCanVoid(tx: Tx, header: DataRecord) {
  if (String(header.merge_role ?? "NORMAL") === "MERGED_SOURCE") {
    throw new Error("I-Irsaliyeler iptal edilemez");
  }

  if (await noteHasActiveInvoiceLink(tx, String(header.id))) {
    throw new Error("Faturaya bagli irsaliyeler iptal edilemez");
  }
}

async function noteHasActiveInvoiceLink(tx: Tx, deliveryNoteId: string) {
  const invoicedDeliveryNoteIds = await getInvoicedDeliveryNoteIds(tx);

  return invoicedDeliveryNoteIds.has(deliveryNoteId);
}

async function getInvoicedDeliveryNoteIds(tx: Tx) {
  const activeInvoices = await tx.invoice.findMany({
    select: { id: true },
    where: { isEffective: true, status: { not: "VOID" } },
  });
  const activeInvoiceIds = activeInvoices.map((invoice) => invoice.id);

  if (!activeInvoiceIds.length) {
    return new Set<string>();
  }

  const invoiceLines = await tx.invoiceLine.findMany({
    where: { invoiceId: { in: activeInvoiceIds } },
  });
  const sourceDeliveryLineIds = Array.from(
    new Set(
      invoiceLines.flatMap((line) =>
        getStoredSourceDeliveryLineIds(invoiceLineRecord(line)),
      ),
    ),
  );

  if (!sourceDeliveryLineIds.length) {
    return new Set<string>();
  }

  const deliveryLines = await tx.deliveryNoteLine.findMany({
    select: { deliveryNoteId: true },
    where: { id: { in: sourceDeliveryLineIds } },
  });

  return new Set(deliveryLines.map((line) => line.deliveryNoteId));
}

async function reserveInvoiceDraftNumber(
  tx: Tx,
  entity: DocumentEntity,
  id: string,
  header: DataRecord,
) {
  if (entity !== "invoices") {
    return;
  }

  const currentDocNo = String(header.doc_no ?? "");

  if (!currentDocNo || currentDocNo.startsWith("DRAFT-")) {
    header.doc_no = await allocateDocumentNumber(
      tx,
      documentType(entity, header),
      id,
      String(header.doc_date),
    );
  }

  if (header.invoice_type === "STAR") {
    header.actual_doc_no = header.doc_no;
  }
}

async function allocateDocumentNumber(
  tx: Tx,
  docType: string,
  docId: string,
  docDate: string,
) {
  const date = toDate(docDate);
  const year = date.getUTCFullYear();
  const code = docCodes[docType as keyof typeof docCodes];

  if (!code) {
    throw new Error(`Unsupported document type: ${docType}`);
  }

  const counter = await tx.documentCounter.upsert({
    create: { docType: code, nextSeq: 2, year },
    update: { nextSeq: { increment: 1 } },
    where: { docType_year: { docType: code, year } },
  });
  const seq = counter.nextSeq - 1;
  const serial = String(seq).padStart(6, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(year).slice(-2);
  const docNo = `${dd}${mm}${yy}_${code}_${serial}`;

  await tx.documentNumberRegistry.create({
    data: {
      docId,
      docNo,
      docType,
      status: "ACTIVE",
    },
  });

  return docNo;
}

async function recordRevision(
  tx: Tx,
  docType: string,
  docId: string,
  reason: string,
  payload: DataRecord,
) {
  const revisionNo = (await tx.documentRevision.count({ where: { docId } })) + 1;

  await tx.documentRevision.create({
    data: {
      docId,
      docType,
      payload,
      reason,
      revisionNo,
    },
  });
}

async function recordAudit(
  tx: Tx,
  entity: DocumentEntity,
  entityId: string,
  action: string,
  payload: DataRecord,
  actorUserId: string,
) {
  await tx.auditEvent.create({
    data: { action, actorUserId, entity, entityId, payload },
  });
}

function buildDeliveryNoteWhere(query: ListQuery): Prisma.DeliveryNoteWhereInput {
  const search = normalizedSearch(query.search);
  const where: Prisma.DeliveryNoteWhereInput = {};

  if (query.status) {
    where.status = dbDocumentStatus(query.status);
  }

  if (query.accountId) {
    where.accountId = query.accountId;
  }

  if (query.projectId) {
    where.projectId = query.projectId;
  }

  if (query.warehouseId) {
    where.warehouseId = query.warehouseId;
  }

  if (query.direction) {
    where.direction = dbDeliveryDirection(query.direction);
  }

  applyDateRange(where, query);

  if (query.invoiceState === "INVOICED") {
    where.lines = {
      some: { invoiceLines: { some: { invoice: { isEffective: true, status: { not: "VOID" } } } } },
    };
  } else if (query.invoiceState === "UNINVOICED" || query.onlyOpenForInvoicing) {
    where.NOT = {
      lines: {
        some: {
          invoiceLines: { some: { invoice: { isEffective: true, status: { not: "VOID" } } } },
        },
      },
    };

    if (query.onlyOpenForInvoicing) {
      where.status = DbDocumentStatus.APPROVED;
      where.isEffective = true;
    }
  }

  if (search) {
    where.OR = [
      { docNo: { contains: search, mode: "insensitive" } },
      { actualDocNo: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { account: { code: { contains: search, mode: "insensitive" } } },
      { account: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  return where;
}

function buildInvoiceWhere(query: ListQuery): Prisma.InvoiceWhereInput {
  const search = normalizedSearch(query.search);
  const where: Prisma.InvoiceWhereInput = {};

  if (query.status) {
    where.status = dbDocumentStatus(query.status);
  }

  if (query.accountId) {
    where.accountId = query.accountId;
  }

  if (query.projectId) {
    where.projectId = query.projectId;
  }

  if (query.warehouseId) {
    where.warehouseId = query.warehouseId;
  }

  if (query.invoiceKind) {
    where.invoiceKind = dbInvoiceKind(query.invoiceKind);
  }

  applyDateRange(where, query);

  if (search) {
    where.OR = [
      { docNo: { contains: search, mode: "insensitive" } },
      { actualDocNo: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { account: { code: { contains: search, mode: "insensitive" } } },
      { account: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  return where;
}

function buildReceiptWhere(query: ListQuery): Prisma.ReceiptWhereInput {
  const search = normalizedSearch(query.search);
  const where: Prisma.ReceiptWhereInput = {};

  if (query.status) {
    where.status = dbDocumentStatus(query.status);
  }

  if (query.accountId) {
    where.accountId = query.accountId;
  }

  if (query.projectId) {
    where.projectId = query.projectId;
  }

  applyDateRange(where, query);

  if (search) {
    where.OR = [
      { docNo: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { account: { code: { contains: search, mode: "insensitive" } } },
      { account: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  return where;
}

function buildTransferWhere(query: ListQuery): Prisma.TransferWhereInput {
  const search = normalizedSearch(query.search);
  const where: Prisma.TransferWhereInput = {};

  if (query.status) {
    where.status = dbDocumentStatus(query.status);
  }

  if (query.accountId) {
    where.OR = [{ fromAccountId: query.accountId }, { toAccountId: query.accountId }];
  }

  if (query.projectId) {
    where.projectId = query.projectId;
  }

  applyDateRange(where, query);

  if (search) {
    const searchOr: Prisma.TransferWhereInput[] = [
      { docNo: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { fromAccount: { code: { contains: search, mode: "insensitive" } } },
      { fromAccount: { name: { contains: search, mode: "insensitive" } } },
      { toAccount: { code: { contains: search, mode: "insensitive" } } },
      { toAccount: { name: { contains: search, mode: "insensitive" } } },
    ];

    where.AND = where.OR
      ? [{ OR: where.OR as Prisma.TransferWhereInput[] }, { OR: searchOr }]
      : [{ OR: searchOr }];
    delete where.OR;
  }

  return where;
}

function applyDateRange(
  where:
    | Prisma.DeliveryNoteWhereInput
    | Prisma.InvoiceWhereInput
    | Prisma.ReceiptWhereInput
    | Prisma.TransferWhereInput,
  query: ListQuery,
) {
  if (!query.dateFrom && !query.dateTo) {
    return;
  }

  where.docDate = {};

  if (query.dateFrom) {
    where.docDate.gte = toDate(query.dateFrom);
  }

  if (query.dateTo) {
    where.docDate.lte = toDate(query.dateTo);
  }
}

function normalizedSearch(value: string | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function defaultsFor(entity: DocumentEntity): DataRecord {
  const common = { doc_date: today(), status: "DRAFT" };

  switch (entity) {
    case "deliveryNotes":
      return { ...common, direction: "OUT", is_return: false, merge_role: "NORMAL" };
    case "invoices":
      return {
        ...common,
        currency: "TRY",
        discount_bps: 0,
        invoice_kind: "SALES",
        invoice_type: "STANDARD",
      };
    case "receipts":
      return { ...common, amount_minor: 0, currency: "TRY", receipt_kind: "COLLECTION" };
    case "transfers":
      return { ...common, amount_minor: 0, cross_rate: 1, currency: "TRY" };
  }
}

function computeInvoiceTotals(lines: DataRecord[], discountBps: number) {
  const grossPerLine = lines.map((line) =>
    roundMinor(number(line.quantity) * number(line.unit_price_minor)),
  );
  const totalGross = grossPerLine.reduce((total, value) => total + value, 0);
  const totalDiscount = roundMinor((totalGross * discountBps) / 10000);
  const discountShares: number[] = [];
  let allocated = 0;

  grossPerLine.forEach((gross, index) => {
    if (index === grossPerLine.length - 1) {
      discountShares.push(totalDiscount - allocated);
      return;
    }

    const share = roundMinor((gross * discountBps) / 10000);

    allocated += share;
    discountShares.push(share);
  });

  let netTotalMinor = 0;
  let vatTotalMinor = 0;

  lines.forEach((line, index) => {
    const discountedBase = grossPerLine[index] - discountShares[index];
    const vat = roundMinor((discountedBase * number(line.vat_rate_bps)) / 10000);

    netTotalMinor += discountedBase;
    vatTotalMinor += vat;
  });

  return {
    documentTotalMinor: netTotalMinor + vatTotalMinor,
    netTotalMinor,
    vatTotalMinor,
  };
}

function getInvoiceSourceDeliveryLineIds(
  line: Pick<
    NonNullable<DocumentPayload["lines"]>[number],
    "deliveryNoteLineId" | "sourceDeliveryLineIds"
  >,
) {
  return Array.from(
    new Set(
      [
        line.deliveryNoteLineId ?? null,
        ...(Array.isArray(line.sourceDeliveryLineIds) ? line.sourceDeliveryLineIds : []),
      ]
        .map((value) => String(value ?? "").trim())
        .filter((value) => value.length > 0),
    ),
  );
}

function hasDeliveryLink(line: DataRecord) {
  return getStoredSourceDeliveryLineIds(line).length > 0;
}

function getStoredSourceDeliveryLineIds(line: DataRecord) {
  const ids = line.source_delivery_line_ids;
  const singleId = String(line.delivery_note_line_id ?? "").trim();
  const allIds = [
    singleId,
    ...(Array.isArray(ids) ? ids : typeof ids === "string" ? ids.split("|") : []),
  ];

  return Array.from(
    new Set(allIds.map((value) => value.trim()).filter((value) => value.length > 0)),
  );
}

function resolveDeliveryStockDirection(header: DataRecord): "IN" | "OUT" {
  const baseIsInbound = String(header.direction) === "IN";
  const isReturn = header.is_return === true || Number(header.is_return ?? 0) === 1;

  return baseIsInbound !== isReturn ? "IN" : "OUT";
}

function resolveTransferTargetAmount(header: DataRecord) {
  if (typeof header.target_amount_minor === "number") {
    return header.target_amount_minor;
  }

  const crossRate = number(header.cross_rate);

  return crossRate > 0
    ? roundMinor(number(header.amount_minor) * crossRate)
    : number(header.amount_minor);
}

async function resolveLatestPurchaseCost(
  itemId: string,
  costCurrency: Currency,
  effectiveAt: string,
) {
  return (
    (await findLatestPurchaseInvoiceCost(itemId, costCurrency, effectiveAt)) ??
    (await findLatestInboundDeliveryCost(itemId, costCurrency, effectiveAt)) ??
    0
  );
}

async function findLatestPurchaseInvoiceCost(
  itemId: string,
  costCurrency: Currency,
  effectiveAt: string,
) {
  const invoices = await prisma.invoice.findMany({
    where: {
      isEffective: true,
      currency: costCurrency,
      invoiceKind: "PURCHASE",
      status: "APPROVED",
    },
  });
  const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const lines = await prisma.invoiceLine.findMany({
    where: {
      invoiceId: { in: invoices.map((invoice) => invoice.id) },
      itemId,
    },
  });
  const candidates = lines
    .map((line) => {
      const invoice = invoiceById.get(line.invoiceId);

      return invoice
        ? {
            amountMinor: line.unitPriceMinor,
            effectiveAt: effectiveDocumentTime(invoiceRecord(invoice)),
            invoice,
          }
        : null;
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .filter((candidate) => candidate.effectiveAt <= effectiveAt)
    .toSorted((left, right) => {
      const byEffectiveAt = right.effectiveAt.localeCompare(left.effectiveAt);

      return byEffectiveAt || right.invoice.createdAt.getTime() - left.invoice.createdAt.getTime();
    });

  return candidates[0]?.amountMinor ?? null;
}

async function findLatestInboundDeliveryCost(
  itemId: string,
  costCurrency: Currency,
  effectiveAt: string,
) {
  const deliveryNotes = await prisma.deliveryNote.findMany({
    where: { isEffective: true, status: "APPROVED" },
  });
  const deliveryNoteById = new Map(deliveryNotes.map((note) => [note.id, note]));
  const lines = await prisma.deliveryNoteLine.findMany({
    where: {
      currency: costCurrency,
      deliveryNoteId: { in: deliveryNotes.map((note) => note.id) },
      itemId,
      unitPriceMinor: { gt: 0 },
    },
  });
  const candidates = lines
    .map((line) => {
      const deliveryNote = deliveryNoteById.get(line.deliveryNoteId);

      return deliveryNote
        ? {
            amountMinor: line.unitPriceMinor,
            deliveryNote,
            effectiveAt: effectiveDocumentTime(deliveryHeaderRecord(deliveryNote)),
          }
        : null;
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .filter(
      (candidate) =>
        resolveDeliveryStockDirection(deliveryHeaderRecord(candidate.deliveryNote)) === "IN",
    )
    .filter((candidate) => candidate.effectiveAt <= effectiveAt)
    .toSorted((left, right) => {
      const byEffectiveAt = right.effectiveAt.localeCompare(left.effectiveAt);

      return (
        byEffectiveAt ||
        right.deliveryNote.createdAt.getTime() - left.deliveryNote.createdAt.getTime()
      );
    });

  return candidates[0]?.amountMinor ?? null;
}

function effectiveDocumentTime(header: DataRecord) {
  return typeof header.approved_at === "string" && header.approved_at
    ? header.approved_at
    : `${String(header.doc_date)}T23:59:59.999Z`;
}

function documentType(entity: DocumentEntity, header: DataRecord) {
  if (entity === "deliveryNotes") {
    const direction = String(header.direction);
    const mergeRole = String(header.merge_role ?? "NORMAL");

    if (mergeRole === "MERGED_RESULT") {
      return direction === "IN"
        ? "DELIVERY_NOTE_MERGED_RESULT_IN"
        : "DELIVERY_NOTE_MERGED_RESULT_OUT";
    }

    if (mergeRole === "MERGED_SOURCE") {
      return direction === "IN"
        ? "DELIVERY_NOTE_MERGED_SOURCE_IN"
        : "DELIVERY_NOTE_MERGED_SOURCE_OUT";
    }

    return direction === "IN" ? "DELIVERY_NOTE_IN" : "DELIVERY_NOTE_OUT";
  }

  if (entity === "invoices") {
    return `${header.invoice_kind === "PURCHASE" ? "PURCHASE" : "SALES"}_INVOICE_${
      header.invoice_type === "STAR" ? "STAR" : "STANDARD"
    }`;
  }

  if (entity === "receipts") {
    return header.receipt_kind === "PAYMENT" ? "RECEIPT_PAYMENT" : "RECEIPT_COLLECTION";
  }

  return "TRANSFER";
}

function parentKey(entity: DocumentEntity) {
  switch (entity) {
    case "deliveryNotes":
      return "delivery_note_id";
    case "invoices":
      return "invoice_id";
    case "receipts":
      return "receipt_id";
    case "transfers":
      return "transfer_id";
  }
}

function deliveryHeaderRecord(row: {
  accountId: string;
  actualDocNo: string | null;
  approvedAt: Date | null;
  changeNote?: string | null;
  changedByUserId?: string | null;
  createdAt: Date;
  description: string | null;
  direction: string;
  docDate: Date;
  docNo: string;
  id: string;
  isEffective?: boolean;
  isReturn: boolean;
  mergeRole: string;
  projectId: string | null;
  status: string;
  supersededAt?: Date | null;
  supersededById?: string | null;
  supersedesId?: string | null;
  updatedAt: Date;
  voidReason?: string | null;
  voidedAt: Date | null;
  warehouseId: string;
}): DataRecord {
  return {
    account_id: row.accountId,
    actual_doc_no: row.actualDocNo,
    approved_at: row.approvedAt ? isoString(row.approvedAt) : null,
    change_note: row.changeNote ?? null,
    changed_by_user_id: row.changedByUserId ?? null,
    created_at: isoString(row.createdAt),
    description: row.description,
    direction: row.direction,
    doc_date: dateString(row.docDate),
    doc_no: row.docNo,
    id: row.id,
    is_effective: row.isEffective !== false,
    is_return: row.isReturn,
    merge_role: row.mergeRole,
    project_id: row.projectId,
    status: row.status,
    superseded_at: row.supersededAt ? isoString(row.supersededAt) : null,
    superseded_by_id: row.supersededById ?? null,
    supersedes_id: row.supersedesId ?? null,
    updated_at: isoString(row.updatedAt),
    void_reason: row.voidReason ?? null,
    voided_at: row.voidedAt ? isoString(row.voidedAt) : null,
    warehouse_id: row.warehouseId,
  };
}

function invoiceRecord(row: {
  accountId: string;
  actualDocNo: string | null;
  approvedAt: Date | null;
  changeNote?: string | null;
  changedByUserId?: string | null;
  createdAt: Date;
  currency: string;
  description: string | null;
  discountBps: number;
  docDate: Date;
  docNo: string;
  documentTotalMinor: number;
  exchangeRate: unknown;
  id: string;
  isEffective?: boolean;
  invoiceKind: string;
  invoiceType: string;
  netTotalMinor: number;
  projectId: string | null;
  status: string;
  supersededAt?: Date | null;
  supersededById?: string | null;
  supersedesId?: string | null;
  updatedAt: Date;
  vatTotalMinor: number;
  voidReason?: string | null;
  voidedAt: Date | null;
  warehouseId?: string | null;
}): DataRecord {
  return {
    account_id: row.accountId,
    actual_doc_no: row.actualDocNo,
    approved_at: row.approvedAt ? isoString(row.approvedAt) : null,
    change_note: row.changeNote ?? null,
    changed_by_user_id: row.changedByUserId ?? null,
    created_at: isoString(row.createdAt),
    currency: row.currency,
    description: row.description,
    discount_bps: row.discountBps,
    doc_date: dateString(row.docDate),
    doc_no: row.docNo,
    document_total_minor: row.documentTotalMinor,
    exchange_rate: number(row.exchangeRate) || 1,
    id: row.id,
    is_effective: row.isEffective !== false,
    invoice_kind: row.invoiceKind,
    invoice_type: row.invoiceType,
    net_total_minor: row.netTotalMinor,
    project_id: row.projectId,
    status: row.status,
    superseded_at: row.supersededAt ? isoString(row.supersededAt) : null,
    superseded_by_id: row.supersededById ?? null,
    supersedes_id: row.supersedesId ?? null,
    updated_at: isoString(row.updatedAt),
    vat_total_minor: row.vatTotalMinor,
    void_reason: row.voidReason ?? null,
    voided_at: row.voidedAt ? isoString(row.voidedAt) : null,
    warehouse_id: row.warehouseId ?? null,
  };
}

function receiptRecord(row: {
  accountId: string;
  amountMinor: number;
  approvedAt: Date | null;
  changeNote?: string | null;
  changedByUserId?: string | null;
  createdAt: Date;
  currency: string;
  description: string | null;
  docDate: Date;
  docNo: string;
  id: string;
  isEffective?: boolean;
  projectId: string | null;
  receiptKind: string;
  status: string;
  supersededAt?: Date | null;
  supersededById?: string | null;
  supersedesId?: string | null;
  updatedAt: Date;
  voidReason?: string | null;
  voidedAt: Date | null;
}): DataRecord {
  return {
    account_id: row.accountId,
    amount_minor: row.amountMinor,
    approved_at: row.approvedAt ? isoString(row.approvedAt) : null,
    change_note: row.changeNote ?? null,
    changed_by_user_id: row.changedByUserId ?? null,
    created_at: isoString(row.createdAt),
    currency: row.currency,
    description: row.description,
    doc_date: dateString(row.docDate),
    doc_no: row.docNo,
    id: row.id,
    is_effective: row.isEffective !== false,
    project_id: row.projectId,
    receipt_kind: row.receiptKind,
    status: row.status,
    superseded_at: row.supersededAt ? isoString(row.supersededAt) : null,
    superseded_by_id: row.supersededById ?? null,
    supersedes_id: row.supersedesId ?? null,
    updated_at: isoString(row.updatedAt),
    void_reason: row.voidReason ?? null,
    voided_at: row.voidedAt ? isoString(row.voidedAt) : null,
  };
}

function transferRecord(row: {
  amountMinor: number;
  approvedAt: Date | null;
  changeNote?: string | null;
  changedByUserId?: string | null;
  createdAt: Date;
  crossRate?: unknown;
  currency: string;
  description: string | null;
  docDate: Date;
  docNo: string;
  fromAccountId: string;
  id: string;
  isEffective?: boolean;
  projectId: string | null;
  status: string;
  supersededAt?: Date | null;
  supersededById?: string | null;
  supersedesId?: string | null;
  targetAmountMinor?: number | null;
  toAccountId: string;
  updatedAt: Date;
  voidReason?: string | null;
  voidedAt: Date | null;
}): DataRecord {
  return {
    amount_minor: row.amountMinor,
    approved_at: row.approvedAt ? isoString(row.approvedAt) : null,
    change_note: row.changeNote ?? null,
    changed_by_user_id: row.changedByUserId ?? null,
    created_at: isoString(row.createdAt),
    cross_rate: number(row.crossRate),
    currency: row.currency,
    description: row.description,
    doc_date: dateString(row.docDate),
    doc_no: row.docNo,
    from_account_id: row.fromAccountId,
    id: row.id,
    is_effective: row.isEffective !== false,
    project_id: row.projectId,
    status: row.status,
    superseded_at: row.supersededAt ? isoString(row.supersededAt) : null,
    superseded_by_id: row.supersededById ?? null,
    supersedes_id: row.supersedesId ?? null,
    target_amount_minor: row.targetAmountMinor ?? null,
    to_account_id: row.toAccountId,
    updated_at: isoString(row.updatedAt),
    void_reason: row.voidReason ?? null,
    voided_at: row.voidedAt ? isoString(row.voidedAt) : null,
  };
}

function deliveryLineRecord(row: {
  currency?: string;
  deliveryNoteId: string;
  description: string | null;
  grossTotalMinor?: number;
  id: string;
  itemId: string;
  lineTotalMinor: number;
  netTotalMinor?: number;
  quantity: unknown;
  unitPriceMinor: number;
  vatRateBps: number;
  vatTotalMinor?: number;
}): DataRecord {
  return {
    currency: currency(row.currency),
    delivery_note_id: row.deliveryNoteId,
    description: row.description,
    gross_total_minor: row.grossTotalMinor ?? row.lineTotalMinor,
    id: row.id,
    item_id: row.itemId,
    line_total_minor: row.lineTotalMinor,
    net_total_minor: row.netTotalMinor ?? row.lineTotalMinor,
    quantity: number(row.quantity),
    unit_price_minor: row.unitPriceMinor,
    vat_rate_bps: row.vatRateBps,
    vat_total_minor: row.vatTotalMinor ?? 0,
  };
}

function invoiceLineRecord(row: {
  deliveryNoteLineId: string | null;
  description: string | null;
  discountBps: number;
  grossTotalMinor: number;
  id: string;
  invoiceId: string;
  itemId: string;
  lineTotalMinor?: number;
  netTotalMinor: number;
  quantity: unknown;
  sourceDeliveryLineIds?: string[];
  unitPriceMinor: number;
  vatRateBps: number;
  vatTotalMinor: number;
}): DataRecord {
  return {
    delivery_note_line_id: row.deliveryNoteLineId,
    description: row.description,
    discount_bps: row.discountBps,
    gross_total_minor: row.grossTotalMinor,
    id: row.id,
    invoice_id: row.invoiceId,
    item_id: row.itemId,
    line_total_minor: row.lineTotalMinor ?? row.grossTotalMinor,
    net_total_minor: row.netTotalMinor,
    quantity: number(row.quantity),
    source_delivery_line_ids: row.sourceDeliveryLineIds ?? [],
    unit_price_minor: row.unitPriceMinor,
    vat_rate_bps: row.vatRateBps,
    vat_total_minor: row.vatTotalMinor,
  };
}

function ledgerEntryRecord(row: {
  accountId: string;
  cancelledAt?: Date | null;
  createdAt: Date;
  creditMinor: number;
  currency: string;
  debitMinor: number;
  description: string | null;
  docDate: Date;
  docId: string;
  docNo: string;
  docType: string;
  id: string;
  isEffective?: boolean;
  projectId: string | null;
  relatedAccountId?: string | null;
  replacedByDocId?: string | null;
}): LedgerEntry {
  return {
    accountId: row.accountId,
    cancelledAt: row.cancelledAt ? isoString(row.cancelledAt) : null,
    createdAt: isoString(row.createdAt),
    creditMinor: row.creditMinor,
    currency: currency(row.currency),
    debitMinor: row.debitMinor,
    description: row.description,
    docDate: dateString(row.docDate),
    docId: row.docId,
    docNo: row.docNo,
    docType: row.docType,
    id: row.id,
    isEffective: row.isEffective !== false,
    projectId: row.projectId,
    relatedAccountId: row.relatedAccountId ?? null,
    replacedByDocId: row.replacedByDocId ?? null,
  };
}

function stockMovementRecord(row: {
  cancelledAt?: Date | null;
  createdAt: Date;
  docDate: Date;
  docId: string;
  docNo: string;
  docType: string;
  id: string;
  isEffective?: boolean;
  itemId: string;
  projectId: string | null;
  qtyIn: unknown;
  qtyOut: unknown;
  replacedByDocId?: string | null;
  warehouseId: string;
}): StockMovement {
  return {
    cancelledAt: row.cancelledAt ? isoString(row.cancelledAt) : null,
    createdAt: isoString(row.createdAt),
    docDate: dateString(row.docDate),
    docId: row.docId,
    docNo: row.docNo,
    docType: row.docType,
    id: row.id,
    isEffective: row.isEffective !== false,
    itemId: row.itemId,
    projectId: row.projectId,
    qtyIn: number(row.qtyIn),
    qtyOut: number(row.qtyOut),
    replacedByDocId: row.replacedByDocId ?? null,
    warehouseId: row.warehouseId,
  };
}

function auditEventRecord(row: {
  action: string;
  actorUserId: string | null;
  createdAt: Date;
  entity: string;
  entityId: string;
  id: string;
  payload: Prisma.JsonValue | null;
}) {
  const payload =
    row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? Object.fromEntries(
          Object.entries(row.payload as Record<string, unknown>).map(([key, value]) => [
            key,
            dataValue(value),
          ]),
        )
      : null;

  return {
    action: row.action,
    actorUserId: row.actorUserId,
    createdAt: isoString(row.createdAt),
    entity: row.entity,
    entityId: row.entityId,
    id: row.id,
    payload,
  };
}

function revisionRecord(row: {
  createdAt: Date;
  docId: string;
  docType: string;
  editedAt: Date;
  id: string;
  reason: string | null;
  revisionNo: number;
}): DataRecord {
  return {
    created_at: isoString(row.createdAt),
    doc_id: row.docId,
    doc_type: row.docType,
    edited_at: isoString(row.editedAt),
    id: row.id,
    reason: row.reason,
    revision_no: row.revisionNo,
  };
}

function optionalDate(value: unknown) {
  return value ? toDate(value) : null;
}

function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function draftDocNo(id: string) {
  return `DRAFT-${id.slice(0, 8).toUpperCase()}`;
}
