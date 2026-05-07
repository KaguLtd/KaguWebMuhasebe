import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const productionMode =
  process.argv.includes("--production") || process.env.NODE_ENV === "production";

loadEnvFile(productionMode ? ".env.production" : ".env");

const checks = [
  {
    detail: "DATABASE_URL must point to the PostgreSQL source of truth.",
    ok: Boolean(process.env.DATABASE_URL),
    title: "PostgreSQL DATABASE_URL",
  },
  {
    detail: "Set AUTH_SECRET, KAGU_SESSION_SECRET, or SESSION_SECRET before real users.",
    ok: Boolean(
      process.env.AUTH_SECRET ||
        process.env.KAGU_SESSION_SECRET ||
        process.env.SESSION_SECRET,
    ),
    title: "Session secret",
  },
  {
    detail: "Set KAGU_APP_ORIGIN or NEXT_PUBLIC_APP_URL to the public HTTPS origin.",
    ok: Boolean(process.env.KAGU_APP_ORIGIN || process.env.NEXT_PUBLIC_APP_URL),
    title: "Public app origin",
  },
  {
    detail: "Placeholder auth must stay disabled in production.",
    ok: process.env.KAGU_ALLOW_PLACEHOLDER_AUTH !== "true",
    title: "Placeholder auth disabled",
  },
  {
    detail: "Set KAGU_BACKUP_PLAN_ACK=true only after backup and restore are documented.",
    ok: process.env.KAGU_BACKUP_PLAN_ACK === "true",
    title: "Backup/restore acknowledgement",
  },
];

const failures = checks.filter((check) => !check.ok);

for (const check of checks) {
  const mark = check.ok ? "PASS" : productionMode ? "FAIL" : "WARN";
  console.log(`${mark} ${check.title}: ${check.detail}`);
}

if (productionMode && failures.length > 0) {
  console.error(
    `Production readiness failed: ${failures.length} required check(s) did not pass.`,
  );
  process.exit(1);
}

function loadEnvFile(fileName) {
  const filePath = resolve(process.cwd(), fileName);

  if (!existsSync(filePath)) {
    return;
  }

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    if (!key || process.env[key]) {
      continue;
    }

    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}
