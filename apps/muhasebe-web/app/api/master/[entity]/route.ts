import { NextResponse } from "next/server";

import type { ListQuery, SaveMasterPayload } from "@/lib/kagu/contracts";
import {
  isDbMasterEntity,
  listDbMasters,
  saveDbMaster,
} from "@/lib/kagu/master-repository";

type RouteContext = {
  params: Promise<{ entity: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { entity } = await context.params;

  if (!isDbMasterEntity(entity)) {
    return NextResponse.json({ error: "Unknown master entity" }, { status: 404 });
  }

  return NextResponse.json(await listDbMasters(entity, parseListQuery(request)));
}

export async function POST(request: Request, context: RouteContext) {
  const { entity } = await context.params;

  if (!isDbMasterEntity(entity)) {
    return NextResponse.json({ error: "Unknown master entity" }, { status: 404 });
  }

  try {
    const payload = (await request.json()) as SaveMasterPayload;

    return NextResponse.json({ item: await saveDbMaster(entity, payload) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kayit saklanamadi" },
      { status: 400 },
    );
  }
}

function parseListQuery(request: Request): ListQuery {
  const params = new URL(request.url).searchParams;

  return {
    search: params.get("search") ?? undefined,
    status: params.get("status") ?? undefined,
    accountId: params.get("accountId") ?? undefined,
    projectId: params.get("projectId") ?? undefined,
    warehouseId: params.get("warehouseId") ?? undefined,
    invoiceKind: params.get("invoiceKind") ?? undefined,
    direction: params.get("direction") ?? undefined,
    dateFrom: params.get("dateFrom") ?? undefined,
    dateTo: params.get("dateTo") ?? undefined,
    page: Number(params.get("page") ?? 1),
    pageSize: Number(params.get("pageSize") ?? 20),
  };
}
