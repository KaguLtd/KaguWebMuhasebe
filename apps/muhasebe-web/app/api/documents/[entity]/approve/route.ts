import { NextResponse } from "next/server";

import {
  approveDbDocument,
  isDbDocumentEntity,
} from "@/lib/kagu/document-repository";

type RouteContext = {
  params: Promise<{ entity: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { entity } = await context.params;

  if (!isDbDocumentEntity(entity)) {
    return NextResponse.json({ error: "Unknown document entity" }, { status: 404 });
  }

  try {
    const payload = (await request.json()) as { id?: string };

    if (!payload.id) {
      return NextResponse.json({ error: "Document id is required" }, { status: 400 });
    }

    return NextResponse.json(await approveDbDocument(entity, payload.id));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Approve failed" },
      { status: 400 },
    );
  }
}
