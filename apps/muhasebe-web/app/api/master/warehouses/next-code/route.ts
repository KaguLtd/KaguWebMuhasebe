import { NextResponse } from "next/server";

import { suggestDbNextCode } from "@/lib/kagu/master-repository";

export async function GET() {
  return NextResponse.json({ code: await suggestDbNextCode("warehouses") });
}
