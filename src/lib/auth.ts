import { cookies } from "next/headers";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
export { roleLabels } from "@/lib/auth-shared";

const ACTIVE_USER_COOKIE = "techbites-active-user";

export type ActiveUser = {
  id: string;
  email: string;
  role: Role;
  employeeId: string | null;
};

export async function getActiveUser(): Promise<ActiveUser> {
  const cookieStore = await cookies();
  const requestedId = cookieStore.get(ACTIVE_USER_COOKIE)?.value;
  const user = await prisma.user.findFirst({
    where: { id: requestedId ?? undefined, isActive: true },
    select: { id: true, email: true, role: true, employee: { select: { id: true } } },
  }) ?? await prisma.user.findFirst({
    where: { email: "admin@techbites.com", isActive: true },
    select: { id: true, email: true, role: true, employee: { select: { id: true } } },
  });

  if (!user) {
    throw new Error("No active user is configured");
  }

  return { id: user.id, email: user.email, role: user.role, employeeId: user.employee?.id ?? null };
}

export async function setActiveUser(userId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, isActive: true }, select: { id: true } });
  if (!user) throw new Error("User not found");

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_USER_COOKIE, user.id, { httpOnly: true, sameSite: "lax", path: "/" });
}

export function canAccess(role: Role, permission: "admin" | "hr" | "team" | "self") {
  if (role === Role.SUPER_ADMIN) return true;
  if (permission === "self") return true;
  if (permission === "hr") return role === Role.HR_ADMIN;
  if (permission === "team") return role === Role.TEAM_LEADER;
  return false;
}

