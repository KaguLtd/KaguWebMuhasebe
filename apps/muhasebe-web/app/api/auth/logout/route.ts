import { NextResponse } from "next/server";

import { logoutCurrentSession } from "@/lib/auth/server";

export async function POST() {
  await logoutCurrentSession();

  return NextResponse.json({ ok: true });
}
