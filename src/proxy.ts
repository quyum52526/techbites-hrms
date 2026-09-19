import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/**
 * Fast first gate: checks only that a validly signed, unexpired session cookie exists. It cannot see the database,
 * so `getActiveUser()` still re-checks the account (deactivated, deleted, role) in every page and server action.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = (await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) !== null;

  if (pathname.startsWith("/dashboard") && !signedIn) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }

  // Only page visits: the sign-in form posts to /login. `?reason=` means the dashboard just rejected this session
  // (e.g. a deactivated account whose cookie still verifies), so bouncing back would loop.
  if (pathname === "/login" && signedIn && request.method === "GET" && !request.nextUrl.searchParams.has("reason")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
