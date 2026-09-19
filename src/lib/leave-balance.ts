import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { orgToday } from "@/lib/attendance-time";
import type { LeaveTypeBalance } from "@/lib/leave-shared";

const DAY_MS = 86_400_000;

/** Calendar days of the leave [start, end] that fall inside [from, to]. Leave dates are stored as UTC-midnight dates. */
export function leaveDaysWithin(start: Date, end: Date, from: Date, to: Date) {
  const first = Math.max(start.getTime(), from.getTime());
  const last = Math.min(end.getTime(), to.getTime());
  return last < first ? 0 : Math.round((last - first) / DAY_MS) + 1;
}

/** Inclusive calendar days of a leave request. */
export const leaveDays = (start: Date, end: Date) => leaveDaysWithin(start, end, start, end);

/** The leave year is the calendar year in organisation time. */
export function leaveYearBounds(year = orgToday().getUTCFullYear()) {
  return { year, from: new Date(Date.UTC(year, 0, 1)), to: new Date(Date.UTC(year, 11, 31)) };
}

/**
 * Quota, used and remaining days per leave type for every employee matching `employeeWhere`, in the given leave year.
 * Only APPROVED requests count as used; a request spanning New Year counts only its days inside the year.
 */
export async function getLeaveBalances(employeeWhere: Prisma.EmployeeWhereInput, year?: number) {
  const { from, to, year: leaveYear } = leaveYearBounds(year);
  const [leaveTypes, approved] = await Promise.all([
    prisma.leaveType.findMany({ select: { id: true, name: true, daysAllowed: true }, orderBy: { name: "asc" } }),
    prisma.leaveRequest.findMany({
      where: { status: "APPROVED", startDate: { lte: to }, endDate: { gte: from }, employee: employeeWhere },
      select: { employeeId: true, leaveTypeId: true, startDate: true, endDate: true },
    }),
  ]);

  const usedDays = new Map<string, number>();
  for (const leave of approved) {
    const key = `${leave.employeeId}:${leave.leaveTypeId}`;
    usedDays.set(key, (usedDays.get(key) ?? 0) + leaveDaysWithin(leave.startDate, leave.endDate, from, to));
  }

  return {
    year: leaveYear,
    balancesFor: (employeeId: string): LeaveTypeBalance[] =>
      leaveTypes.map((type) => {
        const used = usedDays.get(`${employeeId}:${type.id}`) ?? 0;
        return { leaveTypeId: type.id, name: type.name, quota: type.daysAllowed, used, remaining: type.daysAllowed - used };
      }),
  };
}
