import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/server";
import { requirePermissions, routePermissions } from "@/lib/http/authorization";
import { jsonBadRequest } from "@/lib/http/response";
import { parseDocumentPayload } from "@/lib/http/validation";
import {
  isDbDocumentEntity,
  saveDbDocumentDraft,
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
      routePermissions.documentWrite(entity),
      "Belge taslagi kaydetme yetkiniz yok",
    );

    const detail = await saveDbDocumentDraft(
      entity,
      await parseDocumentPayload(request, entity),
      user.id,
    );

    return NextResponse.json(detail);
  } catch (error) {
    return jsonBadRequest(error, "Draft save failed");
  }
}
