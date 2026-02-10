import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/login", "/signup"];

// Routes that are always accessible (static assets, api, etc.)
const IGNORED_ROUTES = ["/_next", "/favicon.ico", "/api"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static assets and API routes
  if (IGNORED_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check for auth token in cookies (Supabase stores session in cookies/localStorage)
  // We check for the sb-*-auth-token cookie that Supabase sets
  const hasAuthCookie = request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name.includes("auth-token") ||
        cookie.name.includes("sb-") 
    );

  // Also check for a custom auth token we'll set after login
  const hasSessionToken = request.cookies.get("agrishield-session");

  const isAuthenticated = hasAuthCookie || hasSessionToken;

  // If user is on a public route and IS authenticated, redirect to home
  if (PUBLIC_ROUTES.includes(pathname) && isAuthenticated) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // If user is on a protected route and NOT authenticated, redirect to login
  if (!PUBLIC_ROUTES.includes(pathname) && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
