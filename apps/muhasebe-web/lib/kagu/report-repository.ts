import type {
  AccountStatementReport,
  AccountStatementRow,
  AppSnapshot,
  Currency,
  ItemMovementReport,
  ItemMovementRow,
  ProjectEstimatedMarginInvoiceRow,
  ProjectEstimatedMarginReport,
  ProjectInvoiceListReport,
  ProjectInvoiceRow,
  ProjectMaterialUsageReport,
  ProjectMaterialUsageRow,
  ProjectStockMovementReport,
  ProjectStockMovementRow,
  StockStatementFilters,
  StockStatementReport,
  StockStatementRow,
  WarehouseInventoryReport,
  WarehouseInventoryRow,
  WarehouseDocumentMovementReport,
  WarehouseDocumentMovementRow,
} from "./contracts";
import { getDbInvoiceMetrics } from "./document-repository";
import { currency, dateString, number, text } from "./db-shared";
import {
  deliveryNoteLabel,
  invoiceKindLabel,
  receiptKindLabel,
  voucherTypeLabel,
} from "./report-format";
import { prisma } from "@/server/db";

export async function getDbDashboardTotals(): Promise<AppSnapshot["dashboard"]> {
  const todayDate = new Date().toISOString().slice(0, 10);
  const weekStart = addDays(todayDate, -6);
  const monthStart = todayDate.slice(0, 8) + "01";
  const yearStart = todayDate.slice(0, 5) + "01-01";
  const dailySalesByCurrency = emptyCurrencyTotals();
  const weeklySalesByCurrency = emptyCurrencyTotals();
  const monthlySalesByCurrency = emptyCurrencyTotals();
  const invoiceTotalsByCurrency = emptyCurrencyInvoiceTotals();
  const inventoryTotalByCurrency = await getInventoryTotalsByCurrency();
  let todayDocumentCount = 0;

  const invoices = await prisma.invoice.findMany({
    include: { lines: true },
    where: {
      account: { code: { startsWith: "120" } },
      docDate: { gte: dateFromString(yearStart) },
      isEffective: true,
      status: "APPROVED",
    },
  });

  for (const entityCount of await Promise.all([
    prisma.deliveryNote.count({ where: { docDate: dateFromString(todayDate) } }),
    prisma.invoice.count({ where: { docDate: dateFromString(todayDate) } }),
    prisma.receipt.count({ where: { docDate: dateFromString(todayDate) } }),
    prisma.transfer.count({ where: { docDate: dateFromString(todayDate) } }),
  ])) {
    todayDocumentCount += entityCount;
  }

  for (const invoice of invoices) {
    const docDate = dateString(invoice.docDate);
    const amount = invoice.documentTotalMinor;
    const docCurrency = currency(invoice.currency);

    if (invoice.invoiceKind === "SALES" && docDate === todayDate) {
      dailySalesByCurrency[docCurrency] += amount;
    }

    if (docDate >= weekStart && docDate <= todayDate) {
      invoiceTotalsByCurrency[docCurrency].weeklyMinor += amount;
    }

    if (docDate >= monthStart && docDate <= todayDate) {
      invoiceTotalsByCurrency[docCurrency].monthlyMinor += amount;
    }

    if (docDate >= yearStart && docDate <= todayDate) {
      invoiceTotalsByCurrency[docCurrency].yearlyMinor += amount;
    }

    if (invoice.invoiceKind === "SALES" && docDate >= weekStart && docDate <= todayDate) {
      weeklySalesByCurrency[docCurrency] += amount;
    }

    if (invoice.invoiceKind === "SALES" && docDate >= monthStart && docDate <= todayDate) {
      monthlySalesByCurrency[docCurrency] += amount;
    }
  }

  return {
    dailySalesByCurrency,
    dailySalesTotalMinor: sumCurrencyTotals(dailySalesByCurrency),
    inventoryTotalByCurrency,
    inventoryTotalMinor: sumCurrencyTotals(inventoryTotalByCurrency),
    invoiceTotalsByCurrency,
    monthlySalesByCurrency,
    monthlySalesTotalMinor: sumCurrencyTotals(monthlySalesByCurrency),
    todayDocumentCount,
    weeklySalesByCurrency,
    weeklySalesTotalMinor: sumCurrencyTotals(weeklySalesByCurrency),
  };
}

export async function getDbAccountStatementReport(
  accountId: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<AccountStatementReport | null> {
  const account = await prisma.account.findUnique({ where: { id: accountId } });

  if (!account) {
    return null;
  }

  const rows: AccountStatementRow[] = [];
  let runningBalanceMinor = 0;
  let debitTotalMinor = 0;
  let creditTotalMinor = 0;

  const entries = (
    await prisma.accountLedgerEntry.findMany({
      orderBy: [{ docDate: "asc" }, { createdAt: "asc" }],
      where: {
        accountId,
        isEffective: true,
        ...(dateFrom || dateTo
          ? {
              docDate: {
                ...(dateFrom ? { gte: dateFromString(dateFrom) } : {}),
                ...(dateTo ? { lte: dateFromString(dateTo) } : {}),
              },
            }
          : {}),
      },
    })
  ).map((entry) => ({
    accountId: entry.accountId,
    cancelledAt: entry.cancelledAt?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
    creditMinor: entry.creditMinor,
    currency: currency(entry.currency),
    debitMinor: entry.debitMinor,
    description: entry.description,
    docDate: dateString(entry.docDate),
    docId: entry.docId,
    docNo: entry.docNo,
    docType: entry.docType,
    id: entry.id,
    isEffective: entry.isEffective !== false,
    projectId: entry.projectId,
    relatedAccountId: entry.relatedAccountId ?? null,
    replacedByDocId: entry.replacedByDocId ?? null,
  }));
  const docRefs = collectDocumentRefs(entries);
  const [invoices, receipts, transfers] = await Promise.all([
    prisma.invoice.findMany({ where: { id: { in: docRefs.invoiceIds } } }),
    prisma.receipt.findMany({ where: { id: { in: docRefs.receiptIds } } }),
    prisma.transfer.findMany({ where: { id: { in: docRefs.transferIds } } }),
  ]);
  const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const receiptById = new Map(receipts.map((receipt) => [receipt.id, receipt]));
  const transferById = new Map(transfers.map((transfer) => [transfer.id, transfer]));

  for (const entry of entries) {
    const invoice = invoiceById.get(entry.docId);
    const receipt = receiptById.get(entry.docId);
    const transfer = transferById.get(entry.docId);
    const displayDocNo = invoice
      ? preferredDocNo(invoice.actualDocNo, invoice.docNo)
      : receipt
        ? receipt.docNo
        : transfer
          ? transfer.docNo
          : entry.docNo;
    const rowVoucherTypeLabel = invoice
      ? invoiceKindLabel(invoice.invoiceKind)
      : receipt
        ? receiptKindLabel(receipt.receiptKind)
        : transfer
          ? "Virman"
          : voucherTypeLabel(entry.docType);
    const sourceDescription =
      invoice?.description ??
      receipt?.description ??
      transfer?.description ??
      (transfer ? "Virman" : entry.description);

    debitTotalMinor += entry.debitMinor;
    creditTotalMinor += entry.creditMinor;
    runningBalanceMinor += entry.debitMinor - entry.creditMinor;
    rows.push({
      ...entry,
      displayDocNo,
      runningBalanceMinor,
      sourceDescription,
      voucherTypeLabel: rowVoucherTypeLabel,
    });
  }

  return {
    account: {
      account_kind: account.accountKind,
      code: account.code,
      currency: account.currency,
      id: account.id,
      is_active: account.isActive,
      name: account.name,
    },
    closingBalanceMinor: runningBalanceMinor,
    creditTotalMinor,
    debitTotalMinor,
    rows,
  };
}

export async function getDbWarehouseInventoryReport(
  warehouseId: string,
): Promise<WarehouseInventoryReport | null> {
  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });

  if (!warehouse) {
    return null;
  }

  const movementSums = await prisma.stockMovement.groupBy({
    by: ["itemId"],
    where: { isEffective: true, warehouseId },
    _sum: { qtyIn: true, qtyOut: true },
  });
  const quantityByItem = new Map(
    movementSums.map((movement) => [
      movement.itemId,
      number(movement._sum.qtyIn) - number(movement._sum.qtyOut),
    ]),
  );

  const rows: WarehouseInventoryRow[] = [];

  const items = await prisma.item.findMany({
    include: { unit: true },
    where: { id: { in: [...quantityByItem.keys()] } },
  });
  const itemById = new Map(items.map((item) => [item.id, item]));

  for (const [itemId, quantity] of quantityByItem.entries()) {
    if (Math.abs(quantity) <= 0.000001) {
      continue;
    }

    const item = itemById.get(itemId);

    rows.push({
      itemCode: text(item?.code),
      itemId,
      itemName: text(item?.name),
      quantity,
      unitLabel: item?.unit.name ?? null,
    });
  }

  return {
    rows: rows.toSorted((left, right) =>
      left.itemCode.localeCompare(right.itemCode, "tr-TR"),
    ),
    warehouse: {
      code: warehouse.code,
      id: warehouse.id,
      is_active: warehouse.isActive,
      name: warehouse.name,
    },
  };
}

export async function getDbWarehouseDocumentMovementReport(
  warehouseId: string,
): Promise<WarehouseDocumentMovementReport | null> {
  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });

  if (!warehouse) {
    return null;
  }

  const movements = await prisma.stockMovement.findMany({
    include: { item: true, project: true },
    orderBy: [{ docDate: "desc" }, { createdAt: "desc" }],
    where: { isEffective: true, warehouseId },
  });
  const docKeys = movements.map((movement) => ({ docId: movement.docId, docType: movement.docType }));
  const deliveryIds = docKeys
    .filter((key) => key.docType.startsWith("DELIVERY_NOTE"))
    .map((key) => key.docId);
  const invoiceIds = docKeys
    .filter((key) => key.docType.includes("INVOICE"))
    .map((key) => key.docId);
  const [deliveryNotes, invoices, mergeSources] = await Promise.all([
    prisma.deliveryNote.findMany({
      include: { account: true },
      where: { id: { in: deliveryIds } },
    }),
    prisma.invoice.findMany({
      include: { account: true },
      where: { id: { in: invoiceIds } },
    }),
    prisma.deliveryNoteMergeSource.findMany({
      include: { sourceDeliveryNote: true },
      where: { mergedDeliveryNoteId: { in: deliveryIds } },
    }),
  ]);
  const deliveryById = new Map(deliveryNotes.map((note) => [note.id, note]));
  const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const sourceNosByMergedId = new Map<string, string[]>();

  for (const source of mergeSources) {
    const sourceNos = sourceNosByMergedId.get(source.mergedDeliveryNoteId) ?? [];

    sourceNos.push(source.sourceDeliveryNote.docNo);
    sourceNosByMergedId.set(source.mergedDeliveryNoteId, sourceNos);
  }

  const rows: WarehouseDocumentMovementRow[] = movements.map((movement) => {
    const delivery = deliveryById.get(movement.docId);
    const invoice = invoiceById.get(movement.docId);

    return {
      accountLabel: delivery
        ? delivery.account.name
        : invoice
          ? invoice.account.name
          : null,
      cancelledAt: movement.cancelledAt?.toISOString() ?? null,
      createdAt: movement.createdAt.toISOString(),
      docDate: dateString(movement.docDate),
      docId: movement.docId,
      docNo: movement.docNo,
      docType: movement.docType,
      id: movement.id,
      isEffective: movement.isEffective !== false,
      itemCode: movement.item.code,
      itemId: movement.itemId,
      itemName: movement.item.name,
      projectId: movement.projectId,
      projectLabel: movement.project ? movement.project.name : null,
      qtyIn: number(movement.qtyIn),
      qtyOut: number(movement.qtyOut),
      replacedByDocId: movement.replacedByDocId ?? null,
      sourceDeliveryNoteNos: sourceNosByMergedId.get(movement.docId)?.join(", ") ?? null,
      sourceRole: delivery
        ? delivery.invoicedByInvoiceId
          ? "F-Irsaliye"
          : delivery.mergeRole === "MERGED_RESULT"
            ? "B-Irsaliye"
            : delivery.mergeRole === "MERGED_SOURCE"
              ? "K-Irsaliye"
              : "Normal"
        : invoice
          ? invoice.invoiceKind === "SALES"
            ? "Satış Faturası"
            : "Alış Faturası"
          : movement.docType,
      status: delivery?.status ?? invoice?.status ?? null,
      warehouseId: movement.warehouseId,
    };
  });

  return {
    rows,
    warehouse: {
      code: warehouse.code,
      id: warehouse.id,
      is_active: warehouse.isActive,
      name: warehouse.name,
    },
  };
}

export async function getDbItemMovementReport(
  itemId: string,
): Promise<ItemMovementReport | null> {
  const item = await prisma.item.findUnique({ where: { id: itemId } });

  if (!item) {
    return null;
  }

  const rows: ItemMovementRow[] = (
    await prisma.stockMovement.findMany({
      include: { warehouse: true },
      orderBy: [{ docDate: "desc" }, { createdAt: "desc" }],
      where: { isEffective: true, itemId },
    })
  ).map((movement) => ({
    cancelledAt: movement.cancelledAt?.toISOString() ?? null,
    createdAt: movement.createdAt.toISOString(),
    docDate: dateString(movement.docDate),
    docId: movement.docId,
    docNo: movement.docNo,
    docType: movement.docType,
    id: movement.id,
    isEffective: movement.isEffective !== false,
    itemId: movement.itemId,
    projectId: movement.projectId,
    qtyIn: number(movement.qtyIn),
    qtyOut: number(movement.qtyOut),
    replacedByDocId: movement.replacedByDocId ?? null,
    warehouseCode: text(movement.warehouse.code),
    warehouseId: movement.warehouseId,
    warehouseName: text(movement.warehouse.name),
  }));

  return {
    item: {
      class_id: item.classId,
      code: item.code,
      default_vat_rate_id: item.defaultVatRateId,
      id: item.id,
      is_active: item.isActive,
      name: item.name,
      unit_id: item.unitId,
    },
    rows,
  };
}

export async function getDbStockStatementReport(
  options: StockStatementFilters = {},
): Promise<StockStatementReport> {
  const [account, project, warehouse, item] = await Promise.all([
    options.accountId ? prisma.account.findUnique({ where: { id: options.accountId } }) : null,
    options.projectId
      ? prisma.project.findUnique({ include: { account: true }, where: { id: options.projectId } })
      : null,
    options.warehouseId
      ? prisma.warehouse.findUnique({ where: { id: options.warehouseId } })
      : null,
    options.itemId
      ? prisma.item.findUnique({ include: { unit: true }, where: { id: options.itemId } })
      : null,
  ]);

  const movements = await prisma.stockMovement.findMany({
    include: {
      item: { include: { unit: true } },
      project: true,
      warehouse: true,
    },
    orderBy: [{ docDate: "asc" }, { createdAt: "asc" }],
    where: {
      isEffective: true,
      ...(options.itemId ? { itemId: options.itemId } : {}),
      ...(options.projectId ? { projectId: options.projectId } : {}),
      ...(options.warehouseId ? { warehouseId: options.warehouseId } : {}),
      ...dateRangeWhere(options.dateFrom, options.dateTo),
    },
  });
  const docRefs = collectDocumentRefs(movements);
  const [deliveryNotes, invoices] = await Promise.all([
    prisma.deliveryNote.findMany({
      include: { account: true },
      where: { id: { in: docRefs.deliveryIds } },
    }),
    prisma.invoice.findMany({
      include: { account: true },
      where: { id: { in: docRefs.invoiceIds } },
    }),
  ]);
  const deliveryById = new Map(deliveryNotes.map((note) => [note.id, note]));
  const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const runningByItem = new Map<string, number>();
  const rows: StockStatementRow[] = [];

  for (const movement of movements) {
    const delivery = deliveryById.get(movement.docId);
    const invoice = invoiceById.get(movement.docId);
    const sourceAccount = delivery?.account ?? invoice?.account ?? null;

    if (options.accountId && sourceAccount?.id !== options.accountId) {
      continue;
    }

    rows.push({
      accountLabel: sourceAccount ? sourceAccount.name : null,
      cancelledAt: movement.cancelledAt?.toISOString() ?? null,
      createdAt: movement.createdAt.toISOString(),
      description: delivery?.description ?? invoice?.description ?? null,
      displayDocNo: delivery
        ? preferredDocNo(delivery.actualDocNo, delivery.docNo)
        : invoice
          ? preferredDocNo(invoice.actualDocNo, invoice.docNo)
          : movement.docNo,
      docDate: dateString(movement.docDate),
      docId: movement.docId,
      docNo: movement.docNo,
      docType: movement.docType,
      id: movement.id,
      isEffective: movement.isEffective !== false,
      itemCode: movement.item.code,
      itemId: movement.itemId,
      itemName: movement.item.name,
      projectId: movement.projectId,
      projectLabel: movement.project ? movement.project.name : null,
      qtyIn: number(movement.qtyIn),
      qtyOut: number(movement.qtyOut),
      replacedByDocId: movement.replacedByDocId ?? null,
      runningBalance: 0,
      unitLabel: movement.item.unit?.name ?? null,
      voucherTypeLabel: delivery
        ? deliveryNoteLabel(delivery)
        : invoice
          ? invoiceKindLabel(invoice.invoiceKind)
          : voucherTypeLabel(movement.docType),
      warehouseId: movement.warehouseId,
      warehouseLabel: `${movement.warehouse.code} - ${movement.warehouse.name}`,
    });
  }

  rows.sort((left, right) => {
    const byItem = left.itemName.localeCompare(right.itemName, "tr-TR");

    return (
      byItem ||
      left.docDate.localeCompare(right.docDate) ||
      left.createdAt.localeCompare(right.createdAt)
    );
  });
  runningByItem.clear();

  for (const row of rows) {
    const running = (runningByItem.get(row.itemId) ?? 0) + row.qtyIn - row.qtyOut;

    runningByItem.set(row.itemId, running);
    row.runningBalance = running;
  }

  return {
    account: account
      ? { code: account.code, id: account.id, name: account.name }
      : null,
    dateFrom: options.dateFrom,
    dateTo: options.dateTo,
    item: item
      ? { code: item.code, id: item.id, name: item.name, unit_label: item.unit?.name ?? null }
      : null,
    project: project ? projectReportRecord(project) : null,
    rows,
    summary: {
      totalQtyIn: rows.reduce((total, row) => total + row.qtyIn, 0),
      totalQtyOut: rows.reduce((total, row) => total + row.qtyOut, 0),
    },
    warehouse: warehouse
      ? { code: warehouse.code, id: warehouse.id, name: warehouse.name }
      : null,
  };
}

export { getDbInvoiceMetrics };

export async function getDbProjectStockMovementReport(
  projectId: string,
  options: { dateFrom?: string; dateTo?: string; warehouseId?: string } = {},
): Promise<ProjectStockMovementReport | null> {
  const project = await prisma.project.findUnique({
    include: { account: true },
    where: { id: projectId },
  });

  if (!project) {
    return null;
  }

  const movements = await prisma.stockMovement.findMany({
    include: { item: true, warehouse: true },
    orderBy: [{ docDate: "desc" }, { createdAt: "desc" }],
    where: {
      isEffective: true,
      projectId,
      ...(options.warehouseId ? { warehouseId: options.warehouseId } : {}),
      ...dateRangeWhere(options.dateFrom, options.dateTo),
    },
  });
  const docRefs = collectDocumentRefs(movements);
  const [deliveryNotes, invoices] = await Promise.all([
    prisma.deliveryNote.findMany({
      where: { id: { in: docRefs.deliveryIds } },
    }),
    prisma.invoice.findMany({
      where: { id: { in: docRefs.invoiceIds } },
    }),
  ]);
  const deliveryById = new Map(deliveryNotes.map((note) => [note.id, note]));
  const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const rows: ProjectStockMovementRow[] = movements.map((movement) => {
    const delivery = deliveryById.get(movement.docId);
    const invoice = invoiceById.get(movement.docId);

    return {
      cancelledAt: movement.cancelledAt?.toISOString() ?? null,
      createdAt: movement.createdAt.toISOString(),
      description: delivery?.description ?? invoice?.description ?? null,
      displayDocNo: delivery
        ? preferredDocNo(delivery.actualDocNo, delivery.docNo)
        : invoice
          ? preferredDocNo(invoice.actualDocNo, invoice.docNo)
          : movement.docNo,
      docDate: dateString(movement.docDate),
      docId: movement.docId,
      docNo: movement.docNo,
      docType: movement.docType,
      id: movement.id,
      isEffective: movement.isEffective !== false,
      itemCode: text(movement.item.code),
      itemId: movement.itemId,
      itemName: text(movement.item.name),
      projectId: movement.projectId,
      qtyIn: number(movement.qtyIn),
      qtyOut: number(movement.qtyOut),
      replacedByDocId: movement.replacedByDocId ?? null,
      voucherTypeLabel: delivery
        ? deliveryNoteLabel(delivery)
        : invoice
          ? invoiceKindLabel(invoice.invoiceKind)
          : voucherTypeLabel(movement.docType),
      warehouseCode: text(movement.warehouse.code),
      warehouseId: movement.warehouseId,
      warehouseName: text(movement.warehouse.name),
    };
  }).toSorted((left, right) => {
    const byItem = left.itemName.localeCompare(right.itemName, "tr-TR");

    return (
      byItem ||
      left.docDate.localeCompare(right.docDate) ||
      left.createdAt.localeCompare(right.createdAt)
    );
  });

  return {
    project: projectReportRecord(project),
    rows,
    summary: {
      distinctItemCount: new Set(rows.map((row) => row.itemId)).size,
      distinctWarehouseCount: new Set(rows.map((row) => row.warehouseId)).size,
      movementCount: rows.length,
      totalQtyIn: rows.reduce((total, row) => total + row.qtyIn, 0),
      totalQtyOut: rows.reduce((total, row) => total + row.qtyOut, 0),
    },
  };
}

export async function getDbProjectInvoiceListReport(
  projectId: string,
  options: { dateFrom?: string; dateTo?: string; invoiceKind?: "SALES" | "PURCHASE" } = {},
): Promise<ProjectInvoiceListReport | null> {
  const project = await prisma.project.findUnique({
    include: { account: true },
    where: { id: projectId },
  });

  if (!project) {
    return null;
  }

  const rows: ProjectInvoiceRow[] = (
    await prisma.invoice.findMany({
      include: { account: true, warehouse: true },
      orderBy: [{ docDate: "desc" }, { createdAt: "desc" }],
      where: {
        invoiceKind: options.invoiceKind,
        isEffective: true,
        projectId,
        status: "APPROVED",
        ...dateRangeWhere(options.dateFrom, options.dateTo),
      },
    })
  ).map((invoice) => ({
    accountId: invoice.accountId,
    accountLabel: invoice.account.name,
    currency: currency(invoice.currency),
    displayDocNo: preferredDocNo(invoice.actualDocNo, invoice.docNo),
    docDate: dateString(invoice.docDate),
    docNo: invoice.docNo,
    grossTotalMinor: invoice.documentTotalMinor,
    id: invoice.id,
    invoiceKind: invoice.invoiceKind,
    isEffective: invoice.isEffective !== false,
    netTotalMinor: invoice.netTotalMinor,
    status: invoice.status,
    vatTotalMinor: invoice.vatTotalMinor,
    warehouseId: invoice.warehouseId ?? null,
    warehouseLabel: invoice.warehouse
      ? `${invoice.warehouse.code} - ${invoice.warehouse.name}`
      : null,
  }));

  const netTotalsByCurrency = emptyCurrencyTotals();
  const grossTotalsByCurrency = emptyCurrencyTotals();

  for (const row of rows) {
    netTotalsByCurrency[row.currency] += row.netTotalMinor;
    grossTotalsByCurrency[row.currency] += row.grossTotalMinor;
  }

  return {
    project: projectReportRecord(project),
    rows,
    summary: {
      grossTotalsByCurrency,
      invoiceCount: rows.length,
      netTotalsByCurrency,
      purchaseCount: rows.filter((row) => row.invoiceKind === "PURCHASE").length,
      salesCount: rows.filter((row) => row.invoiceKind === "SALES").length,
    },
  };
}

export async function getDbProjectMaterialUsageReport(
  projectId: string,
  options: { dateFrom?: string; dateTo?: string; warehouseId?: string } = {},
): Promise<ProjectMaterialUsageReport | null> {
  const project = await prisma.project.findUnique({
    include: { account: true },
    where: { id: projectId },
  });

  if (!project) {
    return null;
  }

  const movements = await prisma.stockMovement.findMany({
    include: { item: { include: { unit: true } } },
    where: {
      isEffective: true,
      projectId,
      ...(options.warehouseId ? { warehouseId: options.warehouseId } : {}),
      ...dateRangeWhere(options.dateFrom, options.dateTo),
    },
  });
  const grouped = new Map<string, ProjectMaterialUsageRow>();

  for (const movement of movements) {
    const current =
      grouped.get(movement.itemId) ??
      {
        itemCode: text(movement.item.code),
        itemId: movement.itemId,
        itemName: text(movement.item.name),
        movementCount: 0,
        netUsage: 0,
        qtyIn: 0,
        qtyOut: 0,
        unitLabel: movement.item.unit?.name ?? null,
      };

    current.movementCount += 1;
    current.qtyIn += number(movement.qtyIn);
    current.qtyOut += number(movement.qtyOut);
    current.netUsage = current.qtyOut - current.qtyIn;
    grouped.set(movement.itemId, current);
  }

  const rows = [...grouped.values()].toSorted((left, right) =>
    left.itemCode.localeCompare(right.itemCode, "tr-TR"),
  );

  return {
    project: projectReportRecord(project),
    rows,
    summary: {
      distinctItemCount: rows.length,
      totalMovementCount: rows.reduce((total, row) => total + row.movementCount, 0),
    },
  };
}

export async function getDbProjectEstimatedMarginReport(
  projectId: string,
  options: { dateFrom?: string; dateTo?: string } = {},
): Promise<ProjectEstimatedMarginReport | null> {
  const project = await prisma.project.findUnique({
    include: { account: true },
    where: { id: projectId },
  });

  if (!project) {
    return null;
  }

  const invoices = await prisma.invoice.findMany({
    orderBy: [{ docDate: "desc" }, { createdAt: "desc" }],
    where: {
      invoiceKind: "SALES",
      isEffective: true,
      projectId,
      status: "APPROVED",
      ...dateRangeWhere(options.dateFrom, options.dateTo),
    },
  });
  const rows: ProjectEstimatedMarginInvoiceRow[] = [];
  let salesNetTotalMinor = 0;
  let estimatedCostTotalMinor = 0;
  let estimatedGrossProfitMinor = 0;
  let reportCurrency: Currency | null = null;

  for (const invoice of invoices) {
    const metrics = await getDbInvoiceMetrics(invoice.id);

    if (!metrics) {
      continue;
    }

    const rowCurrency = currency(invoice.currency);

    reportCurrency ??= rowCurrency;
    salesNetTotalMinor += metrics.invoiceNetTotalMinor;
    estimatedCostTotalMinor += metrics.costTotalMinor;
    estimatedGrossProfitMinor += metrics.profitMinor;
    rows.push({
      costTotalMinor: metrics.costTotalMinor,
      currency: rowCurrency,
      displayDocNo: preferredDocNo(invoice.actualDocNo, invoice.docNo),
      docDate: dateString(invoice.docDate),
      docNo: invoice.docNo,
      id: invoice.id,
      invoiceNetTotalMinor: metrics.invoiceNetTotalMinor,
      marginPercent: metrics.marginPercent,
      profitMinor: metrics.profitMinor,
    });
  }

  return {
    project: projectReportRecord(project),
    rows,
    summary: {
      currency: reportCurrency,
      estimatedCostTotalMinor,
      estimatedGrossProfitMinor,
      estimatedMarginPercent:
        salesNetTotalMinor === 0
          ? null
          : Number(((estimatedGrossProfitMinor / salesNetTotalMinor) * 100).toFixed(2)),
      invoiceCount: rows.length,
      salesNetTotalMinor,
    },
  };
}

async function getInventoryTotalsByCurrency() {
  const totals = emptyCurrencyTotals();
  const movementSums = await prisma.stockMovement.groupBy({
    by: ["itemId"],
    where: { isEffective: true },
    _sum: { qtyIn: true, qtyOut: true },
  });

  for (const movement of movementSums) {
    const itemId = movement.itemId;
    const quantity = number(movement._sum.qtyIn) - number(movement._sum.qtyOut);

    if (Math.abs(quantity) <= 0.000001) {
      continue;
    }

    const latestCost = await resolveLatestInventoryCost(itemId);

    if (!latestCost) {
      continue;
    }

    totals[latestCost.currency] += Math.round(quantity * latestCost.amountMinor);
  }

  return totals;
}

async function resolveLatestInventoryCost(itemId: string) {
  const purchaseInvoices = await prisma.invoice.findMany({
    where: {
      isEffective: true,
      invoiceKind: "PURCHASE",
      status: "APPROVED",
    },
  });

  const purchaseInvoiceById = new Map(
    purchaseInvoices.map((invoice) => [invoice.id, invoice]),
  );
  const purchaseLines = purchaseInvoices.length
    ? await prisma.invoiceLine.findMany({
        where: {
          invoiceId: { in: purchaseInvoices.map((invoice) => invoice.id) },
          itemId,
        },
      })
    : [];

  const deliveryNotes = await prisma.deliveryNote.findMany({
    where: { isEffective: true, status: "APPROVED" },
  });
  const deliveryNoteById = new Map(deliveryNotes.map((note) => [note.id, note]));
  const deliveryLines = deliveryNotes.length
    ? await prisma.deliveryNoteLine.findMany({
        where: {
          deliveryNoteId: { in: deliveryNotes.map((note) => note.id) },
          itemId,
          unitPriceMinor: { gt: 0 },
        },
      })
    : [];
  const purchaseCandidates = purchaseLines.flatMap((line) => {
    const invoice = purchaseInvoiceById.get(line.invoiceId);

    return invoice
      ? [
          {
            amountMinor: line.unitPriceMinor,
            createdAt: invoice.createdAt.toISOString(),
            currency: currency(invoice.currency),
            effectiveAt: effectiveDocumentTime(invoice.docDate, invoice.approvedAt),
          },
        ]
      : [];
  });
  const deliveryCandidates = deliveryLines.flatMap((line) => {
    const deliveryNote = deliveryNoteById.get(line.deliveryNoteId);

    return deliveryNote &&
      deliveryNote.mergeRole !== "MERGED_SOURCE" &&
      deliveryStockDirection(deliveryNote.direction, deliveryNote.isReturn) === "IN"
      ? [
          {
            amountMinor: line.unitPriceMinor,
            createdAt: deliveryNote.createdAt.toISOString(),
            currency: currency(line.currency),
            effectiveAt: effectiveDocumentTime(
              deliveryNote.docDate,
              deliveryNote.approvedAt,
            ),
          },
        ]
      : [];
  });

  return [...purchaseCandidates, ...deliveryCandidates].toSorted((left, right) => {
    const byEffectiveAt = right.effectiveAt.localeCompare(left.effectiveAt);

    return byEffectiveAt || right.createdAt.localeCompare(left.createdAt);
  })[0] ?? null;
}

function effectiveDocumentTime(docDate: Date, approvedAt: Date | null) {
  return approvedAt ? approvedAt.toISOString() : `${dateString(docDate)}T23:59:59.999Z`;
}

function deliveryStockDirection(direction: string, isReturn: boolean): "IN" | "OUT" {
  const baseIsInbound = direction === "IN";

  return baseIsInbound !== isReturn ? "IN" : "OUT";
}

function emptyCurrencyTotals(): Record<Currency, number> {
  return { EUR: 0, GBP: 0, TRY: 0, USD: 0 };
}

function emptyCurrencyInvoiceTotals(): AppSnapshot["dashboard"]["invoiceTotalsByCurrency"] {
  return {
    EUR: { monthlyMinor: 0, weeklyMinor: 0, yearlyMinor: 0 },
    GBP: { monthlyMinor: 0, weeklyMinor: 0, yearlyMinor: 0 },
    TRY: { monthlyMinor: 0, weeklyMinor: 0, yearlyMinor: 0 },
    USD: { monthlyMinor: 0, weeklyMinor: 0, yearlyMinor: 0 },
  };
}

function sumCurrencyTotals(totals: Record<Currency, number>) {
  return Object.values(totals).reduce((total, value) => total + value, 0);
}

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function dateFromString(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateRangeWhere(dateFrom?: string, dateTo?: string) {
  return dateFrom || dateTo
    ? {
        docDate: {
          ...(dateFrom ? { gte: dateFromString(dateFrom) } : {}),
          ...(dateTo ? { lte: dateFromString(dateTo) } : {}),
        },
      }
    : {};
}

function collectDocumentRefs(rows: Array<{ docId: string; docType: string }>) {
  const deliveryIds = new Set<string>();
  const invoiceIds = new Set<string>();
  const receiptIds = new Set<string>();
  const transferIds = new Set<string>();

  for (const row of rows) {
    if (row.docType.startsWith("DELIVERY_NOTE")) {
      deliveryIds.add(row.docId);
    } else if (row.docType.includes("INVOICE")) {
      invoiceIds.add(row.docId);
    } else if (row.docType.startsWith("RECEIPT")) {
      receiptIds.add(row.docId);
    } else if (row.docType === "TRANSFER") {
      transferIds.add(row.docId);
    }
  }

  return {
    deliveryIds: [...deliveryIds],
    invoiceIds: [...invoiceIds],
    receiptIds: [...receiptIds],
    transferIds: [...transferIds],
  };
}

function preferredDocNo(actualDocNo: string | null | undefined, docNo: string) {
  const actual = actualDocNo?.trim();

  return actual || docNo;
}

function projectReportRecord(project: {
  account: { code: string; name: string };
  accountId: string;
  code: string;
  id: string;
  isActive: boolean;
  name: string;
}) {
  return {
    account_id: project.accountId,
    account_label: project.account.name,
    code: project.code,
    id: project.id,
    is_active: project.isActive,
    name: project.name,
  };
}
