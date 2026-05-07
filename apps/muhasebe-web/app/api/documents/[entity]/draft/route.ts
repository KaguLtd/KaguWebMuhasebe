import { NextResponse } from "next/server";

import type { DocumentPayload } from "@/lib/kagu/contracts";
import {
  isDbDocumentEntity,
  saveDbDocumentDraft,
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
    const payload = (await request.json()) as DocumentPayload;

    const detail = await saveDbDocumentDraft(entity, payload);

    return NextResponse.json(detail);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Draft save failed" },
      { status: 400 },
    );
  }
}
