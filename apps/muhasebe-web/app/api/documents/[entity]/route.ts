import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/server";
import { jsonBadRequest } from "@/lib/http/response";
import { parseListQuery } from "@/lib/http/validation";
import {
  isDbDocumentEntity,
  listDbDocuments,
} from "@/lib/kagu/document-repository";

type RouteContext = {
  params: Promise<{ entity: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireSessionUser();
    const { entity } = await context.params;

    if (!isDbDocumentEntity(entity)) {
      return NextResponse.json({ error: "Unknown document entity" }, { status: 404 });
    }

    return NextResponse.json(await listDbDocuments(entity, parseListQuery(request)));
  } catch (error) {
    return jsonBadRequest(error, "Belgeler getirilemedi");
  }
}
