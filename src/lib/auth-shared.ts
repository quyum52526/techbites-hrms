import type { Role } from "@prisma/client";

/**
 * Role of a signed-in session. GUEST is session-only (no User row, never assignable): a read-only visitor who sees
 * one showcase company the way an HR admin would, but cannot change anything.
 */
export type SessionRole = Role | "GUEST";

export const GUEST_READ_ONLY_MESSAGE = "Modifications are disabled in Guest Mode";

export const roleLabels: Record<SessionRole, string> = {
  SUPER_ADMIN: "Super Admin",
  HR_ADMIN: "HR Admin",
  TEAM_LEADER: "Team Leader",
  MANAGER: "Manager",
  EMPLOYEE: "Employee",
  GUEST: "Guest (Read-Only)",
};

/** Roles that may view company-wide HR data: the HR admins, plus read-only guests. */
export const HR_VIEW_ROLES: readonly SessionRole[] = ["SUPER_ADMIN", "HR_ADMIN", "GUEST"];
export const canViewAsHR = (role: SessionRole) => HR_VIEW_ROLES.includes(role);

/** Dropdown order: least to most access. */
export const ROLE_OPTIONS: Role[] = ["EMPLOYEE", "TEAM_LEADER", "MANAGER", "HR_ADMIN", "SUPER_ADMIN"];

export const roleDescriptions: Record<Role, string> = {
  EMPLOYEE: "Own attendance, leave and payslips",
  TEAM_LEADER: "Plus direct reports' attendance, leave approvals and reviews",
  MANAGER: "Team Leader access plus Reports & BI",
  HR_ADMIN: "All employee records, payroll and settings",
  SUPER_ADMIN: "Everything, including granting admin roles",
};

/** Performance reviews: admins see everyone, team leads their direct reports. Guests view only. */
export const PERFORMANCE_ROLES: readonly SessionRole[] = ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "TEAM_LEADER", "GUEST"];

/** Roles that lead a team through `Employee.managerId`. */
export const isTeamLead = (role: SessionRole) => role === "TEAM_LEADER" || role === "MANAGER";

/**
 * Roles the actor may grant. Only a Super Admin can grant Super Admin or HR Admin; an HR Admin can grant the
 * team and employee roles. Everyone else grants nothing. The server actions enforce the same rule.
 */
export function assignableRoles(actorRole: Role): Role[] {
  if (actorRole === "SUPER_ADMIN") return ROLE_OPTIONS;
  if (actorRole === "HR_ADMIN") return ["EMPLOYEE", "TEAM_LEADER", "MANAGER"];
  return [];
}

/**
 * Whether the actor may move a user from `currentRole` to `nextRole`. An HR Admin cannot touch an account that
 * already holds a role they could not grant (another HR Admin or a Super Admin), not even to demote it.
 */
export function canChangeRole(actorRole: Role, currentRole: Role, nextRole: Role) {
  if (currentRole === nextRole) return true;
  const allowed = assignableRoles(actorRole);
  return allowed.includes(currentRole) && allowed.includes(nextRole);
}
