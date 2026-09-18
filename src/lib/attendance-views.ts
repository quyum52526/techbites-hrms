import { AttendanceStatus, type Prisma } from "@prisma/client";
import { orgToday } from "@/lib/attendance-time";

/**
 * Attendance drill-down views shared by the dashboard tiles and the Attendance page, so a number on a
 * tile always equals the length of the list it opens. `scope` is the employee filter (company / role).
 */
export const ATTENDANCE_FILTERS = ["checked-in", "not-punched-in", "on-leave"] as const;
export type AttendanceFilter = (typeof ATTENDANCE_FILTERS)[number];

const DATE_PARAM = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Reads `?date=` as `today` or `YYYY-MM-DD` into the UTC-midnight form attendance dates are stored in. */
export function parseDateParam(value: string | undefined): Date | null {
  if (!value) return null;
  if (value === "today") return orgToday();
  const match = DATE_PARAM.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCDate() === Number(match[3]) ? date : null;
}

export const toDateParam = (date: Date) => date.toISOString().slice(0, 10);

export function parseFilterParam(value: string | undefined): AttendanceFilter | null {
  return ATTENDANCE_FILTERS.find((f) => f === value) ?? null;
}

export function parseStatusParam(value: string | undefined): AttendanceStatus | null {
  const upper = value?.toUpperCase();
  return Object.values(AttendanceStatus).find((s) => s === upper) ?? null;
}

const approvedLeaveOn = (date: Date): Prisma.LeaveRequestWhereInput => ({
  status: "APPROVED",
  startDate: { lte: date },
  endDate: { gte: date },
});

export function checkedInWhere(scope: Prisma.EmployeeWhereInput, date: Date): Prisma.AttendanceRecordWhereInput {
  return { date, checkIn: { not: null }, employee: scope };
}

/** In the workforce, no check-in that day, and not covered by approved leave. */
export function notPunchedInWhere(scope: Prisma.EmployeeWhereInput, date: Date): Prisma.EmployeeWhereInput {
  return {
    ...scope,
    attendances: { none: { date, checkIn: { not: null } } },
    leaveRequests: { none: approvedLeaveOn(date) },
  };
}

export function onLeaveWhere(scope: Prisma.EmployeeWhereInput, date: Date): Prisma.LeaveRequestWhereInput {
  return { ...approvedLeaveOn(date), employee: scope };
}
