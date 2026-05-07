import { prisma } from "@/server/db";

import { hashPassword } from "@/lib/auth/password";
import { HttpError } from "@/lib/http/errors";

type AdminUserRecord = {
  displayName: string;
  email: string | null;
  id: string;
  isActive: boolean;
  passwordHash: string;
  roles: Array<{ role: { key: string }; roleId: string }>;
  sessions: Array<{ lastSeenAt: Date }>;
  username: string;
};

export async function listUsers() {
  const users = await (prisma.user.findMany as unknown as (
    args: object,
  ) => Promise<AdminUserRecord[]>)({
    include: {
      roles: { include: { role: true } },
      sessions: { orderBy: { lastSeenAt: "desc" }, take: 1 },
    },
    orderBy: { username: "asc" },
  });

  return users.map((user) => ({
    email: user.email,
    fullName: user.displayName,
    id: user.id,
    isActive: user.isActive,
    lastLoginAt: user.sessions[0]?.lastSeenAt.toISOString() ?? null,
    roleIds: user.roles.map((membership) => membership.roleId),
    roleNames: user.roles.map((membership) => membership.role.key),
    status: user.isActive ? "ACTIVE" : "PASSIVE",
    username: user.username,
  }));
}

export async function createUser(input: {
  email?: string;
  fullName: string;
  isActive: boolean;
  password: string;
  roleIds?: string[];
  username: string;
}) {
  const existing = await (prisma.user.findUnique as unknown as (
    args: object,
  ) => Promise<AdminUserRecord | null>)({ where: { username: input.username } });

  if (existing) {
    throw new HttpError(400, "Bu kullanici adi zaten kayitli");
  }

  const role = await prisma.role.findUnique({ where: { key: "ADMIN" } });

  if (!role) {
    throw new HttpError(500, "Varsayilan ADMIN rolu bulunamadi");
  }

  const roleIds = input.roleIds?.length ? input.roleIds : [role.id];
  const roles = await prisma.role.findMany({ where: { id: { in: roleIds } } });

  const passwordHash = await hashPassword(input.password);

  const user = await (prisma.user.create as unknown as (
    args: object,
  ) => Promise<AdminUserRecord>)({
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
    include: {
      roles: { include: { role: true } },
      sessions: { orderBy: { lastSeenAt: "desc" }, take: 1 },
    },
  });

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
  const current = await (prisma.user.findUnique as unknown as (
    args: object,
  ) => Promise<AdminUserRecord | null>)({ where: { id } });

  if (!current) {
    throw new HttpError(404, "Kullanici bulunamadi");
  }

  if (input.username && input.username !== current.username) {
    const existing = await (prisma.user.findUnique as unknown as (
      args: object,
    ) => Promise<AdminUserRecord | null>)({ where: { username: input.username } });

    if (existing) {
      throw new HttpError(400, "Bu kullanici adi zaten kayitli");
    }
  }

  const passwordHash = input.password ? await hashPassword(input.password) : undefined;
  const nextRoleIds =
    input.roleIds && input.roleIds.length
      ? await prisma.role.findMany({ where: { id: { in: input.roleIds } } }).then((roles) =>
          roles.map((role) => role.id),
        )
      : null;

  const user = await (prisma.user.update as unknown as (
    args: object,
  ) => Promise<AdminUserRecord>)({
    where: { id },
    data: {
      displayName: input.fullName ?? current.displayName,
      email: input.email ?? current.email,
      isActive: input.isActive ?? current.isActive,
      passwordHash: passwordHash ?? current.passwordHash,
      roles:
        nextRoleIds === null
          ? undefined
          : {
              deleteMany: {},
              create: nextRoleIds.map((roleId) => ({ roleId })),
            },
      username: input.username ?? current.username,
    },
    include: {
      roles: { include: { role: true } },
      sessions: { orderBy: { lastSeenAt: "desc" }, take: 1 },
    },
  });

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
