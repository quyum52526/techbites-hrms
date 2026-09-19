export type PayPulseAttendanceStatus = "PRESENT" | "LATE" | "EARLY_DEPARTURE" | "HALF_DAY" | "ABSENT" | "ON_LEAVE";

export interface PayPulseShiftRules {
  start: string;
  end: string;
  standardHours: number;
  graceMinutes: number;
  earlyDepartureGraceMinutes: number;
  autoCheckoutEnabled: boolean;
  autoCheckoutTime: string;
  overtimeCapHours?: number | null;
}

export interface DailySummaryResult {
  workDate: Date;
  firstIn: Date | null;
  lastOut: Date | null;
  totalLoggedHours: number;
  overtimeHours: number;
  attendanceStatus: PayPulseAttendanceStatus;
  lateMinutes: number;
  earlyDepartureMinutes: number;
}

const round = (value: number) => Math.round(value * 100) / 100;

function startOfUtcDate(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function parseTime(value: string, date: Date) {
  const [hours, minutes] = value.split(":").map(Number);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hours, minutes));
}

function minutesBetween(start: Date, end: Date) {
  return Math.max(0, (end.getTime() - start.getTime()) / 60_000);
}

export function summarizePayPulseDay(workDate: Date, punches: Date[], rules: PayPulseShiftRules): DailySummaryResult {
  const sorted = [...punches].sort((a, b) => a.getTime() - b.getTime());
  const firstIn = sorted[0] ?? null;
  let lastOut = sorted.length > 1 ? sorted[sorted.length - 1] : null;
  const day = startOfUtcDate(workDate);

  if (!firstIn) {
    return { workDate: day, firstIn: null, lastOut: null, totalLoggedHours: 0, overtimeHours: 0, attendanceStatus: "ABSENT", lateMinutes: 0, earlyDepartureMinutes: 0 };
  }

  if (!lastOut && rules.autoCheckoutEnabled && day.getTime() < startOfUtcDate(new Date()).getTime()) {
    lastOut = parseTime(rules.autoCheckoutTime, day);
  }

  const totalMinutes = lastOut ? minutesBetween(firstIn, lastOut) : 0;
  const shiftStart = parseTime(rules.start, day);
  const shiftEnd = parseTime(rules.end, day);
  const lateMinutes = Math.max(0, minutesBetween(shiftStart, firstIn) - rules.graceMinutes);
  const earlyDepartureMinutes = lastOut ? Math.max(0, minutesBetween(lastOut, shiftEnd) - rules.earlyDepartureGraceMinutes) : 0;
  const totalLoggedHours = totalMinutes / 60;
  const overtimeRaw = Math.max(0, totalLoggedHours - rules.standardHours);
  const overtimeHours = rules.overtimeCapHours == null ? overtimeRaw : Math.min(overtimeRaw, rules.overtimeCapHours);

  let attendanceStatus: PayPulseAttendanceStatus = "PRESENT";
  if (totalMinutes > 0 && totalLoggedHours < rules.standardHours / 2) attendanceStatus = "HALF_DAY";
  else if (lateMinutes > 0) attendanceStatus = "LATE";
  else if (earlyDepartureMinutes > 0) attendanceStatus = "EARLY_DEPARTURE";

  return { workDate: day, firstIn, lastOut, totalLoggedHours: round(totalLoggedHours), overtimeHours: round(overtimeHours), attendanceStatus, lateMinutes: Math.round(lateMinutes), earlyDepartureMinutes: Math.round(earlyDepartureMinutes) };
}