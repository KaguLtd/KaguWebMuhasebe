import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/server";
import { requirePermissions, routePermissions } from "@/lib/http/authorization";
import { jsonBadRequest } from "@/lib/http/response";
import {
  isDbMasterEntity,
  suggestDbNextCode,
} from "@/lib/kagu/master-repository";

type RouteContext = {
  params: Promise<{ entity: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireSessionUser();
    const { entity } = await context.params;

    if (!isDbMasterEntity(entity)) {
      return NextResponse.json({ error: "Unknown master entity" }, { status: 404 });
    }

    await requirePermissions(
      user,
      routePermissions.masterWrite(entity),
      "Kod onerisi alma yetkiniz yok",
    );

    const params = new URL(request.url).searchParams;
    const code = await suggestDbNextCode(entity, {
      accountKind: params.get("accountKind"),
      classId: params.get("classId"),
    });

    return NextResponse.json({ code });
  } catch (error) {
    return jsonBadRequest(error, "Kod onerisi getirilemedi");
  }
}
