"use client";

import { LinkOutlined, LockOutlined } from "@ant-design/icons";
import { Space, Tag, Tooltip } from "antd";

type DocumentTagRecord = Record<string, unknown> & {
  direction?: unknown;
  invoice_kind?: unknown;
  invoiceKind?: unknown;
  invoiced_by_invoice_id?: unknown;
  invoicedByInvoiceId?: unknown;
  is_effective?: unknown;
  is_return?: unknown;
  isEffective?: unknown;
  isReturn?: unknown;
  merge_role?: unknown;
  mergeRole?: unknown;
  status?: unknown;
};

type Tone =
  | "draft"
  | "muted"
  | "neutral"
  | "purchase"
  | "purchase-soft"
  | "sales"
  | "sales-soft";

function toneClass(tone: Tone) {
  return `kagu-tag kagu-tag-${tone}`;
}

function valueText(value: unknown) {
  return String(value ?? "").trim();
}

function isTrue(value: unknown) {
  return value === true || value === "true" || value === "TRUE" || value === 1;
}

function enumFallback(value: unknown) {
  const raw = valueText(value);

  if (!raw) {
    return "-";
  }

  return raw
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function mergeRole(record: DocumentTagRecord) {
  return valueText(record.merge_role ?? record.mergeRole ?? "NORMAL");
}

function isEffective(record: DocumentTagRecord) {
  return record.is_effective ?? record.isEffective;
}

function invoicedByInvoiceId(record: DocumentTagRecord) {
  return record.invoiced_by_invoice_id ?? record.invoicedByInvoiceId;
}

export function isMutedDocumentRecord(record: DocumentTagRecord) {
  return (
    record.status === "VOID" ||
    record.status === "SUPERSEDED" ||
    mergeRole(record) === "MERGED_SOURCE" ||
    Boolean(invoicedByInvoiceId(record)) ||
    isEffective(record) === false
  );
}

export function documentStatusLabel(status: unknown) {
  const normalized = valueText(status);

  if (normalized === "DRAFT") {
    return "Taslak";
  }

  if (normalized === "APPROVED") {
    return "Onaylı";
  }

  if (normalized === "VOID") {
    return "İptal";
  }

  if (normalized === "SUPERSEDED") {
    return "Değiştirildi";
  }

  return enumFallback(status);
}

export function invoiceKindLabel(invoiceKind: unknown) {
  const normalized = valueText(invoiceKind);

  if (normalized === "SALES") {
    return "Satış";
  }

  if (normalized === "PURCHASE") {
    return "Alış";
  }

  return enumFallback(invoiceKind);
}

export function deliveryMovementLabel(direction: unknown, isReturn: unknown) {
  const normalized = valueText(direction);
  const returnMovement = isTrue(isReturn);

  if (normalized === "OUT") {
    return returnMovement ? "Çıkış İade" : "Çıkış";
  }

  if (normalized === "IN") {
    return returnMovement ? "Giriş İade" : "Giriş";
  }

  return enumFallback(direction);
}

export function tagClassForDocument(record: DocumentTagRecord) {
  if (isMutedDocumentRecord(record)) {
    return toneClass("muted");
  }

  const invoiceKind = valueText(record.invoice_kind ?? record.invoiceKind);

  if (invoiceKind === "SALES") {
    return toneClass("sales");
  }

  if (invoiceKind === "PURCHASE") {
    return toneClass("purchase");
  }

  const direction = valueText(record.direction);

  if (direction === "OUT") {
    return toneClass(isTrue(record.is_return ?? record.isReturn) ? "sales-soft" : "sales");
  }

  if (direction === "IN") {
    return toneClass(isTrue(record.is_return ?? record.isReturn) ? "purchase-soft" : "purchase");
  }

  return toneClass("neutral");
}

export function DocumentStatusTag({
  muted = false,
  status,
}: {
  muted?: boolean;
  status: unknown;
}) {
  const normalized = valueText(status);
  const className =
    muted || normalized === "VOID" || normalized === "SUPERSEDED"
      ? toneClass("muted")
      : normalized === "DRAFT"
        ? toneClass("draft")
        : toneClass("neutral");

  return <Tag className={className}>{documentStatusLabel(status)}</Tag>;
}

export function InvoiceKindTag({
  invoiceKind,
  muted = false,
}: {
  invoiceKind: unknown;
  muted?: boolean;
}) {
  const normalized = valueText(invoiceKind);
  const className = muted
    ? toneClass("muted")
    : normalized === "SALES"
      ? toneClass("sales")
      : normalized === "PURCHASE"
        ? toneClass("purchase")
        : toneClass("neutral");

  return <Tag className={className}>{invoiceKindLabel(invoiceKind)}</Tag>;
}

export function DeliveryMovementTag({
  direction,
  isReturn,
  muted = false,
}: {
  direction: unknown;
  isReturn: unknown;
  muted?: boolean;
}) {
  const normalized = valueText(direction);
  const returnMovement = isTrue(isReturn);
  const className = muted
    ? toneClass("muted")
    : normalized === "OUT"
      ? toneClass(returnMovement ? "sales-soft" : "sales")
      : normalized === "IN"
        ? toneClass(returnMovement ? "purchase-soft" : "purchase")
        : toneClass("neutral");

  return <Tag className={className}>{deliveryMovementLabel(direction, isReturn)}</Tag>;
}

export function DeliveryRoleTag({ record }: { record: DocumentTagRecord }) {
  const role = mergeRole(record);
  const invoiced = Boolean(invoicedByInvoiceId(record));
  const muted =
    record.status === "VOID" ||
    record.status === "SUPERSEDED" ||
    role === "MERGED_SOURCE" ||
    invoiced ||
    isEffective(record) === false;

  if (invoiced && role === "MERGED_RESULT") {
    return <Tag className={toneClass("muted")}>F/B-İrsaliye</Tag>;
  }

  if (invoiced) {
    return <Tag className={toneClass("muted")}>F-İrsaliye</Tag>;
  }

  if (role === "MERGED_RESULT") {
    const direction = valueText(record.direction);
    const className = muted
      ? toneClass("muted")
      : direction === "OUT"
        ? toneClass("sales")
        : direction === "IN"
          ? toneClass("purchase")
          : toneClass("neutral");

    return <Tag className={className}>B-İrsaliye</Tag>;
  }

  if (role === "MERGED_SOURCE") {
    return <Tag className={toneClass("muted")}>K-İrsaliye</Tag>;
  }

  return <Tag className={muted ? toneClass("muted") : toneClass("neutral")}>Normal</Tag>;
}

export function StockEffectTag({
  compact = false,
  isEffective,
}: {
  compact?: boolean;
  isEffective: unknown;
}) {
  const effective = isEffective !== false;
  const content = (
    <span className="kagu-stock-effect">
      <span
        aria-hidden="true"
        className={`kagu-stock-dot ${
          effective ? "kagu-stock-dot-effective" : "kagu-stock-dot-muted"
        }`}
      />
      {compact ? null : <span>{effective ? "Etkili" : "Etkisiz"}</span>}
    </span>
  );

  if (compact) {
    return <Tooltip title={effective ? "Etkili" : "Etkisiz"}>{content}</Tooltip>;
  }

  return content;
}

export function SourceLineTag({
  linked = false,
  showManual = true,
}: {
  linked?: boolean;
  showManual?: boolean;
}) {
  if (!linked) {
    return showManual ? <Tag className={toneClass("neutral")}>Manuel</Tag> : null;
  }

  return (
    <Tag className={toneClass("muted")}>
      <Space size={4}>
        <LinkOutlined />
        <LockOutlined />
        İrs.
      </Space>
    </Tag>
  );
}

export function DocumentSourceRoleTag({
  muted = false,
  sourceRole,
}: {
  muted?: boolean;
  sourceRole: unknown;
}) {
  const role = valueText(sourceRole);
  const mutedClass = toneClass("muted");

  if (role === "Satis Faturasi" || role === "Satış Faturası") {
    return <Tag className={muted ? mutedClass : toneClass("sales")}>Satış Faturası</Tag>;
  }

  if (role === "Alis Faturasi" || role === "Alış Faturası") {
    return <Tag className={muted ? mutedClass : toneClass("purchase")}>Alış Faturası</Tag>;
  }

  if (role === "B-Irsaliye" || role === "B-İrsaliye") {
    return <Tag className={muted ? mutedClass : toneClass("neutral")}>B-İrsaliye</Tag>;
  }

  if (role === "K-Irsaliye" || role === "K-İrsaliye") {
    return <Tag className={toneClass("muted")}>K-İrsaliye</Tag>;
  }

  if (role === "F-Irsaliye" || role === "F-İrsaliye") {
    return <Tag className={toneClass("muted")}>F-İrsaliye</Tag>;
  }

  return <Tag className={muted ? mutedClass : toneClass("neutral")}>{role || "Normal"}</Tag>;
}
