"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getActiveUser, isHRAdmin } from "@/lib/auth";
import { getAccessibleCompanyIds } from "@/lib/company";

async function assertHRAdmin() {
  const user = await getActiveUser();
  if (!isHRAdmin(user.role)) throw new Error("You do not have permission to manage departments and designations");
  return user;
}

export async function createDepartment(formData: FormData) {
  const user = await assertHRAdmin();
  const name = (formData.get("name") as string)?.trim();
  const description = formData.get("description") as string;
  // Empty companyId = shared org unit visible to every company.
  let companyId = (formData.get("companyId") as string) || null;
  if (user.role !== "SUPER_ADMIN") {
    if (!user.companyId) throw new Error("Your account is not assigned to a company");
    const accessibleIds = await getAccessibleCompanyIds(user);
    if (companyId && accessibleIds && !accessibleIds.includes(companyId)) throw new Error("You cannot manage another company group");
    companyId = companyId || user.companyId;
  }

  if (!name) throw new Error("Department name is required");

  if (companyId) {
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) throw new Error("Selected company no longer exists");
  }

  try {
    await prisma.department.create({
      data: { name, description: description || null, companyId },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error(`A department named "${name}" already exists`);
    }
    throw err;
  }

  revalidatePath("/dashboard/departments");
  revalidatePath("/dashboard");
}

export async function createDesignation(formData: FormData) {
  await assertHRAdmin();
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;

  if (!title) throw new Error("Designation title is required");

  await prisma.designation.create({
    data: { title, description: description || null },
  });

  revalidatePath("/dashboard/departments");
  revalidatePath("/dashboard");
}

const MAX_NAME_LENGTH = 100;

export type QuickCreateResult<T> = { ok: true; record: T } | { ok: false; error: string };

/** Name checks shared by the quick-create actions; returns the trimmed name or an error message. */
function cleanName(raw: unknown, label: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (!name) return { ok: false, error: `${label} name is required` };
  if (name.length > MAX_NAME_LENGTH) return { ok: false, error: `${label} name must be ${MAX_NAME_LENGTH} characters or fewer` };
  return { ok: true, name };
}

/**
 * Inline "+ New" from the employee forms. Returns the created row instead of throwing, so the form can add it to its
 * dropdown and select it without reloading. Names are unique across all companies, compared case-insensitively.
 */
export async function createDepartmentAction(input: {
  name: string;
  companyId?: string | null;
}): Promise<QuickCreateResult<{ id: string; name: string; companyId: string | null }>> {
  const user = await getActiveUser();
  if (!isHRAdmin(user.role)) return { ok: false, error: "You do not have permission to create departments" };

  const cleaned = cleanName(input.name, "Department");
  if (!cleaned.ok) return cleaned;
  const { name } = cleaned;
  // Empty companyId = shared org unit visible to every company.
  let companyId = input.companyId || null;
  if (user.role !== "SUPER_ADMIN") {
    if (!user.companyId) return { ok: false, error: "Your account is not assigned to a company" };
    const accessibleIds = await getAccessibleCompanyIds(user);
    if (companyId && accessibleIds && !accessibleIds.includes(companyId)) return { ok: false, error: "You cannot manage another company group" };
    companyId = companyId || user.companyId;
  }

  if (companyId) {
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) return { ok: false, error: "Selected company no longer exists" };
  }

  const existing = await prisma.department.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { name: true, company: { select: { code: true } } },
  });
  if (existing) {
    const owner = existing.company ? ` in ${existing.company.code}` : " as a shared department";
    return { ok: false, error: `"${existing.name}" already exists${owner}` };
  }

  try {
    const record = await prisma.department.create({
      data: { name, companyId },
      select: { id: true, name: true, companyId: true },
    });
    // Refreshes the open employee page too; the form's own state and typed values survive the refresh.
    revalidatePath("/dashboard", "layout");
    return { ok: true, record };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: `A department named "${name}" already exists` };
    }
    throw err;
  }
}

/** Inline "+ New" designation. Designations are organisation-wide titles, not tied to a department. */
export async function createDesignationAction(input: { name: string }): Promise<QuickCreateResult<{ id: string; title: string }>> {
  const user = await getActiveUser();
  if (!isHRAdmin(user.role)) return { ok: false, error: "You do not have permission to create designations" };

  const cleaned = cleanName(input.name, "Designation");
  if (!cleaned.ok) return cleaned;
  const title = cleaned.name;

  const existing = await prisma.designation.findFirst({
    where: { title: { equals: title, mode: "insensitive" } },
    select: { title: true },
  });
  if (existing) return { ok: false, error: `"${existing.title}" already exists` };

  try {
    const record = await prisma.designation.create({ data: { title }, select: { id: true, title: true } });
    // Refreshes the open employee page too; the form's own state and typed values survive the refresh.
    revalidatePath("/dashboard", "layout");
    return { ok: true, record };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: `A designation titled "${title}" already exists` };
    }
    throw err;
  }
}
