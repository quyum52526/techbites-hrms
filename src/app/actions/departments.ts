"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createDepartment(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const description = formData.get("description") as string;
  // Empty companyId = shared org unit visible to every company.
  const companyId = (formData.get("companyId") as string) || null;

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
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;

  if (!title) throw new Error("Designation title is required");

  await prisma.designation.create({
    data: { title, description: description || null },
  });

  revalidatePath("/dashboard/departments");
  revalidatePath("/dashboard");
}
