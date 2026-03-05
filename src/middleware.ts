import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that don't require authentication
const publicRoutes = ["/login", "/api/auth/login"];

// Routes that are API endpoints but need auth (except specific ones)
const publicApiRoutes = [
  "/api/heartbeat", // Server agent heartbeats
  "/api/commands/", // Command results from agents
  "/api/logs", // Log ingestion from agents (POST)
  "/api/health-checks/active", // Health checks for agent
  "/api/health-checks/", // Health check results from agents
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.some((route) => pathname === route || pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow certain API routes without auth (agent endpoints)
  if (publicApiRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow API requests with X-API-Key header (agent authentication)
  const apiKey = request.headers.get("x-api-key") || request.headers.get("authorization");
  if (apiKey && pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Check for session cookie
  const sessionToken = request.cookies.get("watchtower_session")?.value;

  if (!sessionToken) {
    // For API routes, return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // For page routes, redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Session exists - allow request (actual validation happens in route handlers)
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (including .sh scripts)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|sh)$).*)",
  ],
};
