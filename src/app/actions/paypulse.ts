"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveUser } from "@/lib/auth";
import { summarizePayPulseDay, type PayPulseShiftRules } from "@/lib/paypulse-attendance-engine";

const DEFAULT_RULES: PayPulseShiftRules = {
  start: "09:00",
  end: "18:00",
  standardHours: 8,
  graceMinutes: 15,
  earlyDepartureGraceMinutes: 15,
  autoCheckoutEnabled: false,
  autoCheckoutTime: "18:00",
};

export async function processPayPulsePunches(): Promise<{ processed: number; summaries: number; unmapped: string[] }> {
  const user = await getActiveUser();
  if (user.role !== Role.SUPER_ADMIN && user.role !== Role.HR_ADMIN) throw new Error("You do not have permission to process attendance logs");

  const logs = await prisma.rawAttendanceLog.findMany({ where: { processed: false, ...(user.role === "SUPER_ADMIN" ? {} : { company_id: user.companyId ?? "__no-company__" }) }, orderBy: { punch_timestamp: "asc" } });
  const employees = await prisma.employee.findMany({ where: { companyId: user.role === "SUPER_ADMIN" ? undefined : user.companyId ?? "__no-company__", biometricId: { in: [...new Set(logs.map((log) => log.device_user_id))] } }, select: { id: true, biometricId: true } });
  const employeeByBiometric = new Map(employees.map((employee) => [employee.biometricId, employee.id]));
  const groups = new Map<string, { employeeId: string; date: Date; punches: Date[]; logIds: string[] }>();
  const unmapped = new Set<string>();

  for (const log of logs) {
    const employeeId = employeeByBiometric.get(log.device_user_id);
    if (!employeeId) {
      unmapped.add(log.device_user_id);
      continue;
    }
    const date = new Date(Date.UTC(log.punch_timestamp.getUTCFullYear(), log.punch_timestamp.getUTCMonth(), log.punch_timestamp.getUTCDate()));
    const key = `${employeeId}|${date.toISOString()}`;
    const group = groups.get(key) ?? { employeeId, date, punches: [], logIds: [] };
    group.punches.push(log.punch_timestamp);
    group.logIds.push(log.id);
    groups.set(key, group);
  }

  await prisma.$transaction(async (tx) => {
    for (const group of groups.values()) {
      const summary = summarizePayPulseDay(group.date, group.punches, DEFAULT_RULES);
      await tx.dailyAttendanceSummary.upsert({
        where: { employee_id_work_date: { employee_id: group.employeeId, work_date: summary.workDate } },
        create: { employee_id: group.employeeId, work_date: summary.workDate, first_in: summary.firstIn, last_out: summary.lastOut, total_logged_hours: summary.totalLoggedHours, overtime_hours: summary.overtimeHours, late_minutes: summary.lateMinutes, attendance_status: summary.attendanceStatus },
        update: { first_in: summary.firstIn, last_out: summary.lastOut, total_logged_hours: summary.totalLoggedHours, overtime_hours: summary.overtimeHours, late_minutes: summary.lateMinutes, attendance_status: summary.attendanceStatus },
      });
      await tx.rawAttendanceLog.updateMany({ where: { id: { in: group.logIds } }, data: { employee_id: group.employeeId, processed: true } });
    }
  });

  revalidatePath("/dashboard/attendance");
  return { processed: groups.size, summaries: groups.size, unmapped: [...unmapped] };
}