import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
export { assignableRoles, canChangeRole, isTeamLead, roleLabels } from "@/lib/auth-shared";

export type ActiveUser = {
  id: string;
  email: string;
  role: Role;
  employeeId: string | null;
  companyId: string | null;
  /** Employee name, or null for a login without an employee record. */
  name: string | null;
};

/** Why a session was rejected; shown on the login page. */
export type SessionProblem = "signed-out" | "deactivated" | "expired";

/**
 * The signed-in user from the session cookie, re-checked against the database on every request, so a deactivated
 * or deleted account loses access at once. `cache` shares one lookup between the layout, page and actions of a request.
 */
export const readSession = cache(async (): Promise<{ user: ActiveUser } | { problem: SessionProblem }> => {
  const userId = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!userId) return { problem: "signed-out" };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, isActive: true, employee: { select: { id: true, companyId: true, firstName: true, lastName: true } } },
  });
  if (!user) return { problem: "expired" };
  if (!user.isActive) return { problem: "deactivated" };

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employee?.id ?? null,
      companyId: user.employee?.companyId ?? null,
      name: user.employee ? `${user.employee.firstName} ${user.employee.lastName}` : null,
    },
  };
});

/** The signed-in user; anyone else is sent to /login (with the reason, when the session named a closed account). */
export async function getActiveUser(): Promise<ActiveUser> {
  const session = await readSession();
  if ("user" in session) return session.user;
  redirect(session.problem === "signed-out" ? "/login" : `/login?reason=${session.problem}`);
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

export function canAccess(role: Role, permission: "admin" | "hr" | "team" | "self") {
  if (role === Role.SUPER_ADMIN) return true;
  if (permission === "self") return true;
  if (permission === "hr") return role === Role.HR_ADMIN;
  if (permission === "team") return role === Role.TEAM_LEADER;
  return false;
}

