import { prisma } from "@/server/db";

import { HttpError } from "@/lib/http/errors";

const LOGIN_LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES = 5;

export function normalizeLoginUsername(username: string) {
  return username.trim();
}

export async function assertLoginAllowed(username: string) {
  const normalizedUsername = normalizeLoginUsername(username);

  if (!normalizedUsername) {
    return;
  }

  const user = await prisma.user.findUnique({
    include: { loginLockout: true },
    where: { username: normalizedUsername },
  });

  if (!user?.loginLockout?.lockedUntil) {
    return;
  }

  if (user.loginLockout.lockedUntil.getTime() > Date.now()) {
    throw new HttpError(
      429,
      "Cok fazla hatali giris denemesi. 15 dakika sonra tekrar deneyin.",
    );
  }
}

export async function recordLoginFailure(
  username: string,
  options: {
    ipAddress?: string | null;
    reason?: string | null;
    userAgent?: string | null;
  } = {},
) {
  const normalizedUsername = normalizeLoginUsername(username);

  if (!normalizedUsername) {
    return;
  }

  const user = await prisma.user.findUnique({
    include: { loginLockout: true },
    where: { username: normalizedUsername },
  });
  const now = new Date();
  const failureCount =
    user?.loginLockout && !isOutsideWindow(user.loginLockout.lastFailedAt)
      ? user.loginLockout.failedAttempts + 1
      : 1;
  const lockedUntil =
    failureCount >= MAX_LOGIN_FAILURES
      ? new Date(now.getTime() + LOGIN_LOCKOUT_WINDOW_MS)
      : null;

  await prisma.$transaction([
    prisma.loginAttempt.create({
      data: {
        failureReason:
          options.reason ??
          (failureCount >= MAX_LOGIN_FAILURES ? "LOCKED" : "INVALID_CREDENTIALS"),
        ipAddress: options.ipAddress ?? null,
        userAgent: options.userAgent ?? null,
        userId: user?.id ?? null,
        username: normalizedUsername,
        wasSuccessful: false,
      },
    }),
    ...(user
      ? [
          prisma.userLoginLockout.upsert({
            create: {
              failedAttempts: failureCount,
              lastAttemptAt: now,
              lastFailedAt: now,
              lockedUntil,
              userId: user.id,
            },
            update: {
              failedAttempts: failureCount,
              lastAttemptAt: now,
              lastFailedAt: now,
              lockedUntil,
            },
            where: { userId: user.id },
          }),
        ]
      : []),
  ]);
}

export async function clearLoginFailures(
  username: string,
  options: { ipAddress?: string | null; userAgent?: string | null } = {},
) {
  const normalizedUsername = normalizeLoginUsername(username);

  if (!normalizedUsername) {
    return;
  }

  const user = await prisma.user.findUnique({ where: { username: normalizedUsername } });

  await prisma.$transaction([
    prisma.loginAttempt.create({
      data: {
        ipAddress: options.ipAddress ?? null,
        userAgent: options.userAgent ?? null,
        userId: user?.id ?? null,
        username: normalizedUsername,
        wasSuccessful: true,
      },
    }),
    ...(user
      ? [
          prisma.userLoginLockout.upsert({
            create: {
              failedAttempts: 0,
              lastAttemptAt: new Date(),
              lastSuccessfulAt: new Date(),
              lockedUntil: null,
              userId: user.id,
            },
            update: {
              failedAttempts: 0,
              lastAttemptAt: new Date(),
              lastSuccessfulAt: new Date(),
              lockedUntil: null,
            },
            where: { userId: user.id },
          }),
        ]
      : []),
  ]);
}

export function getLoginAttemptMetadata(request: Request) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent"),
  };
}

function isOutsideWindow(lastFailedAt: Date | null) {
  if (!lastFailedAt) {
    return true;
  }

  return Date.now() - lastFailedAt.getTime() >= LOGIN_LOCKOUT_WINDOW_MS;
}
