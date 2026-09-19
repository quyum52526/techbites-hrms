import { cookies } from "next/headers";
import { EmployeeStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveUser } from "@/lib/auth";

export const ACTIVE_COMPANY_COOKIE = "techbites-active-company";
export const NO_COMPANY_SCOPE = "__no-company__";

const companySwitcherRoles: Role[] = [Role.SUPER_ADMIN];

/**
 * Returns the company selected in the TopNav switcher, or null for "All Companies".
 * The selection only applies to roles that can see the switcher, so a stale cookie
 * never silently scopes another user's view.
 */
export async function getActiveCompanyId(): Promise<string | null> {
  const user = await getActiveUser();
  if (user.role !== Role.SUPER_ADMIN) return user.companyId ?? NO_COMPANY_SCOPE;

  const cookieStore = await cookies();
  const companyId = cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value;
  if (!companyId) return null;

  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
  return company?.id ?? null;
}

/** Whether the role follows the TopNav company switcher (selected company, or all companies). */
export function canSwitchCompany(role: Role) {
  return companySwitcherRoles.includes(role);
}

/**
 * Company on the signed-in user's own employee record. Roles without the switcher are pinned to it;
 * null means "no company", which callers must treat as no data, never as "all companies".
 */
export async function getOwnCompanyId(employeeId: string | null): Promise<string | null> {
  if (!employeeId) return null;
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { companyId: true } });
  return employee?.companyId ?? null;
}

/** Matches nothing: the scope for a pinned role whose employee record has no company. */
export const NO_EMPLOYEES: Prisma.EmployeeWhereInput = { id: { in: [] } };

export function employeeScope(companyId: string | null): Prisma.EmployeeWhereInput {
  return companyId ? { companyId } : {};
}

/** Departments without a company are shared org units and stay visible in every company. */
export function departmentScope(companyId: string | null): Prisma.DepartmentWhereInput {
  return companyId ? { OR: [{ companyId }, { companyId: null }] } : {};
}

/** Employee statuses that still count toward headcount and daily attendance. */
export const WORKFORCE_STATUSES: EmployeeStatus[] = [EmployeeStatus.ACTIVE, EmployeeStatus.PROBATION, EmployeeStatus.NOTICE_PERIOD];

export function workforceScope(companyId: string | null): Prisma.EmployeeWhereInput {
  return { ...employeeScope(companyId), status: { in: WORKFORCE_STATUSES } };
}
