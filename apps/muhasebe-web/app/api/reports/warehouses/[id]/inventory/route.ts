import { NextResponse } from "next/server";

import { getDbWarehouseInventoryReport } from "@/lib/kagu/report-repository";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const report = await getDbWarehouseInventoryReport(id);

  if (!report) {
    return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
  }

  return NextResponse.json(report);
}
