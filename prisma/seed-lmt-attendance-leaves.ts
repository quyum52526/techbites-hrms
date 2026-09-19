/**
 * Demo attendance and leave data for LMT CO, lmt agro and every other sister concern of LMT CO,
 * 1 Aug 2026 – 19 Sep 2026.
 *
 * Safe to re-run: attendance is inserted with skipDuplicates (existing records, including real punches, are never
 * overwritten) and each leave request is created only if the same employee/type/dates does not exist yet.
 * Randomness is seeded, so every run produces the same data. Seeded attendance carries source "SEED".
 *
 * Run: npx tsx prisma/seed-lmt-attendance-leaves.ts
 */
import { AttendanceStatus, EmployeeStatus, LeaveStatus, Prisma, PrismaClient } from "@prisma/client";
import { DEFAULT_SHIFT_POLICY, evaluateCheckInStatus, ORG_UTC_OFFSET_MINUTES } from "../src/lib/attendance-time";

const prisma = new PrismaClient();

const PARENT_COMPANY = "LMT CO";
const RANGE_START = "2026-08-01";
const RANGE_END = "2026-09-19";
const WEEKLY_OFF_DAY = 5; // Friday (UTC day index of the org-local date)
const ATTENDANCE_RATE = 0.93;
const SEED_SOURCE = "SEED";
const ACTIVE_STATUSES: EmployeeStatus[] = [EmployeeStatus.ACTIVE, EmployeeStatus.PROBATION, EmployeeStatus.NOTICE_PERIOD];

type LeaveFixture = {
  employeeCode: string;
  leaveType: "Casual Leave" | "Sick Leave" | "Annual Leave";
  start: string;
  end: string;
  reason: string;
  status: LeaveStatus;
};

/** Approved leave in the past (attendance on those days becomes ON_LEAVE), plus one request at each pending stage. */
const LEAVES: LeaveFixture[] = [
  { employeeCode: "1001", leaveType: "Annual Leave", start: "2026-08-10", end: "2026-08-13", reason: "Family trip to Sylhet", status: "APPROVED" },
  { employeeCode: "lmt1005", leaveType: "Sick Leave", start: "2026-08-31", end: "2026-08-31", reason: "Medical checkup", status: "APPROVED" },
  { employeeCode: "lmt2011", leaveType: "Sick Leave", start: "2026-08-24", end: "2026-08-25", reason: "Fever; doctor advised two days of rest", status: "APPROVED" },
  { employeeCode: "lmt2008", leaveType: "Casual Leave", start: "2026-09-02", end: "2026-09-02", reason: "Personal errands at the land office", status: "APPROVED" },
  { employeeCode: "lmt1002", leaveType: "Casual Leave", start: "2026-09-08", end: "2026-09-09", reason: "Family emergency", status: "APPROVED" },
  // Upcoming leave applied for in September, one at each approval stage.
  { employeeCode: "lmt1011", leaveType: "Casual Leave", start: "2026-09-22", end: "2026-09-23", reason: "Sister's wedding preparations", status: "PENDING_TL" },
  { employeeCode: "lmt1012", leaveType: "Annual Leave", start: "2026-09-27", end: "2026-10-01", reason: "Annual family visit to the village home", status: "PENDING_MANAGER" },
  { employeeCode: "lmt2007", leaveType: "Sick Leave", start: "2026-09-21", end: "2026-09-21", reason: "Dental treatment appointment", status: "PENDING_HR" },
];

/** mulberry32: small deterministic PRNG so re-runs generate identical data. */
function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable per-employee seed, so adding an employee does not reshuffle everyone else's data. */
const seedFor = (text: string) => [...text].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261);

const dateOnly = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const DAY_MS = 86_400_000;

/** Instant of an org-local (Asia/Dhaka) wall-clock time on the given org date. */
const orgInstant = (date: Date, minutesOfDay: number, seconds: number) =>
  new Date(date.getTime() + (minutesOfDay - ORG_UTC_OFFSET_MINUTES) * 60_000 + seconds * 1000);

/** Random whole minute in [from, to] (minutes since midnight) plus random seconds. */
const randomTime = (random: () => number, from: number, to: number) => ({
  minutes: from + Math.floor(random() * (to - from + 1)),
  seconds: Math.floor(random() * 60),
});

function* eachDate(from: Date, to: Date) {
  for (let t = from.getTime(); t <= to.getTime(); t += DAY_MS) yield new Date(t);
}

async function main() {
  const parent = await prisma.company.findFirst({ where: { name: PARENT_COMPANY }, select: { id: true, name: true } });
  if (!parent) throw new Error(`Company "${PARENT_COMPANY}" not found`);
  const companies = await prisma.company.findMany({
    where: { OR: [{ id: parent.id }, { parentId: parent.id }] },
    select: { id: true, name: true },
  });
  console.log(`Companies: ${companies.map((c) => c.name).join(", ")}`);

  const [employees, leaveTypes, shift] = await Promise.all([
    prisma.employee.findMany({
      where: { companyId: { in: companies.map((c) => c.id) }, status: { in: ACTIVE_STATUSES } },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        joiningDate: true,
        manager: { select: { user: { select: { id: true } }, manager: { select: { user: { select: { id: true } } } } } },
      },
      orderBy: { employeeCode: "asc" },
    }),
    prisma.leaveType.findMany({ select: { id: true, name: true } }),
    prisma.shift.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true, startTime: true, graceMinutes: true } }),
  ]);
  console.log(`Active employees: ${employees.length}`);
  const policy = shift ?? DEFAULT_SHIFT_POLICY;
  const hrApprover = await prisma.user.findFirst({
    where: { role: { in: ["HR_ADMIN", "SUPER_ADMIN"] }, isActive: true, employee: { companyId: parent.id } },
    select: { id: true },
  });

  // ---- Leave requests -------------------------------------------------------------------------------------------
  const employeeByCode = new Map(employees.map((e) => [e.employeeCode, e]));
  const leaveTypeByName = new Map(leaveTypes.map((t) => [t.name, t.id]));
  const onLeave = new Set<string>(); // `${employeeId}:${yyyy-mm-dd}` for approved leave days
  let leavesCreated = 0;

  for (const fixture of LEAVES) {
    const employee = employeeByCode.get(fixture.employeeCode);
    const leaveTypeId = leaveTypeByName.get(fixture.leaveType);
    if (!employee || !leaveTypeId) {
      console.warn(`  skip leave for ${fixture.employeeCode}: ${!employee ? "employee not active in scope" : `no "${fixture.leaveType}" type`}`);
      continue;
    }
    const startDate = dateOnly(fixture.start);
    const endDate = dateOnly(fixture.end);

    if (fixture.status === LeaveStatus.APPROVED) {
      for (const day of eachDate(startDate, endDate)) onLeave.add(`${employee.id}:${day.toISOString().slice(0, 10)}`);
    }

    // approvedBy holds whoever acted last: the TL for a request now at the manager or HR stage, HR for approved ones.
    const approvedBy =
      fixture.status === LeaveStatus.APPROVED
        ? (hrApprover?.id ?? null)
        : fixture.status === LeaveStatus.PENDING_MANAGER || fixture.status === LeaveStatus.PENDING_HR
          ? (employee.manager?.user?.id ?? null)
          : null;

    const existing = await prisma.leaveRequest.findFirst({ where: { employeeId: employee.id, leaveTypeId, startDate, endDate }, select: { id: true } });
    if (existing) continue;
    await prisma.leaveRequest.create({
      data: { employeeId: employee.id, leaveTypeId, startDate, endDate, reason: fixture.reason, status: fixture.status, approvedBy },
    });
    leavesCreated++;
    console.log(`  leave: ${employee.firstName} ${employee.lastName} · ${fixture.leaveType} ${fixture.start}…${fixture.end} · ${fixture.status}`);
  }

  // ---- Attendance -----------------------------------------------------------------------------------------------
  const now = new Date();
  const rangeStart = dateOnly(RANGE_START);
  const rangeEnd = dateOnly(RANGE_END);
  const rows: Prisma.AttendanceRecordCreateManyInput[] = [];
  const tally = { PRESENT: 0, LATE: 0, ABSENT: 0, ON_LEAVE: 0, HALF_DAY: 0 } satisfies Record<AttendanceStatus, number>;

  for (const employee of employees) {
    const random = createRandom(seedFor(employee.employeeCode));
    // Joining date as an org-local calendar day; nothing is generated before it.
    const joined = dateOnly(new Date(employee.joiningDate.getTime() + ORG_UTC_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10));
    const from = joined > rangeStart ? joined : rangeStart;

    for (const date of eachDate(from, rangeEnd)) {
      // Draw the day's random values up front so the sequence does not depend on which branch runs.
      const attends = random() < ATTENDANCE_RATE;
      const checkInAt = randomTime(random, 8 * 60 + 45, 9 * 60 + 15);
      const checkOutAt = randomTime(random, 17 * 60 + 45, 18 * 60 + 30);
      if (date.getUTCDay() === WEEKLY_OFF_DAY) continue;

      const key = `${employee.id}:${date.toISOString().slice(0, 10)}`;
      const base = { employeeId: employee.id, date, shiftId: shift?.id ?? null, source: SEED_SOURCE };

      if (onLeave.has(key)) {
        rows.push({ ...base, status: AttendanceStatus.ON_LEAVE, notes: "Approved leave" });
        tally.ON_LEAVE++;
        continue;
      }

      const checkIn = orgInstant(date, checkInAt.minutes, checkInAt.seconds);
      if (checkIn > now) continue; // today, before the shift has started: nothing to record yet

      if (!attends) {
        if (orgInstant(date, 18 * 60, 0) > now) continue; // too early today to call someone absent
        rows.push({ ...base, status: AttendanceStatus.ABSENT, notes: "No punch recorded" });
        tally.ABSENT++;
        continue;
      }

      const checkOut = orgInstant(date, checkOutAt.minutes, checkOutAt.seconds);
      const status = evaluateCheckInStatus(checkIn, policy);
      rows.push({ ...base, checkIn, checkOut: checkOut <= now ? checkOut : null, status });
      tally[status]++;
    }
  }

  const { count } = await prisma.attendanceRecord.createMany({ data: rows, skipDuplicates: true });

  console.log(`\nLeave requests created: ${leavesCreated} (of ${LEAVES.length} fixtures)`);
  console.log(`Attendance rows generated: ${rows.length}, inserted: ${count} (${rows.length - count} already existed and were left as is)`);
  console.log(`Generated by status: ${Object.entries(tally).filter(([, n]) => n > 0).map(([s, n]) => `${s} ${n}`).join(", ")}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
