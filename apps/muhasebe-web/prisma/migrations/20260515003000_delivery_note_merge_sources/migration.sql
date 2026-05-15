CREATE TABLE "delivery_note_merge_sources" (
  "id" TEXT NOT NULL,
  "merged_delivery_note_id" TEXT NOT NULL,
  "source_delivery_note_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "delivery_note_merge_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "delivery_note_line_sources" (
  "id" TEXT NOT NULL,
  "delivery_note_line_id" TEXT NOT NULL,
  "source_delivery_note_line_id" TEXT NOT NULL,
  "signed_quantity" DECIMAL(18,4) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "delivery_note_line_sources_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "delivery_note_merge_sources_merged_delivery_note_id_source_delivery_note_id_key"
  ON "delivery_note_merge_sources"("merged_delivery_note_id", "source_delivery_note_id");

CREATE INDEX "delivery_note_merge_sources_source_delivery_note_id_idx"
  ON "delivery_note_merge_sources"("source_delivery_note_id");

CREATE UNIQUE INDEX "delivery_note_line_sources_delivery_note_line_id_source_delivery_note_line_id_key"
  ON "delivery_note_line_sources"("delivery_note_line_id", "source_delivery_note_line_id");

CREATE INDEX "delivery_note_line_sources_source_delivery_note_line_id_idx"
  ON "delivery_note_line_sources"("source_delivery_note_line_id");

ALTER TABLE "delivery_note_merge_sources"
  ADD CONSTRAINT "delivery_note_merge_sources_merged_delivery_note_id_fkey"
  FOREIGN KEY ("merged_delivery_note_id")
  REFERENCES "delivery_notes"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "delivery_note_merge_sources"
  ADD CONSTRAINT "delivery_note_merge_sources_source_delivery_note_id_fkey"
  FOREIGN KEY ("source_delivery_note_id")
  REFERENCES "delivery_notes"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "delivery_note_line_sources"
  ADD CONSTRAINT "delivery_note_line_sources_delivery_note_line_id_fkey"
  FOREIGN KEY ("delivery_note_line_id")
  REFERENCES "delivery_note_lines"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "delivery_note_line_sources"
  ADD CONSTRAINT "delivery_note_line_sources_source_delivery_note_line_id_fkey"
  FOREIGN KEY ("source_delivery_note_line_id")
  REFERENCES "delivery_note_lines"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
