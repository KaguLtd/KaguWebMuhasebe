import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

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
