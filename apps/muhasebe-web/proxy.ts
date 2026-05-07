import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getSessionUserByToken } from "@/lib/auth/session-store";
import { SESSION_COOKIE } from "@/lib/auth/session";

const PUBLIC_PATHS = ["/login"];
const PUBLIC_API_PATHS = [
  "/api/health",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/sign-out",
];

export async function proxy(request: NextRequest) {
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

  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  const sessionUser = await getSessionUserByToken(sessionToken, { touch: !isPublicPath });
  const hasValidSession = Boolean(sessionUser);
  const shouldClearSessionCookie = Boolean(sessionToken && !hasValidSession);

  if (!hasValidSession && !isPublicPath) {
    if (isApiPath) {
      const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      if (shouldClearSessionCookie) {
        response.cookies.delete(SESSION_COOKIE);
      }

      return response;
    }

    const loginUrl = new URL("/login", request.url);

    if (shouldClearSessionCookie) {
      loginUrl.searchParams.set("auth", "locked");
    }

    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }

    const response = NextResponse.redirect(loginUrl);

    if (shouldClearSessionCookie) {
      response.cookies.delete(SESSION_COOKIE);
    }

    return response;
  }

  if (hasValidSession && pathname === "/login") {
    const nextPath = request.nextUrl.searchParams.get("next");
    const destination = isSafeRedirectPath(nextPath) ? nextPath : "/dashboard";
    const redirectUrl = new URL(
      destination,
      request.url,
    );

    return NextResponse.redirect(redirectUrl);
  }

  const response = NextResponse.next();

  if (shouldClearSessionCookie) {
    response.cookies.delete(SESSION_COOKIE);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

function isSafeRedirectPath(pathname: string | null): pathname is string {
  return Boolean(pathname && pathname.startsWith("/") && !pathname.startsWith("//"));
}
