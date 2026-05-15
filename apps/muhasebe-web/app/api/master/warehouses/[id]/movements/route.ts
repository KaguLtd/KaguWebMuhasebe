import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/server";
import { requirePermissions, routePermissions } from "@/lib/http/authorization";
import { jsonBadRequest } from "@/lib/http/response";
import { getDbWarehouseDocumentMovementReport } from "@/lib/kagu/report-repository";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireSessionUser();
    await requirePermissions(
      user,
      routePermissions.reportRead("warehouseInventory"),
      "Depo hareketleri okuma yetkiniz yok",
    );

    const { id } = await context.params;
    const report = await getDbWarehouseDocumentMovementReport(id);

    if (!report) {
      return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
    }

    return NextResponse.json(report);
  } catch (error) {
    return jsonBadRequest(error, "Warehouse movements failed");
  }
}
