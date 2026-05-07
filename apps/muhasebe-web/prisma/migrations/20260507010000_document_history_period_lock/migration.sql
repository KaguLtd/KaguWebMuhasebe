-- AlterEnum
ALTER TYPE "DocumentStatus" ADD VALUE 'SUPERSEDED';

-- AlterTable
ALTER TABLE "delivery_notes"
ADD COLUMN "is_effective" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "supersedes_id" TEXT,
ADD COLUMN "superseded_by_id" TEXT,
ADD COLUMN "superseded_at" TIMESTAMP(3),
ADD COLUMN "change_note" TEXT,
ADD COLUMN "changed_by_user_id" TEXT;

-- AlterTable
ALTER TABLE "invoices"
ADD COLUMN "is_effective" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "supersedes_id" TEXT,
ADD COLUMN "superseded_by_id" TEXT,
ADD COLUMN "superseded_at" TIMESTAMP(3),
ADD COLUMN "change_note" TEXT,
ADD COLUMN "changed_by_user_id" TEXT;

-- AlterTable
ALTER TABLE "receipts"
ADD COLUMN "is_effective" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "supersedes_id" TEXT,
ADD COLUMN "superseded_by_id" TEXT,
ADD COLUMN "superseded_at" TIMESTAMP(3),
ADD COLUMN "change_note" TEXT,
ADD COLUMN "changed_by_user_id" TEXT;

-- AlterTable
ALTER TABLE "transfers"
ADD COLUMN "is_effective" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "supersedes_id" TEXT,
ADD COLUMN "superseded_by_id" TEXT,
ADD COLUMN "superseded_at" TIMESTAMP(3),
ADD COLUMN "change_note" TEXT,
ADD COLUMN "changed_by_user_id" TEXT;

-- AlterTable
ALTER TABLE "account_ledger_entries"
ADD COLUMN "related_account_id" TEXT,
ADD COLUMN "is_effective" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "cancelled_at" TIMESTAMP(3),
ADD COLUMN "replaced_by_doc_id" TEXT;

-- AlterTable
ALTER TABLE "stock_movements"
ADD COLUMN "is_effective" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "cancelled_at" TIMESTAMP(3),
ADD COLUMN "replaced_by_doc_id" TEXT;

-- CreateIndex
CREATE INDEX "delivery_notes_is_effective_status_idx" ON "delivery_notes"("is_effective", "status");
CREATE INDEX "delivery_notes_supersedes_id_idx" ON "delivery_notes"("supersedes_id");
CREATE INDEX "delivery_notes_superseded_by_id_idx" ON "delivery_notes"("superseded_by_id");
CREATE INDEX "delivery_notes_changed_by_user_id_idx" ON "delivery_notes"("changed_by_user_id");

CREATE INDEX "invoices_is_effective_status_idx" ON "invoices"("is_effective", "status");
CREATE INDEX "invoices_supersedes_id_idx" ON "invoices"("supersedes_id");
CREATE INDEX "invoices_superseded_by_id_idx" ON "invoices"("superseded_by_id");
CREATE INDEX "invoices_changed_by_user_id_idx" ON "invoices"("changed_by_user_id");

CREATE INDEX "receipts_is_effective_status_idx" ON "receipts"("is_effective", "status");
CREATE INDEX "receipts_supersedes_id_idx" ON "receipts"("supersedes_id");
CREATE INDEX "receipts_superseded_by_id_idx" ON "receipts"("superseded_by_id");
CREATE INDEX "receipts_changed_by_user_id_idx" ON "receipts"("changed_by_user_id");

CREATE INDEX "transfers_is_effective_status_idx" ON "transfers"("is_effective", "status");
CREATE INDEX "transfers_supersedes_id_idx" ON "transfers"("supersedes_id");
CREATE INDEX "transfers_superseded_by_id_idx" ON "transfers"("superseded_by_id");
CREATE INDEX "transfers_changed_by_user_id_idx" ON "transfers"("changed_by_user_id");

CREATE INDEX "account_ledger_entries_is_effective_doc_date_idx" ON "account_ledger_entries"("is_effective", "doc_date");
CREATE INDEX "account_ledger_entries_related_account_id_idx" ON "account_ledger_entries"("related_account_id");
CREATE INDEX "account_ledger_entries_replaced_by_doc_id_idx" ON "account_ledger_entries"("replaced_by_doc_id");

CREATE INDEX "stock_movements_is_effective_doc_date_idx" ON "stock_movements"("is_effective", "doc_date");
CREATE INDEX "stock_movements_replaced_by_doc_id_idx" ON "stock_movements"("replaced_by_doc_id");

-- AddForeignKey
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_supersedes_id_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "delivery_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "delivery_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_supersedes_id_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "receipts" ADD CONSTRAINT "receipts_supersedes_id_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "transfers" ADD CONSTRAINT "transfers_supersedes_id_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "account_ledger_entries" ADD CONSTRAINT "account_ledger_entries_related_account_id_fkey" FOREIGN KEY ("related_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

