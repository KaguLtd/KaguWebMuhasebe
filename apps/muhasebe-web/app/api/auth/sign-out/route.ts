import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { PLACEHOLDER_SESSION_COOKIE } from "@/lib/auth/session";

export async function POST(request: Request) {
  const cookieStore = await cookies();

  cookieStore.delete(PLACEHOLDER_SESSION_COOKIE);

  return NextResponse.redirect(new URL("/login", request.url));
}
