import type { Currency } from "./contracts";

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const moneyFormatter = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

const quantityFormatter = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 4,
  minimumFractionDigits: 0,
});

export function formatReportDate(value: unknown) {
  const date = parseDateValue(value);

  return date ? dateFormatter.format(date) : "-";
}

export function formatReportMoney(value: unknown, currency?: Currency | string | null) {
  const minor = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const formatted = moneyFormatter.format(minor / 100);

  return currency ? `${formatted} ${currency}` : formatted;
}

export function formatReportQuantity(value: unknown, unitLabel?: string | null) {
  const numberValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const formatted = quantityFormatter.format(numberValue);

  return unitLabel ? `${formatted} ${unitLabel}` : formatted;
}

export function formatBalanceWithSide(value: unknown, currency?: Currency | string | null) {
  const minor = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const side = minor < 0 ? "A" : "B";

  return `${formatReportMoney(Math.abs(minor), currency)} (${side})`;
}

export function invoiceKindLabel(kind: unknown) {
  return kind === "PURCHASE" ? "Alis Faturasi" : "Satis Faturasi";
}

export function receiptKindLabel(kind: unknown) {
  return kind === "PAYMENT" ? "Odeme" : "Tahsilat";
}

export function deliveryNoteLabel(input: {
  direction?: unknown;
  invoicedByInvoiceId?: string | null;
  isReturn?: boolean | null;
  mergeRole?: unknown;
}) {
  const direction = input.direction === "IN" ? "IN" : "OUT";
  const isReturn = input.isReturn === true;
  const base =
    direction === "IN"
      ? isReturn
        ? "Giris Iade Irsaliyesi"
        : "Giris Irsaliyesi"
      : isReturn
        ? "Cikis Iade Irsaliyesi"
        : "Cikis Irsaliyesi";

  if (input.invoicedByInvoiceId) {
    return `F-Irsaliye / ${base}`;
  }

  if (input.mergeRole === "MERGED_RESULT") {
    return `B-Irsaliye / ${base}`;
  }

  return base;
}

export function voucherTypeLabel(docType: string) {
  if (docType.startsWith("SALES_INVOICE")) {
    return "Satis Faturasi";
  }

  if (docType.startsWith("PURCHASE_INVOICE")) {
    return "Alis Faturasi";
  }

  if (docType === "RECEIPT_COLLECTION") {
    return "Tahsilat";
  }

  if (docType === "RECEIPT_PAYMENT") {
    return "Odeme";
  }

  if (docType === "TRANSFER") {
    return "Virman";
  }

  if (docType.startsWith("DELIVERY_NOTE")) {
    if (docType.includes("_IN")) {
      return "Giris Irsaliyesi";
    }

    if (docType.includes("_OUT")) {
      return "Cikis Irsaliyesi";
    }
  }

  return docType;
}

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
