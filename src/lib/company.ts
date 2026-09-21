import { cookies } from "next/headers";
import { CompanyType, EmployeeStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveUser } from "@/lib/auth";

export const ACTIVE_COMPANY_COOKIE = "techbites-active-company";
export const NO_COMPANY_SCOPE = "__no-company__";

const companySwitcherRoles: Role[] = [Role.SUPER_ADMIN, Role.HR_ADMIN];

export async function getAccessibleCompanyIds(user?: Awaited<ReturnType<typeof getActiveUser>>): Promise<string[] | null> {
  const activeUser = user ?? (await getActiveUser());
  if (activeUser.role === Role.SUPER_ADMIN) return null;
  if (!activeUser.companyId) return [];
  // A guest sees exactly the showcase company, never its sister concerns.
  if (activeUser.role === "GUEST") return [activeUser.companyId];
  const company = await prisma.company.findUnique({ where: { id: activeUser.companyId }, select: { id: true, type: true } });
  if (!company) return [];
  if (company.type !== CompanyType.PARENT) return [company.id];
  const children = await prisma.company.findMany({ where: { parentId: company.id }, select: { id: true } });
  return [company.id, ...children.map(({ id }) => id)];
}

export async function canSwitchCompanyForUser(user?: Awaited<ReturnType<typeof getActiveUser>>) {
  const activeUser = user ?? (await getActiveUser());
  if (activeUser.role === Role.SUPER_ADMIN) return true;
  if (activeUser.role !== Role.HR_ADMIN || !activeUser.companyId) return false;
  return (await prisma.company.findUnique({ where: { id: activeUser.companyId }, select: { type: true } }))?.type === CompanyType.PARENT;
}

/**
 * Returns the company selected in the TopNav switcher, or null for "All Companies".
 * The selection only applies to roles that can see the switcher, so a stale cookie
 * never silently scopes another user's view.
 */
export async function getActiveCompanyId(): Promise<string | null> {
  const user = await getActiveUser();
  if (!(await canSwitchCompanyForUser(user))) return user.companyId ?? NO_COMPANY_SCOPE;

  const cookieStore = await cookies();
  const companyId = cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value;
  const accessibleIds = await getAccessibleCompanyIds(user);

  // Unscoped "All Companies" is only safe for super admins; a group HR admin falls back to their own company.
  const fallback = accessibleIds ? user.companyId : null;
  if (!companyId) return fallback;
  if (accessibleIds) return accessibleIds.includes(companyId) ? companyId : fallback;

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

export function employeeScopeForCompanies(companyIds: string[]): Prisma.EmployeeWhereInput {
  return companyIds.length > 0 ? { companyId: { in: companyIds } } : NO_EMPLOYEES;
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
