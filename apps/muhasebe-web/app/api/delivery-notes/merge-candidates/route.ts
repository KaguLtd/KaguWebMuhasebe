import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/server";
import { requirePermissions, routePermissions } from "@/lib/http/authorization";
import { jsonBadRequest } from "@/lib/http/response";
import { listDbDeliveryMergeCandidates } from "@/lib/kagu/document-repository";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser();
    await requirePermissions(
      user,
      routePermissions.documentRead("deliveryNotes"),
      "Irsaliye okuma yetkiniz yok",
    );

    const params = new URL(request.url).searchParams;

    return NextResponse.json({
      items: await listDbDeliveryMergeCandidates({
        accountId: params.get("accountId") ?? undefined,
        projectId: params.get("projectId") ?? undefined,
        warehouseId: params.get("warehouseId") ?? undefined,
      }),
    });
  } catch (error) {
    return jsonBadRequest(error, "Merge candidates failed");
  }
}
