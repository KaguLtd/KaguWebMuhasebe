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
import {
  getAllDbLedgerEntries,
  getAllDbStockMovements,
  getDbInvoiceMetrics,
} from "./document-repository";
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
    where: { status: "APPROVED" },
  });
  const invoiceIds = invoices.map((invoice) => invoice.id);
  const invoiceLines = invoiceIds.length
    ? await prisma.invoiceLine.findMany({
        where: { invoiceId: { in: invoiceIds } },
      })
    : [];
  const invoiceLinesByInvoiceId = groupBy(invoiceLines, (line) => line.invoiceId);

  for (const entityCount of await Promise.all([
    prisma.deliveryNote.count({ where: { docDate: dateFromString(todayDate) } }),
    prisma.invoice.count({ where: { docDate: dateFromString(todayDate) } }),
    prisma.receipt.count({ where: { docDate: dateFromString(todayDate) } }),
    prisma.transfer.count({ where: { docDate: dateFromString(todayDate) } }),
  ])) {
    todayDocumentCount += entityCount;
  }

  for (const invoice of invoices) {
    if (invoice.invoiceKind !== "SALES") {
      continue;
    }

    const docDate = dateString(invoice.docDate);
    const amount = (invoiceLinesByInvoiceId.get(invoice.id) ?? []).reduce(
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

  const entries = (await getAllDbLedgerEntries())
    .filter((entry) => entry.accountId === accountId)
    .filter((entry) => !dateFrom || entry.docDate >= dateFrom)
    .filter((entry) => !dateTo || entry.docDate <= dateTo)
    .toSorted((left, right) => {
      const byDate = left.docDate.localeCompare(right.docDate);

      return byDate || left.createdAt.localeCompare(right.createdAt);
    });

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

  const quantityByItem = new Map<string, number>();

  for (const movement of await getAllDbStockMovements()) {
    if (movement.warehouseId !== warehouseId) {
      continue;
    }

    quantityByItem.set(
      movement.itemId,
      (quantityByItem.get(movement.itemId) ?? 0) + movement.qtyIn - movement.qtyOut,
    );
  }

  const rows: WarehouseInventoryRow[] = [];

  for (const [itemId, quantity] of quantityByItem.entries()) {
    if (Math.abs(quantity) <= 0.000001) {
      continue;
    }

    const item = await prisma.item.findUnique({ where: { id: itemId } });
    const unit = item
      ? await prisma.unit.findUnique({ where: { id: item.unitId } })
      : null;

    rows.push({
      itemCode: text(item?.code),
      itemId,
      itemName: text(item?.name),
      quantity,
      unitLabel: unit?.name ?? null,
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

  const rows: ItemMovementRow[] = [];

  for (const movement of (await getAllDbStockMovements()).filter(
    (entry) => entry.itemId === itemId,
  )) {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: movement.warehouseId },
    });

    rows.push({
      ...movement,
      warehouseCode: text(warehouse?.code),
      warehouseName: text(warehouse?.name),
    });
  }

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
    rows: rows.toSorted((left, right) => {
      const byDate = right.docDate.localeCompare(left.docDate);

      return byDate || right.createdAt.localeCompare(left.createdAt);
    }),
  };
}

export { getDbInvoiceMetrics };

async function getInventoryTotalsByCurrency() {
  const totals = emptyCurrencyTotals();
  const quantityByItem = new Map<string, number>();

  for (const movement of await getAllDbStockMovements()) {
    quantityByItem.set(
      movement.itemId,
      (quantityByItem.get(movement.itemId) ?? 0) + movement.qtyIn - movement.qtyOut,
    );
  }

  for (const [itemId, quantity] of quantityByItem) {
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

function groupBy<T, K>(items: T[], selectKey: (item: T) => K) {
  const grouped = new Map<K, T[]>();

  for (const item of items) {
    const key = selectKey(item);
    const group = grouped.get(key);

    if (group) {
      group.push(item);
    } else {
      grouped.set(key, [item]);
    }
  }

  return grouped;
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
