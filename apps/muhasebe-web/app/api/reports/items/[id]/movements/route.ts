import { NextResponse } from "next/server";

import { getDbItemMovementReport } from "@/lib/kagu/report-repository";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const report = await getDbItemMovementReport(id);

  if (!report) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  return NextResponse.json(report);
}
