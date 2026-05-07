import { createHmac, randomBytes } from "node:crypto";

export const SESSION_COOKIE = "kagu_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12;
export const PLACEHOLDER_SESSION_COOKIE = SESSION_COOKIE;

export function getSessionSecret() {
  return (
    process.env.KAGU_SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.SESSION_SECRET ||
    "kagu-development-session-secret"
  );
}

export function isStrongSessionSecretConfigured() {
  return Boolean(
    process.env.KAGU_SESSION_SECRET ||
      process.env.AUTH_SECRET ||
      process.env.SESSION_SECRET,
  );
}

export function createSessionToken() {
  return randomBytes(32).toString("hex");
}

export function hashSessionToken(token: string) {
  return createHmac("sha256", getSessionSecret()).update(token).digest("hex");
}

export function getSessionExpiryDate() {
  return new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
}

export function getSessionCookieOptions() {
  const expires = getSessionExpiryDate();

  return {
    expires,
    httpOnly: true,
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export function isPlaceholderAuthEnabled() {
  return false;
}

export function isPlaceholderSession() {
  return false;
}
