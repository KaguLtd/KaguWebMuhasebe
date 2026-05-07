import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/server";
import { jsonBadRequest } from "@/lib/http/response";
import { parseListQuery, parseMasterPayload } from "@/lib/http/validation";
import {
  isDbMasterEntity,
  listDbMasters,
  saveDbMaster,
} from "@/lib/kagu/master-repository";

type RouteContext = {
  params: Promise<{ entity: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireSessionUser();
    const { entity } = await context.params;

    if (!isDbMasterEntity(entity)) {
      return NextResponse.json({ error: "Unknown master entity" }, { status: 404 });
    }

    return NextResponse.json(await listDbMasters(entity, parseListQuery(request)));
  } catch (error) {
    return jsonBadRequest(error, "Liste getirilemedi");
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    await requireSessionUser();
    const { entity } = await context.params;

    if (!isDbMasterEntity(entity)) {
      return NextResponse.json({ error: "Unknown master entity" }, { status: 404 });
    }

    return NextResponse.json({ item: await saveDbMaster(entity, await parseMasterPayload(request)) });
  } catch (error) {
    return jsonBadRequest(error, "Kayit saklanamadi");
  }
}
