import type {
  AccountStatementReport,
  AccountStatementRow,
  AppSnapshot,
  Currency,
  ItemMovementReport,
  ItemMovementRow,
  WarehouseInventoryReport,
  WarehouseInventoryRow,
} from "./contracts";
import { getDbInvoiceMetrics } from "./document-repository";
import { currency, dateString, number, text } from "./db-shared";
import { prisma } from "@/server/db";

export async function getDbDashboardTotals(): Promise<AppSnapshot["dashboard"]> {
  const todayDate = new Date().toISOString().slice(0, 10);
  const weekStart = addDays(todayDate, -6);
  const monthStart = todayDate.slice(0, 8) + "01";
  const dailySalesByCurrency = emptyCurrencyTotals();
  const weeklySalesByCurrency = emptyCurrencyTotals();
  const monthlySalesByCurrency = emptyCurrencyTotals();
  const inventoryTotalByCurrency = await getInventoryTotalsByCurrency();
  let todayDocumentCount = 0;

  const invoices = await prisma.invoice.findMany({
    include: { lines: true },
    where: {
      docDate: { gte: dateFromString(monthStart) },
      invoiceKind: "SALES",
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
    const amount = invoice.lines.reduce(
      (total, line) => total + Math.round(number(line.quantity) * line.unitPriceMinor),
      0,
    );
    const docCurrency = currency(invoice.currency);

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

  return {
    dailySalesByCurrency,
    dailySalesTotalMinor: sumCurrencyTotals(dailySalesByCurrency),
    inventoryTotalByCurrency,
    inventoryTotalMinor: sumCurrencyTotals(inventoryTotalByCurrency),
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
    projectId: entry.projectId,
  }));

  for (const entry of entries) {
    debitTotalMinor += entry.debitMinor;
    creditTotalMinor += entry.creditMinor;
    runningBalanceMinor += entry.debitMinor - entry.creditMinor;
    rows.push({ ...entry, runningBalanceMinor });
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
    where: { warehouseId },
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
      where: { itemId },
    })
  ).map((movement) => ({
    createdAt: movement.createdAt.toISOString(),
    docDate: dateString(movement.docDate),
    docId: movement.docId,
    docNo: movement.docNo,
    docType: movement.docType,
    id: movement.id,
    itemId: movement.itemId,
    projectId: movement.projectId,
    qtyIn: number(movement.qtyIn),
    qtyOut: number(movement.qtyOut),
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

export { getDbInvoiceMetrics };

async function getInventoryTotalsByCurrency() {
  const totals = emptyCurrencyTotals();
  const movementSums = await prisma.stockMovement.groupBy({
    by: ["itemId"],
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
    where: { status: "APPROVED" },
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
