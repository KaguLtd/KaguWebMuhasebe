import { NextResponse } from "next/server";

import { prisma } from "@/server/db";
import { getRuntimeReadinessSummary } from "@/server/runtime";

export const runtime = "nodejs";

export async function GET() {
  const readiness = getRuntimeReadinessSummary();
  const database = await checkDatabase();
  const ok = readiness.ok && database.ok;

  return NextResponse.json(
    {
      database,
      readiness,
      status: ok ? "ok" : "degraded",
    },
    { status: ok ? 200 : 503 },
  );
}

async function checkDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return {
      detail: "PostgreSQL connection is healthy.",
      ok: true,
    };
  } catch {
    return {
      detail: "PostgreSQL connection failed.",
      ok: false,
    };
  }
}
