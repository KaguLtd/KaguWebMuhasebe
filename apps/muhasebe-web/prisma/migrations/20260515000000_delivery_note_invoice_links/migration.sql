ALTER TABLE "delivery_notes"
  ADD COLUMN "invoiced_by_invoice_id" TEXT,
  ADD COLUMN "invoiced_at" TIMESTAMP(3);

CREATE INDEX "delivery_notes_invoiced_by_invoice_id_idx"
  ON "delivery_notes"("invoiced_by_invoice_id");

ALTER TABLE "delivery_notes"
  ADD CONSTRAINT "delivery_notes_invoiced_by_invoice_id_fkey"
  FOREIGN KEY ("invoiced_by_invoice_id")
  REFERENCES "invoices"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
