import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/server";
import { requirePermissions, routePermissions } from "@/lib/http/authorization";
import { jsonBadRequest } from "@/lib/http/response";
import {
  getDbDocument,
  isDbDocumentEntity,
} from "@/lib/kagu/document-repository";

type RouteContext = {
  params: Promise<{ entity: string; id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireSessionUser();
    const { entity, id } = await context.params;

    if (!isDbDocumentEntity(entity)) {
      return NextResponse.json({ error: "Unknown document entity" }, { status: 404 });
    }

    await requirePermissions(
      user,
      routePermissions.documentRead(entity),
      "Belge verisini gorme yetkiniz yok",
    );

    const detail = await getDbDocument(entity, id);

    if (!detail) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    return jsonBadRequest(error, "Belge detayi getirilemedi");
  }
}
