import { NextResponse, type NextRequest } from "next/server";
import { GUEST_SESSION_UID, SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { GUEST_READ_ONLY_MESSAGE } from "@/lib/auth-shared";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Fast first gate: checks only that a validly signed, unexpired session cookie exists. It cannot see the database,
 * so `getActiveUser()` still re-checks the account (deactivated, deleted, role) in every page and server action.
 *
 * Guest sessions are also refused here for any modifying API route. Server actions are guarded inside each action
 * (`requireWriteAccess`), because the proxy cannot tell a read action (e.g. search) from a write.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const uid = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const signedIn = uid !== null;
  const isGuest = uid === GUEST_SESSION_UID;

  if (isGuest && pathname.startsWith("/api/") && !pathname.startsWith("/api/auth/") && MUTATING_METHODS.has(request.method)) {
    return NextResponse.json({ ok: false, error: GUEST_READ_ONLY_MESSAGE }, { status: 403 });
  }

  if (pathname.startsWith("/dashboard") && !signedIn) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }

  // Only page visits: the sign-in form posts to /login. `?reason=` means the dashboard just rejected this session
  // (e.g. a deactivated account whose cookie still verifies), so bouncing back would loop. A guest may open the
  // login page to sign in with a real account.
  if (pathname === "/login" && signedIn && !isGuest && request.method === "GET" && !request.nextUrl.searchParams.has("reason")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/api/:path*"],
};
