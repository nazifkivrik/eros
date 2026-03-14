import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Track backend availability to reduce noise during startup/restart
let backendAvailable = true;
let lastUnavailableTime = 0;
const BACKEND_UNAVAILABLE_COOLDOWN = 5000; // 5 seconds

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and public API routes
  if (pathname.startsWith("/_next") || pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Skip auth check for login and setup pages
  if (pathname.startsWith("/login") || pathname.startsWith("/setup")) {
    return NextResponse.next();
  }

  const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";

  // If backend was recently unavailable, skip checks to avoid spamming logs
  const now = Date.now();
  if (!backendAvailable && (now - lastUnavailableTime) < BACKEND_UNAVAILABLE_COOLDOWN) {
    return NextResponse.next();
  }

  try {
    // Get cookie from request
    const cookie = request.headers.get("cookie");

    // First check setup status
    const setupResponse = await fetch(`${backendUrl}/api/setup/status`, {
      cache: "no-store",
      // Abort after 2 seconds to avoid hanging requests
      signal: AbortSignal.timeout(2000),
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
        // Abort after 2 seconds to avoid hanging requests
        signal: AbortSignal.timeout(2000),
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

    // Backend responded successfully, mark as available
    if (!backendAvailable) {
      backendAvailable = true;
      console.log("Backend is now available");
    }
  } catch (error) {
    // If API is unavailable, mark backend as unavailable and let request through
    if (backendAvailable) {
      console.warn("Backend temporarily unavailable, allowing request through");
      backendAvailable = false;
      lastUnavailableTime = now;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
