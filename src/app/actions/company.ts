"use server";

import { Prisma, Role } from "@prisma/client";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getActiveUser } from "@/lib/auth";
import { ACTIVE_COMPANY_COOKIE } from "@/lib/company";

const privilegedRoles: Role[] = [Role.SUPER_ADMIN, Role.HR_ADMIN];

export type CompanyActionResult = { ok: true } | { ok: false; error: string };

async function requireCompanyAccess() {
  const user = await getActiveUser();
  if (!privilegedRoles.includes(user.role)) {
    throw new Error("You do not have permission to manage companies");
  }
  return user;
}

export async function getCompanies() {
  await requireCompanyAccess();
  const companies = await prisma.company.findMany({
    orderBy: [{ isParent: "desc" }, { name: "asc" }],
    include: { _count: { select: { employees: true, departments: true } } },
  });

  return companies.map(({ _count, ...company }) => ({
    ...company,
    employeeCount: _count.employees,
    departmentCount: _count.departments,
  }));
}

export async function createCompany(data: { name: string; code: string; isParent?: boolean }): Promise<CompanyActionResult> {
  await requireCompanyAccess();

  const name = data.name?.trim();
  const code = data.code?.trim().toUpperCase();
  if (!name) return { ok: false, error: "Company name is required" };
  if (!code || !/^[A-Z0-9-]{2,10}$/.test(code)) {
    return { ok: false, error: "Short code must be 2–10 letters, digits or dashes (e.g. TBM)" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Only one parent company is allowed; promoting a new one demotes the old.
      if (data.isParent) {
        await tx.company.updateMany({ where: { isParent: true }, data: { isParent: false } });
      }
      await tx.company.create({ data: { name, code, isParent: data.isParent ?? false } });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: `A company with code "${code}" already exists` };
    }
    throw err;
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function deleteCompany(id: string): Promise<CompanyActionResult> {
  await requireCompanyAccess();

  const company = await prisma.company.findUnique({
    where: { id },
    include: { _count: { select: { employees: true, payrolls: true } } },
  });
  if (!company) return { ok: false, error: "Company not found" };

  // Guard against orphaning HR data: employees and payroll history must be moved first.
  if (company._count.employees > 0 || company._count.payrolls > 0) {
    return {
      ok: false,
      error: `${company.name} still has ${company._count.employees} employee(s) and ${company._count.payrolls} payroll record(s). Reassign them before deleting.`,
    };
  }

  // Linked departments are detached (onDelete: SetNull), not removed.
  await prisma.company.delete({ where: { id } });

  const cookieStore = await cookies();
  if (cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value === id) {
    cookieStore.delete(ACTIVE_COMPANY_COOKIE);
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function setActiveCompany(companyId: string | null) {
  await requireCompanyAccess();
  const cookieStore = await cookies();

  if (!companyId) {
    cookieStore.delete(ACTIVE_COMPANY_COOKIE);
  } else {
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) throw new Error("Company not found");
    cookieStore.set(ACTIVE_COMPANY_COOKIE, company.id, { httpOnly: true, sameSite: "lax", path: "/" });
  }

  revalidatePath("/dashboard", "layout");
}
