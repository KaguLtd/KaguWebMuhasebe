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
      routePermissions.masterWrite("accounts"),
      "Kod onerisi alma yetkiniz yok",
    );

    const params = new URL(request.url).searchParams;

    return NextResponse.json({
      code: await suggestDbNextCode("accounts", {
        accountKind: params.get("accountKind"),
      }),
    });
  } catch (error) {
    return jsonBadRequest(error, "Kod onerisi getirilemedi");
  }
}
