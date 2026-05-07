import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/server";
import { requirePermissions, routePermissions } from "@/lib/http/authorization";
import { jsonBadRequest } from "@/lib/http/response";
import { suggestDbNextCode } from "@/lib/kagu/master-repository";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser();

    await requirePermissions(
      user,
      routePermissions.masterWrite("items"),
      "Kod onerisi alma yetkiniz yok",
    );

    const params = new URL(request.url).searchParams;

    return NextResponse.json({
      code: await suggestDbNextCode("items", {
        classId: params.get("classId"),
      }),
    });
  } catch (error) {
    return jsonBadRequest(error, "Kod onerisi getirilemedi");
  }
}
