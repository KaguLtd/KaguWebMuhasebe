import type {
  AccountStatementReport,
  AppSnapshot,
  DataRecord,
  DocumentDetail,
  DocumentEntity,
  DocumentPayload,
  InvoiceMetrics,
  ItemMovementReport,
  ListQuery,
  LookupEntity,
  LookupItem,
  MasterEntity,
  PaginatedResult,
  SaveMasterPayload,
  SettingsRole,
  SettingsUser,
  SettingsUserPayload,
  WarehouseInventoryReport,
} from "./contracts";

export type BootstrapPayload = AppSnapshot & {
  lookups: Partial<Record<LookupEntity, LookupItem[]>>;
};

export async function fetchBootstrap() {
  return fetchJson<BootstrapPayload>("/api/bootstrap");
}

export async function fetchLookups(entity: LookupEntity) {
  const response = await fetchJson<{ items: LookupItem[] }>(`/api/lookups/${entity}`);

  return response.items;
}

export async function fetchMasters(entity: MasterEntity, query: ListQuery = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }

  const suffix = params.size ? `?${params.toString()}` : "";

  return fetchJson<PaginatedResult<DataRecord>>(`/api/master/${entity}${suffix}`);
}

export async function fetchNextMasterCode(
  entity: MasterEntity,
  query: Record<string, unknown> = {},
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }

  const suffix = params.size ? `?${params.toString()}` : "";
  const response = await fetchJson<{ code: string | null }>(
    `/api/master/${entity}/next-code${suffix}`,
  );

  return response.code;
}

export async function saveMasterRecord(
  entity: MasterEntity,
  payload: SaveMasterPayload,
) {
  const response = await fetchJson<{ item: DataRecord }>(`/api/master/${entity}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return response.item;
}

export async function fetchDocuments(entity: DocumentEntity, query: ListQuery = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }

  const suffix = params.size ? `?${params.toString()}` : "";

  return fetchJson<PaginatedResult<DataRecord>>(`/api/documents/${entity}${suffix}`);
}

export async function fetchDocumentDetail(entity: DocumentEntity, id: string) {
  return fetchJson<DocumentDetail<DataRecord>>(`/api/documents/${entity}/${id}`);
}

export async function fetchInvoiceMetrics(id: string) {
  return fetchJson<InvoiceMetrics>(`/api/documents/invoices/${id}/metrics`);
}

export async function saveDocumentDraft(
  entity: DocumentEntity,
  payload: DocumentPayload,
) {
  return fetchJson<DocumentDetail<DataRecord>>(`/api/documents/${entity}/draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function approveDocumentRecord(entity: DocumentEntity, id: string) {
  return fetchJson<DocumentDetail<DataRecord>>(`/api/documents/${entity}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
}

export async function voidDocumentRecord(
  entity: DocumentEntity,
  id: string,
  reason = "Web iptal",
) {
  return fetchJson<DocumentDetail<DataRecord>>(`/api/documents/${entity}/void`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, reason }),
  });
}

export async function fetchAccountStatement(
  accountId: string,
  query: Pick<ListQuery, "dateFrom" | "dateTo"> = {},
) {
  const params = new URLSearchParams();

  if (query.dateFrom) {
    params.set("dateFrom", query.dateFrom);
  }

  if (query.dateTo) {
    params.set("dateTo", query.dateTo);
  }

  const suffix = params.size ? `?${params.toString()}` : "";

  return fetchJson<AccountStatementReport>(
    `/api/master/accounts/${accountId}/statement${suffix}`,
  );
}

export async function fetchWarehouseInventory(warehouseId: string) {
  return fetchJson<WarehouseInventoryReport>(
    `/api/master/warehouses/${warehouseId}/inventory`,
  );
}

export async function fetchItemMovements(itemId: string) {
  return fetchJson<ItemMovementReport>(`/api/master/items/${itemId}/movements`);
}

export async function loginWithPassword(payload: {
  username: string;
  password: string;
}) {
  return fetchJson<{ ok: boolean; redirectTo?: string }>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function logoutSession() {
  return fetchJson<{ ok: boolean }>("/api/auth/logout", {
    method: "POST",
  });
}

export async function fetchSettingsUsers(query: Pick<ListQuery, "search"> = {}) {
  const params = new URLSearchParams();

  if (query.search) {
    params.set("search", query.search);
  }

  const suffix = params.size ? `?${params.toString()}` : "";
  const payload = await fetchJson<{ items?: SettingsUser[] } | SettingsUser[]>(
    `/api/settings/users${suffix}`,
  );

  return Array.isArray(payload) ? payload : (payload.items ?? []);
}

export async function createSettingsUser(payload: SettingsUserPayload) {
  const response = await fetchJson<{ item: SettingsUser }>(`/api/settings/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return response.item;
}

export async function updateSettingsUser(
  id: string,
  payload: Partial<SettingsUserPayload>,
) {
  const response = await fetchJson<{ item: SettingsUser }>(
    `/api/settings/users/${id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  return response.item;
}

export async function fetchSettingsRoles() {
  const payload = await fetchJson<{ items?: SettingsRole[] } | SettingsRole[]>(
    "/api/settings/roles",
  );

  return Array.isArray(payload) ? payload : (payload.items ?? []);
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  const responseText = await response.text();

  if (!response.ok) {
    const message = parseErrorMessage(responseText) ?? `Request failed: ${response.status}`;

    throw new Error(message);
  }

  return (responseText ? JSON.parse(responseText) : null) as T;
}

function parseErrorMessage(responseText: string) {
  if (!responseText) {
    return null;
  }

  try {
    const payload = JSON.parse(responseText) as { error?: unknown; message?: unknown };
    const message = payload.error ?? payload.message;

    return typeof message === "string" && message.trim() ? message : null;
  } catch {
    return responseText.trim() || null;
  }
}
