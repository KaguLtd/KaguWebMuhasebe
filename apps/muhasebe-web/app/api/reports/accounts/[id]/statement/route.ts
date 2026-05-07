import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/server";
import { requirePermissions, routePermissions } from "@/lib/http/authorization";
import { jsonBadRequest } from "@/lib/http/response";
import { getDbAccountStatementReport } from "@/lib/kagu/report-repository";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireSessionUser();
    const { id } = await context.params;

    await requirePermissions(
      user,
      routePermissions.reportRead("accountStatement"),
      "Cari ekstre raporunu gorme yetkiniz yok",
    );

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
  } catch (error) {
    return jsonBadRequest(error, "Cari ekstre getirilemedi");
  }
}
