import type {
  Currency,
  DataRecord,
  DocumentDetail,
  DocumentEntity,
  DocumentLinePayload,
  DocumentPayload,
} from "./contracts";
import { getMaster } from "./store";

type HeaderLike = DocumentPayload | DataRecord;
type LineLike = DocumentLinePayload | DataRecord;

export function assertDraftDocumentRules(
  entity: DocumentEntity,
  payload: DocumentPayload,
) {
  applyDocumentRules(entity, payload, payload.lines ?? []);
}

export function assertStoredDocumentRules(
  entity: DocumentEntity,
  detail: DocumentDetail<DataRecord>,
) {
  applyDocumentRules(entity, detail.header, detail.lines);
}

function applyDocumentRules(
  entity: DocumentEntity,
  header: HeaderLike,
  lines: LineLike[],
) {
  if (entity === "deliveryNotes" || entity === "invoices" || entity === "receipts") {
    assertSingleAccountDocument(entity, header, lines);
    return;
  }

  assertTransferDocument(header);
}

function assertSingleAccountDocument(
  entity: DocumentEntity,
  header: HeaderLike,
  lines: LineLike[],
) {
  const accountId = text(read(header, "accountId", "account_id"));

  if (!accountId) {
    return;
  }

  const account = getMaster("accounts", accountId);
  const expectedCurrency = currency(account?.currency);
  const projectId = text(read(header, "projectId", "project_id"));

  if (projectId) {
    assertProjectBelongsToAccount(projectId, accountId);
  }

  if (entity === "invoices" || entity === "receipts") {
    const providedCurrency = currency(read(header, "currency"));

    if (providedCurrency !== expectedCurrency) {
      throw new Error(currencyLockMessage(expectedCurrency));
    }

    return;
  }

  for (const line of lines) {
    const providedCurrency = currency(read(line, "currency"));

    if (providedCurrency !== expectedCurrency) {
      throw new Error(currencyLockMessage(expectedCurrency));
    }
  }
}

function assertTransferDocument(header: HeaderLike) {
  const fromAccountId = text(read(header, "fromAccountId", "from_account_id"));
  const toAccountId = text(read(header, "toAccountId", "to_account_id"));

  if (!fromAccountId) {
    return;
  }

  const fromCurrency = currency(getMaster("accounts", fromAccountId)?.currency);
  const providedCurrency = currency(read(header, "currency"));

  if (providedCurrency !== fromCurrency) {
    throw new Error(currencyLockMessage(fromCurrency));
  }

  if (!toAccountId) {
    return;
  }

  const toCurrency = currency(getMaster("accounts", toAccountId)?.currency);

  if (toCurrency === fromCurrency) {
    return;
  }

  if (
    number(read(header, "crossRate", "cross_rate")) <= 0 &&
    number(read(header, "targetAmountMinor", "target_amount_minor")) <= 0
  ) {
    throw new Error("Farkli dovizli virman icin capraz kur zorunludur");
  }
}

function assertProjectBelongsToAccount(projectId: string, accountId: string) {
  const project = getMaster("projects", projectId);

  if (!project) {
    return;
  }

  if (project.account_id !== accountId) {
    throw new Error("Secilen proje bu cariye bagli degil");
  }
}

function currencyLockMessage(expectedCurrency: Currency) {
  return `Cari doviz kuru ${expectedCurrency}. Bu caride sadece ${expectedCurrency} ile islem yapilabilir.`;
}

function read(record: HeaderLike | LineLike, camelKey: string, snakeKey = camelKey) {
  return record[camelKey] ?? record[snakeKey];
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function currency(value: unknown): Currency {
  return value === "USD" || value === "EUR" || value === "GBP" ? value : "TRY";
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
