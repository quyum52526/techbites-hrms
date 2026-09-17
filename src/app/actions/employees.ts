"use server";

import { EmploymentType, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { getActiveUser } from "@/lib/auth";

export type EmployeeActionResult = { ok: true } | { ok: false; error: string };

const duplicateFieldLabels: Record<string, string> = {
  email: "work email",
  employeeCode: "employee code",
  biometricId: "biometric / device ID",
};

export async function createEmployee(formData: FormData): Promise<EmployeeActionResult> {
  const user = await getActiveUser();
  if (user.role !== Role.SUPER_ADMIN && user.role !== Role.HR_ADMIN) {
    return { ok: false, error: "You do not have permission to create employees" };
  }

  const email = (formData.get("email") as string)?.trim();
  const firstName = (formData.get("firstName") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();
  const employeeCode = (formData.get("employeeCode") as string)?.trim();
  const phone = formData.get("phone") as string;
  const companyId = (formData.get("companyId") as string) || null;
  const biometricId = (formData.get("biometricId") as string)?.trim() || null;
  const departmentId = (formData.get("departmentId") as string) || null;
  const designationId = formData.get("designationId") as string;
  const employmentType = (formData.get("employmentType") as EmploymentType | null) ?? EmploymentType.FULL_TIME;

  if (!email || !firstName || !lastName || !employeeCode) {
    return { ok: false, error: "Required fields are missing" };
  }

  if (companyId) {
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) return { ok: false, error: "Selected company no longer exists" };
  }

  if (departmentId) {
    const department = await prisma.department.findUnique({ where: { id: departmentId }, select: { companyId: true } });
    if (!department) return { ok: false, error: "Selected department no longer exists" };
    if (department.companyId && department.companyId !== companyId) {
      return { ok: false, error: "Selected department belongs to a different company" };
    }
  }

  // ডিফল্ট পাসওয়ার্ড দিয়ে ইউজার তৈরি
  const passwordHash = await bcrypt.hash("Welcome123!", 10);

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          role: "EMPLOYEE",
        },
      });

      await tx.employee.create({
        data: {
          userId: user.id,
          employeeCode,
          biometricId,
          companyId,
          firstName,
          lastName,
          phone,
          departmentId,
          designationId: designationId || null,
          employmentType,
          status: "ACTIVE",
          joiningDate: new Date(),
        },
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const fields = (err.meta?.target as string[] | undefined) ?? [];
      const label = fields.map((f) => duplicateFieldLabels[f] ?? f).join(", ") || "value";
      return { ok: false, error: `An employee with this ${label} already exists` };
    }
    throw err;
  }

  revalidatePath("/dashboard/employees");
  revalidatePath("/dashboard");
  return { ok: true };
}
