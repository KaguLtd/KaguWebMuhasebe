import { NextResponse } from "next/server";

import type { LookupEntity } from "@/lib/kagu/contracts";
import { getDbLookups, isDbMasterEntity } from "@/lib/kagu/master-repository";

type RouteContext = {
  params: Promise<{ entity: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { entity } = await context.params;

  if (!isDbMasterEntity(entity)) {
    return NextResponse.json({ error: "Unknown lookup entity" }, { status: 404 });
  }

  return NextResponse.json({ items: await getDbLookups(entity as LookupEntity) });
}
