import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  isPlaceholderSession,
  PLACEHOLDER_SESSION_COOKIE,
} from "@/lib/auth/session";

const PUBLIC_PATHS = ["/login"];
const PUBLIC_API_PATHS = ["/api/health", "/api/auth/sign-out"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiPath = pathname.startsWith("/api");

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/public")
  ) {
    return NextResponse.next();
  }

  const isPublicPath = PUBLIC_PATHS.some(
    (publicPath) =>
      pathname === publicPath || pathname.startsWith(`${publicPath}/`),
  ) || PUBLIC_API_PATHS.some(
    (publicPath) =>
      pathname === publicPath || pathname.startsWith(`${publicPath}/`),
    );

  const hasSession = isPlaceholderSession(
    request.cookies.get(PLACEHOLDER_SESSION_COOKIE)?.value,
  );

  if (!hasSession && !isPublicPath) {
    if (isApiPath) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasSession && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
