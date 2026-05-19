import type { DocumentEntity, LookupEntity, MasterEntity } from "./contracts";

export type FieldType = "text" | "number" | "select" | "date" | "textarea" | "switch";

export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  lookupEntity?: LookupEntity;
  options?: Array<{ label: string; value: string | number }>;
  min?: number;
  step?: number;
  moneyMinor?: boolean;
  hint?: string;
}

export interface MasterModuleConfig {
  key: string;
  title: string;
  entity: MasterEntity;
  columns: Array<{ key: string; title: string }>;
  fields: FieldConfig[];
  codeTemplate?: { prefix: string; width: number };
}

export interface DocumentModuleConfig {
  key: string;
  title: string;
  entity: DocumentEntity;
  columns: Array<{ key: string; title: string }>;
  headerFields: FieldConfig[];
  lineFields?: FieldConfig[];
  filterLookups?: LookupEntity[];
}

export interface SettingsWorkspaceTab {
  key: string;
  title: string;
}

export const currencyOptions = [
  { label: "TRY", value: "TRY" },
  { label: "USD", value: "USD" },
  { label: "EUR", value: "EUR" },
  { label: "GBP", value: "GBP" },
];

export const accountKindOptions = [
  { label: "Müşteri", value: "CUSTOMER" },
  { label: "Tedarikçi", value: "SUPPLIER" },
  { label: "Her İkisi", value: "BOTH" },
];

export const documentStatusOptions = [
  { label: "Taslak", value: "DRAFT" },
  { label: "Onaylı", value: "APPROVED" },
  { label: "Değiştirildi", value: "SUPERSEDED" },
  { label: "İptal", value: "VOID" },
];

export const directionOptions = [
  { label: "Giriş", value: "IN" },
  { label: "Çıkış", value: "OUT" },
];

export const invoiceKindOptions = [
  { label: "Satış", value: "SALES" },
  { label: "Alış", value: "PURCHASE" },
];

export const invoiceTypeOptions = [
  { label: "Standart", value: "STANDARD" },
  { label: "Yıldız", value: "STAR" },
];

export const receiptKindOptions = [
  { label: "Tahsilat", value: "COLLECTION" },
  { label: "Ödeme", value: "PAYMENT" },
];

export const masterModules: MasterModuleConfig[] = [
  {
    key: "accounts",
    title: "Cari Hesaplar",
    entity: "accounts",
    columns: [
      { key: "code", title: "Kod" },
      { key: "name", title: "Unvan" },
      { key: "account_kind", title: "Cari Tipi" },
      { key: "currency", title: "Para Birimi" },
      { key: "is_active", title: "Durum" },
      { key: "active_balance_minor", title: "Aktif Bakiye" },
    ],
    fields: [
      { name: "code", label: "Kod", type: "text", required: true },
      { name: "name", label: "Unvan", type: "text", required: true },
      { name: "accountKind", label: "Cari Tipi", type: "select", required: true, options: accountKindOptions },
      { name: "currency", label: "Para Birimi", type: "select", required: true, options: currencyOptions },
      { name: "isActive", label: "Aktif", type: "switch" },
    ],
    codeTemplate: { prefix: "CAR.", width: 3 },
  },
  {
    key: "projects",
    title: "Projeler",
    entity: "projects",
    columns: [
      { key: "code", title: "Kod" },
      { key: "name", title: "Proje" },
      { key: "account_id", title: "Cari" },
      { key: "is_active", title: "Durum" },
    ],
    fields: [
      { name: "accountId", label: "Cari", type: "select", required: true, lookupEntity: "accounts" },
      { name: "code", label: "Kod", type: "text", required: true },
      { name: "name", label: "Proje", type: "text", required: true },
      { name: "isActive", label: "Aktif", type: "switch" },
    ],
    codeTemplate: { prefix: "PRJ.", width: 3 },
  },
  {
    key: "warehouses",
    title: "Depolar",
    entity: "warehouses",
    columns: [
      { key: "code", title: "Kod" },
      { key: "name", title: "Depo" },
      { key: "is_active", title: "Durum" },
    ],
    fields: [
      { name: "code", label: "Kod", type: "text", required: true },
      { name: "name", label: "Depo", type: "text", required: true },
      { name: "isActive", label: "Aktif", type: "switch" },
    ],
    codeTemplate: { prefix: "DEP.", width: 3 },
  },
  {
    key: "units",
    title: "Birimler",
    entity: "units",
    columns: [
      { key: "name", title: "Birim" },
      { key: "is_active", title: "Durum" },
    ],
    fields: [
      { name: "name", label: "Birim", type: "text", required: true },
      { name: "isActive", label: "Aktif", type: "switch" },
    ],
  },
  {
    key: "itemClasses",
    title: "Malzeme Sınıfları",
    entity: "itemClasses",
    columns: [
      { key: "name", title: "Sınıf" },
      { key: "is_active", title: "Durum" },
    ],
    fields: [
      { name: "name", label: "Sınıf", type: "text", required: true },
      { name: "isActive", label: "Aktif", type: "switch" },
    ],
  },
  {
    key: "vatRates",
    title: "KDV Tanımları",
    entity: "vatRates",
    columns: [
      { key: "rate_bps", title: "KDV Oranı" },
      { key: "is_active", title: "Durum" },
    ],
    fields: [
      { name: "rateBps", label: "KDV Oranı", type: "number", required: true, min: 0, step: 1 },
      { name: "isActive", label: "Aktif", type: "switch" },
    ],
  },
  {
    key: "items",
    title: "Malzemeler",
    entity: "items",
    columns: [
      { key: "code", title: "Kod" },
      { key: "name", title: "Malzeme" },
      { key: "class_label", title: "Sınıf" },
      { key: "unit_label", title: "Birim" },
      { key: "total_stock", title: "Mevcut Stok" },
      { key: "is_active", title: "Aktif" },
    ],
    fields: [
      { name: "name", label: "Malzeme", type: "text", required: true },
      { name: "unitId", label: "Birim", type: "select", required: true, lookupEntity: "units" },
      { name: "classId", label: "Sınıf", type: "select", required: true, lookupEntity: "itemClasses" },
      { name: "defaultVatRateId", label: "Varsayılan KDV", type: "select", required: true, lookupEntity: "vatRates" },
      { name: "code", label: "Kod", type: "text", required: true },
      { name: "isActive", label: "Aktif", type: "switch" },
    ],
    codeTemplate: { prefix: "MLZ.", width: 3 },
  },
];

export const documentModules: DocumentModuleConfig[] = [
  {
    key: "deliveryNotes",
    title: "Sevk / İrsaliye",
    entity: "deliveryNotes",
    columns: [
      { key: "doc_date", title: "Tarih" },
      { key: "account_id", title: "Cari" },
      { key: "project_id", title: "Proje" },
      { key: "doc_no", title: "Sistem Evrak No" },
      { key: "actual_doc_no", title: "Harici Evrak No" },
      { key: "merge_role", title: "İrsaliye Tipi" },
      { key: "direction", title: "Hareket Yönü" },
      { key: "is_return", title: "İade" },
      { key: "status", title: "Durum" },
    ],
    headerFields: [
      { name: "direction", label: "Hareket Yönü", type: "select", required: true, options: directionOptions },
      { name: "isReturn", label: "İade", type: "switch" },
      { name: "actualDocNo", label: "Harici Evrak No", type: "text", required: true },
      { name: "accountId", label: "Cari", type: "select", required: true, lookupEntity: "accounts" },
      { name: "projectId", label: "Proje", type: "select", lookupEntity: "projects" },
      { name: "warehouseId", label: "Depo", type: "select", required: true, lookupEntity: "warehouses" },
      { name: "docDate", label: "Tarih", type: "date", required: true },
      { name: "description", label: "Açıklama", type: "textarea" },
    ],
    lineFields: [
      { name: "itemId", label: "Malzeme", type: "select", required: true, lookupEntity: "items" },
      { name: "quantity", label: "Miktar", type: "number", required: true, min: 0, step: 0.01 },
      { name: "unitPriceMinor", label: "Birim Fiyat", type: "number", moneyMinor: true, min: 0, step: 0.01 },
      { name: "currency", label: "Para Birimi", type: "select", options: currencyOptions },
      { name: "vatRateBps", label: "KDV", type: "number", min: 0, step: 1 },
    ],
    filterLookups: ["accounts", "projects", "warehouses"],
  },
  {
    key: "invoices",
    title: "Faturalar",
    entity: "invoices",
    columns: [
      { key: "doc_date", title: "Tarih" },
      { key: "account_id", title: "Cari" },
      { key: "project_id", title: "Proje" },
      { key: "doc_no", title: "Sistem Evrak No" },
      { key: "actual_doc_no", title: "Harici Evrak No" },
      { key: "invoice_kind", title: "Fatura Türü" },
      { key: "status", title: "Durum" },
      { key: "invoice_type", title: "Yıldız" },
      { key: "document_total_minor", title: "Toplam" },
    ],
    headerFields: [
      { name: "accountId", label: "Cari", type: "select", required: true, lookupEntity: "accounts" },
      { name: "projectId", label: "Proje", type: "select", lookupEntity: "projects" },
      { name: "invoiceKind", label: "Fatura Türü", type: "select", required: true, options: invoiceKindOptions },
      { name: "invoiceType", label: "Fatura Tipi", type: "select", required: true, options: invoiceTypeOptions },
      { name: "actualDocNo", label: "Harici Evrak No", type: "text", required: true },
      { name: "warehouseId", label: "Depo", type: "select", required: true, lookupEntity: "warehouses" },
      { name: "docDate", label: "Tarih", type: "date", required: true },
      { name: "currency", label: "Para Birimi", type: "select", required: true, options: currencyOptions },
      { name: "description", label: "Açıklama", type: "textarea" },
    ],
    lineFields: [
      { name: "itemId", label: "Malzeme", type: "select", required: true, lookupEntity: "items" },
      { name: "quantity", label: "Miktar", type: "number", required: true, min: 0, step: 0.01 },
      { name: "unitPriceMinor", label: "Birim Fiyat", type: "number", required: true, moneyMinor: true, min: 0, step: 0.01 },
      { name: "vatRateBps", label: "KDV", type: "number", min: 0, step: 1 },
    ],
    filterLookups: ["accounts", "projects", "warehouses"],
  },
  {
    key: "receipts",
    title: "Tahsilat / Ödeme",
    entity: "receipts",
    columns: [
      { key: "account_id", title: "Cari" },
      { key: "doc_no", title: "Sistem Evrak No" },
      { key: "receipt_kind", title: "İşlem Tipi" },
      { key: "amount_minor", title: "Tutar" },
      { key: "currency", title: "Para Birimi" },
      { key: "doc_date", title: "Tarih" },
      { key: "status", title: "Durum" },
    ],
    headerFields: [
      { name: "receiptKind", label: "İşlem Tipi", type: "select", required: true, options: receiptKindOptions },
      { name: "accountId", label: "Cari", type: "select", required: true, lookupEntity: "accounts" },
      { name: "projectId", label: "Proje", type: "select", lookupEntity: "projects" },
      { name: "docDate", label: "Tarih", type: "date", required: true },
      { name: "amountMinor", label: "Tutar", type: "number", required: true, moneyMinor: true },
      { name: "currency", label: "Para Birimi", type: "select", required: true, options: currencyOptions },
      { name: "description", label: "Açıklama", type: "textarea" },
    ],
    filterLookups: ["accounts", "projects"],
  },
  {
    key: "transfers",
    title: "Virman",
    entity: "transfers",
    columns: [
      { key: "doc_no", title: "Sistem Evrak No" },
      { key: "from_account_id", title: "Çıkış Cari" },
      { key: "to_account_id", title: "Giriş Cari" },
      { key: "amount_minor", title: "Tutar" },
      { key: "currency", title: "Para Birimi" },
      { key: "status", title: "Durum" },
    ],
    headerFields: [
      { name: "fromAccountId", label: "Çıkış Cari", type: "select", required: true, lookupEntity: "accounts" },
      { name: "toAccountId", label: "Giriş Cari", type: "select", required: true, lookupEntity: "accounts" },
      { name: "docDate", label: "Tarih", type: "date", required: true },
      { name: "amountMinor", label: "Tutar", type: "number", required: true, moneyMinor: true },
      { name: "currency", label: "Para Birimi", type: "select", required: true, options: currencyOptions },
      { name: "crossRate", label: "Çapraz Kur Çarpanı", type: "number", min: 0, step: 0.0001 },
      { name: "description", label: "Açıklama", type: "textarea" },
    ],
    filterLookups: ["accounts"],
  },
];

export const settingsMasterEntities: MasterEntity[] = [
  "units",
  "itemClasses",
  "vatRates",
];

export const settingsMasterModules = masterModules.filter((module) =>
  settingsMasterEntities.includes(module.entity),
);

export const settingsWorkspaceTabs: SettingsWorkspaceTab[] = [
  ...settingsMasterModules.map((module) => ({
    key: module.key,
    title: module.title,
  })),
  { key: "periodLock", title: "Dönem Kilidi" },
  { key: "settingsUsers", title: "Kullanıcılar" },
  { key: "settingsRoles", title: "Roller" },
];

export const primaryMasterModules = masterModules.filter(
  (module) => !settingsMasterEntities.includes(module.entity),
);

export const workspaceMenu = [
  { key: "dashboard", title: "Panel" },
  ...primaryMasterModules.map((module) => ({ key: module.key, title: module.title })),
  ...documentModules.map((module) => ({ key: module.key, title: module.title })),
  { key: "stockStatement", title: "Stok / Malzeme Ekstresi" },
  { key: "projectReports", title: "Proje Raporları" },
  { key: "settings", title: "Ayarlar" },
];
