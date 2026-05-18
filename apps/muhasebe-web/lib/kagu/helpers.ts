import type { Currency, LookupEntity, LookupItem } from "./contracts";

const numberFormatter = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 2,
});

const moneyFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function camelToSnake(value: string) {
  return value.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
}

export function snakeToCamel(value: string) {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

export function formatMinor(value: unknown, currency?: Currency | string | null) {
  const minor = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const formatted = moneyFormatter.format(minor / 100);

  return currency ? `${formatted} ${currency}` : formatted;
}

export function parseMoneyToMinor(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100);
  }

  if (typeof value !== "string") {
    return 0;
  }

  let normalized = value.trim().replace(/[^\d,.-]/g, "");

  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if ((normalized.match(/\./g) ?? []).length > 1) {
    normalized = normalized.replace(/\./g, "");
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export function formatMoneyInput(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const numberValue =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : 0;

  return moneyFormatter.format(Number.isFinite(numberValue) ? numberValue : 0);
}

export function parseFormattedMoneyInput(value: string | undefined) {
  if (!value) {
    return 0;
  }

  let normalized = value.trim().replace(/[^\d,.-]/g, "");

  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if ((normalized.match(/\./g) ?? []).length > 1) {
    normalized = normalized.replace(/\./g, "");
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatDate(value: unknown) {
  const date = parseDateValue(value);

  return date ? dateFormatter.format(date) : "-";
}

export function formatDateTime(value: unknown) {
  const date = parseDateValue(value);

  return date ? dateTimeFormatter.format(date) : "-";
}

export function formatRateBps(value: unknown) {
  const bps = typeof value === "number" && Number.isFinite(value) ? value : 0;

  return `${numberFormatter.format(bps / 100)}%`;
}

export function formatQuantity(value: unknown) {
  const numberValue =
    typeof value === "number" && Number.isFinite(value) ? value : 0;

  return numberFormatter.format(numberValue);
}

export function formatBoolean(value: unknown) {
  return value === false ? "Pasif" : "Aktif";
}

export function humanizeEnum(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .split("_")
    .map((part) => `${part.slice(0, 1)}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

export function selectableLookupOptions(
  items: LookupItem[] | undefined,
  currentValue?: unknown,
) {
  const currentId = typeof currentValue === "string" ? currentValue : null;

  return (items ?? [])
    .filter((item) => item.isActive !== false || item.id === currentId)
    .map((item) => ({
      label: item.isActive === false ? `${item.label} (Pasif)` : item.label,
      value: item.id,
    }));
}

export const relationLookupByColumn: Partial<Record<string, LookupEntity>> = {
  account_id: "accounts",
  from_account_id: "accounts",
  to_account_id: "accounts",
  project_id: "projects",
  warehouse_id: "warehouses",
  unit_id: "units",
  class_id: "itemClasses",
  default_vat_rate_id: "vatRates",
};

function parseDateValue(value: unknown) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00`
    : value;
  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? null : date;
}
