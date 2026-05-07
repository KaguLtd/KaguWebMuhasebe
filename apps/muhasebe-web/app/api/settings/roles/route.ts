import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/server";
import { listRoles } from "@/lib/admin/user-repository";
import { requirePermissions, routePermissions } from "@/lib/http/authorization";
import { jsonBadRequest } from "@/lib/http/response";

export async function GET() {
  try {
    const user = await requireSessionUser();

    await requirePermissions(
      user,
      routePermissions.settingsRolesRead(),
      "Rol listesini gorme yetkiniz yok",
    );

    return NextResponse.json({ items: await listRoles() });
  } catch (error) {
    return jsonBadRequest(error, "Roller getirilemedi");
  }
}
