import { NextResponse } from "next/server";

import type { ListQuery } from "@/lib/kagu/contracts";
import {
  isDbDocumentEntity,
  listDbDocuments,
} from "@/lib/kagu/document-repository";

type RouteContext = {
  params: Promise<{ entity: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { entity } = await context.params;

  if (!isDbDocumentEntity(entity)) {
    return NextResponse.json({ error: "Unknown document entity" }, { status: 404 });
  }

  return NextResponse.json(await listDbDocuments(entity, parseListQuery(request)));
}

function parseListQuery(request: Request): ListQuery {
  const params = new URL(request.url).searchParams;
  const invoiceState = params.get("invoiceState");

  return {
    search: params.get("search") ?? undefined,
    status: params.get("status") ?? undefined,
    accountId: params.get("accountId") ?? undefined,
    projectId: params.get("projectId") ?? undefined,
    warehouseId: params.get("warehouseId") ?? undefined,
    invoiceKind: params.get("invoiceKind") ?? undefined,
    invoiceState:
      invoiceState === "INVOICED" || invoiceState === "UNINVOICED"
        ? invoiceState
        : undefined,
    direction: params.get("direction") ?? undefined,
    onlyOpenForInvoicing: params.get("onlyOpenForInvoicing") === "true",
    dateFrom: params.get("dateFrom") ?? undefined,
    dateTo: params.get("dateTo") ?? undefined,
    page: Number(params.get("page") ?? 1),
    pageSize: Number(params.get("pageSize") ?? 20),
  };
}
