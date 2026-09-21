import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { GUEST_SESSION_UID, SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { guestCompanyId, guestModeEnabled } from "@/lib/guest";
import { canViewAsHR, GUEST_READ_ONLY_MESSAGE, HR_VIEW_ROLES, type SessionRole } from "@/lib/auth-shared";
export { assignableRoles, canChangeRole, canViewAsHR, isTeamLead, roleLabels } from "@/lib/auth-shared";

export type ActiveUser = {
  id: string;
  email: string;
  role: SessionRole;
  employeeId: string | null;
  companyId: string | null;
  /** Employee name, or null for a login without an employee record. */
  name: string | null;
};

/** A signed-in user who is not a guest: the only kind that may change data. */
export type WritableUser = ActiveUser & { role: Role };

/** Why a session was rejected; shown on the login page. */
export type SessionProblem = "signed-out" | "deactivated" | "expired";

/**
 * A guest session is valid only while guest mode is still enabled and its showcase company still exists, so turning
 * guest mode off (or deleting the company) ends every open guest session on its next request.
 */
async function readGuestSession(): Promise<{ user: ActiveUser } | { problem: SessionProblem }> {
  const companyId = guestCompanyId();
  if (!guestModeEnabled() || !companyId) return { problem: "expired" };
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!company) return { problem: "expired" };
  return {
    user: { id: GUEST_SESSION_UID, email: "Guest session", role: "GUEST", employeeId: null, companyId: company.id, name: "Guest Visitor" },
  };
}

/**
 * The signed-in user from the session cookie, re-checked against the database on every request, so a deactivated
 * or deleted account loses access at once. `cache` shares one lookup between the layout, page and actions of a request.
 */
export const readSession = cache(async (): Promise<{ user: ActiveUser } | { problem: SessionProblem }> => {
  const userId = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!userId) return { problem: "signed-out" };
  if (userId === GUEST_SESSION_UID) return readGuestSession();

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

export const isGuest = (user: Pick<ActiveUser, "role">): boolean => user.role === "GUEST";

/**
 * The signed-in user for a server action that changes data. Guests are refused here, before any role check, so a
 * guest can never slip through a permission meant for viewing (guests pass several view checks on purpose).
 */
export async function requireWriteAccess(): Promise<WritableUser> {
  const user = await getWritableUser();
  if (!user) throw new Error(GUEST_READ_ONLY_MESSAGE);
  return user;
}

/** Same check for actions that report errors as a result: null means a guest (return `guestWriteResult`). */
export async function getWritableUser(): Promise<WritableUser | null> {
  const user = await getActiveUser();
  return user.role === "GUEST" ? null : (user as WritableUser);
}

/** For actions that return `{ ok: false, error }` instead of throwing. */
export const guestWriteResult = { ok: false as const, error: GUEST_READ_ONLY_MESSAGE };

const HR_ADMIN_ROLES: readonly SessionRole[] = [Role.SUPER_ADMIN, Role.HR_ADMIN];

/** Super Admin and HR Admin: the roles that manage employee records. Guests are never HR admins. */
export const isHRAdmin = (role: SessionRole) => HR_ADMIN_ROLES.includes(role);

/**
 * Page guard: anyone whose role is not listed is sent to the dashboard, so hiding a sidebar link is never the
 * only protection. Server actions still check the role themselves.
 */
export async function requireRole(roles: readonly SessionRole[]): Promise<ActiveUser> {
  const user = await getActiveUser();
  if (!roles.includes(user.role)) redirect("/dashboard");
  return user;
}

/** Page guard for company-wide HR pages: HR admins, and guests (who see them read-only). */
export const requireHRView = () => requireRole(HR_VIEW_ROLES);

/** Whether the role may *view* data at the given level. Guests view like HR; they never pass a write check. */
export function canAccess(role: SessionRole, permission: "admin" | "hr" | "team" | "self") {
  if (role === Role.SUPER_ADMIN) return true;
  if (permission === "self") return true;
  if (permission === "hr") return canViewAsHR(role);
  if (permission === "team") return role === Role.TEAM_LEADER;
  return false;
}
