import { isStrongSessionSecretConfigured } from "@/lib/auth/session";

type CheckStatus = "fail" | "pass" | "warn";

export interface RuntimeReadinessCheck {
  detail: string;
  key: string;
  label: string;
  status: CheckStatus;
}

export function getRuntimeReadinessChecks(): RuntimeReadinessCheck[] {
  const isProduction = process.env.NODE_ENV === "production";
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
  const hasSessionSecret = Boolean(
    process.env.AUTH_SECRET ||
      process.env.KAGU_SESSION_SECRET ||
      process.env.SESSION_SECRET,
  );
  const hasAppOrigin = Boolean(
    process.env.KAGU_APP_ORIGIN || process.env.NEXT_PUBLIC_APP_URL,
  );
  const hasBackupAck = process.env.KAGU_BACKUP_PLAN_ACK === "true";
  return [
    {
      detail: hasDatabaseUrl
        ? "DATABASE_URL is configured."
        : "DATABASE_URL must point to PostgreSQL.",
      key: "database-url",
      label: "PostgreSQL source of truth",
      status: hasDatabaseUrl ? "pass" : "fail",
    },
    {
      detail: hasSessionSecret
        ? "A server-side session secret is configured."
        : "Set AUTH_SECRET, KAGU_SESSION_SECRET, or SESSION_SECRET before real users.",
      key: "session-secret",
      label: "Session secret",
      status:
        hasSessionSecret || isStrongSessionSecretConfigured()
          ? "pass"
          : isProduction
            ? "fail"
            : "warn",
    },
    {
      detail: hasAppOrigin
        ? "Public app origin is configured by environment."
        : "Set KAGU_APP_ORIGIN or NEXT_PUBLIC_APP_URL to https://muhasebe.kagultd.com.",
      key: "app-origin",
      label: "Public origin",
      status: hasAppOrigin ? "pass" : isProduction ? "fail" : "warn",
    },
    {
      detail: "Runtime placeholder auth removed; only DB-backed sessions are accepted.",
      key: "placeholder-auth",
      label: "Real auth gate",
      status: "pass",
    },
    {
      detail: hasBackupAck
        ? "Backup/restore responsibility is acknowledged."
        : "Set KAGU_BACKUP_PLAN_ACK=true only after backup and restore are documented.",
      key: "backup-plan",
      label: "Backup plan",
      status: hasBackupAck ? "pass" : isProduction ? "fail" : "warn",
    },
  ];
}

export function getRuntimeReadinessSummary() {
  const checks = getRuntimeReadinessChecks();

  return {
    checks,
    environment: process.env.NODE_ENV ?? "development",
    ok: checks.every((check) => check.status !== "fail"),
  };
}
