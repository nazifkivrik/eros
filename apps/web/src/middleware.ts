import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Skip middleware for setup page, static files, and API routes
  if (
    request.nextUrl.pathname.startsWith("/setup") ||
    request.nextUrl.pathname.startsWith("/_next") ||
    request.nextUrl.pathname.startsWith("/api")
  ) {
    return NextResponse.next();
  }

  try {
    // Check setup status
    // Middleware runs server-side, use BACKEND_URL (not NEXT_PUBLIC_API_URL)
    const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";
    const response = await fetch(`${backendUrl}/api/setup/status`, {
      cache: "no-store",
    });

    if (!response.ok) {
      // If API is not available, let the request through
      return NextResponse.next();
    }

    const { setupCompleted } = await response.json();

    if (!setupCompleted) {
      return NextResponse.redirect(new URL("/setup", request.url));
    }
  } catch (error) {
    // If there's an error checking setup status, let the request through
    // This prevents the app from being inaccessible if the API is down
    console.error("Error checking setup status:", error);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
