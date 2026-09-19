"use server";

import { AppraisalStatus, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getActiveUser, isTeamLead } from "@/lib/auth";
import { PERFORMANCE_ROLES } from "@/lib/auth-shared";

const privilegedRoles: Role[] = [Role.SUPER_ADMIN, Role.HR_ADMIN];

async function requirePerformanceAccess() {
  const user = await getActiveUser();
  if (!PERFORMANCE_ROLES.includes(user.role)) {
    throw new Error("You do not have permission to access performance reviews");
  }
  return user;
}

export async function getAppraisalCycles() {
  await requirePerformanceAccess();
  return prisma.appraisalCycle.findMany({ orderBy: [{ isActive: "desc" }, { startDate: "desc" }] });
}

export async function createAppraisalCycle(data: {
  title: string;
  period: "MONTHLY" | "QUARTERLY" | "YEARLY";
  startDate: Date;
  endDate: Date;
}) {
  const user = await requirePerformanceAccess();
  if (!privilegedRoles.includes(user.role)) throw new Error("Only HR administrators can create cycles");
  return prisma.$transaction(async (tx) => {
    const cycle = await tx.appraisalCycle.create({ data });
    const employees = await tx.employee.findMany({ select: { id: true } });
    if (employees.length > 0) {
      await tx.appraisalReview.createMany({
        data: employees.map((employee) => ({ cycleId: cycle.id, employeeId: employee.id })),
        skipDuplicates: true,
      });
    }
    return cycle;
  });
}

/**
 * Reviews in a cycle. Team leads always get their own direct reports: this is a server action the browser can call
 * with any arguments, so `managerEmployeeId` is honoured only for HR admins (to view one manager's team).
 */
export async function getReviewsForCycle(cycleId: string, managerEmployeeId?: string) {
  const user = await requirePerformanceAccess();
  const cycle = await prisma.appraisalCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new Error("Appraisal cycle not found");

  let employeeFilter = {};
  if (isTeamLead(user.role)) {
    if (!user.employeeId) throw new Error("Team leader profile is not linked to an employee");
    employeeFilter = { managerId: user.employeeId };
  } else if (managerEmployeeId) {
    employeeFilter = { managerId: managerEmployeeId };
  }

  const employees = await prisma.employee.findMany({
    where: employeeFilter,
    include: { department: true, manager: true, user: true },
    orderBy: [{ department: { name: "asc" } }, { lastName: "asc" }],
  });
  const reviews = await prisma.appraisalReview.findMany({
    where: { cycleId, employeeId: { in: employees.map((employee) => employee.id) } },
  });
  const reviewByEmployee = new Map(reviews.map((review) => [review.employeeId, review]));

  return employees.map((employee) => ({
    employee,
    review: reviewByEmployee.get(employee.id) ?? null,
  }));
}

export async function submitEmployeeReview(
  reviewId: string,
  metrics: { productivity: number; qualityOfWork: number; collaboration: number; feedback?: string },
) {
  const user = await requirePerformanceAccess();
  const review = await prisma.appraisalReview.findUnique({
    where: { id: reviewId },
    include: { cycle: true, employee: true },
  });
  if (!review) throw new Error("Review not found");
  if (isTeamLead(user.role) && review.employee.managerId !== user.employeeId) {
    throw new Error("You can only review direct reports");
  }

  const attendance = await prisma.attendanceRecord.findMany({
    where: { employeeId: review.employeeId, date: { gte: review.cycle.startDate, lte: review.cycle.endDate } },
    select: { status: true },
  });
  const attendanceScore = attendance.length === 0
    ? 0
    : (attendance.filter((record) => ["PRESENT", "LATE"].includes(record.status)).length / attendance.length) * 100;
  const finalScore = attendanceScore * 0.4 + ((metrics.productivity + metrics.qualityOfWork + metrics.collaboration) / 3) * 20 * 0.6;

  const updated = await prisma.appraisalReview.update({
    where: { id: reviewId },
    data: {
      ...metrics,
      reviewerId: user.id,
      attendanceScore,
      finalScore,
      status: user.role === Role.TEAM_LEADER ? AppraisalStatus.SUBMITTED : AppraisalStatus.REVIEWED,
    },
  });
  revalidatePath("/dashboard/performance");
  return updated;
}