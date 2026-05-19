import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db";

import { assertLastAdminAccessIsPreserved } from "@/lib/admin/guards";
import { hashPassword } from "@/lib/auth/password";
import { HttpError } from "@/lib/http/errors";

const adminUserInclude = {
  roles: { include: { role: true } },
  sessions: { orderBy: { lastSeenAt: "desc" }, take: 1 },
} satisfies Prisma.UserInclude;

type AdminUserRecord = Prisma.UserGetPayload<{ include: typeof adminUserInclude }>;

function toSettingsUser(user: AdminUserRecord) {
  return {
    email: user.email,
    fullName: user.displayName,
    id: user.id,
    isActive: user.isActive,
    lastLoginAt: user.sessions[0]?.lastSeenAt.toISOString() ?? null,
    roleIds: user.roles.map((membership) => membership.roleId),
    roleNames: user.roles.map((membership) => membership.role.key),
    status: user.isActive ? "ACTIVE" : "PASSIVE",
    username: user.username,
  };
}

export async function listUsers() {
  const users = await prisma.user.findMany({
    include: adminUserInclude,
    orderBy: { username: "asc" },
  });

  return users.map(toSettingsUser);
}

export async function createUser(input: {
  email?: string;
  fullName: string;
  isActive: boolean;
  password: string;
  roleIds?: string[];
  username: string;
}) {
  const existing = await prisma.user.findUnique({
    where: { username: input.username },
    select: { id: true },
  });

  if (existing) {
    throw new HttpError(400, "Bu kullanici adi zaten kayitli");
  }

  const role = await prisma.role.findUnique({ where: { key: "ADMIN" } });

  if (!role) {
    throw new HttpError(500, "Varsayilan ADMIN rolu bulunamadi");
  }

  const roleIds = input.roleIds?.length ? input.roleIds : [role.id];
  const roles = await prisma.role.findMany({ where: { id: { in: roleIds } } });

  if (roles.length !== roleIds.length) {
    throw new HttpError(400, "Secilen rollerin bir kismi bulunamadi");
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      displayName: input.fullName,
      email: input.email ?? null,
      isActive: input.isActive,
      passwordHash,
      roles: {
        create: roles.length
          ? roles.map((candidate) => ({ roleId: candidate.id }))
          : [{ roleId: role.id }],
      },
      username: input.username,
    },
    include: adminUserInclude,
  });

  return toSettingsUser(user);
}

export async function updateUser(
  id: string,
  input: {
    email?: string;
    fullName?: string;
    isActive?: boolean;
    password?: string;
    roleIds?: string[];
    username?: string;
  },
) {
  const current = await prisma.user.findUnique({
    where: { id },
    include: { roles: { include: { role: true } } },
  });

  if (!current) {
    throw new HttpError(404, "Kullanıcı bulunamadı");
  }

  if (input.username && input.username !== current.username) {
    const existing = await prisma.user.findUnique({
      where: { username: input.username },
      select: { id: true },
    });

    if (existing) {
      throw new HttpError(400, "Bu kullanici adi zaten kayitli");
    }
  }

  const passwordHash = input.password ? await hashPassword(input.password) : undefined;
  const nextRoles =
    input.roleIds && input.roleIds.length
      ? await prisma.role.findMany({ where: { id: { in: input.roleIds } } })
      : null;

  if (input.roleIds && nextRoles && nextRoles.length !== input.roleIds.length) {
    throw new HttpError(400, "Secilen rollerin bir kismi bulunamadi");
  }

  const currentRoleKeys = current.roles.map((membership) => membership.role.key);
  const nextRoleKeys =
    nextRoles?.map((role) => role.key) ?? current.roles.map((membership) => membership.role.key);

  await assertLastAdminAccessIsPreserved({
    currentIsActive: current.isActive,
    currentRoleKeys,
    nextIsActive: input.isActive ?? current.isActive,
    nextRoleKeys,
    userId: id,
  });

  const user = await prisma.user.update({
    where: { id },
    data: {
      displayName: input.fullName ?? current.displayName,
      email: input.email ?? current.email,
      isActive: input.isActive ?? current.isActive,
      passwordHash: passwordHash ?? current.passwordHash,
      roles:
        nextRoles === null
          ? undefined
          : {
              deleteMany: {},
              create: nextRoles.map((role) => ({ roleId: role.id })),
            },
      username: input.username ?? current.username,
    },
    include: adminUserInclude,
  });

  return toSettingsUser(user);
}

export async function listRoles() {
  const roles = await prisma.role.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: { key: "asc" },
  });

  return roles.map((role) => ({
    description: role.description,
    id: role.id,
    isSystem: true,
    key: role.key,
    name: role.key,
    userCount: role._count.users,
  }));
}
