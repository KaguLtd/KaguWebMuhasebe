import { NextResponse } from "next/server";

import { suggestDbNextCode } from "@/lib/kagu/master-repository";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  return NextResponse.json({
    code: await suggestDbNextCode("accounts", {
      accountKind: params.get("accountKind"),
    }),
  });
}
