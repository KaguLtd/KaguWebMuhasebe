import type {
  DocumentEntity,
  DocumentPayload,
  DocumentStatus,
  ListQuery,
  MasterEntity,
  SaveMasterPayload,
} from "@/lib/kagu/contracts";

import { HttpError } from "./errors";

const DOCUMENT_STATUSES = new Set<DocumentStatus>([
  "APPROVED",
  "DRAFT",
  "SUPERSEDED",
  "VOID",
]);
const ACCOUNT_STATUSES = new Set(["ACTIVE", "PASSIVE"]);
const INVOICE_STATES = new Set(["INVOICED", "UNINVOICED"]);
const DIRECTIONS = new Set(["IN", "OUT"]);
const INVOICE_KINDS = new Set(["SALES", "PURCHASE"]);
const INVOICE_TYPES = new Set(["STANDARD", "STAR"]);
const RECEIPT_KINDS = new Set(["COLLECTION", "PAYMENT"]);
const ACCOUNT_KINDS = new Set(["CUSTOMER", "SUPPLIER", "BOTH"]);
const CURRENCIES = new Set(["TRY", "USD", "EUR", "GBP"]);

export interface LoginPayload {
  username: string;
  password: string;
}

export interface UserPayload {
  username: string;
  password?: string;
  fullName: string;
  email?: string;
  isActive: boolean;
  roleIds?: string[];
}

export function parseListQuery(request: Request): ListQuery {
  const params = new URL(request.url).searchParams;
  const status = optionalString(params.get("status"));
  const invoiceState = optionalString(params.get("invoiceState"));
  const direction = optionalString(params.get("direction"));
  const invoiceKind = optionalString(params.get("invoiceKind"));

  if (status && !DOCUMENT_STATUSES.has(status as DocumentStatus) && !ACCOUNT_STATUSES.has(status)) {
    throw new HttpError(400, "Gecersiz status filtresi");
  }

  if (invoiceState && !INVOICE_STATES.has(invoiceState)) {
    throw new HttpError(400, "Gecersiz invoiceState filtresi");
  }

  if (direction && !DIRECTIONS.has(direction)) {
    throw new HttpError(400, "Gecersiz direction filtresi");
  }

  if (invoiceKind && !INVOICE_KINDS.has(invoiceKind)) {
    throw new HttpError(400, "Gecersiz invoiceKind filtresi");
  }

  return {
    accountId: optionalString(params.get("accountId")),
    dateFrom: optionalDate(params.get("dateFrom")),
    dateTo: optionalDate(params.get("dateTo")),
    direction,
    invoiceKind,
    invoiceState: invoiceState as ListQuery["invoiceState"] | undefined,
    onlyOpenForInvoicing: params.get("onlyOpenForInvoicing") === "true",
    page: optionalInt(params.get("page"), 1, 1, 100000),
    pageSize: optionalInt(params.get("pageSize"), 20, 1, 100),
    projectId: optionalString(params.get("projectId")),
    search: optionalString(params.get("search")),
    status,
    warehouseId: optionalString(params.get("warehouseId")),
  };
}

export async function parseJsonObject(request: Request) {
  const payload = await request.json();

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new HttpError(400, "JSON body nesne olmali");
  }

  return payload as Record<string, unknown>;
}

export async function parseLoginPayload(request: Request): Promise<LoginPayload> {
  const payload = await parseJsonObject(request);

  return {
    password: requiredString(payload.password, "Sifre zorunludur"),
    username: requiredString(payload.username, "Kullanıcı adı zorunludur"),
  };
}

export async function parseUserPayload(
  request: Request,
  options: { partial?: boolean } = {},
): Promise<Partial<UserPayload> & { username?: string; password?: string }> {
  const payload = await parseJsonObject(request);
  const partial = options.partial === true;
  const result: Partial<UserPayload> & { username?: string; password?: string } = {};

  if ("username" in payload || !partial) {
    result.username = requiredString(payload.username, "Kullanıcı adı zorunludur");
  }

  if ("displayName" in payload || "fullName" in payload || !partial) {
    result.fullName = requiredString(
      payload.displayName ?? payload.fullName,
      "Gorunen ad zorunludur",
    );
  }

  if ("email" in payload && payload.email != null && payload.email !== "") {
    result.email = requiredEmail(payload.email, "Gecerli e-posta zorunludur");
  }

  if ("password" in payload) {
    result.password = requiredString(payload.password, "Sifre zorunludur");
  } else if (!partial) {
    result.password = requiredString(payload.password, "Sifre zorunludur");
  }

  if ("isActive" in payload) {
    result.isActive = requireBoolean(payload.isActive, "isActive boolean olmali");
  } else if (!partial) {
    result.isActive = true;
  }

  if ("roleIds" in payload) {
    result.roleIds = requireStringArray(payload.roleIds, "roleIds dizi olmali");
  }

  return result;
}

export async function parseMasterPayload(
  request: Request,
  entity: MasterEntity,
): Promise<SaveMasterPayload> {
  const payload = await parseJsonObject(request);

  switch (entity) {
    case "accounts":
      assertOnlyKeys(payload, ["id", "code", "name", "accountKind", "currency", "isActive"]);
      return cleanObject({
        accountKind: optionalEnum(payload.accountKind, ACCOUNT_KINDS, "Gecersiz cari tipi"),
        code: optionalStringField(payload.code),
        currency: optionalEnum(payload.currency, CURRENCIES, "Gecersiz doviz"),
        id: optionalId(payload.id),
        isActive: optionalBooleanField(payload.isActive),
        name: requiredString(payload.name, "Unvan zorunludur"),
      });
    case "projects":
      assertOnlyKeys(payload, ["id", "accountId", "code", "name", "isActive"]);
      return cleanObject({
        accountId: requiredString(payload.accountId, "Cari seçimi zorunludur"),
        code: optionalStringField(payload.code),
        id: optionalId(payload.id),
        isActive: optionalBooleanField(payload.isActive),
        name: requiredString(payload.name, "Proje adi zorunludur"),
      });
    case "warehouses":
      assertOnlyKeys(payload, ["id", "code", "name", "isActive"]);
      return cleanObject({
        code: optionalStringField(payload.code),
        id: optionalId(payload.id),
        isActive: optionalBooleanField(payload.isActive),
        name: requiredString(payload.name, "Depo adi zorunludur"),
      });
    case "units":
      assertOnlyKeys(payload, ["id", "name", "isActive"]);
      return cleanObject({
        id: optionalId(payload.id),
        isActive: optionalBooleanField(payload.isActive),
        name: requiredString(payload.name, "Birim adi zorunludur"),
      });
    case "itemClasses":
      assertOnlyKeys(payload, ["id", "name", "isActive"]);
      return cleanObject({
        id: optionalId(payload.id),
        isActive: optionalBooleanField(payload.isActive),
        name: requiredString(payload.name, "Sinif adi zorunludur"),
      });
    case "vatRates":
      assertOnlyKeys(payload, ["id", "rateBps", "isActive"]);
      return cleanObject({
        id: optionalId(payload.id),
        isActive: optionalBooleanField(payload.isActive),
        rateBps: requiredNumber(payload.rateBps, "KDV orani zorunludur", {
          integer: true,
          min: 0,
        }),
      });
    case "items":
      assertOnlyKeys(payload, [
        "id",
        "code",
        "name",
        "unitId",
        "classId",
        "defaultVatRateId",
        "isActive",
      ]);
      return cleanObject({
        classId: requiredString(payload.classId, "Sınıf seçimi zorunludur"),
        code: optionalStringField(payload.code),
        defaultVatRateId: requiredString(
          payload.defaultVatRateId,
          "Varsayılan KDV seçimi zorunludur",
        ),
        id: optionalId(payload.id),
        isActive: optionalBooleanField(payload.isActive),
        name: requiredString(payload.name, "Malzeme adi zorunludur"),
        unitId: requiredString(payload.unitId, "Birim seçimi zorunludur"),
      });
  }
}

export async function parseDocumentPayload(
  request: Request,
  entity: DocumentEntity,
): Promise<DocumentPayload> {
  const payload = await parseJsonObject(request);

  switch (entity) {
    case "deliveryNotes":
      assertOnlyKeys(payload, [
        "id",
        "direction",
        "isReturn",
        "actualDocNo",
        "accountId",
        "projectId",
        "warehouseId",
        "docDate",
        "description",
        "editReason",
        "supersedesId",
        "lines",
      ]);
      return cleanObject({
        accountId: requiredString(payload.accountId, "Cari seçimi zorunludur"),
        actualDocNo: optionalLooseString(payload.actualDocNo),
        description: optionalLooseString(payload.description),
        direction: optionalEnum(payload.direction, DIRECTIONS, "Gecersiz yon") ?? "OUT",
        docDate: optionalDateField(payload.docDate, "Gecersiz belge tarihi"),
        editReason: optionalLooseString(payload.editReason),
        id: optionalId(payload.id),
        isReturn: optionalBooleanField(payload.isReturn) ?? false,
        lines: requireDocumentLines(payload.lines, entity),
        projectId: optionalLooseString(payload.projectId),
        supersedesId: optionalLooseString(payload.supersedesId),
        warehouseId: requiredString(payload.warehouseId, "Depo seçimi zorunludur"),
      });
    case "invoices":
      assertOnlyKeys(payload, [
        "id",
        "accountId",
        "projectId",
        "invoiceKind",
        "invoiceType",
        "actualDocNo",
        "warehouseId",
        "docDate",
        "discountBps",
        "currency",
        "description",
        "editReason",
        "supersedesId",
        "lines",
      ]);
      return cleanObject({
        accountId: requiredString(payload.accountId, "Cari seçimi zorunludur"),
        actualDocNo: optionalLooseString(payload.actualDocNo),
        currency: optionalEnum(payload.currency, CURRENCIES, "Gecersiz doviz") ?? "TRY",
        description: optionalLooseString(payload.description),
        discountBps:
          optionalNumber(payload.discountBps, "Gecersiz iskonto", {
            integer: true,
            min: 0,
            max: 10000,
          }) ?? 0,
        docDate: optionalDateField(payload.docDate, "Gecersiz belge tarihi"),
        editReason: optionalLooseString(payload.editReason),
        id: optionalId(payload.id),
        invoiceKind:
          optionalEnum(payload.invoiceKind, INVOICE_KINDS, "Gecersiz fatura turu") ?? "SALES",
        invoiceType:
          optionalEnum(payload.invoiceType, INVOICE_TYPES, "Gecersiz fatura tipi") ?? "STANDARD",
        lines: requireDocumentLines(payload.lines, entity),
        projectId: optionalLooseString(payload.projectId),
        supersedesId: optionalLooseString(payload.supersedesId),
        warehouseId: optionalLooseString(payload.warehouseId),
      });
    case "receipts":
      assertOnlyKeys(payload, [
        "id",
        "receiptKind",
        "accountId",
        "projectId",
        "docDate",
        "amountMinor",
        "currency",
        "description",
        "editReason",
        "supersedesId",
      ]);
      return cleanObject({
        accountId: requiredString(payload.accountId, "Cari seçimi zorunludur"),
        amountMinor:
          optionalNumber(payload.amountMinor, "Gecersiz tutar", {
            integer: true,
            min: 0,
          }) ?? 0,
        currency: optionalEnum(payload.currency, CURRENCIES, "Gecersiz doviz") ?? "TRY",
        description: optionalLooseString(payload.description),
        docDate: optionalDateField(payload.docDate, "Gecersiz belge tarihi"),
        editReason: optionalLooseString(payload.editReason),
        id: optionalId(payload.id),
        projectId: optionalLooseString(payload.projectId),
        receiptKind:
          optionalEnum(payload.receiptKind, RECEIPT_KINDS, "Gecersiz tahsilat tipi") ??
          "COLLECTION",
        supersedesId: optionalLooseString(payload.supersedesId),
      });
    case "transfers":
      assertOnlyKeys(payload, [
        "id",
        "fromAccountId",
        "toAccountId",
        "projectId",
        "docDate",
        "amountMinor",
        "currency",
        "crossRate",
        "targetAmountMinor",
        "description",
        "editReason",
        "supersedesId",
      ]);
      return cleanObject({
        amountMinor:
          optionalNumber(payload.amountMinor, "Gecersiz tutar", {
            integer: true,
            min: 0,
          }) ?? 0,
        crossRate:
          optionalNumber(payload.crossRate, "Gecersiz capraz kur", {
            min: 0,
          }) ?? 1,
        currency: optionalEnum(payload.currency, CURRENCIES, "Gecersiz doviz") ?? "TRY",
        description: optionalLooseString(payload.description),
        docDate: optionalDateField(payload.docDate, "Gecersiz belge tarihi"),
        editReason: optionalLooseString(payload.editReason),
        fromAccountId: requiredString(
          payload.fromAccountId,
          "Çıkış cari seçimi zorunludur",
        ),
        id: optionalId(payload.id),
        projectId: optionalLooseString(payload.projectId),
        supersedesId: optionalLooseString(payload.supersedesId),
        targetAmountMinor: optionalNumber(payload.targetAmountMinor, "Gecersiz hedef tutar", {
          integer: true,
          min: 0,
        }),
        toAccountId: requiredString(payload.toAccountId, "Giriş cari seçimi zorunludur"),
      });
  }
}

export function requireStringId(value: unknown, message: string) {
  return requiredString(value, message);
}

function requireDocumentLines(value: unknown, entity: Extract<DocumentEntity, "deliveryNotes" | "invoices">) {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new HttpError(400, "Belge satirlari dizi olmali");
  }

  return value.map((line, index) => parseDocumentLine(line, entity, index));
}

function parseDocumentLine(
  value: unknown,
  entity: Extract<DocumentEntity, "deliveryNotes" | "invoices">,
  index: number,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, `${index + 1}. satir gecersiz`);
  }

  const line = value as Record<string, unknown>;
  const commonKeys = [
    "id",
    "itemId",
    "description",
    "quantity",
    "qty",
    "unitPriceMinor",
    "vatRateBps",
  ];
  const entityKeys =
    entity === "deliveryNotes"
      ? ["currency"]
      : ["deliveryNoteLineId", "discountBps", "sourceDeliveryLineIds"];

  assertOnlyKeys(line, [...commonKeys, ...entityKeys], `Belge satiri ${index + 1} gecersiz`);

  return cleanObject({
    currency:
      entity === "deliveryNotes"
        ? optionalEnum(line.currency, CURRENCIES, `${index + 1}. satir dovizi gecersiz`) ?? "TRY"
        : undefined,
    deliveryNoteLineId:
      entity === "invoices" ? optionalLooseString(line.deliveryNoteLineId) : undefined,
    description: optionalLooseString(line.description),
    discountBps:
      entity === "invoices"
        ? optionalNumber(line.discountBps, `${index + 1}. satir iskontosu gecersiz`, {
            integer: true,
            min: 0,
            max: 10000,
          }) ?? 0
        : undefined,
    id: optionalId(line.id),
    itemId: requiredString(line.itemId, `${index + 1}. satir malzemesi zorunludur`),
    quantity: requiredNumber(
      line.quantity ?? line.qty,
      `${index + 1}. satir miktari zorunludur`,
      { minExclusive: 0 },
    ),
    sourceDeliveryLineIds:
      entity === "invoices" && line.sourceDeliveryLineIds != null
        ? requireStringArray(
            line.sourceDeliveryLineIds,
            `${index + 1}. satir kaynak irsaliye baglantilari gecersiz`,
          )
        : undefined,
    unitPriceMinor: requiredNumber(
      line.unitPriceMinor,
      `${index + 1}. satir birim fiyati zorunludur`,
      { integer: true, min: 0 },
    ),
    vatRateBps:
      optionalNumber(line.vatRateBps, `${index + 1}. satir KDV orani gecersiz`, {
        integer: true,
        min: 0,
        max: 10000,
      }) ?? 0,
  });
}

function requiredString(value: unknown, message: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, message);
  }

  return value.trim();
}

function optionalString(value: unknown) {
  if (value == null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "Beklenmeyen string degeri");
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : undefined;
}

function optionalStringField(value: unknown) {
  if (value == null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "Metin alanlari string olmali");
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : undefined;
}

function optionalLooseString(value: unknown) {
  if (value == null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "Metin alanlari string olmali");
  }

  return value.trim();
}

function optionalId(value: unknown) {
  if (value == null || value === "") {
    return undefined;
  }

  return requiredString(value, "Gecersiz kayit kimligi");
}

function optionalInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) {
  if (value == null || value === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new HttpError(400, "Gecersiz sayisal filtre");
  }

  return parsed;
}

function optionalDate(value: unknown) {
  const normalized = optionalString(value);

  if (!normalized) {
    return undefined;
  }

  return validateDateOnly(normalized);
}

function optionalDateField(value: unknown, message: string) {
  if (value == null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, message);
  }

  return validateDateOnly(value.trim(), message);
}

function requireBoolean(value: unknown, message: string) {
  if (typeof value !== "boolean") {
    throw new HttpError(400, message);
  }

  return value;
}

function optionalBooleanField(value: unknown) {
  if (value == null) {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new HttpError(400, "Boolean alanlar true/false olmali");
}

function requiredEmail(value: unknown, message: string) {
  const email = requiredString(value, message);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, message);
  }

  return email;
}

function requireStringArray(value: unknown, message: string) {
  if (!Array.isArray(value)) {
    throw new HttpError(400, message);
  }

  return value.map((item) => requiredString(item, message));
}

function requiredNumber(
  value: unknown,
  message: string,
  options: {
    integer?: boolean;
    max?: number;
    min?: number;
    minExclusive?: number;
  } = {},
) {
  const parsed = parseNumber(value, message);

  validateNumber(parsed, message, options);

  return parsed;
}

function optionalNumber(
  value: unknown,
  message: string,
  options: {
    integer?: boolean;
    max?: number;
    min?: number;
    minExclusive?: number;
  } = {},
) {
  if (value == null || value === "") {
    return undefined;
  }

  const parsed = parseNumber(value, message);

  validateNumber(parsed, message, options);

  return parsed;
}

function optionalEnum<T extends string>(
  value: unknown,
  values: Set<T>,
  message: string,
) {
  if (value == null || value === "") {
    return undefined;
  }

  if (typeof value !== "string" || !values.has(value as T)) {
    throw new HttpError(400, message);
  }

  return value as T;
}

function parseNumber(value: unknown, message: string) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    throw new HttpError(400, message);
  }

  return parsed;
}

function validateNumber(
  value: number,
  message: string,
  options: {
    integer?: boolean;
    max?: number;
    min?: number;
    minExclusive?: number;
  },
) {
  if (options.integer && !Number.isInteger(value)) {
    throw new HttpError(400, message);
  }

  if (typeof options.min === "number" && value < options.min) {
    throw new HttpError(400, message);
  }

  if (typeof options.minExclusive === "number" && value <= options.minExclusive) {
    throw new HttpError(400, message);
  }

  if (typeof options.max === "number" && value > options.max) {
    throw new HttpError(400, message);
  }
}

function validateDateOnly(value: string, message = "Tarih gecersiz") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, message);
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, message);
  }

  return value;
}

function assertOnlyKeys(
  payload: Record<string, unknown>,
  allowedKeys: string[],
  message = "JSON body beklenmeyen alan iceriyor",
) {
  const allowed = new Set(allowedKeys);
  const unexpected = Object.keys(payload).filter((key) => !allowed.has(key));

  if (unexpected.length > 0) {
    throw new HttpError(400, `${message}: ${unexpected.join(", ")}`);
  }
}

function cleanObject<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => typeof entry !== "undefined"),
  ) as T;
}
