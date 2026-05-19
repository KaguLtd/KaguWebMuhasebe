import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/server";
import { requirePermissions, routePermissions } from "@/lib/http/authorization";
import { updateUser } from "@/lib/admin/user-repository";
import { jsonBadRequest } from "@/lib/http/response";
import { parseUserPayload, requireStringId } from "@/lib/http/validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireSessionUser();
    const { id } = await context.params;

    await requirePermissions(
      user,
      routePermissions.settingsUsersWrite(),
      "Kullanıcı güncelleme yetkiniz yok",
    );

    const payload = await parseUserPayload(request, { partial: true });

    return NextResponse.json({
      item: await updateUser(requireStringId(id, "Kullanıcı id zorunludur"), payload),
    });
  } catch (error) {
    return jsonBadRequest(error, "Kullanıcı güncellenemedi");
  }
}
