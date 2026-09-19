"use server";

import { AppraisalStatus, Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getActiveUser, isTeamLead } from "@/lib/auth";
import { PERFORMANCE_ROLES } from "@/lib/auth-shared";
import { employeeScope, getActiveCompanyId } from "@/lib/company";

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
 * HR admins see the company picked in the TopNav switcher, or their own company when they cannot switch.
 */
export async function getReviewsForCycle(cycleId: string, managerEmployeeId?: string) {
  const user = await requirePerformanceAccess();
  const cycle = await prisma.appraisalCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new Error("Appraisal cycle not found");

  let employeeFilter: Prisma.EmployeeWhereInput;
  if (isTeamLead(user.role)) {
    if (!user.employeeId) throw new Error("Team leader profile is not linked to an employee");
    employeeFilter = { managerId: user.employeeId };
  } else {
    employeeFilter = { ...employeeScope(await getActiveCompanyId()), ...(managerEmployeeId ? { managerId: managerEmployeeId } : {}) };
  }

  const employees = await prisma.employee.findMany({
    where: employeeFilter,
    include: { department: true, designation: true, manager: true, user: true },
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

export async function submitPerformanceReview(
  cycleId: string,
  employeeId: string,
  metrics: { productivity: number; qualityOfWork: number; collaboration: number; feedback?: string },
) {
  const user = await requirePerformanceAccess();
  const [cycle, employee] = await Promise.all([
    prisma.appraisalCycle.findUnique({ where: { id: cycleId } }),
    prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, managerId: true, companyId: true } }),
  ]);
  if (!cycle) throw new Error("Appraisal cycle not found");
  if (!employee) throw new Error("Employee not found");
  if (isTeamLead(user.role)) {
    if (employee.managerId !== user.employeeId) throw new Error("You can only review direct reports");
  } else {
    const activeCompanyId = await getActiveCompanyId();
    if (activeCompanyId && employee.companyId !== activeCompanyId) throw new Error("This employee is outside the selected company");
  }
  if (![metrics.productivity, metrics.qualityOfWork, metrics.collaboration].every((score) => Number.isInteger(score) && score >= 1 && score <= 5)) {
    throw new Error("Each rating must be an integer from 1 to 5");
  }
  const feedback = metrics.feedback?.trim();
  if (!feedback) throw new Error("Feedback is required");

  const attendance = await prisma.attendanceRecord.findMany({
    where: { employeeId, date: { gte: cycle.startDate, lte: cycle.endDate } },
    select: { status: true },
  });
  const attendanceScore = attendance.length === 0
    ? 0
    : (attendance.filter((record) => ["PRESENT", "LATE"].includes(record.status)).length / attendance.length) * 100;
  const finalScore = attendanceScore * 0.4 + ((metrics.productivity + metrics.qualityOfWork + metrics.collaboration) / 3) * 20 * 0.6;

  const updated = await prisma.appraisalReview.upsert({
    where: { cycleId_employeeId: { cycleId, employeeId } },
    create: {
      cycleId,
      employeeId,
      productivity: metrics.productivity,
      qualityOfWork: metrics.qualityOfWork,
      collaboration: metrics.collaboration,
      feedback,
      reviewerId: user.id,
      attendanceScore,
      finalScore,
      status: user.role === Role.TEAM_LEADER ? AppraisalStatus.SUBMITTED : AppraisalStatus.REVIEWED,
    },
    update: {
      productivity: metrics.productivity,
      qualityOfWork: metrics.qualityOfWork,
      collaboration: metrics.collaboration,
      feedback,
      reviewerId: user.id,
      attendanceScore,
      finalScore,
      status: user.role === Role.TEAM_LEADER ? AppraisalStatus.SUBMITTED : AppraisalStatus.REVIEWED,
    },
  });
  revalidatePath("/dashboard/performance");
  return updated;
}

/** Compatibility path for the older inline review form. */
export async function submitEmployeeReview(
  reviewId: string,
  metrics: { productivity: number; qualityOfWork: number; collaboration: number; feedback?: string },
) {
  const review = await prisma.appraisalReview.findUnique({ where: { id: reviewId }, select: { cycleId: true, employeeId: true } });
  if (!review) throw new Error("Review not found");
  return submitPerformanceReview(review.cycleId, review.employeeId, metrics);
}