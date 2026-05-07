import type {
  AccountStatementReport,
  AccountStatementRow,
  ItemMovementReport,
  ItemMovementRow,
  WarehouseInventoryReport,
  WarehouseInventoryRow,
} from "./contracts";
import { getAllLedgerEntries, getAllStockMovements } from "./document-engine";
import { getMaster } from "./store";

export function getAccountStatementReport(
  accountId: string,
  dateFrom?: string,
  dateTo?: string,
): AccountStatementReport | null {
  const account = getMaster("accounts", accountId);

  if (!account) {
    return null;
  }

  const rows: AccountStatementRow[] = [];
  let runningBalanceMinor = 0;
  let debitTotalMinor = 0;
  let creditTotalMinor = 0;

  const entries = getAllLedgerEntries()
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
    account,
    closingBalanceMinor: runningBalanceMinor,
    creditTotalMinor,
    debitTotalMinor,
    rows,
  };
}

export function getWarehouseInventoryReport(
  warehouseId: string,
): WarehouseInventoryReport | null {
  const warehouse = getMaster("warehouses", warehouseId);

  if (!warehouse) {
    return null;
  }

  const quantityByItem = new Map<string, number>();

  for (const movement of getAllStockMovements()) {
    if (movement.warehouseId !== warehouseId) {
      continue;
    }

    quantityByItem.set(
      movement.itemId,
      (quantityByItem.get(movement.itemId) ?? 0) + movement.qtyIn - movement.qtyOut,
    );
  }

  const rows: WarehouseInventoryRow[] = Array.from(quantityByItem.entries())
    .filter(([, quantity]) => Math.abs(quantity) > 0.000001)
    .map(([itemId, quantity]) => {
      const item = getMaster("items", itemId);

      return {
        itemCode: text(item?.code),
        itemId,
        itemName: text(item?.name),
        quantity,
        unitLabel: nullableText(item?.unit_label),
      };
    })
    .toSorted((left, right) => left.itemCode.localeCompare(right.itemCode, "tr-TR"));

  return { rows, warehouse };
}

export function getItemMovementReport(itemId: string): ItemMovementReport | null {
  const item = getMaster("items", itemId);

  if (!item) {
    return null;
  }

  const rows: ItemMovementRow[] = getAllStockMovements()
    .filter((movement) => movement.itemId === itemId)
    .toSorted((left, right) => {
      const byDate = right.docDate.localeCompare(left.docDate);

      return byDate || right.createdAt.localeCompare(left.createdAt);
    })
    .map((movement) => {
      const warehouse = getMaster("warehouses", movement.warehouseId);

      return {
        ...movement,
        warehouseCode: text(warehouse?.code),
        warehouseName: text(warehouse?.name),
      };
    });

  return { item, rows };
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function nullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}
