import { NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/server";
import { updateUser } from "@/lib/admin/user-repository";
import { jsonBadRequest } from "@/lib/http/response";
import { parseUserPayload, requireStringId } from "@/lib/http/validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireAdminUser();
    const { id } = await context.params;
    const payload = await parseUserPayload(request, { partial: true });

    return NextResponse.json({
      item: await updateUser(requireStringId(id, "Kullanici id zorunludur"), payload),
    });
  } catch (error) {
    return jsonBadRequest(error, "Kullanici guncellenemedi");
  }
}
