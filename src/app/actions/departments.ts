"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createDepartment(formData: FormData) {
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;

  if (!name) throw new Error("Department name is required");

  await prisma.department.create({
    data: { name, description: description || null },
  });

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