import { NextResponse } from "next/server";

import { getDbInvoiceMetrics } from "@/lib/kagu/document-repository";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const metrics = await getDbInvoiceMetrics(id);

  if (!metrics) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  return NextResponse.json(metrics);
}
