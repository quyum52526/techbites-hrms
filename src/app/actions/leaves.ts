"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { LeaveStatus, Role } from "@prisma/client";
import { canAccess, getActiveUser, isHRAdmin, isTeamLead } from "@/lib/auth";
import { employeeScope, getAccessibleCompanyIds, getActiveCompanyId } from "@/lib/company";
import { leaveDays } from "@/lib/leave-balance";
import type { LeaveHistoryEntry } from "@/lib/leave-shared";

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Every leave request of one employee, newest first. Employees may read their own history; HR admins any
 * employee in the companies they can access (the same rule as the employee profile page).
 */
export async function getEmployeeLeaveHistory(employeeId: string): Promise<LeaveHistoryEntry[]> {
  const user = await getActiveUser();
  if (user.employeeId !== employeeId) {
    if (!isHRAdmin(user.role)) throw new Error("You can only view your own leave history");
    const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { companyId: true } });
    const accessibleIds = await getAccessibleCompanyIds(user);
    if (!employee || (accessibleIds && !(employee.companyId && accessibleIds.includes(employee.companyId)))) {
      throw new Error("Employee not found");
    }
  }

  const requests = await prisma.leaveRequest.findMany({
    where: { employeeId },
    include: { leaveType: { select: { name: true } } },
    orderBy: { startDate: "desc" },
  });
  const actorIds = [...new Set(requests.flatMap((request) => (request.approvedBy ? [request.approvedBy] : [])))];
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, email: true } })
    : [];
  const actorEmail = new Map(actors.map((actor) => [actor.id, actor.email]));

  return requests.map((request) => ({
    id: request.id,
    leaveType: request.leaveType.name,
    startDate: isoDate(request.startDate),
    endDate: isoDate(request.endDate),
    days: leaveDays(request.startDate, request.endDate),
    reason: request.reason,
    status: request.status,
    appliedOn: isoDate(request.createdAt),
    lastActionBy: request.approvedBy ? (actorEmail.get(request.approvedBy) ?? "Deleted user") : null,
  }));
}

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
      status: "PENDING_TL",
    },
  });

  revalidatePath("/dashboard/leaves");
  revalidatePath("/dashboard");
}

/**
 * Each approval advances exactly one stage. The employee's manager is the TL stage reviewer; that manager's
 * manager is the next-level reviewer. HR/Super Admin only act at the final HR stage.
 */
export async function updateLeaveStatus(requestId: string, status: "APPROVED" | "REJECTED") {
  const user = await getActiveUser();
  const request = await prisma.leaveRequest.findUnique({
    where: { id: requestId },
    select: { status: true, employee: { select: { companyId: true, managerId: true, manager: { select: { managerId: true } } } } },
  });
  if (!request) throw new Error("Leave request not found");

  let nextStatus: LeaveStatus | null = null;
  let authorized = false;
  if (request.status === LeaveStatus.PENDING_TL && isTeamLead(user.role) && user.employeeId === request.employee.managerId) {
    authorized = true;
    nextStatus = request.employee.manager?.managerId ? LeaveStatus.PENDING_MANAGER : LeaveStatus.PENDING_HR;
  } else if (request.status === LeaveStatus.PENDING_MANAGER && user.role === Role.MANAGER && user.employeeId === request.employee.manager?.managerId) {
    authorized = true;
    nextStatus = LeaveStatus.PENDING_HR;
  } else if (request.status === LeaveStatus.PENDING_HR && canAccess(user.role, "hr")) {
    const activeCompanyId = await getActiveCompanyId();
    authorized = !activeCompanyId || request.employee.companyId === activeCompanyId;
    nextStatus = LeaveStatus.APPROVED;
  }
  if (!authorized || !nextStatus) throw new Error("You are not authorized to process this leave at its current stage");

  const { count } = await prisma.leaveRequest.updateMany({
    where: { id: requestId, status: request.status },
    data: { status: status === "REJECTED" ? LeaveStatus.REJECTED : nextStatus, approvedBy: user.id },
  });
  if (count === 0) throw new Error("Leave request not found or already processed");

  revalidatePath("/dashboard/leaves");
  revalidatePath("/dashboard");
}
