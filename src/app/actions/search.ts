"use server";

import { prisma } from "@/lib/prisma";
import { canAccess, getActiveUser } from "@/lib/auth";
import { employeeScope, getActiveCompanyId } from "@/lib/company";
import { employeeSearchWhere } from "@/lib/employee-search";

export type EmployeeSearchHit = {
  id: string;
  name: string;
  employeeCode: string;
  department: string | null;
};

/** Employee lookup for the ⌘K palette, limited to HR roles and the company selected in the switcher. */
export async function searchEmployees(query: string): Promise<EmployeeSearchHit[]> {
  const trimmed = query.trim().slice(0, 80);
  if (trimmed.length < 2) return [];

  const user = await getActiveUser();
  if (!canAccess(user.role, "hr")) return [];

  const activeCompanyId = await getActiveCompanyId();
  const employees = await prisma.employee.findMany({
    where: { ...employeeScope(activeCompanyId), ...employeeSearchWhere(trimmed) },
    select: { id: true, firstName: true, lastName: true, employeeCode: true, department: { select: { name: true } } },
    orderBy: { firstName: "asc" },
    take: 6,
  });

  return employees.map((e) => ({
    id: e.id,
    name: `${e.firstName} ${e.lastName}`,
    employeeCode: e.employeeCode,
    department: e.department?.name ?? null,
  }));
}
