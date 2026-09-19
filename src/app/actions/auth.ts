"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ACTIVE_COMPANY_COOKIE } from "@/lib/company";
import { createSessionToken, safeNextPath, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export type SignInState = { error: string; email: string } | null;

const INVALID_CREDENTIALS = "Invalid work email or password";

// Compared against when the email is unknown, so a wrong email takes as long as a wrong password and response
// time does not reveal which accounts exist.
let timingHash: Promise<string> | null = null;
const timingEqualizerHash = () => (timingHash ??= bcrypt.hash("timing-equalizer-not-a-password", 10));

async function startSession(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, await createSessionToken(userId), sessionCookieOptions);
  // The company filter belongs to the previous user's view.
  cookieStore.delete(ACTIVE_COMPANY_COOKIE);
}

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your work email and password", email };

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, passwordHash: true, isActive: true },
  });
  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? (await timingEqualizerHash()));
  if (!user || !passwordMatches) return { error: INVALID_CREDENTIALS, email };
  // Checked only after the password, so the message never confirms an account to someone without its password.
  if (!user.isActive) return { error: "This account has been deactivated. Contact HR if you think this is a mistake.", email };

  await startSession(user.id);
  redirect(safeNextPath(formData.get("next") as string | null));
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(ACTIVE_COMPANY_COOKIE);
  redirect("/login");
}

/**
 * Development-only one-click account switch for testing permissions. Refused in production on the server,
 * whatever the UI shows, because it signs in without a password.
 */
export async function switchAccount(formData: FormData) {
  if (process.env.NODE_ENV === "production") throw new Error("Account switching is disabled in production");

  const userId = String(formData.get("userId") ?? "");
  const user = await prisma.user.findFirst({ where: { id: userId, isActive: true }, select: { id: true } });
  if (!user) throw new Error("That account is not available");

  await startSession(user.id);
  // The new role may not be allowed on the current page.
  redirect("/dashboard");
}
