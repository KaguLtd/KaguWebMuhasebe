import { NextResponse } from "next/server";

import { getDbAccountStatementReport } from "@/lib/kagu/report-repository";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const params = new URL(request.url).searchParams;
  const report = await getDbAccountStatementReport(
    id,
    params.get("dateFrom") ?? undefined,
    params.get("dateTo") ?? undefined,
  );

  if (!report) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return NextResponse.json(report);
}
