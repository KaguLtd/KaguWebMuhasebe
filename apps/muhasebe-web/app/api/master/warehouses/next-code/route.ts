import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/server";
import { requirePermissions, routePermissions } from "@/lib/http/authorization";
import { jsonBadRequest } from "@/lib/http/response";
import { suggestDbNextCode } from "@/lib/kagu/master-repository";

export async function GET() {
  try {
    const user = await requireSessionUser();

    await requirePermissions(
      user,
      routePermissions.masterWrite("warehouses"),
      "Kod onerisi alma yetkiniz yok",
    );

    return NextResponse.json({ code: await suggestDbNextCode("warehouses") });
  } catch (error) {
    return jsonBadRequest(error, "Kod onerisi getirilemedi");
  }
}
