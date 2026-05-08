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

export function isDbMasterEntity(entity: string): entity is MasterEntity {
  return masterEntities.has(entity as MasterEntity);
}

export async function getDbBootstrap(): Promise<AppSnapshot & {
  lookups: Partial<Record<LookupEntity, LookupItem[]>>;
}> {
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
  if (entity === "vatRates") {
    const rows = await prisma.vatRate.findMany({ orderBy: { rateBps: "asc" } });

    return rows.map((row) => ({
      id: row.id,
      isActive: row.isActive,
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
      isActive: row.isActive,
      label: `${row.code} - ${row.name}`,
    }));
  }

  if (entity === "projects") {
    const rows = await prisma.project.findMany({
      include: { account: true },
      orderBy: { code: "asc" },
    });

    return rows.map((row) => {
      return {
        accountCode: row.account.code,
        accountId: row.accountId,
        code: row.code,
        id: row.id,
        isActive: row.isActive,
        label: `${row.code} - ${row.name}`,
      };
    });
  }

  if (entity === "items") {
    const rows = await prisma.item.findMany({
      include: { defaultVatRate: true },
      orderBy: { code: "asc" },
    });

    return rows.map((row) => ({
      code: row.code,
      defaultVatRateBps: row.defaultVatRate.rateBps,
      id: row.id,
      isActive: row.isActive,
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
      isActive: row.is_active !== false,
      label: code ? `${code} - ${name}` : name,
    };
  });
}

export async function listDbMasters(
  entity: MasterEntity,
  query: ListQuery = {},
): Promise<PaginatedResult<DataRecord>> {
  const page = Math.max(1, Number(query.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20)));
  const skip = (page - 1) * pageSize;

  if (entity === "accounts") {
    const where = buildAccountWhere(query);
    const [rows, total] = await Promise.all([
      prisma.account.findMany({ orderBy: { code: "asc" }, skip, take: pageSize, where }),
      prisma.account.count({ where }),
    ]);

    return {
      items: await Promise.all(rows.map((row) => enrichRecord(entity, accountRecord(row)))),
      page,
      pageSize,
      total,
    };
  }

  if (entity === "projects") {
    const where = buildProjectWhere(query);
    const [rows, total] = await Promise.all([
      prisma.project.findMany({
        include: { account: true },
        orderBy: { code: "asc" },
        skip,
        take: pageSize,
        where,
      }),
      prisma.project.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({
        ...projectRecord(row),
        account_label: `${row.account.code} - ${row.account.name}`,
      })),
      page,
      pageSize,
      total,
    };
  }

  if (entity === "warehouses") {
    const where = buildWarehouseWhere(query);
    const [rows, total] = await Promise.all([
      prisma.warehouse.findMany({ orderBy: { code: "asc" }, skip, take: pageSize, where }),
      prisma.warehouse.count({ where }),
    ]);

    return { items: rows.map(warehouseRecord), page, pageSize, total };
  }

  if (entity === "units") {
    const where = buildNamedEntityWhere(query);
    const [rows, total] = await Promise.all([
      prisma.unit.findMany({ orderBy: { name: "asc" }, skip, take: pageSize, where }),
      prisma.unit.count({ where }),
    ]);

    return { items: rows.map(unitRecord), page, pageSize, total };
  }

  if (entity === "itemClasses") {
    const where = buildNamedEntityWhere(query);
    const [rows, total] = await Promise.all([
      prisma.itemClass.findMany({ orderBy: { name: "asc" }, skip, take: pageSize, where }),
      prisma.itemClass.count({ where }),
    ]);

    return { items: rows.map(itemClassRecord), page, pageSize, total };
  }

  if (entity === "vatRates") {
    const where = buildVatRateWhere(query);
    const [rows, total] = await Promise.all([
      prisma.vatRate.findMany({ orderBy: { rateBps: "asc" }, skip, take: pageSize, where }),
      prisma.vatRate.count({ where }),
    ]);

    return { items: rows.map(vatRateRecord), page, pageSize, total };
  }

  const where = buildItemWhere(query);
  const [rows, total] = await Promise.all([
    prisma.item.findMany({
      include: { defaultVatRate: true, itemClass: true, unit: true },
      orderBy: { code: "asc" },
      skip,
      take: pageSize,
      where,
    }),
    prisma.item.count({ where }),
  ]);

  return {
    items: await Promise.all(
      rows.map(async (row) => ({
        ...itemRecord(row),
        class_label: row.itemClass.name,
        default_vat_rate_bps: row.defaultVatRate.rateBps,
        total_stock: await getItemStockQuantity(row.id),
        unit_label: row.unit.name,
      })),
    ),
    page,
    pageSize,
    total,
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
  actorUserId: string,
) {
  await ensureMasterSeeded();

  return prisma.$transaction(async (tx) =>
    saveDbMasterWithTx(tx, entity, payload, actorUserId),
  );
}

export async function deleteDbMaster(entity: MasterEntity, id: string) {
  await ensureMasterSeeded();

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await findMasterRecord(entity, id, tx);

      if (!existing) {
        throw new Error("Master record not found");
      }

      await assertCanSetActiveState(tx, entity, existing, false);
      await setMasterActiveState(tx, entity, id, false);
    });

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
  actorUserId: string,
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
  const nextIsActive = next.is_active !== false;

  if (existing) {
    await assertCanSetActiveState(tx, entity, existing, nextIsActive);
  }

  const saved = await upsertMasterRecord(tx, entity, id, next);

  await tx.auditEvent.create({
    data: {
      action: existing ? "UPDATE" : "CREATE",
      actorUserId,
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
  return;
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
          create: { id, isActive: record.is_active !== false, name: text(record.name) },
          update: { isActive: record.is_active !== false, name: text(record.name) },
          where: { id },
        }),
      );
    case "itemClasses":
      return itemClassRecord(
        await tx.itemClass.upsert({
          create: { id, isActive: record.is_active !== false, name: text(record.name) },
          update: { isActive: record.is_active !== false, name: text(record.name) },
          where: { id },
        }),
      );
    case "vatRates":
      return vatRateRecord(
        await tx.vatRate.upsert({
          create: { id, isActive: record.is_active !== false, rateBps: number(record.rate_bps) },
          update: { isActive: record.is_active !== false, rateBps: number(record.rate_bps) },
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

async function setMasterActiveState(
  tx: Tx,
  entity: MasterEntity,
  id: string,
  isActive: boolean,
) {
  switch (entity) {
    case "accounts":
      await tx.account.update({ data: { isActive }, where: { id } });
      return;
    case "projects":
      await tx.project.update({ data: { isActive }, where: { id } });
      return;
    case "warehouses":
      await tx.warehouse.update({ data: { isActive }, where: { id } });
      return;
    case "units":
      await tx.unit.update({ data: { isActive }, where: { id } });
      return;
    case "itemClasses":
      await tx.itemClass.update({ data: { isActive }, where: { id } });
      return;
    case "vatRates":
      await tx.vatRate.update({ data: { isActive }, where: { id } });
      return;
    case "items":
      await tx.item.update({ data: { isActive }, where: { id } });
  }
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

async function assertCanSetActiveState(
  tx: Tx,
  entity: MasterEntity,
  existing: DataRecord,
  nextIsActive: boolean,
) {
  const currentIsActive = existing.is_active !== false;

  if (nextIsActive || !currentIsActive) {
    return;
  }

  switch (entity) {
    case "accounts": {
      const balance = await getAccountBalanceMinor(text(existing.id), tx);

      if (balance !== 0) {
        throw new Error("Bakiyesi olan cari pasife alinamaz");
      }

      const draftCount = await Promise.all([
        tx.deliveryNote.count({
          where: { accountId: text(existing.id), status: "DRAFT" },
        }),
        tx.invoice.count({
          where: { accountId: text(existing.id), status: "DRAFT" },
        }),
        tx.receipt.count({
          where: { accountId: text(existing.id), status: "DRAFT" },
        }),
        tx.transfer.count({
          where: {
            status: "DRAFT",
            OR: [
              { fromAccountId: text(existing.id) },
              { toAccountId: text(existing.id) },
            ],
          },
        }),
      ]);

      if (draftCount.some((count) => count > 0)) {
        throw new Error("Taslak baglantisi olan cari pasife alinamaz");
      }

      return;
    }
    case "warehouses": {
      const stock = await getWarehouseStockQuantity(text(existing.id), tx);

      if (Math.abs(stock) > 0.000001) {
        throw new Error("Stok bulunan depo pasife alinamaz");
      }

      const draftCount = await Promise.all([
        tx.deliveryNote.count({
          where: { status: "DRAFT", warehouseId: text(existing.id) },
        }),
        tx.invoice.count({
          where: { status: "DRAFT", warehouseId: text(existing.id) },
        }),
        tx.stockCount.count({
          where: { status: "DRAFT", warehouseId: text(existing.id) },
        }),
      ]);

      if (draftCount.some((count) => count > 0)) {
        throw new Error("Taslak baglantisi olan depo pasife alinamaz");
      }

      return;
    }
    case "items": {
      const stock = await getItemStockQuantity(text(existing.id), tx);

      if (Math.abs(stock) > 0.000001) {
        throw new Error("Stogu bulunan malzeme pasife alinamaz");
      }

      const draftCount = await Promise.all([
        tx.deliveryNoteLine.count({
          where: { itemId: text(existing.id), deliveryNote: { status: "DRAFT" } },
        }),
        tx.invoiceLine.count({
          where: { itemId: text(existing.id), invoice: { status: "DRAFT" } },
        }),
        tx.stockCountLine.count({
          where: { itemId: text(existing.id), stockCount: { status: "DRAFT" } },
        }),
      ]);

      if (draftCount.some((count) => count > 0)) {
        throw new Error("Taslak baglantisi olan malzeme pasife alinamaz");
      }

      return;
    }
    default:
      return;
  }
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

async function getAccountBalanceMinor(accountId: string, tx: Tx = prisma) {
  const [debit, credit] = await Promise.all([
    tx.accountLedgerEntry.aggregate({
      _sum: { debitMinor: true },
      where: { accountId },
    }),
    tx.accountLedgerEntry.aggregate({
      _sum: { creditMinor: true },
      where: { accountId },
    }),
  ]);

  return (debit._sum.debitMinor ?? 0) - (credit._sum.creditMinor ?? 0);
}

async function getItemStockQuantity(itemId: string, tx: Tx = prisma) {
  const [qtyIn, qtyOut] = await Promise.all([
    tx.stockMovement.aggregate({ _sum: { qtyIn: true }, where: { itemId } }),
    tx.stockMovement.aggregate({ _sum: { qtyOut: true }, where: { itemId } }),
  ]);

  return number(qtyIn._sum.qtyIn) - number(qtyOut._sum.qtyOut);
}

async function getWarehouseStockQuantity(warehouseId: string, tx: Tx = prisma) {
  const [qtyIn, qtyOut] = await Promise.all([
    tx.stockMovement.aggregate({ _sum: { qtyIn: true }, where: { warehouseId } }),
    tx.stockMovement.aggregate({ _sum: { qtyOut: true }, where: { warehouseId } }),
  ]);

  return number(qtyIn._sum.qtyIn) - number(qtyOut._sum.qtyOut);
}

function buildAccountWhere(query: ListQuery): Prisma.AccountWhereInput {
  const search = normalizedSearch(query.search);
  const where: Prisma.AccountWhereInput = {};

  if (query.status === "ACTIVE") {
    where.isActive = true;
  } else if (query.status === "PASSIVE") {
    where.isActive = false;
  }

  if (search) {
    where.OR = [
      { code: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
    ];
  }

  return where;
}

function buildProjectWhere(query: ListQuery): Prisma.ProjectWhereInput {
  const search = normalizedSearch(query.search);
  const where: Prisma.ProjectWhereInput = {};

  if (query.accountId) {
    where.accountId = query.accountId;
  }

  if (query.status === "ACTIVE") {
    where.isActive = true;
  } else if (query.status === "PASSIVE") {
    where.isActive = false;
  }

  if (search) {
    where.OR = [
      { code: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
      { account: { code: { contains: search, mode: "insensitive" } } },
      { account: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  return where;
}

function buildWarehouseWhere(query: ListQuery): Prisma.WarehouseWhereInput {
  const search = normalizedSearch(query.search);
  const where: Prisma.WarehouseWhereInput = {};

  if (query.status === "ACTIVE") {
    where.isActive = true;
  } else if (query.status === "PASSIVE") {
    where.isActive = false;
  }

  if (search) {
    where.OR = [
      { code: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
    ];
  }

  return where;
}

function buildNamedEntityWhere(query: ListQuery): { name?: { contains: string; mode: "insensitive" } } {
  const search = normalizedSearch(query.search);
  const where: { isActive?: boolean; name?: { contains: string; mode: "insensitive" } } = {};

  if (query.status === "ACTIVE") {
    where.isActive = true;
  } else if (query.status === "PASSIVE") {
    where.isActive = false;
  }

  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }

  return where;
}

function buildVatRateWhere(query: ListQuery): Prisma.VatRateWhereInput {
  const search = normalizedSearch(query.search);
  const where: Prisma.VatRateWhereInput = {};

  if (query.status === "ACTIVE") {
    where.isActive = true;
  } else if (query.status === "PASSIVE") {
    where.isActive = false;
  }

  if (!search) {
    return where;
  }

  const numeric = Number(search.replace(",", "."));

  return Number.isFinite(numeric)
    ? { ...where, rateBps: Math.round(numeric * 100) }
    : where;
}

function buildItemWhere(query: ListQuery): Prisma.ItemWhereInput {
  const search = normalizedSearch(query.search);
  const where: Prisma.ItemWhereInput = {};

  if (query.status === "ACTIVE") {
    where.isActive = true;
  } else if (query.status === "PASSIVE") {
    where.isActive = false;
  }

  if (search) {
    where.OR = [
      { code: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
      { itemClass: { name: { contains: search, mode: "insensitive" } } },
      { unit: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  return where;
}

function normalizedSearch(value: string | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
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
    case "units":
    case "itemClasses":
    case "vatRates":
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

function unitRecord(row: {
  createdAt: Date;
  id: string;
  isActive: boolean;
  name: string;
  updatedAt: Date;
}): DataRecord {
  return {
    created_at: isoString(row.createdAt),
    id: row.id,
    is_active: row.isActive,
    name: row.name,
    updated_at: isoString(row.updatedAt),
  };
}

function itemClassRecord(row: {
  createdAt: Date;
  id: string;
  isActive: boolean;
  name: string;
  updatedAt: Date;
}): DataRecord {
  return unitRecord(row);
}

function vatRateRecord(row: {
  createdAt: Date;
  id: string;
  isActive: boolean;
  rateBps: number;
  updatedAt: Date;
}): DataRecord {
  return {
    created_at: isoString(row.createdAt),
    id: row.id,
    is_active: row.isActive,
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
