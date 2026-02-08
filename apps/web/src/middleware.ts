import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files
  if (pathname.startsWith("/_next") || pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Skip auth check for login and setup pages
  if (pathname.startsWith("/login") || pathname.startsWith("/setup")) {
    return NextResponse.next();
  }

  const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";

  try {
    // Get cookie from request
    const cookie = request.headers.get("cookie");

    // First check setup status
    const setupResponse = await fetch(`${backendUrl}/api/setup/status`, {
      cache: "no-store",
    });

    if (setupResponse.ok) {
      const { setupCompleted } = await setupResponse.json();

      if (!setupCompleted) {
        // Setup not completed, redirect to setup
        return NextResponse.redirect(new URL("/setup", request.url));
      }

      // Setup completed, now check auth status
      // Forward the session cookie to the backend
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (cookie) {
        headers["Cookie"] = cookie;
      }

      const authResponse = await fetch(`${backendUrl}/api/auth/status`, {
        cache: "no-store",
        headers,
      });

      if (authResponse.ok) {
        const { authenticated } = await authResponse.json();

        if (!authenticated) {
          // Not authenticated, redirect to login
          const loginUrl = new URL("/login", request.url);
          loginUrl.searchParams.set("redirect", pathname);
          return NextResponse.redirect(loginUrl);
        }
      }
    }
  } catch (error) {
    // If API is unavailable, let request through for better UX
    console.error("Middleware error:", error);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
