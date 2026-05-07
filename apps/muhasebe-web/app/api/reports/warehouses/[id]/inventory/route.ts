import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/server";
import { requirePermissions, routePermissions } from "@/lib/http/authorization";
import { jsonBadRequest } from "@/lib/http/response";
import { getDbWarehouseInventoryReport } from "@/lib/kagu/report-repository";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireSessionUser();
    const { id } = await context.params;

    await requirePermissions(
      user,
      routePermissions.reportRead("warehouseInventory"),
      "Depo envanter raporunu gorme yetkiniz yok",
    );

    const report = await getDbWarehouseInventoryReport(id);

    if (!report) {
      return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
    }

    return NextResponse.json(report);
  } catch (error) {
    return jsonBadRequest(error, "Depo envanteri getirilemedi");
  }
}
