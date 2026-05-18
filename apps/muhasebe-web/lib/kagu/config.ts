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
  { label: "Musteri", value: "CUSTOMER" },
  { label: "Tedarikci", value: "SUPPLIER" },
  { label: "Her Ikisi", value: "BOTH" },
];

export const documentStatusOptions = [
  { label: "Taslak", value: "DRAFT" },
  { label: "Onayli", value: "APPROVED" },
  { label: "Degistirildi", value: "SUPERSEDED" },
  { label: "Iptal", value: "VOID" },
];

export const directionOptions = [
  { label: "Giris", value: "IN" },
  { label: "Cikis", value: "OUT" },
];

export const invoiceKindOptions = [
  { label: "Satis", value: "SALES" },
  { label: "Alis", value: "PURCHASE" },
];

export const invoiceTypeOptions = [
  { label: "Standart", value: "STANDARD" },
  { label: "Yildiz", value: "STAR" },
];

export const receiptKindOptions = [
  { label: "Tahsilat", value: "COLLECTION" },
  { label: "Odeme", value: "PAYMENT" },
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
    title: "Malzeme Siniflari",
    entity: "itemClasses",
    columns: [
      { key: "name", title: "Sinif" },
      { key: "is_active", title: "Durum" },
    ],
    fields: [
      { name: "name", label: "Sinif", type: "text", required: true },
      { name: "isActive", label: "Aktif", type: "switch" },
    ],
  },
  {
    key: "vatRates",
    title: "KDV Tanimlari",
    entity: "vatRates",
    columns: [
      { key: "rate_bps", title: "KDV Orani" },
      { key: "is_active", title: "Durum" },
    ],
    fields: [
      { name: "rateBps", label: "KDV Orani", type: "number", required: true, min: 0, step: 1 },
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
      { key: "class_label", title: "Sinif" },
      { key: "unit_label", title: "Birim" },
      { key: "total_stock", title: "Mevcut Stok" },
      { key: "is_active", title: "Aktif" },
    ],
    fields: [
      { name: "name", label: "Malzeme", type: "text", required: true },
      { name: "unitId", label: "Birim", type: "select", required: true, lookupEntity: "units" },
      { name: "classId", label: "Sinif", type: "select", required: true, lookupEntity: "itemClasses" },
      { name: "defaultVatRateId", label: "Varsayilan KDV", type: "select", required: true, lookupEntity: "vatRates" },
      { name: "code", label: "Kod", type: "text", required: true },
      { name: "isActive", label: "Aktif", type: "switch" },
    ],
    codeTemplate: { prefix: "MLZ.", width: 3 },
  },
];

export const documentModules: DocumentModuleConfig[] = [
  {
    key: "deliveryNotes",
    title: "Sevk / Irsaliye",
    entity: "deliveryNotes",
    columns: [
      { key: "account_id", title: "Cari" },
      { key: "doc_no", title: "Evrak No" },
      { key: "actual_doc_no", title: "Harici Evrak No" },
      { key: "merge_role", title: "Irsaliye Tipi" },
      { key: "is_return", title: "Iade" },
      { key: "direction", title: "Hareket Yonu" },
      { key: "doc_date", title: "Tarih" },
      { key: "status", title: "Durum" },
    ],
    headerFields: [
      { name: "direction", label: "Hareket Yonu", type: "select", required: true, options: directionOptions },
      { name: "isReturn", label: "Iade", type: "switch" },
      { name: "actualDocNo", label: "Harici Evrak No", type: "text", required: true },
      { name: "accountId", label: "Cari", type: "select", required: true, lookupEntity: "accounts" },
      { name: "projectId", label: "Proje", type: "select", lookupEntity: "projects" },
      { name: "warehouseId", label: "Depo", type: "select", required: true, lookupEntity: "warehouses" },
      { name: "docDate", label: "Tarih", type: "date", required: true },
      { name: "description", label: "Aciklama", type: "textarea" },
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
      { key: "doc_no", title: "Evrak No" },
      { key: "actual_doc_no", title: "Harici Evrak No" },
      { key: "account_id", title: "Cari" },
      { key: "project_id", title: "Proje" },
      { key: "doc_date", title: "Tarih" },
      { key: "invoice_kind", title: "Fatura Turu" },
      { key: "document_total_minor", title: "Toplam" },
      { key: "status", title: "Durum" },
    ],
    headerFields: [
      { name: "accountId", label: "Cari", type: "select", required: true, lookupEntity: "accounts" },
      { name: "projectId", label: "Proje", type: "select", lookupEntity: "projects" },
      { name: "invoiceKind", label: "Fatura Turu", type: "select", required: true, options: invoiceKindOptions },
      { name: "invoiceType", label: "Fatura Tipi", type: "select", required: true, options: invoiceTypeOptions },
      { name: "actualDocNo", label: "Harici Evrak No", type: "text" },
      { name: "warehouseId", label: "Depo", type: "select", required: true, lookupEntity: "warehouses" },
      { name: "docDate", label: "Tarih", type: "date", required: true },
      { name: "currency", label: "Para Birimi", type: "select", required: true, options: currencyOptions },
      { name: "description", label: "Aciklama", type: "textarea" },
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
    title: "Tahsilat / Odeme",
    entity: "receipts",
    columns: [
      { key: "account_id", title: "Cari" },
      { key: "doc_no", title: "Evrak No" },
      { key: "receipt_kind", title: "Islem Tipi" },
      { key: "amount_minor", title: "Tutar" },
      { key: "currency", title: "Para Birimi" },
      { key: "doc_date", title: "Tarih" },
      { key: "status", title: "Durum" },
    ],
    headerFields: [
      { name: "receiptKind", label: "Islem Tipi", type: "select", required: true, options: receiptKindOptions },
      { name: "accountId", label: "Cari", type: "select", required: true, lookupEntity: "accounts" },
      { name: "projectId", label: "Proje", type: "select", lookupEntity: "projects" },
      { name: "docDate", label: "Tarih", type: "date", required: true },
      { name: "amountMinor", label: "Tutar", type: "number", required: true, moneyMinor: true },
      { name: "currency", label: "Para Birimi", type: "select", required: true, options: currencyOptions },
      { name: "description", label: "Aciklama", type: "textarea" },
    ],
    filterLookups: ["accounts", "projects"],
  },
  {
    key: "transfers",
    title: "Virman",
    entity: "transfers",
    columns: [
      { key: "doc_no", title: "Evrak No" },
      { key: "from_account_id", title: "Cikis Cari" },
      { key: "to_account_id", title: "Giris Cari" },
      { key: "amount_minor", title: "Tutar" },
      { key: "currency", title: "Para Birimi" },
      { key: "status", title: "Durum" },
    ],
    headerFields: [
      { name: "fromAccountId", label: "Cikis Cari", type: "select", required: true, lookupEntity: "accounts" },
      { name: "toAccountId", label: "Giris Cari", type: "select", required: true, lookupEntity: "accounts" },
      { name: "docDate", label: "Tarih", type: "date", required: true },
      { name: "amountMinor", label: "Tutar", type: "number", required: true, moneyMinor: true },
      { name: "currency", label: "Para Birimi", type: "select", required: true, options: currencyOptions },
      { name: "crossRate", label: "Capraz Kur Carpani", type: "number", min: 0, step: 0.0001 },
      { name: "description", label: "Aciklama", type: "textarea" },
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
  { key: "periodLock", title: "Donem Kilidi" },
  { key: "settingsUsers", title: "Kullanicilar" },
  { key: "settingsRoles", title: "Roller" },
];

export const primaryMasterModules = masterModules.filter(
  (module) => !settingsMasterEntities.includes(module.entity),
);

export const workspaceMenu = [
  { key: "dashboard", title: "Dashboard" },
  ...primaryMasterModules.map((module) => ({ key: module.key, title: module.title })),
  ...documentModules.map((module) => ({ key: module.key, title: module.title })),
  { key: "projectReports", title: "Proje Raporlari" },
  { key: "settings", title: "Ayarlar" },
];
