import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/server";
import { requirePermissions, routePermissions } from "@/lib/http/authorization";
import { jsonBadRequest } from "@/lib/http/response";
import { getDbItemMovementReport } from "@/lib/kagu/report-repository";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireSessionUser();
    const { id } = await context.params;

    await requirePermissions(
      user,
      routePermissions.reportRead("itemMovements"),
      "Malzeme hareket raporunu gorme yetkiniz yok",
    );

    const report = await getDbItemMovementReport(id);

    if (!report) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json(report);
  } catch (error) {
    return jsonBadRequest(error, "Malzeme hareketleri getirilemedi");
  }
}
