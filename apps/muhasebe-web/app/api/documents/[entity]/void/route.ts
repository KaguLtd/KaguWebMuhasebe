import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/server";
import { requirePermissions, routePermissions } from "@/lib/http/authorization";
import { jsonBadRequest } from "@/lib/http/response";
import { parseJsonObject, requireStringId } from "@/lib/http/validation";
import {
  isDbDocumentEntity,
  voidDbDocument,
} from "@/lib/kagu/document-repository";

type RouteContext = {
  params: Promise<{ entity: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireSessionUser();
    const { entity } = await context.params;

    if (!isDbDocumentEntity(entity)) {
      return NextResponse.json({ error: "Unknown document entity" }, { status: 404 });
    }

    await requirePermissions(
      user,
      routePermissions.documentVoid(entity),
      "Belge iptal yetkiniz yok",
    );

    const payload = await parseJsonObject(request);

    return NextResponse.json(
      await voidDbDocument(
        entity,
        requireStringId(payload.id, "Document id is required"),
        typeof payload.reason === "string" ? payload.reason : "",
        user.id,
      ),
    );
  } catch (error) {
    return jsonBadRequest(error, "Void failed");
  }
}
