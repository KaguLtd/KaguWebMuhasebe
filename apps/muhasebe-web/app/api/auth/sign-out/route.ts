import { NextResponse } from "next/server";

import { logoutCurrentSession } from "@/lib/auth/server";

export async function POST(request: Request) {
  await logoutCurrentSession();

  return NextResponse.redirect(new URL("/login", request.url));
}
