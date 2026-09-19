"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { canAccess, getActiveUser, isTeamLead } from "@/lib/auth";
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

/**
 * HR admins decide any request in the selected company. Team leaders and managers decide only their direct
 * reports' requests, never their own (theirs goes to their manager or HR).
 */
export async function updateLeaveStatus(requestId: string, status: "APPROVED" | "REJECTED") {
  const user = await getActiveUser();
  let employeeWhere: Prisma.EmployeeWhereInput;
  if (canAccess(user.role, "hr")) {
    employeeWhere = employeeScope(await getActiveCompanyId());
  } else if (isTeamLead(user.role) && user.employeeId) {
    employeeWhere = { managerId: user.employeeId };
  } else {
    throw new Error("You do not have permission to approve or reject leave");
  }

  const { count } = await prisma.leaveRequest.updateMany({
    where: { id: requestId, status: "PENDING", employee: employeeWhere },
    data: { status, approvedBy: user.id },
  });
  if (count === 0) throw new Error("Leave request not found or already processed");

  revalidatePath("/dashboard/leaves");
  revalidatePath("/dashboard");
}
