import { NextResponse } from "next/server";

import {
  getDbDocument,
  isDbDocumentEntity,
} from "@/lib/kagu/document-repository";

type RouteContext = {
  params: Promise<{ entity: string; id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { entity, id } = await context.params;

  if (!isDbDocumentEntity(entity)) {
    return NextResponse.json({ error: "Unknown document entity" }, { status: 404 });
  }

  const detail = await getDbDocument(entity, id);

  if (!detail) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
