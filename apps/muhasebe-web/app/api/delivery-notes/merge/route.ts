import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/server";
import { requirePermissions, routePermissions } from "@/lib/http/authorization";
import { jsonBadRequest } from "@/lib/http/response";
import { parseJsonObject } from "@/lib/http/validation";
import { createDbMergedDeliveryNoteDraft } from "@/lib/kagu/document-repository";

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    await requirePermissions(
      user,
      routePermissions.documentWrite("deliveryNotes"),
      "Irsaliye birlestirme yetkiniz yok",
    );

    const payload = await parseJsonObject(request);
    const flow = payload.flow === "PURCHASE_IN" ? "PURCHASE_IN" : "SALES_OUT";
    const sourceDeliveryNoteIds = Array.isArray(payload.sourceDeliveryNoteIds)
      ? payload.sourceDeliveryNoteIds.map((value) => String(value))
      : [];

    return NextResponse.json(
      await createDbMergedDeliveryNoteDraft(
        sourceDeliveryNoteIds,
        flow,
        user.id,
      ),
    );
  } catch (error) {
    return jsonBadRequest(error, "Merge failed");
  }
}
