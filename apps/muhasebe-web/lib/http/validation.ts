import type {
  DocumentPayload,
  DocumentStatus,
  ListQuery,
  SaveMasterPayload,
} from "@/lib/kagu/contracts";

import { HttpError } from "./errors";

const DOCUMENT_STATUSES = new Set<DocumentStatus>(["APPROVED", "DRAFT", "VOID"]);
const ACCOUNT_STATUSES = new Set(["ACTIVE", "PASSIVE"]);
const INVOICE_STATES = new Set(["INVOICED", "UNINVOICED"]);
const DIRECTIONS = new Set(["IN", "OUT"]);
const INVOICE_KINDS = new Set(["SALES", "PURCHASE"]);

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
    username: requiredString(payload.username, "Kullanici adi zorunludur"),
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
    result.username = requiredString(payload.username, "Kullanici adi zorunludur");
  }

  if ("displayName" in payload || !partial) {
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

export async function parseMasterPayload(request: Request): Promise<SaveMasterPayload> {
  return await parseJsonObject(request);
}

export async function parseDocumentPayload(request: Request): Promise<DocumentPayload> {
  return (await parseJsonObject(request)) as DocumentPayload;
}

export function requireStringId(value: unknown, message: string) {
  return requiredString(value, message);
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

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new HttpError(400, "Tarih YYYY-MM-DD formatinda olmali");
  }

  return normalized;
}

function requireBoolean(value: unknown, message: string) {
  if (typeof value !== "boolean") {
    throw new HttpError(400, message);
  }

  return value;
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
