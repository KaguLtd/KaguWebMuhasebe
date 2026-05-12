import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PrismaClient } from "@prisma/client";

import {
  ensureAdminPermissions,
  ensureAdminRole,
  ensureAdminUser,
} from "./admin-bootstrap-shared.mjs";

const DEFAULT_ADMIN_FLAG = "--with-default-admin";
const LOCAL_DB_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "host.docker.internal"]);

loadEnvFiles();

const prisma = new PrismaClient();

async function main() {
  assertSafeDevSeedEnvironment();

  const adminRole = await ensureAdminRole(prisma);
  await ensureAdminPermissions(prisma, adminRole.id);
  await maybeSeedDefaultAdmin(adminRole.id);
  await seedReferenceData();

  console.log("Development seed completed.");
}

function assertSafeDevSeedEnvironment() {
  const signals = getProductionLikeSignals();

  if (signals.length === 0) {
    return;
  }

  throw new Error(
    [
      "Refusing to run dev seed against a production-like environment.",
      ...signals.map((signal) => `- ${signal}`),
      `Use this script only with a local development database; ${DEFAULT_ADMIN_FLAG} is also restricted to local development.`,
    ].join("\n"),
  );
}

function getProductionLikeSignals() {
  const signals = [];
  const nodeEnv = process.env.NODE_ENV?.trim().toLowerCase();
  const vercelEnv = process.env.VERCEL_ENV?.trim().toLowerCase();
  const appOrigin = process.env.KAGU_APP_ORIGIN || process.env.NEXT_PUBLIC_APP_URL;
  const databaseUrl = process.env.DATABASE_URL;

  if (process.argv.includes("--production")) {
    signals.push("Received explicit production mode flag.");
  }

  if (nodeEnv === "production") {
    signals.push("NODE_ENV=production.");
  }

  if (vercelEnv && vercelEnv !== "development") {
    signals.push(`VERCEL_ENV=${vercelEnv}.`);
  }

  if (process.env.CI === "true") {
    signals.push("CI=true.");
  }

  if (appOrigin?.startsWith("https://")) {
    signals.push(`Public HTTPS origin is configured (${appOrigin}).`);
  }

  if (databaseUrl && isNonLocalDatabaseUrl(databaseUrl)) {
    signals.push("DATABASE_URL points to a non-local database host.");
  }

  return signals;
}

function isNonLocalDatabaseUrl(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    return !LOCAL_DB_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return true;
  }
}

async function maybeSeedDefaultAdmin(adminRoleId) {
  if (!process.argv.includes(DEFAULT_ADMIN_FLAG)) {
    console.log(
      `Skipped default admin creation. Re-run with ${DEFAULT_ADMIN_FLAG} to create or reset admin/1234 on a local development database.`,
    );
    return;
  }

  await ensureAdminUser(prisma, {
    adminRoleId,
    email: "admin@local.test",
    fullName: "Sistem Yoneticisi",
    password: "1234",
    username: "admin",
  });

  console.log("Created or reset admin/1234 for local development.");
}

async function seedReferenceData() {
  await prisma.unit.createMany({
    data: [
      { id: "unit-adet", isActive: true, name: "ADET" },
      { id: "unit-kg", isActive: true, name: "KG" },
      { id: "unit-m", isActive: true, name: "METRE" },
    ],
    skipDuplicates: true,
  });

  await prisma.itemClass.createMany({
    data: [
      { id: "class-hammadde", isActive: true, name: "Hammadde" },
      { id: "class-mamul", isActive: true, name: "Mamul" },
      { id: "class-yardimci", isActive: true, name: "Yardimci Malzeme" },
    ],
    skipDuplicates: true,
  });

  await prisma.vatRate.createMany({
    data: [
      { id: "vat-0", isActive: true, rateBps: 0 },
      { id: "vat-10", isActive: true, rateBps: 1000 },
      { id: "vat-20", isActive: true, rateBps: 2000 },
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
}

function loadEnvFiles() {
  for (const fileName of [
    ".env.development.local",
    ".env.local",
    ".env.development",
    ".env",
  ]) {
    loadEnvFile(fileName);
  }
}

function loadEnvFile(fileName) {
  const filePath = resolve(process.cwd(), fileName);

  if (!existsSync(filePath)) {
    return;
  }

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    if (!key || process.env[key]) {
      continue;
    }

    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
