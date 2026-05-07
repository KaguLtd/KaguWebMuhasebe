import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/server";
import { requirePermissions, routePermissions } from "@/lib/http/authorization";
import { jsonBadRequest } from "@/lib/http/response";
import { getDbInvoiceMetrics } from "@/lib/kagu/document-repository";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireSessionUser();
    const { id } = await context.params;

    await requirePermissions(
      user,
      routePermissions.documentRead("invoices"),
      "Fatura metriklerini gorme yetkiniz yok",
    );

    const metrics = await getDbInvoiceMetrics(id);

    if (!metrics) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    return NextResponse.json(metrics);
  } catch (error) {
    return jsonBadRequest(error, "Fatura metrikleri getirilemedi");
  }
}
