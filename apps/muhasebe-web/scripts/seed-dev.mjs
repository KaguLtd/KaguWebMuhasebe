import { randomBytes, scryptSync } from "node:crypto";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");

  return `scrypt$${salt}$${hash}`;
}

async function main() {
  const adminRole = await prisma.role.upsert({
    where: { key: "ADMIN" },
    update: { description: "Full administration access" },
    create: { key: "ADMIN", description: "Full administration access" },
  });

  await prisma.user.upsert({
    where: { username: "admin" },
    update: {
      displayName: "Sistem Yoneticisi",
      email: "admin@local.test",
      isActive: true,
      passwordHash: hashPassword("1234"),
      roles: {
        deleteMany: {},
        create: [{ roleId: adminRole.id }],
      },
    },
    create: {
      displayName: "Sistem Yoneticisi",
      email: "admin@local.test",
      isActive: true,
      passwordHash: hashPassword("1234"),
      roles: { create: [{ roleId: adminRole.id }] },
      username: "admin",
    },
  });

  await prisma.unit.createMany({
    data: [
      { id: "unit-adet", name: "ADET" },
      { id: "unit-kg", name: "KG" },
      { id: "unit-m", name: "METRE" },
    ],
    skipDuplicates: true,
  });

  await prisma.itemClass.createMany({
    data: [
      { id: "class-hammadde", name: "Hammadde" },
      { id: "class-mamul", name: "Mamul" },
      { id: "class-yardimci", name: "Yardimci Malzeme" },
    ],
    skipDuplicates: true,
  });

  await prisma.vatRate.createMany({
    data: [
      { id: "vat-0", rateBps: 0 },
      { id: "vat-10", rateBps: 1000 },
      { id: "vat-20", rateBps: 2000 },
    ],
    skipDuplicates: true,
  });

  await prisma.warehouse.createMany({
    data: [
      { code: "DEP.001", id: "warehouse-main", isActive: true, name: "Merkez Depo" },
      { code: "DEP.002", id: "warehouse-production", isActive: true, name: "Uretim Deposu" },
    ],
    skipDuplicates: true,
  });

  await prisma.account.createMany({
    data: [
      {
        accountKind: "CUSTOMER",
        code: "120.MUS.001",
        currency: "TRY",
        id: "account-customer-1",
        isActive: true,
        name: "Kagu Musteri A.S.",
      },
      {
        accountKind: "SUPPLIER",
        code: "320.TED.001",
        currency: "TRY",
        id: "account-supplier-1",
        isActive: true,
        name: "Tedarikci Ornek Ltd.",
      },
    ],
    skipDuplicates: true,
  });

  await prisma.project.createMany({
    data: [
      {
        accountId: "account-customer-1",
        code: "PRJ.001",
        id: "project-web",
        isActive: true,
        name: "Web Donusum",
      },
      {
        accountId: "account-customer-1",
        code: "PRJ.002",
        id: "project-service",
        isActive: true,
        name: "Servis Operasyon",
      },
    ],
    skipDuplicates: true,
  });

  await prisma.item.createMany({
    data: [
      {
        classId: "class-mamul",
        code: "MML_MLZ_001",
        defaultVatRateId: "vat-20",
        id: "item-erp-service",
        isActive: true,
        name: "ERP Hizmet Kalemi",
        unitId: "unit-adet",
      },
      {
        classId: "class-hammadde",
        code: "HMA_MLZ_001",
        defaultVatRateId: "vat-20",
        id: "item-raw-steel",
        isActive: true,
        name: "Sac Hammadde",
        unitId: "unit-kg",
      },
    ],
    skipDuplicates: true,
  });

  console.log("Development seed completed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
