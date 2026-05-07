import { cookies } from "next/headers";

import { prisma } from "@/server/db";

import { verifyPassword } from "./password";
import type { AuthPermission } from "./permissions";
import { hasPermission } from "./permissions";
import {
  createSessionToken,
  getSessionCookieOptions,
  getSessionExpiryDate,
  hashSessionToken,
  SESSION_COOKIE,
} from "./session";
import {
  assertLoginAllowed,
  clearLoginFailures,
  getLoginAttemptMetadata,
  normalizeLoginUsername,
  recordLoginFailure,
} from "./lockout";
import { getSessionUserByToken, revokeSessionToken } from "./session-store";
import { HttpError } from "@/lib/http/errors";

export async function loginWithPassword(
  username: string,
  password: string,
  request?: Request,
) {
  const normalizedUsername = normalizeLoginUsername(username);
  const metadata = request ? getLoginAttemptMetadata(request) : {};

  await assertLoginAllowed(normalizedUsername);

  const user = await prisma.user.findUnique({
    where: { username: normalizedUsername },
    include: { roles: { include: { role: true } } },
  });

  if (!user || !user.isActive) {
    await recordLoginFailure(normalizedUsername, metadata);
    throw new HttpError(401, "Kullanici adi veya sifre hatali");
  }

  const valid = await verifyPassword(password, user.passwordHash);

  if (!valid) {
    await recordLoginFailure(normalizedUsername, metadata);
    throw new HttpError(401, "Kullanici adi veya sifre hatali");
  }

  await clearLoginFailures(normalizedUsername, metadata);
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
  const user = await getSessionUserByToken(token);

  if (!user && token) {
    cookieStore.delete(SESSION_COOKIE);
  }

  return user;
}

export async function requireSessionUser() {
  const user = await getSessionUser();

  if (!user) {
    throw new HttpError(401, "Oturum acmaniz gerekiyor");
  }

  return user;
}

export async function requireAdminUser() {
  return requirePermission("users.manage");
}

export async function requirePermission(permission: AuthPermission) {
  const user = await requireSessionUser();

  if (!hasPermission(user.permissions, permission)) {
    throw new HttpError(403, "Bu islem icin yetkiniz bulunmuyor");
  }

  return user;
}

export async function logoutCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  await revokeSessionToken(token);

  cookieStore.delete(SESSION_COOKIE);
}
