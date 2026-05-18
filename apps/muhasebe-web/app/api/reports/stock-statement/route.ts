import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/server";
import { requirePermissions, routePermissions } from "@/lib/http/authorization";
import { jsonBadRequest } from "@/lib/http/response";
import { parseListQuery } from "@/lib/http/validation";
import { getDbStockStatementReport } from "@/lib/kagu/report-repository";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser();

    await requirePermissions(
      user,
      routePermissions.reportRead("stockStatement"),
      "Stok hareketleri ekstresi raporunu gorme yetkiniz yok",
    );

    const query = parseListQuery(request);
    const params = new URL(request.url).searchParams;
    const report = await getDbStockStatementReport({
      accountId: query.accountId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      itemId: params.get("itemId") ?? undefined,
      projectId: query.projectId,
      warehouseId: query.warehouseId,
    });

    return NextResponse.json(report);
  } catch (error) {
    return jsonBadRequest(error, "Stok hareketleri ekstresi getirilemedi");
  }
}
