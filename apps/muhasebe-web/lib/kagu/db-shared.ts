import type { Currency, DataRecord, DataValue } from "./contracts";

export function toDate(value: unknown) {
  if (value instanceof Date) {
    return value;
  }

  const text = typeof value === "string" && value ? value : today();

  return new Date(`${text.slice(0, 10)}T00:00:00.000Z`);
}

export function dateString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return typeof value === "string" ? value.slice(0, 10) : "";
}

export function isoString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return typeof value === "string" ? value : "";
}

export function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

export function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function number(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (value && typeof value === "object" && "toString" in value) {
    const parsed = Number(value.toString());

    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function currency(value: unknown): Currency {
  return value === "USD" || value === "EUR" || value === "GBP" ? value : "TRY";
}

export function cleanRecord(record: DataRecord) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => typeof value !== "undefined"),
  ) as DataRecord;
}

export function dataValue(value: unknown): DataValue {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value ?? "");
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function roundMinor(value: number) {
  return Math.round(value);
}
