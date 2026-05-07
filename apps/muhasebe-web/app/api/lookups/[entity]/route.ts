import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/server";
import { jsonBadRequest } from "@/lib/http/response";
import type { LookupEntity } from "@/lib/kagu/contracts";
import { getDbLookups, isDbMasterEntity } from "@/lib/kagu/master-repository";

type RouteContext = {
  params: Promise<{ entity: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireSessionUser();
    const { entity } = await context.params;

    if (!isDbMasterEntity(entity)) {
      return NextResponse.json({ error: "Unknown lookup entity" }, { status: 404 });
    }

    return NextResponse.json({ items: await getDbLookups(entity as LookupEntity) });
  } catch (error) {
    return jsonBadRequest(error, "Lookup verisi alinamadi");
  }
}
