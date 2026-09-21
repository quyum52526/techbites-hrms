/**
 * Stateless session token: `base64url(payload).base64url(HMAC-SHA256(payload))`. Built on Web Crypto with no
 * Node or Next imports, so the proxy and server code share it. The token only proves who signed in; every request
 * still loads the user and checks `isActive`, so deactivating an account takes effect immediately.
 */

export const SESSION_COOKIE = "techbites-session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/** Session uid of a read-only guest. Never a real User id (those are cuids). */
export const GUEST_SESSION_UID = "guest";

type SessionPayload = { uid: string; exp: number };

const DEV_FALLBACK_SECRET = "techbites-dev-only-session-secret-do-not-use-in-production";

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set to at least 32 characters in production");
  }
  return DEV_FALLBACK_SECRET;
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

let keyPromise: Promise<CryptoKey> | null = null;
const signingKey = () =>
  (keyPromise ??= crypto.subtle.importKey("raw", encoder.encode(sessionSecret()), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]));

export async function createSessionToken(userId: string, maxAgeSeconds = SESSION_MAX_AGE_SECONDS) {
  const payload: SessionPayload = { uid: userId, exp: Math.floor(Date.now() / 1000) + maxAgeSeconds };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await signingKey(), encoder.encode(body)));
  return `${body}.${toBase64Url(signature)}`;
}

/** The signed-in user id, or null for a missing, tampered, malformed or expired token. */
export async function verifySessionToken(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;
  try {
    // crypto.subtle.verify compares in constant time.
    const valid = await crypto.subtle.verify("HMAC", await signingKey(), fromBase64Url(signature), encoder.encode(body));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as Partial<SessionPayload>;
    if (typeof payload.uid !== "string" || typeof payload.exp !== "number") return null;
    return payload.exp > Date.now() / 1000 ? payload.uid : null;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
};

/** Only same-app dashboard paths are accepted as a post-login destination, so `?next=` cannot redirect off-site. */
export function safeNextPath(value: string | null | undefined) {
  return value && /^\/dashboard(\/|$|\?)/.test(value) && !value.includes("//") ? value : "/dashboard";
}
