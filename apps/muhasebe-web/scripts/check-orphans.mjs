import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const checks = [
    ["projects.account_id", await prisma.$queryRaw`
      SELECT p.id FROM projects p
      LEFT JOIN accounts a ON a.id = p.account_id
      WHERE a.id IS NULL
    `],
    ["items.unit_id", await prisma.$queryRaw`
      SELECT i.id FROM items i
      LEFT JOIN units u ON u.id = i.unit_id
      WHERE u.id IS NULL
    `],
    ["items.class_id", await prisma.$queryRaw`
      SELECT i.id FROM items i
      LEFT JOIN item_classes c ON c.id = i.class_id
      WHERE c.id IS NULL
    `],
    ["items.default_vat_rate_id", await prisma.$queryRaw`
      SELECT i.id FROM items i
      LEFT JOIN vat_rates v ON v.id = i.default_vat_rate_id
      WHERE v.id IS NULL
    `],
    ["delivery_notes.account_id", await prisma.$queryRaw`
      SELECT d.id FROM delivery_notes d
      LEFT JOIN accounts a ON a.id = d.account_id
      WHERE a.id IS NULL
    `],
    ["delivery_note_lines.item_id", await prisma.$queryRaw`
      SELECT l.id FROM delivery_note_lines l
      LEFT JOIN items i ON i.id = l.item_id
      WHERE i.id IS NULL
    `],
    ["invoices.account_id", await prisma.$queryRaw`
      SELECT i.id FROM invoices i
      LEFT JOIN accounts a ON a.id = i.account_id
      WHERE a.id IS NULL
    `],
    ["invoice_lines.item_id", await prisma.$queryRaw`
      SELECT l.id FROM invoice_lines l
      LEFT JOIN items i ON i.id = l.item_id
      WHERE i.id IS NULL
    `],
    ["receipts.account_id", await prisma.$queryRaw`
      SELECT r.id FROM receipts r
      LEFT JOIN accounts a ON a.id = r.account_id
      WHERE a.id IS NULL
    `],
    ["transfers.accounts", await prisma.$queryRaw`
      SELECT t.id FROM transfers t
      LEFT JOIN accounts af ON af.id = t.from_account_id
      LEFT JOIN accounts at ON at.id = t.to_account_id
      WHERE af.id IS NULL OR at.id IS NULL
    `],
  ];

  const findings = checks
    .map(([name, rows]) => [name, rows])
    .filter(([, rows]) => Array.isArray(rows) && rows.length > 0);

  if (!findings.length) {
    console.log("No orphan rows detected.");
    return;
  }

  console.error("Orphan rows detected:");

  for (const [name, rows] of findings) {
    console.error(`- ${name}: ${rows.length}`);
  }

  process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
