import { cookies } from "next/headers";

import { prisma } from "@/server/db";

import { verifyPassword } from "./password";
import {
  createSessionToken,
  getSessionCookieOptions,
  getSessionExpiryDate,
  hashSessionToken,
  SESSION_COOKIE,
} from "./session";
import { HttpError } from "@/lib/http/errors";

export async function loginWithPassword(username: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { username },
    include: { roles: { include: { role: true } } },
  });

  if (!user || !user.isActive) {
    throw new HttpError(401, "Kullanici adi veya sifre hatali");
  }

  const valid = await verifyPassword(password, user.passwordHash);

  if (!valid) {
    throw new HttpError(401, "Kullanici adi veya sifre hatali");
  }

  return createSessionForUser(user.id);
}

export async function createSessionForUser(userId: string) {
  const token = createSessionToken();
  const expiresAt = getSessionExpiryDate();

  await prisma.session.create({
    data: {
      expiresAt,
      tokenHash: hashSessionToken(token),
      userId,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, getSessionCookieOptions());

  return { expiresAt };
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: { include: { roles: { include: { role: true } } } } },
  });

  if (!session || session.expiresAt.getTime() <= Date.now() || !session.user.isActive) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    }

    cookieStore.delete(SESSION_COOKIE);
    return null;
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  });

  return {
    id: session.user.id,
    isActive: session.user.isActive,
    roles: session.user.roles.map((membership) => membership.role.key),
    username: session.user.username,
  };
}

export async function requireSessionUser() {
  const user = await getSessionUser();

  if (!user) {
    throw new HttpError(401, "Oturum acmaniz gerekiyor");
  }

  return user;
}

export async function requireAdminUser() {
  const user = await requireSessionUser();

  if (!user.roles.includes("ADMIN")) {
    throw new HttpError(403, "Bu islem icin admin yetkisi gerekiyor");
  }

  return user;
}

export async function logoutCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session
      .deleteMany({ where: { tokenHash: hashSessionToken(token) } })
      .catch(() => undefined);
  }

  cookieStore.delete(SESSION_COOKIE);
}
