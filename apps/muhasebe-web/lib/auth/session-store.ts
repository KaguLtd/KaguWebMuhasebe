import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db";

import type { AuthPermission } from "./permissions";
import { ADMIN_ROLE_KEY, ADMIN_ROLE_PERMISSIONS } from "./permissions";
import { hashSessionToken } from "./session";

const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

const sessionUserInclude = {
  user: {
    include: {
      roles: {
        include: {
          role: { include: { permissions: { include: { permission: true } } } },
        },
      },
    },
  },
} satisfies Prisma.SessionInclude;

type SessionWithUser = Prisma.SessionGetPayload<{ include: typeof sessionUserInclude }>;

export type SessionUser = {
  id: string;
  isActive: boolean;
  permissions: AuthPermission[];
  roles: string[];
  username: string;
};

export async function getSessionUserByToken(
  token: string | null | undefined,
  options: { touch?: boolean } = {},
) {
  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    include: sessionUserInclude,
    where: { tokenHash: hashSessionToken(token) },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now() || !session.user.isActive) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  if (options.touch !== false && shouldTouchSession(session.lastSeenAt)) {
    await prisma.session
      .update({
        data: { lastSeenAt: new Date() },
        where: { id: session.id },
      })
      .catch(() => undefined);
  }

  return toSessionUser(session);
}

export async function revokeSessionToken(token: string | null | undefined) {
  if (!token) {
    return;
  }

  await prisma.session
    .deleteMany({ where: { tokenHash: hashSessionToken(token) } })
    .catch(() => undefined);
}

function shouldTouchSession(lastSeenAt: Date) {
  return Date.now() - lastSeenAt.getTime() >= SESSION_TOUCH_INTERVAL_MS;
}

function toSessionUser(session: SessionWithUser) {
  const roles = session.user.roles.map((membership) => membership.role.key);
  const permissions = new Set<AuthPermission>();

  if (roles.includes(ADMIN_ROLE_KEY)) {
    for (const permission of ADMIN_ROLE_PERMISSIONS) {
      permissions.add(permission);
    }
  }

  for (const membership of session.user.roles) {
    for (const assignment of membership.role.permissions ?? []) {
      permissions.add(assignment.permission.key as AuthPermission);
    }
  }

  return {
    id: session.user.id,
    isActive: session.user.isActive,
    permissions: [...permissions],
    roles,
    username: session.user.username,
  };
}
