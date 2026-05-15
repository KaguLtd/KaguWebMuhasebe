import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/server";
import { requirePermissions, routePermissions } from "@/lib/http/authorization";
import { jsonBadRequest } from "@/lib/http/response";
import { unmergeDbDeliveryNote } from "@/lib/kagu/document-repository";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requireSessionUser();
    await requirePermissions(
      user,
      routePermissions.documentWrite("deliveryNotes"),
      "Irsaliye cozumleme yetkiniz yok",
    );

    const { id } = await context.params;

    return NextResponse.json(await unmergeDbDeliveryNote(id, user.id));
  } catch (error) {
    return jsonBadRequest(error, "Unmerge failed");
  }
}
