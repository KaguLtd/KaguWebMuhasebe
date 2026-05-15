import { randomUUID } from "node:crypto";

import type {
  AppSnapshot,
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
import { camelToSnake } from "./helpers";

type DocumentStore = {
  headers: Record<DocumentEntity, DataRecord[]>;
  lines: Record<DocumentEntity, DataRecord[]>;
  revisions: DataRecord[];
  ledgerEntries: LedgerEntry[];
  stockMovements: StockMovement[];
  counters: Record<string, number>;
  registry: DataRecord[];
};

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
  SALES_INVOICE_STANDARD: "SF",
  SALES_INVOICE_STAR: "SF",
  PURCHASE_INVOICE_STANDARD: "AF",
  PURCHASE_INVOICE_STAR: "AF",
  RECEIPT_COLLECTION: "TAH",
  RECEIPT_PAYMENT: "ODM",
  TRANSFER: "VIR",
} as const;

const globalForDocuments = globalThis as typeof globalThis & {
  __kaguDocumentStore?: DocumentStore;
};

export function isDocumentEntity(entity: string): entity is DocumentEntity {
  return documentEntities.has(entity as DocumentEntity);
}

export function listDocuments(
  entity: DocumentEntity,
  query: ListQuery = {},
): PaginatedResult<DataRecord> {
  const page = Math.max(1, Number(query.page ?? 1));
  const pageSize = Math.min(100, Math.max(5, Number(query.pageSize ?? 20)));
  const search = normalize(query.search);
  let rows = getDocumentStore().headers[entity].map(enrichHeader);

  if (query.status) {
    rows = rows.filter((row) => row.status === query.status);
  }

  if (query.accountId && ["deliveryNotes", "invoices", "receipts"].includes(entity)) {
    rows = rows.filter((row) => row.account_id === query.accountId);
  }

  if (query.projectId && ["deliveryNotes", "invoices", "receipts"].includes(entity)) {
    rows = rows.filter((row) => row.project_id === query.projectId);
  }

  if (query.warehouseId && ["deliveryNotes", "invoices"].includes(entity)) {
    rows = rows.filter((row) => row.warehouse_id === query.warehouseId);
  }

  if (query.direction && entity === "deliveryNotes") {
    rows = rows.filter((row) => row.direction === query.direction);
  }

  if (entity === "deliveryNotes" && query.invoiceState === "INVOICED") {
    rows = rows.filter((row) => noteHasActiveInvoiceLink(String(row.id)));
  }

  if (
    entity === "deliveryNotes" &&
    (query.invoiceState === "UNINVOICED" || query.onlyOpenForInvoicing)
  ) {
    rows = rows.filter(
      (row) => row.status === "APPROVED" && !noteHasActiveInvoiceLink(String(row.id)),
    );
  }

  if (query.invoiceKind && entity === "invoices") {
    rows = rows.filter((row) => row.invoice_kind === query.invoiceKind);
  }

  if (query.dateFrom) {
    rows = rows.filter((row) => String(row.doc_date) >= String(query.dateFrom));
  }

  if (query.dateTo) {
    rows = rows.filter((row) => String(row.doc_date) <= String(query.dateTo));
  }

  if (search) {
    rows = rows.filter((row) =>
      Object.values(row).some((value) => normalize(String(value)).includes(search)),
    );
  }

  rows = rows.toSorted((left, right) =>
    String(right.created_at).localeCompare(String(left.created_at)),
  );

  const total = rows.length;
  const start = (page - 1) * pageSize;

  return {
    items: rows.slice(start, start + pageSize),
    total,
    page,
    pageSize,
  };
}

export function getDocument(
  entity: DocumentEntity,
  id: string,
): DocumentDetail<DataRecord> | null {
  const store = getDocumentStore();
  const header = store.headers[entity].find((row) => row.id === id);

  if (!header) {
    return null;
  }

  return {
    auditEvents: [],
    header: enrichHeader(header),
    lines: store.lines[entity].filter((line) => line[parentKey(entity)] === id),
    revisions: store.revisions.filter((row) => row.doc_id === id),
    ledgerEntries: store.ledgerEntries.filter((row) => row.docId === id),
    stockMovements: store.stockMovements.filter((row) => row.docId === id),
  };
}

export function getDocumentHeaders(entity: DocumentEntity) {
  return getDocumentStore().headers[entity].map(enrichHeader);
}

export function getAllLedgerEntries() {
  return [...getDocumentStore().ledgerEntries];
}

export function getAllStockMovements() {
  return [...getDocumentStore().stockMovements];
}

export function getAccountBalanceMinor(accountId: string) {
  return getDocumentStore().ledgerEntries
    .filter((entry) => entry.accountId === accountId)
    .reduce((balance, entry) => balance + entry.debitMinor - entry.creditMinor, 0);
}

export function getItemStockQuantity(itemId: string) {
  return getDocumentStore().stockMovements
    .filter((movement) => movement.itemId === itemId)
    .reduce((quantity, movement) => quantity + movement.qtyIn - movement.qtyOut, 0);
}

export function getInvoiceMetrics(invoiceId: string): InvoiceMetrics | null {
  const store = getDocumentStore();
  const invoice = store.headers.invoices.find((header) => header.id === invoiceId);

  if (!invoice) {
    return null;
  }

  const lines = store.lines.invoices.filter((line) => line.invoice_id === invoiceId);
  const effectiveAt = effectiveDocumentTime(invoice);
  const invoiceCurrency = currency(invoice.currency);
  let invoiceNetTotalMinor = 0;
  let invoiceGrossTotalMinor = 0;
  let costTotalMinor = 0;

  for (const line of lines) {
    const base = roundMinor(number(line.quantity) * number(line.unit_price_minor));
    const vat = roundMinor((base * number(line.vat_rate_bps)) / 10000);

    invoiceNetTotalMinor += base;
    invoiceGrossTotalMinor += base + vat;
    costTotalMinor += roundMinor(
      number(line.quantity) *
        resolveLatestPurchaseCost(
          String(line.item_id),
          invoiceCurrency,
          effectiveAt,
        ),
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

export function getDashboardTotals(): AppSnapshot["dashboard"] {
  const todayDate = today();
  const weekStart = addDays(todayDate, -6);
  const monthStart = todayDate.slice(0, 8) + "01";
  const dailySalesByCurrency = emptyCurrencyTotals();
  const weeklySalesByCurrency = emptyCurrencyTotals();
  const monthlySalesByCurrency = emptyCurrencyTotals();
  const inventoryTotalByCurrency = getInventoryTotalsByCurrency();
  let todayDocumentCount = 0;

  for (const entity of documentEntities) {
    for (const header of getDocumentStore().headers[entity]) {
      if (String(header.doc_date) === todayDate) {
        todayDocumentCount += 1;
      }

      if (header.status !== "APPROVED") {
        continue;
      }

      if (entity !== "invoices" || header.invoice_kind !== "SALES") {
        continue;
      }

      const docDate = String(header.doc_date);
      const amount = getInvoiceNetSalesTotal(String(header.id));
      const docCurrency = currency(header.currency);

      if (docDate === todayDate) {
        dailySalesByCurrency[docCurrency] += amount;
      }

      if (docDate >= weekStart && docDate <= todayDate) {
        weeklySalesByCurrency[docCurrency] += amount;
      }

      if (docDate >= monthStart && docDate <= todayDate) {
        monthlySalesByCurrency[docCurrency] += amount;
      }
    }
  }

  return {
    dailySalesTotalMinor: sumCurrencyTotals(dailySalesByCurrency),
    weeklySalesTotalMinor: sumCurrencyTotals(weeklySalesByCurrency),
    monthlySalesTotalMinor: sumCurrencyTotals(monthlySalesByCurrency),
    todayDocumentCount,
    inventoryTotalMinor: sumCurrencyTotals(inventoryTotalByCurrency),
    dailySalesByCurrency,
    weeklySalesByCurrency,
    monthlySalesByCurrency,
    inventoryTotalByCurrency,
  };
}

export function saveDocumentDraft(entity: DocumentEntity, payload: DocumentPayload) {
  const store = getDocumentStore();
  const id = typeof payload.id === "string" && payload.id ? payload.id : randomUUID();
  const existingIndex = store.headers[entity].findIndex((row) => row.id === id);
  const existing = existingIndex >= 0 ? store.headers[entity][existingIndex] : null;

  if (existing?.status === "VOID") {
    throw new Error("Voided documents cannot be edited");
  }

  if (existing?.status === "APPROVED" && !payload.editReason) {
    throw new Error("Editing an approved document requires an edit reason");
  }

  const now = nowIso();
  const status = existing?.status === "APPROVED" ? "APPROVED" : "DRAFT";
  const nextHeader: DataRecord = {
    ...(existing ?? {}),
    ...defaultsFor(entity),
    ...normalizeDocumentPayload(payload),
    id,
    doc_no: existing?.doc_no ?? draftDocNo(id),
    status,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };

  reserveInvoiceDraftNumber(entity, id, nextHeader);

  const nextLines = normalizeLines(entity, id, payload.lines ?? []);

  if (entity === "invoices") {
    applyInvoiceTotals(nextHeader, nextLines);
  }

  if (existingIndex >= 0) {
    store.headers[entity][existingIndex] = nextHeader;
  } else {
    store.headers[entity].unshift(nextHeader);
  }

  store.lines[entity] = [
    ...store.lines[entity].filter((line) => line[parentKey(entity)] !== id),
    ...nextLines,
  ];

  if (existing?.status === "APPROVED") {
    unpostDocument(id);
    postDocument(entity, nextHeader, nextLines);
    recordRevision(documentType(entity, nextHeader), id, String(payload.editReason));
  }

  return getDocument(entity, id);
}

export function approveDocument(entity: DocumentEntity, id: string) {
  const store = getDocumentStore();
  const index = store.headers[entity].findIndex((row) => row.id === id);
  const header = index >= 0 ? store.headers[entity][index] : null;

  if (!header) {
    throw new Error("Document not found");
  }

  if (header.status === "VOID") {
    throw new Error("Cannot approve a voided document");
  }

  if (header.status === "APPROVED") {
    return getDocument(entity, id);
  }

  const lines = store.lines[entity].filter((line) => line[parentKey(entity)] === id);

  validateApproval(entity, header, lines);

  const docType = documentType(entity, header);
  const now = nowIso();
  const nextHeader: DataRecord = {
    ...header,
    doc_no: String(header.doc_no).startsWith("DRAFT-")
      ? allocateDocumentNumber(docType, id, String(header.doc_date))
      : header.doc_no,
    status: "APPROVED",
    approved_at: now,
    updated_at: now,
  };

  if (entity === "invoices" && nextHeader.invoice_type === "STAR") {
    nextHeader.actual_doc_no = nextHeader.doc_no;
  }

  store.headers[entity][index] = nextHeader;
  unpostDocument(id);
  postDocument(entity, nextHeader, lines);
  if (entity === "invoices") {
    finalizeInvoiceDeliveryTransfer(nextHeader, lines);
  }

  return getDocument(entity, id);
}

export function voidDocument(entity: DocumentEntity, id: string, reason: string) {
  const store = getDocumentStore();
  const index = store.headers[entity].findIndex((row) => row.id === id);
  const header = index >= 0 ? store.headers[entity][index] : null;

  if (!header) {
    throw new Error("Document not found");
  }

  if (!reason.trim()) {
    throw new Error("Void reason is required");
  }

  if (header.status === "VOID") {
    return getDocument(entity, id);
  }

  const now = nowIso();

  if (entity === "deliveryNotes") {
    assertDeliveryNoteCanVoid(header);
  }

  unpostDocument(id);
  store.headers[entity][index] = {
    ...header,
    status: "VOID",
    updated_at: now,
    void_reason: reason,
    voided_at: now,
  };
  if (entity === "invoices") {
    restoreDeliveryNotesFromVoidedInvoice(id);
  }
  recordRevision(documentType(entity, header), id, reason);

  return getDocument(entity, id);
}

function getDocumentStore() {
  globalForDocuments.__kaguDocumentStore ??= seedDocumentStore();

  return globalForDocuments.__kaguDocumentStore;
}

function seedDocumentStore(): DocumentStore {
  const now = nowIso();
  const invoiceId = "invoice-draft-sales";
  const receiptId = "receipt-draft-collection";
  const transferId = "transfer-draft";
  const deliveryId = "delivery-draft-out";

  return {
    headers: {
      deliveryNotes: [
        {
          id: deliveryId,
          doc_no: draftDocNo(deliveryId),
          actual_doc_no: "IRS-ORNEK-001",
          direction: "OUT",
          is_return: false,
          merge_role: "NORMAL",
          account_id: "account-customer-1",
          project_id: "project-web",
          warehouse_id: "warehouse-main",
          doc_date: today(),
          status: "DRAFT",
          created_at: now,
          updated_at: now,
        },
      ],
      invoices: [
        {
          id: invoiceId,
          doc_no: draftDocNo(invoiceId),
          actual_doc_no: "FAT-ORNEK-001",
          invoice_kind: "SALES",
          invoice_type: "STANDARD",
          account_id: "account-customer-1",
          project_id: "project-web",
          warehouse_id: "warehouse-main",
          doc_date: today(),
          currency: "TRY",
          discount_bps: 0,
          status: "DRAFT",
          created_at: now,
          updated_at: now,
        },
      ],
      receipts: [
        {
          id: receiptId,
          doc_no: draftDocNo(receiptId),
          receipt_kind: "COLLECTION",
          account_id: "account-customer-1",
          project_id: "project-web",
          doc_date: today(),
          amount_minor: 250000,
          currency: "TRY",
          description: "Ornek tahsilat",
          status: "DRAFT",
          created_at: now,
          updated_at: now,
        },
      ],
      transfers: [
        {
          id: transferId,
          doc_no: draftDocNo(transferId),
          from_account_id: "account-customer-1",
          to_account_id: "account-supplier-1",
          doc_date: today(),
          amount_minor: 125000,
          currency: "TRY",
          description: "Ornek virman",
          status: "DRAFT",
          created_at: now,
          updated_at: now,
        },
      ],
    },
    lines: {
      deliveryNotes: [
        {
          id: "delivery-line-1",
          delivery_note_id: deliveryId,
          item_id: "item-raw-steel",
          description: "Sac sevk",
          quantity: 12,
          unit_price_minor: 0,
          vat_rate_bps: 2000,
        },
      ],
      invoices: [
        {
          id: "invoice-line-1",
          invoice_id: invoiceId,
          item_id: "item-erp-service",
          description: "ERP hizmet kalemi",
          quantity: 1,
          unit_price_minor: 100000,
          discount_bps: 0,
          vat_rate_bps: 2000,
          net_total_minor: 100000,
          vat_total_minor: 20000,
          gross_total_minor: 120000,
        },
      ],
      receipts: [],
      transfers: [],
    },
    revisions: [],
    ledgerEntries: [],
    stockMovements: [],
    counters: {},
    registry: [],
  };
}

function defaultsFor(entity: DocumentEntity): DataRecord {
  const common = { doc_date: today(), status: "DRAFT" };

  switch (entity) {
    case "deliveryNotes":
      return { ...common, direction: "OUT", is_return: false, merge_role: "NORMAL" };
    case "invoices":
      return {
        ...common,
        invoice_kind: "SALES",
        invoice_type: "STANDARD",
        currency: "TRY",
        discount_bps: 0,
      };
    case "receipts":
      return { ...common, receipt_kind: "COLLECTION", amount_minor: 0, currency: "TRY" };
    case "transfers":
      return { ...common, amount_minor: 0, cross_rate: 1, currency: "TRY" };
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

    normalized[camelToSnake(key)] = normalizeValue(value);
  }

  return normalized;
}

function reserveInvoiceDraftNumber(
  entity: DocumentEntity,
  id: string,
  header: DataRecord,
) {
  if (entity !== "invoices") {
    return;
  }

  const currentDocNo = String(header.doc_no ?? "");

  if (!currentDocNo || currentDocNo.startsWith("DRAFT-")) {
    header.doc_no = allocateDocumentNumber(
      documentType(entity, header),
      id,
      String(header.doc_date),
    );
  }

  if (header.invoice_type === "STAR") {
    header.actual_doc_no = header.doc_no;
  }
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
    const vatTotalMinor = Math.round(netTotalMinor * (vatRateBps / 10000));
    const grossTotalMinor = netTotalMinor + vatTotalMinor;

    return {
      id: line.id ?? randomUUID(),
      [parentKey(entity)]: documentId,
      item_id: line.itemId ?? null,
      description: typeof line.description === "string" ? line.description : null,
      quantity,
      unit_price_minor: unitPriceMinor,
      discount_bps: discountBps,
      vat_rate_bps: vatRateBps,
      line_total_minor: grossTotalMinor,
      net_total_minor: netTotalMinor,
      vat_total_minor: vatTotalMinor,
      gross_total_minor: grossTotalMinor,
      delivery_note_line_id:
        typeof line.deliveryNoteLineId === "string" ? line.deliveryNoteLineId : null,
      currency: currency(line.currency),
      source_delivery_line_ids: sourceDeliveryLineIds,
    } satisfies DataRecord;
  });
}

function applyInvoiceTotals(header: DataRecord, lines: DataRecord[]) {
  const totals = computeInvoiceTotals(lines, number(header.discount_bps));

  header.net_total_minor = totals.netTotalMinor;
  header.vat_total_minor = totals.vatTotalMinor;
  header.document_total_minor = totals.documentTotalMinor;
}

function validateApproval(entity: DocumentEntity, header: DataRecord, lines: DataRecord[]) {
  if (["deliveryNotes", "invoices", "receipts"].includes(entity) && !header.account_id) {
    throw new Error("Account is required");
  }

  if (["deliveryNotes", "invoices"].includes(entity) && !String(header.actual_doc_no ?? "").trim()) {
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

function postDocument(entity: DocumentEntity, header: DataRecord, lines: DataRecord[]) {
  const docType = documentType(entity, header);
  const docNo = String(header.doc_no);
  const docDate = String(header.doc_date);
  const createdAt = nowIso();
  const store = getDocumentStore();

  if (entity === "deliveryNotes") {
    const stockDirection = resolveDeliveryStockDirection(header);

    for (const line of lines) {
      store.stockMovements.push({
        cancelledAt: null,
        id: randomUUID(),
        isEffective: true,
        warehouseId: String(header.warehouse_id),
        itemId: String(line.item_id),
        projectId: nullableString(header.project_id),
        docType,
        docId: String(header.id),
        docNo,
        docDate,
        qtyIn: stockDirection === "IN" ? number(line.quantity) : 0,
        qtyOut: stockDirection === "OUT" ? number(line.quantity) : 0,
        replacedByDocId: null,
        createdAt,
      });
    }

    return;
  }

  if (entity === "invoices") {
    const totalMinor = number(header.document_total_minor);
    const isSales = header.invoice_kind === "SALES";

    store.ledgerEntries.push({
      cancelledAt: null,
      id: randomUUID(),
      accountId: String(header.account_id),
      relatedAccountId: null,
      isEffective: true,
      projectId: nullableString(header.project_id),
      docType,
      docId: String(header.id),
      docNo,
      docDate,
      debitMinor: isSales ? totalMinor : 0,
      creditMinor: isSales ? 0 : totalMinor,
      currency: currency(header.currency),
      description: isSales ? "Satis faturasi" : "Alis faturasi",
      createdAt,
      replacedByDocId: null,
    });

    if (header.warehouse_id) {
      for (const line of lines) {
        store.stockMovements.push({
          cancelledAt: null,
          id: randomUUID(),
          isEffective: true,
          warehouseId: String(header.warehouse_id),
          itemId: String(line.item_id),
          projectId: nullableString(header.project_id),
          docType,
          docId: String(header.id),
          docNo,
          docDate,
          qtyIn: isSales ? 0 : number(line.quantity),
          qtyOut: isSales ? number(line.quantity) : 0,
          replacedByDocId: null,
          createdAt,
        });
      }
    }

    return;
  }

  if (entity === "receipts") {
    const isPayment = header.receipt_kind === "PAYMENT";

    store.ledgerEntries.push({
      cancelledAt: null,
      id: randomUUID(),
      accountId: String(header.account_id),
      relatedAccountId: null,
      isEffective: true,
      projectId: nullableString(header.project_id),
      docType,
      docId: String(header.id),
      docNo,
      docDate,
      debitMinor: isPayment ? number(header.amount_minor) : 0,
      creditMinor: isPayment ? 0 : number(header.amount_minor),
      currency: currency(header.currency),
      description: nullableString(header.description) ?? String(header.receipt_kind),
      createdAt,
      replacedByDocId: null,
    });

    return;
  }

  store.ledgerEntries.push(
    {
      cancelledAt: null,
      id: randomUUID(),
      accountId: String(header.from_account_id),
      relatedAccountId: String(header.to_account_id),
      isEffective: true,
      projectId: null,
      docType,
      docId: String(header.id),
      docNo,
      docDate,
      debitMinor: 0,
      creditMinor: number(header.amount_minor),
      currency: currency(header.currency),
      description: nullableString(header.description) ?? "Transfer out",
      createdAt,
      replacedByDocId: null,
    },
    {
      cancelledAt: null,
      id: randomUUID(),
      accountId: String(header.to_account_id),
      relatedAccountId: String(header.from_account_id),
      isEffective: true,
      projectId: null,
      docType,
      docId: String(header.id),
      docNo,
      docDate,
      debitMinor: resolveTransferTargetAmount(header),
      creditMinor: 0,
      currency: currency(header.currency),
      description: nullableString(header.description) ?? "Transfer in",
      createdAt,
      replacedByDocId: null,
    },
  );
}

function unpostDocument(id: string) {
  const store = getDocumentStore();

  store.ledgerEntries = store.ledgerEntries.filter((row) => row.docId !== id);
  store.stockMovements = store.stockMovements.filter((row) => row.docId !== id);
}

function finalizeInvoiceDeliveryTransfer(header: DataRecord, lines: DataRecord[]) {
  const store = getDocumentStore();
  const deliveryNoteIds = resolveDeliveryNoteIdsFromInvoiceLines(lines);

  for (const deliveryNoteId of deliveryNoteIds) {
    const index = store.headers.deliveryNotes.findIndex((row) => row.id === deliveryNoteId);
    const deliveryNote = index >= 0 ? store.headers.deliveryNotes[index] : null;

    if (!deliveryNote) {
      continue;
    }

    store.headers.deliveryNotes[index] = {
      ...deliveryNote,
      invoiced_at: nowIso(),
      invoiced_by_invoice_id: String(header.id),
      is_effective: false,
      updated_at: nowIso(),
    };
    for (const movement of store.stockMovements) {
      if (movement.docId === deliveryNoteId && movement.isEffective) {
        movement.cancelledAt = nowIso();
        movement.isEffective = false;
        movement.replacedByDocId = String(header.id);
      }
    }
  }
}

function restoreDeliveryNotesFromVoidedInvoice(invoiceId: string) {
  const store = getDocumentStore();

  for (const [index, deliveryNote] of store.headers.deliveryNotes.entries()) {
    if (deliveryNote.invoiced_by_invoice_id !== invoiceId) {
      continue;
    }

    store.headers.deliveryNotes[index] = {
      ...deliveryNote,
      invoiced_at: null,
      invoiced_by_invoice_id: null,
      is_effective: true,
      updated_at: nowIso(),
    };
    for (const movement of store.stockMovements) {
      if (movement.docId === deliveryNote.id) {
        movement.cancelledAt = null;
        movement.isEffective = true;
        movement.replacedByDocId = null;
      }
    }
  }
}

function resolveDeliveryNoteIdsFromInvoiceLines(lines: DataRecord[]) {
  const deliveryLineIds = new Set(lines.flatMap((line) => getStoredSourceDeliveryLineIds(line)));
  const store = getDocumentStore();

  return Array.from(
    new Set(
      store.lines.deliveryNotes
        .filter((line) => deliveryLineIds.has(String(line.id)))
        .map((line) => String(line.delivery_note_id)),
    ),
  );
}

function assertDeliveryNoteCanVoid(header: DataRecord) {
  if (String(header.merge_role ?? "NORMAL") === "MERGED_SOURCE") {
    throw new Error("I-Irsaliyeler iptal edilemez");
  }

  if (noteHasActiveInvoiceLink(String(header.id))) {
    throw new Error("Faturaya bagli irsaliyeler iptal edilemez");
  }
}

function noteHasActiveInvoiceLink(deliveryNoteId: string) {
  const store = getDocumentStore();
  const deliveryLineIds = new Set(
    store.lines.deliveryNotes
      .filter((line) => line.delivery_note_id === deliveryNoteId)
      .map((line) => String(line.id)),
  );

  if (!deliveryLineIds.size) {
    return false;
  }

  const activeInvoiceIds = new Set(
    store.headers.invoices
      .filter((invoice) => invoice.status !== "VOID")
      .map((invoice) => String(invoice.id)),
  );

  return store.lines.invoices.some((line) => {
    if (!activeInvoiceIds.has(String(line.invoice_id))) {
      return false;
    }

    return getStoredSourceDeliveryLineIds(line).some((id) => deliveryLineIds.has(id));
  });
}

function resolveDeliveryStockDirection(header: DataRecord): "IN" | "OUT" {
  const baseIsInbound = String(header.direction) === "IN";
  const isReturn = header.is_return === true || Number(header.is_return ?? 0) === 1;

  return baseIsInbound !== isReturn ? "IN" : "OUT";
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

function hasDeliveryLink(line: DataRecord) {
  return getStoredSourceDeliveryLineIds(line).length > 0;
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

function getInvoiceNetSalesTotal(invoiceId: string) {
  return getDocumentStore().lines.invoices
    .filter((line) => line.invoice_id === invoiceId)
    .reduce(
      (total, line) => total + roundMinor(number(line.quantity) * number(line.unit_price_minor)),
      0,
    );
}

function resolveLatestPurchaseCost(
  itemId: string,
  costCurrency: Currency,
  effectiveAt: string,
) {
  return (
    findLatestPurchaseInvoiceCost(itemId, costCurrency, effectiveAt) ??
    findLatestInboundDeliveryCost(itemId, costCurrency, effectiveAt) ??
    0
  );
}

function getInventoryTotalsByCurrency() {
  const totals = emptyCurrencyTotals();
  const quantityByItem = new Map<string, number>();

  for (const movement of getDocumentStore().stockMovements) {
    quantityByItem.set(
      movement.itemId,
      (quantityByItem.get(movement.itemId) ?? 0) + movement.qtyIn - movement.qtyOut,
    );
  }

  for (const [itemId, quantity] of quantityByItem) {
    if (Math.abs(quantity) <= 0.000001) {
      continue;
    }

    const latestCost = resolveLatestInventoryCost(itemId);

    if (!latestCost) {
      continue;
    }

    totals[latestCost.currency] += roundMinor(quantity * latestCost.amountMinor);
  }

  return totals;
}

function resolveLatestInventoryCost(itemId: string) {
  const store = getDocumentStore();
  const purchaseInvoiceCosts = store.lines.invoices
    .filter((line) => line.item_id === itemId)
    .map((line) => ({
      amountMinor: number(line.unit_price_minor),
      header: store.headers.invoices.find((header) => header.id === line.invoice_id),
      line,
    }))
    .filter(
      (candidate): candidate is {
        amountMinor: number;
        header: DataRecord;
        line: DataRecord;
      } => Boolean(candidate.header),
    )
    .filter(({ header }) => header.invoice_kind === "PURCHASE")
    .filter(({ header }) => header.status === "APPROVED")
    .map(({ amountMinor, header }) => ({
      amountMinor,
      currency: currency(header.currency),
      effectiveAt: effectiveDocumentTime(header),
      createdAt: String(header.created_at),
    }));
  const inboundDeliveryCosts = store.lines.deliveryNotes
    .filter((line) => line.item_id === itemId)
    .filter((line) => number(line.unit_price_minor) > 0)
    .map((line) => ({
      amountMinor: number(line.unit_price_minor),
      header: store.headers.deliveryNotes.find(
        (header) => header.id === line.delivery_note_id,
      ),
      line,
    }))
    .filter(
      (candidate): candidate is {
        amountMinor: number;
        header: DataRecord;
        line: DataRecord;
      } => Boolean(candidate.header),
    )
    .filter(({ header }) => header.status === "APPROVED")
    .filter(({ header }) => String(header.merge_role ?? "NORMAL") !== "MERGED_SOURCE")
    .filter(({ header }) => resolveDeliveryStockDirection(header) === "IN")
    .map(({ amountMinor, header, line }) => ({
      amountMinor,
      currency: currency(line.currency),
      effectiveAt: effectiveDocumentTime(header),
      createdAt: String(header.created_at),
    }));

  return [...purchaseInvoiceCosts, ...inboundDeliveryCosts].toSorted((left, right) => {
    const byEffectiveAt = right.effectiveAt.localeCompare(left.effectiveAt);

    return byEffectiveAt || right.createdAt.localeCompare(left.createdAt);
  })[0];
}

function findLatestPurchaseInvoiceCost(
  itemId: string,
  costCurrency: Currency,
  effectiveAt: string,
) {
  const store = getDocumentStore();
  const candidates = store.lines.invoices
    .filter((line) => line.item_id === itemId)
    .map((line) => ({
      header: store.headers.invoices.find((header) => header.id === line.invoice_id),
      line,
    }))
    .filter(
      (candidate): candidate is { header: DataRecord; line: DataRecord } =>
        Boolean(candidate.header),
    )
    .filter(({ header }) => header.invoice_kind === "PURCHASE")
    .filter(({ header }) => header.status === "APPROVED")
    .filter(({ header }) => currency(header.currency) === costCurrency)
    .filter(({ header }) => effectiveDocumentTime(header) <= effectiveAt)
    .toSorted((left, right) => {
      const byEffectiveAt = effectiveDocumentTime(right.header).localeCompare(
        effectiveDocumentTime(left.header),
      );

      return byEffectiveAt || String(right.header.created_at).localeCompare(String(left.header.created_at));
    });

  return candidates[0] ? number(candidates[0].line.unit_price_minor) : null;
}

function findLatestInboundDeliveryCost(
  itemId: string,
  costCurrency: Currency,
  effectiveAt: string,
) {
  const store = getDocumentStore();
  const candidates = store.lines.deliveryNotes
    .filter((line) => line.item_id === itemId)
    .filter((line) => number(line.unit_price_minor) > 0)
    .filter((line) => currency(line.currency) === costCurrency)
    .map((line) => ({
      header: store.headers.deliveryNotes.find(
        (header) => header.id === line.delivery_note_id,
      ),
      line,
    }))
    .filter(
      (candidate): candidate is { header: DataRecord; line: DataRecord } =>
        Boolean(candidate.header),
    )
    .filter(({ header }) => header.status === "APPROVED")
    .filter(({ header }) => String(header.merge_role ?? "NORMAL") !== "MERGED_SOURCE")
    .filter(({ header }) => resolveDeliveryStockDirection(header) === "IN")
    .filter(({ header }) => effectiveDocumentTime(header) <= effectiveAt)
    .toSorted((left, right) => {
      const byEffectiveAt = effectiveDocumentTime(right.header).localeCompare(
        effectiveDocumentTime(left.header),
      );

      return byEffectiveAt || String(right.header.created_at).localeCompare(String(left.header.created_at));
    });

  return candidates[0] ? number(candidates[0].line.unit_price_minor) : null;
}

function effectiveDocumentTime(header: DataRecord) {
  return typeof header.approved_at === "string" && header.approved_at
    ? header.approved_at
    : `${String(header.doc_date)}T23:59:59.999Z`;
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

function recordRevision(docType: string, docId: string, reason: string) {
  getDocumentStore().revisions.unshift({
    id: randomUUID(),
    doc_type: docType,
    doc_id: docId,
    revision_no: getDocumentStore().revisions.filter((row) => row.doc_id === docId).length + 1,
    reason,
    edited_at: nowIso(),
  });
}

function allocateDocumentNumber(docType: string, docId: string, docDate: string) {
  const date = new Date(docDate);
  const year = date.getFullYear();
  const code = docCodes[docType as keyof typeof docCodes];

  if (!code) {
    throw new Error(`Unsupported document type: ${docType}`);
  }

  const store = getDocumentStore();
  const counterKey = `${code}-${year}`;
  const nextSeq = (store.counters[counterKey] ?? 0) + 1;

  store.counters[counterKey] = nextSeq;

  const serial = String(nextSeq).padStart(6, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(year).slice(-2);
  const docNo = `${dd}${mm}${yy}_${code}_${serial}`;

  if (store.registry.some((row) => row.doc_no === docNo)) {
    throw new Error(`Document number is already reserved: ${docNo}`);
  }

  store.registry.push({
    id: randomUUID(),
    doc_no: docNo,
    doc_type: docType,
    doc_id: docId,
    status: "ACTIVE",
    created_at: nowIso(),
  });

  return docNo;
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

function enrichHeader(header: DataRecord) {
  return { ...header };
}

function normalizeValue(value: unknown) {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }

  return String(value);
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function currency(value: unknown): Currency {
  return value === "USD" || value === "EUR" || value === "GBP" ? value : "TRY";
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function roundMinor(value: number) {
  return Math.round(value);
}

function emptyCurrencyTotals(): Record<Currency, number> {
  return { TRY: 0, USD: 0, EUR: 0, GBP: 0 };
}

function sumCurrencyTotals(totals: Record<Currency, number>) {
  return Object.values(totals).reduce((total, value) => total + value, 0);
}

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function normalize(value: unknown) {
  return String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .trim();
}

function draftDocNo(id: string) {
  return `DRAFT-${id.slice(0, 8).toUpperCase()}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}
