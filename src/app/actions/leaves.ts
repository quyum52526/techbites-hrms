"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function submitLeaveRequest(formData: FormData) {
  const employeeId = formData.get("employeeId") as string;
  const leaveTypeId = formData.get("leaveTypeId") as string;
  const startDate = new Date(formData.get("startDate") as string);
  const endDate = new Date(formData.get("endDate") as string);
  const reason = formData.get("reason") as string;

  if (!employeeId || !leaveTypeId || !startDate || !endDate || !reason) {
    throw new Error("All fields are required");
  }

  await prisma.leaveRequest.create({
    data: {
      employeeId,
      leaveTypeId,
      startDate,
      endDate,
      reason,
      status: "PENDING",
    },
  });

  revalidatePath("/dashboard/leaves");
  revalidatePath("/dashboard");
}

export async function updateLeaveStatus(requestId: string, status: "APPROVED" | "REJECTED") {
  await prisma.leaveRequest.update({
    where: { id: requestId },
    data: { status },
  });

  revalidatePath("/dashboard/leaves");
  revalidatePath("/dashboard");
}