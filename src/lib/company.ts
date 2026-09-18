import { cookies } from "next/headers";
import { EmployeeStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveUser } from "@/lib/auth";

export const ACTIVE_COMPANY_COOKIE = "techbites-active-company";

const companySwitcherRoles: Role[] = [Role.SUPER_ADMIN, Role.HR_ADMIN];

/**
 * Returns the company selected in the TopNav switcher, or null for "All Companies".
 * The selection only applies to roles that can see the switcher, so a stale cookie
 * never silently scopes another user's view.
 */
export async function getActiveCompanyId(): Promise<string | null> {
  const cookieStore = await cookies();
  const companyId = cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value;
  if (!companyId) return null;

  const user = await getActiveUser();
  if (!companySwitcherRoles.includes(user.role)) return null;

  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
  return company?.id ?? null;
}

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
