const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Attendance fine policy. Only attendance records explicitly marked ABSENT or LATE are counted —
 * days with no record are never fined, so missing punch data cannot wipe out a salary.
 */
export const PAYROLL_POLICY = {
  /** A day's pay = basic salary / this divisor. */
  dayRateDivisor: 30,
  /** Each full block of this many LATE days is fined one day's pay. */
  lateDaysPerDayDeduction: 3,
};

export type PayrollPeriod = { month: number; year: number };

/** `PayrollRecord.month` storage label, e.g. "September 2026". */
export const periodLabel = ({ month, year }: PayrollPeriod) => `${MONTH_NAMES[month - 1]} ${year}`;

/** URL / <input type="month"> value, e.g. "2026-09". */
export const periodParam = ({ month, year }: PayrollPeriod) => `${year}-${String(month).padStart(2, "0")}`;

export function parsePeriodParam(value: string | undefined | null): PayrollPeriod | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const period = { year: Number(match[1]), month: Number(match[2]) };
  return isValidPeriod(period) ? period : null;
}

export const isValidPeriod = ({ month, year }: PayrollPeriod) =>
  Number.isInteger(month) && Number.isInteger(year) && month >= 1 && month <= 12 && year >= 2000 && year <= 2100;

/** First and last calendar day of the period as UTC-midnight dates, matching `AttendanceRecord.date`. */
export function periodDateRange({ month, year }: PayrollPeriod) {
  return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 0)) };
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function calculatePayroll(
  salary: { basicSalary: number; houseRent: number; medicalAllow: number; otherAllow: number; taxDeduction: number; providentFund: number },
  attendance: { lateDays: number; absentDays: number }
) {
  const dayRate = salary.basicSalary / PAYROLL_POLICY.dayRateDivisor;
  const finedDays = attendance.absentDays + Math.floor(attendance.lateDays / PAYROLL_POLICY.lateDaysPerDayDeduction);
  const attendanceDeduction = round2(dayRate * finedDays);

  const allowances = round2(salary.houseRent + salary.medicalAllow + salary.otherAllow);
  const deductions = round2(salary.taxDeduction + salary.providentFund + attendanceDeduction);
  // Net pay never goes negative, even if fines exceed earnings.
  const netSalary = Math.max(0, round2(salary.basicSalary + allowances - deductions));

  return {
    basicSalary: salary.basicSalary,
    houseRent: salary.houseRent,
    medicalAllow: salary.medicalAllow,
    otherAllow: salary.otherAllow,
    taxDeduction: salary.taxDeduction,
    providentFund: salary.providentFund,
    attendanceDeduction,
    lateDays: attendance.lateDays,
    absentDays: attendance.absentDays,
    allowances,
    deductions,
    netSalary,
  };
}

/** Bangladeshi Taka with South-Asian digit grouping, e.g. ৳1,25,000.00 */
export const formatMoney = (value: number) =>
  `৳${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
