export type Currency = "TRY" | "USD" | "EUR" | "GBP";
export type AccountKind = "CUSTOMER" | "SUPPLIER" | "BOTH";
export type InvoiceKind = "SALES" | "PURCHASE";
export type InvoiceType = "STANDARD" | "STAR";
export type DeliveryDirection = "IN" | "OUT";
export type DeliveryMergeRole = "NORMAL" | "MERGED_RESULT" | "MERGED_SOURCE";
export type DeliveryMergeFlow = "SALES_OUT" | "PURCHASE_IN";
export type ReceiptKind = "COLLECTION" | "PAYMENT";
export type DocumentStatus = "DRAFT" | "APPROVED" | "VOID" | "SUPERSEDED";
export type StockCountStatus = "DRAFT" | "FINISHED" | "VOID";

export type MasterEntity =
  | "accounts"
  | "projects"
  | "warehouses"
  | "units"
  | "itemClasses"
  | "vatRates"
  | "items";

export type DocumentEntity =
  | "deliveryNotes"
  | "invoices"
  | "receipts"
  | "transfers";

export type LookupEntity = MasterEntity;

export interface ListQuery {
  search?: string;
  status?: string;
  accountId?: string;
  projectId?: string;
  warehouseId?: string;
  invoiceKind?: string;
  invoiceState?: "INVOICED" | "UNINVOICED";
  direction?: string;
  onlyOpenForInvoicing?: boolean;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type DataValue = string | number | boolean | null | string[];
export type DataRecord = Record<string, DataValue>;

export interface LookupItem {
  id: string;
  label: string;
  code?: string;
  extra?: string;
  isActive?: boolean;
  currency?: Currency;
  accountKind?: AccountKind;
  accountId?: string;
  accountCode?: string;
  rateBps?: number;
  defaultVatRateBps?: number;
}

export interface AppSnapshot {
  dataFolder: string;
  dbPath: string;
  metrics: Array<{ key: string; label: string; value: number }>;
  dashboard: {
    // Deprecated for display: use *ByCurrency until a real FX policy exists.
    dailySalesTotalMinor: number;
    weeklySalesTotalMinor: number;
    monthlySalesTotalMinor: number;
    todayDocumentCount: number;
    inventoryTotalMinor: number;
    dailySalesByCurrency: Record<Currency, number>;
    weeklySalesByCurrency: Record<Currency, number>;
    monthlySalesByCurrency: Record<Currency, number>;
    inventoryTotalByCurrency: Record<Currency, number>;
  };
}

export interface SaveMasterPayload {
  id?: string;
  [key: string]: unknown;
}

export interface DocumentLinePayload {
  id?: string;
  itemId?: string;
  description?: string;
  qty?: number;
  quantity?: number;
  unitPriceMinor?: number;
  discountBps?: number;
  vatRateBps?: number;
  deliveryNoteLineId?: string;
  sourceDeliveryLineIds?: string[];
  [key: string]: unknown;
}

export interface DocumentPayload {
  id?: string;
  lines?: DocumentLinePayload[];
  editReason?: string;
  supersedesId?: string;
  [key: string]: unknown;
}

export interface DocumentDetail<T = DataRecord> {
  header: T;
  lines: DataRecord[];
  revisions: DataRecord[];
  ledgerEntries: LedgerEntry[];
  stockMovements: StockMovement[];
  auditEvents: AuditEvent[];
}

export interface LedgerEntry {
  id: string;
  accountId: string;
  relatedAccountId: string | null;
  projectId: string | null;
  docType: string;
  docId: string;
  docNo: string;
  docDate: string;
  debitMinor: number;
  creditMinor: number;
  currency: Currency;
  description: string | null;
  createdAt: string;
  isEffective: boolean;
  cancelledAt: string | null;
  replacedByDocId: string | null;
}

export interface StockMovement {
  id: string;
  warehouseId: string;
  itemId: string;
  projectId: string | null;
  docType: string;
  docId: string;
  docNo: string;
  docDate: string;
  qtyIn: number;
  qtyOut: number;
  createdAt: string;
  isEffective: boolean;
  cancelledAt: string | null;
  replacedByDocId: string | null;
}

export interface AuditEvent {
  id: string;
  actorUserId: string | null;
  entity: string;
  entityId: string;
  action: string;
  payload: DataRecord | null;
  createdAt: string;
}

export type AccountStatementRow = LedgerEntry & {
  runningBalanceMinor: number;
};

export interface AccountStatementReport {
  account: DataRecord;
  debitTotalMinor: number;
  creditTotalMinor: number;
  closingBalanceMinor: number;
  rows: AccountStatementRow[];
}

export interface WarehouseInventoryRow {
  itemId: string;
  itemCode: string;
  itemName: string;
  unitLabel: string | null;
  quantity: number;
}

export interface WarehouseInventoryReport {
  warehouse: DataRecord;
  rows: WarehouseInventoryRow[];
}

export interface WarehouseDocumentMovementRow extends StockMovement {
  accountLabel: string | null;
  itemCode: string;
  itemName: string;
  projectLabel: string | null;
  sourceRole: string;
  status: DocumentStatus | null;
}

export interface WarehouseDocumentMovementReport {
  warehouse: DataRecord;
  rows: WarehouseDocumentMovementRow[];
}

export type ItemMovementRow = StockMovement & {
  warehouseCode: string;
  warehouseName: string;
};

export interface ItemMovementReport {
  item: DataRecord;
  rows: ItemMovementRow[];
}

export interface ProjectReportFilters {
  dateFrom?: string;
  dateTo?: string;
  warehouseId?: string;
  invoiceKind?: InvoiceKind;
}

export interface ProjectStockMovementRow extends StockMovement {
  itemCode: string;
  itemName: string;
  warehouseCode: string;
  warehouseName: string;
}

export interface ProjectStockMovementSummary {
  distinctItemCount: number;
  distinctWarehouseCount: number;
  movementCount: number;
  totalQtyIn: number;
  totalQtyOut: number;
}

export interface ProjectStockMovementReport {
  project: DataRecord;
  summary: ProjectStockMovementSummary;
  rows: ProjectStockMovementRow[];
}

export interface ProjectInvoiceRow {
  id: string;
  docNo: string;
  docDate: string;
  invoiceKind: InvoiceKind;
  accountId: string;
  accountLabel: string;
  warehouseId: string | null;
  warehouseLabel: string | null;
  currency: Currency;
  netTotalMinor: number;
  vatTotalMinor: number;
  grossTotalMinor: number;
  status: DocumentStatus;
  isEffective: boolean;
}

export interface ProjectInvoiceSummary {
  invoiceCount: number;
  salesCount: number;
  purchaseCount: number;
  netTotalsByCurrency: Record<Currency, number>;
  grossTotalsByCurrency: Record<Currency, number>;
}

export interface ProjectInvoiceListReport {
  project: DataRecord;
  summary: ProjectInvoiceSummary;
  rows: ProjectInvoiceRow[];
}

export interface ProjectMaterialUsageRow {
  itemId: string;
  itemCode: string;
  itemName: string;
  unitLabel: string | null;
  qtyIn: number;
  qtyOut: number;
  netUsage: number;
  movementCount: number;
}

export interface ProjectMaterialUsageSummary {
  distinctItemCount: number;
  totalMovementCount: number;
}

export interface ProjectMaterialUsageReport {
  project: DataRecord;
  summary: ProjectMaterialUsageSummary;
  rows: ProjectMaterialUsageRow[];
}

export interface ProjectEstimatedMarginInvoiceRow {
  id: string;
  docNo: string;
  docDate: string;
  currency: Currency;
  invoiceNetTotalMinor: number;
  costTotalMinor: number;
  profitMinor: number;
  marginPercent: number | null;
}

export interface ProjectEstimatedMarginSummary {
  invoiceCount: number;
  currency: Currency | null;
  estimatedCostTotalMinor: number;
  estimatedGrossProfitMinor: number;
  estimatedMarginPercent: number | null;
  salesNetTotalMinor: number;
}

export interface ProjectEstimatedMarginReport {
  project: DataRecord;
  summary: ProjectEstimatedMarginSummary;
  rows: ProjectEstimatedMarginInvoiceRow[];
}

export interface InvoiceMetrics {
  invoiceNetTotalMinor: number;
  invoiceGrossTotalMinor: number;
  costTotalMinor: number;
  profitMinor: number;
  marginPercent: number | null;
}

export type DeliveryNoteCandidate = DataRecord & {
  line_count?: number;
  lines?: DataRecord[];
  stock_direction?: DeliveryDirection;
};

export interface SettingsUser {
  id: string;
  username: string;
  fullName?: string | null;
  email?: string | null;
  isActive?: boolean;
  status?: string | null;
  roleIds?: string[];
  roleNames?: string[];
  lastLoginAt?: string | null;
}

export interface SettingsUserPayload {
  username: string;
  fullName?: string;
  email?: string;
  password?: string;
  isActive?: boolean;
  roleIds?: string[];
}

export interface SettingsRole {
  id: string;
  key?: string | null;
  name: string;
  description?: string | null;
  isSystem?: boolean;
  userCount?: number;
}

export interface PeriodLockConfig {
  lockDate: string | null;
  isActive: boolean;
  updatedAt: string | null;
  updatedByUserId: string | null;
}
