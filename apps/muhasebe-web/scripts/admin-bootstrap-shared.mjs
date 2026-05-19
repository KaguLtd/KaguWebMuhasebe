import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export const DEFAULT_ADMIN_USERNAME = "ahmetcan";
export const DEFAULT_ADMIN_DISPLAY_NAME = "Ahmet Can";
export const DEFAULT_ADMIN_PASSWORD_HASH =
  "scrypt$c80a481357514f1deeddb74227ae3211$f9c457100b780fcd93af19ed715aa73cf894e1bf14106fde4a543a311705b90bfd362d49ff6f116ee2524adec80cc8cdf1bd65dc4dc06e3fd9156c0388b64ed8";

export const SYSTEM_PERMISSIONS = [
  {
    description: "Create, update, and deactivate users.",
    key: "users.manage",
  },
  {
    description: "Manage role definitions and assignments.",
    key: "roles.manage",
  },
  {
    description: "View master data records.",
    key: "masters.read",
  },
  {
    description: "Create and update master data records.",
    key: "masters.write",
  },
  {
    description: "View accounting documents.",
    key: "documents.read",
  },
  {
    description: "Create and update document drafts.",
    key: "documents.write",
  },
  {
    description: "Approve accounting documents.",
    key: "documents.approve",
  },
  {
    description: "Void accounting documents.",
    key: "documents.void",
  },
  {
    description: "View reports.",
    key: "reports.read",
  },
  {
    description: "View project reports.",
    key: "reports.projects.read",
  },
  {
    description: "View stock statement reports.",
    key: "reports.stock.statement.read",
  },
  {
    description: "View project stock movement reports.",
    key: "reports.projects.stock-movements.read",
  },
  {
    description: "View project invoice reports.",
    key: "reports.projects.invoices.read",
  },
  {
    description: "View project material usage reports.",
    key: "reports.projects.material-usage.read",
  },
  {
    description: "View project estimated margin reports.",
    key: "reports.projects.estimated-margin.read",
  },
  {
    description: "View settings.",
    key: "settings.read",
  },
];

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, KEY_LENGTH);

  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function ensureAdminRole(prisma) {
  return prisma.role.upsert({
    where: { key: "ADMIN" },
    update: {
      description: "Full administration access",
      isSystem: true,
      requiresUserAssignment: true,
    },
    create: {
      key: "ADMIN",
      description: "Full administration access",
      isSystem: true,
      requiresUserAssignment: true,
    },
  });
}

export async function ensureAdminPermissions(prisma, adminRoleId) {
  const permissions = await Promise.all(
    SYSTEM_PERMISSIONS.map((permission) =>
      prisma.permission.upsert({
        where: { key: permission.key },
        update: {
          description: permission.description,
          isSystem: true,
        },
        create: {
          key: permission.key,
          description: permission.description,
          isSystem: true,
        },
      }),
    ),
  );

  await prisma.rolePermission.createMany({
    data: permissions.map((permission) => ({
      permissionId: permission.id,
      roleId: adminRoleId,
    })),
    skipDuplicates: true,
  });

  return permissions;
}

export async function ensureAdminUser(
  prisma,
  { adminRoleId, email, fullName, password, username },
) {
  const passwordHash = await hashPassword(password);
  const displayName = fullName?.trim() || username;
  const existing = await prisma.user.findUnique({ where: { username } });
  const adminUser = existing
    ? await prisma.user.update({
        where: { username },
        data: {
          displayName,
          ...(email === undefined ? {} : { email }),
          isActive: true,
          passwordHash,
        },
      })
    : await prisma.user.create({
        data: {
          displayName,
          email: email ?? null,
          isActive: true,
          passwordHash,
          username,
        },
      });

  await prisma.userRole.createMany({
    data: [{ roleId: adminRoleId, userId: adminUser.id }],
    skipDuplicates: true,
  });

  return adminUser;
}

export async function ensureDefaultAdminUser(
  prisma,
  { adminRoleId, displayName = DEFAULT_ADMIN_DISPLAY_NAME, username = DEFAULT_ADMIN_USERNAME },
) {
  const existing = await prisma.user.findUnique({ where: { username } });
  const adminUser = existing
    ? await prisma.user.update({
        where: { username },
        data: {
          displayName: existing.displayName || displayName,
          isActive: true,
        },
      })
    : await prisma.user.create({
        data: {
          displayName,
          email: null,
          isActive: true,
          passwordHash: DEFAULT_ADMIN_PASSWORD_HASH,
          username,
        },
      });

  await prisma.userRole.createMany({
    data: [{ roleId: adminRoleId, userId: adminUser.id }],
    skipDuplicates: true,
  });

  return adminUser;
}
