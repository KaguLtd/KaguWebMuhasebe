import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/server";
import { requirePermissions, routePermissions } from "@/lib/http/authorization";
import { jsonBadRequest } from "@/lib/http/response";
import { parseListQuery } from "@/lib/http/validation";
import { getDbProjectMaterialUsageReport } from "@/lib/kagu/report-repository";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireSessionUser();
    const { id } = await context.params;

    await requirePermissions(
      user,
      routePermissions.reportRead("projectMaterialUsage"),
      "Proje malzeme kullanim raporunu gorme yetkiniz yok",
    );

    const query = parseListQuery(request);
    const report = await getDbProjectMaterialUsageReport(id, {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      warehouseId: query.warehouseId,
    });

    if (!report) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(report);
  } catch (error) {
    return jsonBadRequest(error, "Proje malzeme kullanim raporu getirilemedi");
  }
}
