import { NextResponse } from "next/server";

import {
  isDbMasterEntity,
  suggestDbNextCode,
} from "@/lib/kagu/master-repository";

type RouteContext = {
  params: Promise<{ entity: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { entity } = await context.params;

  if (!isDbMasterEntity(entity)) {
    return NextResponse.json({ error: "Unknown master entity" }, { status: 404 });
  }

  const params = new URL(request.url).searchParams;
  const code = await suggestDbNextCode(entity, {
    accountKind: params.get("accountKind"),
    classId: params.get("classId"),
  });

  return NextResponse.json({ code });
}
