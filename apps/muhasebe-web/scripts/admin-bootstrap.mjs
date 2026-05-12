import { PrismaClient } from "@prisma/client";

import {
  ensureAdminPermissions,
  ensureAdminRole,
  ensureAdminUser,
} from "./admin-bootstrap-shared.mjs";

const prisma = new PrismaClient();

function requiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

async function main() {
  const username = requiredEnv("ADMIN_USERNAME");
  const password = requiredEnv("ADMIN_PASSWORD");
  const fullName = process.env.ADMIN_FULL_NAME;

  const adminRole = await ensureAdminRole(prisma);
  console.log("ADMIN role ready");

  await ensureAdminPermissions(prisma, adminRole.id);
  console.log("permissions synced");

  await ensureAdminUser(prisma, {
    adminRoleId: adminRole.id,
    fullName,
    password,
    username,
  });
  console.log(`admin user ready: ${username}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
