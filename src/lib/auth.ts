import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
export { assignableRoles, canChangeRole, isTeamLead, roleLabels } from "@/lib/auth-shared";

const ACTIVE_USER_COOKIE = "techbites-active-user";

export type ActiveUser = {
  id: string;
  email: string;
  role: Role;
  employeeId: string | null;
};

const activeUserSelect = { id: true, email: true, role: true, isActive: true, employee: { select: { id: true } } } as const;

export async function getActiveUser(): Promise<ActiveUser> {
  const cookieStore = await cookies();
  const requestedId = cookieStore.get(ACTIVE_USER_COOKIE)?.value;

  // A cookie that names a deactivated (e.g. released) or deleted account must never fall back to the default
  // admin below, or revoking a login would grant Super Admin instead.
  const user = requestedId
    ? await prisma.user.findUnique({ where: { id: requestedId }, select: activeUserSelect })
    : await prisma.user.findFirst({ where: { email: "admin@techbites.com" }, select: activeUserSelect });

  if (!user) throw new Error(requestedId ? "This account no longer exists" : "No active user is configured");
  if (!user.isActive) throw new Error("This account has been deactivated");

  return { id: user.id, email: user.email, role: user.role, employeeId: user.employee?.id ?? null };
}

const HR_ADMIN_ROLES: Role[] = [Role.SUPER_ADMIN, Role.HR_ADMIN];

/** Super Admin and HR Admin: the roles that manage employee records. */
export const isHRAdmin = (role: Role) => HR_ADMIN_ROLES.includes(role);

/**
 * Page guard: anyone whose role is not listed is sent to the dashboard, so hiding a sidebar link is never the
 * only protection. Server actions still check the role themselves.
 */
export async function requireRole(roles: readonly Role[]): Promise<ActiveUser> {
  const user = await getActiveUser();
  if (!roles.includes(user.role)) redirect("/dashboard");
  return user;
}

/** Page guard for HR-admin-only pages. */
export const requireHRAdmin = () => requireRole(HR_ADMIN_ROLES);

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

