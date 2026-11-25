import { NextRequest, NextResponse } from "next/server";
import { canAccessPath, ROLE_HOME_ROUTES } from "./lib/roles";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./lib/jwt";

const PUBLIC_PATHS = ["/login", "/api/health", "/api/demo/reset"];
const STATIC_ASSET_RE = /\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff|woff2)$/i;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/manifest.json" ||
    STATIC_ASSET_RE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (pathname === "/login" && session) {
      const home = ROLE_HOME_ROUTES[session.role] ?? "/";
      return NextResponse.redirect(new URL(home, request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname === "/") {
    const home = ROLE_HOME_ROUTES[session.role] ?? "/login";
    return NextResponse.redirect(new URL(home, request.url));
  }

  if (!canAccessPath(session.role, pathname)) {
    const home = ROLE_HOME_ROUTES[session.role] ?? "/login";
    return NextResponse.redirect(new URL(home, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff|woff2)$).*)",
  ],
};
