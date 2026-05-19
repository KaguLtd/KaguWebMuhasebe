import { PrismaClient } from "@prisma/client";

import {
  DEFAULT_ADMIN_USERNAME,
  ensureAdminPermissions,
  ensureAdminRole,
  ensureAdminUser,
  ensureDefaultAdminUser,
} from "./admin-bootstrap-shared.mjs";

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME?.trim() || DEFAULT_ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD?.trim();
  const fullName = process.env.ADMIN_FULL_NAME;

  const adminRole = await ensureAdminRole(prisma);
  console.log("ADMIN role ready");

  await ensureAdminPermissions(prisma, adminRole.id);
  console.log("permissions synced");

  if (password) {
    await ensureAdminUser(prisma, {
      adminRoleId: adminRole.id,
      fullName,
      password,
      username,
    });
  } else {
    await ensureDefaultAdminUser(prisma, {
      adminRoleId: adminRole.id,
      displayName: fullName?.trim() || undefined,
      username,
    });
  }

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
