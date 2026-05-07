import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/server";
import { jsonBadRequest } from "@/lib/http/response";
import { parseJsonObject, requireStringId } from "@/lib/http/validation";
import {
  approveDbDocument,
  isDbDocumentEntity,
} from "@/lib/kagu/document-repository";

type RouteContext = {
  params: Promise<{ entity: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    await requireSessionUser();
    const { entity } = await context.params;

    if (!isDbDocumentEntity(entity)) {
      return NextResponse.json({ error: "Unknown document entity" }, { status: 404 });
    }

    const payload = await parseJsonObject(request);

    return NextResponse.json(
      await approveDbDocument(entity, requireStringId(payload.id, "Document id is required")),
    );
  } catch (error) {
    return jsonBadRequest(error, "Approve failed");
  }
}
