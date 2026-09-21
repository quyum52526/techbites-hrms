"use server";

import { AttendanceStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getWritableUser, requireWriteAccess } from "@/lib/auth";
import { GUEST_READ_ONLY_MESSAGE } from "@/lib/auth-shared";
import { getActiveCompanyId } from "@/lib/company";
import { readCsvRecords } from "@/lib/csv";
import { readUploadedCsv, type ImportIssue, type ImportResult } from "@/lib/import-result";
import {
  DEFAULT_SHIFT_POLICY,
  evaluateCheckInStatus,
  orgDateOf,
  orgToday,
  parsePunchTimestamp,
} from "@/lib/attendance-time";

/** Web punch for the signed-in user's own employee record; the client never chooses whose attendance it marks. */
export async function toggleAttendance() {
  const user = await requireWriteAccess();
  if (!user.employeeId) {
    throw new Error("Your account is not linked to an employee record");
  }
  const employeeId = user.employeeId;
  const today = orgToday();

  const existingRecord = await prisma.attendanceRecord.findFirst({
    where: {
      employeeId,
      date: today,
    },
  });

  if (!existingRecord) {
    // Clock-in
    await prisma.attendanceRecord.create({
      data: {
        employeeId,
        date: today,
        checkIn: new Date(),
        status: "PRESENT",
        source: "WEB",
      },
    });
  } else if (!existingRecord.checkOut) {
    // Clock-out
    await prisma.attendanceRecord.update({
      where: { id: existingRecord.id },
      data: {
        checkOut: new Date(),
      },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/attendance");
}

const MAX_PUNCH_ROWS = 50_000;
/** Statuses set manually by HR that a device log should not overwrite. */
const PROTECTED_STATUSES: AttendanceStatus[] = [AttendanceStatus.ON_LEAVE, AttendanceStatus.HALF_DAY];

/**
 * Imports biometric device punch logs (columns: biometricId, timestamp).
 * For each employee/day the earliest punch is the check-in and the latest (if different) the check-out,
 * merged with any record already stored for that day, so re-uploading the same log is harmless.
 * Unmatched or invalid rows are skipped and reported; valid rows are still imported.
 */
export async function importPunchLogsCsv(formData: FormData): Promise<ImportResult> {
  const fail = (message: string, issues: ImportIssue[] = []): ImportResult => ({ ok: false, message, stats: [], issues });

  const user = await getWritableUser();
  if (!user) return fail(GUEST_READ_ONLY_MESSAGE);
  if (user.role !== Role.SUPER_ADMIN && user.role !== Role.HR_ADMIN) {
    return fail("You do not have permission to import attendance logs");
  }

  const upload = await readUploadedCsv(formData);
  if (!upload.ok) return upload.result;

  const parsed = readCsvRecords(upload.text, ["biometricId", "timestamp"]);
  if (!parsed.ok) return fail(parsed.error);
  if (parsed.records.length > MAX_PUNCH_ROWS) {
    return fail(`A single upload is limited to ${MAX_PUNCH_ROWS.toLocaleString()} punches; this file has ${parsed.records.length.toLocaleString()}`);
  }

  const issues: ImportIssue[] = [];
  const punches: { line: number; biometricId: string; at: Date }[] = [];
  for (const { line, values } of parsed.records) {
    if (!values.biometricid) {
      issues.push({ line, message: "biometricId is empty" });
      continue;
    }
    const at = parsePunchTimestamp(values.timestamp ?? "");
    if (!at) {
      issues.push({ line, message: `Unrecognized timestamp "${values.timestamp}" — use DD/MM/YYYY HH:mm:ss or YYYY-MM-DD HH:mm:ss` });
      continue;
    }
    punches.push({ line, biometricId: values.biometricid, at });
  }

  const [activeCompanyId, shift] = await Promise.all([getActiveCompanyId(), prisma.shift.findFirst({ orderBy: { createdAt: "asc" } })]);
  const policy = shift ?? DEFAULT_SHIFT_POLICY;

  const employees = await prisma.employee.findMany({
    where: { biometricId: { in: [...new Set(punches.map((p) => p.biometricId))] } },
    select: { id: true, biometricId: true, companyId: true },
  });
  const employeeByBiometric = new Map(employees.map((e) => [e.biometricId!, e]));

  // Group punches per employee per org-local day.
  const groups = new Map<string, { employeeId: string; date: Date; first: Date; last: Date }>();
  let matchedPunches = 0;
  for (const punch of punches) {
    const employee = employeeByBiometric.get(punch.biometricId);
    if (!employee) {
      issues.push({ line: punch.line, message: `No employee has biometric ID "${punch.biometricId}"` });
      continue;
    }
    if (activeCompanyId && employee.companyId !== activeCompanyId) {
      issues.push({ line: punch.line, message: `Biometric ID "${punch.biometricId}" belongs to an employee outside the selected company` });
      continue;
    }
    matchedPunches++;
    const date = orgDateOf(punch.at);
    const key = `${employee.id}|${date.toISOString()}`;
    const group = groups.get(key);
    if (!group) groups.set(key, { employeeId: employee.id, date, first: punch.at, last: punch.at });
    else {
      if (punch.at < group.first) group.first = punch.at;
      if (punch.at > group.last) group.last = punch.at;
    }
  }

  if (groups.size === 0) {
    issues.sort((a, b) => a.line - b.line);
    return fail("No punches matched an employee, so no attendance was recorded.", issues);
  }

  const groupList = [...groups.values()];
  let minDate = groupList[0].date;
  let maxDate = groupList[0].date;
  for (const { date } of groupList) {
    if (date < minDate) minDate = date;
    if (date > maxDate) maxDate = date;
  }
  const existingRecords = await prisma.attendanceRecord.findMany({
    where: {
      employeeId: { in: [...new Set(groupList.map((g) => g.employeeId))] },
      date: { gte: minDate, lte: maxDate },
    },
  });
  const existingByKey = new Map(existingRecords.map((r) => [`${r.employeeId}|${r.date.toISOString()}`, r]));

  const stats = { created: 0, updated: 0, checkIns: 0, checkOuts: 0, late: 0 };
  const toCreate: Prisma.AttendanceRecordCreateManyInput[] = [];
  const toUpdate: { id: string; checkIn: Date; checkOut: Date | null; status: AttendanceStatus }[] = [];

  for (const [key, group] of groups) {
    const existing = existingByKey.get(key);
    const times = [group.first, group.last, existing?.checkIn, existing?.checkOut]
      .filter((t): t is Date => t instanceof Date)
      .sort((a, b) => a.getTime() - b.getTime());
    const checkIn = times[0];
    const latest = times[times.length - 1];
    const checkOut = latest.getTime() > checkIn.getTime() ? latest : null;
    const status =
      existing && PROTECTED_STATUSES.includes(existing.status) ? existing.status : evaluateCheckInStatus(checkIn, policy);

    stats.checkIns++;
    if (checkOut) stats.checkOuts++;
    if (status === AttendanceStatus.LATE) stats.late++;

    if (!existing) {
      stats.created++;
      toCreate.push({ employeeId: group.employeeId, date: group.date, checkIn, checkOut, status, shiftId: shift?.id ?? null, source: "BIOMETRIC_CSV" });
    } else if (
      existing.checkIn?.getTime() !== checkIn.getTime() ||
      (existing.checkOut?.getTime() ?? null) !== (checkOut?.getTime() ?? null) ||
      existing.status !== status
    ) {
      stats.updated++;
      toUpdate.push({ id: existing.id, checkIn, checkOut, status });
    }
  }

  await prisma.$transaction(
    async (tx) => {
      if (toCreate.length > 0) await tx.attendanceRecord.createMany({ data: toCreate, skipDuplicates: true });
      for (const { id, ...data } of toUpdate) {
        await tx.attendanceRecord.update({ where: { id }, data });
      }
    },
    { timeout: 120_000, maxWait: 10_000 }
  );

  revalidatePath("/dashboard", "layout");
  issues.sort((a, b) => a.line - b.line);

  return {
    ok: true,
    message:
      issues.length > 0
        ? `Imported ${matchedPunches.toLocaleString()} punch(es); ${issues.length} row(s) were skipped (listed below).`
        : `Imported ${matchedPunches.toLocaleString()} punch(es) against shift start ${policy.startTime} with ${policy.graceMinutes} min grace.`,
    stats: [
      { label: "Check-ins", value: stats.checkIns },
      { label: "Check-outs", value: stats.checkOuts },
      { label: "Late", value: stats.late },
      { label: "Records created", value: stats.created },
      { label: "Records updated", value: stats.updated },
    ],
    issues,
  };
}
