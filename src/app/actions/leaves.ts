"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { canAccess, getActiveUser } from "@/lib/auth";
import { employeeScope, getActiveCompanyId } from "@/lib/company";

export async function submitLeaveRequest(formData: FormData) {
  const requestedEmployeeId = formData.get("employeeId") as string | null;
  const leaveTypeId = formData.get("leaveTypeId") as string;
  const startDate = new Date(formData.get("startDate") as string);
  const endDate = new Date(formData.get("endDate") as string);
  const reason = formData.get("reason") as string;

  const user = await getActiveUser();
  const isApprover = canAccess(user.role, "hr");

  // Non-approvers can only file leave for themselves, whatever the form posted.
  const employeeId = isApprover ? requestedEmployeeId : user.employeeId;
  if (!isApprover && !employeeId) {
    throw new Error("Your account is not linked to an employee record");
  }

  if (!employeeId || !leaveTypeId || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || !reason) {
    throw new Error("All fields are required");
  }
  if (endDate < startDate) {
    throw new Error("End date cannot be before the start date");
  }

  if (isApprover) {
    const activeCompanyId = await getActiveCompanyId();
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, ...employeeScope(activeCompanyId) },
      select: { id: true },
    });
    if (!employee) throw new Error("Employee not found in the selected company");
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
  const user = await getActiveUser();
  if (!canAccess(user.role, "hr")) {
    throw new Error("You do not have permission to approve or reject leave");
  }

  const activeCompanyId = await getActiveCompanyId();
  const { count } = await prisma.leaveRequest.updateMany({
    where: { id: requestId, status: "PENDING", employee: employeeScope(activeCompanyId) },
    data: { status },
  });
  if (count === 0) throw new Error("Leave request not found or already processed");

  revalidatePath("/dashboard/leaves");
  revalidatePath("/dashboard");
}
