import {
  AccountKind as DbAccountKind,
  Currency as DbCurrency,
  type Prisma,
} from "@prisma/client";
import { randomUUID } from "node:crypto";

import { masterModules } from "./config";
import type {
  AppSnapshot,
  DataRecord,
  ListQuery,
  LookupEntity,
  LookupItem,
  MasterEntity,
  PaginatedResult,
  SaveMasterPayload,
} from "./contracts";
import { getDbDashboardTotals } from "./report-repository";
import { cleanRecord, dataValue, isoString, number, text } from "./db-shared";
import { camelToSnake, formatRateBps } from "./helpers";
import { prisma } from "@/server/db";

type Tx = Prisma.TransactionClient;

const masterEntities = new Set<MasterEntity>([
  "accounts",
  "projects",
  "warehouses",
  "units",
  "itemClasses",
  "vatRates",
  "items",
]);
let masterSeedPromise: Promise<void> | null = null;

export function isDbMasterEntity(entity: string): entity is MasterEntity {
  return masterEntities.has(entity as MasterEntity);
}

export async function getDbBootstrap(): Promise<AppSnapshot & {
  lookups: Partial<Record<LookupEntity, LookupItem[]>>;
}> {
  await ensureMasterSeeded();

  const [
    accountCount,
    itemCount,
    warehouseCount,
    unitsCount,
    itemClassesCount,
    vatRatesCount,
    dashboard,
  ] = await Promise.all([
    prisma.account.count(),
    prisma.item.count(),
    prisma.warehouse.count(),
    prisma.unit.count(),
    prisma.itemClass.count(),
    prisma.vatRate.count(),
    getDbDashboardTotals(),
  ]);

  return {
    dataFolder: "PostgreSQL",
    dbPath: "DATABASE_URL",
    dashboard,
    metrics: [
      { key: "accounts", label: "Cari Hesap", value: accountCount },
      { key: "items", label: "Malzeme", value: itemCount },
      { key: "warehouses", label: "Depo", value: warehouseCount },
      {
        key: "settings",
        label: "Ayar",
        value: unitsCount + itemClassesCount + vatRatesCount,
      },
    ],
    lookups: {
      accounts: await getDbLookups("accounts"),
      projects: await getDbLookups("projects"),
      warehouses: await getDbLookups("warehouses"),
      units: await getDbLookups("units"),
      itemClasses: await getDbLookups("itemClasses"),
      vatRates: await getDbLookups("vatRates"),
      items: await getDbLookups("items"),
    },
  };
}

export async function getDbLookups(entity: LookupEntity): Promise<LookupItem[]> {
  await ensureMasterSeeded();

  if (entity === "vatRates") {
    const rows = await prisma.vatRate.findMany({ orderBy: { rateBps: "asc" } });

    return rows.map((row) => ({
      id: row.id,
      label: formatRateBps(row.rateBps),
      rateBps: row.rateBps,
    }));
  }

  if (entity === "accounts") {
    const rows = await prisma.account.findMany({ orderBy: { code: "asc" } });

    return rows.map((row) => ({
      accountKind: row.accountKind,
      code: row.code,
      currency: row.currency,
      id: row.id,
      label: `${row.code} - ${row.name}`,
    }));
  }

  if (entity === "projects") {
    const [rows, accounts] = await Promise.all([
      prisma.project.findMany({ orderBy: { code: "asc" } }),
      prisma.account.findMany(),
    ]);
    const accountById = new Map(accounts.map((account) => [account.id, account]));

    return rows.map((row) => {
      const account = accountById.get(row.accountId);

      return {
        accountCode: account?.code ?? "",
        accountId: row.accountId,
        code: row.code,
        id: row.id,
        label: `${row.code} - ${row.name}`,
      };
    });
  }

  if (entity === "items") {
    const [rows, vatRates] = await Promise.all([
      prisma.item.findMany({ orderBy: { code: "asc" } }),
      prisma.vatRate.findMany(),
    ]);
    const vatById = new Map(vatRates.map((vatRate) => [vatRate.id, vatRate]));

    return rows.map((row) => ({
      code: row.code,
      defaultVatRateBps: vatById.get(row.defaultVatRateId)?.rateBps ?? 0,
      id: row.id,
      label: `${row.code} - ${row.name}`,
    }));
  }

  const rows = await listAllSimple(entity);

  return rows.map((row) => {
    const code = text(row.code);
    const name = text(row.name);

    return {
      code,
      id: text(row.id),
      label: code ? `${code} - ${name}` : name,
    };
  });
}

export async function listDbMasters(
  entity: MasterEntity,
  query: ListQuery = {},
): Promise<PaginatedResult<DataRecord>> {
  await ensureMasterSeeded();

  const page = Math.max(1, Number(query.page ?? 1));
  const pageSize = Math.min(100, Math.max(5, Number(query.pageSize ?? 20)));
  const allRows = await listAllMasterRows(entity, query);
  const filtered = filterMasterRows(entity, allRows, query);
  const start = (page - 1) * pageSize;

  return {
    items: filtered.slice(start, start + pageSize),
    page,
    pageSize,
    total: filtered.length,
  };
}

export async function getDbMaster(entity: MasterEntity, id: string) {
  await ensureMasterSeeded();

  const record = await findMasterRecord(entity, id);

  return record ? enrichRecord(entity, record) : null;
}

export async function saveDbMaster(
  entity: MasterEntity,
  payload: SaveMasterPayload,
) {
  await ensureMasterSeeded();

  return prisma.$transaction(async (tx) => saveDbMasterWithTx(tx, entity, payload));
}

export async function deleteDbMaster(entity: MasterEntity, id: string) {
  await ensureMasterSeeded();

  try {
    await deleteMasterRecord(entity, id);

    return true;
  } catch {
    return false;
  }
}

export async function suggestDbNextCode(
  entity: MasterEntity,
  options: { accountKind?: unknown; classId?: unknown } = {},
) {
  await ensureMasterSeeded();

  if (entity === "accounts") {
    return nextCode(await listCodes(entity), accountCodePrefix(options.accountKind), 3);
  }

  if (entity === "items") {
    const classId = text(options.classId);
    const itemClass = await prisma.itemClass.findUnique({ where: { id: classId } });

    if (!itemClass) {
      return null;
    }

    return nextCode(
      await listCodes(entity),
      `${itemClassCodePrefix(itemClass.name)}_MLZ_`,
      3,
    );
  }

  const moduleConfig = masterModules.find((candidate) => candidate.entity === entity);

  if (!moduleConfig?.codeTemplate) {
    return null;
  }

  return nextCode(
    await listCodes(entity),
    moduleConfig.codeTemplate.prefix,
    moduleConfig.codeTemplate.width,
  );
}

async function saveDbMasterWithTx(
  tx: Tx,
  entity: MasterEntity,
  payload: SaveMasterPayload,
) {
  const id = typeof payload.id === "string" && payload.id ? payload.id : randomUUID();
  const normalized = normalizePayload(entity, payload);
  const existing = await findMasterRecord(entity, id, tx);
  const code =
    text(normalized.code) ||
    (await suggestNextCodeWithTx(tx, entity, {
      accountKind: normalized.account_kind,
      classId: normalized.class_id,
    }));
  const next = cleanRecord({
    ...defaultsFor(entity),
    ...normalized,
    code: code ?? normalized.code ?? null,
    id,
  });

  const saved = await upsertMasterRecord(tx, entity, id, next);

  await tx.auditEvent.create({
    data: {
      action: existing ? "UPDATE" : "CREATE",
      entity,
      entityId: id,
      payload: next,
    },
  });

  return enrichRecord(entity, saved);
}

async function suggestNextCodeWithTx(
  tx: Tx,
  entity: MasterEntity,
  options: { accountKind?: unknown; classId?: unknown },
) {
  if (entity === "accounts") {
    return nextCode(await listCodes(entity, tx), accountCodePrefix(options.accountKind), 3);
  }

  if (entity === "items") {
    const itemClass = await tx.itemClass.findUnique({
      where: { id: text(options.classId) },
    });

    if (!itemClass) {
      return null;
    }

    return nextCode(
      await listCodes(entity, tx),
      `${itemClassCodePrefix(itemClass.name)}_MLZ_`,
      3,
    );
  }

  const moduleConfig = masterModules.find((candidate) => candidate.entity === entity);

  return moduleConfig?.codeTemplate
    ? nextCode(
        await listCodes(entity, tx),
        moduleConfig.codeTemplate.prefix,
        moduleConfig.codeTemplate.width,
      )
    : null;
}

async function ensureMasterSeeded() {
  if (process.env.KAGU_AUTO_SEED === "false") {
    return;
  }

  masterSeedPromise ??= seedMissingMasterData().catch((error: unknown) => {
    masterSeedPromise = null;
    throw error;
  });

  await masterSeedPromise;
}

async function seedMissingMasterData() {
  await prisma.$transaction(async (tx) => {
    await tx.unit.createMany({
      data: [
        { id: "unit-adet", name: "ADET" },
        { id: "unit-kg", name: "KG" },
        { id: "unit-m", name: "METRE" },
      ],
      skipDuplicates: true,
    });
    await tx.itemClass.createMany({
      data: [
        { id: "class-hammadde", name: "Hammadde" },
        { id: "class-mamul", name: "Mamul" },
        { id: "class-yardimci", name: "Yardimci Malzeme" },
      ],
      skipDuplicates: true,
    });
    await tx.vatRate.createMany({
      data: [
        { id: "vat-0", rateBps: 0 },
        { id: "vat-10", rateBps: 1000 },
        { id: "vat-20", rateBps: 2000 },
      ],
      skipDuplicates: true,
    });
    await tx.warehouse.createMany({
      data: [
        { code: "DEP.001", id: "warehouse-main", isActive: true, name: "Merkez Depo" },
        {
          code: "DEP.002",
          id: "warehouse-production",
          isActive: true,
          name: "Uretim Deposu",
        },
      ],
      skipDuplicates: true,
    });
    await tx.account.createMany({
      data: [
        {
          accountKind: "CUSTOMER",
          code: "120.MUS.001",
          currency: "TRY",
          id: "account-customer-1",
          isActive: true,
          name: "Kagu Musteri A.S.",
        },
        {
          accountKind: "SUPPLIER",
          code: "320.TED.001",
          currency: "TRY",
          id: "account-supplier-1",
          isActive: true,
          name: "Tedarikci Ornek Ltd.",
        },
      ],
      skipDuplicates: true,
    });
    await tx.project.createMany({
      data: [
        {
          accountId: "account-customer-1",
          code: "PRJ.001",
          id: "project-web",
          isActive: true,
          name: "Web Donusum",
        },
        {
          accountId: "account-customer-1",
          code: "PRJ.002",
          id: "project-service",
          isActive: true,
          name: "Servis Operasyon",
        },
      ],
      skipDuplicates: true,
    });
    await tx.item.createMany({
      data: [
        {
          classId: "class-mamul",
          code: "MML_MLZ_001",
          defaultVatRateId: "vat-20",
          id: "item-erp-service",
          isActive: true,
          name: "ERP Hizmet Kalemi",
          unitId: "unit-adet",
        },
        {
          classId: "class-hammadde",
          code: "HMA_MLZ_001",
          defaultVatRateId: "vat-20",
          id: "item-raw-steel",
          isActive: true,
          name: "Sac Hammadde",
          totalStock: 1420.5,
          unitId: "unit-kg",
        },
      ],
      skipDuplicates: true,
    });
  });
}

async function listAllMasterRows(entity: MasterEntity, query: ListQuery) {
  const records = await listAllSimple(entity);
  const enriched = await Promise.all(records.map((record) => enrichRecord(entity, record)));

  if (query.accountId) {
    return enriched.filter((record) => record.account_id === query.accountId);
  }

  return enriched;
}

async function listAllSimple(entity: MasterEntity): Promise<DataRecord[]> {
  switch (entity) {
    case "accounts":
      return (await prisma.account.findMany({ orderBy: { code: "asc" } })).map(accountRecord);
    case "projects":
      return (await prisma.project.findMany({ orderBy: { code: "asc" } })).map(projectRecord);
    case "warehouses":
      return (await prisma.warehouse.findMany({ orderBy: { code: "asc" } })).map(warehouseRecord);
    case "units":
      return (await prisma.unit.findMany({ orderBy: { name: "asc" } })).map(unitRecord);
    case "itemClasses":
      return (await prisma.itemClass.findMany({ orderBy: { name: "asc" } })).map(itemClassRecord);
    case "vatRates":
      return (await prisma.vatRate.findMany({ orderBy: { rateBps: "asc" } })).map(vatRateRecord);
    case "items":
      return (await prisma.item.findMany({ orderBy: { code: "asc" } })).map(itemRecord);
  }
}

async function findMasterRecord(entity: MasterEntity, id: string, tx: Tx = prisma) {
  switch (entity) {
    case "accounts": {
      const row = await tx.account.findUnique({ where: { id } });

      return row ? accountRecord(row) : null;
    }
    case "projects": {
      const row = await tx.project.findUnique({ where: { id } });

      return row ? projectRecord(row) : null;
    }
    case "warehouses": {
      const row = await tx.warehouse.findUnique({ where: { id } });

      return row ? warehouseRecord(row) : null;
    }
    case "units": {
      const row = await tx.unit.findUnique({ where: { id } });

      return row ? unitRecord(row) : null;
    }
    case "itemClasses": {
      const row = await tx.itemClass.findUnique({ where: { id } });

      return row ? itemClassRecord(row) : null;
    }
    case "vatRates": {
      const row = await tx.vatRate.findUnique({ where: { id } });

      return row ? vatRateRecord(row) : null;
    }
    case "items": {
      const row = await tx.item.findUnique({ where: { id } });

      return row ? itemRecord(row) : null;
    }
  }
}

async function upsertMasterRecord(
  tx: Tx,
  entity: MasterEntity,
  id: string,
  record: DataRecord,
) {
  switch (entity) {
    case "accounts":
      return accountRecord(
        await tx.account.upsert({
          create: {
            accountKind: dbAccountKind(record.account_kind),
            code: text(record.code),
            currency: dbCurrency(record.currency),
            id,
            isActive: record.is_active !== false,
            name: text(record.name),
          },
          update: {
            accountKind: dbAccountKind(record.account_kind),
            code: text(record.code),
            currency: dbCurrency(record.currency),
            isActive: record.is_active !== false,
            name: text(record.name),
          },
          where: { id },
        }),
      );
    case "projects":
      return projectRecord(
        await tx.project.upsert({
          create: {
            accountId: text(record.account_id),
            code: text(record.code),
            id,
            isActive: record.is_active !== false,
            name: text(record.name),
          },
          update: {
            accountId: text(record.account_id),
            code: text(record.code),
            isActive: record.is_active !== false,
            name: text(record.name),
          },
          where: { id },
        }),
      );
    case "warehouses":
      return warehouseRecord(
        await tx.warehouse.upsert({
          create: {
            code: text(record.code),
            id,
            isActive: record.is_active !== false,
            name: text(record.name),
          },
          update: {
            code: text(record.code),
            isActive: record.is_active !== false,
            name: text(record.name),
          },
          where: { id },
        }),
      );
    case "units":
      return unitRecord(
        await tx.unit.upsert({
          create: { id, name: text(record.name) },
          update: { name: text(record.name) },
          where: { id },
        }),
      );
    case "itemClasses":
      return itemClassRecord(
        await tx.itemClass.upsert({
          create: { id, name: text(record.name) },
          update: { name: text(record.name) },
          where: { id },
        }),
      );
    case "vatRates":
      return vatRateRecord(
        await tx.vatRate.upsert({
          create: { id, rateBps: number(record.rate_bps) },
          update: { rateBps: number(record.rate_bps) },
          where: { id },
        }),
      );
    case "items":
      return itemRecord(
        await tx.item.upsert({
          create: {
            classId: text(record.class_id),
            code: text(record.code),
            defaultVatRateId: text(record.default_vat_rate_id),
            id,
            isActive: record.is_active !== false,
            name: text(record.name),
            unitId: text(record.unit_id),
          },
          update: {
            classId: text(record.class_id),
            code: text(record.code),
            defaultVatRateId: text(record.default_vat_rate_id),
            isActive: record.is_active !== false,
            name: text(record.name),
            unitId: text(record.unit_id),
          },
          where: { id },
        }),
      );
  }
}

async function deleteMasterRecord(entity: MasterEntity, id: string) {
  switch (entity) {
    case "accounts":
      await prisma.account.delete({ where: { id } });
      return;
    case "projects":
      await prisma.project.delete({ where: { id } });
      return;
    case "warehouses":
      await prisma.warehouse.delete({ where: { id } });
      return;
    case "units":
      await prisma.unit.delete({ where: { id } });
      return;
    case "itemClasses":
      await prisma.itemClass.delete({ where: { id } });
      return;
    case "vatRates":
      await prisma.vatRate.delete({ where: { id } });
      return;
    case "items":
      await prisma.item.delete({ where: { id } });
  }
}

function filterMasterRows(
  entity: MasterEntity,
  rows: DataRecord[],
  query: ListQuery,
) {
  let filtered = rows;
  const search = normalize(query.search);

  if (query.status === "ACTIVE") {
    filtered = filtered.filter((record) => record.is_active !== false);
  }

  if (query.status === "PASSIVE") {
    filtered = filtered.filter((record) => record.is_active === false);
  }

  if (search) {
    filtered = filtered.filter((record) =>
      Object.values(record).some((value) => normalize(String(value)).includes(search)),
    );
  }

  return entity === "vatRates"
    ? filtered.toSorted((left, right) => number(left.rate_bps) - number(right.rate_bps))
    : filtered;
}

async function enrichRecord(entity: MasterEntity, record: DataRecord): Promise<DataRecord> {
  const enriched = { ...record };

  if (entity === "projects") {
    enriched.account_label = await findMasterLabel("accounts", text(record.account_id));
  }

  if (entity === "items") {
    const [unitLabel, classLabel, vatRate, stock] = await Promise.all([
      findMasterLabel("units", text(record.unit_id)),
      findMasterLabel("itemClasses", text(record.class_id)),
      prisma.vatRate.findUnique({ where: { id: text(record.default_vat_rate_id) } }),
      getItemStockQuantity(text(record.id)),
    ]);

    enriched.unit_label = unitLabel;
    enriched.class_label = classLabel;
    enriched.default_vat_rate_bps = vatRate?.rateBps ?? 0;
    enriched.total_stock = stock;
  }

  if (entity === "accounts") {
    enriched.active_balance_minor = await getAccountBalanceMinor(text(record.id));
  }

  return enriched;
}

async function findMasterLabel(entity: MasterEntity, id: string) {
  const record = await findMasterRecord(entity, id);
  const code = text(record?.code);
  const name = text(record?.name);

  return code ? `${code} - ${name}` : name || null;
}

async function listCodes(entity: MasterEntity, tx: Tx = prisma) {
  switch (entity) {
    case "accounts":
      return (await tx.account.findMany({ select: { code: true } })).map((row) => row.code);
    case "projects":
      return (await tx.project.findMany({ select: { code: true } })).map((row) => row.code);
    case "warehouses":
      return (await tx.warehouse.findMany({ select: { code: true } })).map((row) => row.code);
    case "items":
      return (await tx.item.findMany({ select: { code: true } })).map((row) => row.code);
    default:
      return [];
  }
}

async function getAccountBalanceMinor(accountId: string) {
  const [debit, credit] = await Promise.all([
    prisma.accountLedgerEntry.aggregate({
      _sum: { debitMinor: true },
      where: { accountId },
    }),
    prisma.accountLedgerEntry.aggregate({
      _sum: { creditMinor: true },
      where: { accountId },
    }),
  ]);

  return (debit._sum.debitMinor ?? 0) - (credit._sum.creditMinor ?? 0);
}

async function getItemStockQuantity(itemId: string) {
  const [qtyIn, qtyOut] = await Promise.all([
    prisma.stockMovement.aggregate({ _sum: { qtyIn: true }, where: { itemId } }),
    prisma.stockMovement.aggregate({ _sum: { qtyOut: true }, where: { itemId } }),
  ]);

  return number(qtyIn._sum.qtyIn) - number(qtyOut._sum.qtyOut);
}

function normalizePayload(entity: MasterEntity, payload: SaveMasterPayload) {
  const normalized: DataRecord = {};

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
  return dataValue(value);
}

function defaultsFor(entity: MasterEntity): DataRecord {
  switch (entity) {
    case "accounts":
      return {
        account_kind: "CUSTOMER",
        active_balance_minor: 0,
        currency: "TRY",
        is_active: true,
      };
    case "projects":
    case "warehouses":
    case "items":
      return { is_active: true };
    default:
      return {};
  }
}

function nextCode(codes: string[], prefix: string, width: number) {
  const max = codes
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

function accountRecord(row: {
  accountKind: string;
  activeBalanceMinor?: number;
  code: string;
  createdAt: Date;
  currency: string;
  id: string;
  isActive: boolean;
  name: string;
  updatedAt: Date;
}): DataRecord {
  return {
    account_kind: row.accountKind,
    active_balance_minor: row.activeBalanceMinor ?? 0,
    code: row.code,
    created_at: isoString(row.createdAt),
    currency: row.currency,
    id: row.id,
    is_active: row.isActive,
    name: row.name,
    updated_at: isoString(row.updatedAt),
  };
}

function dbAccountKind(value: unknown): DbAccountKind {
  return value === "SUPPLIER"
    ? DbAccountKind.SUPPLIER
    : value === "BOTH"
      ? DbAccountKind.BOTH
      : DbAccountKind.CUSTOMER;
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

function projectRecord(row: {
  accountId: string;
  code: string;
  createdAt: Date;
  id: string;
  isActive: boolean;
  name: string;
  updatedAt: Date;
}): DataRecord {
  return {
    account_id: row.accountId,
    code: row.code,
    created_at: isoString(row.createdAt),
    id: row.id,
    is_active: row.isActive,
    name: row.name,
    updated_at: isoString(row.updatedAt),
  };
}

function warehouseRecord(row: {
  code: string;
  createdAt: Date;
  id: string;
  isActive: boolean;
  name: string;
  updatedAt: Date;
}): DataRecord {
  return {
    code: row.code,
    created_at: isoString(row.createdAt),
    id: row.id,
    is_active: row.isActive,
    name: row.name,
    updated_at: isoString(row.updatedAt),
  };
}

function unitRecord(row: { createdAt: Date; id: string; name: string; updatedAt: Date }): DataRecord {
  return {
    created_at: isoString(row.createdAt),
    id: row.id,
    name: row.name,
    updated_at: isoString(row.updatedAt),
  };
}

function itemClassRecord(row: {
  createdAt: Date;
  id: string;
  name: string;
  updatedAt: Date;
}): DataRecord {
  return unitRecord(row);
}

function vatRateRecord(row: {
  createdAt: Date;
  id: string;
  rateBps: number;
  updatedAt: Date;
}): DataRecord {
  return {
    created_at: isoString(row.createdAt),
    id: row.id,
    rate_bps: row.rateBps,
    updated_at: isoString(row.updatedAt),
  };
}

function itemRecord(row: {
  averageCostMinor?: number;
  classId: string;
  code: string;
  createdAt: Date;
  defaultVatRateId: string;
  id: string;
  isActive: boolean;
  name: string;
  totalStock?: unknown;
  unitId: string;
  updatedAt: Date;
}): DataRecord {
  return {
    average_cost_minor: row.averageCostMinor ?? 0,
    class_id: row.classId,
    code: row.code,
    created_at: isoString(row.createdAt),
    default_vat_rate_id: row.defaultVatRateId,
    id: row.id,
    is_active: row.isActive,
    name: row.name,
    total_stock: number(row.totalStock),
    unit_id: row.unitId,
    updated_at: isoString(row.updatedAt),
  };
}

function normalize(value: unknown) {
  return String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .trim();
}
