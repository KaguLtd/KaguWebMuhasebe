import { randomUUID } from "node:crypto";

import { masterModules } from "./config";
import type {
  AppSnapshot,
  Currency,
  DataRecord,
  ListQuery,
  LookupEntity,
  LookupItem,
  MasterEntity,
  PaginatedResult,
  SaveMasterPayload,
} from "./contracts";
import {
  getAccountBalanceMinor,
  getDashboardTotals,
  getItemStockQuantity,
} from "./document-engine";
import { camelToSnake, formatRateBps } from "./helpers";

export type MasterRecord = DataRecord;

type MasterStore = Record<MasterEntity, MasterRecord[]>;

const masterEntities = new Set<MasterEntity>([
  "accounts",
  "projects",
  "warehouses",
  "units",
  "itemClasses",
  "vatRates",
  "items",
]);

const createdAt = "2026-05-04T08:00:00.000Z";

const globalForKagu = globalThis as typeof globalThis & {
  __kaguMasterStore?: MasterStore;
};

function seedStore(): MasterStore {
  return {
    units: [
      row("unit-adet", { is_active: true, name: "ADET" }),
      row("unit-kg", { is_active: true, name: "KG" }),
      row("unit-m", { is_active: true, name: "METRE" }),
    ],
    itemClasses: [
      row("class-hammadde", { is_active: true, name: "Hammadde" }),
      row("class-mamul", { is_active: true, name: "Mamul" }),
      row("class-yardimci", { is_active: true, name: "Yardimci Malzeme" }),
    ],
    vatRates: [
      row("vat-0", { is_active: true, rate_bps: 0 }),
      row("vat-10", { is_active: true, rate_bps: 1000 }),
      row("vat-20", { is_active: true, rate_bps: 2000 }),
    ],
    warehouses: [
      row("warehouse-main", {
        code: "DEP.001",
        name: "Merkez Depo",
        is_active: true,
      }),
      row("warehouse-production", {
        code: "DEP.002",
        name: "Uretim Deposu",
        is_active: true,
      }),
    ],
    accounts: [
      row("account-customer-1", {
        code: "120.MUS.001",
        name: "Kagu Musteri A.S.",
        account_kind: "CUSTOMER",
        currency: "TRY",
        is_active: true,
        active_balance_minor: 1245000,
      }),
      row("account-supplier-1", {
        code: "320.TED.001",
        name: "Tedarikci Ornek Ltd.",
        account_kind: "SUPPLIER",
        currency: "TRY",
        is_active: true,
        active_balance_minor: -725000,
      }),
    ],
    projects: [
      row("project-web", {
        account_id: "account-customer-1",
        code: "PRJ.001",
        name: "Web Donusum",
        is_active: true,
      }),
      row("project-service", {
        account_id: "account-customer-1",
        code: "PRJ.002",
        name: "Servis Operasyon",
        is_active: true,
      }),
    ],
    items: [
      row("item-erp-service", {
        code: "MML_MLZ_001",
        name: "ERP Hizmet Kalemi",
        unit_id: "unit-adet",
        class_id: "class-mamul",
        default_vat_rate_id: "vat-20",
        is_active: true,
        total_stock: 0,
      }),
      row("item-raw-steel", {
        code: "HMA_MLZ_001",
        name: "Sac Hammadde",
        unit_id: "unit-kg",
        class_id: "class-hammadde",
        default_vat_rate_id: "vat-20",
        is_active: true,
        total_stock: 1420.5,
      }),
    ],
  };
}

function row(id: string, values: Omit<MasterRecord, "id">): MasterRecord {
  return {
    id,
    ...values,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

function getStore() {
  globalForKagu.__kaguMasterStore ??= seedStore();

  return globalForKagu.__kaguMasterStore;
}

export function isMasterEntity(entity: string): entity is MasterEntity {
  return masterEntities.has(entity as MasterEntity);
}

export function getBootstrap(): AppSnapshot & {
  lookups: Partial<Record<LookupEntity, LookupItem[]>>;
} {
  const store = getStore();
  const accountCount = store.accounts.length;
  const itemCount = store.items.length;
  const warehouseCount = store.warehouses.length;
  const settingsCount =
    store.units.length + store.itemClasses.length + store.vatRates.length;
  const dashboard = getDashboardTotals();

  return {
    dataFolder: "PostgreSQL target / in-memory parity store",
    dbPath: "DATABASE_URL",
    metrics: [
      { key: "accounts", label: "Cari Hesap", value: accountCount },
      { key: "items", label: "Malzeme", value: itemCount },
      { key: "warehouses", label: "Depo", value: warehouseCount },
      { key: "settings", label: "Ayar", value: settingsCount },
    ],
    dashboard,
    lookups: {
      accounts: getLookups("accounts"),
      projects: getLookups("projects"),
      warehouses: getLookups("warehouses"),
      units: getLookups("units"),
      itemClasses: getLookups("itemClasses"),
      vatRates: getLookups("vatRates"),
      items: getLookups("items"),
    },
  };
}

export function getLookups(entity: LookupEntity): LookupItem[] {
  return getStore()[entity].map((record) => {
    const enriched = enrichRecord(entity, record);
    const code = text(enriched.code);
    const name = text(enriched.name);

    if (entity === "vatRates") {
      return {
        id: text(enriched.id),
        label: formatRateBps(enriched.rate_bps),
        rateBps: number(enriched.rate_bps),
        isActive: enriched.is_active !== false,
      };
    }

    if (entity === "accounts") {
      return {
        id: text(enriched.id),
        code,
        label: code ? `${code} - ${name}` : name,
        currency: text(enriched.currency) as Currency,
        accountKind: text(enriched.account_kind) as LookupItem["accountKind"],
        isActive: enriched.is_active !== false,
      };
    }

    if (entity === "projects") {
      const account = getMaster("accounts", text(enriched.account_id));

      return {
        id: text(enriched.id),
        code,
        label: code ? `${code} - ${name}` : name,
        accountId: text(enriched.account_id),
        accountCode: text(account?.code),
        isActive: enriched.is_active !== false,
      };
    }

    return {
      id: text(enriched.id),
      code,
      label: code ? `${code} - ${name}` : name,
      defaultVatRateBps: number(enriched.default_vat_rate_bps),
      isActive: enriched.is_active !== false,
    };
  });
}

export function listMasters(
  entity: MasterEntity,
  query: ListQuery = {},
): PaginatedResult<MasterRecord> {
  const page = Math.max(1, Number(query.page ?? 1));
  const pageSize = Math.min(100, Math.max(5, Number(query.pageSize ?? 20)));
  const search = normalize(query.search);
  const status = query.status;
  const store = getStore();
  let rows = store[entity].map((record) => enrichRecord(entity, record));

  if (status === "ACTIVE") {
    rows = rows.filter((record) => record.is_active !== false);
  }

  if (status === "PASSIVE") {
    rows = rows.filter((record) => record.is_active === false);
  }

  if (query.accountId) {
    rows = rows.filter((record) => record.account_id === query.accountId);
  }

  if (search) {
    rows = rows.filter((record) =>
      Object.values(record).some((value) => normalize(String(value)).includes(search)),
    );
  }

  const total = rows.length;
  const start = (page - 1) * pageSize;

  return {
    items: rows.slice(start, start + pageSize),
    total,
    page,
    pageSize,
  };
}

export function getMaster(entity: MasterEntity, id: string) {
  const record = getStore()[entity].find((item) => item.id === id);

  return record ? enrichRecord(entity, record) : null;
}

export function suggestNextCode(
  entity: MasterEntity,
  options: { accountKind?: unknown; classId?: unknown } = {},
) {
  if (entity === "accounts") {
    return nextCode(entity, accountCodePrefix(options.accountKind), 3);
  }

  if (entity === "items") {
    const classId = text(options.classId);
    const itemClass = getStore().itemClasses.find((record) => record.id === classId);

    if (!itemClass) {
      return null;
    }

    return nextCode(entity, `${itemClassCodePrefix(text(itemClass.name))}_MLZ_`, 3);
  }

  const moduleConfig = masterModules.find((candidate) => candidate.entity === entity);

  if (!moduleConfig?.codeTemplate) {
    return null;
  }

  return nextCode(
    entity,
    moduleConfig.codeTemplate.prefix,
    moduleConfig.codeTemplate.width,
  );
}

export function saveMaster(entity: MasterEntity, payload: SaveMasterPayload) {
  const store = getStore();
  const rows = store[entity];
  const id = typeof payload.id === "string" && payload.id ? payload.id : randomUUID();
  const currentIndex = rows.findIndex((record) => record.id === id);
  const previous = currentIndex >= 0 ? rows[currentIndex] : null;
  const now = new Date().toISOString();
  const normalized = normalizePayload(entity, payload);
  const next: MasterRecord = {
    ...(previous ?? {}),
    ...defaultsFor(entity),
    ...normalized,
    id,
    created_at: previous?.created_at ?? now,
    updated_at: now,
  };

  if (!next.code) {
    const generated = suggestNextCode(entity, {
      accountKind: next.account_kind,
      classId: next.class_id,
    });

    if (generated) {
      next.code = generated;
    }
  }

  if (currentIndex >= 0) {
    rows[currentIndex] = next;
  } else {
    rows.unshift(next);
  }

  return enrichRecord(entity, next);
}

export function deleteMaster(entity: MasterEntity, id: string) {
  const record = getStore()[entity].find((item) => item.id === id);

  if (!record) {
    return false;
  }

  record.is_active = false;

  return true;
}

function normalizePayload(entity: MasterEntity, payload: SaveMasterPayload) {
  const normalized: MasterRecord = {};

  for (const [key, value] of Object.entries(payload)) {
    if (key === "id" || typeof value === "undefined") {
      continue;
    }

    if (key === "rateBps") {
      normalized.rate_bps = Math.round(Number(value ?? 0) * 100);
      continue;
    }

    normalized[camelToSnake(key)] = normalizeValue(value);
  }

  if (entity === "vatRates" && typeof normalized.rate_bps !== "number") {
    normalized.rate_bps = 0;
  }

  return normalized;
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

  return String(value);
}

function defaultsFor(entity: MasterEntity): MasterRecord {
  switch (entity) {
    case "accounts":
      return {
        account_kind: "CUSTOMER",
        currency: "TRY",
        is_active: true,
        active_balance_minor: 0,
      };
    case "projects":
    case "warehouses":
    case "units":
    case "itemClasses":
    case "vatRates":
    case "items":
      return { is_active: true };
    default:
      return {};
  }
}

function nextCode(entity: MasterEntity, prefix: string, width: number) {
  const max = getStore()
    [entity].map((record) => String(record.code ?? ""))
    .filter((code) => code.startsWith(prefix))
    .map((code) => code.slice(prefix.length).match(/(\d+)(?!.*\d)/)?.[1])
    .map((value) => Number(value ?? 0))
    .filter(Number.isFinite)
    .reduce((current, value) => Math.max(current, value), 0);

  return `${prefix}${String(max + 1).padStart(width, "0")}`;
}

function accountCodePrefix(accountKind: unknown) {
  if (accountKind === "SUPPLIER") {
    return "320.TED.";
  }

  if (accountKind === "BOTH") {
    return "CAR.";
  }

  return "120.MUS.";
}

function itemClassCodePrefix(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();

  if (normalized.length >= 5) {
    return `${normalized[0]}${normalized[2]}${normalized[4]}`;
  }

  return normalized.slice(0, 3).padEnd(3, "X");
}

function enrichRecord(entity: MasterEntity, record: MasterRecord): MasterRecord {
  const store = getStore();
  const enriched = { ...record };

  if (entity === "projects") {
    enriched.account_label = findLabel(store.accounts, record.account_id);
  }

  if (entity === "items") {
    const vatRate = store.vatRates.find((item) => item.id === record.default_vat_rate_id);

    enriched.unit_label = findLabel(store.units, record.unit_id);
    enriched.class_label = findLabel(store.itemClasses, record.class_id);
    enriched.default_vat_rate_bps = number(vatRate?.rate_bps);
    enriched.total_stock = getItemStockQuantity(text(record.id));
  }

  if (entity === "accounts") {
    enriched.active_balance_minor = getAccountBalanceMinor(text(record.id));
  }

  return enriched;
}

function findLabel(records: MasterRecord[], id: unknown) {
  const record = records.find((item) => item.id === id);
  const code = text(record?.code);
  const name = text(record?.name);

  return code ? `${code} - ${name}` : name || null;
}

function normalize(value: unknown) {
  return String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .trim();
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
