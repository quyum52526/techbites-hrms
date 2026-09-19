"use server";

import { Prisma, Role } from "@prisma/client";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getActiveUser } from "@/lib/auth";
import { ACTIVE_COMPANY_COOKIE } from "@/lib/company";
import { isSafeAssetUrl } from "@/lib/employee-profile";

const privilegedRoles: Role[] = [Role.SUPER_ADMIN, Role.HR_ADMIN];

export type CompanyActionResult = { ok: true } | { ok: false; error: string };

async function requireCompanyAccess() {
  const user = await getActiveUser();
  if (!privilegedRoles.includes(user.role)) {
    throw new Error("You do not have permission to manage companies");
  }
  return user;
}

async function requireCompanyMutationAccess(companyId?: string) {
  const user = await requireCompanyAccess();
  if (user.role !== Role.SUPER_ADMIN && companyId && user.companyId !== companyId) {
    throw new Error("You do not have access to this company");
  }
  return user;
}

export async function getCompanies() {
  const user = await requireCompanyAccess();
  const companies = await prisma.company.findMany({
    where: user.role === Role.SUPER_ADMIN ? undefined : { id: user.companyId ?? "__no-company__" },
    orderBy: [{ isParent: "desc" }, { name: "asc" }],
    include: { _count: { select: { employees: true, departments: true } } },
  });

  return companies.map(({ _count, ...company }) => ({
    ...company,
    employeeCount: _count.employees,
    departmentCount: _count.departments,
  }));
}

export type CompanyInput = {
  name: string;
  code: string;
  isParent?: boolean;
  address?: string | null;
  binNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
};

type CompanyData = {
  name: string;
  code: string;
  isParent: boolean;
  address: string | null;
  binNumber: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
};

const optionalText = (value: string | null | undefined) => value?.trim() || null;

function companyInputFromFormData(formData: FormData): CompanyInput {
  return {
    name: formData.get("name") as string,
    code: formData.get("code") as string,
    isParent: formData.get("isParent") === "on",
    address: formData.get("address") as string | null,
    binNumber: formData.get("binNumber") as string | null,
    phone: formData.get("phone") as string | null,
    email: formData.get("email") as string | null,
    logoUrl: formData.get("logoUrl") as string | null,
  };
}

function parseCompanyInput(input: CompanyInput): { ok: true; data: CompanyData } | { ok: false; error: string } {
  const name = input.name?.trim();
  const code = input.code?.trim().toUpperCase();
  const email = optionalText(input.email);
  const logoUrl = optionalText(input.logoUrl);

  if (!name) return { ok: false, error: "Company name is required" };
  if (!code || !/^[A-Z0-9-]{2,10}$/.test(code)) {
    return { ok: false, error: "Short code must be 2–10 letters, digits or dashes (e.g. TBM)" };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid company email address" };
  }
  if (logoUrl && !isSafeAssetUrl(logoUrl)) {
    return { ok: false, error: "Logo URL must start with / (e.g. /logos/tbm.png) or http(s)://" };
  }

  return {
    ok: true,
    data: {
      name,
      code,
      isParent: input.isParent ?? false,
      address: optionalText(input.address),
      binNumber: optionalText(input.binNumber),
      phone: optionalText(input.phone),
      email,
      logoUrl,
    },
  };
}

function duplicateCodeResult(err: unknown, code: string): CompanyActionResult {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    return { ok: false, error: `A company with code "${code}" already exists` };
  }
  throw err;
}

export async function createCompany(input: CompanyInput | FormData): Promise<CompanyActionResult> {
  const user = await requireCompanyAccess();
  if (user.role !== Role.SUPER_ADMIN) throw new Error("Only a Super Admin can create companies");

  const parsed = parseCompanyInput(input instanceof FormData ? companyInputFromFormData(input) : input);
  if (!parsed.ok) return parsed;
  const { data } = parsed;

  try {
    await prisma.$transaction(async (tx) => {
      // Only one parent company is allowed; promoting a new one demotes the old.
      if (data.isParent) {
        await tx.company.updateMany({ where: { isParent: true }, data: { isParent: false } });
      }
      await tx.company.create({ data });
    });
  } catch (err) {
    return duplicateCodeResult(err, data.code);
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function updateCompany(id: string, formData: FormData): Promise<CompanyActionResult> {
  await requireCompanyMutationAccess(id);

  const parsed = parseCompanyInput(companyInputFromFormData(formData));
  if (!parsed.ok) return parsed;
  const { data } = parsed;

  const existing = await prisma.company.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: "Company not found" };

  try {
    await prisma.$transaction(async (tx) => {
      if (data.isParent) {
        await tx.company.updateMany({ where: { isParent: true, id: { not: id } }, data: { isParent: false } });
      }
      await tx.company.update({ where: { id }, data });
    });
  } catch (err) {
    return duplicateCodeResult(err, data.code);
  }

  // The company id is unchanged, so an active-company cookie pointing at it stays valid;
  // revalidating the layout refreshes the switcher's name/code labels.
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function deleteCompany(id: string): Promise<CompanyActionResult> {
  await requireCompanyMutationAccess(id);

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
  const user = await requireCompanyAccess();
  const cookieStore = await cookies();

  if (!companyId) {
    cookieStore.delete(ACTIVE_COMPANY_COOKIE);
  } else {
    if (user.role !== Role.SUPER_ADMIN && user.companyId !== companyId) {
      throw new Error("You do not have access to this company");
    }
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) throw new Error("Company not found");
    cookieStore.set(ACTIVE_COMPANY_COOKIE, company.id, { httpOnly: true, sameSite: "lax", path: "/" });
  }

  revalidatePath("/dashboard", "layout");
}
