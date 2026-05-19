import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/server";
import { requirePermissions, routePermissions } from "@/lib/http/authorization";
import { jsonBadRequest } from "@/lib/http/response";
import { parseJsonObject, requireStringId } from "@/lib/http/validation";
import { importDbDeliveryNoteToInvoiceDraft } from "@/lib/kagu/document-repository";

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    await requirePermissions(
      user,
      routePermissions.documentWrite("invoices"),
      "Faturaya irsaliye aktarma yetkiniz yok",
    );

    const payload = await parseJsonObject(request);
    const deliveryNoteId = requireStringId(
      payload.deliveryNoteId,
      "İrsaliye seçimi zorunludur",
    );

    return NextResponse.json(
      await importDbDeliveryNoteToInvoiceDraft(deliveryNoteId, payload, user.id),
    );
  } catch (error) {
    return jsonBadRequest(error, "Import delivery note failed");
  }
}
