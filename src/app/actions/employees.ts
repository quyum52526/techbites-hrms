"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

export async function createEmployee(formData: FormData) {
  const email = formData.get("email") as string;
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const employeeCode = formData.get("employeeCode") as string;
  const phone = formData.get("phone") as string;
  const departmentId = formData.get("departmentId") as string;
  const designationId = formData.get("designationId") as string;
  const employmentType = formData.get("employmentType") as any;

  if (!email || !firstName || !lastName || !employeeCode) {
    throw new Error("Required fields are missing");
  }

  // ডিফল্ট পাসওয়ার্ড দিয়ে ইউজার তৈরি
  const passwordHash = await bcrypt.hash("Welcome123!", 10);

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
        firstName,
        lastName,
        phone,
        departmentId: departmentId || null,
        designationId: designationId || null,
        employmentType: employmentType || "FULL_TIME",
        status: "ACTIVE",
        joiningDate: new Date(),
      },
    });
  });

  revalidatePath("/dashboard/employees");
  revalidatePath("/dashboard");
}